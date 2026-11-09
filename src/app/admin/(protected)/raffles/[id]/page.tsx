import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RaffleStateBadge } from "@/components/admin/raffle-state-badge";
import { duplicateRaffle, getRaffleForAdmin } from "@/actions/raffles";
import { deriveRaffleState } from "@/lib/raffles/state";
import { formatPence } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";

export const dynamic = "force-dynamic";

export default async function RaffleDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raffle = await getRaffleForAdmin(id);
  if (!raffle) notFound();
  const state = deriveRaffleState(raffle);

  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/raffles">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Raffles
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{raffle.title}</h1>
            <RaffleStateBadge state={state} />
          </div>
          <p className="mt-1 text-muted-foreground">
            On sale {formatUk(raffle.salesOpenAt, "d MMM, HH:mm")} – {formatUk(raffle.salesCloseAt, "d MMM, HH:mm")} · Draw{" "}
            {formatUk(raffle.drawAt, "EEE d MMM yyyy, HH:mm")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/raffles/${raffle.slug}`} target="_blank">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> View page
            </Link>
          </Button>
          <form action={duplicateRaffle.bind(null, raffle.id)}>
            <Button type="submit" variant="outline">
              <Copy className="h-4 w-4" aria-hidden="true" /> Duplicate
            </Button>
          </form>
          <Button asChild>
            <Link href={`/admin/raffles/${raffle.id}/edit`}>
              <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ticket price</CardDescription>
            <CardTitle className="text-2xl">{formatPence(raffle.ticketPricePence)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tickets sold or held</CardDescription>
            <CardTitle className="text-2xl">
              {raffle.ticketsReserved}
              {raffle.maxTickets ? ` / ${raffle.maxTickets}` : ""}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prizes</CardDescription>
            <CardTitle className="text-2xl">{raffle.prizes.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Age limit</CardDescription>
            <CardTitle className="text-2xl">{raffle.minAge}+</CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
