import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { raffles } from "@/lib/db/schema";

// neon-http has no interactive transactions, so the ticket cap is one
// conditional UPDATE: it only succeeds while `reserved + q` fits under the
// cap. Two buyers racing for the last tickets cannot both get them.

/**
 * Holds `quantity` tickets against the cap. Online sales must also be inside
 * the sales window; cash sales may be entered after it closes (money taken on
 * the night) but never once the draw has run, which the caller checks.
 * Returns false when there aren't enough tickets left.
 */
export async function reserveTickets(
  raffleId: string,
  quantity: number,
  { online, now = new Date() }: { online: boolean; now?: Date }
) {
  const rows = await db
    .update(raffles)
    .set({ ticketsReserved: sql`${raffles.ticketsReserved} + ${quantity}` })
    .where(
      and(
        eq(raffles.id, raffleId),
        isNull(raffles.cancelledAt),
        or(isNull(raffles.maxTickets), sql`${raffles.ticketsReserved} + ${quantity} <= ${raffles.maxTickets}`),
        ...(online
          ? [eq(raffles.published, true), lte(raffles.salesOpenAt, now), gt(raffles.salesCloseAt, now)]
          : [])
      )
    )
    .returning({ id: raffles.id });
  return rows.length > 0;
}

/** Gives held or refunded tickets back to the pool. */
export async function releaseTickets(raffleId: string, quantity: number) {
  if (quantity <= 0) return;
  await db
    .update(raffles)
    .set({ ticketsReserved: sql`greatest(0, ${raffles.ticketsReserved} - ${quantity})` })
    .where(eq(raffles.id, raffleId));
}
