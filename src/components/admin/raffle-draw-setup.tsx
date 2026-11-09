"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CheckCircle2, AlertTriangle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { startRaffleDraw } from "@/actions/raffle-draws";
import type { DrawReadiness } from "@/lib/raffles/draw";
import { cn } from "@/lib/utils";

type Prize = { rank: number; title: string };

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

function Check({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  return (
    <li className="flex items-start gap-3 border-b py-2.5 text-sm last:border-0">
      <Icon className={cn("mt-0.5 h-5 w-5 flex-shrink-0", ok ? "text-sage-600" : warn ? "text-amber-600" : "text-destructive")} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

export function RaffleDrawSetup({
  raffleId,
  prizes,
  readiness,
  salesCloseLabel,
}: {
  raffleId: string;
  prizes: Prize[];
  readiness: DrawReadiness;
  salesCloseLabel: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(prizes);
  const [onePerPerson, setOnePerPerson] = useState(true);
  const [method, setMethod] = useState<"system" | "physical">("system");
  const [numbers, setNumbers] = useState<string[]>(prizes.map(() => ""));
  const [busy, setBusy] = useState<null | "reveal" | "plain">(null);
  const [error, setError] = useState<string | null>(null);

  function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }

  async function go(mode: "reveal" | "plain") {
    setBusy(mode);
    setError(null);
    const result = await startRaffleDraw({
      raffleId,
      method,
      onePerPerson,
      prizeOrder: order.map((p) => p.rank),
      physicalNumbers: method === "physical" ? numbers.map((n) => Number(n.replace(/[#\s]/g, ""))) : undefined,
    });
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    router.push(mode === "reveal" ? `/admin/raffles/${raffleId}/draw/reveal` : `/admin/raffles/${raffleId}/draw`);
    router.refresh();
  }

  const physicalComplete = method === "system" || numbers.every((n) => n.trim() !== "");

  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 1 · Is the pool ready?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              <Check ok={readiness.salesClosed}>
                {readiness.salesClosed ? `Sales closed ${salesCloseLabel}` : `Sales close ${salesCloseLabel}. Close sales first.`}
              </Check>
              <Check ok={readiness.checkoutsInProgress === 0}>
                {readiness.checkoutsInProgress === 0
                  ? "No checkouts still in progress"
                  : `${readiness.checkoutsInProgress} checkout(s) still in progress. Wait for them to finish or expire (at most 30 minutes), then refresh.`}
              </Check>
              <Check ok={readiness.prizes > 0}>{readiness.prizes > 0 ? `${readiness.prizes} prize(s) set up` : "Add the prizes first (Edit raffle)."}</Check>
              <Check ok>{readiness.cashOrders} cash sale(s) entered ({readiness.cashTickets} tickets). Enter any missing ones now.</Check>
              {readiness.voidTickets > 0 && (
                <Check ok={false} warn>
                  {readiness.voidTickets} refunded or voided ticket(s) left out of the pool
                </Check>
              )}
            </ul>
            <div className="mt-4 grid grid-cols-3 gap-3 rounded-md bg-muted p-3 text-center">
              <div>
                <p className="text-2xl font-bold">{readiness.poolSize}</p>
                <p className="text-xs text-muted-foreground">tickets in the pool</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{readiness.entrants}</p>
                <p className="text-xs text-muted-foreground">entrants</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{readiness.prizes}</p>
                <p className="text-xs text-muted-foreground">prizes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 2 · Prize order</CardTitle>
            <CardDescription>Drawn top to bottom. Move the 1st prize to the bottom to save it till last.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.map((p, i) => (
              <div key={p.rank} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <span className="w-10 font-semibold">{ordinal(p.rank)}</span>
                <span className="flex-1">{p.title}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Draw ${p.title} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Draw ${p.title} later`} disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <label className="flex items-start gap-2 pt-2 text-sm">
              <input type="checkbox" checked={onePerPerson} onChange={(e) => setOnePerPerson(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>
                One prize per person <span className="text-muted-foreground">(skip a number whose holder has already won)</span>
              </span>
            </label>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 3 · How are you drawing?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className={cn("flex gap-3 rounded-md border-2 p-4 text-sm", method === "system" ? "border-sage-600 bg-sage-50" : "border-border")}>
              <input type="radio" name="method" checked={method === "system"} onChange={() => setMethod("system")} className="mt-1" />
              <span>
                <strong>System draw</strong>
                <span className="block text-muted-foreground">
                  The website picks the winning numbers with a secure random generator. Show it on the projector or Facebook Live with the reveal screen.
                </span>
              </span>
            </label>
            <label className={cn("flex gap-3 rounded-md border-2 p-4 text-sm", method === "physical" ? "border-sage-600 bg-sage-50" : "border-border")}>
              <input type="radio" name="method" checked={method === "physical"} onChange={() => setMethod("physical")} className="mt-1" />
              <span>
                <strong>Record a physical draw</strong>
                <span className="block text-muted-foreground">
                  You pulled numbers out of a hat. Type them in; each is checked against the paid tickets.
                </span>
              </span>
            </label>
            {method === "physical" && (
              <div className="space-y-2 pt-2">
                {order.map((p, i) => (
                  <div key={p.rank} className="flex items-center gap-3">
                    <Label htmlFor={`num-${p.rank}`} className="w-40">
                      {ordinal(p.rank)}: {p.title}
                    </Label>
                    <Input
                      id={`num-${p.rank}`}
                      inputMode="numeric"
                      placeholder="Ticket number"
                      value={numbers[i]}
                      onChange={(e) => setNumbers((ns) => ns.map((n, idx) => (idx === i ? e.target.value : n)))}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 4 · Go</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {method === "system" && (
              <Button className="h-12 w-full text-base" disabled={!readiness.ready || !!busy} onClick={() => go("reveal")}>
                {busy === "reveal" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Open reveal screen and draw
              </Button>
            )}
            <Button variant="outline" className="w-full" disabled={!readiness.ready || !physicalComplete || !!busy} onClick={() => go("plain")}>
              {busy === "plain" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {method === "system" ? "Draw without the animation" : "Save the drawn numbers"}
            </Button>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              A raffle can only be drawn once. Winners are saved before the reveal plays, so refreshing or closing the window can&apos;t change the
              result. Use Redraw on the next screen if a winner can&apos;t take their prize.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
