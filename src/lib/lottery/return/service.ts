import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { lotteryDraws, lotteryPayments, lotteryReturns, siteSettings } from "@/lib/db/schema";
import { sendTemplateEmail } from "@/lib/email/send";
import { formatUk } from "@/lib/raffles/time";
import {
  FIRST_RETURN_YEAR,
  computeLotteryReturnFigures,
  formatPounds,
  lotteryReturnDueBy,
  lotteryReturnSerial,
  lotteryYearLabel,
  lotteryYearOf,
  lotteryYearPeriod,
} from "./figures";
import { renderLotteryReturnPdf } from "./pdf";

export type LotteryReturnRow = typeof lotteryReturns.$inferSelect;

/** The return row for a lottery year, created on first use. */
export async function getOrCreateLotteryReturn(startYear: number): Promise<LotteryReturnRow> {
  const { start, end } = lotteryYearPeriod(startYear);
  const [existing] = await db.select().from(lotteryReturns).where(eq(lotteryReturns.periodStart, start)).limit(1);
  if (existing) return existing;

  // Recurring costs (the registration fee, card fees) carry over from the
  // year before as a starting point; the treasurer corrects the amounts.
  const [previous] = await db
    .select({ expenses: lotteryReturns.expenses, purpose: lotteryReturns.purpose })
    .from(lotteryReturns)
    .where(eq(lotteryReturns.periodStart, lotteryYearPeriod(startYear - 1).start))
    .limit(1);
  await db
    .insert(lotteryReturns)
    .values({
      periodStart: start,
      periodEnd: end,
      expenses: (previous?.expenses ?? []).map((e) => ({ ...e, id: crypto.randomUUID() })),
      ...(previous ? { purpose: previous.purpose } : {}),
    })
    .onConflictDoNothing({ target: lotteryReturns.periodStart });
  const [row] = await db.select().from(lotteryReturns).where(eq(lotteryReturns.periodStart, start)).limit(1);
  return row;
}

/** Every lottery year from the first up to the one running now. */
export function lotteryYearsToDate(now = new Date()) {
  const years: number[] = [];
  for (let y = lotteryYearOf(now); y >= FIRST_RETURN_YEAR; y--) years.push(y);
  return years;
}

