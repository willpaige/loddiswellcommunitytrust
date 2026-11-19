import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { LotteryReturnExpense, LotteryReturnFigures } from "@/lib/db/schema";
import { formatUk } from "@/lib/raffles/time";
import { EXPENSE_CATEGORIES, formatPounds, lotteryYearLastDay, parsePrizePence } from "./figures";
import { SHDC_LOGO_PNG_BASE64 } from "./shdc-logo";

// South Hams District Council's "Return by Promoter relating to a Small
// Lottery", redrawn from the paper form and filled in. Page 1 is the form,
// page 2 the certification and the council's notes, page 3 our schedule of
// draws and expenses behind the single whole-year column.

export type LotteryReturnPdfInput = {
  societyName: string;
  registrationNumber: string;
  promoterName: string;
  promoterAddress: string;
  daytimePhone: string;
  periodStart: Date;
  periodEnd: Date;
  serial: string;
  purpose: string;
  figures: LotteryReturnFigures;
  draws: { drawDate: Date; results: { rank: number; prize: string }[] }[];
  expenses: LotteryReturnExpense[];
  generatedAt: Date;
};

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 42;
const INK = rgb(0, 0, 0);
const FILL = rgb(0.1, 0.18, 0.45); // filled-in answers, in "pen" blue
const SHADE = rgb(0.84, 0.84, 0.84);
const MUTED = rgb(0.35, 0.35, 0.35);

type Fonts = { regular: PDFFont; bold: PDFFont };

