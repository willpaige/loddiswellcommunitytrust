"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { publishRaffleResults, redrawRafflePrize, retryRaffleDrawEmails, setPrizeCollected } from "@/actions/raffle-draws";
import type { DrawEmailSummary } from "@/lib/raffles/draw";

export type ResultRow = {
  rank: number;
  prizeTitle: string;
  ticketNumber: number;
  winner: { name: string; email: string | null; phone: string | null; source: string } | null;
  collected: boolean;
  history: { ticketNumber: number; reason: string }[];
};

const REASONS = [
  "Winner is under 18",
  "No reply by the claim date",
  "Winner declined the prize",
  "Ticket was refunded or invalid",
];

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
const pad = (n: number) => `#${String(n).padStart(4, "0")}`;

export function RaffleDrawResults({
  raffleId,
  results,
  published,
  recipientCount,
  undelivered,
  noEmail,
}: {
  raffleId: string;
  results: ResultRow[];
  published: boolean;
  /** Distinct email addresses that will be written to. */
  recipientCount: number;
  undelivered: number;
  noEmail: { name: string; phone: string | null; prize: string | null }[];
}) {
  const router = useRouter();
  const [redraw, setRedraw] = useState<ResultRow | null>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DrawEmailSummary | null>(null);

  async function act(fn: () => Promise<{ error: string | null; summary?: DrawEmailSummary }>, after?: () => void) {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.summary) setSummary(result.summary);
    after?.();
    router.refresh();
  }

  const finalReason = reason === "Other" ? other.trim() : reason;

  return (
    <div className="space-y-6">
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prize</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead>Winner (private)</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.rank}>
                  <TableCell>
                    <strong>{ordinal(r.rank)}</strong> · {r.prizeTitle}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-lg font-bold">
                    {r.history.map((h) => (
                      <s key={h.ticketNumber} className="mr-2 text-sm font-normal text-muted-foreground" title={h.reason}>
                        {pad(h.ticketNumber)}
                      </s>
                    ))}
                    {pad(r.ticketNumber)}
                  </TableCell>
                  <TableCell>
                    {r.winner?.name ?? "—"}
                    <span className="block text-xs text-muted-foreground">{r.winner?.source === "manual" ? "Cash sale" : "Card"}</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.winner?.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" aria-hidden="true" /> {r.winner.email}
                      </span>
                    )}
                    {r.winner?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" aria-hidden="true" /> {r.winner.phone}
                      </span>
                    )}
                    {!r.winner?.email && <Badge className="mt-1 bg-amber-100 text-amber-900 hover:bg-amber-100">No email: phone them</Badge>}
                  </TableCell>
                  <TableCell>
                    {r.collected ? (
                      <Badge className="bg-sage-100 text-sage-800 hover:bg-sage-100">Collected</Badge>
                    ) : (
                      <Badge variant="secondary">To claim</Badge>
                    )}
                    {r.history.length > 0 && (
                      <span className="mt-1 block text-xs text-muted-foreground">Redrawn: {r.history[r.history.length - 1].reason}</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button variant="link" size="sm" disabled={busy} onClick={() => act(() => setPrizeCollected(raffleId, r.rank, !r.collected).then(() => ({ error: null })))}>
                      {r.collected ? "Undo collected" : "Mark collected"}
                    </Button>
                    {!r.collected && (
                      <Button variant="link" size="sm" onClick={() => { setError(null); setRedraw(r); }}>
                        Redraw…
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{published ? "Result emails" : "Publish and tell people"}</CardTitle>
            <CardDescription>
              {published
                ? "Results are on the website. Winners got their own email; everyone else got the results."
                : `Puts the results on the website (first name and initial), emails each winner how to claim, emails the other ${Math.max(0, recipientCount - results.filter((r) => r.winner?.email).length)} entrant address(es) the results, and sends the trustees a summary.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary && (
              <dl role="status" className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                <dt>Winner emails</dt>
                <dd className="text-right font-semibold">{summary.winnerEmails}</dd>
                <dt>Results emails</dt>
                <dd className="text-right font-semibold">{summary.resultsEmails}</dd>
                <dt>Trustee summary</dt>
                <dd className="text-right font-semibold">{summary.managerEmail ? "sent" : "already sent"}</dd>
                <dt>Failed</dt>
                <dd className={`text-right font-semibold ${summary.failed ? "text-destructive" : ""}`}>{summary.failed}</dd>
              </dl>
            )}
            {!published ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="h-11 w-full" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Publish results
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Publish the results?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Results go on the website and emails go to {recipientCount} address(es) plus the trustees. This can&apos;t be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => act(() => publishRaffleResults(raffleId))}>Publish and send</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div className="flex items-center gap-2 text-sm text-sage-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Published
              </div>
            )}
            {published && undelivered > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{undelivered} email(s) couldn&apos;t be delivered. Retrying only sends to those addresses.</p>
                <Button variant="outline" disabled={busy} onClick={() => act(() => retryRaffleDrawEmails(raffleId))}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Retry {undelivered} failed
                </Button>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phone these people</CardTitle>
            <CardDescription>Entrants who left no email address. Winners first.</CardDescription>
          </CardHeader>
          <CardContent>
            {noEmail.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everyone left an email.</p>
            ) : (
              <ul className="divide-y text-sm">
                {noEmail.map((p, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2">
                    <span>
                      {p.name}
                      {p.prize && <Badge className="ml-2 bg-copper-100 text-copper-800 hover:bg-copper-100">{p.prize}</Badge>}
                    </span>
                    <span className="text-muted-foreground">{p.phone ?? "no phone"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!redraw} onOpenChange={(open) => !open && setRedraw(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redraw {redraw ? `${ordinal(redraw.rank)} prize` : ""}</DialogTitle>
            <DialogDescription>
              Only if {redraw ? pad(redraw.ticketNumber) : "this winner"} can&apos;t take the prize. A new winner is picked from the frozen pool; the original
              result stays on record.{published ? " The new winner is emailed straight away." : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="redraw-reason">Reason (required)</Label>
            <select
              id="redraw-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
              <option>Other</option>
            </select>
            {reason === "Other" && (
              <input
                aria-label="Explain the reason"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            )}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedraw(null)}>Cancel</Button>
            <Button
              disabled={busy || !finalReason}
              onClick={() => redraw && act(() => redrawRafflePrize(raffleId, redraw.rank, finalReason), () => setRedraw(null))}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Redraw from the pool
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
