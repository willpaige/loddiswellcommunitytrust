import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema";

// The way the list gets out of the admin and into whatever sends the
// newsletter. Active addresses only by default; ?status=all includes those
// who have unsubscribed, for a suppression list.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "editor")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = request.nextUrl.searchParams.get("status") === "all";
  const rows = await db
    .select({
      email: newsletterSubscribers.email,
      status: newsletterSubscribers.status,
      createdAt: newsletterSubscribers.createdAt,
    })
    .from(newsletterSubscribers)
    .where(all ? undefined : eq(newsletterSubscribers.status, "active"))
    .orderBy(desc(newsletterSubscribers.createdAt));

  const csv = Papa.unparse(
    rows.map((row) => ({
      Email: row.email,
      Status: row.status,
      "Signed up": row.createdAt.toISOString().slice(0, 10),
    })),
    { columns: ["Email", "Status", "Signed up"] }
  );
  const filename = `newsletter-${all ? "all" : "active"}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
