"use server";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { head, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  bookingOfferings,
  bookingRequirementDocuments,
  bookingRequirementResponses,
  bookings,
  facilities,
  requirementQuestions,
  requirementSets,
  siteSettings,
} from "@/lib/db/schema";
import { assertRequirementsEditable, getNextRequirementSessions } from "@/lib/requirement-schedule";
import { REQUIREMENT_UPLOAD_LIMIT, REQUIREMENT_UPLOAD_TYPES, requirementNow } from "@/lib/requirement-policy";
import {
  getBookingRequirementDetail,
} from "@/lib/booking-requirements";



async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "editor")) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireCustomer() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  return session;
}

// Loads a booking only if it belongs to the logged-in customer (mirrors
// cancelCustomerBooking's ownership check).
async function loadOwnedBooking(bookingId: string, email: string) {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking || booking.customerEmail.toLowerCase() !== email.toLowerCase()) {
    throw new Error("Booking not found.");
  }
  return booking;
}

// ── Customer-facing ──────────────────────────────────────────────────────────

export async function getCustomerBookingRequirements(bookingId: string) {
  const session = await requireCustomer();
  const booking = await loadOwnedBooking(bookingId, session.user!.email!);
  const [facility] = await db
    .select({ name: facilities.name })
    .from(facilities)
    .where(eq(facilities.id, booking.facilityId))
    .limit(1);
  const detail = await getBookingRequirementDetail(booking.id, booking.requirementSetId);
  const nextSession = (await getNextRequirementSessions([booking.id])).get(booking.id);
  return {
    booking: {
      id: booking.id,
      facilityName: facility?.name ?? "Booking",
      startDate: nextSession ?? booking.startDate,
      startDatePast: booking.status === "cancelled" || !nextSession,
      completedAt: booking.requirementCompletedAt,
      confirmed: booking.status === "confirmed",
    },
    detail,
  };
}

export async function saveRequirementAnswers(formData: FormData) {
  const session = await requireCustomer();
  const bookingId = String(formData.get("bookingId") || "");
  const booking = await loadOwnedBooking(bookingId, session.user!.email!);
  await assertRequirementsEditable(booking);
  if (!booking.requirementSetId) throw new Error("This booking has no required information.");

  const questions = await db
    .select()
    .from(requirementQuestions)
    .where(
      and(eq(requirementQuestions.setId, booking.requirementSetId), eq(requirementQuestions.active, true))
    );

  for (const question of questions) {
    if (!formData.has(`answer_${question.id}`)) continue;
    const raw = formData.get(`answer_${question.id}`);
    let answerBool: boolean | null = null;
    let answerText: string | null = null;
    if (question.type === "yes_no") {
      const value = String(raw ?? "");
      answerBool = value === "yes" ? true : value === "no" ? false : null;
    } else {
      answerText = String(raw ?? "").trim() || null;
      if (answerText && answerText.length > 5000) throw new Error("Answers must be 5,000 characters or fewer.");
    }

    await db
      .insert(bookingRequirementResponses)
      .values({
        bookingId,
        questionId: question.id,
        questionLabel: question.label,
        answerBool,
        answerText,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [bookingRequirementResponses.bookingId, bookingRequirementResponses.questionId],
        set: { questionLabel: question.label, answerBool, answerText, updatedAt: new Date() },
      });
  }

  return refreshRequirementProgress(booking);
}

async function refreshRequirementProgress(booking: { id: string; requirementSetId: string | null }) {
  const detail = await getBookingRequirementDetail(booking.id, booking.requirementSetId);
  await db.update(bookings).set({ requirementCompletedAt: detail.complete ? sql`coalesce(${bookings.requirementCompletedAt}, ${new Date().toISOString()}::timestamp)` : null })
    .where(eq(bookings.id, booking.id));
  revalidatePath(`/account/bookings/${booking.id}/requirements`);
  revalidatePath("/account/bookings");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/bookings/requirements/outstanding");
  revalidatePath(`/admin/bookings/${booking.id}/edit`);
  return detail;
}

export async function authorizeRequirementUpload(bookingId: string, questionId: string) {
  const session = await requireCustomer();
  const booking = await loadOwnedBooking(bookingId, session.user!.email!);
  await assertRequirementsEditable(booking);
  const detail = await getBookingRequirementDetail(booking.id, booking.requirementSetId);
  const question = detail.questions.find((q) => q.questionId === questionId);
  if (!question?.needsDocument) throw new Error("Save a yes answer before uploading a document for this question.");
  return { booking, question, userId: session.user!.id ?? null };
}

