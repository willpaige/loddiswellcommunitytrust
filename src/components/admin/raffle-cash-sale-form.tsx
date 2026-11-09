"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CashSaleState } from "@/actions/raffle-orders";

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function RaffleCashSaleForm({
  action,
  pricePence,
  minAge,
  today,
  disabledReason,
}: {
  action: (prev: CashSaleState, formData: FormData) => Promise<CashSaleState>;
  pricePence: number;
  minAge: number;
  /** Today's date in the UK, "yyyy-MM-dd". */
  today: string;
  disabledReason?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [quantity, setQuantity] = useState("1");
  const [email, setEmail] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a sale is added, but keep it when there's an error.
  useEffect(() => {
    if (state.added) {
      formRef.current?.reset();
      setQuantity("1");
      setEmail("");
    }
  }, [state]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  const amount = (Math.max(0, Number(quantity) || 0) * pricePence) / 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record cash sale</CardTitle>
        <CardDescription>Tickets sold in person. Numbers come from the same sequence as online sales.</CardDescription>
      </CardHeader>
      <CardContent>
        {disabledReason ? (
          <p className="text-sm text-muted-foreground">{disabledReason}</p>
        ) : (
          <form ref={formRef} onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cash-name">Full name *</Label>
              <Input id="cash-name" name="name" required autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cash-phone">Telephone</Label>
              <Input id="cash-phone" name="phone" type="tel" autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cash-email">Email</Label>
              <Input id="cash-email" name="email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
              <p className="text-xs text-muted-foreground">A phone number or an email (or both), so we can reach them if they win.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cash-qty">Tickets *</Label>
                <Input id="cash-qty" name="quantity" inputMode="numeric" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cash-amount">Amount</Label>
                <Input id="cash-amount" readOnly value={`£${amount.toFixed(2)}`} tabIndex={-1} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cash-method">Paid by</Label>
                <select id="cash-method" name="paymentMethod" defaultValue="cash" className={selectClass}>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="transfer">Bank transfer</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cash-date">Date taken</Label>
                <Input id="cash-date" name="paidOn" type="date" max={today} defaultValue={today} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cash-soldby">Sold by (optional)</Label>
              <Input id="cash-soldby" name="soldBy" placeholder="e.g. quiz night, Sue at the shop" />
            </div>
            {minAge >= 18 && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="ageConfirmed" className="mt-0.5 h-4 w-4" />
                <span>Buyer confirmed they are 18 or over</span>
              </label>
            )}
            <label className={`flex items-start gap-2 text-sm ${email ? "" : "text-muted-foreground"}`}>
              <input type="checkbox" name="emailNumbers" disabled={!email} defaultChecked className="mt-0.5 h-4 w-4" />
              <span>Email their ticket numbers{email ? "" : " (needs an email)"}</span>
            </label>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Add £{amount.toFixed(2)} · allocate numbers
            </Button>
            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
          </form>
        )}
        {state.added && (
          <div role="status" className="mt-4 space-y-2 rounded-md border border-sage-200 bg-sage-50 p-3">
            <p className="text-sm font-semibold">
              Added: {state.added.name} · {state.added.quantity} ticket{state.added.quantity === 1 ? "" : "s"}
            </p>
            <p className="font-serif text-xl">{state.added.numbers}</p>
            <p className="text-xs text-muted-foreground">Write these on the paper stubs, or print a slip from the orders list.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
