import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, EyeOff, Gift, Heart, Radio, Ticket } from "lucide-react";
import { getPreviewRaffleBySlug, getPublicRaffleBySlug } from "@/lib/raffles/public";
import { ticketsRemaining } from "@/lib/raffles/state";
import { formatPence } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";
import { renderSmallPrint } from "@/lib/raffles/small-print";
import { renderRichText, type TiptapJSON } from "@/lib/cms/render";
import { Countdown } from "@/components/raffles/countdown";
import { TicketPicker } from "@/components/raffles/ticket-picker";
import { ShareButtons } from "@/components/raffles/share-buttons";
import { RaffleResults } from "@/components/raffles/raffle-results";
import { RaffleExtras } from "@/components/raffles/raffle-extras";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function parseDescription(raw: string): TiptapJSON | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && parsed.type ? parsed : null;
  } catch {
    return null;
  }
}

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

// The published page, or a draft for someone holding its private preview link.
async function loadRaffle({ params, searchParams }: PageProps) {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  const raffle = await getPublicRaffleBySlug(slug);
  if (raffle) return { raffle, isPreview: false };
  const draft = typeof preview === "string" ? await getPreviewRaffleBySlug(slug, preview) : null;
  return draft ? { raffle: draft, isPreview: true } : null;
}

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const loaded = await loadRaffle(props);
  if (!loaded) return { title: "Raffle" };
  const { raffle, isPreview } = loaded;
  if (isPreview) return { title: `Preview: ${raffle.title}`, robots: { index: false, follow: false } };
  const description =
    raffle.tagline ||
    `${formatPence(raffle.ticketPricePence)} a ticket. Draw ${formatUk(raffle.drawAt, "d MMMM")}. Supporting ${raffle.causeTitle || "Loddiswell's community facilities"}.`;
  return {
    title: raffle.title,
    description,
    openGraph: { title: raffle.title, description, url: `${appUrl()}/raffles/${raffle.slug}` },
  };
}