// The file travels directly to Blob. Only its URL is submitted to this action,
// avoiding both Next's action-body limit and Vercel's function-body limit.
export async function uploadRequirementDocument(formData: FormData) {
  const bookingId = String(formData.get("bookingId") || "");
  const questionId = String(formData.get("questionId") || "");
  const { booking, question, userId } = await authorizeRequirementUpload(bookingId, questionId);
  const url = String(formData.get("url") || "");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".public.blob.vercel-storage.com")) throw new Error("Invalid document URL.");
  const prefix = `booking-documents/${bookingId}/${questionId}/`;
  if (!decodeURIComponent(parsed.pathname).slice(1).startsWith(prefix)) throw new Error("This document does not belong to this question.");
  const blob = await head(url);
  if (!blob.pathname.startsWith(prefix) || blob.url !== url) throw new Error("Invalid document path.");
  if (!REQUIREMENT_UPLOAD_TYPES.includes(blob.contentType)) throw new Error("Upload a PDF, PNG or JPG file.");
  if (blob.size <= 0 || blob.size > REQUIREMENT_UPLOAD_LIMIT) throw new Error("Files must be between 1 byte and 10 MB.");
  await db.insert(bookingRequirementDocuments).values({ bookingId, questionId,
    documentLabel: question.documentLabel, fileUrl: blob.url,
    fileName: String(formData.get("fileName") || "Supporting document").slice(0, 255),
    fileSize: blob.size, mimeType: blob.contentType, uploadedBy: userId,
  }).onConflictDoNothing({ target: bookingRequirementDocuments.fileUrl });
  return refreshRequirementProgress(booking);
}

export async function deleteRequirementDocument(formData: FormData) {
  const session = await requireCustomer();
  const documentId = String(formData.get("documentId") || "");
  const [doc] = await db.select().from(bookingRequirementDocuments).where(eq(bookingRequirementDocuments.id, documentId)).limit(1);
  if (!doc) throw new Error("Document not found.");
  const booking = await loadOwnedBooking(doc.bookingId, session.user!.email!);
  await assertRequirementsEditable(booking);
  // Keep the database record until storage confirms deletion.
  await del(doc.fileUrl);
  await db.delete(bookingRequirementDocuments).where(eq(bookingRequirementDocuments.id, documentId));
  return refreshRequirementProgress(booking);
}

// ── Admin: requirement-set builder ───────────────────────────────────────────

export async function getRequirementSets() {
  await requireAdmin();
  const sets = await db.select().from(requirementSets).orderBy(asc(requirementSets.name));
  const questions = await db
    .select()
    .from(requirementQuestions)
    .where(eq(requirementQuestions.active, true))
    .orderBy(asc(requirementQuestions.sortOrder));
  return sets.map((set) => ({
    ...set,
    questions: questions.filter((q) => q.setId === set.id),
  }));
}

export async function createRequirementSet(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required.");
  await db.insert(requirementSets).values({
    name,
    description: String(formData.get("description") || "").trim() || null,
  });
  await logAudit({ action: "create", entity: "requirement_set", description: `Created requirement set ${name}` });
  revalidatePath("/admin/bookings/requirements");
}

export async function updateRequirementSet(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required.");
  await db
    .update(requirementSets)
    .set({
      name,
      description: String(formData.get("description") || "").trim() || null,
      active: formData.get("active") !== "off",
      updatedAt: new Date(),
    })
    .where(eq(requirementSets.id, id));
  revalidatePath("/admin/bookings/requirements");
}

export async function addRequirementQuestion(formData: FormData) {
  await requireAdmin();
  const setId = String(formData.get("setId") || "");
  const label = String(formData.get("label") || "").trim();
  if (!setId || !label) throw new Error("A question label is required.");
  const type = formData.get("type") === "text" ? "text" : "yes_no";
  const requiresDocumentOnYes = type === "yes_no" && formData.get("requiresDocumentOnYes") === "on";
  const [duplicate] = await db
    .select({ id: requirementQuestions.id })
    .from(requirementQuestions)
    .where(
      and(
        eq(requirementQuestions.setId, setId),
        eq(requirementQuestions.label, label),
        eq(requirementQuestions.active, true)
      )
    )
    .limit(1);
  if (duplicate) {
    revalidatePath("/admin/bookings/requirements");
    return;
  }
  const [last] = await db
    .select({ sortOrder: requirementQuestions.sortOrder })
    .from(requirementQuestions)
    .where(eq(requirementQuestions.setId, setId))
    .orderBy(desc(requirementQuestions.sortOrder))
    .limit(1);
  await db.insert(requirementQuestions).values({
    setId,
    label,
    type,
    requiresDocumentOnYes,
    documentLabel: requiresDocumentOnYes
      ? String(formData.get("documentLabel") || "").trim() || "Supporting document"
      : null,
    sortOrder: (last?.sortOrder ?? -1) + 1,
  });
  await db.update(bookings).set({ requirementCompletedAt: null }).where(eq(bookings.requirementSetId, setId));
  revalidatePath("/admin/bookings/requirements");
}

