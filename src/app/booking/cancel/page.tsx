import Link from "next/link";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { bookings, facilities } from "@/lib/db/schema";
import { formatBookingDate } from "@/lib/booking-time";
import { money } from "@/lib/bookings";

export const dynamic = "force-dynamic";

// Where Stripe sends a customer who leaves checkout without paying. An
// unpaid online booking is held until its paymentDueAt, so say so and give
// them a way back to pay.
export default async function BookingCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string }>;
}) {
  const { booking_id: bookingId } = await searchParams;
  const [booking] = bookingId
    ? await db
        .select({
          id: bookings.id,
          status: bookings.status,
          amount: bookings.amount,
          startDate: bookings.startDate,
          endDate: bookings.endDate,
          paymentDueAt: bookings.paymentDueAt,
          releasedUnpaidAt: bookings.releasedUnpaidAt,
          facilityName: facilities.name,
        })
        .from(bookings)
        .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
        .where(eq(bookings.id, bookingId))
        .limit(1)
    : [];

  const held = booking?.status === "pending_payment" && booking.paymentDueAt;
  const released = booking?.status === "cancelled" && booking.releasedUnpaidAt;
  const when = booking
    ? `${formatBookingDate(booking.startDate, "EEEE d MMMM yyyy, HH:mm")}–${formatBookingDate(booking.endDate, "HH:mm")}`
    : "";

  return (
    <main className="bg-background px-4 py-16">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>{released ? "Booking released" : "Payment not completed"}</CardTitle>
          <CardDescription>
            {held
              ? `No payment was taken. We're holding your booking for ${booking.facilityName} until ${formatBookingDate(booking.paymentDueAt!, "EEEE d MMMM, HH:mm")}. Pay before then to confirm it, or it will be released for others to book.`
              : released
                ? `We didn't receive payment in time, so your booking for ${booking.facilityName} was released. No payment was taken.`
                : "No payment was taken. Choose another time or restart the booking when ready."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {held && (
            <p className="rounded-md bg-muted p-3 text-sm">
              {when}
              <br />
              <span className="font-medium">{money(booking.amount)} to pay</span>
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {held ? (
              <Button asChild>
                <Link href={`/account/bookings/${booking.id}/pay`}>Pay now</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/booking">{released ? "Book again" : "Return to booking"}</Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/contact">Contact us</Link>
            </Button>
          </div>
          {held && (
            <p className="text-xs text-muted-foreground">
              We&apos;ll email you a reminder with a payment link. If you no longer need this booking, you
              don&apos;t need to do anything.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
