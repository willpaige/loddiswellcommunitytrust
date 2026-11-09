import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getRaffleReturn } from "@/actions/raffle-return";
import { formatUk } from "@/lib/raffles/time";

export const dynamic = "force-dynamic";

const pounds = (pence: number) => (pence / 100).toFixed(2);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data;
  try {
    data = await getRaffleReturn(id);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { raffle, figures } = data;

  const csv = Papa.unparse([
    { Item: "Raffle", Value: raffle.title },
    { Item: "Sales opened", Value: formatUk(raffle.salesOpenAt, "yyyy-MM-dd") },
    { Item: "Sales closed", Value: formatUk(raffle.salesCloseAt, "yyyy-MM-dd") },
    { Item: "Draw date", Value: formatUk(raffle.drawAt, "yyyy-MM-dd") },
    { Item: "Ticket price (£)", Value: pounds(raffle.ticketPricePence) },
    { Item: "Tickets sold", Value: String(figures.ticketsSold) },
    { Item: "Total proceeds (£)", Value: pounds(figures.proceeds) },
    { Item: "Prizes bought (£)", Value: pounds(figures.prizesBought) },
    { Item: "Prizes donated, value (£)", Value: pounds(figures.prizesDonatedValue) },
    { Item: "Stripe fees (£)", Value: pounds(figures.stripeFees) },
    { Item: "Other expenses (£)", Value: pounds(figures.otherExpenses) },
    { Item: "To the Trust's purposes (£)", Value: pounds(figures.toPurposes) },
    { Item: "Share to purposes (%)", Value: (figures.shareToPurposes * 100).toFixed(1) },
    { Item: "Return due by", Value: formatUk(figures.dueBy, "yyyy-MM-dd") },
  ]);
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="raffle-${raffle.slug}-return.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