export default async function RafflePage(props: PageProps) {
  const loaded = await loadRaffle(props);
  if (!loaded) notFound();
  const { raffle, isPreview } = loaded;

  const { state } = raffle;
  const remaining = ticketsRemaining(raffle);
  const description = parseDescription(raffle.description);
  const url = `${appUrl()}/raffles/${raffle.slug}`;
  const [firstPrize, ...otherPrizes] = raffle.prizes;
  const cause = raffle.causeTitle || "Loddiswell's community facilities";
  const heroAlt = [raffle.title, firstPrize?.title, `${formatPence(raffle.ticketPricePence)} a ticket`, `draw ${formatUk(raffle.drawAt, "d MMMM")}`]
    .filter(Boolean)
    .join(", ");
  const progress = raffle.maxTickets ? Math.min(100, Math.round((raffle.soldTickets / raffle.maxTickets) * 100)) : null;

  return (
    <div>
      <section className="relative overflow-hidden bg-sage-900 text-sage-50 pt-32 sm:pt-36 pb-12 sm:pb-16">
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
          <div className="min-w-0">
            {isPreview && (
              <p className="mb-6 flex items-start gap-2 rounded-md bg-copper-600 px-4 py-3 text-sm font-semibold text-white">
                <EyeOff className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                Preview only. This raffle isn&apos;t on the website yet, and tickets can&apos;t be bought from this link.
              </p>
            )}
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-300">
              Raffle · Draw {formatUk(raffle.drawAt, "EEE d MMMM, h:mmaaa")}
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">{raffle.title}</h1>
            {raffle.tagline && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-sage-200">{raffle.tagline}</p>}
            {raffle.heroImageUrl ? (
              // Shown at the image's own shape, never cropped, because raffle
              // artwork often has the price and date written on it.
              <div className="mt-8 overflow-hidden rounded-lg bg-sage-800">
                <Image
                  src={raffle.heroImageUrl}
                  alt={heroAlt}
                  width={0}
                  height={0}
                  priority
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className={cn("h-auto w-full", raffle.heroImageMobileUrl && "hidden sm:block")}
                />
                {raffle.heroImageMobileUrl && (
                  <Image src={raffle.heroImageMobileUrl} alt={heroAlt} width={0} height={0} priority sizes="100vw" className="h-auto w-full sm:hidden" />
                )}
              </div>
            ) : (
              <div className="relative mt-8 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-sage-800 text-sage-400 sm:aspect-[16/9]">
                <Gift className="h-16 w-16" aria-hidden="true" />
              </div>
            )}
          </div>

          <aside className="lg:pt-10">
            <div className="rounded-lg bg-card p-6 text-foreground shadow-xl sm:p-8 lg:sticky lg:top-28">
              {state === "coming_soon" && (
                <div className="space-y-5">
                  <Countdown target={raffle.salesOpenAt.toISOString()} label="Tickets on sale in" />
                  <p className="text-sm text-muted-foreground">
                    On sale {formatUk(raffle.salesOpenAt, "EEEE d MMMM 'at' h:mmaaa")}, {formatPence(raffle.ticketPricePence)} a ticket.
                  </p>
                  {!isPreview && <RaffleExtras raffleId={raffle.id} variant="notify" />}
                </div>
              )}

              {(state === "live" || state === "last_few") && (
                <div className="space-y-6">
                  {state === "last_few" && remaining !== null && remaining <= Math.max(25, (raffle.maxTickets ?? 0) * 0.1) && (
                    <p className="rounded-md bg-copper-600 px-3 py-2 text-center text-sm font-bold text-white">
                      Only {remaining} ticket{remaining === 1 ? "" : "s"} left
                    </p>
                  )}
                  <Countdown target={raffle.salesCloseAt.toISOString()} label="Sales close in" />
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex justify-between text-sm font-semibold">
                      <span>
                        {raffle.soldTickets}
                        {raffle.maxTickets ? ` of ${raffle.maxTickets}` : ""} tickets sold
                      </span>
                      <span>{formatPence(raffle.raisedPence)} raised</span>
                    </div>
                    {progress !== null && (
                      <div
                        className="h-2.5 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Tickets sold"
                      >
                        <div className="h-full bg-copper-600" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="border-t pt-5">
                    {isPreview ? (
                      <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                        The ticket picker appears here once the raffle is published.
                      </p>
                    ) : (
                      <TicketPicker
                        raffleId={raffle.id}
                        pricePence={raffle.ticketPricePence}
                        quickPicks={raffle.quickPicks}
                        maxPerOrder={raffle.maxPerOrder}
                        remaining={remaining}
                        minAge={raffle.minAge}
                      />
                    )}
                  </div>
                  {!isPreview && <RaffleExtras raffleId={raffle.id} variant="activity" />}
                </div>
              )}

              {(state === "sold_out" || state === "closed") && (
                <div className="space-y-4">
                  <p className="font-serif text-2xl">{state === "sold_out" ? "Sold out!" : "Sales have closed"}</p>
                  <p className="text-muted-foreground">
                    {raffle.soldTickets} tickets, {formatPence(raffle.raisedPence)} raised. Thank you!
                  </p>
                  <div className="rounded-md border p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Draw</p>
                    <p className="mt-1 font-serif text-2xl">{formatUk(raffle.drawAt, "EEE d MMM, h:mmaaa")}</p>
                  </div>
                  {raffle.liveStreamUrl && (
                    <a
                      href={raffle.liveStreamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-copper-600 px-4 font-semibold text-white no-underline hover:bg-copper-700"
                    >
                      <Radio className="h-4 w-4" aria-hidden="true" /> Watch the draw live
                    </a>
                  )}
                </div>
              )}

              {state === "drawn" && <RaffleResults raffle={raffle} compact />}

              {state === "cancelled" && (
                <div className="space-y-3">
                  <p className="font-serif text-2xl">This raffle has been cancelled</p>
                  <p className="text-muted-foreground">Everyone who bought tickets online is being refunded in full.</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      {state === "drawn" && (
        <section className="bg-background py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <RaffleResults raffle={raffle} />
          </div>
        </section>
      )}

      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
          <div className="min-w-0 space-y-10">
            {firstPrize && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-600">The prizes</p>
                <h2 className="mt-2 font-serif text-3xl">{firstPrize.title}</h2>
                {firstPrize.donatedBy && <p className="mt-1 text-muted-foreground">Kindly donated by {firstPrize.donatedBy}</p>}
                {firstPrize.description && <p className="mt-3 text-lg">{firstPrize.description}</p>}
              </div>
            )}
            {raffle.galleryImages.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {raffle.galleryImages.map((src) => (
                  <div key={src} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                    <Image src={src} alt="" fill className="object-cover" sizes="(min-width: 1024px) 20vw, 33vw" />
                  </div>
                ))}
              </div>
            )}
            {description && <div className="prose max-w-none">{renderRichText(description)}</div>}
            {otherPrizes.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {otherPrizes.map((prize) => (
                  <li key={prize.rank} className="flex items-center gap-4 p-4">
                    {prize.imageUrl ? (
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                        <Image src={prize.imageUrl} alt="" fill className="object-cover" sizes="56px" />
                      </div>
                    ) : (
                      <Gift className="h-6 w-6 flex-shrink-0 text-copper-600" aria-hidden="true" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {ordinal(prize.rank)} prize: {prize.title}
                      </p>
                      {(prize.description || prize.donatedBy) && (
                        <p className="text-sm text-muted-foreground">
                          {prize.description}
                          {prize.description && prize.donatedBy ? " · " : ""}
                          {prize.donatedBy ? `Donated by ${prize.donatedBy}` : ""}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-8">
            <div className="flex gap-4 rounded-lg border border-sage-200 bg-sage-50 p-5">
              <Heart className="h-8 w-8 flex-shrink-0 text-sage-600" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-700">Your ticket pays for</p>
                <p className="mt-1 font-semibold">{cause}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatPence(raffle.raisedPence)} raised by this raffle
                  {raffle.causeGoalPence ? ` towards a ${formatPence(raffle.causeGoalPence)} goal` : ""}.
                </p>
              </div>
            </div>
            {!isPreview && (
              <div className="space-y-3">
                <h2 className="font-serif text-xl">Tell the village</h2>
                <ShareButtons url={url} text={`${raffle.title}: ${formatPence(raffle.ticketPricePence)} a ticket, all for ${cause}!`} />
              </div>
            )}
            <div className="flex gap-4 rounded-lg border p-5">
              <CalendarClock className="h-6 w-6 flex-shrink-0 text-copper-600" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-semibold">Draw {formatUk(raffle.drawAt, "EEEE d MMMM 'at' h:mmaaa")}</p>
                <p className="text-muted-foreground">
                  {raffle.liveStreamUrl ? "Drawn live on the Trust's Facebook page. " : ""}Every entrant is emailed the results.
                </p>
              </div>
            </div>
            <div className="flex gap-4 rounded-lg border border-copper-200 bg-copper-50 p-5">
              <Ticket className="h-6 w-6 flex-shrink-0 text-copper-600" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-semibold">Fancy a chance every month?</p>
                <p className="text-muted-foreground">
                  The Community Lottery is £1 a month, drawn monthly.{" "}
                  <Link href="/lottery" className="text-copper-700 underline">
                    Join the lottery
                  </Link>
                </p>
              </div>
            </div>
            <RaffleExtras raffleId={raffle.id} variant="winners" />
          </div>
        </div>
      </section>

      <section className="border-t bg-background py-10">
        <div className="mx-auto max-w-3xl px-4 text-xs leading-relaxed text-muted-foreground sm:px-6 lg:px-8">
          <p>{renderSmallPrint(raffle.smallPrint, raffle)}</p>
          <p className="mt-3">
            {raffle.minAge}+ only. Read the{" "}
            <Link href="/raffles/terms" className="text-copper-700 underline">
              raffle terms &amp; conditions
            </Link>
            . Please gamble responsibly. Free, confidential advice is available from{" "}
            <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="text-copper-700 underline">
              BeGambleAware.org
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
