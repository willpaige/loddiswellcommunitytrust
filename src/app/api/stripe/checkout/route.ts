import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const { quantity, interval } = await req.json();

    if (!quantity || quantity < 1 || quantity > 50) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    if (interval !== "month" && interval !== "year") {
      return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
    }

    const priceId =
      interval === "month"
        ? process.env.STRIPE_LOTTERY_PRICE_ID_MONTHLY
        : process.env.STRIPE_LOTTERY_PRICE_ID_YEARLY;
    if (!priceId) {
      return NextResponse.json(
        { error: "Lottery not configured yet" },
        { status: 503 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity }],
      subscription_data: {
        metadata: {
          type: "lottery_ticket",
          quantity: quantity.toString(),
          interval,
        },
      },
      custom_fields: [
        {
          key: "full_name",
          label: { type: "custom", custom: "Full Name" },
          type: "text",
        },
        {
          key: "phone",
          label: { type: "custom", custom: "Phone Number (optional)" },
          type: "text",
          optional: true,
        },
      ],
      success_url: `${appUrl}/lottery/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/lottery/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
