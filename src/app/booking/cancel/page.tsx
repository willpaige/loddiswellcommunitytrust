import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BookingCancelPage() {
  return (
    <main className="bg-background py-16">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Booking not completed</CardTitle>
          <CardDescription>
            No payment was taken. Choose another time or restart the booking when ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild>
            <Link href="/booking">Return to booking</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/contact">Contact us</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
