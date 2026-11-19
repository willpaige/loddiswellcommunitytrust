import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listLotteryReturns, saveLotteryRegistration } from "@/actions/lottery-return";
import { formatPounds, lotteryYearLastDay } from "@/lib/lottery/return/figures";
import { LotteryReturnStatus } from "@/components/admin/lottery-return-status";
import { formatUk } from "@/lib/raffles/time";

export const dynamic = "force-dynamic";

export default async function LotteryReturnsPage() {
  const [returns, [settings]] = await Promise.all([listLotteryReturns(), db.select().from(siteSettings).limit(1)]);

  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/lottery">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the lottery
        </Link>
      </Button>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Council returns</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          South Hams needs a small lottery return each year. On 1 August the return for the year just finished
          (1 August to 31 July) is filled in from the lottery records and emailed to{" "}
          <strong className="text-foreground">{settings?.emailAddress || "hello@loddiswellcommunitytrust.org"}</strong> as a PDF ready
          to sign. Add the year&apos;s expenses as they come up so it&apos;s complete. Raffles have their own return on each raffle.
        </p>
      </div>

      <Card className="mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lottery year</TableHead>
              <TableHead className="hidden md:table-cell">Draws</TableHead>
              <TableHead className="text-right">Proceeds</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Prizes</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.map((r) => (
              <TableRow key={r.row.id}>
                <TableCell>
                  <Link href={`/admin/lottery/returns/${r.row.id}`} className="font-medium underline-offset-4 hover:underline">
                    <FileText className="mr-1.5 inline h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {r.label}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {formatUk(r.row.periodStart, "d MMM yyyy")} – {formatUk(lotteryYearLastDay(r.row.periodEnd), "d MMM yyyy")}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">{r.figures.drawCount}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPounds(r.figures.totalProceedsPence)}</TableCell>
                <TableCell className="hidden sm:table-cell text-right tabular-nums">{formatPounds(r.figures.prizesPence)}</TableCell>
                <TableCell className="hidden sm:table-cell text-right tabular-nums">{formatPounds(r.figures.balancePence)}</TableCell>
                <TableCell>
                  <LotteryReturnStatus loaded={r} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Registration</CardTitle>
          <CardDescription>
            Printed at the top of every return. The society&apos;s name, address and daytime phone come from Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveLotteryRegistration} className="grid gap-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="registrationNumber">Registration no.</Label>
              <Input id="registrationNumber" name="registrationNumber" defaultValue={settings?.lotteryRegistrationNumber ?? "SL0269"} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promoterName">Promoter (full name)</Label>
              <Input id="promoterName" name="promoterName" defaultValue={settings?.lotteryPromoterName ?? ""} required />
            </div>
            <Button type="submit" variant="outline">
              Save
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
