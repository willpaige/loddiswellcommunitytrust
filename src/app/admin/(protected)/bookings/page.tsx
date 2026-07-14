import { format } from "date-fns";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { cancelAdminBooking, getAdminBookingSetup, getAdminBookings } from "@/actions/bookings";
import { getBookingRequirementStatuses } from "@/lib/booking-requirements";
import { money } from "@/lib/bookings";
import { ManualBookingDialog } from "@/components/admin/manual-booking-dialog";
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
        <ManualBookingDialog offerings={uniqueOfferings} prices={offeringPrices} />
      </div>

      <Card className="-mx-4 sm:-mx-6 lg:-mx-8">
        <CardHeader className="px-4 sm:px-6 lg:px-8">
          <CardTitle>All bookings</CardTitle>
          <CardDescription>Newest bookings first.</CardDescription>
        </CardHeader>
        <Table className="min-w-[68rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Booking</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Org / event</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>
                  <p className="font-medium">{booking.facilityName}</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.offeringName || "Booking"} · {format(booking.startDate, "d MMM yyyy, HH:mm")}
                  </p>
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
                      className="mt-1"
                    >
                      Invoice: {booking.invoiceStatus === "open" ? "unpaid" : booking.invoiceStatus}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                    {booking.status.replace("_", " ")}
                  </Badge>
                  {requirementStatuses.get(booking.id)?.hasRequirements && (
                    <Badge
                      variant={requirementStatuses.get(booking.id)?.complete ? "outline" : "destructive"}
                      className="mt-1"
                    >
                      Info: {requirementStatuses.get(booking.id)?.complete ? "complete" : "outstanding"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                      <Link href={`/admin/bookings/${booking.id}/edit`} title="Edit booking">
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                    {booking.status !== "cancelled" && (
                      <form action={cancelAdminBooking}>
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Cancel
                        </Button>
                      </form>
                    )}
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
