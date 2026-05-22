import { differenceInHours, format } from "date-fns";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cancelCustomerBooking, getCustomerBookings } from "@/actions/bookings";
import { money } from "@/lib/bookings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AccountBookingsPage() {
  const bookings = await getCustomerBookings();

  return (
    <main className="bg-background py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl">My bookings</h1>
            <p className="mt-1 text-muted-foreground">
              View upcoming facility bookings and cancel eligible bookings.
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
              const canCancel =
                booking.status === "confirmed" &&
                differenceInHours(booking.startDate, new Date()) >= 48;
              return (
                <Card key={booking.id}>
                  <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{booking.facilityName}</h2>
                        <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                          {booking.status.replace("_", " ")}
                        </Badge>
                        {booking.recurrence === "weekly" && <Badge variant="outline">Weekly</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {booking.offeringName || "Booking"} · {format(booking.startDate, "d MMM yyyy, HH:mm")} to{" "}
                        {format(booking.endDate, "HH:mm")}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {money(booking.amount)} · {booking.paymentType === "subscription" ? "monthly subscription" : "card payment"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canCancel ? (
                        <form action={cancelCustomerBooking}>
                          <input type="hidden" name="bookingId" value={booking.id} />
                          <Button type="submit" variant="outline">
                            Cancel booking
                          </Button>
                        </form>
                      ) : (
                        <p className="max-w-48 text-sm text-muted-foreground">
                          Contact the Trust for changes or late cancellations.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
