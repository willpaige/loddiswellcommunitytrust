import { NextRequest, NextResponse } from "next/server";
import { runLotteryReturnJob } from "@/lib/lottery/return/service";

// Daily at 8am UK: on 1 August it emails the Trust the South Hams return for
// the lottery year just finished, as a filled-in PDF ready to sign. Each year
// is sent once; on every other day there is nothing to do.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runLotteryReturnJob());
}
