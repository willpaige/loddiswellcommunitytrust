import Link from "next/link";
import { Copy, Gift, Plus } from "lucide-react";
import { getRaffleList, duplicateLatestRaffle } from "@/actions/raffles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RaffleStateBadge } from "@/components/admin/raffle-state-badge";
import { deriveRaffleState } from "@/lib/raffles/state";
import { formatPence } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";

export const dynamic = "force-dynamic";

export default async function AdminRafflesPage() {
  const list = await getRaffleList();
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const raisedThisYear = list
    .filter((r) => r.drawAt >= yearStart)
    .reduce((sum, r) => sum + r.raised, 0);
  const live = list.filter((r) => {
    const state = deriveRaffleState(r, { drawPublished: r.drawPublished, now });
    return state === "live" || state === "last_few";
  }).length;
  const nextDraw = list
    .filter((r) => r.drawAt > now && !r.cancelledAt && r.published)
    .sort((a, b) => a.drawAt.getTime() - b.drawAt.getTime())[0];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Raffles</h1>
          <p className="mt-1 text-muted-foreground">One-off fundraising competitions, each with its own page and draw.</p>
        </div>
        <div className="flex gap-2">
          {list.length > 0 && (
            <form action={duplicateLatestRaffle}>
              <Button type="submit" variant="outline">
                <Copy className="h-4 w-4" aria-hidden="true" /> Duplicate last raffle
              </Button>
            </form>
          )}
          <Button asChild>
            <Link href="/admin/raffles/new">
              <Plus className="h-4 w-4" aria-hidden="true" /> New raffle
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Raised this year</CardDescription>
            <CardTitle className="text-2xl">{formatPence(raisedThisYear)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Live now</CardDescription>
            <CardTitle className="text-2xl">{live}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Next draw</CardDescription>
            <CardTitle className="text-2xl">{nextDraw ? formatUk(nextDraw.drawAt, "d MMM") : "—"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {list.length === 0 ? (
        <Card className="text-center">
          <CardHeader>
            <Gift className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <CardTitle>No raffles yet</CardTitle>
            <CardDescription>Set up your first raffle: prizes, price, dates and small print.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/raffles/new">
                <Plus className="h-4 w-4" aria-hidden="true" /> New raffle
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Raffle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>On sale</TableHead>
                <TableHead>Draw</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Raised</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/admin/raffles/${r.id}`} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      /raffles/{r.slug}
                      {r.featured ? " · featured" : ""}
                    </p>
                  </TableCell>
                  <TableCell>
                    <RaffleStateBadge state={deriveRaffleState(r, { drawPublished: r.drawPublished, now })} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatUk(r.salesOpenAt, "d MMM")} – {formatUk(r.salesCloseAt, "d MMM")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatUk(r.drawAt, "d MMM yyyy")}</TableCell>
                  <TableCell className="text-right">
                    {r.sold}
                    {r.maxTickets ? ` / ${r.maxTickets}` : ""}
                  </TableCell>
                  <TableCell className="text-right">{formatPence(r.raised)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
