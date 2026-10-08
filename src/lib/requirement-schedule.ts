import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookingOccurrences } from "@/lib/db/schema";
import { requirementNow } from "@/lib/requirement-policy";

export async function getNextRequirementSessions(bookingIds: string[], now = requirementNow()) {
  const result = new Map<string, Date>();
  if (!bookingIds.length) return result;
  const occurrences = await db.select({ bookingId: bookingOccurrences.bookingId, startDate: bookingOccurrences.startDate })
    .from(bookingOccurrences)
    .where(and(inArray(bookingOccurrences.bookingId, bookingIds), inArray(bookingOccurrences.status, ["confirmed", "pending_payment"]), gt(bookingOccurrences.startDate, now)))
    .orderBy(asc(bookingOccurrences.startDate));
  for (const occurrence of occurrences) {
    if (!result.has(occurrence.bookingId)) result.set(occurrence.bookingId, occurrence.startDate);
  }
  return result;
}

export async function assertRequirementsEditable(booking: { id: string; status: string }) {
  if (booking.status === "cancelled") throw new Error("This booking has been cancelled.");
  const next = (await getNextRequirementSessions([booking.id])).get(booking.id);
  if (!next) throw new Error("There are no upcoming sessions for this booking.");
  return next;
}
