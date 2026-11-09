import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/admin/print-button";
import { getRaffleReturn, saveRaffleOtherExpenses, setRaffleReturnSubmitted } from "@/actions/raffle-return";
import { formatUk } from "@/lib/raffles/time";

export const dynamic = "force-dynamic";

function money(pence: number) {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function RaffleReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getRaffleReturn(id);
  if (!data) notFound();
  const { raffle, figures } = data;

  const rows: [string, string][] = [
    ["Dates tickets were on sale", `${formatUk(raffle.salesOpenAt, "d MMM")} – ${formatUk(raffle.salesCloseAt, "d MMM yyyy")}`],
    ["Date of draw", formatUk(raffle.drawAt, "d MMMM yyyy")],
    ["Ticket price", money(raffle.ticketPricePence)],
    ["Tickets sold (after refunds)", String(figures.ticketsSold)],
    ["Total proceeds", money(figures.proceeds)],
    ["Prizes bought by the Trust", money(figures.prizesBought)],
    ["Prizes donated (value)", money(figures.prizesDonatedValue)],
    ["Expenses: Stripe fees", money(figures.stripeFees)],
    ["Expenses: other", money(figures.otherExpenses)],
  ];

  return (
    <div>
      <style>{`@media print { aside, nav { display: none !important; } }`}</style>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground print:hidden">
        <Link href={`/admin/raffles/${id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to {raffle.title}
        </Link>
      </Button>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Lottery return for South Hams</h1>
          <p className="mt-1 text-muted-foreground">
            {raffle.title} · due by <strong className="text-foreground">{formatUk(figures.dueBy, "d MMMM yyyy")}</strong> (3 months after the draw)
            {raffle.returnSubmittedAt && ` · submitted ${formatUk(raffle.returnSubmittedAt, "d MMMM yyyy")}`}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button asChild variant="outline">
            <a href={`/api/admin/raffles/${id}/return`}>
              <Download className="h-4 w-4" aria-hidden="true" /> CSV
            </a>
          </Button>
          <PrintButton label="Print or save as PDF" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">The figures</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2.5">
                  <dt>{label}</dt>
                  <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 py-3 text-base">
                <dt className="font-semibold">To the Trust&apos;s purposes</dt>
                <dd className="font-bold tabular-nums">
                  {money(figures.toPurposes)} · {Math.round(figures.shareToPurposes * 100)}%
                </dd>
              </div>
            </dl>
            <form action={saveRaffleOtherExpenses.bind(null, id)} className="mt-4 flex items-end gap-2 print:hidden">
              <div className="space-y-1">
                <Label htmlFor="other">Other expenses (£), e.g. printing</Label>
                <Input id="other" name="otherExpenses" inputMode="decimal" defaultValue={(figures.otherExpenses / 100).toFixed(2)} className="w-40" />
              </div>
              <Button type="submit" variant="outline">
                Save
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Within the limits?</CardTitle>
              <CardDescription>These thresholds are config values. Confirm them with South Hams District Council.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {figures.checks.map((c) => (
                  <li key={c.label} className="flex items-start gap-2">
                    {c.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-sage-600" aria-hidden="true" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" aria-hidden="true" />
                    )}
                    <span>
                      {c.label}
                      <span className="sr-only">{c.ok ? ": yes" : ": no"}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                All lotteries in {raffle.drawAt.getUTCFullYear()} so far, including the monthly lottery: {money(figures.yearProceeds)}.
              </p>
            </CardContent>
          </Card>
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="text-base">Submit</CardTitle>
              <CardDescription>Print or save as PDF for the council, then mark it as submitted to clear the dashboard reminder.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={setRaffleReturnSubmitted.bind(null, id, !raffle.returnSubmittedAt)}>
                <Button type="submit" variant={raffle.returnSubmittedAt ? "outline" : "default"}>
                  {raffle.returnSubmittedAt ? "Mark as not submitted" : "Mark as submitted to the council"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
