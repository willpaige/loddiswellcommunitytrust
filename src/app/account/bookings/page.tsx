import { differenceInHours } from "date-fns";
import { formatBookingDate } from "@/lib/booking-time";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import {
  getCustomerBookingCancellationSettings,
  getCustomerBookings,
  payCustomerBookingBalance,
  retryCustomerBookingPayment,
} from "@/actions/bookings";
import {
  bookingBalance,
  money,
  recurrenceIntervalLabel,
  recurrenceLabel,
} from "@/lib/bookings";
import { getBookingRequirementStatuses } from "@/lib/booking-requirements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountPortalShell } from "@/components/account/portal-shell";
import { CustomerCancelBookingButton } from "@/components/account/cancel-booking-button";

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
            // Same notice window as cancelling, and only for single bookings paid
            // outright -- series and subscriptions are settled with the Trust.
            const canChange =
              (booking.status === "confirmed" || booking.status === "pending_payment") &&
              booking.paymentType !== "subscription" &&
              booking.recurrence === "none" &&
              booking.scheduleType === "regular" &&
              differenceInHours(booking.startDate, new Date()) >=
                cancellationSettings.noticeHours;
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
                    {bookingBalance(booking) > 0 && booking.status === "confirmed" && (
                      <p className="mt-1 text-sm font-medium text-destructive">
                        {money(bookingBalance(booking))} still to pay after your change
                      </p>
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
                    {bookingBalance(booking) > 0 && booking.status === "confirmed" && (
                      <form action={payCustomerBookingBalance}>
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <Button type="submit">
                          Pay {money(bookingBalance(booking))}
                        </Button>
                      </form>
                    )}
                    {canRetryPayment && (
                      <form action={retryCustomerBookingPayment}>
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <Button type="submit">Pay now</Button>
                      </form>
                    )}
                    {canChange && (
                      <Button asChild variant="outline">
                        <Link href={`/account/bookings/${booking.id}/change`}>
                          Change date or time
                        </Link>
                      </Button>
                    )}
                    {canCancel ? (
                      <CustomerCancelBookingButton
                        bookingId={booking.id}
                        facilityName={booking.facilityName}
                        schedule={`${formatBookingDate(booking.startDate, "d MMM yyyy, HH:mm")}–${formatBookingDate(booking.endDate, "HH:mm")}`}
                        refundText={
                          canCancelWithRefund
                            ? `${money(booking.paidAmount)} will be refunded to your card.`
                            : "No payment has been taken, so there is nothing to refund."
                        }
                      />
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
