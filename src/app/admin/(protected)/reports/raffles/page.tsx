import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColumnChart, DataTable, StatTile } from "@/components/admin/report-charts";
import { ReportFilters, ReportNote, ReportTabs } from "@/components/admin/report-filters";
import { alignToBuckets, formatDay, money, percentChange, resolvePeriod, startOfUtcMonth } from "@/lib/reports";
import {
  getEarliestIncomeDate,
  getIncomeTotals,
  getRaffleIncomeByBucket,
  getRaffleSummaries,
  getRaffleTotals,
} from "@/lib/reports/queries";

export const dynamic = "force-dynamic";

function raffleStatus(row: { published: boolean; cancelled: boolean; drawn: boolean; salesOpenAt: Date; drawAt: Date }) {
  const now = new Date();
  if (row.cancelled) return { label: "Cancelled", variant: "destructive" as const };
  if (!row.published) return { label: "Draft", variant: "secondary" as const };
  if (row.drawn) return { label: "Drawn", variant: "default" as const };
  if (row.salesOpenAt > now) return { label: "Coming soon", variant: "secondary" as const };
  if (row.drawAt > now) return { label: "On sale", variant: "default" as const };
  return { label: "Awaiting draw", variant: "secondary" as const };
}

export default async function RaffleReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const requested = resolvePeriod(params);
  const earliest = requested.key === "all" ? await getEarliestIncomeDate() : null;
  const period = earliest ? { ...requested, start: startOfUtcMonth(earliest) } : requested;

  const [totals, income, previousIncome, buckets, raffles] = await Promise.all([
    getRaffleTotals(period.start, period.end),
    getIncomeTotals(period.start, period.end),
    period.previous ? getIncomeTotals(period.previous.start, period.previous.end) : Promise.resolve(null),
    getRaffleIncomeByBucket(period),
    getRaffleSummaries(period.start, period.end),
  ]);

  const aligned = alignToBuckets(period, buckets);
  const columns = aligned.map((bucket) => ({
    label: bucket.label,
    title: bucket.title,
    segments: [{ key: "raffle", label: "Raffle income", value: bucket.row?.amount ?? 0, className: "bg-series-raffle" }],
  }));
  const perEntrant = totals.entrants > 0 ? Math.round(income.raffle / totals.entrants) : 0;
  const onlineShare = totals.ticketsSold > 0 ? Math.round((totals.onlineTickets / totals.ticketsSold) * 100) : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Raffle report</h1>
        <p className="mt-1 text-muted-foreground">Ticket sales, income and results for {period.label}.</p>
      </div>

      <ReportTabs period={period} active="raffles" />

      <div className="mt-6 space-y-6">
        <ReportFilters period={period} basePath="/admin/reports/raffles" exportName="raffles" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Raffle income"
            value={money(income.raffle)}
            delta={previousIncome && previousIncome.raffle > 0 ? percentChange(income.raffle, previousIncome.raffle) : undefined}
            deltaLabel="vs previous"
            hint="Received in this period, after refunds"
          />
          <StatTile label="Tickets sold" value={String(totals.ticketsSold)} hint={`${totals.orders} order${totals.orders === 1 ? "" : "s"}`} />
          <StatTile label="Entrants" value={String(totals.entrants)} hint={`${money(perEntrant)} each on average`} />
          <StatTile
            label="Bought online"
            value={`${onlineShare}%`}
            hint={`${totals.onlineTickets} online · ${totals.inPersonTickets} in person`}
          />
          <StatTile label="Stripe fees" value={money(totals.stripeFees)} hint="On card payments in this period" invertDelta />
          <StatTile
            label="Refunded"
            value={money(totals.refunded)}
            hint="Already taken off the income figure"
            tone={totals.refunded > 0 ? "attention" : "default"}
          />
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Raffle income over time</CardTitle>
            <CardDescription>Card and cash sales, on the day the money was taken.</CardDescription>
          </CardHeader>
          <CardContent>
            <ColumnChart data={columns} emptyMessage="No raffle sales in this period." />
            <DataTable
              columns={["Period", "Income", "Tickets"]}
              rows={aligned.map((bucket) => [bucket.title, money(bucket.row?.amount ?? 0), bucket.row?.tickets ?? 0])}
            />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Raffles</CardTitle>
            <CardDescription>
              Every raffle on sale at some point in this period, with its figures over its whole life.
            </CardDescription>
          </CardHeader>
          {raffles.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">No raffles in this period.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Raffle</TableHead>
                    <TableHead>Draw</TableHead>
                    <TableHead className="text-right">Tickets</TableHead>
                    <TableHead className="text-right">Raised</TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                    <TableHead className="text-right">Prizes bought</TableHead>
                    <TableHead className="pr-6 text-right">To the Trust</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {raffles.map((row) => {
                    const status = raffleStatus(row);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="pl-6">
                          <Link href={`/admin/raffles/${row.id}`} className="font-medium">
                            {row.title}
                          </Link>
                          <Badge variant={status.variant} className="ml-2">
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDay(row.drawAt)}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.ticketsSold}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.raised)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.stripeFees)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.prizeCost)}</TableCell>
                        <TableCell className="pr-6 text-right font-semibold tabular-nums">{money(row.net)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <CardContent className="pt-4">
            <ReportNote>
              &ldquo;To the Trust&rdquo; is money raised less Stripe fees, prizes the Trust paid for and any other expenses
              entered on the raffle&apos;s council return. Donated prizes cost nothing.
            </ReportNote>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
