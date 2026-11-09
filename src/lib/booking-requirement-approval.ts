import { createId } from "@paralleldrive/cuid2";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings } from "@/lib/db/schema";
import { getBookingRequirementDetail } from "@/lib/booking-requirements";

// Called only after manager authentication, or by an explicitly authorized
// operational correction. The sign-off and its audit entry commit together.
export async function recordRequirementApproval(input: {
  bookingId: string; approve: boolean; note: string;
  actor: { userId: string | null; email: string | null; label: string };
}) {
  const note = input.note.trim();
  if (note.length < 5 || note.length > 2000) throw new Error("Enter a reason between 5 and 2,000 characters.");
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "confirmed") throw new Error("Only confirmed bookings can be signed off.");
  const detail = await getBookingRequirementDetail(booking.id, booking.requirementSetId);
  if (!detail.hasRequirements) throw new Error("This booking has no required information.");
  const now = new Date().toISOString();
  const complete = input.approve || (detail.questionnaireComplete && detail.documentsComplete);
  const metadata = JSON.stringify({ purpose: input.approve ? "requirements_approved_offline" : "requirements_approval_revoked",
    note, actor: input.actor.label, previousApproval: { at: booking.requirementApprovedAt, by: booking.requirementApprovedBy, note: booking.requirementApprovalNote } });
  const result = await db.execute(sql`
    WITH changed AS (
      UPDATE bookings SET requirement_approved_at = ${input.approve ? now : null}::timestamp,
        requirement_approved_by = ${input.approve ? input.actor.label : null},
        requirement_approval_note = ${input.approve ? note : null},
        requirement_completed_at = ${complete ? now : null}::timestamp, updated_at = ${now}::timestamp
      WHERE id = ${booking.id} AND status = 'confirmed'
        AND requirement_set_id IS NOT DISTINCT FROM ${booking.requirementSetId}
        AND requirement_review_after IS NOT DISTINCT FROM ${booking.requirementReviewAfter?.toISOString() ?? null}::timestamp
      RETURNING id
    )
    INSERT INTO audit_log (id, user_id, user_email, action, entity, entity_id, description, metadata)
    SELECT ${createId()}, ${input.actor.userId}, ${input.actor.email}, 'update', 'booking', id,
      ${input.approve ? "Required information checked and approved offline" : "Offline information approval revoked"}, ${metadata}::jsonb
    FROM changed RETURNING entity_id
  `);
  if (!result.rows.length) throw new Error("The booking changed. Refresh the page and try again.");
}
