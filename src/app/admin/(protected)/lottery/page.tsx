import Link from "next/link";
import { Ticket, Users, Plus, Pencil, Trophy } from "lucide-react";
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Lottery</h1>
        <p className="mt-1 text-muted-foreground">
          Publish monthly draw results and view ticket holders.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Tickets</CardDescription>
            <CardTitle className="text-3xl">
              {active.reduce((s, t) => s + t.quantity, 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              From {active.length} ticket holder{active.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tickets Sold</CardDescription>
            <CardTitle className="text-3xl">{totalTickets}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-3xl">
              £{(totalRevenue / 100).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All time</p>
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
          <Button asChild>
            <Link href="/admin/lottery/draws/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add draw
            </Link>
          </Button>
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
                  <TableCell>
                    <Badge
                      variant={draw.published ? "default" : "secondary"}
                    >
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

      {/* Ticket holders */}
      {tickets.length === 0 ? (
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto">
              <Ticket
                className="h-12 w-12 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <CardTitle>No ticket holders yet</CardTitle>
            <CardDescription>
              Lottery ticket purchases will appear here once Stripe is configured
              and tickets are sold.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" aria-hidden="true" />
              Ticket Holders
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="hidden md:table-cell">Purchased</TableHead>
                <TableHead className="hidden md:table-cell">Expires</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-medium">{ticket.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {ticket.email}
                  </TableCell>
                  <TableCell>{ticket.quantity}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {format(ticket.purchaseDate, "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {format(ticket.expiryDate, "d MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        ticket.status === "active" ? "default" : "secondary"
                      }
                    >
                      {ticket.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