/** Drop characters Helvetica (WinAnsi) can't draw rather than failing the PDF. */
function safe(font: PDFFont, text: string) {
  let out = "";
  for (const ch of text.replace(/\r\n?/g, "\n")) {
    if (ch === "\n") {
      out += ch;
      continue;
    }
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, width: number) {
  const lines: string[] = [];
  for (const para of safe(font, text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** A page whose drawing calls take y measured down from the top edge. */
class Sheet {
  constructor(
    readonly page: PDFPage,
    readonly f: Fonts
  ) {}

  text(text: string, x: number, top: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}) {
    const size = opts.size ?? 9;
    const font = opts.bold ? this.f.bold : this.f.regular;
    this.page.drawText(safe(font, text), { x, y: A4.h - top - size, size, font, color: opts.color ?? INK });
  }

  /** Wrapped text; returns the height used. */
  para(text: string, x: number, top: number, width: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; leading?: number } = {}) {
    const size = opts.size ?? 9;
    const leading = opts.leading ?? size * 1.25;
    const lines = wrap(opts.bold ? this.f.bold : this.f.regular, text, size, width);
    lines.forEach((line, i) => this.text(line, x, top + i * leading, opts));
    return lines.length * leading;
  }

  /** Text made of bold and regular runs, wrapped as one paragraph. */
  rich(runs: { text: string; bold?: boolean }[], x: number, top: number, width: number, size = 9) {
    const leading = size * 1.3;
    const words = runs.flatMap((r) => r.text.split(/(\s+)/).filter((w) => w && !/^\s+$/.test(w)).map((w) => ({ w, bold: !!r.bold })));
    let cx = x;
    let line = 0;
    const space = this.f.regular.widthOfTextAtSize(" ", size);
    for (const { w, bold } of words) {
      const font = bold ? this.f.bold : this.f.regular;
      const ww = font.widthOfTextAtSize(safe(font, w), size);
      if (cx > x && cx + ww > x + width) {
        line++;
        cx = x;
      }
      this.text(w, cx, top + line * leading, { size, bold });
      cx += ww + space;
    }
    return (line + 1) * leading;
  }

  rect(x: number, top: number, w: number, h: number, opts: { fill?: ReturnType<typeof rgb>; border?: boolean } = {}) {
    this.page.drawRectangle({
      x,
      y: A4.h - top - h,
      width: w,
      height: h,
      color: opts.fill,
      borderColor: opts.border === false ? undefined : INK,
      borderWidth: opts.border === false ? 0 : 0.6,
    });
  }

  line(x1: number, top1: number, x2: number, top2: number, width = 0.6) {
    this.page.drawLine({ start: { x: x1, y: A4.h - top1 }, end: { x: x2, y: A4.h - top2 }, thickness: width, color: INK });
  }
}

function ukDate(d: Date) {
  return formatUk(d, "d MMM yyyy");
}

function bigPounds(pence: number) {
  return formatPounds(pence).replace(/^(-?)£/, "$1");
}

async function drawFormPage(doc: PDFDocument, s: Sheet, input: LotteryReturnPdfInput) {
  const { figures: f } = input;
  const left = MARGIN;
  const right = A4.w - MARGIN;
  const width = right - left;

  const logo = await doc.embedPng(Buffer.from(SHDC_LOGO_PNG_BASE64, "base64"));
  const logoW = 78;
  const logoH = (logo.height / logo.width) * logoW;
  s.page.drawImage(logo, { x: right - logoW, y: A4.h - MARGIN - logoH, width: logoW, height: logoH });

  s.text("GAMBLING ACT 2005", left, 52, { size: 15, bold: true });
  s.text("Schedule 11 to the Gambling Act 2005", left, 74, { size: 11, bold: true });
  s.text("Return by Promoter relating to a Small Lottery", left, 92, { size: 11, bold: true });
  s.para(
    "(This form should be completed by the promoter and sent to the Licensing Dept, South Hams District Council, Follaton House, Plymouth Road, Totnes, TQ9 5NE no later than the end of the third month following the date of the lottery)",
    left,
    110,
    width - logoW - 10,
    { size: 8.5 }
  );

  // ── Society and promoter box ──
  let top = 148;
  const split = left + width * 0.62;
  const rowA = 30;
  const rowB = 66;
  const rowC = 34;
  s.rect(left, top, width, rowA + rowB + rowC);
  s.line(split, top, split, top + rowA + rowB + rowC);
  s.line(left, top + rowA, right, top + rowA);
  s.line(left, top + rowA + rowB, split, top + rowA + rowB);

  s.text("Name of Society", left + 5, top + 5);
  s.para(input.societyName, left + 5, top + 16, split - left - 10, { size: 9.5, bold: true, color: FILL });
  s.text("Registration No.", split + 5, top + 5);
  s.text(input.registrationNumber, split + 5, top + 16, { size: 11, bold: true, color: FILL });

  top += rowA;
  s.text("I, (full name)", left + 5, top + 5);
  s.text(input.promoterName, left + 72, top + 5, { size: 9.5, bold: true, color: FILL });
  s.text("Of (full address)", left + 5, top + 19);
  const address = input.promoterAddress.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(", ");
  s.para(address, left + 82, top + 19, split - left - 88, { size: 9, color: FILL, leading: 11 });
  s.text("Daytime tel no:", split + 5, top + 5);
  s.text(input.daytimePhone, split + 5, top + 18, { size: 10, bold: true, color: FILL });
  s.text("Signature", split + 5, top + rowB - 4);
  s.line(split + 50, top + rowB + 6, right - 6, top + rowB + 6, 0.4);

  top += rowB;
  s.para(
    "being the promoter of the above organisation hereby confirm the proceeds and expenses incurred for the lottery(ies).",
    left + 5,
    top + 5,
    split - left - 10,
    { size: 9 }
  );

  // ── Figures table: a label column and three lottery columns ──
  top += rowC;
  const labelW = width * 0.37;
  const colW = (width - labelW) / 3;
  const colX = (i: number) => left + labelW + colW * i;
  type Row = { label: string; h?: number; bold?: boolean; shade?: boolean; money?: boolean; value?: string; sub?: boolean; heading?: boolean };
  const lastDay = lotteryYearLastDay(input.periodEnd);
  const drawsText =
    f.drawCount > 0 && f.firstDrawAt && f.lastDrawAt
      ? `${f.drawCount} monthly draw${f.drawCount === 1 ? "" : "s"}, ${ukDate(new Date(f.firstDrawAt))} – ${ukDate(new Date(f.lastDrawAt))} (schedule attached)`
      : "No draws held";
  const otherExpensesText = f.otherExpensesLabel ? `${bigPounds(f.otherExpensesPence)}\n${f.otherExpensesLabel}` : bigPounds(f.otherExpensesPence);
  const rows: Row[] = [
    { label: "Date of Lottery", h: 42, value: drawsText },
    { label: "Dates tickets were on sale", heading: true, h: 16 },
    { label: "From", sub: true, value: ukDate(input.periodStart) },
    { label: "To", sub: true, value: ukDate(lastDay) },
    { label: "Serial No. of Lottery", value: input.serial },
    { label: "Sales of tickets", money: true, value: bigPounds(f.salesPence) },
    { label: "Other proceeds", money: true, value: bigPounds(f.otherProceedsPence) },
    { label: "TOTAL PROCEEDS", bold: true, shade: true, money: true, value: bigPounds(f.totalProceedsPence) },
    { label: "Lottery expenses (cost of tickets/registration etc.)", h: 28, money: true, value: bigPounds(f.lotteryExpensesPence) },
    { label: "Commission to Agents/Vendors/etc", h: 28, money: true, value: bigPounds(f.commissionPence) },
    { label: "Other expenses (specify)", h: 52, money: true, value: otherExpensesText },
    { label: "TOTAL EXPENSES", bold: true, money: true, value: bigPounds(f.totalExpensesPence) },
    { label: "Total spent on prizes", money: true, value: bigPounds(f.prizesPence) },
    { label: "BALANCE FOR DISPOSAL", bold: true, shade: true, money: true, value: bigPounds(f.balancePence) },
    { label: "Proceeds allotted for", h: 70, money: true, value: `${bigPounds(f.balancePence)}\n${input.purpose}` },
  ];

  const tableTop = top;
  for (const row of rows) {
    const h = row.h ?? 18;
    if (row.shade) s.rect(left, top, width, h, { fill: SHADE, border: false });
    s.line(left, top + h, right, top + h);
    if (row.heading) {
      s.text(row.label, left + 5, top + 4);
    } else {
      s.para(row.label, left + (row.sub ? 50 : 5), top + 4, labelW - (row.sub ? 55 : 10), { bold: row.bold, size: 9, leading: 10.5 });
      if (row.label === "Proceeds allotted for") s.text("(state purpose & amount)", left + 5, top + 16, { size: 7 });
    }
    if (row.money) {
      for (let i = 0; i < 3; i++) s.text("£", colX(i) + 4, top + 4, { bold: row.bold });
    }
    if (row.value) {
      const [first, ...rest] = row.value.split("\n");
      const x = colX(0) + (row.money ? 14 : 5);
      const w = colW - (row.money ? 18 : 9);
      const used = s.para(first, x, top + 4, w, { size: 9, bold: row.money || row.bold, color: FILL, leading: 10.5 });
      if (rest.length) s.para(rest.join("\n"), colX(0) + 5, top + 5 + used, colW - 9, { size: 7.5, color: FILL, leading: 9 });
    }
    top += h;
  }
  s.rect(left, tableTop, width, top - tableTop);
  for (let i = 0; i < 3; i++) s.line(colX(i), tableTop, colX(i), top);

  s.para(
    "This statement must be signed by two members of the Society who have been appointed in writing by the Society, or its governing body, in accordance with the provision of Schedule 11 of the Gambling Act 2005.",
    left + 20,
    top + 14,
    width - 40,
    { size: 10 }
  );
}

function drawNotesPage(s: Sheet) {
  const left = MARGIN + 14;
  const right = A4.w - MARGIN - 14;
  const width = right - left;
  let top = 50;

  top += s.rich(
    [{ text: "We hereby certify", bold: true }, { text: " that the information given on this return is correct to the best of our knowledge and belief." }],
    left,
    top,
    width,
    10
  );
  top += 10;

  // Two signatures, each with printed name and date.
  const cols = [width * 0.36, width * 0.4, width * 0.24];
  const xs = [left, left + cols[0], left + cols[0] + cols[1]];
  for (let r = 0; r < 2; r++) {
    s.rect(left, top, width, 14, { fill: SHADE, border: false });
    ["Signed", "Please print name", "Date:"].forEach((label, i) => s.text(label, xs[i] + 4, top + 3, { size: 9 }));
    s.rect(left, top, width, 48);
    s.line(left, top + 14, right, top + 14);
    xs.slice(1).forEach((x) => s.line(x, top, x, top + 48));
    top += 48;
  }
  top += 18;

  s.text("NOTE:", left, top, { size: 10, bold: true });
  s.line(left, top + 11, left + s.f.bold.widthOfTextAtSize("NOTE:", 10), top + 11, 0.5);
  top += 18;
  top += s.para("The 2005 Gambling Act sets out a number of offences that apply to lotteries, as follows:", left, top, width, { size: 9.5 });
  top += 6;

  const offences: [string, string][] = [
    ["s. 258", "Promoting a non-exempt lottery without a licence"],
    ["s. 259", "Facilitating a non-exempt lottery without a licence"],
    ["s. 260", "Misusing the profits of a lottery"],
    ["s. 261", "Misusing the profits of an exempt lottery"],
    ["s. 262", "Purporting to operate a small society lottery when not registered, or failing to make the required, or making false or misleading, returns in respect of such lotteries."],
    ["s. 326", "Without reasonable excuse, obstructing or failing to cooperate with an authorised person exercising his/her powers"],
    ["s. 342", "Without reasonable excuse, giving false or misleading information to the Commission or a licensing authority."],
  ];
  const tLeft = left + 10;
  const tW = width * 0.82;
  const c1 = 80;
  const tableTop = top;
  s.rect(tLeft, top, tW, 14, { fill: SHADE, border: false });
  s.text("Section of the Act", tLeft + 4, top + 3, { size: 9 });
  s.text("Offence", tLeft + c1 + 4, top + 3, { size: 9 });
  top += 14;
  for (const [sec, offence] of offences) {
    s.line(tLeft, top, tLeft + tW, top);
    const lines = wrap(s.f.regular, offence, 9, tW - c1 - 8).length;
    s.text(sec, tLeft + 4, top + 2.5, { size: 9 });
    s.para(offence, tLeft + c1 + 4, top + 2.5, tW - c1 - 8, { size: 9, leading: 11 });
    top += lines * 11 + 3;
  }
  s.rect(tLeft, tableTop, tW, top - tableTop);
  s.line(tLeft + c1, tableTop, tLeft + c1, top);
  top += 14;

  top += s.para(
    "If a society running small lotteries fails to comply with any of the conditions of running such lotteries specified in Part 4 of Schedule 11 of the Act, it will be operating in an illegal manner, irrespective of whether it is registered with a licensing authority or not. Under these circumstances small society lottery operators may face prosecution by the Commission, a licensing authority, or the police.",
    left,
    top,
    width,
    { size: 9 }
  );
  top += 10;

  top += s.rich(
    [
      { text: "Paragraph 39 of Schedule 11 in the Act", bold: true },
      { text: " sets out the information that the promoting society of a small society lottery must send as returns to the licensing authority with which it is registered" },
      { text: " following each lottery held.", bold: true },
      { text: " This information will allow authorities to assess, in particular, whether financial limits are being adhered to and to ensure that any money raised is being applied for the proper purpose. The information that must be submitted is as follows:" },
    ],
    left,
    top,
    width
  );
  top += 4;

  const bullet = (text: string) => {
    s.text("•", left + 4, top, { size: 9 });
    top += s.para(text, left + 16, top, width - 16, { size: 9, leading: 11.5 }) + 2;
  };
  [
    "the arrangements for the lottery – specifically the date on which tickets were available for sale or supply, the dates of any draw and the value of prizes, including any donated prizes and any rollover; - the proceeds of the lottery;",
    "the amounts deducted by the promoters of the lottery in providing prizes, including prizes in accordance with any rollovers;",
    "the amounts deducted by the promoters of the lottery in respect of costs incurred in organising the lottery;",
    "whether any expenses incurred in connection with the lottery were not paid for by deduction from the proceeds, and, if so, the amount of expenses and the sources from which they were paid; and",
    "the amount applied to the purpose for which the promoting society is conducted (this must be at least 20% of the proceeds).",
  ].forEach(bullet);
  top += 8;

  s.text("Paragraph 39 of the Act also requires that returns must:", left, top, { size: 9, bold: true });
  top += 14;
  [
    "be sent to the licensing authority no later than three months after the date of the lottery draw, or in the case of ‘instant lotteries (scratch cards) within three months of the last date on which tickets were on sale; and",
    "be signed (electronic signatures are acceptable if the return is sent electronically) by two members of the society, who must be aged eighteen or older, are appointed for the purpose in writing by the society or, if it has one, its governing body, and accompanied by a copy of their letter or letters of appointment. Section six of this document explores the compliance and enforcement responsibilities expected of local authorities in ensuring that societies have provided the required information at the required time.",
  ].forEach(bullet);
  top += 10;

  s.para(
    "If you have any queries on this form, please contact The Licensing Office on 01803 861136 or email licensing@southhams.gov.uk",
    left,
    top,
    width,
    { size: 9 }
  );
}

function drawSchedulePage(s: Sheet, input: LotteryReturnPdfInput) {
  const left = MARGIN;
  const right = A4.w - MARGIN;
  const width = right - left;
  const { figures: f } = input;
  let top = 48;

  s.text("Schedule to the return", left, top, { size: 14, bold: true });
  top += 20;
  s.para(
    `${input.societyName} · Registration No. ${input.registrationNumber} · ${input.serial} · tickets on sale ${ukDate(input.periodStart)} – ${ukDate(lotteryYearLastDay(input.periodEnd))}`,
    left,
    top,
    width,
    { size: 9, color: MUTED }
  );
  top += 18;
  top += s.para(
    "The Loddiswell Community Lottery is a single lottery drawn at the end of every month. Tickets are sold online by card and by hand. This return covers every draw in the lottery year in one column; this schedule shows each draw and each expense behind it. Sales are the money received in the year, net of refunds.",
    left,
    top,
    width,
    { size: 9 }
  );
  top += 14;

  // Draws
  s.text("Draws and prizes", left, top, { size: 11, bold: true });
  top += 16;
  const dx = [left, left + 110, right - 90];
  s.rect(left, top, width, 15, { fill: SHADE, border: false });
  s.text("Draw date", dx[0] + 4, top + 3.5, { bold: true });
  s.text("Prizes", dx[1] + 4, top + 3.5, { bold: true });
  s.text("Total", dx[2] + 4, top + 3.5, { bold: true });
  top += 15;
  if (input.draws.length === 0) {
    s.text("No draws were held in this lottery year.", left + 4, top + 4);
    top += 18;
  }
  for (const draw of input.draws) {
    const prizes = [...draw.results].sort((a, b) => a.rank - b.rank);
    const total = prizes.reduce((sum, r) => sum + (parsePrizePence(r.prize) ?? 0), 0);
    const text = prizes.map((r) => `${ordinal(r.rank)} ${r.prize}`).join(", ") || "No prizes";
    s.text(ukDate(draw.drawDate), dx[0] + 4, top + 3.5);
    const h = Math.max(16, s.para(text, dx[1] + 4, top + 3.5, dx[2] - dx[1] - 8, { leading: 11 }) + 5);
    s.text(formatPounds(total), dx[2] + 4, top + 3.5);
    top += h;
    s.line(left, top, right, top, 0.3);
  }
  s.text("Total spent on prizes", dx[1] + 4, top + 4, { bold: true });
  s.text(formatPounds(f.prizesPence), dx[2] + 4, top + 4, { bold: true });
  top += 18;
  if (f.unpricedPrizes.length) {
    top += s.para(`Prizes not counted above because they are not cash amounts: ${f.unpricedPrizes.join(", ")}.`, left, top, width, { size: 8.5, color: MUTED });
  }
  top += 16;

  // Expenses
  s.text("Expenses", left, top, { size: 11, bold: true });
  top += 16;
  const ex = [left, left + 200, right - 90];
  s.rect(left, top, width, 15, { fill: SHADE, border: false });
  s.text("Category", ex[0] + 4, top + 3.5, { bold: true });
  s.text("Detail", ex[1] + 4, top + 3.5, { bold: true });
  s.text("Amount", ex[2] + 4, top + 3.5, { bold: true });
  top += 15;
  if (input.expenses.length === 0) {
    s.text("No expenses were deducted from the proceeds.", left + 4, top + 4);
    top += 18;
  }
  for (const e of input.expenses) {
    s.text(EXPENSE_CATEGORIES[e.category], ex[0] + 4, top + 3.5, { size: 8.5 });
    const h = Math.max(16, s.para(e.description || "—", ex[1] + 4, top + 3.5, ex[2] - ex[1] - 8, { leading: 11 }) + 5);
    s.text(formatPounds(e.amountPence), ex[2] + 4, top + 3.5);
    top += h;
    s.line(left, top, right, top, 0.3);
  }
  s.text("Total expenses", ex[1] + 4, top + 4, { bold: true });
  s.text(formatPounds(f.totalExpensesPence), ex[2] + 4, top + 4, { bold: true });
  top += 30;

  // Summary
  const share = f.totalProceedsPence > 0 ? Math.round((f.balancePence / f.totalProceedsPence) * 1000) / 10 : 0;
  s.text("Summary", left, top, { size: 11, bold: true });
  top += 16;
  const summary: [string, number][] = [
    ["Total proceeds", f.totalProceedsPence],
    ["less expenses", -f.totalExpensesPence],
    ["less prizes", -f.prizesPence],
    ["Balance applied to the Trust's purposes", f.balancePence],
  ];
  for (const [label, pence] of summary) {
    const bold = label.startsWith("Balance");
    s.text(label, left + 4, top, { bold });
    s.text(formatPounds(pence), ex[2] + 4, top, { bold });
    top += 15;
  }
  s.text(`${share}% of proceeds applied to the purposes of the society (the minimum is 20%).`, left + 4, top + 2, { size: 8.5, color: MUTED });

  s.text(`Prepared ${formatUk(input.generatedAt, "d MMMM yyyy")} from the Trust's lottery records.`, left, A4.h - 50, { size: 7.5, color: MUTED });
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export async function renderLotteryReturnPdf(input: LotteryReturnPdfInput) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Small lottery return ${input.serial}`);
  doc.setAuthor(input.societyName);
  doc.setSubject("Return by Promoter relating to a Small Lottery (Gambling Act 2005, Schedule 11)");
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  await drawFormPage(doc, new Sheet(doc.addPage([A4.w, A4.h]), fonts), input);
  drawNotesPage(new Sheet(doc.addPage([A4.w, A4.h]), fonts));
  drawSchedulePage(new Sheet(doc.addPage([A4.w, A4.h]), fonts), input);
  return doc.save();
}
