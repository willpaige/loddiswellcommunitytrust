"use server";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ServerClient } from "postmark";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog, bookings, bookingRequirementMessages, emailLogs } from "@/lib/db/schema";
import { getBookingRequirementDetail } from "@/lib/booking-requirements";
import { getRequirementCandidates, sendRequirementRequest } from "@/lib/requirement-reminders";
import { logAudit } from "@/lib/audit";

async function requireManager() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !["admin", "editor"].includes(role || "")) throw new Error("Unauthorized");
}

export async function getRequirementQueue() {
  await requireManager();
  const candidates = await getRequirementCandidates();
  const ids = candidates.map(b => b.id);
  const history = ids.length ? await db.select().from(bookingRequirementMessages).where(inArray(bookingRequirementMessages.bookingId, ids)).orderBy(desc(bookingRequirementMessages.lastAttemptAt)) : [];
  // Include legacy reminders so the rollout doesn't hide previous sends.
  const logs = await db.select().from(emailLogs).where(eq(emailLogs.templateKey, "booking_requirements_customer")).orderBy(desc(emailLogs.createdAt));
  const rows = [];
  let ready = 0;
  for (const booking of candidates) {
    const detail = await getBookingRequirementDetail(booking.id, booking.requirementSetId);
    if (!detail.hasRequirements) continue;
    if (detail.complete) { ready++; continue; }
    const lastAttempt = history.find(m => m.bookingId === booking.id && m.kind === "customer" && m.recipient === booking.customerEmail);
    const lastLog = logs.find(l => l.recipient === booking.customerEmail && l.relatedEntityId?.startsWith(`${booking.id}:`));
    const status = lastAttempt && (!lastLog || lastAttempt.lastAttemptAt >= lastLog.createdAt) ? lastAttempt.status : lastLog?.status;
    let delivery: string = status === "sent" ? "Accepted by email provider" : status === "failed" ? "Email failed" : status === "sending" ? "Sending / retry pending" : "No reminder sent";
    // Postmark is the source of truth for delivery, rather than calling an
    // accepted send 'delivered'. Provider outages don't hide the chase queue.
    if (status === "sent" && lastLog?.providerMessageId && process.env.POSTMARK_API_KEY) {
      try {
        const message = await new ServerClient(process.env.POSTMARK_API_KEY).getOutboundMessageDetails(lastLog.providerMessageId);
        if (message.MessageEvents?.some(e => e.Type === "Bounced")) delivery = "Email bounced";
        else if (message.MessageEvents?.some(e => e.Type === "Delivered")) delivery = "Delivered to mail server";
      } catch { /* Keep the known acceptance status. */ }
    }
    const answered = detail.questions.filter(q => q.answered).length;
    rows.push({ ...booking, progress: answered === 0 ? "Not started" : detail.questionnaireComplete ? "Documents missing" : "Questions incomplete",
      outstanding: detail.questions.filter(q => !q.answered || (q.needsDocument && !q.documents.length)).map(q => !q.answered ? q.label : q.documentLabel || q.label),
      delivery, lastAttemptAt: lastAttempt?.lastAttemptAt ?? lastLog?.createdAt ?? null,
      error: status === "failed" ? lastAttempt?.error || lastLog?.error : null,
    });
  }
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const [metrics] = await db.select({
    trackedCompletions: sql<number>`count(*) filter (where ${bookings.requirementCompletedAt} is not null)::int`,
    beforeFirstSession: sql<number>`count(*) filter (where (${bookings.requirementCompletedAt} at time zone 'UTC' at time zone 'Europe/London') <= ${bookings.startDate})::int`,
  }).from(bookings).where(and(eq(bookings.status, "confirmed"), gte(bookings.requirementCompletedAt, since)));
  const [interventions] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLog)
    .where(and(eq(auditLog.entity, "booking"), gte(auditLog.createdAt, since), sql`${auditLog.metadata}->>'purpose' = 'requirements_resend'`));
  return { rows, ready, metrics, interventions: interventions.count };
}

export async function resendRequirementRequest(_previous: { message: string; error?: boolean }, form: FormData) {
  await requireManager();
  const bookingId = String(form.get("bookingId") || "");
  try {
    // Stable form nonce prevents double-clicks and retried submissions duplicating mail.
    const nonce = String(form.get("requestId") || "");
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(nonce)) throw new Error("Please refresh the page before retrying.");
    const outcome = await sendRequirementRequest(bookingId, nonce);
    if (outcome.sent) await logAudit({ action: "update", entity: "booking", entityId: bookingId,
      description: "Manually requested outstanding booking information", metadata: { purpose: "requirements_resend", requestId: nonce } });
    revalidatePath("/admin/bookings/requirements/outstanding");
    return { message: outcome.failed ? "Email failed. Check the delivery status and customer address." : outcome.sent ? "Reminder sent." : "No reminder needed, or this request was already sent.", error: outcome.failed > 0 };
  } catch (error) { return { message: error instanceof Error ? error.message : "Unable to send reminder.", error: true }; }
}
