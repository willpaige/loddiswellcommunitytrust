import Link from "next/link";
import { Radio } from "lucide-react";
import type { PublicRaffle } from "@/lib/raffles/public";
import { getNextRaffleAfter } from "@/lib/raffles/public";
import { winnerNames } from "@/lib/raffles/draw";
import { formatPence, formatTicket } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";
import { TicketChecker } from "@/components/raffles/ticket-checker";
import { RaffleExtras } from "@/components/raffles/raffle-extras";

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

/** Published winners, shown as ticket number and first name + initial. */
export async function RaffleResults({ raffle, compact = false }: { raffle: PublicRaffle; compact?: boolean }) {
  const results = [...(raffle.draw?.results ?? [])].sort((a, b) => a.rank - b.rank);
  const names = await winnerNames(results.map((r) => r.orderId));
  const drawnLabel = raffle.draw ? formatUk(raffle.draw.drawnAt, "EEE d MMMM, h:mmaaa") : "";

  if (compact) {
    const [first, ...rest] = results;
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-600">Drawn {drawnLabel}</p>
          <p className="mt-1 font-serif text-2xl">And the winners are…</p>
        </div>
        {first && (
          <div className="rounded-md border-2 border-copper-600 bg-copper-50 p-4">
            <p className="text-xs font-bold uppercase text-muted-foreground">1st prize · {first.prizeTitle}</p>
            <p className="font-serif text-5xl">{formatTicket(first.ticketNumber)}</p>
            <p className="font-semibold">{names.get(first.orderId)}</p>
          </div>
        )}
        {rest.map((r) => (
          <div key={r.rank} className="flex items-center justify-between rounded-md border px-4 py-3 text-sm">
            <span>
              <strong>{ordinal(r.rank)}</strong> · {r.prizeTitle}
            </span>
            <span className="font-bold">
              {formatTicket(r.ticketNumber)} · {names.get(r.orderId)}
            </span>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          {raffle.soldTickets} tickets · {raffle.entrants} people · {formatPence(raffle.raisedPence)} raised
        </p>
      </div>
    );
  }

  const next = await getNextRaffleAfter(raffle.id);
  return (
    <div className="space-y-8">
      <TicketChecker raffleId={raffle.id} raisedLabel={formatPence(raffle.raisedPence)} />
      {raffle.liveStreamUrl && (
        <a href={raffle.liveStreamUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border p-4 no-underline hover:bg-muted/50">
          <Radio className="h-5 w-5 text-copper-600" aria-hidden="true" />
          <span>
            <strong className="text-foreground">Watch the draw</strong>
            <span className="block text-sm text-muted-foreground">Replay on the Trust&apos;s Facebook page</span>
          </span>
        </a>
      )}
      <div className="rounded-lg border border-sage-200 bg-sage-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-700">Together we raised</p>
        <p className="mt-1 font-serif text-3xl">{formatPence(raffle.raisedPence)}</p>
        <p className="text-sm text-muted-foreground">
          {raffle.soldTickets} tickets · {raffle.entrants} people · for {raffle.causeTitle || "Loddiswell's community facilities"}
        </p>
      </div>
      {next ? (
        <div className="space-y-3 rounded-lg border p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-600">Next up</p>
          <p className="font-serif text-2xl">{next.title}</p>
          <p className="text-sm text-muted-foreground">
            {next.state === "coming_soon" ? `Tickets on sale ${formatUk(next.salesOpenAt, "EEEE d MMMM")}` : `On sale now · draw ${formatUk(next.drawAt, "d MMMM")}`}
          </p>
          <Link href={`/raffles/${next.slug}`} className="inline-flex min-h-11 items-center rounded-md bg-copper-600 px-4 font-semibold text-white no-underline hover:bg-copper-700">
            {next.state === "coming_soon" ? "Take a look" : "Get tickets"}
          </Link>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border p-5">
          <p className="font-semibold">Want to hear about the next raffle?</p>
          <RaffleExtras raffleId="" variant="notify" />
        </div>
      )}
    </div>
  );
}