/** Live figures for a return, from the ledger, the draws and its expense lines. */
export async function loadLotteryReturn(row: LotteryReturnRow) {
  const [[sales], draws, [settings]] = await Promise.all([
    db
      .select({
        total: sql<number>`coalesce(sum(${lotteryPayments.amount} - ${lotteryPayments.refundedAmount}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(lotteryPayments)
      .where(and(gte(lotteryPayments.paidAt, row.periodStart), lt(lotteryPayments.paidAt, row.periodEnd))),
    db
      .select({ id: lotteryDraws.id, drawDate: lotteryDraws.drawDate, results: lotteryDraws.results })
      .from(lotteryDraws)
      .where(and(gte(lotteryDraws.drawDate, row.periodStart), lt(lotteryDraws.drawDate, row.periodEnd)))
      .orderBy(lotteryDraws.drawDate),
    db.select().from(siteSettings).limit(1),
  ]);

  const figures = computeLotteryReturnFigures({
    salesPence: Number(sales?.total ?? 0),
    otherProceedsPence: row.otherProceedsPence,
    draws,
    expenses: row.expenses,
  });
  return {
    row,
    figures,
    draws,
    paymentCount: Number(sales?.count ?? 0),
    settings,
    label: lotteryYearLabel(row.periodStart),
    serial: lotteryReturnSerial(row.periodStart),
    dueBy: lotteryReturnDueBy(row.periodEnd),
    finished: row.periodEnd.getTime() <= Date.now(),
  };
}

export type LoadedLotteryReturn = Awaited<ReturnType<typeof loadLotteryReturn>>;

export async function buildLotteryReturnPdf(loaded: LoadedLotteryReturn) {
  const { row, figures, draws, settings, serial } = loaded;
  return renderLotteryReturnPdf({
    societyName: settings?.legalName || "Loddiswell Playing Fields & Village Hall Trust",
    registrationNumber: settings?.lotteryRegistrationNumber || "SL0269",
    promoterName: settings?.lotteryPromoterName || "",
    promoterAddress: settings?.postalAddress || "",
    daytimePhone: settings?.phoneNumber || "",
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    serial,
    purpose: row.purpose,
    figures,
    draws,
    expenses: row.expenses,
    generatedAt: new Date(),
  });
}

export function lotteryReturnFilename(loaded: LoadedLotteryReturn) {
  return `lottery-return-${loaded.label.replace("/", "-")}.pdf`;
}

/**
 * Emails the filled-in return to the Trust's address and freezes the figures
 * that were sent. `force` sends again after the first time (a resend from the
 * admin); the cron never forces, so it sends each year exactly once.
 */
export async function emailLotteryReturn(row: LotteryReturnRow, opts: { force?: boolean } = {}) {
  if (row.emailedAt && !opts.force) return { sent: false, reason: "already_sent" as const };
  const loaded = await loadLotteryReturn(row);
  const to = loaded.settings?.emailAddress || "hello@loddiswellcommunitytrust.org";
  const pdf = await buildLotteryReturnPdf(loaded);
  const { figures } = loaded;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://loddiswellcommunitytrust.org";

  const warnings: string[] = [];
  if (row.expenses.length === 0) warnings.push("No expenses have been entered for this year. If the Trust paid for anything (registration, card fees, printing), add it before signing.");
  if (figures.unpricedPrizes.length) warnings.push(`Some prizes aren't cash amounts and aren't counted: ${figures.unpricedPrizes.join(", ")}.`);
  if (figures.totalProceedsPence > 0 && figures.balancePence < figures.totalProceedsPence * 0.2) warnings.push("Less than 20% of proceeds went to the Trust's purposes, the legal minimum.");

  const result = await sendTemplateEmail({
    key: "lottery_council_return",
    to,
    variables: {
      period: loaded.label,
      proceeds: formatPounds(figures.totalProceedsPence),
      prizes: formatPounds(figures.prizesPence),
      expenses: formatPounds(figures.totalExpensesPence),
      balance: formatPounds(figures.balancePence),
      dueBy: formatUk(loaded.dueBy, "d MMMM yyyy"),
      adminUrl: `${appUrl}/admin/lottery/returns/${row.id}`,
      warnings: warnings.length ? `\n\nPlease check:\n${warnings.map((w) => `- ${w}`).join("\n")}` : "",
    },
    relatedEntityType: "lottery_return",
    relatedEntityId: row.id,
    dedupe: !opts.force,
    attachments: [{ name: lotteryReturnFilename(loaded), content: pdf, contentType: "application/pdf" }],
  });
  if (!result.sent) return { sent: false, reason: (result as { reason?: string }).reason ?? "not_sent" };

  await db
    .update(lotteryReturns)
    .set({ emailedAt: new Date(), emailedTo: to, figures, updatedAt: new Date() })
    .where(eq(lotteryReturns.id, row.id));
  return { sent: true, to };
}

/**
 * The 1 August job. It runs every day and sends the return for any finished
 * lottery year that hasn't been sent, so a missed run (or an outage on the
 * 1st) catches up the next morning instead of waiting a year.
 */
export async function runLotteryReturnJob(now = new Date()) {
  const results: { year: string; sent: boolean; reason?: string }[] = [];
  for (const year of lotteryYearsToDate(now)) {
    const { end } = lotteryYearPeriod(year);
    if (end.getTime() > now.getTime()) continue; // the year is still running
    const row = await getOrCreateLotteryReturn(year);
    if (row.emailedAt) continue;
    const result = await emailLotteryReturn(row);
    results.push({ year: lotteryYearLabel(row.periodStart), sent: result.sent, reason: "reason" in result ? result.reason : undefined });
  }
  return { results };
}
