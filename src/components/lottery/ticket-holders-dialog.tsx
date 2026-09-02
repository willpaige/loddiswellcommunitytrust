"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { TicketHolder, TicketHolderInput } from "@/actions/lottery-ticket-holders";

type Props = {
  ticketId: string;
  payerName: string;
  holders: TicketHolder[];
  action: (ticketId: string, holders: TicketHolderInput[]) => Promise<void>;
  /** "icon" renders a compact icon button (admin table); "button" a labelled outline button. */
  triggerVariant?: "icon" | "button";
  triggerLabel?: string;
};

export function TicketHoldersDialog({
  ticketId,
  payerName,
  holders,
  action,
  triggerVariant = "button",
  triggerLabel = "Name ticket holders",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(holders.map((h) => [h.id, h.holderName ?? ""]))
  );

  function reset() {
    setLoading(false);
    setError(null);
    setValues(Object.fromEntries(holders.map((h) => [h.id, h.holderName ?? ""])));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await action(
        ticketId,
        holders.map((h) => ({ id: h.id, holderName: values[h.id] ?? "" }))
      );
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save ticket holders");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {triggerVariant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={triggerLabel}
            aria-label={triggerLabel}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="button" variant="outline">
            <Users className="h-4 w-4" aria-hidden="true" />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ticket holders</DialogTitle>
          <DialogDescription>
            Name the person each ticket is for. Leave a ticket blank to keep it in{" "}
            {payerName}&apos;s name. Draw results and emails still go to the
            subscriber&apos;s email address.
          </DialogDescription>
        </DialogHeader>

        {holders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ticket numbers have been issued for this entry yet.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {holders.map((h) => {
                const inputId = `holder-${h.id}`;
                return (
                  <div key={h.id} className="flex items-center gap-3">
                    <Label
                      htmlFor={inputId}
                      className="w-16 shrink-0 font-mono text-sm text-muted-foreground"
                    >
                      #{h.ticketNumber}
                    </Label>
                    <Input
                      id={inputId}
                      value={values[h.id] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [h.id]: e.target.value }))
                      }
                      placeholder={payerName}
                      maxLength={100}
                      autoComplete="off"
                      disabled={loading}
                    />
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
