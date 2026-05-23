import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { bookingOccurrences, bookings, lotteryTickets } from "@/lib/db/schema";
import { createPromotionEventForBooking } from "@/actions/bookings";
import { eq } from "drizzle-orm";
import { addYears } from "date-fns";
import Stripe from "stripe";

type SubStatus = "active" | "expired" | "refunded" | "canceled" | "past_due";

function mapStripeStatus(status: Stripe.Subscription.Status): SubStatus | null {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "canceled":
      return "canceled";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return null; // ignore — wait for a definitive event
    default:
      return null;
  }
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  // Stripe SDK exposes current_period_end as a unix-seconds number on the
  // subscription's first item; some recent SDK versions place it on
  // subscription.items.data[0].current_period_end. Read from either.
  const fromSub = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  const fromItem = sub.items?.data?.[0]?.current_period_end as
    | number
    | undefined;
  const seconds = fromSub ?? fromItem;
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

async function upsertFromSubscription(
  sub: Stripe.Subscription,
  fallback: {
    name?: string;
    email?: string;
    phone?: string | null;
  } = {}
) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  const price = item?.price;
  const quantity = item?.quantity ?? 1;
  const amount = (price?.unit_amount ?? 0) * quantity;
  const interval = price?.recurring?.interval;
  const billingInterval =
    interval === "month" || interval === "year" ? interval : null;
  const status = mapStripeStatus(sub.status);
  const cpe = periodEnd(sub);

  // Pull name/email if we don't have it from the checkout-session payload
  let email = fallback.email;
  let name = fallback.name;
  let phone = fallback.phone;
  if ((!email || !name) && typeof sub.customer === "string") {
    try {
      const customer = await getStripe().customers.retrieve(sub.customer);
      if (!customer.deleted) {
        email = email || customer.email || "";
        name = name || customer.name || "Unknown";
        phone = phone ?? customer.phone ?? null;
      }
    } catch (e) {
      console.error("Failed to retrieve customer", e);
    }
  }

  const now = new Date();
  const expiry = cpe ?? addYears(now, 1);

  await db
    .insert(lotteryTickets)
    .values({
      source: "stripe",
      name: name || "Unknown",
      email: (email || "").toLowerCase(),
      phone: phone ?? null,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      billingInterval,
      quantity,
      amount,
      purchaseDate: now,
      expiryDate: expiry,
      currentPeriodEnd: cpe,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      status: status ?? "active",
    })
    .onConflictDoUpdate({
      target: lotteryTickets.stripeSubscriptionId,
      set: {
        stripeCustomerId: customerId,
        billingInterval,
        quantity,
        amount,
        currentPeriodEnd: cpe,
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        ...(status ? { status } : {}),
        ...(email ? { email: email.toLowerCase() } : {}),
        ...(name ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
      },
    });
}

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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.type === "booking" && session.metadata.bookingId) {
          await db
            .update(bookings)
            .set({
              status: "confirmed",
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id ?? null,
              stripeSubscriptionId:
                typeof session.subscription === "string"
                  ? session.subscription
                  : session.subscription?.id ?? null,
              stripeCustomerId:
                typeof session.customer === "string"
                  ? session.customer
                  : session.customer?.id ?? null,
              updatedAt: new Date(),
            })
            .where(eq(bookings.id, session.metadata.bookingId));
          await db
            .update(bookingOccurrences)
            .set({ status: "confirmed" })
            .where(eq(bookingOccurrences.bookingId, session.metadata.bookingId));
          await createPromotionEventForBooking(session.metadata.bookingId);
          break;
        }

        if (session.mode !== "subscription" || !session.subscription) {
          // Either a legacy one-off (now unused) or unrelated mode — ignore.
          break;
        }
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const sub = await getStripe().subscriptions.retrieve(subId);

        const customFields = session.custom_fields || [];
        const nameField = customFields.find((f) => f.key === "full_name");
        const phoneField = customFields.find((f) => f.key === "phone");
        const name =
          nameField?.text?.value ||
          session.customer_details?.name ||
          undefined;
        const phone = phoneField?.text?.value || null;
        const email = session.customer_details?.email || undefined;

        await upsertFromSubscription(sub, { name, email, phone });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.metadata?.type === "booking" && sub.metadata.bookingId) {
          await db
            .update(bookings)
            .set({
              status: "cancelled",
              cancelledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(bookings.id, sub.metadata.bookingId));
          await db
            .update(bookingOccurrences)
            .set({ status: "cancelled" })
            .where(eq(bookingOccurrences.bookingId, sub.metadata.bookingId));
          break;
        }

        await upsertFromSubscription(sub);
        if (event.type === "customer.subscription.deleted") {
          await db
            .update(lotteryTickets)
            .set({
              status: "canceled",
              canceledAt: new Date(),
            })
            .where(eq(lotteryTickets.stripeSubscriptionId, sub.id));
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (!subId) break;
        // Skip the first invoice (subscription_create) — the
        // checkout.session.completed handler already inserted the row.
        if (invoice.billing_reason !== "subscription_cycle") break;
        const sub = await getStripe().subscriptions.retrieve(subId);
        await upsertFromSubscription(sub);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (!subId) break;
        await db
          .update(lotteryTickets)
          .set({ status: "past_due" })
          .where(eq(lotteryTickets.stripeSubscriptionId, subId));
        break;
      }
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    return NextResponse.json(
      { error: "Handler error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
