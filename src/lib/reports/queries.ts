import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { Granularity, ReportPeriod } from "@/lib/reports";

// Read-only report queries. Server-component only — there is no "use server"
// here on purpose, so none of this is reachable as a form endpoint. Each entry
// point still checks the session, so a report can never be read by a customer
// who finds their way to one of these modules.

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "editor")) {
    throw new Error("Unauthorized");
  }
}

async function rows<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return (result as unknown as { rows: T[] }).rows ?? [];
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Every pound the Trust has actually taken, as a single ledger.
 *
 * Three things make money arrive, and each is counted exactly once:
 *  - card and invoice payments against a booking (`booking_payments`), net of
 *    anything refunded off that payment;
 *  - the part of a booking settled outside Stripe — cash, cheque, bank transfer,
 *    or a manual booking the office marked as paid — which is what the booking
 *    records as paid beyond its Stripe payments;
 *  - lottery payments, first sale and every renewal alike.
 *
 * Refunds are netted against the payment they came off, so they reduce income in
 * the period the money was taken rather than the period it went back. That keeps
 * a booking's income and its refund together instead of leaving a period looking
 * better than it was.
 */
const incomeLedger = sql`
  with stripe_by_booking as (
    select booking_id, sum(amount - refunded_amount) as net
    from booking_payments
    group by booking_id
  ),
  ledger as (
    select bp.created_at as paid_at,
           'bookings'::text as source,
           'card'::text as method,
           (bp.amount - bp.refunded_amount) as amount
    from booking_payments bp
    union all
    select b.created_at,
           'bookings'::text,
           'offline'::text,
           (b.paid_amount - coalesce(s.net, 0))
    from bookings b
    left join stripe_by_booking s on s.booking_id = b.id
    where b.paid_amount - coalesce(s.net, 0) > 0
    union all
    select lp.paid_at,
           'lottery'::text,
           case when lp.source = 'manual' then 'offline' else 'card' end,
           (lp.amount - lp.refunded_amount)
    from lottery_payments lp
  )
`;

function truncExpr(granularity: Granularity) {
  return granularity === "month" ? "month" : granularity === "week" ? "week" : "day";
}

export type IncomeTotals = {
  total: number;
  bookings: number;
  lottery: number;
  card: number;
  offline: number;
  payments: number;
};

export type IncomeBucket = {
  bucket: string;
  bookings: number;
  lottery: number;
};

export async function getIncomeTotals(start: Date, end: Date): Promise<IncomeTotals> {
  await requireAdmin();
  const result = await rows<{
    total: string;
    bookings: string;
    lottery: string;
    card: string;
    offline: string;
    payments: string;
  }>(sql`
    ${incomeLedger}
    select
      coalesce(sum(amount), 0) as total,
      coalesce(sum(amount) filter (where source = 'bookings'), 0) as bookings,
      coalesce(sum(amount) filter (where source = 'lottery'), 0) as lottery,
      coalesce(sum(amount) filter (where method = 'card'), 0) as card,
      coalesce(sum(amount) filter (where method = 'offline'), 0) as offline,
      count(*) as payments
    from ledger
    where paid_at >= ${start} and paid_at < ${end}
  `);
  const row = result[0];
  return {
    total: num(row?.total),
    bookings: num(row?.bookings),
    lottery: num(row?.lottery),
    card: num(row?.card),
    offline: num(row?.offline),
    payments: num(row?.payments),
  };
}

export async function getIncomeByBucket(period: ReportPeriod): Promise<IncomeBucket[]> {
  await requireAdmin();
  const unit = truncExpr(period.granularity);
  return (
    await rows<{ bucket: string; bookings: string; lottery: string }>(sql`
      ${incomeLedger}
      select
        to_char(date_trunc(${unit}, paid_at), 'YYYY-MM-DD') as bucket,
        coalesce(sum(amount) filter (where source = 'bookings'), 0) as bookings,
        coalesce(sum(amount) filter (where source = 'lottery'), 0) as lottery
      from ledger
      where paid_at >= ${period.start} and paid_at < ${period.end}
      group by 1
      order by 1
    `)
  ).map((row) => ({
    bucket: row.bucket,
    bookings: num(row.bookings),
    lottery: num(row.lottery),
  }));
}

