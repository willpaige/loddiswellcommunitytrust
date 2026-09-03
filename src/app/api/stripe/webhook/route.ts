import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { bookingOccurrences, bookings, lotteryTickets } from "@/lib/db/schema";
import {
  applyPaidBookingChange,
  createPromotionEventForBooking,
  recordBookingTopUpPayment,
  extendSubscriptionBookingOccurrences,
  sendBookingConfirmedEmails,
  sendBookingPaymentFailedEmail,
} from "@/actions/bookings";
import { eq, sql } from "drizzle-orm";
import { addYears } from "date-fns";
import Stripe from "stripe";
import { ensureLotteryTicketNumbers, ticketNumbersText } from "@/actions/lottery-ticket-numbers";
import { sendTemplateEmail } from "@/lib/email/send";
import { upsertCustomerRecord } from "@/actions/customer-records";

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
  if (email) {
    await upsertCustomerRecord({
      email,
      name: name || "Unknown",
      phone,
    });
  }

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
        // name/phone are set from checkout on insert only. After that they
        // are owned by the admin (see updateStripeSubscriberDetails) so a
        // subscription update from Stripe must not clobber local edits.
      },
    });

  const [ticket] = await db
    .select()
    .from(lotteryTickets)
    .where(eq(lotteryTickets.stripeSubscriptionId, sub.id))
    .limit(1);
  if (ticket) {
    await ensureLotteryTicketNumbers(ticket.id);
    await sendTemplateEmail({
      key: "lottery_welcome",
      to: ticket.email,
      variables: {
        name: ticket.name,
        quantity: ticket.quantity,
        ticketNumbers: await ticketNumbersText(ticket.id),
        manageUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/account/lottery`,
      },
      relatedEntityType: "lottery",
      relatedEntityId: `${ticket.id}:welcome`,
    });
  }
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
        // A top-up settles the difference after a booking changed, so it adds to
        // what has been paid rather than replacing it, and leaves the booking's
        // original payment references alone.
        if (session.metadata?.type === "booking_change" && session.metadata.bookingId) {
          await applyPaidBookingChange(
            session.metadata.bookingId,
            {
              start: new Date(session.metadata.startIso),
              end: new Date(session.metadata.endIso),
              amount: Number(session.metadata.newAmount),
            },
            session.amount_total ?? 0,
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id
          );
          break;
        }
        if (session.metadata?.type === "booking_topup" && session.metadata.bookingId) {
          await db
            .update(bookings)
            .set({
              paidAmount: sql`${bookings.paidAmount} + ${session.amount_total ?? 0}`,
              updatedAt: new Date(),
            })
            .where(eq(bookings.id, session.metadata.bookingId));
          await recordBookingTopUpPayment(
            session.metadata.bookingId,
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
            session.amount_total ?? 0
          );
          break;
        }
        if (session.metadata?.type === "booking" && session.metadata.bookingId) {
          await db
            .update(bookings)
            .set({
              status: "confirmed",
              // What Stripe actually collected, so a later change to the booking
              // has a real balance to settle against.
              paidAmount: session.amount_total ?? undefined,
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
          await recordBookingTopUpPayment(
            session.metadata.bookingId,
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
            session.amount_total ?? 0
          );
          await createPromotionEventForBooking(session.metadata.bookingId);
          await sendBookingConfirmedEmails(session.metadata.bookingId);
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
          if (event.type === "customer.subscription.deleted" || sub.status === "canceled") {
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
          } else {
            await db
              .update(bookings)
              .set({
                stripeSubscriptionId: sub.id,
                stripeCustomerId:
                  typeof sub.customer === "string" ? sub.customer : sub.customer.id,
                updatedAt: new Date(),
              })
              .where(eq(bookings.id, sub.metadata.bookingId));
          }
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
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // One-off booking invoices have no subscription — handle them first,
        // before the subscription lookup below would `break` on a missing sub.
        if (invoice.metadata?.type === "booking_invoice" && invoice.metadata.bookingId) {
          const bookingId = invoice.metadata.bookingId;
          const paymentIntent = (
            invoice as unknown as { payment_intent?: string | { id: string } }
          ).payment_intent;
          await db
            .update(bookings)
            .set({
              status: "confirmed",
              invoiceStatus: "paid",
              paidAmount: invoice.amount_paid ?? undefined,
              stripePaymentIntentId:
                typeof paymentIntent === "string"
                  ? paymentIntent
                  : paymentIntent?.id ?? null,
              updatedAt: new Date(),
            })
            .where(eq(bookings.id, bookingId));
          await db
            .update(bookingOccurrences)
            .set({ status: "confirmed" })
            .where(eq(bookingOccurrences.bookingId, bookingId));
          await recordBookingTopUpPayment(
            bookingId,
            typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id,
            invoice.amount_paid ?? 0
          );
          await createPromotionEventForBooking(bookingId);
          await sendBookingConfirmedEmails(bookingId, true);
          break;
        }
        const subRef = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (!subId) break;
        // Skip the first invoice (subscription_create) — the
        // checkout.session.completed handler already inserted the row.
        if (invoice.billing_reason !== "subscription_cycle") break;
        const sub = await getStripe().subscriptions.retrieve(subId);
        if (sub.metadata?.type === "booking" && sub.metadata.bookingId) {
          await db
            .update(bookings)
            .set({
              status: "confirmed",
              updatedAt: new Date(),
            })
            .where(eq(bookings.id, sub.metadata.bookingId));
          // Keep the indefinite booking's rolling occurrence window topped up on
          // each billing cycle (the nightly cron is the backstop).
          await extendSubscriptionBookingOccurrences(sub.metadata.bookingId);
          break;
        }
        await upsertFromSubscription(sub);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.metadata?.type === "booking_invoice" && invoice.metadata.bookingId) {
          await db
            .update(bookings)
            .set({ status: "payment_failed", invoiceStatus: "open", updatedAt: new Date() })
            .where(eq(bookings.id, invoice.metadata.bookingId));
          await sendBookingPaymentFailedEmail(invoice.metadata.bookingId);
          break;
        }
        const subRef = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (!subId) break;
        const sub = await getStripe().subscriptions.retrieve(subId);
        if (sub.metadata?.type === "booking" && sub.metadata.bookingId) {
          await db
            .update(bookings)
            .set({ status: "payment_failed", updatedAt: new Date() })
            .where(eq(bookings.id, sub.metadata.bookingId));
          await sendBookingPaymentFailedEmail(sub.metadata.bookingId);
          break;
        }
        await db
          .update(lotteryTickets)
          .set({ status: "past_due" })
          .where(eq(lotteryTickets.stripeSubscriptionId, subId));
        const [ticket] = await db
          .select()
          .from(lotteryTickets)
          .where(eq(lotteryTickets.stripeSubscriptionId, subId))
          .limit(1);
        if (ticket) {
          await sendTemplateEmail({
            key: "lottery_payment_failed",
            to: ticket.email,
            variables: {
              name: ticket.name,
              manageUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/account/lottery`,
            },
            relatedEntityType: "lottery",
            relatedEntityId: `${ticket.id}:payment-failed`,
          });
        }
        break;
      }
      case "invoice.finalized": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.metadata?.type === "booking_invoice" && invoice.metadata.bookingId) {
          await db
            .update(bookings)
            .set({
              invoiceStatus: "open",
              invoiceHostedUrl: invoice.hosted_invoice_url ?? null,
              invoicePdfUrl: invoice.invoice_pdf ?? null,
              updatedAt: new Date(),
            })
            .where(eq(bookings.id, invoice.metadata.bookingId));
        }
        break;
      }
      case "invoice.marked_uncollectible": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.metadata?.type === "booking_invoice" && invoice.metadata.bookingId) {
          await db
            .update(bookings)
            .set({ invoiceStatus: "uncollectible", updatedAt: new Date() })
            .where(eq(bookings.id, invoice.metadata.bookingId));
        }
        break;
      }
      case "invoice.voided": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.metadata?.type === "booking_invoice" && invoice.metadata.bookingId) {
          await db
            .update(bookings)
            .set({ invoiceStatus: "void", updatedAt: new Date() })
            .where(eq(bookings.id, invoice.metadata.bookingId));
        }
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
