"use client";

import { useState } from "react";
import { Ticket, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Interval = "month" | "year";

export function LotteryCheckoutButton() {
  const [quantity, setQuantity] = useState(1);
  const [interval, setInterval] = useState<Interval>("year");
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, interval }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const perTicketPence = interval === "month" ? 100 : 1200;
  const totalPence = quantity * perTicketPence;
  const totalLabel = `£${(totalPence / 100).toFixed(2)}`;
  const cadenceLabel = interval === "month" ? "per month" : "per year";

  return (
    <div className="space-y-6">
      {/* Cadence toggle */}
      <div
        role="tablist"
        aria-label="Billing cadence"
        className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted/60"
      >
        <button
          type="button"
          role="tab"
          aria-selected={interval === "month"}
          onClick={() => setInterval("month")}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            interval === "month"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Monthly
          <span className="block text-xs text-muted-foreground">
            £1 per ticket
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={interval === "year"}
          onClick={() => setInterval("year")}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            interval === "year"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Yearly
          <span className="block text-xs text-muted-foreground">
            £12 per ticket
          </span>
        </button>
      </div>

      {/* Quantity selector */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          disabled={quantity <= 1}
          aria-label="Decrease quantity"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="text-center min-w-[80px]">
          <p className="text-3xl font-serif">{quantity}</p>
          <p className="text-xs text-muted-foreground">
            ticket{quantity !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setQuantity(Math.min(50, quantity + 1))}
          disabled={quantity >= 50}
          aria-label="Increase quantity"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Total */}
      <p className="text-center text-lg">
        <strong>{totalLabel}</strong>
        <span className="text-sm text-muted-foreground ml-1">
          {cadenceLabel}
        </span>
      </p>

      {/* Checkout button */}
      <Button
        onClick={handleCheckout}
        disabled={loading}
        size="lg"
        className="w-full text-lg py-6 bg-sage-600 hover:bg-sage-700"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Redirecting to payment...
          </>
        ) : (
          <>
            <Ticket className="h-5 w-5" aria-hidden="true" />
            Subscribe — {totalLabel} {cadenceLabel}
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Renews automatically. Cancel any time. Secure payment via Stripe.
      </p>
    </div>
  );
}
