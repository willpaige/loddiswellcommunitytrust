import { formatBookingDate } from "@/lib/booking-time";
import { money } from "@/lib/bookings";
import { periodLabel } from "@/lib/booking-invoices";
import { markMonthlyInvoicePaidAction, voidMonthlyInvoiceAction } from "@/actions/bookings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";

export type BookingInvoiceRow = {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  sessionCount: number;
  amount: number;
  status: string;
  dueDate: Date;
  hostedUrl: string | null;
  pdfUrl: string | null;
  paidAt: Date | null;
  paidOutOfBand: boolean;
  releasedAt: Date | null;
  revision: number;
};

export function invoiceStatusBadge(invoice: { status: string; dueDate: Date; releasedAt?: Date | null }) {
  const overdue = invoice.status === "open" && invoice.dueDate < new Date();
  if (invoice.releasedAt) return { label: "Released", variant: "destructive" as const };
  if (overdue) return { label: "Overdue", variant: "destructive" as const };
  switch (invoice.status) {
    case "paid":
      return { label: "Paid", variant: "default" as const };
    case "open":
      return { label: "Unpaid", variant: "outline" as const };
    case "void":
      return { label: "Void", variant: "secondary" as const };
    case "uncollectible":
      return { label: "Uncollectible", variant: "destructive" as const };
    default:
      return { label: "Draft", variant: "secondary" as const };
  }
}

// The month-by-month ledger of an invoiced booking: what was billed for which
// sessions, whether it is paid, and the two things the office can do by hand.
export function BookingInvoicesCard({
  invoices,
  graceDays,
}: {
  invoices: BookingInvoiceRow[];
  graceDays: number;
}) {
  return (
    <Card className="mt-6 max-w-4xl">
      <CardHeader>
        <CardTitle>Monthly invoices</CardTitle>
        <CardDescription>
          Invoiced in advance for each month&apos;s sessions. An invoice left unpaid {graceDays} days past
          its due date releases the sessions and ends the booking. Mark an invoice paid when a bank
          transfer arrives.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {invoices.map((invoice) => {
              const badge = invoiceStatusBadge(invoice);
              return (
                <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {periodLabel({ start: invoice.periodStart, end: invoice.periodEnd })}
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {invoice.revision > 0 && (
                        <span className="text-xs text-muted-foreground">reissue {invoice.revision}</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {invoice.sessionCount} session{invoice.sessionCount === 1 ? "" : "s"} · {money(invoice.amount)} ·
                      due {formatBookingDate(invoice.dueDate, "d MMM yyyy")}
                      {invoice.paidAt &&
                        ` · paid ${formatBookingDate(invoice.paidAt, "d MMM yyyy")}${invoice.paidOutOfBand ? " by bank transfer" : ""}`}
                      {invoice.releasedAt && ` · released ${formatBookingDate(invoice.releasedAt, "d MMM yyyy")}`}
                    </p>
                    <p className="mt-1 flex gap-3 text-sm">
                      {invoice.hostedUrl && (
                        <a href={invoice.hostedUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                          View invoice
                        </a>
                      )}
                      {invoice.pdfUrl && (
                        <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                          PDF
                        </a>
                      )}
                    </p>
                  </div>
                  {invoice.status === "open" && (
                    <div className="flex flex-wrap gap-2">
                      <form action={markMonthlyInvoicePaidAction}>
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <PendingSubmitButton idleLabel="Mark paid (bank transfer)" pendingLabel="Marking..." />
                      </form>
                      <form action={voidMonthlyInvoiceAction}>
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Void
                        </Button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
