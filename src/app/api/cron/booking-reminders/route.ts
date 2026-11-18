import { NextRequest, NextResponse } from "next/server";
import { processUnpaidBookingHolds, sendDueBookingReminderEmails } from "@/actions/bookings";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reminders = await sendDueBookingReminderEmails();
  // Hourly as well: unpaid-booking reminders, last calls and releases.
  const unpaidHolds = await processUnpaidBookingHolds();
  return NextResponse.json({ ...reminders, unpaidHolds });
}
