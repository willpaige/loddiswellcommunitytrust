export const customerGroups = [
  { value: "resident", label: "Village resident" },
  { value: "parent_private", label: "Parent / private booking" },
  { value: "team_community", label: "Team / community group" },
  { value: "business", label: "Business" },
] as const;

export type CustomerGroup = (typeof customerGroups)[number]["value"];
export type Recurrence = "none" | "weekly";

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
