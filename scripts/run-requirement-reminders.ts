// Preview by default. Use --send only after the migration and deployment.
// npx tsx --env-file=.vercel/.env.production.local scripts/run-requirement-reminders.ts [--send]
import { getRequirementCandidates, sendDueRequirementReminders } from "../src/lib/requirement-reminders";
import { getBookingRequirementDetail } from "../src/lib/booking-requirements";
import { requirementStage } from "../src/lib/requirement-policy";

async function main() {
  if (process.argv.includes("--send")) {
    console.log(JSON.stringify(await sendDueRequirementReminders(), null, 2));
    return;
  }
  const rows = [];
  for (const booking of await getRequirementCandidates()) {
    const detail = await getBookingRequirementDetail(booking.id, booking.requirementSetId);
    rows.push({ bookingId: booking.id, nextSession: booking.startDate.toISOString(), complete: detail.complete,
      applicableStage: detail.complete ? null : requirementStage(booking.startDate),
      unanswered: detail.questions.filter(q => !q.answered).length,
      missingDocuments: detail.questions.filter(q => q.needsDocument && !q.documents.length).length });
  }
  console.log(JSON.stringify({ preview: true, bookings: rows }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
