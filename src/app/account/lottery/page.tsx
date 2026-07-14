import { format } from "date-fns";
import Link from "next/link";
import { Ticket, Trophy } from "lucide-react";
import {
  createCustomerLotteryPortalSession,
  getCustomerLotteryEntries,
  getCustomerLotteryWins,
} from "@/actions/lottery-portal";
import { money } from "@/lib/bookings";
import { AccountPortalShell } from "@/components/account/portal-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function statusVariant(status: string) {
  return status === "active" ? ("default" as const) : ("secondary" as const);
}

function rankLabel(rank: number) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

export default async function AccountLotteryPage() {
  const [entries, wins] = await Promise.all([
    getCustomerLotteryEntries(),
    getCustomerLotteryWins(),
  ]);

  return (
    <AccountPortalShell
      title="Lottery"
      description="View your lottery entries and manage Stripe-backed subscriptions."
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl">My lottery entries</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Entries are matched to the email address you used to sign in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/lottery#recent-draws">View previous draws</Link>
          </Button>
          <Button asChild>
            <Link href="/lottery">Buy tickets</Link>
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card className="text-center">
          <CardHeader>
            <Ticket className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <CardTitle>No lottery entries yet</CardTitle>
            <CardDescription>
              Active lottery subscriptions and manual entries will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/lottery#recent-draws">View previous draws</Link>
              </Button>
              <Button asChild>
                <Link href="/lottery">Join the lottery</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{entry.name}</h3>
                    <Badge variant={statusVariant(entry.status)}>
                      {entry.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline">{entry.source}</Badge>
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                    <p>
                      {entry.quantity} ticket{entry.quantity === 1 ? "" : "s"}
                    </p>
                    <p>{money(entry.amount)}</p>
                    <p>
                      {entry.billingInterval
                        ? `Billed ${entry.billingInterval}ly`
                        : "Manual entry"}
                    </p>
                    <p>
                      {entry.currentPeriodEnd
                        ? `Renews ${format(entry.currentPeriodEnd, "d MMM yyyy")}`
                        : `Expires ${format(entry.expiryDate, "d MMM yyyy")}`}
                    </p>
                  </div>
                  {entry.cancelAtPeriodEnd && (
                    <p className="mt-2 text-sm text-copper-700">
                      Cancellation scheduled at the end of the current period.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {entry.stripeCustomerId ? (
                    <form action={createCustomerLotteryPortalSession}>
                      <input type="hidden" name="ticketId" value={entry.id} />
                      <Button type="submit" variant="outline">
                        Manage subscription
                      </Button>
                    </form>
                  ) : (
                    <p className="max-w-56 text-sm text-muted-foreground">
                      Contact the Trust to make changes to this entry.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl">Previous wins</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Published draw results matched to your lottery account.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/lottery#recent-draws">View all previous draws</Link>
          </Button>
        </div>

        {wins.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col gap-3 py-8 text-center sm:flex-row sm:items-center sm:text-left">
              <Trophy
                className="mx-auto h-10 w-10 shrink-0 text-muted-foreground sm:mx-0"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">No previous wins found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  When your name appears in a published draw, it will be shown
                  here.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {wins.map((win) => (
              <Card key={`${win.drawId}-${win.rank}`}>
                <CardContent className="flex items-start gap-4 pt-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-copper-100 text-copper-700">
                    <Trophy className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">
                        {format(win.drawDate, "MMMM yyyy")}
                      </h3>
                      <Badge variant="outline">{rankLabel(win.rank)}</Badge>
                      {win.ticketNumber && (
                        <Badge variant="secondary">Ticket #{win.ticketNumber}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Drawn {format(win.drawDate, "d MMM yyyy")}
                    </p>
                    {win.prize && (
                      <p className="mt-3 text-sm font-medium">
                        Prize: {win.prize}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AccountPortalShell>
  );
}
