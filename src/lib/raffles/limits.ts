import { addMonths } from "date-fns";
import type { RafflePrize } from "@/lib/db/schema";

// Small society lottery conditions (Gambling Act 2005, Schedule 11), as we
// understand them. These are config values, not legal advice: CONFIRM THEM
// WITH SOUTH HAMS DISTRICT COUNCIL before relying on them.
export const LOTTERY_LIMITS = {
  /** At least this share of proceeds must go to the society's purposes. */
  minShareToPurposes: 0.2,
  /** Maximum proceeds of a single lottery, in pence. */
  maxProceedsPerLottery: 20_000_00,
  /** Maximum aggregate proceeds of all the society's lotteries in a calendar year, in pence. */
  maxProceedsPerYear: 250_000_00,
  /** A prize may be worth up to this, or 10% of proceeds if greater, in pence. */
  maxPrizeFloor: 25_000_00,
  maxPrizeShare: 0.1,
  /** The return is due within this many months of the draw. */
  returnDueMonths: 3,
};

export type RaffleReturn = {
  ticketsSold: number;
  proceeds: number;
  prizesBought: number;
  prizesDonatedValue: number;
  stripeFees: number;
  otherExpenses: number;
  toPurposes: number;
  shareToPurposes: number;
  maxPrizeValue: number;
  yearProceeds: number;
  dueBy: Date;
  checks: { label: string; ok: boolean }[];
};

/** Everything the council return needs, from figures the system already holds. */
export function computeRaffleReturn(input: {
  prizes: RafflePrize[];
  drawAt: Date;
  otherExpensesPence: number;
  orders: { quantity: number; amount: number; refundedAmount: number; stripeFeePence: number; status: string }[];
  /** All the Trust's lottery and raffle proceeds in the draw's calendar year. */
  yearProceeds: number;
}): RaffleReturn {
  const counted = input.orders.filter((o) => o.status === "paid" || o.status === "refunded");
  const proceeds = counted.reduce((s, o) => s + o.amount - o.refundedAmount, 0);
  const ticketsSold = input.orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.quantity, 0);
  const stripeFees = counted.reduce((s, o) => s + o.stripeFeePence, 0);
  const prizesBought = input.prizes.reduce((s, p) => s + (p.costPence || 0), 0);
  const prizesDonatedValue = input.prizes.reduce((s, p) => s + (p.costPence ? 0 : p.valuePence || 0), 0);
  const toPurposes = proceeds - prizesBought - stripeFees - input.otherExpensesPence;
  const shareToPurposes = proceeds > 0 ? toPurposes / proceeds : 0;
  const maxPrizeValue = Math.max(0, ...input.prizes.map((p) => p.valuePence || 0));
  const maxPrizeAllowed = Math.max(LOTTERY_LIMITS.maxPrizeFloor, proceeds * LOTTERY_LIMITS.maxPrizeShare);

  return {
    ticketsSold,
    proceeds,
    prizesBought,
    prizesDonatedValue,
    stripeFees,
    otherExpenses: input.otherExpensesPence,
    toPurposes,
    shareToPurposes,
    maxPrizeValue,
    yearProceeds: input.yearProceeds,
    dueBy: addMonths(input.drawAt, LOTTERY_LIMITS.returnDueMonths),
    checks: [
      { label: `At least ${LOTTERY_LIMITS.minShareToPurposes * 100}% of proceeds to the Trust's purposes`, ok: shareToPurposes >= LOTTERY_LIMITS.minShareToPurposes },
      { label: "Proceeds of this lottery under £20,000", ok: proceeds <= LOTTERY_LIMITS.maxProceedsPerLottery },
      { label: "All lotteries this calendar year under £250,000", ok: input.yearProceeds <= LOTTERY_LIMITS.maxProceedsPerYear },
      { label: "No prize worth more than £25,000 (or 10% of proceeds if greater)", ok: maxPrizeValue <= maxPrizeAllowed },
    ],
  };
}
