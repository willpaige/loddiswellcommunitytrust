"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkRaffleTicket, type TicketCheck } from "@/actions/raffle-draws";

export function TicketChecker({ raffleId, raisedLabel }: { raffleId: string; raisedLabel: string }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<TicketCheck | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setResult(await checkRaffleTicket(raffleId, value));
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border p-5">
      <Label htmlFor="ticket-check" className="text-base font-semibold">
        Check your ticket
      </Label>
      <div className="flex gap-2">
        <Input id="ticket-check" inputMode="numeric" placeholder="Ticket number" value={value} onChange={(e) => setValue(e.target.value)} className="h-11" />
        <Button type="submit" variant="outline" className="h-11" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Check"}
        </Button>
      </div>
      <p role="status" className="min-h-5 text-sm">
        {result?.status === "won" && <strong className="text-copper-700">Congratulations! That ticket won {result.prize}. We&apos;ll be in touch.</strong>}
        {result?.status === "lost" && <span className="text-muted-foreground">Not this time. Thanks for helping raise {raisedLabel}.</span>}
        {result?.status === "unknown" && <span className="text-muted-foreground">We can&apos;t find that ticket number in this raffle.</span>}
      </p>
    </form>
  );
}
