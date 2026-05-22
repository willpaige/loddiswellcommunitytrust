import Link from "next/link";
import { CheckCircle2, Ticket } from "lucide-react";
import { confirmStripeBooking } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  if (params.session_id) {
    await confirmStripeBooking(params.session_id);
  }

  return (
    <main className="bg-background py-16">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_22rem] lg:px-8">
        <Card>
          <CardHeader>
            <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden="true" />
            <CardTitle className="font-serif text-3xl">Booking confirmed</CardTitle>
            <CardDescription>
              Your payment has been received and the booking has been added to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
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
    </main>
  );
}
