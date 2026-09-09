import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lotteryPayments } from "@/lib/db/schema";

// One row per payment actually collected for a lottery ticket. Stripe redelivers
// webhooks and fires both `invoice.paid` and `invoice.payment_succeeded` for the
// same invoice, so the reference (the invoice id, or a synthetic key for manual
// entries) is what keeps a renewal from being counted twice.
export async function recordLotteryPayment(input: {
  ticketId: string;
  source: "stripe" | "manual";
  reference: string;
  amount: number;
  paidAt?: Date;
}) {
  if (!input.reference || input.amount <= 0) return;
  await db
    .insert(lotteryPayments)
    .values({
      ticketId: input.ticketId,
      source: input.source,
      reference: input.reference,
      amount: input.amount,
      paidAt: input.paidAt ?? new Date(),
    })
    .onConflictDoNothing({ target: lotteryPayments.reference });
}

// A manual subscriber's ticket count can be corrected after the fact, and the
// £12-per-ticket total moves with it. That is the same money being restated,
// not a second payment, so the original row is amended rather than added to.
export async function syncManualLotteryPayment(ticketId: string, amount: number, paidAt: Date) {
  const [existing] = await db
    .select({ id: lotteryPayments.id })
    .from(lotteryPayments)
    .where(eq(lotteryPayments.ticketId, ticketId))
    .orderBy(asc(lotteryPayments.paidAt))
    .limit(1);

  if (!existing) {
    await recordLotteryPayment({
      ticketId,
      source: "manual",
      reference: `manual:${ticketId}`,
      amount,
      paidAt,
    });
    return;
  }
  await db.update(lotteryPayments).set({ amount }).where(eq(lotteryPayments.id, existing.id));
}
