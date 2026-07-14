import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, Ticket } from "lucide-react";
import { getCustomerBookings } from "@/actions/bookings";
import { getCustomerLotteryEntries } from "@/actions/lottery-portal";
import { money } from "@/lib/bookings";
import { AccountPortalShell } from "@/components/account/portal-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AccountOverviewPage() {
  const [bookings, lotteryEntries] = await Promise.all([
    getCustomerBookings(),
    getCustomerLotteryEntries(),
  ]);
  const nextBooking = bookings.find((booking) => booking.status !== "cancelled");
  const activeLotteryEntries = lotteryEntries.filter((entry) => entry.status === "active");
  const activeTicketCount = activeLotteryEntries.reduce((total, entry) => total + entry.quantity, 0);

  return (
    <AccountPortalShell
      title="Your portal"
      description="Manage facility bookings and lottery entries from one place."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CalendarDays className="h-8 w-8 text-copper-500" aria-hidden="true" />
            <CardTitle>Bookings</CardTitle>
            <CardDescription>
              {nextBooking ? "Your next facility booking." : "You do not have any bookings yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {nextBooking ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{nextBooking.facilityName}</p>
                  <Badge variant={nextBooking.status === "confirmed" ? "default" : "secondary"}>
                    {nextBooking.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {nextBooking.offeringName || "Booking"} ·{" "}
                  {format(nextBooking.startDate, "d MMM yyyy, HH:mm")} to{" "}
                  {format(nextBooking.endDate, "HH:mm")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {money(nextBooking.amount)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Book the village hall, pavilion, or tennis courts online.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/account/bookings">View bookings</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/booking">New booking</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Ticket className="h-8 w-8 text-copper-500" aria-hidden="true" />
            <CardTitle>Lottery</CardTitle>
            <CardDescription>
              {activeTicketCount > 0
                ? `${activeTicketCount} active ticket${activeTicketCount === 1 ? "" : "s"}.`
                : "You do not have active lottery tickets yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeLotteryEntries[0] ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{activeLotteryEntries[0].name}</p>
                  <Badge>Active</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeLotteryEntries[0].quantity} ticket
                  {activeLotteryEntries[0].quantity === 1 ? "" : "s"} ·{" "}
                  {money(activeLotteryEntries[0].amount)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Join the community lottery and support local facilities.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/account/lottery">Manage lottery</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/lottery">Join lottery</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AccountPortalShell>
  );
}
