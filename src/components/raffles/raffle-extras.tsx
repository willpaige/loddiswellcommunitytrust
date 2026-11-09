import Link from "next/link";
import { getRecentDrawnRaffles } from "@/lib/raffles/public";
import { winnerNames } from "@/lib/raffles/draw";
import { formatTicket } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";
import { NotifyMeForm } from "@/components/raffles/notify-me-form";
import { ActivityTicker } from "@/components/raffles/activity-ticker";

// Engagement extras on raffle pages: the notify-me sign-up, the live
// "someone just bought" ticker, and recent winners for social proof.
export async function RaffleExtras({ raffleId, variant }: { raffleId: string; variant: "notify" | "activity" | "winners" }) {
  if (variant === "notify") return <NotifyMeForm raffleId={raffleId} />;
  if (variant === "activity") return <ActivityTicker raffleId={raffleId} />;

  const drawn = (await getRecentDrawnRaffles(4)).filter((r) => r.id !== raffleId).slice(0, 3);
  if (drawn.length === 0) return null;
  const firsts = drawn.map((r) => r.draw?.results.find((x) => x.rank === 1)).filter((x): x is NonNullable<typeof x> => !!x);
  const names = await winnerNames(firsts.map((r) => r.orderId));

  return (
    <div className="space-y-3">
      <h2 className="font-serif text-xl">Recent winners</h2>
      <ul className="space-y-2">
        {drawn.map((r) => {
          const first = r.draw?.results.find((x) => x.rank === 1);
          return (
            <li key={r.id}>
              <Link href={`/raffles/${r.slug}`} className="flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm no-underline hover:bg-muted/50">
                <span className="text-foreground">
                  <strong>{formatUk(r.drawAt, "MMMM")}</strong> · {first?.prizeTitle ?? r.title}
                </span>
                {first && (
                  <span className="text-muted-foreground">
                    {formatTicket(first.ticketNumber)} · {names.get(first.orderId)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
