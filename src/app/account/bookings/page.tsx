import { differenceInHours } from "date-fns";
import { formatBookingDate } from "@/lib/booking-time";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import {
  cancelCustomerBooking,
  getCustomerBookingCancellationSettings,
  getCustomerBookings,
  retryCustomerBookingPayment,
} from "@/actions/bookings";
import { money, recurrenceIntervalLabel, recurrenceLabel } from "@/lib/bookings";
import { getBookingRequirementStatuses } from "@/lib/booking-requirements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountPortalShell } from "@/components/account/portal-shell";

export const dynamic = "force-dynamic";

export default async function AccountBookingsPage() {
  const [bookings, cancellationSettings] = await Promise.all([
    getCustomerBookings(),
    getCustomerBookingCancellationSettings(),
  ]);
  const requirementStatuses = await getBookingRequirementStatuses(bookings.map((b) => b.id));

  return (
    <AccountPortalShell
      title="Bookings"
      description="View upcoming facility bookings and cancel eligible bookings."
    >
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl">My bookings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirmed and upcoming facility bookings linked to your email address.
          </p>
        </div>
        <Button asChild>
          <Link href="/booking">New booking</Link>
        </Button>
      </div>

      {bookings.length === 0 ? (
        <Card className="text-center">
          <CardHeader>
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <CardTitle>No bookings yet</CardTitle>
            <CardDescription>Your confirmed bookings will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/booking">Book a facility</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const canRetryPayment = booking.status === "pending_payment";
            const canCancelWithoutRefund =
              booking.status === "pending_payment" || booking.status === "payment_failed";
            const canCancelWithRefund =
              booking.status === "confirmed" &&
              differenceInHours(booking.startDate, new Date()) >=
                cancellationSettings.noticeHours;
            const canCancel = canCancelWithoutRefund || canCancelWithRefund;
            const requirement = requirementStatuses.get(booking.id);
            const needsInfo =
              booking.status !== "cancelled" &&
              Boolean(requirement?.hasRequirements) &&
              !requirement?.complete;
            return (
              <Card key={booking.id}>
                <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{booking.facilityName}</h3>
                      <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                        {booking.status.replace("_", " ")}
                      </Badge>
                      {booking.recurrence !== "none" && (
                        <Badge variant="outline">{recurrenceLabel(booking.recurrence)}</Badge>
                      )}
                      {needsInfo && <Badge variant="destructive">Action needed</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {booking.offeringName || "Booking"} · {formatBookingDate(booking.startDate, "d MMM yyyy, HH:mm")} to{" "}
                      {formatBookingDate(booking.endDate, "HH:mm")}
                    </p>
                    {booking.organisationName && (
                      <p className="mt-1 text-sm text-muted-foreground">{booking.organisationName}</p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {money(booking.amount)} ·{" "}
                      {booking.paymentType === "subscription"
                        ? `subscription every ${recurrenceIntervalLabel(booking.recurrence)}`
                        : "card payment"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {requirement?.hasRequirements && booking.status !== "cancelled" && (
                      <Button asChild variant={needsInfo ? "default" : "outline"}>
                        <Link href={`/account/bookings/${booking.id}/requirements`}>
                          {needsInfo ? "Complete required information" : "View requirements"}
                        </Link>
                      </Button>
                    )}
                    {canRetryPayment && (
                      <form action={retryCustomerBookingPayment}>
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <Button type="submit">Pay now</Button>
                      </form>
                    )}
                    {canCancel ? (
                      <form action={cancelCustomerBooking}>
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <Button type="submit" variant="outline">
                          {canCancelWithRefund ? "Cancel and refund" : "Cancel booking"}
                        </Button>
                      </form>
                    ) : (
                      <p className="max-w-48 text-sm text-muted-foreground">
                        {booking.status === "cancelled"
                          ? "This booking has been cancelled."
                          : `Online cancellation closes ${cancellationSettings.noticeHours} hours before start.`}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AccountPortalShell>
  );
}
