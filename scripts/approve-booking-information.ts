// Preview by default; --apply records the explicitly authorized offline sign-off.
// node --env-file=.vercel/.env.production.local --import tsx scripts/approve-booking-information.ts \
//   --booking ID [--booking ID] --expect-name NAME --actor LABEL --reason REASON [--apply]
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { bookings } from "../src/lib/db/schema";
import { getBookingRequirementDetail } from "../src/lib/booking-requirements";
import { recordRequirementApproval } from "../src/lib/booking-requirement-approval";

async function main() {
  const args = process.argv.slice(2);
  const values = (name: string) => args.flatMap((arg, i) => arg === name ? [args[i + 1]] : []);
  const ids = [...new Set(values("--booking"))];
  const name = values("--expect-name")[0];
  const actor = values("--actor")[0];
  const reason = values("--reason")[0];
  if (!ids.length || !name || !actor || !reason || reason.trim().length < 5 || reason.length > 2000) {
    throw new Error("Supply --booking, --expect-name, --actor and --reason (5–2,000 characters).");
  }
  const rows = [];
  for (const id of ids) {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!booking || booking.customerName !== name || booking.status !== "confirmed") throw new Error(`Booking identity/status mismatch: ${id}`);
    const detail = await getBookingRequirementDetail(id, booking.requirementSetId);
    if (!detail.hasRequirements) throw new Error(`No requirements: ${id}`);
    rows.push({ booking, detail });
  }
  for (const { booking, detail } of rows) {
    if (args.includes("--apply") && !detail.approvedOffline) {
      await recordRequirementApproval({ bookingId: booking.id, approve: true, note: reason,
        actor: { userId: null, email: null, label: actor } });
    }
    const verified = await getBookingRequirementDetail(booking.id, booking.requirementSetId);
    console.log(JSON.stringify({ bookingId: booking.id, customer: booking.customerName,
      applied: args.includes("--apply"), complete: verified.complete, approvedOffline: verified.approvedOffline,
      unanswered: verified.questions.filter(q => !q.answered).length }));
    if (args.includes("--apply") && !verified.approvedOffline) throw new Error(`Sign-off verification failed: ${booking.id}`);
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Sign-off failed"); process.exitCode = 1; });
