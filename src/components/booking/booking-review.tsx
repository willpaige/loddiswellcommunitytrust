import Link from "next/link";
import { format } from "date-fns";
import { createBookingCheckout } from "@/actions/bookings";
import { money, recurrenceIntervalLabel, recurrenceLabel } from "@/lib/bookings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingTermsButton } from "@/components/booking/booking-terms-button";

type OfferingRow = {
  facilityName: string;
  offeringId: string;
  offeringName: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  customerGroup: string;
  amount: number;
};

type PendingBooking = {
  offeringId: string;
  date: string;
  time?: string;
  endTime?: string;
  customerGroup: string;
  recurrence: string;
  repeatPaymentMode?: string;
  repeatCount?: string;
  customerName: string;
  organisationName?: string;
  customerPhone?: string;
  notes?: string;
  promoteOnSite?: string;
  promotionUrl?: string;
};

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function customerGroupLabel(value: string) {
  switch (value) {
    case "team_community":
      return "Team / community group";
    case "business":
      return "Business";
    default:
      return "Private";
  }
}

export function BookingReview({
  offerings,
  pending,
  repeatDiscount,
  customerDiscountPercent = 0,
}: {
  offerings: OfferingRow[];
  pending: PendingBooking;
  repeatDiscount: { threshold: number; percent: number };
  customerDiscountPercent?: number;
}) {
  const offering = offerings.find((row) => row.offeringId === pending.offeringId);
  const pricedOffering = offerings.find(
    (row) =>
      row.offeringId === pending.offeringId &&
      row.customerGroup === pending.customerGroup
  );

  if (!offering || !pricedOffering) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review booking</CardTitle>
          <CardDescription>This booking option is no longer available.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/booking">Start again</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const startTime = offering.startTime || pending.time || "09:00";
  const start = new Date(`${pending.date}T${startTime}`);
  const end = offering.endTime
    ? new Date(`${pending.date}T${offering.endTime}`)
    : pending.endTime
      ? new Date(`${pending.date}T${pending.endTime}`)
      : addMinutes(start, offering.durationMinutes);
  const recurring = pending.recurrence !== "none";
  const repeatPaymentMode = pending.repeatPaymentMode === "upfront" ? "upfront" : "subscription";
  const repeatCount = Math.max(2, Math.min(52, Math.round(Number(pending.repeatCount) || repeatDiscount.threshold)));
  const hours = Math.max(1, end.getHours() - start.getHours());
  const baseAmount = pricedOffering.amount * (offering.startTime ? 1 : hours);
  const upfrontSubtotal = baseAmount * repeatCount;
  // Mirror the server's bookingAmount: never stack — take the larger of the
  // customer discount and an eligible repeat-booking discount.
  const repeatEligible =
    recurring &&
    repeatPaymentMode === "upfront" &&
    repeatDiscount.percent > 0 &&
    repeatCount >= repeatDiscount.threshold;
  const effectivePct = Math.max(customerDiscountPercent, repeatEligible ? repeatDiscount.percent : 0);
  const subtotal = recurring
    ? repeatPaymentMode === "upfront"
      ? upfrontSubtotal
      : baseAmount
    : baseAmount;
  const amount = Math.round((subtotal * (100 - effectivePct)) / 100);
  const discountAmount = subtotal - amount;

  return (
    <form action={createBookingCheckout} className="mx-auto max-w-2xl">
      {Object.entries(pending).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value || ""} />
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Review your booking</CardTitle>
          <CardDescription>
            Check the details below, then continue to secure card payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Venue</dt>
              <dd className="font-medium">{offering.facilityName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Booking type</dt>
              <dd className="font-medium">{offering.offeringName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Date and time</dt>
              <dd className="font-medium">
                {format(start, "d MMM yyyy, HH:mm")} to {format(end, "HH:mm")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Customer type</dt>
              <dd className="font-medium">{customerGroupLabel(pending.customerGroup)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="font-medium">{pending.customerName}</dd>
            </div>
            {pending.organisationName && (
              <div>
                <dt className="text-sm text-muted-foreground">
                  {pending.customerGroup === "business" ? "Business / event name" : "Club / event name"}
                </dt>
                <dd className="font-medium">{pending.organisationName}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-muted-foreground">Payment</dt>
              <dd className="font-medium">
                {money(amount)}{" "}
                {recurring && repeatPaymentMode === "subscription"
                  ? `every ${recurrenceIntervalLabel(pending.recurrence)}`
                  : "today"}
              </dd>
              {recurring && repeatPaymentMode === "upfront" && (
                <dd className="mt-1 text-sm text-muted-foreground">
                  {repeatCount} {recurrenceLabel(pending.recurrence).toLowerCase()} sessions paid today
                </dd>
              )}
              {recurring && repeatPaymentMode === "subscription" && (
                <dd className="mt-1 text-sm text-muted-foreground">
                  {recurrenceLabel(pending.recurrence)} booking charged every{" "}
                  {recurrenceIntervalLabel(pending.recurrence)}
                </dd>
              )}
              {discountAmount > 0 && (
                <dd className="mt-1 text-sm text-muted-foreground">
                  Includes {effectivePct}% discount
                </dd>
              )}
            </div>
            {pending.promoteOnSite === "on" && (
              <div>
                <dt className="text-sm text-muted-foreground">Website promotion</dt>
                <dd className="font-medium">Add to Events after payment</dd>
              </div>
            )}
          </dl>

          {pending.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm">{pending.notes}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" asChild>
              <Link href="/booking">Start again</Link>
            </Button>
            <BookingTermsButton />
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
