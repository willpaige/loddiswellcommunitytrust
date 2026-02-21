"use client";

import { useState } from "react";
import { Ticket, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LotteryCheckoutButton() {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
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

  const total = quantity * 12;

  return (
    <div className="space-y-6">
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
        Total: <strong>£{total}</strong>
        <span className="text-sm text-muted-foreground ml-1">
          for {quantity} ticket{quantity !== 1 ? "s" : ""} / year
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
            Buy {quantity} Ticket{quantity !== 1 ? "s" : ""} — £{total}
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Secure payment via Stripe. You&apos;ll be redirected to complete
        payment.
      </p>
    </div>
  );
}
