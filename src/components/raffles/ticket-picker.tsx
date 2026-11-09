"use client";

import { useState } from "react";
import { Loader2, Minus, Plus, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function money(pence: number) {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

export function TicketPicker({
  raffleId,
  pricePence,
  quickPicks,
  maxPerOrder,
  remaining,
  minAge,
}: {
  raffleId: string;
  pricePence: number;
  quickPicks: number[];
  maxPerOrder: number;
  /** Tickets left under the cap, or null when there is no cap. */
  remaining: number | null;
  minAge: number;
}) {
  const max = Math.max(1, Math.min(maxPerOrder, remaining ?? maxPerOrder));
  const tiles = quickPicks.filter((n) => n <= max);
  const [quantity, setQuantity] = useState(() => (tiles.includes(5) ? 5 : tiles[0] ?? 1));
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [optOut, setOptOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsAge = minAge >= 18;
  const total = money(quantity * pricePence);

  async function buy() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/raffles/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raffleId, quantity, ageConfirmed, marketingOptOut: optOut }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl">Choose your tickets</h2>
        <span className="font-semibold">{money(pricePence)} each</span>
      </div>

      {tiles.length > 1 && (
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Quick pick">
          {tiles.slice(0, 4).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={quantity === n}
              onClick={() => setQuantity(n)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-md border-2 bg-card transition-colors",
                quantity === n ? "border-copper-600 bg-copper-50" : "border-border hover:border-copper-300"
              )}
            >
              <span className="text-lg font-bold">{n}</span>
              <span className={cn("text-xs", quantity === n ? "text-copper-700" : "text-muted-foreground")}>
                {money(n * pricePence)}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1}
          aria-label="Fewer tickets"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="min-w-20 text-center" aria-live="polite">
          <p className="font-serif text-3xl">{quantity}</p>
          <p className="text-xs text-muted-foreground">ticket{quantity === 1 ? "" : "s"}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11"
          onClick={() => setQuantity((q) => Math.min(max, q + 1))}
          disabled={quantity >= max}
          aria-label="More tickets"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {remaining !== null && remaining <= maxPerOrder && (
        <p className="text-center text-sm text-copper-700">Only {remaining} left</p>
      )}

      {needsAge && (
        <label className="flex items-start gap-3 text-sm leading-snug">
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[var(--color-copper-600)]"
          />
          <span>I confirm I am 18 or over and live in the UK</span>
        </label>
      )}
      <label className="flex items-start gap-3 text-sm leading-snug text-muted-foreground">
        <input
          type="checkbox"
          checked={optOut}
          onChange={(e) => setOptOut(e.target.checked)}
          className="mt-0.5 h-5 w-5 flex-shrink-0"
        />
        <span>Don&apos;t email me about future raffles</span>
      </label>

      <Button
        type="button"
        size="lg"
        onClick={buy}
        disabled={loading || (needsAge && !ageConfirmed)}
        className="w-full py-6 text-lg bg-copper-600 hover:bg-copper-700 text-white"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Going to payment…
          </>
        ) : (
          <>
            <Ticket className="h-5 w-5" aria-hidden="true" /> Buy {quantity} ticket{quantity === 1 ? "" : "s"} · {total}
          </>
        )}
      </Button>
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Secure payment by Stripe. Card, Apple Pay or Google Pay.
      </p>
    </div>
  );
}
