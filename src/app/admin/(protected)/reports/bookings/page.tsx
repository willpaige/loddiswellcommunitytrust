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
  Meter,
  StatTile,
} from "@/components/admin/report-charts";
import {
  ReportFilters,
  ReportNote,
  ReportTabs,
} from "@/components/admin/report-filters";
import {
  alignToBuckets,
  customerGroupLabels,
  formatHours,
  money,
  percentChange,
  resolvePeriod,
  startOfUtcMonth,
} from "@/lib/reports";
import {
  getBookingTotals,
  getCustomerGroupBreakdown,
  getDiscountUsage,
  getEarliestIncomeDate,
  getFacilityBreakdown,
  getIncomeTotals,
  getOfferingBreakdown,
  getOutstandingMoney,
  getSessionTotals,
  getSessionsByBucket,
  getTopBookingCustomers,
  getUpcomingCommitment,
} from "@/lib/reports/queries";

export const dynamic = "force-dynamic";

export default async function BookingReportPage({
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
    totals,
    previousTotals,
    sessions,
    previousSessions,
    income,
    facilities,
    sessionBuckets,
    groups,
    offerings,
    customers,
    discounts,
    outstanding,
    upcoming,
  ] = await Promise.all([
    getBookingTotals(period.start, period.end),
    period.previous
      ? getBookingTotals(period.previous.start, period.previous.end)
      : Promise.resolve(null),
    getSessionTotals(period.start, period.end),
    period.previous
      ? getSessionTotals(period.previous.start, period.previous.end)
      : Promise.resolve(null),
    getIncomeTotals(period.start, period.end),
    getFacilityBreakdown(period.start, period.end),
    getSessionsByBucket(period),
    getCustomerGroupBreakdown(period.start, period.end),
    getOfferingBreakdown(period.start, period.end),
    getTopBookingCustomers(period.start, period.end),
    getDiscountUsage(period.start, period.end),
    getOutstandingMoney(),
    getUpcomingCommitment(90),
  ]);

  const aligned = alignToBuckets(period, sessionBuckets);
  const columns = aligned.map((bucket) => ({
    label: bucket.label,
    title: bucket.title,
    segments: [
      {
        key: "sessions",
        label: "Sessions",
        value: bucket.row?.sessions ?? 0,
        className: "bg-series-bookings",
      },
    ],
  }));

  const totalSessions = sessions.sessions + sessions.cancelled;
  const cancellationRate =
    totalSessions > 0 ? (sessions.cancelled / totalSessions) * 100 : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Booking report</h1>
        <p className="mt-1 text-muted-foreground">
          Hall, pavilion and court hire for {period.label}.
        </p>
      </div>

      <ReportTabs period={period} active="bookings" />

      <div className="mt-6 space-y-6">
        <ReportFilters
          period={period}
          basePath="/admin/reports/bookings"
          exportName="bookings"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Booking income"
            value={money(income.bookings)}
            hint="Money received in this period"
          />
          <StatTile
            label="Bookings taken"
            value={String(totals.created)}
            delta={previousTotals ? percentChange(totals.created, previousTotals.created) : undefined}
            deltaLabel="vs previous"
            hint={`${totals.newCustomers} customer${totals.newCustomers === 1 ? "" : "s"}`}
          />
          <StatTile
            label="Sessions"
            value={String(sessions.sessions)}
            delta={
              previousSessions
                ? percentChange(sessions.sessions, previousSessions.sessions)
                : undefined
            }
            deltaLabel="vs previous"
            hint={
              sessions.sessions > sessions.held
                ? `${sessions.held} held · ${sessions.sessions - sessions.held} still to come`
                : `across ${sessions.facilities} facilit${sessions.facilities === 1 ? "y" : "ies"}`
            }
          />
          <StatTile
            label="Hours booked"
            value={formatHours(sessions.hours)}
            delta={
              previousSessions
                ? percentChange(sessions.hours, previousSessions.hours)
                : undefined
            }
            deltaLabel="vs previous"
            hint="venue hours used"
          />
          <StatTile
            label="Average booking"
            value={money(totals.averageValue)}
            hint={`${money(totals.createdValue)} booked in total`}
          />
          <StatTile
            label="Cancelled sessions"
            value={`${cancellationRate.toFixed(1)}%`}
            hint={`${sessions.cancelled} of ${totalSessions} sessions`}
            invertDelta
          />
          <StatTile
            label="Discounts given"
            value={money(totals.discountGiven)}
            hint={`${totals.discountedBookings} booking${totals.discountedBookings === 1 ? "" : "s"} discounted`}
          />
          <StatTile
            label="Booked ahead"
            value={money(upcoming.value)}
            hint={`${upcoming.sessions} sessions in the next 90 days`}
          />
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Sessions over time</CardTitle>
            <CardDescription>
              Counted on the day each session is held, cancelled ones excluded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ColumnChart
              data={columns}
              format={(value) => `${value} session${value === 1 ? "" : "s"}`}
              axisFormat={(value) => String(Math.round(value))}
              emptyMessage="No sessions in this period."
            />
            <DataTable
              columns={["Period", "Sessions", "Hours"]}
              rows={aligned.map((bucket) => [
                bucket.title,
                bucket.row?.sessions ?? 0,
                formatHours(bucket.row?.hours ?? 0),
              ])}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Use by facility</CardTitle>
              <CardDescription>
                Hours booked against the hours each venue is available.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {facilities.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  No facilities booked in this period.
                </p>
              )}
              {facilities.map((facility) => (
                <Meter
                  key={facility.facilityId}
                  label={facility.facility}
                  value={facility.utilisation}
                  caption={`${formatHours(facility.hours)} of ${formatHours(facility.bookableHours)} bookable hours · ${facility.sessions} session${facility.sessions === 1 ? "" : "s"} · ${money(facility.value)}`}
                />
              ))}
              <ReportNote>
                Available hours are the venue&apos;s bookable window every day of
                the period, so a hall open 08:00–23:00 has 15 hours a day to let.
                Real-world use is naturally a fraction of that — evenings and
                weekends carry most of it. A period running into the future counts
                weeks nobody has booked yet, so read it against a period that has
                already been and gone.
              </ReportNote>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Who is booking</CardTitle>
              <CardDescription>Value of bookings taken, by rate charged.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarList
                items={groups.map((group) => ({
                  key: group.key,
                  label: customerGroupLabels[group.key] ?? group.key,
                  sublabel: `${group.bookings} booking${group.bookings === 1 ? "" : "s"}`,
                  value: group.value,
                }))}
                emptyMessage="No bookings in this period."
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Most booked</CardTitle>
              <CardDescription>By value of bookings taken.</CardDescription>
            </CardHeader>
            {offerings.length === 0 ? (
              <CardContent>
                <p className="text-sm text-muted-foreground">Nothing booked in this period.</p>
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Offering</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="pr-6 text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offerings.map((offering) => (
                    <TableRow key={`${offering.facility}-${offering.offering}`}>
                      <TableCell className="pl-6">
                        <p className="font-medium">{offering.offering}</p>
                        <p className="text-xs text-muted-foreground">{offering.facility}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {offering.bookings}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {money(offering.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Top customers</CardTitle>
              <CardDescription>By money settled in this period.</CardDescription>
            </CardHeader>
            {customers.length === 0 ? (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No settled bookings in this period.
                </p>
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Customer</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="pr-6 text-right">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.email}>
                      <TableCell className="pl-6">
                        <p className="font-medium">
                          {customer.organisation || customer.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{customer.email}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {customer.bookings}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {money(customer.paid)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Money outstanding</CardTitle>
              <CardDescription>Right now, across all bookings.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <Figure
                  label="Owed by customers"
                  value={money(outstanding.owed)}
                  hint={`${outstanding.owedBookings} booking${outstanding.owedBookings === 1 ? "" : "s"}`}
                />
                <Figure
                  label="To refund"
                  value={money(outstanding.refundDue)}
                  hint={`${outstanding.refundBookings} booking${outstanding.refundBookings === 1 ? "" : "s"}`}
                />
                <Figure
                  label="Unpaid invoices"
                  value={money(outstanding.unpaidInvoiceValue)}
                  hint={`${outstanding.unpaidInvoices} open`}
                />
                <Figure
                  label="Sessions awaiting refund"
                  value={money(outstanding.occurrenceRefundValue)}
                  hint={`${outstanding.occurrenceRefundsDue} cancelled session${outstanding.occurrenceRefundsDue === 1 ? "" : "s"}`}
                />
              </dl>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Discount codes used</CardTitle>
              <CardDescription>{period.label}</CardDescription>
            </CardHeader>
            {discounts.length === 0 ? (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No discount codes used in this period.
                </p>
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Code</TableHead>
                    <TableHead className="text-right">Uses</TableHead>
                    <TableHead className="text-right">Given away</TableHead>
                    <TableHead className="pr-6 text-right">Value taken</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discounts.map((discount) => (
                    <TableRow key={discount.code}>
                      <TableCell className="pl-6 font-medium">{discount.code}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {discount.uses}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(discount.discount)}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {money(discount.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
