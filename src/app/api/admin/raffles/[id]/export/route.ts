import { NextResponse } from "next/server";
import Papa from "papaparse";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { raffleOrders, raffleTickets, raffles } from "@/lib/db/schema";
import { requireStaff } from "@/lib/raffles/auth";
import { compressRanges } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";

export const dynamic = "force-dynamic";

/** Every entrant in one raffle, with their ticket numbers. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const [raffle] = await db.select().from(raffles).where(eq(raffles.id, id)).limit(1);
  if (!raffle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orders = await db
    .select()
    .from(raffleOrders)
    .where(and(eq(raffleOrders.raffleId, id), inArray(raffleOrders.status, ["paid", "refunded", "void"])))
    .orderBy(asc(raffleOrders.paidAt));
  const tickets = await db
    .select({ orderId: raffleTickets.orderId, n: raffleTickets.ticketNumber })
    .from(raffleTickets)
    .where(eq(raffleTickets.raffleId, id));
  const byOrder = new Map<string, number[]>();
  for (const t of tickets) byOrder.set(t.orderId, [...(byOrder.get(t.orderId) ?? []), t.n]);

  const rows = orders.map((o) => ({
    "Paid on": o.paidAt ? formatUk(o.paidAt, "yyyy-MM-dd HH:mm") : "",
    Name: o.name,
    Email: o.email ?? "",
    Phone: o.phone ?? "",
    Tickets: o.quantity,
    Numbers: compressRanges(byOrder.get(o.id) ?? []),
    "Paid by": o.paymentMethod,
    Status: o.status,
    "Amount (£)": ((o.amount - o.refundedAmount) / 100).toFixed(2),
    "Sold by": o.soldBy ?? "",
    "Raffle news opt-out": o.marketingOptOut ? "yes" : "",
  }));
  const csv = Papa.unparse(rows, {
    columns: ["Paid on", "Name", "Email", "Phone", "Tickets", "Numbers", "Paid by", "Status", "Amount (£)", "Sold by", "Raffle news opt-out"],
  });
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="raffle-${raffle.slug}-entrants.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
