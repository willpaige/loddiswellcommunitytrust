import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gift, Radio } from "lucide-react";
import { getRafflePromo } from "@/lib/raffles/promo";
import { formatPence } from "@/lib/raffles/numbers";

const EYEBROW: Record<string, string> = {
  coming_soon: "Village raffle · coming soon",
  live: "Village raffle · on sale now",
  last_few: "Village raffle · last few tickets",
  sold_out: "Village raffle · sold out",
  closed: "Village raffle · sales closed",
};

/**
 * The homepage's raffle block, straight after the hero. The artwork is shown
 * uncropped (raffle posters have the price and date written on them), with a
 * portrait version on phones when one was uploaded. Renders nothing when no
 * raffle is being promoted.
 */
export async function RaffleHomeBlock() {
  const promo = await getRafflePromo();
  if (!promo) return null;

  const href = `/raffles/${promo.slug}`;
  const onSale = promo.state === "live" || promo.state === "last_few";
  const target = promo.maxTickets ?? null;
  const goal = promo.causeGoalPence ?? null;
  const progress = target
    ? { value: Math.min(100, Math.round((promo.soldTickets / target) * 100)), text: `${promo.soldTickets} of ${target} tickets sold` }
    : goal
      ? { value: Math.min(100, Math.round((promo.raisedPence / goal) * 100)), text: `${formatPence(promo.raisedPence)} raised of ${formatPence(goal)}` }
      : null;
  const alt = `${promo.title}: ${promo.price} a ticket, ${promo.drawLabel.toLowerCase()}`;

  const primary =
    promo.state === "coming_soon"
      ? { href, label: "Remind me", icon: null }
      : onSale
        ? { href, label: "Get tickets", icon: null }
        : promo.liveStreamUrl
          ? { href: promo.liveStreamUrl, label: "Watch the draw live", icon: Radio, external: true }
          : { href, label: "See the raffle", icon: null };

  return (
    <section className="bg-sage-900 py-14 text-sage-50 sm:py-20" aria-labelledby="home-raffle-title">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12 lg:px-8">
        <Link href={href} className="block overflow-hidden rounded-lg bg-sage-800 no-underline" tabIndex={-1} aria-hidden="true">
          {promo.heroImageUrl ? (
            <>
              <Image
                src={promo.heroImageUrl}
                alt=""
                width={0}
                height={0}
                sizes="(min-width: 1024px) 55vw, 100vw"
                className={promo.heroImageMobileUrl ? "hidden h-auto w-full sm:block" : "h-auto w-full"}
              />
              {promo.heroImageMobileUrl && (
                <Image src={promo.heroImageMobileUrl} alt="" width={0} height={0} sizes="100vw" className="h-auto w-full sm:hidden" />
              )}
            </>
          ) : (
            <div className="flex aspect-[16/9] items-center justify-center text-sage-400">
              <Gift className="h-16 w-16" aria-hidden="true" />
            </div>
          )}
        </Link>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-300">{EYEBROW[promo.state]}</p>
          <h2 id="home-raffle-title" className="mt-3 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            <Link href={href} className="text-sage-50 no-underline hover:underline">
              {promo.title}
            </Link>
          </h2>
          <span className="sr-only">{alt}</span>
          {promo.causeTitle && <p className="mt-3 text-lg text-sage-200">Every ticket helps fund {promo.causeTitle}.</p>}
          {!promo.causeTitle && promo.tagline && <p className="mt-3 text-lg text-sage-200">{promo.tagline}</p>}

          <ul className="mt-6 flex flex-wrap gap-2 text-sm font-semibold" aria-label="Raffle details">
            <li className="rounded-full bg-copper-600 px-3 py-1.5 text-white">{promo.price} a ticket</li>
            <li className="rounded-full border border-sage-500 px-3 py-1.5">{promo.drawLabel}</li>
            <li className="rounded-full border border-sage-500 px-3 py-1.5">{promo.label}</li>
          </ul>

          {progress && onSale && (
            <div className="mt-6 max-w-md">
              <div
                className="h-2.5 overflow-hidden rounded-full bg-sage-700"
                role="progressbar"
                aria-valuenow={progress.value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={progress.text}
              >
                <div className="h-full bg-copper-500" style={{ width: `${progress.value}%` }} />
              </div>
              <p className="mt-2 text-sm text-sage-300">{progress.text}</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={primary.href}
              {...(primary.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-copper-500 px-6 py-3 text-sm font-medium tracking-wide text-white no-underline transition-colors hover:bg-copper-600"
            >
              {primary.icon && <primary.icon className="h-4 w-4" aria-hidden="true" />}
              {primary.label}
              {!primary.icon && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </Link>
            {onSale && (
              <Link
                href={`${href}#prizes`}
                className="inline-flex min-h-11 items-center rounded-sm border border-white/30 px-6 py-3 text-sm font-medium tracking-wide text-white no-underline transition-colors hover:bg-white/10"
              >
                See the prize
              </Link>
            )}
          </div>
          <p className="mt-5 text-xs text-sage-400">
            {promo.minAge}+ only. Please gamble responsibly: BeGambleAware.org
          </p>
        </div>
      </div>
    </section>
  );
}
