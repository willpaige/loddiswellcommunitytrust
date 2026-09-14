import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays } from "date-fns";
import { formatBookingDate } from "@/lib/booking-time";

// Monthly-invoiced bookings bill a calendar month at a time. Occurrence times
// are UK wall-clock values held in UTC fields (see booking-time.ts), so a
// month's bounds are UTC midnights built with Date.UTC -- never local-zone
// startOfMonth, which would drift by an hour and pick up a neighbour's session.

export type InvoicePeriod = { start: Date; end: Date };

export function monthPeriod(year: number, monthIndex: number): InvoicePeriod {
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

export function periodContaining(date: Date): InvoicePeriod {
  return monthPeriod(date.getUTCFullYear(), date.getUTCMonth());
}

export function nextPeriod(period: InvoicePeriod): InvoicePeriod {
  return monthPeriod(period.end.getUTCFullYear(), period.end.getUTCMonth());
}

// The first invoice runs from the booking's first session to the end of that
// month. A booking that starts in the last week of a month would otherwise be
// invoiced twice within days, so it takes the following month as well.
export function firstInvoicePeriod(start: Date, leadDays: number): InvoicePeriod {
  const month = periodContaining(start);
  const daysLeft = differenceInCalendarDays(month.end, start);
  const end = daysLeft <= leadDays ? nextPeriod(month).end : month.end;
  return { start: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())), end };
}

// "Today" for issuing and chasing is the UK calendar date, whatever zone the
// server runs in. Returned as a UTC midnight so it compares with period bounds.
export function ukToday(now = new Date()): Date {
  const uk = new TZDate(now, "Europe/London");
  return new Date(Date.UTC(uk.getFullYear(), uk.getMonth(), uk.getDate()));
}

export function daysUntilDue(dueDate: Date, today: Date) {
  return differenceInCalendarDays(dueDate, today);
}

export function daysOverdue(dueDate: Date, today: Date) {
  return Math.max(0, differenceInCalendarDays(today, dueDate));
}

export function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

// What a single session of a monthly-invoiced booking costs: the rate it was
// sold at, for the hours it runs, less the discount it was sold with.
export function perSessionPrice(unitAmount: number, pricingPercent: number, hours: number) {
  return Math.round((unitAmount * Math.max(1, hours) * (100 - pricingPercent)) / 100);
}

export function periodLabel(period: InvoicePeriod) {
  const lastDay = addUtcDays(period.end, -1);
  const sameMonth =
    period.start.getUTCFullYear() === lastDay.getUTCFullYear() &&
    period.start.getUTCMonth() === lastDay.getUTCMonth();
  if (sameMonth && period.start.getUTCDate() === 1) return formatBookingDate(period.start, "MMMM yyyy");
  return `${formatBookingDate(period.start, "d MMM yyyy")} – ${formatBookingDate(lastDay, "d MMM yyyy")}`;
}
