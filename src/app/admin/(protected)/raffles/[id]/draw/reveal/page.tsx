import { notFound, redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { raffleDraws, raffleOrders } from "@/lib/db/schema";
import { getRaffleForAdmin } from "@/actions/raffles";
import { winnerNames } from "@/lib/raffles/draw";
import { formatPence } from "@/lib/raffles/numbers";
import { RaffleRevealScreen } from "@/components/admin/raffle-reveal-screen";

export const dynamic = "force-dynamic";

export default async function RaffleRevealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raffle = await getRaffleForAdmin(id);
  if (!raffle) notFound();
  const [draw] = await db.select().from(raffleDraws).where(eq(raffleDraws.raffleId, id)).limit(1);
  if (!draw) redirect(`/admin/raffles/${id}/draw`);

  const names = await winnerNames(draw.results.map((r) => r.orderId));
  const paid = await db
    .select({ amount: raffleOrders.amount, refunded: raffleOrders.refundedAmount })
    .from(raffleOrders)
    .where(and(eq(raffleOrders.raffleId, id), inArray(raffleOrders.status, ["paid", "refunded"])));
  const raised = paid.reduce((s, o) => s + o.amount - o.refunded, 0);

  return (
    <RaffleRevealScreen
      raffleId={id}
      title={raffle.title}
      poolSize={draw.poolSize}
      raisedLabel={formatPence(raised)}
      // Results are stored in the order they were drawn.
      steps={draw.results.map((r) => ({ rank: r.rank, prizeTitle: r.prizeTitle, ticketNumber: r.ticketNumber, name: names.get(r.orderId) ?? "" }))}
    />
  );
}
