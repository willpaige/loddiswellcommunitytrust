import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { getPromotedRaffle, getRecentDrawnRaffles } from "@/lib/raffles/public";
import { formatPence, formatTicket } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";
import { PageHeader } from "@/components/layout/page-header";
import { RaffleExtras } from "@/components/raffles/raffle-extras";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Raffles",
  description: "Monthly raffles raising money for Loddiswell's community facilities.",
};

// /raffles always means "whatever we're running now", so it can go on
// posters and in WhatsApp messages without ever going stale.
export default async function RafflesPage() {
  const promoted = await getPromotedRaffle();
  if (promoted) redirect(`/raffles/${promoted.slug}`);

  const past = await getRecentDrawnRaffles(12);

  return (
    <div>
      <PageHeader
        label="Raffles"
        title="Village raffles"
        subtitle="Monthly prize draws raising money for Loddiswell's community facilities."
      />
      <section className="bg-background py-16">
        <div className="mx-auto max-w-3xl space-y-12 px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border p-6 sm:p-8 text-center space-y-4">
            <Gift className="mx-auto h-10 w-10 text-copper-600" aria-hidden="true" />
            <h2 className="font-serif text-2xl">No raffle on right now</h2>
            <p className="text-muted-foreground">The next one is on its way. Leave your email and we&apos;ll tell you when tickets go on sale.</p>
            <div className="mx-auto max-w-sm text-left">
              <RaffleExtras raffleId="" variant="notify" />
            </div>
          </div>
          {past.length > 0 && (
            <div>
              <h2 className="font-serif text-2xl mb-4">Past raffles</h2>
              <ul className="divide-y rounded-lg border">
                {past.map((r) => (
                  <li key={r.id}>
                    <Link href={`/raffles/${r.slug}`} className="flex items-center justify-between gap-4 p-4 no-underline hover:bg-muted/50">
                      <span>
                        <span className="font-semibold text-foreground">{r.title}</span>
                        <span className="block text-sm text-muted-foreground">
                          Drawn {formatUk(r.drawAt, "d MMMM yyyy")} · {formatPence(r.raisedPence)} raised
                        </span>
                      </span>
                      {r.draw?.results[0] && (
                        <span className="text-sm font-bold text-foreground">{formatTicket(r.draw.results[0].ticketNumber)}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-center text-sm text-muted-foreground">
            Can&apos;t wait? The <Link href="/lottery" className="text-copper-700 underline">Community Lottery</Link> is drawn every month.
          </p>
        </div>
      </section>
    </div>
  );
}
