import { and, eq, lt, gt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookingInvoices } from "@/lib/db/schema";
import type { InvoicePeriod } from "@/lib/booking-invoices";

// First invoices can start mid-month or include the next month. Check actual
// sessions, including legacy period bounds saved in British summer time.
// A partial overlap needs reconciliation; never silently bill a session twice.
export async function findInvoiceCoveringSessions(
  bookingId: string,
  period: InvoicePeriod,
  sessions: { startDate: Date }[],
  resumeDraftId?: string,
) {
  const invoices = await db.select().from(bookingInvoices).where(and(
    eq(bookingInvoices.bookingId, bookingId), ne(bookingInvoices.status, "void"),
    lt(bookingInvoices.periodStart, period.end), gt(bookingInvoices.periodEnd, period.start),
    resumeDraftId ? ne(bookingInvoices.id, resumeDraftId) : undefined,
  ));
  const covering = sessions.map(session => invoices.find(invoice =>
    session.startDate >= invoice.periodStart && session.startDate < invoice.periodEnd));
  if (!covering.some(Boolean)) return null;
  if (covering.some(invoice => !invoice || invoice.status === "draft")) {
    throw new Error("These sessions overlap an existing invoice. Review the invoices before billing this period.");
  }
  return covering[0]!;
}
