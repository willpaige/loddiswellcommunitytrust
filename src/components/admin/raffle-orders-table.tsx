"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  refundRaffleOrder,
  resendRaffleTickets,
  updateCashSale,
  voidCashSale,
  type CashSaleState,
  type RaffleOrderRow,
} from "@/actions/raffle-orders";

function money(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function ranges(numbers: number[]) {
  if (numbers.length === 0) return "—";
  const pad = (n: number) => String(n).padStart(4, "0");
  const out: string[] = [];
  let start = numbers[0];
  let prev = numbers[0];
  for (const n of [...numbers.slice(1), Number.NaN]) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    out.push(start === prev ? pad(start) : `${pad(start)}–${pad(prev)}`);
    start = prev = n;
  }
  return out.join(", ");
}

const METHOD: Record<string, string> = { card: "Card", cash: "Cash", cheque: "Cheque", transfer: "Transfer" };

type Dialogs =
  | { kind: "refund"; order: RaffleOrderRow }
  | { kind: "void"; order: RaffleOrderRow }
  | { kind: "edit"; order: RaffleOrderRow }
  | null;

export function RaffleOrdersTable({
  orders,
  locked,
  raffleTitle,
}: {
  orders: RaffleOrderRow[];
  /** True once the draw has run: no refunds or voids. */
  locked: boolean;
  raffleTitle: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function run(fn: () => Promise<void>, done: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setDialog(null);
      setNotice(done);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function printSlip(order: RaffleOrderRow) {
    const w = window.open("", "_blank", "width=420,height=600");
    if (!w) return;
    const doc = w.document;
    doc.title = "Raffle tickets";
    const body = doc.body;
    body.style.fontFamily = "system-ui, sans-serif";
    body.style.padding = "24px";
    const h = doc.createElement("h1");
    h.textContent = raffleTitle;
    h.style.fontSize = "20px";
    const p = doc.createElement("p");
    p.textContent = `${order.name} · ${order.quantity} ticket(s) · ${money(order.amount)}`;
    const n = doc.createElement("p");
    n.textContent = ranges(order.tickets);
    n.style.fontSize = "28px";
    n.style.fontWeight = "700";
    body.append(h, p, n);
    w.print();
  }

  const visible = orders.filter((o) => o.status !== "pending");
  const pending = orders.filter((o) => o.status === "pending");

  return (
    <div className="space-y-3">
      {notice && (
        <p role="status" className="text-sm text-sage-700">
          {notice}
        </p>
      )}
      {pending.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {pending.reduce((s, o) => s + o.quantity, 0)} ticket(s) held in {pending.length} checkout(s) in progress. Released if
          unpaid in 30 minutes.
        </p>
      )}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Tickets</TableHead>
              <TableHead>Numbers</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Via</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No sales yet.
                </TableCell>
              </TableRow>
            )}
            {visible.map((o) => (
              <TableRow key={o.id} className={o.status !== "paid" ? "opacity-60" : undefined}>
                <TableCell>
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-muted-foreground">{[o.email, o.phone].filter(Boolean).join(" · ") || "No contact"}</p>
                  {o.soldBy && <p className="text-xs text-muted-foreground">Sold by {o.soldBy}</p>}
                </TableCell>
                <TableCell>{o.quantity}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {o.status === "paid" ? ranges(o.tickets) : <s>{ranges(o.voidTickets)}</s>}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {money(o.amount - o.refundedAmount)}
                  <span className="block text-xs text-muted-foreground">
                    {o.paidAt ? new Date(o.paidAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
                  </span>
                </TableCell>
                <TableCell>
                  {o.status === "refunded" ? (
                    <Badge variant="secondary">Refunded</Badge>
                  ) : o.status === "void" ? (
                    <Badge variant="secondary">Void</Badge>
                  ) : o.source === "manual" ? (
                    <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">{METHOD[o.paymentMethod]}</Badge>
                  ) : (
                    <span className="text-sm">Card</span>
                  )}
                </TableCell>
                <TableCell>
                  {o.status === "paid" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${o.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {o.email && (
                          <DropdownMenuItem onSelect={() => run(() => resendRaffleTickets(o.id), `Ticket email sent to ${o.email}.`)}>
                            Resend ticket email
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => printSlip(o)}>Print ticket slip</DropdownMenuItem>
                        {o.source === "manual" && (
                          <DropdownMenuItem onSelect={() => setDialog({ kind: "edit", order: o })}>Edit details</DropdownMenuItem>
                        )}
                        {!locked && o.source === "manual" && (
                          <DropdownMenuItem onSelect={() => { setReason(""); setDialog({ kind: "void", order: o }); }}>
                            Void sale
                          </DropdownMenuItem>
                        )}
                        {!locked && o.source === "stripe" && (
                          <DropdownMenuItem onSelect={() => setDialog({ kind: "refund", order: o })}>Refund in full</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialog?.kind === "refund"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund {dialog?.order.name}?</DialogTitle>
            <DialogDescription>
              {dialog && `${money(dialog.order.amount)} goes back to their card through Stripe. Their ${dialog.order.quantity} ticket(s) are voided and go back on sale.`}
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              disabled={busy}
              onClick={() => dialog && run(() => refundRaffleOrder(dialog.order.id), `Refunded ${dialog.order.name}.`)}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.kind === "void"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void {dialog?.order.name}&apos;s cash sale?</DialogTitle>
            <DialogDescription>
              Their tickets are taken out of the draw. The numbers are marked void and never reissued. Give the money back separately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="void-reason">Reason</Label>
            <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. entered twice" />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              disabled={busy || !reason.trim()}
              onClick={() => dialog && run(() => voidCashSale(dialog.order.id, reason), `Voided ${dialog.order.name}'s sale.`)}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Void sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialog?.kind === "edit" && (
        <EditCashSaleDialog order={dialog.order} onClose={() => { setDialog(null); router.refresh(); }} />
      )}
    </div>
  );
}

function EditCashSaleDialog({ order, onClose }: { order: RaffleOrderRow; onClose: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: CashSaleState, data: FormData) => {
      const result = await updateCashSale(order.id, prev, data);
      if (!result.error) onClose();
      return result;
    },
    { error: null }
  );
  const paidOn = order.paidAt ? new Date(order.paidAt).toISOString().slice(0, 10) : "";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit cash sale</DialogTitle>
          <DialogDescription>To change the number of tickets, void this sale and enter it again.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="edit-name">Full name</Label>
            <Input id="edit-name" name="name" defaultValue={order.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-phone">Telephone</Label>
              <Input id="edit-phone" name="phone" type="tel" defaultValue={order.phone ?? ""} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" name="email" type="email" defaultValue={order.email ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-date">Date taken</Label>
              <Input id="edit-date" name="paidOn" type="date" defaultValue={paidOn} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-soldby">Sold by</Label>
              <Input id="edit-soldby" name="soldBy" defaultValue={order.soldBy ?? ""} />
            </div>
          </div>
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
