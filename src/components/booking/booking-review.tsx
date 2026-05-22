import Link from "next/link";
import { format } from "date-fns";
import { createBookingCheckout } from "@/actions/bookings";
import { money } from "@/lib/bookings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  customerGroup: string;
  recurrence: string;
  customerName: string;
  customerPhone?: string;
  notes?: string;
};

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function customerGroupLabel(value: string) {
  switch (value) {
    case "resident":
      return "Village resident";
    case "team_community":
      return "Team / community group";
    case "business":
      return "Business";
    default:
      return "Parent / private booking";
  }
}

export function BookingReview({
  offerings,
  pending,
}: {
  offerings: OfferingRow[];
  pending: PendingBooking;
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
    : addMinutes(start, offering.durationMinutes);
  const recurring = pending.recurrence === "weekly";
  const amount = recurring ? pricedOffering.amount * 4 : pricedOffering.amount;

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
            <div>
              <dt className="text-sm text-muted-foreground">Payment</dt>
              <dd className="font-medium">
                {money(amount)} {recurring ? "monthly" : "today"}
              </dd>
            </div>
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
            <Button type="submit">Book now</Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
