export const customerGroups = [
  { value: "parent_private", label: "Private" },
  { value: "team_community", label: "Team / community group" },
  { value: "business", label: "Business" },
] as const;

export type CustomerGroup = (typeof customerGroups)[number]["value"];
export const recurrenceOptions = [
  { value: "weekly", label: "Weekly", intervalLabel: "week" },
  { value: "bi_weekly", label: "Bi-weekly", intervalLabel: "2 weeks" },
  { value: "monthly", label: "Monthly", intervalLabel: "month" },
  { value: "quarterly", label: "Quarterly", intervalLabel: "quarter" },
  { value: "yearly", label: "Yearly", intervalLabel: "year" },
] as const;

export type Recurrence = "none" | (typeof recurrenceOptions)[number]["value"];

export function recurrenceLabel(value: string) {
  if (value === "none") return "One-off";
  return recurrenceOptions.find((option) => option.value === value)?.label ?? "Recurring";
}

export function recurrenceIntervalLabel(value: string) {
  if (value === "none") return "booking";
  return recurrenceOptions.find((option) => option.value === value)?.intervalLabel ?? "period";
}

export function periodsPerYear(value: Recurrence): number {
  switch (value) {
    case "weekly":
      return 52;
    case "bi_weekly":
      return 26;
    case "monthly":
      return 12;
    case "quarterly":
      return 4;
    case "yearly":
      return 1;
    default:
      return 0;
  }
}

// Suggested flat per-cycle charge (in pence) when the session frequency differs
// from the billing frequency, e.g. a weekly session billed monthly is
// perSession * 52 / 12. Smoothed over the year and charged as a fixed amount.
export function suggestRecurringAmount(
  perSessionPence: number,
  session: Recurrence,
  billing: Recurrence
): number {
  const sessions = periodsPerYear(session);
  const billings = periodsPerYear(billing);
  if (!sessions || !billings) return perSessionPence;
  return Math.round((perSessionPence * sessions) / billings);
}

export const bookingHourOptions = Array.from({ length: 17 }, (_, index) => {
  const hour = index + 7;
  const value = `${hour.toString().padStart(2, "0")}:00`;
  return {
    value,
    label: `${hour.toString().padStart(2, "0")}:00`,
  };
});

// Positive means the customer still owes it, negative means it is refundable.
// Only ever non-zero once a booking has been changed after it was paid for, or
// cancelled while the Trust still holds the money. A cancelled booking costs
// nothing, so its price is not owed -- reading it as outstanding would chase a
// customer for a booking that is not happening.
export function bookingBalance(booking: {
  amount: number;
  paidAmount: number;
  status?: string;
}) {
  if (booking.status === "cancelled") return -booking.paidAmount;
  return booking.amount - booking.paidAmount;
}

// Picking a new start should keep the length the customer booked, not collapse
// it to the shortest slot on offer. Falls back to the current end, then to the
// earliest available.
export function keepBookingDuration(
  endTimeOptions: string[],
  nextTime: string,
  currentTime: string,
  currentEndTime: string
) {
  const hour = (time: string) => Number(time.slice(0, 2));
  const duration = hour(currentEndTime) - hour(currentTime);
  if (duration > 0) {
    const wanted = `${String(hour(nextTime) + duration).padStart(2, "0")}:00`;
    if (endTimeOptions.includes(wanted)) return wanted;
  }
  if (endTimeOptions.includes(currentEndTime)) return currentEndTime;
  return endTimeOptions[0] ?? "";
}

export function money(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount / 100);
}
