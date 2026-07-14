import { NextRequest, NextResponse } from "next/server";
import { sendDueRequirementReminders } from "@/actions/booking-requirements";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDueRequirementReminders();
  return NextResponse.json(result);
}
