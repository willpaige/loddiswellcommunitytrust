import Link from "next/link";
import { CheckCircle2, Ticket } from "lucide-react";
import { confirmStripeBooking, getCustomerBookings } from "@/actions/bookings";
import { formatBookingDate } from "@/lib/booking-time";
import { money } from "@/lib/bookings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; booking_id?: string }>;
}) {
  const params = await searchParams;
  if (params.session_id) {
    await confirmStripeBooking(params.session_id);
  }
  // A monthly-invoiced booking lands here with its first invoice open rather
  // than a completed checkout.
  const invoiced = params.booking_id
    ? (await getCustomerBookings()).find((booking) => booking.id === params.booking_id) ?? null
    : null;
  const invoice = invoiced?.invoice ?? null;

  return (
    <main className="bg-background">
      <section className="bg-sage-800 pb-20 pt-36 sm:pt-44">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_22rem] lg:px-8">
        <Card>
          <CardHeader>
            <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden="true" />
            <CardTitle className="font-serif text-3xl">
              {invoiced ? "Slot reserved" : "Booking confirmed"}
            </CardTitle>
            <CardDescription>
              {invoiced
                ? invoice
                  ? `Your first invoice for ${money(invoice.amount)} has been emailed to you and is due by ${formatBookingDate(invoice.dueDate, "d MMMM yyyy")}. The booking is confirmed once it is paid.`
                  : "Your first invoice is on its way by email. The booking is confirmed once it is paid."
                : "Your payment has been received and the booking has been added to your account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {invoice?.hostedUrl && (
              <Button asChild>
                <a href={invoice.hostedUrl} target="_blank" rel="noreferrer">Pay the invoice</a>
              </Button>
            )}
            <Button asChild variant={invoice?.hostedUrl ? "outline" : "default"}>
              <Link href="/account/bookings">View my bookings</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/booking">Make another booking</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Ticket className="h-8 w-8 text-copper-500" aria-hidden="true" />
            <CardTitle>Support the lottery</CardTitle>
            <CardDescription>
              Help fund community facilities with a Loddiswell Community Lottery ticket.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/lottery">Join the lottery</Link>
            </Button>
          </CardContent>
        </Card>
        </div>
      </section>
    </main>
  );
}
