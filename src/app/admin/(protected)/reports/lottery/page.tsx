import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarList,
  ColumnChart,
  DataTable,
  StatTile,
} from "@/components/admin/report-charts";
import {
  ReportFilters,
  ReportNote,
  ReportTabs,
} from "@/components/admin/report-filters";
import {
  alignToBuckets,
  formatDay,
  money,
  percentChange,
  resolvePeriod,
  startOfUtcMonth,
} from "@/lib/reports";
import {
  getDrawsInPeriod,
  getEarliestIncomeDate,
  getIncomeTotals,
  getLotteryIncomeByBucket,
  getLotteryMovement,
  getLotteryPlanMix,
  getLotteryRenewals,
  getLotteryTotals,
} from "@/lib/reports/queries";

export const dynamic = "force-dynamic";

export default async function LotteryReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const requested = resolvePeriod(params);

  // "All time" would otherwise start at a fixed epoch: a decade of empty months
  // on the chart, and a utilisation figure divided by years the Trust was not
  // taking bookings online. Start it at the first payment on record instead.
  const earliest = requested.key === "all" ? await getEarliestIncomeDate() : null;
  const period = earliest
    ? { ...requested, start: startOfUtcMonth(earliest) }
    : requested;

  const [totals, income, previousIncome, buckets, movement, plans, renewals, draws] =
    await Promise.all([
      getLotteryTotals(period.start, period.end),
      getIncomeTotals(period.start, period.end),
      period.previous
        ? getIncomeTotals(period.previous.start, period.previous.end)
        : Promise.resolve(null),
      getLotteryIncomeByBucket(period),
      getLotteryMovement(period),
      getLotteryPlanMix(),
      getLotteryRenewals(),
      getDrawsInPeriod(period.start, period.end),
    ]);

  const aligned = alignToBuckets(period, buckets);
  const columns = aligned.map((bucket) => ({
    label: bucket.label,
    title: bucket.title,
    segments: [
      {
        key: "lottery",
        label: "Lottery income",
        value: bucket.row?.amount ?? 0,
        className: "bg-series-lottery",
      },
    ],
  }));

  const movementRows = alignToBuckets(period, movement);
  const netChange = totals.newSubscribers - totals.cancellations;
  const prizeMoney = draws.reduce((sum, draw) => sum + draw.prizeValue, 0);
  const churnRate =
    totals.activeSubscribers + totals.cancellations > 0
      ? (totals.cancellations / (totals.activeSubscribers + totals.cancellations)) * 100
      : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Lottery report</h1>
        <p className="mt-1 text-muted-foreground">
          Subscribers, income and draws for {period.label}.
        </p>
      </div>

      <ReportTabs period={period} active="lottery" />

      <div className="mt-6 space-y-6">
        <ReportFilters
          period={period}
          basePath="/admin/reports/lottery"
          exportName="lottery"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Lottery income"
            value={money(income.lottery)}
            delta={
              previousIncome && previousIncome.lottery > 0
                ? percentChange(income.lottery, previousIncome.lottery)
                : undefined
            }
            deltaLabel="vs previous"
            hint="Received in this period"
          />
          <StatTile
            label="Annual run rate"
            value={money(totals.annualRunRate)}
            hint="What the active book is worth over a year"
          />
          <StatTile
            label="Active subscribers"
            value={String(totals.activeSubscribers)}
            hint={`${totals.averageTickets} tickets each on average`}
          />
          <StatTile
            label="Tickets in play"
            value={String(totals.activeTickets)}
            hint="Numbers entered in each draw"
          />
          <StatTile
            label="New subscribers"
            value={String(totals.newSubscribers)}
            hint={`${totals.newTickets} ticket${totals.newTickets === 1 ? "" : "s"} bought`}
          />
          <StatTile
            label="Cancellations"
            value={String(totals.cancellations)}
            hint={`${churnRate.toFixed(1)}% of the book`}
            invertDelta
            tone={totals.cancellations > 0 ? "attention" : "default"}
          />
          <StatTile
            label="Net change"
            value={`${netChange > 0 ? "+" : ""}${netChange}`}
            hint="Subscribers joined less left"
          />
          <StatTile
            label="Prize money awarded"
            value={money(prizeMoney)}
            hint={`${draws.length} draw${draws.length === 1 ? "" : "s"} in this period`}
          />
        </div>

        {(totals.pastDue > 0 || totals.cancellingAtPeriodEnd > 0) && (
          <Card className="border-copper-300 bg-copper-50/40">
            <CardContent className="flex flex-wrap gap-x-10 gap-y-3 py-4">
              {totals.pastDue > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Payments failed
                  </p>
                  <p className="text-lg font-semibold tabular-nums">{totals.pastDue}</p>
                  <p className="text-xs text-muted-foreground">
                    subscriptions past due in Stripe
                  </p>
                </div>
              )}
              {totals.cancellingAtPeriodEnd > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Cancelling at period end
                  </p>
                  <p className="text-lg font-semibold tabular-nums">
                    {totals.cancellingAtPeriodEnd}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    still active until their renewal date
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Lottery income over time</CardTitle>
            <CardDescription>
              First sales and renewals alike, on the day the payment was taken.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ColumnChart data={columns} emptyMessage="No lottery payments in this period." />
            <DataTable
              columns={["Period", "Income", "Payments"]}
              rows={aligned.map((bucket) => [
                bucket.title,
                money(bucket.row?.amount ?? 0),
                bucket.row?.payments ?? 0,
              ])}
            />
            <ReportNote>
              Payments have only been recorded individually since the ledger was
              added. Tickets bought before that carry one payment dated when they
              were first sold, so renewals taken earlier are not in the run.
            </ReportNote>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">How subscribers pay</CardTitle>
              <CardDescription>
                Active subscriptions, valued over a year.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarList
                items={plans.map((plan) => ({
                  key: plan.plan,
                  label: plan.plan,
                  sublabel: `${plan.subscribers} subscriber${plan.subscribers === 1 ? "" : "s"} · ${plan.tickets} tickets`,
                  value: plan.annualValue,
                }))}
                barClassName="bg-series-lottery"
                emptyMessage="No active subscribers."
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Renewals due</CardTitle>
              <CardDescription>
                What is up for renewal, from today. Excludes anyone already
                cancelling.
              </CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Window</TableHead>
                  <TableHead className="text-right">Subscribers</TableHead>
                  <TableHead className="pr-6 text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renewals.map((row) => (
                  <TableRow key={row.window}>
                    <TableCell className="pl-6">
                      {row.window}
                      {row.window === "Overdue" && row.subscribers > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          Check Stripe
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.subscribers}
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      {money(row.value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Subscribers joining and leaving</CardTitle>
              <CardDescription>{period.label}</CardDescription>
            </CardHeader>
            {movementRows.every((row) => !row.row) ? (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No subscribers joined or left in this period.
                </p>
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Period</TableHead>
                    <TableHead className="text-right">Joined</TableHead>
                    <TableHead className="text-right">Left</TableHead>
                    <TableHead className="pr-6 text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementRows
                    .filter((bucket) => bucket.row)
                    .map((bucket) => {
                      const joined = bucket.row?.joined ?? 0;
                      const left = bucket.row?.left ?? 0;
                      const net = joined - left;
                      return (
                        <TableRow key={bucket.title}>
                          <TableCell className="pl-6">{bucket.title}</TableCell>
                          <TableCell className="text-right tabular-nums">{joined}</TableCell>
                          <TableCell className="text-right tabular-nums">{left}</TableCell>
                          <TableCell
                            className={`pr-6 text-right tabular-nums ${
                              net > 0 ? "text-sage-600" : net < 0 ? "text-copper-700" : ""
                            }`}
                          >
                            {net > 0 ? "+" : ""}
                            {net}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Draws</CardTitle>
              <CardDescription>Held in this period.</CardDescription>
            </CardHeader>
            {draws.length === 0 ? (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No draws recorded in this period.
                </p>
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Draw</TableHead>
                    <TableHead className="text-right">Winners</TableHead>
                    <TableHead className="text-right">Prizes</TableHead>
                    <TableHead className="pr-6 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draws.map((draw) => (
                    <TableRow key={draw.id}>
                      <TableCell className="pl-6">{formatDay(draw.drawDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {draw.winners}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {draw.prizeValue > 0 ? money(draw.prizeValue) : "—"}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Badge variant={draw.published ? "default" : "secondary"}>
                          {draw.published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <CardContent className="pt-0">
              <ReportNote>
                Prize totals are read from the prize text recorded against each
                draw, so anything written without a figure counts as nothing.
              </ReportNote>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
