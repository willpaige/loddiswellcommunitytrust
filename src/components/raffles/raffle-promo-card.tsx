import Image from "next/image";
import Link from "next/link";
import { Gift } from "lucide-react";
import { getRafflePromo } from "@/lib/raffles/promo";
import { compressRanges } from "@/lib/raffles/numbers";
import { cn } from "@/lib/utils";

/** Who the card is talking to, which sets its opening line. */
export type RaffleAudience = "lottery" | "booker" | null;

const HEADLINES: Record<"lottery" | "booker", string> = {
  lottery: "You're in the lottery. Fancy the raffle too?",
  booker: "Thanks for booking with us. One more way to help: the raffle.",
};

/**
 * Cross-sells the current raffle wherever the lottery is cross-sold. Renders
 * nothing when there is no raffle to promote. With `tickets`, it becomes a
 * "you're in" card listing the person's numbers instead of a sales pitch.
 */
export async function RafflePromoCard({
  className,
  containerClassName,
  eyebrow = "This month's raffle",
  audience = null,
  tickets,
}: {
  className?: string;
  /** Wraps the card, for spacing that should vanish along with it. */
  containerClassName?: string;
  eyebrow?: string;
  audience?: RaffleAudience;
  /** The viewer's ticket numbers in the promoted raffle, if they have any. */
  tickets?: number[];
}) {
  const promo = await getRafflePromo();
  if (!promo) return null;

  const entered = tickets && tickets.length > 0;
  const headline = entered ? "You're in. Good luck!" : audience ? HEADLINES[audience] : null;
  const cta = entered ? (promo.onSale ? "Buy more" : "See the raffle") : promo.cta;

  const card = (
    <Link
      href={`/raffles/${promo.slug}`}
      className={cn(
        "group flex flex-col gap-4 rounded-lg border border-copper-200 bg-copper-50 p-4 no-underline transition-colors hover:border-copper-400 sm:flex-row sm:items-center sm:p-5",
        className
      )}
    >
      {promo.heroImageUrl ? (
        <>
          {/* Phones: the whole poster, uncropped, above the text. */}
          <Image src={promo.heroImageUrl} alt="" width={0} height={0} sizes="100vw" className="h-auto w-full rounded-md sm:hidden" />
          <div className="relative hidden h-24 w-40 flex-shrink-0 overflow-hidden rounded-md bg-copper-100 sm:block">
            <Image src={promo.heroImageUrl} alt="" fill className="object-cover" sizes="160px" />
          </div>
        </>
      ) : (
        <div className="relative hidden h-24 w-24 flex-shrink-0 rounded-md bg-copper-100 sm:block">
          <Gift className="absolute inset-0 m-auto h-8 w-8 text-copper-600" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-700">{eyebrow}</p>
        {headline && <p className="mt-1 font-semibold text-foreground">{headline}</p>}
        <p className={cn("font-serif leading-tight text-foreground", headline ? "mt-0.5 text-lg" : "mt-1 text-xl")}>{promo.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {entered ? (
            <>
              Your {tickets.length === 1 ? "ticket" : `${tickets.length} tickets`}: <strong className="text-foreground">{compressRanges(tickets)}</strong> · {promo.drawLabel}
            </>
          ) : (
            <>
              {promo.price} a ticket · {promo.label}
              {promo.causeTitle ? ` · for ${promo.causeTitle}` : ""}
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{promo.minAge}+ only · BeGambleAware.org</p>
      </div>
      <span className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-md bg-copper-600 px-4 py-2 text-sm font-semibold text-white group-hover:bg-copper-700">
        {cta}
      </span>
    </Link>
  );
  return containerClassName ? <div className={containerClassName}>{card}</div> : card;
}
