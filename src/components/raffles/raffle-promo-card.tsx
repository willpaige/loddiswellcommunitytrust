import Image from "next/image";
import Link from "next/link";
import { Gift } from "lucide-react";
import { getRafflePromo } from "@/lib/raffles/promo";
import { cn } from "@/lib/utils";

/**
 * Cross-sells the current raffle wherever the lottery is cross-sold. Renders
 * nothing when there is no raffle to promote.
 */
export async function RafflePromoCard({
  className,
  containerClassName,
  eyebrow = "This month's raffle",
}: {
  className?: string;
  /** Wraps the card, for spacing that should vanish along with it. */
  containerClassName?: string;
  eyebrow?: string;
}) {
  const promo = await getRafflePromo();
  if (!promo) return null;

  const card = (
    <Link
      href={`/raffles/${promo.slug}`}
      className={cn(
        "group flex items-center gap-4 rounded-lg border border-copper-200 bg-copper-50 p-4 no-underline transition-colors hover:border-copper-400 sm:p-5",
        className
      )}
    >
      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-copper-100 sm:h-24 sm:w-24">
        {promo.heroImageUrl ? (
          <Image src={promo.heroImageUrl} alt="" fill className="object-cover" sizes="96px" />
        ) : (
          <Gift className="absolute inset-0 m-auto h-8 w-8 text-copper-600" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-700">{eyebrow}</p>
        <p className="mt-1 font-serif text-xl leading-tight text-foreground">{promo.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {promo.price} a ticket · {promo.label}
        </p>
      </div>
      <span className="hidden flex-shrink-0 rounded-md bg-copper-600 px-4 py-2 text-sm font-semibold text-white group-hover:bg-copper-700 sm:inline-block">
        {promo.cta}
      </span>
    </Link>
  );
  return containerClassName ? <div className={containerClassName}>{card}</div> : card;
}
