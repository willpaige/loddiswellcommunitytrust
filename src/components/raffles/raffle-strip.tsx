"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Gift, X } from "lucide-react";
import type { RafflePromo } from "@/lib/raffles/promo";
import { cn } from "@/lib/utils";

const KEY = "raffle-strip-dismissed";

const TONES: Record<RafflePromo["tone"], string> = {
  default: "bg-copper-700",
  urgent: "bg-red-700",
  draw: "bg-sage-800",
};

/**
 * The site-wide raffle banner at the top of every page. Dismissing it hides
 * it for that raffle only, so next month's raffle shows again. It comes back
 * once on the day of the draw, then a second dismissal hides it for good.
 */
export function RaffleStrip({ promo }: { promo: RafflePromo }) {
  const [hidden, setHidden] = useState(true);
  const dismissedValue = promo.drawDay ? `${promo.slug}:draw-day` : promo.slug;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      setHidden(stored === dismissedValue || stored === `${promo.slug}:draw-day`);
    } catch {
      setHidden(false);
    }
  }, [dismissedValue, promo.slug]);

  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(KEY, dismissedValue);
    } catch {
      // Storage blocked: it just hides for this visit.
    }
  }

  return (
    <div className={cn("text-white", TONES[promo.tone])}>
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <Link
          href={`/raffles/${promo.slug}`}
          className="group flex min-h-11 min-w-0 flex-1 items-center gap-3 py-1.5 text-sm text-white no-underline"
        >
          <span className="relative hidden h-8 w-14 flex-shrink-0 overflow-hidden rounded-sm bg-white/10 sm:block">
            {promo.heroImageUrl ? (
              <Image src={promo.heroImageUrl} alt="" fill className="object-cover" sizes="56px" />
            ) : (
              <Gift className="absolute inset-0 m-auto h-4 w-4" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 flex-1 leading-snug">
            <strong className="block truncate group-hover:underline sm:inline">{promo.title}</strong>
            <span className="block text-white/90 sm:inline">
              <span className="hidden sm:inline"> · </span>
              {promo.price} a ticket · <strong className="font-semibold text-white">{promo.label}</strong>
              {promo.causeTitle && <span className="hidden lg:inline"> · for {promo.causeTitle}</span>}
            </span>
          </span>
          <span className="flex-shrink-0 whitespace-nowrap font-semibold">{promo.cta} →</span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide raffle banner"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded hover:bg-white/10"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
