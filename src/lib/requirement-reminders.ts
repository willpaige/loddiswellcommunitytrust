import { createHash } from "node:crypto";
import { and, asc, eq, isNotNull, lte, ne, sql } from "drizzle-orm";
import { ServerClient } from "postmark";
import { db } from "@/lib/db";
import { bookings, facilities, requirementQuestions, bookingRequirementMessages as messages, siteSettings } from "@/lib/db/schema";
import { getBookingRequirementDetail } from "@/lib/booking-requirements";
import { getNextRequirementSessions } from "@/lib/requirement-schedule";
import { requirementDeadline, requirementNow, requirementRetryAt, requirementStage } from "@/lib/requirement-policy";
import { formatBookingDate } from "@/lib/booking-time";
import { sendTemplateEmail } from "@/lib/email/send";

export async function getRequirementCandidates(bookingId?: string) {
  const rows = await db.select({ id: bookings.id, customerName: bookings.customerName, customerEmail: bookings.customerEmail,
    requirementSetId: bookings.requirementSetId, requirementCompletedAt: bookings.requirementCompletedAt, reviewAfter: bookings.requirementReviewAfter, facilityName: facilities.name })
    .from(bookings).innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .where(and(eq(bookings.status, "confirmed"), isNotNull(bookings.requirementSetId), bookingId ? eq(bookings.id, bookingId) : undefined));
  const next = await getNextRequirementSessions(rows.map((row) => row.id));
  return rows.flatMap((row) => {
    const startDate = next.get(row.id);
    return startDate ? [{ ...row, startDate }] : [];
  }).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

export async function getRequirementCycle(setId: string) {
  const questions = await db.select({ id: requirementQuestions.id, updatedAt: requirementQuestions.updatedAt })
    .from(requirementQuestions).where(and(eq(requirementQuestions.setId, setId), eq(requirementQuestions.active, true)))
    .orderBy(asc(requirementQuestions.id));
  return createHash("sha256").update(JSON.stringify(questions)).digest("hex").slice(0, 16);
}

type Candidate = Awaited<ReturnType<typeof getRequirementCandidates>>[number];

// A durable lease serializes simultaneous cron, webhook and admin sends.
// sendTemplateEmail's successful-send log also protects retries after a crash.
async function deliver(input: {
  booking: Candidate; recipient: string; kind: "customer" | "manager"; cycle: string; stage: string;
  variables: Record<string, string>;
}) {
  const { booking, recipient, kind, cycle, stage, variables } = input;
  const id = `${booking.id}:requirements:${createHash("sha256").update(`${recipient}:${kind}:${cycle}:${stage}`).digest("hex").slice(0, 24)}`;
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 15 * 60_000);
  const [claim] = await db.insert(messages).values({ id, bookingId: booking.id, recipient, kind, cycle, stage,
    status: "sending", lastAttemptAt: now, nextAttemptAt: leaseUntil })
    .onConflictDoUpdate({ target: messages.id, set: { status: "sending", attempts: sql`${messages.attempts} + 1`, lastAttemptAt: now, nextAttemptAt: leaseUntil },
      setWhere: and(ne(messages.status, "sent"), lte(messages.nextAttemptAt, now)) }).returning();
  if (!claim) return { sent: false, failed: false };
  try {
    const result = await sendTemplateEmail({ key: kind === "customer" ? "booking_requirements_customer" : "booking_requirements_manager",
      to: recipient, variables, relatedEntityType: "booking", relatedEntityId: id });
    if (!result.sent && result.reason !== "duplicate") throw new Error(`Email was not sent: ${result.reason || "configuration or template disabled"}`);
    await db.update(messages).set({ status: "sent", sentAt: now, error: null, providerMessageId: result.messageId, deliveryStatus: "accepted" }).where(eq(messages.id, id));
    return { sent: result.sent, failed: false };
  } catch (error) {
    await db.update(messages).set({ status: "failed", error: error instanceof Error ? error.message : "Email failed",
      nextAttemptAt: requirementRetryAt(claim.attempts, now) }).where(eq(messages.id, id));
    return { sent: false, failed: true };
  }
}

