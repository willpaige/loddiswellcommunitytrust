import { and, asc, eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { raffleOrders, raffleTickets, raffles } from "@/lib/db/schema";

/**
 * pending → paid, once. The status condition is the idempotency gate: Stripe
 * redelivers webhooks, and only the first delivery gets the row back.
 */
export async function markOrderPaid(
  orderId: string,
  values: { paidAt: Date } & Partial<typeof raffleOrders.$inferInsert>
) {
  const [row] = await db
    .update(raffleOrders)
    .set({ ...values, status: "paid", updatedAt: new Date() })
    .where(and(eq(raffleOrders.id, orderId), eq(raffleOrders.status, "pending")))
    .returning();
  return row ?? null;
}

/**
 * Gives a paid order its ticket numbers, and is safe to call any number of
 * times. Numbers come from the raffle's `tickets_issued` counter by one atomic
 * UPDATE, so they are unique. Tickets are unique per (order, seq), so a retry
 * after a crash can't create extra tickets. The worst case is a gap in the
 * numbering, never a duplicate.
 */
export async function ensureRaffleTickets(orderId: string) {
  const [order] = await db.select().from(raffleOrders).where(eq(raffleOrders.id, orderId)).limit(1);
  if (!order || order.status !== "paid") return [];

  const existing = await db
    .select({ seq: raffleTickets.seq })
    .from(raffleTickets)
    .where(eq(raffleTickets.orderId, orderId));
  const have = new Set(existing.map((row) => row.seq));
  const missing = Array.from({ length: order.quantity }, (_, i) => i + 1).filter((seq) => !have.has(seq));

  if (missing.length > 0) {
    const [{ issued }] = await db
      .update(raffles)
      .set({ ticketsIssued: sql`${raffles.ticketsIssued} + ${missing.length}` })
      .where(eq(raffles.id, order.raffleId))
      .returning({ issued: raffles.ticketsIssued });
    const first = issued - missing.length + 1;
    await db
      .insert(raffleTickets)
      .values(
        missing.map((seq, i) => ({
          id: createId(),
          raffleId: order.raffleId,
          orderId,
          seq,
          ticketNumber: first + i,
        }))
      )
      .onConflictDoNothing();
  }

  return db
    .select()
    .from(raffleTickets)
    .where(eq(raffleTickets.orderId, orderId))
    .orderBy(asc(raffleTickets.ticketNumber));
}
