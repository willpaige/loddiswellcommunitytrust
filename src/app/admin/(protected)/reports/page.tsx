import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarList,
  ColumnChart,
  DataTable,
  SeriesKey,
  StatTile,
} from "@/components/admin/report-charts";
import {
  ReportFilters,
  ReportNote,
  ReportTabs,
} from "@/components/admin/report-filters";
import {
  alignToBuckets,
  formatHours,
  money,
  percentChange,
  periodSearch,
  resolvePeriod,
  startOfUtcMonth,
} from "@/lib/reports";
import {
  getEarliestIncomeDate,
  getIncomeByBucket,
  getIncomeTotals,
  getLotteryTotals,
  getOutstandingMoney,
  getSessionTotals,
  getBookingTotals,
  getUpcomingCommitment,
  getLotteryRenewals,
} from "@/lib/reports/queries";

export const dynamic = "force-dynamic";

export default async function ReportsOverviewPage({
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

  const [
    income,
    previousIncome,
    buckets,
    outstanding,
    sessions,
    bookings,
    lottery,
    upcoming,
    renewals,
  ] = await Promise.all([
    getIncomeTotals(period.start, period.end),
    period.previous
      ? getIncomeTotals(period.previous.start, period.previous.end)
      : Promise.resolve(null),
    getIncomeByBucket(period),
    getOutstandingMoney(),
    getSessionTotals(period.start, period.end),
    getBookingTotals(period.start, period.end),
    getLotteryTotals(period.start, period.end),
    getUpcomingCommitment(90),
    getLotteryRenewals(),
  ]);

  const aligned = alignToBuckets(period, buckets);
  const columns = aligned.map((bucket) => ({
    label: bucket.label,
    title: bucket.title,
    segments: [
      {
        key: "bookings",
        label: "Bookings",
        value: bucket.row?.bookings ?? 0,
        className: "bg-series-bookings",
      },
      {
        key: "lottery",
        label: "Lottery",
        value: bucket.row?.lottery ?? 0,
        className: "bg-series-lottery",
      },
    ],
  }));

  const renewals30 = renewals.find((row) => row.window === "Next 30 days");
  const attention = [
    outstanding.owed > 0 && {
      label: "Owed by customers",
      value: money(outstanding.owed),
      hint: `${outstanding.owedBookings} booking${outstanding.owedBookings === 1 ? "" : "s"}`,
    },
    outstanding.refundDue > 0 && {
      label: "To refund",
      value: money(outstanding.refundDue),
      hint: `${outstanding.refundBookings} booking${outstanding.refundBookings === 1 ? "" : "s"}`,
    },
    outstanding.unpaidInvoices > 0 && {
      label: "Unpaid invoices",
      value: money(outstanding.unpaidInvoiceValue),
      hint: `${outstanding.unpaidInvoices} open`,
    },
    outstanding.pendingPayment > 0 && {
      label: "Awaiting payment",
      value: String(outstanding.pendingPayment),
      hint: "bookings not yet paid",
    },
    lottery.pastDue > 0 && {
      label: "Lottery payments failed",
      value: String(lottery.pastDue),
      hint: "subscriptions past due",
    },
  ].filter(Boolean) as Array<{ label: string; value: string; hint: string }>;

  const query = periodSearch(period);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="mt-1 text-muted-foreground">
          Income, bookings and lottery performance for {period.label}.
        </p>
      </div>

      <ReportTabs period={period} active="overview" />

      <div className="mt-6 space-y-6">
        <ReportFilters period={period} basePath="/admin/reports" exportName="income" />

        {/* Hero figure — the one number the Trust leads with. */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total income · {period.label}</CardDescription>
            <p className="text-5xl font-semibold tracking-tight text-foreground">
              {money(income.total)}
            </p>
            <p className="text-sm text-muted-foreground">
              {previousIncome && previousIncome.total > 0 ? (
                <>
                  <span
                    className={
                      income.total >= previousIncome.total
                        ? "font-medium text-sage-600"
                        : "font-medium text-copper-700"
                    }
                  >
                    {income.total >= previousIncome.total ? "▲" : "▼"}{" "}
                    {money(Math.abs(income.total - previousIncome.total))}
                  </span>{" "}
                  against {money(previousIncome.total)} in the previous {period.label.toLowerCase().startsWith("fy") ? "year" : "period"}
                </>
              ) : (
                `Across ${income.payments} payment${income.payments === 1 ? "" : "s"}`
              )}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Bookings income"
                value={money(income.bookings)}
                delta={
                  previousIncome && previousIncome.total > 0
                    ? percentChange(income.bookings, previousIncome.bookings)
                    : undefined
                }
                deltaLabel="vs previous"
                hint={`${Math.round((income.bookings / Math.max(1, income.total)) * 100)}% of income`}
              />
              <StatTile
                label="Lottery income"
                value={money(income.lottery)}
                delta={
                  previousIncome && previousIncome.total > 0
                    ? percentChange(income.lottery, previousIncome.lottery)
                    : undefined
                }
                deltaLabel="vs previous"
                hint={`${Math.round((income.lottery / Math.max(1, income.total)) * 100)}% of income`}
              />
              <StatTile
                label="Taken by card"
                value={money(income.card)}
                hint={`${money(income.offline)} cash, cheque or transfer`}
              />
              <StatTile
                label="Payments received"
                value={String(income.payments)}
                hint={
                  income.payments > 0
                    ? `${money(Math.round(income.total / income.payments))} average`
                    : "None in this period"
                }
              />
            </div>
          </CardContent>
        </Card>

        {attention.length > 0 && (
          <Card className="border-copper-300 bg-copper-50/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-copper-700" aria-hidden="true" />
                Needs attention
              </CardTitle>
              <CardDescription>
                Money outstanding right now, whatever period is selected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {attention.map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                      {item.value}
                    </dd>
                    <dd className="text-xs text-muted-foreground">{item.hint}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div>
              <CardTitle>Income over time</CardTitle>
              <CardDescription>
                Counted on the day the money was taken, net of refunds.
              </CardDescription>
            </div>
            <SeriesKey
              items={[
                { label: "Bookings", className: "bg-series-bookings" },
                { label: "Lottery", className: "bg-series-lottery" },
              ]}
            />
          </CardHeader>
          <CardContent>
            <ColumnChart data={columns} />
            <DataTable
              columns={["Period", "Bookings", "Lottery", "Total"]}
              rows={aligned.map((bucket) => [
                bucket.title,
                money(bucket.row?.bookings ?? 0),
                money(bucket.row?.lottery ?? 0),
                money((bucket.row?.bookings ?? 0) + (bucket.row?.lottery ?? 0)),
              ])}
            />
            <ReportNote>
              A refund reduces income in the period the payment was originally
              taken, so a booking and the money given back on it stay together.
              Card payments taken before the payment ledger existed carry the date
              their booking was made, which for a checkout is the same day.
            </ReportNote>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Bookings at a glance</CardTitle>
              <CardDescription>{period.label}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-4">
                <Figure label="Bookings taken" value={String(bookings.created)} />
                <Figure
                  label="Sessions"
                  value={
                    sessions.sessions > sessions.held
                      ? `${sessions.held} of ${sessions.sessions}`
                      : String(sessions.sessions)
                  }
                />
                <Figure label="Hours booked" value={formatHours(sessions.hours)} />
                <Figure
                  label="Average booking"
                  value={money(bookings.averageValue)}
                />
              </dl>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Already in the diary — next 90 days
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {money(upcoming.value)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {upcoming.sessions} session{upcoming.sessions === 1 ? "" : "s"} ·{" "}
                  {formatHours(upcoming.hours)} hours
                </p>
              </div>
              <Link
                href={`/admin/reports/bookings?${query}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary no-underline hover:underline"
              >
                Booking report
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Lottery at a glance</CardTitle>
              <CardDescription>Live position</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-4">
                <Figure
                  label="Active subscribers"
                  value={String(lottery.activeSubscribers)}
                />
                <Figure label="Tickets in play" value={String(lottery.activeTickets)} />
                <Figure
                  label="Annual run rate"
                  value={money(lottery.annualRunRate)}
                />
                <Figure
                  label="New this period"
                  value={String(lottery.newSubscribers)}
                />
              </dl>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Renewals due in the next 30 days
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {money(renewals30?.value ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {renewals30?.subscribers ?? 0} subscriber
                  {renewals30?.subscribers === 1 ? "" : "s"}
                  {lottery.cancellingAtPeriodEnd > 0 &&
                    ` · ${lottery.cancellingAtPeriodEnd} cancelling at period end`}
                </p>
              </div>
              <Link
                href={`/admin/reports/lottery?${query}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary no-underline hover:underline"
              >
                Lottery report
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Where the money came from</CardTitle>
            <CardDescription>{period.label}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={[
                { key: "bookings", label: "Bookings", value: income.bookings },
                { key: "lottery", label: "Lottery", value: income.lottery },
              ]}
            />
            <ReportNote>
              Income is counted when it is received, not when a booking is held —
              a hall booked in March for a party in June is March income. Sessions
              and hours are counted on the day they happen. Only money the Trust
              has actually taken appears here; grants, donations and hire paid
              outside the website are not recorded on the site.
            </ReportNote>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}
