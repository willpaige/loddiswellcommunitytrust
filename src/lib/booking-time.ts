import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

// Booking, occurrence and block times are UK wall-clock values held in
// `timestamp without time zone` columns. Drizzle reads and writes those columns
// through UTC, so the wall clock a customer picked lives in the Date's UTC
// fields, not in whatever local fields the machine rendering it happens to
// have. Anything that builds or displays one of these dates goes through here,
// so the availability picker, the admin screens and the emails all agree
// regardless of the server's or the visitor's timezone.
export const BOOKING_TIME_ZONE = "UTC";

export function formatBookingDate(date: Date, pattern: string) {
  return format(new TZDate(date, BOOKING_TIME_ZONE), pattern);
}

export function bookingDateKey(date: Date) {
  return formatBookingDate(date, "yyyy-MM-dd");
}

// `dateValue` is "yyyy-MM-dd" and `timeValue` is "HH:mm", both already in the
// booking timezone.
export function parseBookingDateTime(dateValue: string, timeValue: string) {
  const date = new Date(`${dateValue}T${timeValue}:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export function bookingHourOfDay(date: Date) {
  return date.getUTCHours();
}

export function bookingMinuteOfDay(date: Date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}
