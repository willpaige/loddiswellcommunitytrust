"use server";

import { addDays, format, startOfDay } from "date-fns";
import { and, asc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { put, del } from "@vercel/blob";
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
import { sendTemplateEmail } from "@/lib/email/send";
import {
  getBookingRequirementDetail,
  getBookingRequirementStatuses,
} from "@/lib/booking-requirements";

const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

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
  if (!booking || booking.customerEmail !== email.toLowerCase()) {
    throw new Error("Booking not found.");
  }
  return booking;
}

async function getBookingManagerEmail() {
  const [settings] = await db
    .select({
      bookingManagerEmail: siteSettings.bookingManagerEmail,
      emailAddress: siteSettings.emailAddress,
    })
    .from(siteSettings)
    .limit(1);
  return settings?.bookingManagerEmail || settings?.emailAddress || null;
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
  return {
    booking: {
      id: booking.id,
      facilityName: facility?.name ?? "Booking",
      startDate: booking.startDate,
      startDatePast: booking.startDate.getTime() < Date.now(),
    },
    detail,
  };
}

export async function saveRequirementAnswers(formData: FormData) {
  const session = await requireCustomer();
  const bookingId = String(formData.get("bookingId") || "");
  const booking = await loadOwnedBooking(bookingId, session.user!.email!);
  if (!booking.requirementSetId) return;

  const questions = await db
    .select()
    .from(requirementQuestions)
    .where(
      and(eq(requirementQuestions.setId, booking.requirementSetId), eq(requirementQuestions.active, true))
    );

  for (const question of questions) {
    const raw = formData.get(`answer_${question.id}`);
    let answerBool: boolean | null = null;
    let answerText: string | null = null;
    if (question.type === "yes_no") {
      const value = String(raw ?? "");
      answerBool = value === "yes" ? true : value === "no" ? false : null;
    } else {
      answerText = String(raw ?? "").trim() || null;
    }

    await db
      .insert(bookingRequirementResponses)
      .values({
        bookingId,
        questionId: question.id,
        questionLabel: question.label,
        answerBool,
        answerText,
      })
      .onConflictDoUpdate({
        target: [bookingRequirementResponses.bookingId, bookingRequirementResponses.questionId],
        set: { questionLabel: question.label, answerBool, answerText, updatedAt: new Date() },
      });
  }

  revalidatePath(`/account/bookings/${bookingId}/requirements`);
  revalidatePath("/account/bookings");
  revalidatePath(`/admin/bookings/${bookingId}/edit`);
}

export async function uploadRequirementDocument(
  formData: FormData
): Promise<{ error?: string }> {
  const session = await requireCustomer();
  const bookingId = String(formData.get("bookingId") || "");
  const questionId = String(formData.get("questionId") || "");
  const booking = await loadOwnedBooking(bookingId, session.user!.email!);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (!ALLOWED_MIME.includes(file.type)) return { error: "Upload a PDF, PNG, or JPG file." };
  if (file.size > MAX_FILE_BYTES) return { error: "Files must be 10MB or smaller." };

  const [question] = await db
    .select()
    .from(requirementQuestions)
    .where(eq(requirementQuestions.id, questionId))
    .limit(1);
  if (
    !question ||
    question.setId !== booking.requirementSetId ||
    !question.requiresDocumentOnYes
  ) {
    return { error: "This question does not accept a document." };
  }
  const [response] = await db
    .select()
    .from(bookingRequirementResponses)
    .where(
      and(
        eq(bookingRequirementResponses.bookingId, bookingId),
        eq(bookingRequirementResponses.questionId, questionId)
      )
    )
    .limit(1);
  if (response?.answerBool !== true) {
    return { error: "Answer yes before uploading a document." };
  }

  const stamp = Math.random().toString(36).slice(2, 8);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blob = await put(`booking-documents/${bookingId}/${stamp}-${safeName}`, file, {
    access: "public",
  });

  await db.insert(bookingRequirementDocuments).values({
    bookingId,
    questionId,
    documentLabel: question.documentLabel,
    fileUrl: blob.url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    uploadedBy: session.user!.id ?? null,
  });

  revalidatePath(`/account/bookings/${bookingId}/requirements`);
  revalidatePath("/account/bookings");
  revalidatePath(`/admin/bookings/${bookingId}/edit`);
  return {};
}

