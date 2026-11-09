import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, MonitorPlay } from "lucide-react";
import { db } from "@/lib/db";
import { auditLog, raffleDraws, raffleOrders, users } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RaffleDrawSetup } from "@/components/admin/raffle-draw-setup";
import { RaffleDrawResults, type ResultRow } from "@/components/admin/raffle-draw-results";
import { getRaffleForAdmin } from "@/actions/raffles";
import { drawReadiness } from "@/lib/raffles/draw";
import { countUndeliveredInBatch } from "@/lib/email/bulk-send";
import { formatUk } from "@/lib/raffles/time";

export const dynamic = "force-dynamic";

export default async function RaffleDrawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raffle = await getRaffleForAdmin(id);
  if (!raffle) notFound();
  const [draw] = await db.select().from(raffleDraws).where(eq(raffleDraws.raffleId, id)).limit(1);

  const header = (
    <>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href={`/admin/raffles/${id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to {raffle.title}
        </Link>
      </Button>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{draw ? "Draw results" : "Run the draw"}</h1>
          {draw && (
            <Badge className={draw.publishedAt ? "bg-sage-100 text-sage-800 hover:bg-sage-100" : "bg-amber-100 text-amber-900 hover:bg-amber-100"}>
              {draw.publishedAt ? "Published" : "Drawn, not yet published"}
            </Badge>
          )}
        </div>
        {draw && (
          <Button asChild variant="outline">
            <Link href={`/admin/raffles/${id}/draw/reveal`}>
              <MonitorPlay className="h-4 w-4" aria-hidden="true" /> Replay the reveal
            </Link>
          </Button>
        )}
      </div>
    </>
  );

  if (!draw) {
    const readiness = await drawReadiness(id);
    return (
      <div>
        {header}
        <RaffleDrawSetup
          raffleId={id}
          prizes={raffle.prizes.map((p) => ({ rank: p.rank, title: p.title }))}
          readiness={readiness}
          salesCloseLabel={formatUk(raffle.salesCloseAt, "EEE d MMM 'at' HH:mm")}
        />
      </div>
    );
  }

  const orders = await db
    .select()
    .from(raffleOrders)
    .where(and(eq(raffleOrders.raffleId, id), inArray(raffleOrders.status, ["paid"])));
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const results: ResultRow[] = [...draw.results]
    .sort((a, b) => a.rank - b.rank)
    .map((r) => {
      const o = orderById.get(r.orderId);
      return {
        rank: r.rank,
        prizeTitle: r.prizeTitle,
        ticketNumber: r.ticketNumber,
        winner: o ? { name: o.name, email: o.email, phone: o.phone, source: o.source } : null,
        collected: !!r.collectedAt,
        history: r.history.map((h) => ({ ticketNumber: h.ticketNumber, reason: h.reason })),
      };
    });
  const recipientCount = new Set(orders.filter((o) => o.email).map((o) => o.email!.toLowerCase())).size;
  const noEmail = orders
    .filter((o) => !o.email)
    .map((o) => ({ name: o.name, phone: o.phone, prize: draw.results.find((r) => r.orderId === o.id)?.prizeTitle ?? null }))
    .sort((a, b) => (a.prize ? 0 : 1) - (b.prize ? 0 : 1));
  const undelivered = draw.publishedAt ? await countUndeliveredInBatch("raffle_draw", `${draw.id}:`) : 0;
  const [drawer] = draw.drawnBy ? await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, draw.drawnBy)).limit(1) : [];
  const trail = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entity, "raffle"), eq(auditLog.entityId, id)))
    .orderBy(desc(auditLog.createdAt))
    .limit(30);
  const drawTrail = trail.filter((t) => t.createdAt >= draw.drawnAt || /draw|prize|result/i.test(t.description ?? ""));

  return (
    <div>
      {header}
      <RaffleDrawResults
        raffleId={id}
        results={results}
        published={!!draw.publishedAt}
        recipientCount={recipientCount}
        undelivered={undelivered}
        noEmail={noEmail}
      />
      <Card className="mt-6 bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Audit trail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            {formatUk(draw.drawnAt, "d MMM HH:mm")} · {draw.method === "system" ? "System draw (crypto.randomInt)" : "Physical draw, numbers entered"} by{" "}
            {drawer?.name || drawer?.email || "an admin"} · pool of {draw.poolSize} tickets frozen · checksum{" "}
            <code className="text-xs">{draw.poolChecksum.slice(0, 12)}…</code> · {draw.onePerPerson ? "one prize per person" : "multiple prizes allowed per person"}
          </p>
          {drawTrail.map((t) => (
            <p key={t.id}>
              {formatUk(t.createdAt, "d MMM HH:mm")} · {t.description} {t.userEmail ? `· ${t.userEmail}` : ""}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