export async function updateRequirementQuestion(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Question not found.");
  if (formData.get("intent") === "remove") {
    await db
      .update(requirementQuestions)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(requirementQuestions.id, id));
    revalidatePath("/admin/bookings/requirements");
    return;
  }
  const label = String(formData.get("label") || "").trim();
  if (!label) throw new Error("A question label is required.");
  const type = formData.get("type") === "text" ? "text" : "yes_no";
  const requiresDocumentOnYes = type === "yes_no" && formData.get("requiresDocumentOnYes") === "on";
  const [existing] = await db.select().from(requirementQuestions).where(eq(requirementQuestions.id, id)).limit(1);
  if (!existing) throw new Error("Question not found.");
  const documentLabel = requiresDocumentOnYes ? String(formData.get("documentLabel") || "").trim() || "Supporting document" : null;
  const changed = existing.label !== label || existing.type !== type || existing.requiresDocumentOnYes !== requiresDocumentOnYes || existing.documentLabel !== documentLabel;
  if (changed) {
    await db.update(requirementQuestions).set({ label, type, requiresDocumentOnYes, documentLabel, updatedAt: new Date() }).where(eq(requirementQuestions.id, id));
    await db.update(bookings).set({ requirementCompletedAt: null }).where(eq(bookings.requirementSetId, existing.setId));
  }
  revalidatePath("/admin/bookings/requirements");
}

export async function removeRequirementQuestion(id: string) {
  await requireAdmin();
  if (!id) throw new Error("Question not found.");
  const [question] = await db
    .select({ id: requirementQuestions.id })
    .from(requirementQuestions)
    .where(eq(requirementQuestions.id, id))
    .limit(1);
  if (!question) throw new Error("Question not found.");
  await db
    .update(requirementQuestions)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(requirementQuestions.id, id));
  revalidatePath("/admin/bookings/requirements");
}

// ── Admin: assignment to booking types ───────────────────────────────────────

export async function getAdminOfferingsForRequirements() {
  await requireAdmin();
  return db
    .select({
      id: bookingOfferings.id,
      name: bookingOfferings.name,
      active: bookingOfferings.active,
      requirementSetId: bookingOfferings.requirementSetId,
      facilityName: facilities.name,
    })
    .from(bookingOfferings)
    .innerJoin(facilities, eq(bookingOfferings.facilityId, facilities.id))
    .orderBy(asc(facilities.name), asc(bookingOfferings.name));
}

export async function assignRequirementSetToOffering(formData: FormData) {
  await requireAdmin();
  const offeringId = String(formData.get("offeringId") || "");
  const raw = String(formData.get("requirementSetId") || "");
  const requirementSetId = raw === "" ? null : raw;

  await db
    .update(bookingOfferings)
    .set({ requirementSetId, updatedAt: new Date() })
    .where(eq(bookingOfferings.id, offeringId));

  // Backfill future, non-cancelled bookings of this type that don't yet have a
  // set, so turning requirements on applies to upcoming bookings.
  if (requirementSetId) await db
    .update(bookings)
    .set({ requirementSetId, requirementCompletedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(bookings.offeringId, offeringId),
        isNull(bookings.requirementSetId),
        sql`exists (select 1 from booking_occurrences o where o.booking_id = ${bookings.id} and o.status <> 'cancelled' and o.start_date > ${requirementNow().toISOString()}::timestamp)`,
        inArray(bookings.status, ["pending_payment", "confirmed", "payment_failed"])
      )
    );

  revalidatePath("/admin/bookings/settings");
}

// ── Admin: booking detail ────────────────────────────────────────────────────

export async function getAdminBookingRequirements(bookingId: string) {
  await requireAdmin();
  const [booking] = await db
    .select({ requirementSetId: bookings.requirementSetId })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) return null;
  return getBookingRequirementDetail(bookingId, booking.requirementSetId);
}