export async function deleteRequirementDocument(formData: FormData) {
  const session = await requireCustomer();
  const documentId = String(formData.get("documentId") || "");
  const [doc] = await db
    .select()
    .from(bookingRequirementDocuments)
    .where(eq(bookingRequirementDocuments.id, documentId))
    .limit(1);
  if (!doc) throw new Error("Document not found.");
  const booking = await loadOwnedBooking(doc.bookingId, session.user!.email!);
  if (booking.startDate.getTime() < Date.now()) {
    throw new Error("This booking has already started.");
  }

  try {
    await del(doc.fileUrl);
  } catch (error) {
    console.error("Failed to delete blob", error);
  }
  await db.delete(bookingRequirementDocuments).where(eq(bookingRequirementDocuments.id, documentId));

  revalidatePath(`/account/bookings/${doc.bookingId}/requirements`);
  revalidatePath("/account/bookings");
  revalidatePath(`/admin/bookings/${doc.bookingId}/edit`);
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
  const [last] = await db
    .select({ sortOrder: requirementQuestions.sortOrder })
    .from(requirementQuestions)
    .where(eq(requirementQuestions.setId, setId))
    .orderBy(asc(requirementQuestions.sortOrder));
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
  revalidatePath("/admin/bookings/requirements");
}

export async function updateRequirementQuestion(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const label = String(formData.get("label") || "").trim();
  if (!id || !label) throw new Error("A question label is required.");
  const type = formData.get("type") === "text" ? "text" : "yes_no";
  const requiresDocumentOnYes = type === "yes_no" && formData.get("requiresDocumentOnYes") === "on";
  await db
    .update(requirementQuestions)
    .set({
      label,
      type,
      requiresDocumentOnYes,
      documentLabel: requiresDocumentOnYes
        ? String(formData.get("documentLabel") || "").trim() || "Supporting document"
        : null,
      updatedAt: new Date(),
    })
    .where(eq(requirementQuestions.id, id));
  revalidatePath("/admin/bookings/requirements");
}

export async function deactivateRequirementQuestion(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
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
  await db
    .update(bookings)
    .set({ requirementSetId, updatedAt: new Date() })
    .where(
      and(
        eq(bookings.offeringId, offeringId),
        gte(bookings.startDate, new Date()),
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

// ── Chase cron ───────────────────────────────────────────────────────────────

export async function sendDueRequirementReminders() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const managerEmail = await getBookingManagerEmail();
  const today = startOfDay(new Date());
  let checked = 0;
  let sent = 0;

  for (const milestone of [14, 7]) {
    const from = addDays(today, milestone);
    const to = addDays(today, milestone + 1);
    const candidates = await db
      .select({
        id: bookings.id,
        customerName: bookings.customerName,
        customerEmail: bookings.customerEmail,
        startDate: bookings.startDate,
        requirementSetId: bookings.requirementSetId,
        facilityName: facilities.name,
      })
      .from(bookings)
      .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
      .where(
        and(
          eq(bookings.status, "confirmed"),
          isNotNull(bookings.requirementSetId),
          gte(bookings.startDate, from),
          lt(bookings.startDate, to)
        )
      );

    checked += candidates.length;
    if (candidates.length === 0) continue;

    const statuses = await getBookingRequirementStatuses(candidates.map((b) => b.id));

    for (const booking of candidates) {
      const status = statuses.get(booking.id);
      if (!status?.hasRequirements || status.complete) continue;

      const detail = await getBookingRequirementDetail(booking.id, booking.requirementSetId);
      const outstanding = detail.questions
        .filter((q) => !q.answered || (q.needsDocument && q.documents.length === 0))
        .map((q) => (!q.answered ? `- ${q.label}` : `- ${q.documentLabel || q.label} (document needed)`))
        .join("\n");
      const startDate = format(booking.startDate, "d MMM yyyy, HH:mm");
      const bookingUrl = `${appUrl}/account/bookings/${booking.id}/requirements`;

      const customerResult = await sendTemplateEmail({
        key: "booking_requirements_customer",
        to: booking.customerEmail,
        variables: {
          customerName: booking.customerName,
          facilityName: booking.facilityName,
          startDate,
          outstanding,
          bookingUrl,
        },
        relatedEntityType: "booking",
        relatedEntityId: `${booking.id}:req-${milestone}`,
      });
      if (customerResult.sent) sent += 1;

      if (managerEmail) {
        await sendTemplateEmail({
          key: "booking_requirements_manager",
          to: managerEmail,
          variables: {
            customerName: booking.customerName,
            facilityName: booking.facilityName,
            startDate,
            outstanding,
          },
          relatedEntityType: "booking",
          relatedEntityId: `${booking.id}:req-${milestone}-manager`,
        });
      }
    }
  }

  return { checked, sent };
}