/** The first day anything was ever taken, so "all time" starts at the data. */
export async function getEarliestIncomeDate(): Promise<Date | null> {
  await requireAdmin();
  const result = await rows<{ earliest: string | null }>(sql`
    ${incomeLedger}
    select to_char(min(paid_at), 'YYYY-MM-DD') as earliest from ledger
  `);
  const value = result[0]?.earliest;
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

// ── Bookings ──

export type BookingTotals = {
  created: number;
  createdValue: number;
  cancelled: number;
  averageValue: number;
  discountGiven: number;
  discountedBookings: number;
  newCustomers: number;
};

export async function getBookingTotals(start: Date, end: Date): Promise<BookingTotals> {
  await requireAdmin();
  const result = await rows<Record<string, string>>(sql`
    select
      count(*) as created,
      coalesce(sum(amount) filter (where status <> 'cancelled'), 0) as created_value,
      count(*) filter (where status = 'cancelled') as cancelled,
      coalesce(sum(discount_amount), 0) as discount_given,
      count(*) filter (where discount_amount > 0) as discounted_bookings,
      count(distinct lower(customer_email)) as customers
    from bookings
    where created_at >= ${start} and created_at < ${end}
  `);
  const row = result[0];
  const created = num(row?.created);
  const cancelled = num(row?.cancelled);
  const value = num(row?.created_value);
  return {
    created,
    createdValue: value,
    cancelled,
    averageValue: created - cancelled > 0 ? Math.round(value / (created - cancelled)) : 0,
    discountGiven: num(row?.discount_given),
    discountedBookings: num(row?.discounted_bookings),
    newCustomers: num(row?.customers),
  };
}

export type SessionTotals = {
  sessions: number;
  /** Already happened. The rest of `sessions` is still in the diary. */
  held: number;
  cancelled: number;
  hours: number;
  value: number;
  facilities: number;
};

/**
 * Activity rather than money in: sessions that sit inside the period, counted on
 * the day they are held. A booking taken in March for a hall in June is income
 * in March and a session in June.
 */
export async function getSessionTotals(start: Date, end: Date): Promise<SessionTotals> {
  await requireAdmin();
  const result = await rows<Record<string, string>>(sql`
    select
      count(*) filter (where o.status <> 'cancelled') as sessions,
      count(*) filter (where o.status <> 'cancelled' and o.start_date < now()) as held,
      count(*) filter (where o.status = 'cancelled') as cancelled,
      coalesce(sum(extract(epoch from (o.end_date - o.start_date)) / 3600)
        filter (where o.status <> 'cancelled'), 0) as hours,
      coalesce(sum(o.allocated_amount) filter (where o.status = 'confirmed'), 0) as value,
      count(distinct o.facility_id) filter (where o.status <> 'cancelled') as facilities
    from booking_occurrences o
    where o.start_date >= ${start} and o.start_date < ${end}
  `);
  const row = result[0];
  return {
    sessions: num(row?.sessions),
    held: num(row?.held),
    cancelled: num(row?.cancelled),
    hours: Math.round(num(row?.hours) * 10) / 10,
    value: num(row?.value),
    facilities: num(row?.facilities),
  };
}

export type FacilityRow = {
  facilityId: string;
  facility: string;
  sessions: number;
  hours: number;
  value: number;
  bookableHours: number;
  utilisation: number | null;
};

/**
 * Hours used against hours available. A facility is bookable between the start
 * and end times set on it, every day of the period, so utilisation says how much
 * of that window is actually taken.
 */
export async function getFacilityBreakdown(
  start: Date,
  end: Date
): Promise<FacilityRow[]> {
  await requireAdmin();
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const result = await rows<Record<string, unknown>>(sql`
    select
      f.id as facility_id,
      f.name as facility,
      f.bookable as bookable,
      extract(epoch from (f.bookable_end_time::time - f.bookable_start_time::time)) / 3600 as window_hours,
      count(o.id) filter (where o.status <> 'cancelled') as sessions,
      coalesce(sum(extract(epoch from (o.end_date - o.start_date)) / 3600)
        filter (where o.status <> 'cancelled'), 0) as hours,
      coalesce(sum(o.allocated_amount) filter (where o.status = 'confirmed'), 0) as value
    from facilities f
    left join booking_occurrences o
      on o.facility_id = f.id
      and o.start_date >= ${start}
      and o.start_date < ${end}
    group by f.id, f.name, f.bookable, f.bookable_end_time, f.bookable_start_time
    order by hours desc, f.name
  `);
  return result
    .filter((row) => row.bookable === true || String(row.bookable) === "true" || num(row.sessions) > 0)
    .map((row) => {
      const hours = Math.round(num(row.hours) * 10) / 10;
      const bookableHours = Math.round(num(row.window_hours) * days * 10) / 10;
      return {
        facilityId: String(row.facility_id),
        facility: String(row.facility),
        sessions: num(row.sessions),
        hours,
        value: num(row.value),
        bookableHours,
        utilisation: bookableHours > 0 ? (hours / bookableHours) * 100 : null,
      };
    });
}

export type SessionBucket = { bucket: string; sessions: number; hours: number };

export async function getSessionsByBucket(period: ReportPeriod): Promise<SessionBucket[]> {
  await requireAdmin();
  const unit = truncExpr(period.granularity);
  return (
    await rows<Record<string, string>>(sql`
      select
        to_char(date_trunc(${unit}, start_date), 'YYYY-MM-DD') as bucket,
        count(*) as sessions,
        coalesce(sum(extract(epoch from (end_date - start_date)) / 3600), 0) as hours
      from booking_occurrences
      where start_date >= ${period.start}
        and start_date < ${period.end}
        and status <> 'cancelled'
      group by 1
      order by 1
    `)
  ).map((row) => ({
    bucket: String(row.bucket),
    sessions: num(row.sessions),
    hours: Math.round(num(row.hours) * 10) / 10,
  }));
}

export type GroupRow = { key: string; bookings: number; value: number };

export async function getCustomerGroupBreakdown(
  start: Date,
  end: Date
): Promise<GroupRow[]> {
  await requireAdmin();
  return (
    await rows<Record<string, string>>(sql`
      select customer_group as key, count(*) as bookings, coalesce(sum(amount), 0) as value
      from bookings
      where created_at >= ${start} and created_at < ${end} and status <> 'cancelled'
      group by 1
      order by value desc
    `)
  ).map((row) => ({
    key: String(row.key),
    bookings: num(row.bookings),
    value: num(row.value),
  }));
}

export type CustomerRow = {
  name: string;
  email: string;
  organisation: string | null;
  bookings: number;
  paid: number;
};

/** Who the Trust's booking income actually comes from, by money settled. */
export async function getTopBookingCustomers(
  start: Date,
  end: Date,
  limit = 10
): Promise<CustomerRow[]> {
  await requireAdmin();
  return (
    await rows<Record<string, string>>(sql`
      select
        min(customer_name) as name,
        lower(customer_email) as email,
        max(organisation_name) as organisation,
        count(*) as bookings,
        coalesce(sum(paid_amount), 0) as paid
      from bookings
      where created_at >= ${start} and created_at < ${end}
      group by lower(customer_email)
      having sum(paid_amount) > 0
      order by paid desc
      limit ${limit}
    `)
  ).map((row) => ({
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    organisation: row.organisation ? String(row.organisation) : null,
    bookings: num(row.bookings),
    paid: num(row.paid),
  }));
}

export type OfferingRow = {
  offering: string;
  facility: string;
  bookings: number;
  value: number;
};

export async function getOfferingBreakdown(
  start: Date,
  end: Date
): Promise<OfferingRow[]> {
  await requireAdmin();
  return (
    await rows<Record<string, string>>(sql`
      select
        coalesce(bo.name, 'Other') as offering,
        coalesce(f.name, '—') as facility,
        count(*) as bookings,
        coalesce(sum(b.amount), 0) as value
      from bookings b
      left join booking_offerings bo on bo.id = b.offering_id
      left join facilities f on f.id = b.facility_id
      where b.created_at >= ${start} and b.created_at < ${end} and b.status <> 'cancelled'
      group by 1, 2
      order by value desc, bookings desc
    `)
  ).map((row) => ({
    offering: String(row.offering),
    facility: String(row.facility),
    bookings: num(row.bookings),
    value: num(row.value),
  }));
}

export type DiscountRow = {
  code: string;
  uses: number;
  discount: number;
  value: number;
};

export async function getDiscountUsage(start: Date, end: Date): Promise<DiscountRow[]> {
  await requireAdmin();
  return (
    await rows<Record<string, string>>(sql`
      select
        upper(discount_code) as code,
        count(*) as uses,
        coalesce(sum(discount_amount), 0) as discount,
        coalesce(sum(amount), 0) as value
      from bookings
      where created_at >= ${start}
        and created_at < ${end}
        and discount_code is not null
        and status <> 'cancelled'
      group by 1
      order by discount desc
    `)
  ).map((row) => ({
    code: String(row.code),
    uses: num(row.uses),
    discount: num(row.discount),
    value: num(row.value),
  }));
}

export type OutstandingMoney = {
  owed: number;
  owedBookings: number;
  refundDue: number;
  refundBookings: number;
  unpaidInvoices: number;
  unpaidInvoiceValue: number;
  pendingPayment: number;
  occurrenceRefundsDue: number;
  occurrenceRefundValue: number;
};

/**
 * Money that has not landed yet, or has to go back. Cancelled bookings owe
 * nothing, so what they still hold reads as refundable, never as arrears.
 */
export async function getOutstandingMoney(): Promise<OutstandingMoney> {
  await requireAdmin();
  const [balances] = await rows<Record<string, string>>(sql`
    select
      coalesce(sum(case when status <> 'cancelled' and amount > paid_amount
        then amount - paid_amount else 0 end), 0) as owed,
      count(*) filter (where status <> 'cancelled' and amount > paid_amount) as owed_bookings,
      coalesce(sum(case when status = 'cancelled' then paid_amount
        when paid_amount > amount then paid_amount - amount else 0 end), 0) as refund_due,
      count(*) filter (where (status = 'cancelled' and paid_amount > 0) or paid_amount > amount) as refund_bookings,
      count(*) filter (where invoice_status = 'open') as unpaid_invoices,
      coalesce(sum(amount) filter (where invoice_status = 'open'), 0) as unpaid_invoice_value,
      count(*) filter (where status = 'pending_payment') as pending_payment
    from bookings
  `);
  const [occurrences] = await rows<Record<string, string>>(sql`
    select
      count(*) as refunds_due,
      coalesce(sum(refund_amount), 0) as refund_value
    from booking_occurrences
    where refund_status = 'due'
  `);
  return {
    owed: num(balances?.owed),
    owedBookings: num(balances?.owed_bookings),
    refundDue: num(balances?.refund_due),
    refundBookings: num(balances?.refund_bookings),
    unpaidInvoices: num(balances?.unpaid_invoices),
    unpaidInvoiceValue: num(balances?.unpaid_invoice_value),
    pendingPayment: num(balances?.pending_payment),
    occurrenceRefundsDue: num(occurrences?.refunds_due),
    occurrenceRefundValue: num(occurrences?.refund_value),
  };
}

export type UpcomingCommitment = {
  sessions: number;
  hours: number;
  value: number;
};

/** What is already in the diary from today on — the forward order book. */
export async function getUpcomingCommitment(days: number): Promise<UpcomingCommitment> {
  await requireAdmin();
  const [row] = await rows<Record<string, string>>(sql`
    select
      count(*) as sessions,
      coalesce(sum(extract(epoch from (end_date - start_date)) / 3600), 0) as hours,
      coalesce(sum(allocated_amount), 0) as value
    from booking_occurrences
    where status <> 'cancelled'
      and start_date >= now()
      and start_date < now() + make_interval(days => ${days})
  `);
  return {
    sessions: num(row?.sessions),
    hours: Math.round(num(row?.hours) * 10) / 10,
    value: num(row?.value),
  };
}

// ── Lottery ──

export type LotteryTotals = {
  activeSubscribers: number;
  activeTickets: number;
  newSubscribers: number;
  newTickets: number;
  cancellations: number;
  cancellingAtPeriodEnd: number;
  pastDue: number;
  annualRunRate: number;
  averageTickets: number;
};

export async function getLotteryTotals(start: Date, end: Date): Promise<LotteryTotals> {
  await requireAdmin();
  const [row] = await rows<Record<string, string>>(sql`
    select
      count(*) filter (where status = 'active') as active_subscribers,
      coalesce(sum(quantity) filter (where status = 'active'), 0) as active_tickets,
      count(*) filter (where purchase_date >= ${start} and purchase_date < ${end}) as new_subscribers,
      coalesce(sum(quantity) filter (where purchase_date >= ${start} and purchase_date < ${end}), 0) as new_tickets,
      count(*) filter (where canceled_at >= ${start} and canceled_at < ${end}) as cancellations,
      count(*) filter (where status = 'active' and cancel_at_period_end) as cancelling,
      count(*) filter (where status = 'past_due') as past_due,
      -- What the active book is worth over a year: monthly plans twelve times
      -- over, yearly and manual entries once.
      coalesce(sum(
        case
          when status <> 'active' then 0
          when billing_interval = 'month' then amount * 12
          else amount
        end
      ), 0) as run_rate
    from lottery_tickets
  `);
  const activeSubscribers = num(row?.active_subscribers);
  const activeTickets = num(row?.active_tickets);
  return {
    activeSubscribers,
    activeTickets,
    newSubscribers: num(row?.new_subscribers),
    newTickets: num(row?.new_tickets),
    cancellations: num(row?.cancellations),
    cancellingAtPeriodEnd: num(row?.cancelling),
    pastDue: num(row?.past_due),
    annualRunRate: num(row?.run_rate),
    averageTickets:
      activeSubscribers > 0
        ? Math.round((activeTickets / activeSubscribers) * 10) / 10
        : 0,
  };
}

export type LotteryPlanRow = {
  plan: string;
  subscribers: number;
  tickets: number;
  annualValue: number;
};

export async function getLotteryPlanMix(): Promise<LotteryPlanRow[]> {
  await requireAdmin();
  return (
    await rows<Record<string, string>>(sql`
      select
        case
          when source = 'manual' then 'Manual / cash'
          when billing_interval = 'month' then 'Monthly'
          when billing_interval = 'year' then 'Yearly'
          else 'Other'
        end as plan,
        count(*) as subscribers,
        coalesce(sum(quantity), 0) as tickets,
        coalesce(sum(case when billing_interval = 'month' then amount * 12 else amount end), 0) as annual_value
      from lottery_tickets
      where status = 'active'
      group by 1
      order by annual_value desc
    `)
  ).map((row) => ({
    plan: String(row.plan),
    subscribers: num(row.subscribers),
    tickets: num(row.tickets),
    annualValue: num(row.annual_value),
  }));
}

export type LotteryBucket = { bucket: string; amount: number; payments: number };

export async function getLotteryIncomeByBucket(
  period: ReportPeriod
): Promise<LotteryBucket[]> {
  await requireAdmin();
  const unit = truncExpr(period.granularity);
  return (
    await rows<Record<string, string>>(sql`
      select
        to_char(date_trunc(${unit}, paid_at), 'YYYY-MM-DD') as bucket,
        coalesce(sum(amount - refunded_amount), 0) as amount,
        count(*) as payments
      from lottery_payments
      where paid_at >= ${period.start} and paid_at < ${period.end}
      group by 1
      order by 1
    `)
  ).map((row) => ({
    bucket: String(row.bucket),
    amount: num(row.amount),
    payments: num(row.payments),
  }));
}

export type RenewalRow = { window: string; subscribers: number; value: number };

/** Renewals coming up, so a quiet month can be seen before it happens. */
export async function getLotteryRenewals(): Promise<RenewalRow[]> {
  await requireAdmin();
  const [row] = await rows<Record<string, string>>(sql`
    select
      count(*) filter (where renews < now()) as overdue,
      coalesce(sum(amount) filter (where renews < now()), 0) as overdue_value,
      count(*) filter (where renews >= now() and renews < now() + interval '30 days') as d30,
      coalesce(sum(amount) filter (where renews >= now() and renews < now() + interval '30 days'), 0) as d30_value,
      count(*) filter (where renews >= now() + interval '30 days' and renews < now() + interval '60 days') as d60,
      coalesce(sum(amount) filter (where renews >= now() + interval '30 days' and renews < now() + interval '60 days'), 0) as d60_value,
      count(*) filter (where renews >= now() + interval '60 days' and renews < now() + interval '90 days') as d90,
      coalesce(sum(amount) filter (where renews >= now() + interval '60 days' and renews < now() + interval '90 days'), 0) as d90_value
    from (
      select amount, coalesce(current_period_end, expiry_date) as renews
      from lottery_tickets
      where status = 'active' and not cancel_at_period_end
    ) t
  `);
  return [
    { window: "Overdue", subscribers: num(row?.overdue), value: num(row?.overdue_value) },
    { window: "Next 30 days", subscribers: num(row?.d30), value: num(row?.d30_value) },
    { window: "31–60 days", subscribers: num(row?.d60), value: num(row?.d60_value) },
    { window: "61–90 days", subscribers: num(row?.d90), value: num(row?.d90_value) },
  ];
}

export type SubscriberMovement = { bucket: string; joined: number; left: number };

export async function getLotteryMovement(
  period: ReportPeriod
): Promise<SubscriberMovement[]> {
  await requireAdmin();
  const unit = truncExpr(period.granularity);
  const joined = await rows<Record<string, string>>(sql`
    select to_char(date_trunc(${unit}, purchase_date), 'YYYY-MM-DD') as bucket, count(*) as n
    from lottery_tickets
    where purchase_date >= ${period.start} and purchase_date < ${period.end}
    group by 1
  `);
  const left = await rows<Record<string, string>>(sql`
    select to_char(date_trunc(${unit}, canceled_at), 'YYYY-MM-DD') as bucket, count(*) as n
    from lottery_tickets
    where canceled_at >= ${period.start} and canceled_at < ${period.end}
    group by 1
  `);
  const byBucket = new Map<string, SubscriberMovement>();
  for (const row of joined) {
    byBucket.set(String(row.bucket), {
      bucket: String(row.bucket),
      joined: num(row.n),
      left: 0,
    });
  }
  for (const row of left) {
    const key = String(row.bucket);
    const existing = byBucket.get(key);
    if (existing) existing.left = num(row.n);
    else byBucket.set(key, { bucket: key, joined: 0, left: num(row.n) });
  }
  return [...byBucket.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

export type DrawRow = {
  id: string;
  drawDate: Date;
  winners: number;
  published: boolean;
  notified: boolean;
  prizes: string[];
  /** Best effort: prizes are free text, so anything without a figure counts as 0. */
  prizeValue: number;
};

// Prizes are typed by hand as "£35", "35", "£35.00 voucher". Read a figure out of
// whatever was written and leave the rest alone rather than guessing.
function prizePence(prize: string): number {
  const match = prize.replace(/,/g, "").match(/£?\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) return 0;
  return Math.round(Number(match[1]) * 100);
}

export async function getDrawsInPeriod(start: Date, end: Date): Promise<DrawRow[]> {
  await requireAdmin();
  return (
    await rows<Record<string, unknown>>(sql`
      select id, to_char(draw_date, 'YYYY-MM-DD') as draw_date, results, published, notified_at
      from lottery_draws
      where draw_date >= ${start} and draw_date < ${end}
      order by draw_date desc
    `)
  ).map((row) => {
    const results = Array.isArray(row.results)
      ? (row.results as Array<{ prize?: string; winner?: string }>)
      : [];
    const prizes = results.map((result) => result.prize ?? "").filter(Boolean);
    return {
      id: String(row.id),
      drawDate: new Date(`${String(row.draw_date)}T00:00:00.000Z`),
      winners: results.length,
      published: row.published === true || String(row.published) === "true",
      notified: Boolean(row.notified_at),
      prizes,
      prizeValue: prizes.reduce((sum, prize) => sum + prizePence(prize), 0),
    };
  });
}

// ── Exports ──

export type ExportRow = Record<string, string | number>;

/** One row per payment, for the treasurer's spreadsheet and the annual accounts. */
export async function getIncomeLedgerRows(start: Date, end: Date): Promise<ExportRow[]> {
  await requireAdmin();
  const result = await rows<Record<string, unknown>>(sql`
    with stripe_by_booking as (
      select booking_id, sum(amount - refunded_amount) as net
      from booking_payments
      group by booking_id
    )
    select
      to_char(bp.created_at, 'YYYY-MM-DD') as date,
      'Bookings' as source,
      'Card' as method,
      b.customer_name as payer,
      coalesce(f.name, '') as detail,
      (bp.amount - bp.refunded_amount) / 100.0 as amount,
      bp.refunded_amount / 100.0 as refunded,
      bp.stripe_payment_intent_id as reference
    from booking_payments bp
    join bookings b on b.id = bp.booking_id
    left join facilities f on f.id = b.facility_id
    where bp.created_at >= ${start} and bp.created_at < ${end}
    union all
    select
      to_char(b.created_at, 'YYYY-MM-DD'),
      'Bookings',
      'Offline',
      b.customer_name,
      coalesce(f.name, ''),
      (b.paid_amount - coalesce(s.net, 0)) / 100.0,
      0,
      b.id
    from bookings b
    left join stripe_by_booking s on s.booking_id = b.id
    left join facilities f on f.id = b.facility_id
    where b.created_at >= ${start}
      and b.created_at < ${end}
      and b.paid_amount - coalesce(s.net, 0) > 0
    union all
    select
      to_char(lp.paid_at, 'YYYY-MM-DD'),
      'Lottery',
      case when lp.source = 'manual' then 'Offline' else 'Card' end,
      t.name,
      t.quantity || ' ticket(s)',
      (lp.amount - lp.refunded_amount) / 100.0,
      lp.refunded_amount / 100.0,
      lp.reference
    from lottery_payments lp
    join lottery_tickets t on t.id = lp.ticket_id
    where lp.paid_at >= ${start} and lp.paid_at < ${end}
    order by 1
  `);
  return result.map((row) => ({
    Date: String(row.date ?? ""),
    Source: String(row.source ?? ""),
    Method: String(row.method ?? ""),
    Payer: String(row.payer ?? ""),
    Detail: String(row.detail ?? ""),
    "Amount (£)": Number(row.amount ?? 0).toFixed(2),
    "Refunded (£)": Number(row.refunded ?? 0).toFixed(2),
    Reference: String(row.reference ?? ""),
  }));
}

export async function getBookingExportRows(start: Date, end: Date): Promise<ExportRow[]> {
  await requireAdmin();
  const result = await rows<Record<string, unknown>>(sql`
    select
      to_char(b.created_at, 'YYYY-MM-DD') as booked_on,
      to_char(b.start_date, 'YYYY-MM-DD HH24:MI') as starts,
      coalesce(f.name, '') as facility,
      coalesce(bo.name, '') as offering,
      b.customer_name,
      coalesce(b.organisation_name, '') as organisation,
      b.customer_email,
      b.customer_group,
      b.status,
      b.payment_type,
      b.recurrence,
      b.repeat_count,
      b.amount / 100.0 as amount,
      b.paid_amount / 100.0 as paid,
      b.discount_amount / 100.0 as discount,
      coalesce(b.discount_code, '') as discount_code
    from bookings b
    left join facilities f on f.id = b.facility_id
    left join booking_offerings bo on bo.id = b.offering_id
    where b.created_at >= ${start} and b.created_at < ${end}
    order by b.created_at
  `);
  return result.map((row) => ({
    "Booked on": String(row.booked_on ?? ""),
    Starts: String(row.starts ?? ""),
    Facility: String(row.facility ?? ""),
    Offering: String(row.offering ?? ""),
    Customer: String(row.customer_name ?? ""),
    Organisation: String(row.organisation ?? ""),
    Email: String(row.customer_email ?? ""),
    Group: String(row.customer_group ?? ""),
    Status: String(row.status ?? ""),
    Payment: String(row.payment_type ?? ""),
    Recurrence: String(row.recurrence ?? ""),
    Sessions: Number(row.repeat_count ?? 0),
    "Amount (£)": Number(row.amount ?? 0).toFixed(2),
    "Paid (£)": Number(row.paid ?? 0).toFixed(2),
    "Discount (£)": Number(row.discount ?? 0).toFixed(2),
    "Discount code": String(row.discount_code ?? ""),
  }));
}

export async function getLotteryExportRows(start: Date, end: Date): Promise<ExportRow[]> {
  await requireAdmin();
  const result = await rows<Record<string, unknown>>(sql`
    select
      to_char(lp.paid_at, 'YYYY-MM-DD') as paid_on,
      t.name,
      t.email,
      t.quantity,
      t.source,
      coalesce(t.billing_interval, '') as billing_interval,
      t.status,
      to_char(coalesce(t.current_period_end, t.expiry_date), 'YYYY-MM-DD') as renews,
      (lp.amount - lp.refunded_amount) / 100.0 as amount,
      lp.reference
    from lottery_payments lp
    join lottery_tickets t on t.id = lp.ticket_id
    where lp.paid_at >= ${start} and lp.paid_at < ${end}
    order by lp.paid_at
  `);
  return result.map((row) => ({
    "Paid on": String(row.paid_on ?? ""),
    Name: String(row.name ?? ""),
    Email: String(row.email ?? ""),
    Tickets: Number(row.quantity ?? 0),
    Source: String(row.source ?? ""),
    Plan: String(row.billing_interval ?? ""),
    Status: String(row.status ?? ""),
    Renews: String(row.renews ?? ""),
    "Amount (£)": Number(row.amount ?? 0).toFixed(2),
    Reference: String(row.reference ?? ""),
  }));
}
