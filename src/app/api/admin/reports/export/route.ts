import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { auth } from "@/lib/auth";
import { resolvePeriod, toIsoDate, addUtcDays } from "@/lib/reports";
import {
  getBookingExportRows,
  getIncomeLedgerRows,
  getLotteryExportRows,
} from "@/lib/reports/queries";

// The treasurer's route out of the admin and into a spreadsheet. It reads the
// same period the report on screen is showing, so a CSV always matches the
// figures it was exported from.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "editor")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const period = resolvePeriod({
    range: params.get("range") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });

  const report = params.get("report") ?? "income";
  const rows =
    report === "bookings"
      ? await getBookingExportRows(period.start, period.end)
      : report === "lottery"
        ? await getLotteryExportRows(period.start, period.end)
        : await getIncomeLedgerRows(period.start, period.end);

  // An empty result still gets a file with headings, so an empty period reads as
  // "nothing happened" rather than "the export is broken".
  const csv = Papa.unparse(rows, {
    columns:
      rows.length > 0
        ? Object.keys(rows[0])
        : report === "bookings"
          ? ["Booked on", "Starts", "Facility", "Customer", "Amount (£)", "Paid (£)"]
          : report === "lottery"
            ? ["Paid on", "Name", "Email", "Tickets", "Amount (£)"]
            : ["Date", "Source", "Method", "Payer", "Detail", "Amount (£)"],
  });

  const filename = `loddiswell-${report}-${toIsoDate(period.start)}-to-${toIsoDate(
    addUtcDays(period.end, -1)
  )}.csv`;

  return new NextResponse(`﻿${csv}`, {
    headers: {
      // The BOM keeps Excel from mangling the pound signs.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
