"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerRaffleInterest } from "@/actions/raffle-interest";

export function NotifyMeForm({ raffleId }: { raffleId: string }) {
  const [state, action, pending] = useActionState(registerRaffleInterest, { ok: false, message: "" });

  if (state.ok) {
    return (
      <p role="status" className="rounded-md bg-sage-50 p-3 text-sm text-sage-800">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="raffleId" value={raffleId} />
      <div aria-hidden="true" className="hidden">
        <label>
          Company <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Label htmlFor={`notify-${raffleId || "next"}`} className="text-sm font-semibold">
        {raffleId ? "Remind me when it opens" : "Email me about the next raffle"}
      </Label>
      <div className="flex gap-2">
        <Input id={`notify-${raffleId || "next"}`} name="email" type="email" required placeholder="you@example.com" className="h-11" autoComplete="email" />
        <Button type="submit" className="h-11 bg-copper-600 text-white hover:bg-copper-700" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Notify me"}
        </Button>
      </div>
      {state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <p className="text-xs text-muted-foreground">One email when tickets go on sale. Nothing else.</p>
    </form>
  );
}
