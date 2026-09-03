import { differenceInHours } from "date-fns";
import { formatBookingDate } from "@/lib/booking-time";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { deleteAdminBooking, getAdminBookingOccurrences, getAdminBookingSetup, getAdminBookings } from "@/actions/bookings";
import { getBookingRequirementStatuses } from "@/lib/booking-requirements";
import { money } from "@/lib/bookings";
import { ManualBookingDialog } from "@/components/admin/manual-booking-dialog";
import { CancelBookingButton } from "@/components/admin/cancel-booking-button";
import { BookingOccurrenceActions } from "@/components/admin/booking-occurrence-actions";
import { DeleteButton } from "@/components/admin/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const [bookings, setup] = await Promise.all([getAdminBookings(), getAdminBookingSetup()]);
  const occurrences = await getAdminBookingOccurrences(bookings.map((booking) => booking.id));
  const occurrencesByBooking = new Map(
    bookings.map((booking) => [booking.id, occurrences.filter((item) => item.bookingId === booking.id)])
  );
  const requirementStatuses = await getBookingRequirementStatuses(bookings.map((b) => b.id));
  const uniqueOfferings = setup.offerings.filter(
    (offering, index, all) =>
      all.findIndex((item) => item.offeringId === offering.offeringId) === index
  );
  const offeringPrices = setup.offerings.map((offering) => ({
    offeringId: offering.offeringId,
    customerGroup: offering.customerGroup,
    amount: offering.amount,
    variableDuration: offering.startTime == null,
  }));

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bookings</h1>
          <p className="mt-1 text-muted-foreground">
            View customer and manual bookings with payment and confirmation status.
          </p>
        </div>
        <ManualBookingDialog
          offerings={uniqueOfferings}
          prices={offeringPrices}
          repeatDiscount={setup.repeatDiscount}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>All bookings</CardTitle>
          <CardDescription>Newest bookings first.</CardDescription>
        </CardHeader>
        <Table className="min-w-[60rem] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%] pl-6">Booking</TableHead>
              <TableHead className="w-[20%]">Customer</TableHead>
              <TableHead className="w-[12%]">Org / event</TableHead>
              <TableHead className="w-[13%]">Payment</TableHead>
              <TableHead className="w-[13%]">Status</TableHead>
              <TableHead className="w-[12%] pr-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="pl-6">
                  <p className="font-medium">{booking.facilityName}</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.offeringName || "Booking"} · {formatBookingDate(booking.startDate, "d MMM yyyy, HH:mm")}
                  </p>
                  {booking.scheduleType === "custom" && (
                    <ul className="mt-2 space-y-1 border-l-2 border-copper-200 pl-3">
                      {occurrencesByBooking.get(booking.id)?.map((occurrence) => (
                        <li key={occurrence.id} className="flex items-center gap-2 text-xs">
                          <span className={occurrence.status === "cancelled" ? "line-through text-muted-foreground" : ""}>
                            {formatBookingDate(occurrence.startDate, "d MMM, HH:mm")}–{formatBookingDate(occurrence.endDate, "HH:mm")}
                            {occurrence.allocatedAmount > 0 && ` · ${money(occurrence.allocatedAmount)}`}
                          </span>
                          {occurrence.refundStatus === "due" && <Badge variant="destructive">Refund due</Badge>}
                          {occurrence.refundStatus === "refunded" && <Badge variant="outline">Refunded</Badge>}
                          <BookingOccurrenceActions
                            occurrenceId={occurrence.id}
                            cancelled={occurrence.status === "cancelled"}
                            refundDue={occurrence.refundStatus === "due"}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
                <TableCell>
                  <p>{booking.customerName}</p>
                  <p className="text-sm text-muted-foreground">{booking.customerEmail}</p>
                </TableCell>
                <TableCell>
                  <p>{booking.organisationName || "—"}</p>
                </TableCell>
                <TableCell>
                  <p>{money(booking.amount)}</p>
                  <p className="text-sm text-muted-foreground">{booking.paymentType}</p>
                  {booking.invoiceStatus && (
                    <Badge
                      variant={booking.invoiceStatus === "paid" ? "default" : "outline"}
                      className="mt-1 max-w-full"
                    >
                      Invoice: {booking.invoiceStatus === "open" ? "unpaid" : booking.invoiceStatus}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex max-w-full flex-col items-start gap-1">
                    <Badge
                      variant={booking.status === "confirmed" ? "default" : "secondary"}
                      className="max-w-full"
                    >
                      {booking.status.replace("_", " ")}
                    </Badge>
                    {requirementStatuses.get(booking.id)?.hasRequirements && (
                      <Badge
                        variant={requirementStatuses.get(booking.id)?.complete ? "outline" : "destructive"}
                        className="max-w-full"
                      >
                        Info: {requirementStatuses.get(booking.id)?.complete ? "complete" : "outstanding"}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="pr-6 text-right align-top">
                  <div className="flex flex-nowrap items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                      <Link
                        href={`/admin/bookings/${booking.id}/edit`}
                        title="Edit booking"
                        aria-label={`Edit booking for ${booking.customerName}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                    {booking.status !== "cancelled" && (
                      <CancelBookingButton
                        bookingId={booking.id}
                        customerName={booking.customerName}
                        facilityName={booking.facilityName}
                        insideCancellationWindow={
                          differenceInHours(booking.startDate, new Date()) <
                          setup.cancellationSettings.noticeHours
                        }
                        canRefund={
                          booking.paymentType === "one_off" &&
                          Boolean(booking.stripePaymentIntentId)
                        }
                      />
                    )}
                    <DeleteButton
                      id={booking.id}
                      action={deleteAdminBooking}
                      label={`Delete booking for ${booking.customerName}`}
                      description="This permanently deletes the booking and its occurrences. When Stripe is configured, active subscriptions are cancelled and unpaid invoices voided. Completed payments are not refunded. This cannot be undone."
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
