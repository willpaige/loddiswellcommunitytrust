import { NextRequest, NextResponse } from "next/server";
import { startHeldBookingPayment } from "@/actions/bookings";

// The pay link in unpaid-booking emails. It stays valid for the whole hold:
// each visit opens a fresh Stripe checkout (sign-in first if needed).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { redirect } = await startHeldBookingPayment(id);
  return NextResponse.redirect(new URL(redirect, req.url), 303);
}
