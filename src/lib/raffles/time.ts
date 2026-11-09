import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

// Raffle times are real instants. Admins type and read them as UK local time.

const UK = "Europe/London";

/** "2026-11-30T20:00" typed by an admin (UK time) → the instant it means. */
export function ukInputToDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  return new Date(new TZDate(y, m - 1, d, h, min, 0, UK).getTime());
}

/** An instant → the "YYYY-MM-DDTHH:mm" value for a datetime-local input. */
export function dateToUkInput(date: Date | null | undefined) {
  if (!date) return "";
  return format(new TZDate(date, UK), "yyyy-MM-dd'T'HH:mm");
}

/** Formats an instant as UK local time with a date-fns pattern. */
export function formatUk(date: Date, pattern: string) {
  return format(new TZDate(date, UK), pattern);
}
