"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, X } from "lucide-react";
import type { RafflePromo } from "@/lib/raffles/promo";

const KEY = "raffle-strip-dismissed";

/**
 * The site-wide raffle banner at the top of every page. Dismissing it hides
 * it for that raffle only, so next month's raffle shows again.
 */
export function RaffleStrip({ promo }: { promo: RafflePromo }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(KEY) === promo.slug);
    } catch {
      setHidden(false);
    }
  }, [promo.slug]);

  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(KEY, promo.slug);
    } catch {
      // Storage blocked: it just hides for this visit.
    }
  }

  return (
    <div className="bg-copper-700 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href={`/raffles/${promo.slug}`}
          className="flex min-h-11 flex-1 items-center gap-2 py-2 text-sm text-white no-underline hover:underline"
        >
          <Gift className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">
            <strong>{promo.title}</strong>
            <span className="hidden sm:inline"> · {promo.price} a ticket</span> · {promo.label}
          </span>
          <span className="ml-auto flex-shrink-0 font-semibold">{promo.cta} →</span>
        </Link>
        <button type="button" onClick={dismiss} aria-label="Hide raffle banner" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded hover:bg-white/10">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
