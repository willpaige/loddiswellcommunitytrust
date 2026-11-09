import { NextResponse } from "next/server";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { raffleOrders, raffles } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * Recent purchases for the raffle page's "someone just bought" ticker, and
 * the live sold count. Quantity and time only: no names, ever.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [raffle] = await db
    .select({ id: raffles.id })
    .from(raffles)
    .where(and(eq(raffles.id, id), eq(raffles.published, true)))
    .limit(1);
  if (!raffle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const [recent, [totals]] = await Promise.all([
    db
      .select({ quantity: raffleOrders.quantity, paidAt: raffleOrders.paidAt })
      .from(raffleOrders)
      .where(and(eq(raffleOrders.raffleId, id), eq(raffleOrders.status, "paid"), gt(raffleOrders.paidAt, since)))
      .orderBy(desc(raffleOrders.paidAt))
      .limit(5),
    db
      .select({ sold: sql<number>`coalesce(sum(${raffleOrders.quantity}), 0)::int` })
      .from(raffleOrders)
      .where(and(eq(raffleOrders.raffleId, id), eq(raffleOrders.status, "paid"))),
  ]);

  return NextResponse.json(
    { sold: Number(totals?.sold ?? 0), recent: recent.map((r) => ({ quantity: r.quantity, at: r.paidAt?.toISOString() })) },
    { headers: { "Cache-Control": "public, max-age=15" } }
  );
}
