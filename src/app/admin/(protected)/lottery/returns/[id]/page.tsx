import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Download, Eye, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LotteryReturnStatus } from "@/components/admin/lottery-return-status";
import {
  addLotteryReturnExpense,
  getLotteryReturn,
  removeLotteryReturnExpense,
  resendLotteryReturn,
  saveLotteryReturnDetails,
  setLotteryReturnSubmitted,
} from "@/actions/lottery-return";
import { EXPENSE_CATEGORIES, formatPounds, lotteryYearLastDay, parsePrizePence } from "@/lib/lottery/return/figures";
import { formatUk } from "@/lib/raffles/time";
import type { LotteryReturnFigures } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const SENT_FIELDS: [keyof LotteryReturnFigures, string][] = [
  ["totalProceedsPence", "proceeds"],
  ["totalExpensesPence", "expenses"],
  ["prizesPence", "prizes"],
  ["balancePence", "balance"],
];

export default async function LotteryReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await getLotteryReturn(id);
  if (!loaded) notFound();
  const { row, figures: f, draws, label, serial, dueBy, finished, paymentCount, settings } = loaded;

  const changedSinceSent = row.figures
    ? SENT_FIELDS.filter(([key]) => row.figures![key] !== f[key]).map(([, name]) => name)
    : [];
  const share = f.totalProceedsPence > 0 ? f.balancePence / f.totalProceedsPence : 0;

  const formRows: [string, string, boolean?][] = [
    ["Date of lottery", f.drawCount ? `${f.drawCount} monthly draws, ${formatUk(new Date(f.firstDrawAt!), "d MMM yyyy")} – ${formatUk(new Date(f.lastDrawAt!), "d MMM yyyy")}` : "No draws yet"],
    ["Tickets on sale", `${formatUk(row.periodStart, "d MMM yyyy")} – ${formatUk(lotteryYearLastDay(row.periodEnd), "d MMM yyyy")}`],
    ["Serial no.", serial],
    ["Sales of tickets", `${formatPounds(f.salesPence)} · ${paymentCount} payment${paymentCount === 1 ? "" : "s"}`],
    ["Other proceeds", formatPounds(f.otherProceedsPence)],
    ["Total proceeds", formatPounds(f.totalProceedsPence), true],
    ["Lottery expenses", formatPounds(f.lotteryExpensesPence)],
    ["Commission to agents/vendors", formatPounds(f.commissionPence)],
    ["Other expenses", `${formatPounds(f.otherExpensesPence)}${f.otherExpensesLabel ? ` (${f.otherExpensesLabel})` : ""}`],
    ["Total expenses", formatPounds(f.totalExpensesPence), true],
    ["Total spent on prizes", formatPounds(f.prizesPence)],
    ["Balance for disposal", `${formatPounds(f.balancePence)} · ${Math.round(share * 100)}%`, true],
  ];

  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/lottery/returns">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All council returns
        </Link>
      </Button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Lottery return {label}</h1>
          <p className="mt-1 text-muted-foreground">
            {settings?.lotteryRegistrationNumber} · {formatUk(row.periodStart, "d MMM yyyy")} – {formatUk(lotteryYearLastDay(row.periodEnd), "d MMM yyyy")} · due to South Hams by{" "}
            <strong className="text-foreground">{formatUk(dueBy, "d MMMM yyyy")}</strong>
          </p>
          <div className="mt-2">
            <LotteryReturnStatus loaded={loaded} />
            {row.emailedAt && row.emailedTo && (
              <span className="ml-2 text-sm text-muted-foreground">to {row.emailedTo} at {formatUk(row.emailedAt, "HH:mm")}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={`/api/admin/lottery/returns/${id}/pdf?view`} target="_blank" rel="noopener">
              <Eye className="h-4 w-4" aria-hidden="true" /> View PDF
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/admin/lottery/returns/${id}/pdf`}>
              <Download className="h-4 w-4" aria-hidden="true" /> Download
            </a>
          </Button>
        </div>
      </div>

      {!finished && (
        <p className="mb-6 max-w-3xl rounded-md border bg-secondary/50 p-4 text-sm">
          This lottery year is still running. The figures update as payments and draws come in, and the return is emailed
          automatically on <strong>{formatUk(row.periodEnd, "d MMMM yyyy")}</strong>. Add expenses below as the Trust pays them.
        </p>
      )}
      {changedSinceSent.length > 0 && (
        <p className="mb-6 flex max-w-3xl items-start gap-2 rounded-md border border-copper-300 bg-copper-50/50 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-copper-700" aria-hidden="true" />
          The {changedSinceSent.join(", ")} changed since this return was emailed. Email it again before it&apos;s signed.
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">The return</CardTitle>
              <CardDescription>As printed on the form. Sales are money received in the year, net of refunds.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="divide-y text-sm">
                {formRows.map(([k, v, strong]) => (
                  <div key={k} className="flex justify-between gap-4 py-2">
                    <dt className={strong ? "font-semibold" : undefined}>{k}</dt>
                    <dd className={`text-right tabular-nums ${strong ? "font-bold" : "font-medium"}`}>{v}</dd>
                  </div>
                ))}
              </dl>
              {share < 0.2 && f.totalProceedsPence > 0 && (
                <p className="mt-3 text-sm text-destructive">Less than 20% of proceeds goes to the Trust&apos;s purposes, the legal minimum.</p>
              )}
              {f.unpricedPrizes.length > 0 && (
                <p className="mt-3 text-sm text-destructive">
                  Not counted as prizes because they aren&apos;t cash amounts: {f.unpricedPrizes.join(", ")}. Edit those draws to give a £ value.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Send and submit</CardTitle>
              <CardDescription>
                The PDF goes to {settings?.emailAddress}. The promoter signs page 1 and two appointed trustees sign page 2, then
                email it to licensing@southhams.gov.uk with their letters of appointment.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <form action={resendLotteryReturn.bind(null, id)}>
                <Button type="submit" variant="outline">
                  <Mail className="h-4 w-4" aria-hidden="true" /> {row.emailedAt ? "Email it again" : "Email it now"}
                </Button>
              </form>
              <form action={setLotteryReturnSubmitted.bind(null, id, !row.submittedAt)}>
                <Button type="submit" variant={row.submittedAt ? "outline" : "default"}>
                  {row.submittedAt ? "Mark as not submitted" : "Mark as submitted to the council"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expenses</CardTitle>
              <CardDescription>
                What the Trust paid to run the lottery this year: the council registration fee, card fees, printing.
                {row.expenses.length > 0 && " Carried over from last year where there was one; check the amounts."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {row.expenses.length === 0 ? (
                <p className="mb-4 text-sm text-muted-foreground">No expenses entered.</p>
              ) : (
                <ul className="mb-4 divide-y text-sm">
                  {row.expenses.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        <span className="font-medium">{e.description || EXPENSE_CATEGORIES[e.category]}</span>
                        <span className="block text-xs text-muted-foreground">{EXPENSE_CATEGORIES[e.category]}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{formatPounds(e.amountPence)}</span>
                        <form action={removeLotteryReturnExpense.bind(null, id, e.id)}>
                          <Button type="submit" variant="ghost" size="icon" aria-label={`Remove ${e.description || "expense"}`}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addLotteryReturnExpense.bind(null, id)} className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="category">Line on the form</Label>
                  <select id="category" name="category" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="lottery">
                    {Object.entries(EXPENSE_CATEGORIES).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">What for</Label>
                  <Input id="description" name="description" placeholder="Registration renewal" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Amount (£)</Label>
                  <Input id="amount" name="amount" inputMode="decimal" placeholder="20.00" required />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" variant="outline">
                    Add expense
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Other details</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={saveLotteryReturnDetails.bind(null, id)} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="otherProceeds">Other proceeds (£)</Label>
                  <Input id="otherProceeds" name="otherProceeds" inputMode="decimal" className="w-40" defaultValue={(row.otherProceedsPence / 100).toFixed(2)} />
                  <p className="text-xs text-muted-foreground">Lottery money not taken through the site, e.g. donations to the lottery.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="purpose">Proceeds allotted for</Label>
                  <Input id="purpose" name="purpose" defaultValue={row.purpose} />
                </div>
                <Button type="submit" variant="outline">
                  Save
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Draws this year</CardTitle>
            </CardHeader>
            <CardContent>
              {draws.length === 0 ? (
                <p className="text-sm text-muted-foreground">No draws yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {draws.map((d) => (
                    <li key={d.id} className="flex justify-between gap-4 py-2">
                      <Link href={`/admin/lottery/draws/${d.id}/edit`} className="underline-offset-4 hover:underline">
                        {formatUk(d.drawDate, "d MMMM yyyy")}
                      </Link>
                      <span className="tabular-nums text-muted-foreground">
                        {d.results.map((r) => r.prize).join(" · ")} ={" "}
                        <strong className="text-foreground">{formatPounds(d.results.reduce((s, r) => s + (parsePrizePence(r.prize) ?? 0), 0))}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
