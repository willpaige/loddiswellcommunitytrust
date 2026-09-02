import Link from "next/link";
import {
  Ticket,
  Users,
  Plus,
  Pencil,
  Trophy,
  Shuffle,
  UserPlus,
} from "lucide-react";
import { db } from "@/lib/db";
import { lotteryTickets } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/admin/delete-button";
import { LotteryImportDialog } from "@/components/admin/lottery-import-dialog";
import {
  LotterySubscribersTable,
  type SubscriberRow,
} from "@/components/admin/lottery-subscribers-table";
import { getDraws, deleteDraw } from "@/actions/lottery-draws";

async function getLotteryStats() {
  const tickets = await db
    .select()
    .from(lotteryTickets)
    .orderBy(desc(lotteryTickets.createdAt));

  const active = tickets.filter((t) => t.status === "active");
  const totalRevenue = tickets.reduce((sum, t) => sum + t.amount, 0);
  const totalTickets = tickets.reduce((sum, t) => sum + t.quantity, 0);

  return { tickets, active, totalRevenue, totalTickets };
}

export default async function AdminLotteryPage() {
  const [{ tickets, active, totalRevenue, totalTickets }, draws] =
    await Promise.all([getLotteryStats(), getDraws()]);

  const subscriberRows: SubscriberRow[] = tickets.map((t) => {
    const planLabel =
      t.source === "manual"
        ? "Manual"
        : t.billingInterval === "month"
          ? "Monthly"
          : t.billingInterval === "year"
            ? "Yearly"
            : "—";
    const planKey =
      t.source === "manual" ? "manual" : (t.billingInterval ?? "unknown");
    const renews =
      t.source === "stripe" && t.currentPeriodEnd
        ? format(t.currentPeriodEnd, "d MMM yyyy")
        : t.expiryDate
          ? format(t.expiryDate, "d MMM yyyy")
          : "—";
    return {
      id: t.id,
      name: t.name,
      email: t.email,
      quantity: t.quantity,
      source: t.source,
      planLabel,
      planKey,
      renews,
      cancelAtPeriodEnd: t.cancelAtPeriodEnd ?? false,
      status: t.status,
      canCancel: Boolean(
        t.stripeSubscriptionId && t.status === "active" && !t.cancelAtPeriodEnd
      ),
    };
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Lottery</h1>
        <p className="mt-1 text-muted-foreground">
          Subscribers, draws, and notifications.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active tickets</CardDescription>
            <CardTitle className="text-3xl">
              {active.reduce((s, t) => s + t.quantity, 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              From {active.length} subscriber{active.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total tickets sold</CardDescription>
            <CardTitle className="text-3xl">{totalTickets}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              All time, including past subscribers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Most recent invoice total</CardDescription>
            <CardTitle className="text-3xl">
              £{(totalRevenue / 100).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Sum of latest invoice per subscriber
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly draws */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" aria-hidden="true" />
              Monthly draws
            </CardTitle>
            <CardDescription className="mt-1">
              Publish winners and prizes for each monthly draw.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/lottery/draws/random">
                <Shuffle className="h-4 w-4" aria-hidden="true" />
                Random draw
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/lottery/draws/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add draw
              </Link>
            </Button>
          </div>
        </CardHeader>
        {draws.length === 0 ? (
          <CardContent className="text-sm text-muted-foreground">
            No draws published yet.
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Draw date</TableHead>
                <TableHead className="hidden sm:table-cell">Winners</TableHead>
                <TableHead className="hidden md:table-cell">Notified</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draws.map((draw) => (
                <TableRow key={draw.id}>
                  <TableCell className="font-medium">
                    {format(draw.drawDate, "MMMM yyyy")}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {draw.results.length} winner
                    {draw.results.length === 1 ? "" : "s"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {draw.notifiedAt
                      ? format(draw.notifiedAt, "d MMM yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={draw.published ? "default" : "secondary"}>
                      {draw.published ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8"
                      >
                        <Link
                          href={`/admin/lottery/draws/${draw.id}/edit`}
                          title="Edit draw"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </Button>
                      <DeleteButton
                        id={draw.id}
                        action={deleteDraw}
                        label="Delete draw"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Subscribers */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" aria-hidden="true" />
              Subscribers
            </CardTitle>
            <CardDescription className="mt-1">
              Stripe subscriptions and manually-imported subscribers, all in one
              place.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LotteryImportDialog />
            <Button variant="outline" asChild>
              <Link href="/admin/lottery/manual/new">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Add manual
              </Link>
            </Button>
          </div>
        </CardHeader>
        {tickets.length === 0 ? (
          <CardContent className="text-center py-12">
            <Ticket
              className="h-12 w-12 text-muted-foreground mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="font-medium">No subscribers yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Lottery subscriptions and CSV imports will appear here.
            </p>
          </CardContent>
        ) : (
          <LotterySubscribersTable rows={subscriberRows} />
        )}
      </Card>
    </div>
  );
}
