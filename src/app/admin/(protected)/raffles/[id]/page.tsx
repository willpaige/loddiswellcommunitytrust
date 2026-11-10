import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, Copy, Download, ExternalLink, Pencil, QrCode, Square, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { raffleDraws } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RaffleStateBadge } from "@/components/admin/raffle-state-badge";
import { RaffleCashSaleForm } from "@/components/admin/raffle-cash-sale-form";
import { RaffleOrdersTable } from "@/components/admin/raffle-orders-table";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { previewUrl } from "@/lib/raffles/preview";
import { duplicateRaffle, getRaffleForAdmin } from "@/actions/raffles";
import { closeRaffleSalesNow, getRaffleOrders, getRaffleSalesByDay, recordCashSale } from "@/actions/raffle-orders";
import { deriveRaffleState } from "@/lib/raffles/state";
import { formatPence, padTicket } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "orders", label: "Orders" },
  { key: "tickets", label: "Tickets" },
] as const;

export default async function RaffleDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab: tabParam }] = await Promise.all([params, searchParams]);
  const raffle = await getRaffleForAdmin(id);
  if (!raffle) notFound();
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam! : "overview";

  const [orders, salesByDay, [draw]] = await Promise.all([
    getRaffleOrders(id),
    getRaffleSalesByDay(id),
    db.select().from(raffleDraws).where(eq(raffleDraws.raffleId, id)).limit(1),
  ]);
  const state = deriveRaffleState(raffle, { drawPublished: !!draw?.publishedAt });
  const paid = orders.filter((o) => o.status === "paid");
  const sold = paid.reduce((s, o) => s + o.quantity, 0);
  const raised = orders
    .filter((o) => o.status === "paid" || o.status === "refunded")
    .reduce((s, o) => s + o.amount - o.refundedAmount, 0);
  const entrants = new Set(paid.map((o) => (o.email ?? o.phone ?? o.id).toLowerCase())).size;
  const held = orders.filter((o) => o.status === "pending").reduce((s, o) => s + o.quantity, 0);
  const cash = paid.filter((o) => o.source === "manual").reduce((s, o) => s + o.quantity, 0);
  const maxDay = Math.max(1, ...salesByDay.map((d) => d.tickets));
  const canClose = raffle.salesCloseAt > new Date() && raffle.salesOpenAt <= new Date();
  const today = formatUk(new Date(), "yyyy-MM-dd");
  const cashDisabled = draw
    ? "The draw has run, so no more tickets can be added."
    : raffle.cancelledAt
      ? "This raffle has been cancelled."
      : null;

  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/raffles">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Raffles
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{raffle.title}</h1>
            <RaffleStateBadge state={state} />
          </div>
          <p className="mt-1 text-muted-foreground">
            On sale {formatUk(raffle.salesOpenAt, "d MMM, HH:mm")} – {formatUk(raffle.salesCloseAt, "d MMM, HH:mm")} · Draw{" "}
            {formatUk(raffle.drawAt, "EEE d MMM yyyy, HH:mm")} ·{" "}
            <Link href={`/raffles/${raffle.slug}`} target="_blank" className="underline">
              /raffles/{raffle.slug}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={raffle.published ? `/raffles/${raffle.slug}` : previewUrl(raffle)} target="_blank">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> {raffle.published ? "View page" : "Preview page"}
            </Link>
          </Button>
          {!raffle.published && <CopyLinkButton url={previewUrl(raffle)} label="Copy preview link" />}
          <Button asChild variant="outline">
            <Link href={`/admin/raffles/${raffle.id}/poster`} target="_blank">
              <QrCode className="h-4 w-4" aria-hidden="true" /> Poster
            </Link>
          </Button>
          <form action={duplicateRaffle.bind(null, raffle.id)}>
            <Button type="submit" variant="outline">
              <Copy className="h-4 w-4" aria-hidden="true" /> Duplicate
            </Button>
          </form>
          {canClose && (
            <form action={closeRaffleSalesNow.bind(null, raffle.id)}>
              <Button type="submit" variant="outline">
                <Square className="h-4 w-4" aria-hidden="true" /> Close sales now
              </Button>
            </form>
          )}
          <Button asChild variant="outline">
            <Link href={`/admin/raffles/${raffle.id}/edit`}>
              <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/raffles/${raffle.id}/draw`}>
              <Trophy className="h-4 w-4" aria-hidden="true" /> {draw ? "Draw results" : "Run the draw"}
            </Link>
          </Button>
        </div>
      </div>

      <nav className="mb-6 flex gap-6 border-b" aria-label="Raffle sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/raffles/${raffle.id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-1 pb-2 text-sm no-underline",
              tab === t.key ? "border-foreground font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.key === "orders" ? ` (${paid.length})` : t.key === "tickets" ? ` (${sold})` : ""}
          </Link>
        ))}
        <Link href={`/admin/raffles/${raffle.id}/draw`} className="-mb-px border-b-2 border-transparent px-1 pb-2 text-sm text-muted-foreground no-underline hover:text-foreground">
          Draw
        </Link>
        <Link href={`/admin/raffles/${raffle.id}/return`} className="-mb-px border-b-2 border-transparent px-1 pb-2 text-sm text-muted-foreground no-underline hover:text-foreground">
          Return
        </Link>
      </nav>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tickets sold</CardDescription>
                <CardTitle className="text-2xl">
                  {sold}
                  {raffle.maxTickets ? <span className="text-base font-normal text-muted-foreground"> / {raffle.maxTickets}</span> : null}
                </CardTitle>
                {cash > 0 && <p className="text-xs text-muted-foreground">{cash} sold in person</p>}
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Raised (gross)</CardDescription>
                <CardTitle className="text-2xl">{formatPence(raised)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Entrants</CardDescription>
                <CardTitle className="text-2xl">{entrants}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Held in checkout</CardDescription>
                <CardTitle className="text-2xl">{held}</CardTitle>
                <p className="text-xs text-muted-foreground">Released if unpaid in 30 min</p>
              </CardHeader>
            </Card>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
            <div className="space-y-6 min-w-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tickets sold per day</CardTitle>
                  <CardDescription>Shows which days the WhatsApp shares and posters worked.</CardDescription>
                </CardHeader>
                <CardContent>
                  {salesByDay.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sales yet.</p>
                  ) : (
                    <ul className="flex h-40 items-end gap-1" aria-label="Tickets sold per day">
                      {salesByDay.map((d) => (
                        <li key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.tickets} tickets`}>
                          <span className="text-[10px] text-muted-foreground">{d.tickets}</span>
                          <span className="w-full rounded-t bg-series-lottery" style={{ height: `${(d.tickets / maxDay) * 100}%` }} />
                          <span className="sr-only">{d.day}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Latest sales</CardTitle>
                  <Button asChild variant="link" className="px-0">
                    <Link href={`/admin/raffles/${raffle.id}?tab=orders`}>All orders</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <RaffleOrdersTable orders={orders.slice(0, 8)} locked={!!draw} raffleTitle={raffle.title} />
                </CardContent>
              </Card>
            </div>
            <RaffleCashSaleForm
              action={recordCashSale.bind(null, raffle.id)}
              pricePence={raffle.ticketPricePence}
              minAge={raffle.minAge}
              today={today}
              disabledReason={cashDisabled}
            />
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
          <div className="space-y-3 min-w-0">
            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <a href={`/api/admin/raffles/${raffle.id}/export`}>
                  <Download className="h-4 w-4" aria-hidden="true" /> Export entrants CSV
                </a>
              </Button>
            </div>
            <RaffleOrdersTable orders={orders} locked={!!draw} raffleTitle={raffle.title} />
          </div>
          <RaffleCashSaleForm
            action={recordCashSale.bind(null, raffle.id)}
            pricePence={raffle.ticketPricePence}
            minAge={raffle.minAge}
            today={today}
            disabledReason={cashDisabled}
          />
        </div>
      )}

      {tab === "tickets" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Every ticket in this raffle</CardTitle>
            <CardDescription>Void numbers (refunds and voided cash sales) are struck through and are not in the draw.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-4">
              {orders
                .flatMap((o) => [
                  ...o.tickets.map((n) => ({ n, name: o.name, void: false })),
                  ...o.voidTickets.map((n) => ({ n, name: o.name, void: true })),
                ])
                .sort((a, b) => a.n - b.n)
                .map((t) => (
                  <li key={t.n} className={t.void ? "text-muted-foreground line-through" : undefined}>
                    <span className="font-mono font-semibold">{padTicket(t.n)}</span> {t.name}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
