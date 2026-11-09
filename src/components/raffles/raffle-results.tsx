import type { PublicRaffle } from "@/lib/raffles/public";
import { formatTicket } from "@/lib/raffles/numbers";

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

/** Published winners. Fleshed out with names and the ticket checker in the draw step. */
export function RaffleResults({ raffle, compact = false }: { raffle: PublicRaffle; compact?: boolean }) {
  const results = raffle.draw?.results ?? [];
  if (compact) {
    const [first] = results;
    return (
      <div className="space-y-3">
        <p className="font-serif text-2xl">And the winners are…</p>
        {first && (
          <div className="rounded-md border-2 border-copper-600 bg-copper-50 p-4">
            <p className="text-xs font-bold uppercase text-muted-foreground">1st prize · {first.prizeTitle}</p>
            <p className="font-serif text-4xl">{formatTicket(first.ticketNumber)}</p>
          </div>
        )}
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-lg border">
      {results.map((r) => (
        <li key={r.rank} className="flex items-center justify-between p-4">
          <span>
            <strong>{ordinal(r.rank)}</strong> · {r.prizeTitle}
          </span>
          <span className="font-bold">{formatTicket(r.ticketNumber)}</span>
        </li>
      ))}
    </ul>
  );
}
