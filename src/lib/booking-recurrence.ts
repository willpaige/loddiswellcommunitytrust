import { addMonths, addWeeks, addYears } from "date-fns";
import type { Recurrence } from "@/lib/bookings";

// Pure date maths, deliberately free of server-only dependencies so that seed
// scripts and the nightly cron generate byte-identical occurrence dates. That
// equivalence is what makes the max(startDate) watermark idempotent.

// Rolling horizon for indefinite bookings and block series. Matches the 180-day
// window used by getAvailableBookingSlots so other bookings can't double-book a
// future slot an indefinite booking will later claim.
export const BOOKING_HORIZON_DAYS = 180;

export function occurrenceDates(
  start: Date,
  end: Date,
  recurrence: Recurrence,
  repeatCount = 26
) {
  if (recurrence === "none") return [{ startDate: start, endDate: end }];
  const addForRecurrence = {
    weekly: (date: Date, index: number) => addWeeks(date, index),
    bi_weekly: (date: Date, index: number) => addWeeks(date, index * 2),
    monthly: (date: Date, index: number) => addMonths(date, index),
    quarterly: (date: Date, index: number) => addMonths(date, index * 3),
    yearly: (date: Date, index: number) => addYears(date, index),
  }[recurrence];
  return Array.from({ length: repeatCount }, (_, index) => ({
    startDate: addForRecurrence(start, index),
    endDate: addForRecurrence(end, index),
  }));
}

export function recurrenceStep(recurrence: Recurrence, date: Date, index: number) {
  switch (recurrence) {
    case "weekly":
      return addWeeks(date, index);
    case "bi_weekly":
      return addWeeks(date, index * 2);
    case "monthly":
      return addMonths(date, index);
    case "quarterly":
      return addMonths(date, index * 3);
    case "yearly":
      return addYears(date, index);
    default:
      return date;
  }
}

// Postgres hands `max(timestamp)` back as a naive string, not a Date, so
// comparing it to a Date silently yields false for every occurrence and the
// watermark stops skipping anything. The "+0000" matters as much as the parse:
// our timestamp columns carry no zone, and drizzle reads them as UTC
// (`new Date(value + "+0000")`). Parsing without it would resolve the watermark
// to a different instant in any non-UTC process and regenerate the tail
// occurrence. Always funnel watermark reads through here.
export function toWatermarkDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(`${value}+0000`);
}

// Generate occurrences for a recurring booking within (fromExclusive, until],
// stepping by index from the IMMUTABLE anchor so dates never drift and the
// result is deterministic — making top-ups idempotent.
export function occurrenceDatesInWindow(
  anchorStart: Date,
  anchorEnd: Date,
  recurrence: Recurrence,
  fromExclusive: Date | null,
  until: Date
) {
  if (recurrence === "none") return [];
  const out: Array<{ startDate: Date; endDate: Date }> = [];
  for (let index = 0; index < 1000; index += 1) {
    const startDate = recurrenceStep(recurrence, anchorStart, index);
    if (startDate > until) break;
    if (fromExclusive && startDate <= fromExclusive) continue;
    out.push({ startDate, endDate: recurrenceStep(recurrence, anchorEnd, index) });
  }
  return out;
}
