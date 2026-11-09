import { NextRequest, NextResponse } from "next/server";
import { runRaffleJobs } from "@/lib/raffles/jobs";

// Hourly: releases checkout holds Stripe never told us about, sends "on sale
// now" emails when a raffle opens, and the morning-of-the-draw reminder.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runRaffleJobs());
}