export async function sendRequirementRequest(bookingId: string, manualRequestId?: string) {
  const [booking] = await getRequirementCandidates(bookingId);
  if (!booking) return { sent: 0, failed: 0 };
  const detail = await getBookingRequirementDetail(booking.id, booking.requirementSetId);
  if (!detail.hasRequirements || detail.complete) return { sent: 0, failed: 0 };
  const now = requirementNow();
  const stage = requirementStage(booking.startDate, now);
  if (!stage) return { sent: 0, failed: 0 };
  const cycle = `${await getRequirementCycle(booking.requirementSetId!)}:${booking.reviewAfter?.toISOString() || "original"}`;
  const history = await db.select().from(messages).where(and(eq(messages.bookingId, booking.id), eq(messages.cycle, cycle)));
  const latestCustomer = history.filter((m) => m.kind === "customer" && m.recipient === booking.customerEmail && m.status === "sent")
    .sort((a, b) => b.sentAt!.getTime() - a.sentAt!.getTime())[0];
  let bounced = latestCustomer?.deliveryStatus === "bounced";
  if (latestCustomer?.providerMessageId && latestCustomer.deliveryStatus === "accepted" && process.env.POSTMARK_API_KEY) {
    try {
      const message = await new ServerClient(process.env.POSTMARK_API_KEY).getOutboundMessageDetails(latestCustomer.providerMessageId);
      bounced = Boolean(message.MessageEvents?.some(event => event.Type === "Bounced"));
      const delivered = message.MessageEvents?.some(event => event.Type === "Delivered");
      if (bounced || delivered) await db.update(messages).set({ deliveryStatus: bounced ? "bounced" : "delivered" }).where(eq(messages.id, latestCustomer.id));
    } catch { /* A provider status outage must not prevent requests or chases. */ }
  }
  const nextSessionKey = booking.startDate.toISOString();
  // Only the most urgent applicable milestone is sent on catch-up. A 24-hour
  // cooldown prevents an initial request and a milestone landing together.
  const customerStage = manualRequestId ? `manual:${manualRequestId}` : `${nextSessionKey}:${stage}`;
  const cooldown = latestCustomer?.sentAt && Date.now() - latestCustomer.sentAt.getTime() < 24 * 60 * 60_000;
  const deadline = requirementDeadline(booking.startDate, now);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const variables = {
    customerName: booking.customerName, customerEmail: booking.customerEmail, facilityName: booking.facilityName,
    startDate: formatBookingDate(booking.startDate, "d MMM yyyy, HH:mm"),
    deadline: deadline.overdue ? "Please complete this now, before your upcoming session." : `Please complete by ${formatBookingDate(deadline.deadline, "d MMM yyyy, HH:mm")}, 48 hours before your session.`,
    outstanding: detail.questions.filter((q) => !q.answered || (q.needsDocument && !q.documents.length))
      .map((q) => `- ${!q.answered ? q.label : `${q.documentLabel || q.label} (document needed)`}`).join("\n"),
    bookingUrl: `${appUrl}/account/bookings/${booking.id}/requirements`,
    adminUrl: `${appUrl}/admin/bookings/${booking.id}/edit`,
    reason: "Required information is due within 48 hours. Please contact the customer.",
  };
  let sent = 0;
  let failed = 0;
  if (manualRequestId || !cooldown) {
    const result = await deliver({ booking, recipient: booking.customerEmail, kind: "customer", cycle, stage: customerStage, variables });
    sent += Number(result.sent); failed += Number(result.failed);
  }
  const unresolvedFailure = bounced || failed > 0 || history.some((m) => m.kind === "customer" && m.recipient === booking.customerEmail && m.status === "failed" && (!latestCustomer || m.lastAttemptAt > latestCustomer.sentAt!));
  if (unresolvedFailure || stage === "48h") {
    const [settings] = await db.select().from(siteSettings).limit(1);
    const manager = settings?.bookingManagerEmail || settings?.emailAddress;
    if (manager) {
      const result = await deliver({ booking, recipient: manager, kind: "manager", cycle,
        stage: `${nextSessionKey}:${unresolvedFailure ? "delivery-failed" : "48h"}`, variables: { ...variables,
          reason: unresolvedFailure ? "The customer email could not be sent. Check their address and contact them directly." : variables.reason } });
      sent += Number(result.sent); failed += Number(result.failed);
    }
  }
  return { sent, failed };
}

export async function sendDueRequirementReminders() {
  const candidates = await getRequirementCandidates();
  const result = { checked: candidates.length, sent: 0, failed: 0, errors: [] as string[] };
  for (const booking of candidates) {
    try {
      const outcome = await sendRequirementRequest(booking.id);
      result.sent += outcome.sent; result.failed += outcome.failed;
    } catch (error) {
      result.errors.push(`${booking.id}: ${error instanceof Error ? error.message : "Unexpected error"}`);
    }
  }
  return result;
}
