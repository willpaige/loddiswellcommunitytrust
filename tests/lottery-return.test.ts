import { describe, expect, it } from "vitest";
import {
  computeLotteryReturnFigures,
  lotteryReturnDueBy,
  lotteryYearLastDay,
  lotteryYearLabel,
  lotteryYearOf,
  lotteryYearPeriod,
  parsePrizePence,
} from "@/lib/lottery/return/figures";
import { renderLotteryReturnPdf } from "@/lib/lottery/return/pdf";

describe("lottery year", () => {
  it("runs from 1 August to 1 August, UK midnight", () => {
    const { start, end } = lotteryYearPeriod(2026);
    expect(start.toISOString()).toBe("2026-07-31T23:00:00.000Z");
    expect(end.toISOString()).toBe("2027-07-31T23:00:00.000Z");
    expect(lotteryYearLabel(start)).toBe("2026/27");
  });

  it("puts 31 July in the year ending and 1 August in the next", () => {
    expect(lotteryYearOf(new Date("2027-07-31T22:59:00Z"))).toBe(2026);
    expect(lotteryYearOf(new Date("2027-07-31T23:00:00Z"))).toBe(2027);
  });

  it("is due by 31 October", () => {
    const { end } = lotteryYearPeriod(2026);
    expect(lotteryReturnDueBy(end).toISOString()).toBe("2027-10-30T23:00:00.000Z"); // 31 Oct, UK midnight
    expect(lotteryYearLastDay(end).toISOString()).toBe("2027-07-30T23:00:00.000Z"); // 31 Jul, UK midnight
  });
});

describe("parsePrizePence", () => {
  it.each([
    ["£35", 3500],
    ["35", 3500],
    ["£1,000", 100000],
    ["£12.50", 1250],
    [" £ 7.5 ", 750],
  ])("%s → %i", (input, pence) => expect(parsePrizePence(input)).toBe(pence));

  it("rejects prizes that aren't cash", () => {
    expect(parsePrizePence("Hamper")).toBeNull();
    expect(parsePrizePence("£20 voucher")).toBeNull();
  });
});

describe("computeLotteryReturnFigures", () => {
  const draws = [
    { drawDate: new Date("2026-09-30"), results: [{ prize: "£35" }, { prize: "£20" }] },
    { drawDate: new Date("2026-08-31"), results: [{ prize: "£35" }, { prize: "Hamper" }] },
  ];

  it("totals proceeds, expenses and prizes into the balance", () => {
    const f = computeLotteryReturnFigures({
      salesPence: 190500,
      otherProceedsPence: 500,
      draws,
      expenses: [
        { id: "a", category: "lottery", description: "Registration", amountPence: 2000 },
        { id: "b", category: "commission", description: "Card fees", amountPence: 3150 },
        { id: "c", category: "other", description: "Printing", amountPence: 1200 },
        { id: "d", category: "other", description: "Raffle book", amountPence: 300 },
      ],
    });
    expect(f.totalProceedsPence).toBe(191000);
    expect(f.totalExpensesPence).toBe(6650);
    expect(f.otherExpensesLabel).toBe("Printing, Raffle book");
    expect(f.prizesPence).toBe(9000);
    expect(f.unpricedPrizes).toEqual(["Hamper"]);
    expect(f.balancePence).toBe(191000 - 6650 - 9000);
    expect(f.drawCount).toBe(2);
    expect(f.firstDrawAt).toBe("2026-08-31T00:00:00.000Z");
  });

  it("renders a three-page PDF", async () => {
    const { start, end } = lotteryYearPeriod(2026);
    const figures = computeLotteryReturnFigures({ salesPence: 1000, otherProceedsPence: 0, draws, expenses: [] });
    const pdf = await renderLotteryReturnPdf({
      societyName: "Loddiswell Playing Fields & Village Hall Trust",
      registrationNumber: "SL0269",
      promoterName: "Zoë Crockford 🎉",
      promoterAddress: "Village Hall\r\nTQ7 4RH",
      daytimePhone: "01548 000000",
      periodStart: start,
      periodEnd: end,
      serial: "LCL 2026/27",
      purpose: "Facilities",
      figures,
      draws: draws.map((d) => ({ ...d, results: d.results.map((r, i) => ({ ...r, rank: i + 1 })) })),
      expenses: [],
      generatedAt: new Date(),
    });
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20000);
  });
});
