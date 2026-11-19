import { TZDate } from "@date-fns/tz";
import type { LotteryReturnExpense, LotteryReturnFigures } from "@/lib/db/schema";

// The annual South Hams return for the monthly lottery. A lottery year runs
// from 1 August to 31 July (UK time): the first draw was 31 August 2026, and
// the return goes out on 1 August for the year just finished.

const UK = "Europe/London";

/** The first lottery year the Trust has to return. */
export const FIRST_RETURN_YEAR = 2026;

/** 1 August of `startYear`, UK midnight, as an instant. */
export function lotteryYearStart(startYear: number) {
  return new Date(new TZDate(startYear, 7, 1, 0, 0, 0, UK).getTime());
}

export function lotteryYearPeriod(startYear: number) {
  return { start: lotteryYearStart(startYear), end: lotteryYearStart(startYear + 1) };
}

/** The lottery year an instant falls in, by its starting year. */
export function lotteryYearOf(date: Date) {
  const uk = new TZDate(date, UK);
  return uk.getMonth() >= 7 ? uk.getFullYear() : uk.getFullYear() - 1;
}

/** "2026/27" */
export function lotteryYearLabel(periodStart: Date) {
  const y = lotteryYearOf(periodStart);
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}

/** The serial number printed on the return, e.g. "LCL 2026/27". */
export function lotteryReturnSerial(periodStart: Date) {
  return `LCL ${lotteryYearLabel(periodStart)}`;
}

/** Last day of the lottery year (31 July), for "tickets on sale to". */
export function lotteryYearLastDay(periodEnd: Date) {
  return new Date(new TZDate(lotteryYearOf(periodEnd), 6, 31, 0, 0, 0, UK).getTime());
}

/** Three months after the year's last draw: 31 October. */
export function lotteryReturnDueBy(periodEnd: Date) {
  return new Date(new TZDate(lotteryYearOf(periodEnd), 9, 31, 0, 0, 0, UK).getTime());
}

/**
 * A draw's prize as typed in the admin ("£35", "£1,000", "12.50") in pence,
 * or null when it isn't a cash amount ("Hamper").
 */
export function parsePrizePence(prize: string): number | null {
  const match = /^\s*£?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*$/.exec(prize);
  if (!match) return null;
  const pounds = Number(match[1].replace(/,/g, ""));
  const pence = match[2] ? Number(match[2].padEnd(2, "0")) : 0;
  return pounds * 100 + pence;
}

export const EXPENSE_CATEGORIES: Record<LotteryReturnExpense["category"], string> = {
  lottery: "Lottery expenses (tickets, registration etc.)",
  commission: "Commission to agents/vendors (e.g. card fees)",
  other: "Other expenses",
};

export function computeLotteryReturnFigures(input: {
  salesPence: number;
  otherProceedsPence: number;
  draws: { drawDate: Date; results: { prize: string }[] }[];
  expenses: LotteryReturnExpense[];
}): LotteryReturnFigures {
  const draws = [...input.draws].sort((a, b) => a.drawDate.getTime() - b.drawDate.getTime());
  let prizesPence = 0;
  const unpricedPrizes: string[] = [];
  for (const draw of draws) {
    for (const r of draw.results) {
      const pence = parsePrizePence(r.prize);
      if (pence === null) unpricedPrizes.push(r.prize);
      else prizesPence += pence;
    }
  }

  const sum = (category: LotteryReturnExpense["category"]) =>
    input.expenses.filter((e) => e.category === category).reduce((s, e) => s + e.amountPence, 0);
  const lotteryExpensesPence = sum("lottery");
  const commissionPence = sum("commission");
  const otherExpensesPence = sum("other");
  const otherExpensesLabel = input.expenses
    .filter((e) => e.category === "other" && e.description.trim())
    .map((e) => e.description.trim())
    .join(", ");

  const totalProceedsPence = input.salesPence + input.otherProceedsPence;
  const totalExpensesPence = lotteryExpensesPence + commissionPence + otherExpensesPence;

  return {
    drawCount: draws.length,
    firstDrawAt: draws[0]?.drawDate.toISOString() ?? null,
    lastDrawAt: draws.at(-1)?.drawDate.toISOString() ?? null,
    salesPence: input.salesPence,
    otherProceedsPence: input.otherProceedsPence,
    totalProceedsPence,
    lotteryExpensesPence,
    commissionPence,
    otherExpensesPence,
    otherExpensesLabel,
    totalExpensesPence,
    prizesPence,
    balancePence: totalProceedsPence - totalExpensesPence - prizesPence,
    unpricedPrizes,
  };
}

export function formatPounds(pence: number) {
  const sign = pence < 0 ? "-" : "";
  return `${sign}£${(Math.abs(pence) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
