import { NextRequest, NextResponse } from "next/server";
import { startRaffleCheckout } from "@/lib/raffles/orders";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof body.raffleId !== "string") {
    return NextResponse.json({ error: "Invalid raffle" }, { status: 400 });
  }

  const result = await startRaffleCheckout({
    raffleId: body.raffleId,
    quantity: Number(body.quantity),
    ageConfirmed: body.ageConfirmed === true,
    marketingOptOut: body.marketingOptOut === true,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url });
}
