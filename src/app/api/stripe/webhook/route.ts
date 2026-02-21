import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { lotteryTickets } from "@/lib/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { addYears } from "date-fns";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.metadata?.type !== "lottery_ticket") {
      return NextResponse.json({ received: true });
    }

    const quantity = parseInt(session.metadata.quantity || "1", 10);
    const amount = session.amount_total || quantity * 1200;
    const email = session.customer_details?.email || "";
    const customFields = session.custom_fields || [];

    const nameField = customFields.find((f) => f.key === "full_name");
    const phoneField = customFields.find((f) => f.key === "phone");
    const name = nameField?.text?.value || session.customer_details?.name || "Unknown";
    const phone = phoneField?.text?.value || null;

    const now = new Date();

    await db.insert(lotteryTickets).values({
      id: createId(),
      name,
      email,
      phone,
      stripePaymentId: session.payment_intent as string,
      quantity,
      amount,
      purchaseDate: now,
      expiryDate: addYears(now, 1),
      status: "active",
    });
  }

  return NextResponse.json({ received: true });
}
