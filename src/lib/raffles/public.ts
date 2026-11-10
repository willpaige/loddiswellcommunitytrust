import { cache } from "react";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { raffleDraws, raffleOrders, raffles } from "@/lib/db/schema";
import { deriveRaffleState, type RaffleState } from "@/lib/raffles/state";
import { verifyPreviewToken } from "@/lib/raffles/preview";

// Read-only queries for the public site. Wrapped in React cache() so the
// layout strip, header and page can all ask without repeating the query.

export type PublicRaffle = typeof raffles.$inferSelect & {
  state: RaffleState;
  soldTickets: number;
  raisedPence: number;
  entrants: number;
  draw: typeof raffleDraws.$inferSelect | null;
};

async function withStats(rows: (typeof raffles.$inferSelect)[], now = new Date()): Promise<PublicRaffle[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [stats, draws] = await Promise.all([
    db
      .select({
        raffleId: raffleOrders.raffleId,
        sold: sql<number>`coalesce(sum(${raffleOrders.quantity}) filter (where ${raffleOrders.status} = 'paid'), 0)::int`,
        raised: sql<number>`coalesce(sum(${raffleOrders.amount} - ${raffleOrders.refundedAmount}) filter (where ${raffleOrders.status} in ('paid', 'refunded')), 0)::int`,
        entrants: sql<number>`count(distinct coalesce(lower(${raffleOrders.email}), ${raffleOrders.phone}, ${raffleOrders.id})) filter (where ${raffleOrders.status} = 'paid')::int`,
      })
      .from(raffleOrders)
      .where(inArray(raffleOrders.raffleId, ids))
      .groupBy(raffleOrders.raffleId),
    db.select().from(raffleDraws).where(and(inArray(raffleDraws.raffleId, ids), isNotNull(raffleDraws.publishedAt))),
  ]);
  const statsBy = new Map(stats.map((s) => [s.raffleId, s]));
  const drawBy = new Map(draws.map((d) => [d.raffleId, d]));
  return rows.map((r) => {
    const s = statsBy.get(r.id);
    const draw = drawBy.get(r.id) ?? null;
    return {
      ...r,
      state: deriveRaffleState(r, { drawPublished: !!draw, now }),
      soldTickets: Number(s?.sold ?? 0),
      raisedPence: Number(s?.raised ?? 0),
      entrants: Number(s?.entrants ?? 0),
      draw,
    };
  });
}

export const getPublicRaffleBySlug = cache(async (slug: string) => {
  const rows = await db
    .select()
    .from(raffles)
    .where(and(eq(raffles.slug, slug), eq(raffles.published, true)))
    .limit(1);
  const [raffle] = await withStats(rows);
  return raffle ?? null;
});

/**
 * A raffle by slug for someone holding its preview link, published or not.
 * Drafts are shown as they will look once published, so the state is worked
 * out as if they were. Returns null for a missing raffle or a wrong token.
 */
export const getPreviewRaffleBySlug = cache(async (slug: string, token: string) => {
  const rows = await db.select().from(raffles).where(eq(raffles.slug, slug)).limit(1);
  const [row] = rows;
  if (!row || !verifyPreviewToken(row.id, token)) return null;
  const [raffle] = await withStats([{ ...row, published: true }]);
  return raffle ? { ...raffle, published: row.published } : null;
});

/**
 * The one raffle the site promotes: the featured one if it is coming soon, on
 * sale, or closed and waiting for its draw; otherwise the next such raffle.
 * Once results are published it stops being promoted.
 */
export const getPromotedRaffle = cache(async () => {
  const now = new Date();
  const rows = await db
    .select()
    .from(raffles)
    .where(and(eq(raffles.published, true), isNull(raffles.cancelledAt), gt(raffles.drawAt, new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000))))
    .orderBy(desc(raffles.featured), asc(raffles.salesOpenAt));
  const candidates = (await withStats(rows, now)).filter((r) =>
    ["coming_soon", "live", "last_few", "sold_out", "closed"].includes(r.state)
  );
  // Prefer the featured raffle, then whichever is on sale, then the soonest.
  return (
    candidates.find((r) => r.featured) ??
    candidates.find((r) => r.state === "live" || r.state === "last_few") ??
    candidates[0] ??
    null
  );
});

/** Raffles drawn and published, newest first, for "recent winners". */
export const getRecentDrawnRaffles = cache(async (limit = 6) => {
  const rows = await db
    .select({ raffle: raffles })
    .from(raffles)
    .innerJoin(raffleDraws, eq(raffleDraws.raffleId, raffles.id))
    .where(and(eq(raffles.published, true), isNotNull(raffleDraws.publishedAt)))
    .orderBy(desc(raffleDraws.publishedAt))
    .limit(limit);
  return withStats(rows.map((r) => r.raffle));
});

/** The next scheduled or live raffle after this one, for "next up" teasers. */
export const getNextRaffleAfter = cache(async (raffleId: string) => {
  const rows = await db
    .select()
    .from(raffles)
    .where(and(eq(raffles.published, true), isNull(raffles.cancelledAt), gt(raffles.salesCloseAt, new Date())))
    .orderBy(asc(raffles.salesOpenAt))
    .limit(5);
  const [next] = await withStats(rows.filter((r) => r.id !== raffleId));
  return next ?? null;
});

/**
 * Every published raffle that hasn't had its results published yet: coming
 * soon, on sale, sold out or waiting for its draw. Soonest draw first.
 */
export async function getRunningRaffles(now = new Date()) {
  const rows = await db
    .select()
    .from(raffles)
    .where(and(eq(raffles.published, true), isNull(raffles.cancelledAt), gt(raffles.drawAt, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))))
    .orderBy(asc(raffles.drawAt));
  return (await withStats(rows, now)).filter((r) => ["coming_soon", "live", "last_few", "sold_out", "closed"].includes(r.state));
}
