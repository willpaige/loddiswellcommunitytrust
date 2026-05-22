import { format } from "date-fns";
import { cancelAdminBooking, getAdminBookingSetup, getAdminBookings } from "@/actions/bookings";
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
  const uniqueOfferings = setup.offerings.filter(
    (offering, index, all) =>
      all.findIndex((item) => item.offeringId === offering.offeringId) === index
  );

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bookings</h1>
          <p className="mt-1 text-muted-foreground">
            View customer and manual bookings with payment and confirmation status.
          </p>
        </div>
        <ManualBookingDialog offerings={uniqueOfferings} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All bookings</CardTitle>
          <CardDescription>Newest bookings first.</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking</TableHead>
              <TableHead className="hidden md:table-cell">Customer</TableHead>
              <TableHead className="hidden sm:table-cell">Payment</TableHead>
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
                <TableCell className="hidden md:table-cell">
                  <p>{booking.customerName}</p>
                  <p className="text-sm text-muted-foreground">{booking.customerEmail}</p>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <p>{money(booking.amount)}</p>
                  <p className="text-sm text-muted-foreground">{booking.paymentType}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                    {booking.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {booking.status !== "cancelled" && (
                    <form action={cancelAdminBooking}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Cancel
                      </Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
