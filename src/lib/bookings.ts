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

// What one unit of a venue's capacity is called. Only venues with capacity > 1
// ever surface this, which today means the tennis courts alone.
const capacityUnitNouns: Record<string, { one: string; many: string }> = {
  "tennis-courts": { one: "court", many: "courts" },
};

export function capacityUnitNoun(facilitySlug: string, count = 1) {
  const noun = capacityUnitNouns[facilitySlug] ?? { one: "space", many: "spaces" };
  return count === 1 ? noun.one : noun.many;
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

export function money(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount / 100);
}
