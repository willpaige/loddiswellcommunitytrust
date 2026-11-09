import { and, eq, inArray, lt } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { raffleOrders, raffleTickets, raffles } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import { sendTemplateEmail } from "@/lib/email/send";
import { upsertCustomerRecord } from "@/actions/customer-records";
import { deriveRaffleState, isOnSale, ticketsRemaining } from "@/lib/raffles/state";
import { releaseTickets, reserveTickets } from "@/lib/raffles/capacity";
import { ensureRaffleTickets, markOrderPaid } from "@/lib/raffles/allocate";
import { compressRanges, formatPence } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";
import { renderSmallPrint } from "@/lib/raffles/small-print";

/** Stripe's minimum session lifetime; tickets are held for this long. */
export const CHECKOUT_HOLD_MS = 30 * 60 * 1000;

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export type CheckoutRequest = {
  raffleId: string;
  quantity: number;
  ageConfirmed: boolean;
  marketingOptOut: boolean;
};

export type CheckoutResult = { url: string } | { error: string; status: number };

/**
 * Holds the tickets against the cap, records a pending order and opens a
 * Stripe Checkout session for it. The hold lasts as long as the session; if
 * it expires unpaid, `expireRaffleOrder` gives the tickets back.
 */
export async function startRaffleCheckout(input: CheckoutRequest, now = new Date()): Promise<CheckoutResult> {
  const [raffle] = await db.select().from(raffles).where(eq(raffles.id, input.raffleId)).limit(1);
  if (!raffle) return { error: "This raffle doesn't exist.", status: 404 };

  const state = deriveRaffleState(raffle, { now });
  if (!isOnSale(state)) {
    return { error: state === "sold_out" ? "Sorry, every ticket has been sold." : "Tickets aren't on sale right now.", status: 409 };
  }
  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > raffle.maxPerOrder) {
    return { error: `Choose between 1 and ${raffle.maxPerOrder} tickets.`, status: 400 };
  }
  if (raffle.minAge >= 18 && !input.ageConfirmed) {
    return { error: "Please confirm you are 18 or over.", status: 400 };
  }

  if (!(await reserveTickets(raffle.id, quantity, { online: true, now }))) {
    const left = ticketsRemaining(raffle);
    return {
      error: left ? `Only ${left} ticket${left === 1 ? " is" : "s are"} left.` : "Sorry, every ticket has been sold.",
      status: 409,
    };
  }

  const expiresAt = new Date(now.getTime() + CHECKOUT_HOLD_MS);
  const [order] = await db
    .insert(raffleOrders)
    .values({
      raffleId: raffle.id,
      source: "stripe",
      status: "pending",
      name: "Pending checkout",
      quantity,
      amount: quantity * raffle.ticketPricePence,
      paymentMethod: "card",
      ageConfirmed: input.ageConfirmed,
      marketingOptOut: input.marketingOptOut,
      expiresAt,
    })
    .returning();

  const metadata = { type: "raffle_entry", raffleId: raffle.id, orderId: order.id };
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity,
          price_data: {
            currency: "gbp",
            unit_amount: raffle.ticketPricePence,
            product_data: {
              name: `${raffle.title}: raffle ticket`,
              description: `Draw ${formatUk(raffle.drawAt, "d MMMM yyyy")}. Loddiswell Playing Fields & Village Hall Trust.`,
            },
          },
        },
      ],
      metadata,
      payment_intent_data: { metadata },
      custom_fields: [
        { key: "full_name", label: { type: "custom", custom: "Your full name" }, type: "text" },
        {
          key: "phone",
          label: { type: "custom", custom: "Phone (so we can call if you win)" },
          type: "text",
          optional: true,
        },
      ],
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      success_url: `${appUrl()}/raffles/${raffle.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/raffles/${raffle.slug}`,
    });
    await db
      .update(raffleOrders)
      .set({ stripeCheckoutSessionId: session.id, updatedAt: new Date() })
      .where(eq(raffleOrders.id, order.id));
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return { url: session.url };
  } catch (error) {
    console.error("Raffle checkout error:", error);
    await db.update(raffleOrders).set({ status: "expired", updatedAt: new Date() }).where(eq(raffleOrders.id, order.id));
    await releaseTickets(raffle.id, quantity);
    return { error: "We couldn't start the payment. Please try again.", status: 502 };
  }
}

function idOf(ref: string | { id: string } | null | undefined) {
  return typeof ref === "string" ? ref : ref?.id ?? null;
}

/** The Stripe fee on a payment, for the council return. Best effort. */
async function stripeFee(paymentIntentId: string | null) {
  if (!paymentIntentId) return 0;
  try {
    const intent = await getStripe().paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = intent.latest_charge as Stripe.Charge | null;
    const txn = charge?.balance_transaction as Stripe.BalanceTransaction | null;
    return txn?.fee ?? 0;
  } catch (error) {
    console.error("Could not read Stripe fee", error);
    return 0;
  }
}

/** Sends the ticket confirmation once per order. */
export async function sendRaffleTicketsEmail(orderId: string) {
  const [row] = await db
    .select({ order: raffleOrders, raffle: raffles })
    .from(raffleOrders)
    .innerJoin(raffles, eq(raffles.id, raffleOrders.raffleId))
    .where(eq(raffleOrders.id, orderId))
    .limit(1);
  if (!row?.order.email) return;
  const tickets = await db
    .select({ n: raffleTickets.ticketNumber })
    .from(raffleTickets)
    .where(and(eq(raffleTickets.orderId, orderId), eq(raffleTickets.void, false)));
  const { order, raffle } = row;
  await sendTemplateEmail({
    key: "raffle_tickets",
    to: order.email!,
    variables: {
      name: order.name,
      raffleTitle: raffle.title,
      ticketNumbers: compressRanges(tickets.map((t) => t.n)),
      quantity: order.quantity,
      amount: formatPence(order.amount),
      drawDate: formatUk(raffle.drawAt, "EEEE d MMMM 'at' h:mmaaa"),
      cause: raffle.causeTitle || "Loddiswell's community facilities",
      raffleUrl: `${appUrl()}/raffles/${raffle.slug}`,
      smallPrint: renderSmallPrint(raffle.smallPrint, raffle),
    },
    relatedEntityType: "raffle_order",
    relatedEntityId: `${orderId}:tickets`,
  });
}

/**
 * checkout.session.completed for a raffle. Safe to run on every redelivery:
 * only the first marks the order paid, and allocation and the email are
 * idempotent, so a retry after a crash finishes the job without repeating it.
 */
export async function completeRaffleOrder(session: Stripe.Checkout.Session, paidAt: Date) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;
  const [order] = await db.select().from(raffleOrders).where(eq(raffleOrders.id, orderId)).limit(1);
  if (!order) return;

  // A payment Stripe accepted is honoured even if our backstop already gave
  // the hold back. Take the tickets again; if that overshoots the cap by a
  // ticket or two, the buyer has still paid, so they still get them.
  if (order.status === "expired") {
    await reserveTickets(order.raffleId, order.quantity, { online: false });
    await db.update(raffleOrders).set({ status: "pending" }).where(and(eq(raffleOrders.id, orderId), eq(raffleOrders.status, "expired")));
  }

  const fields = session.custom_fields ?? [];
  const name = fields.find((f) => f.key === "full_name")?.text?.value || session.customer_details?.name || "Unknown";
  const phone = fields.find((f) => f.key === "phone")?.text?.value || session.customer_details?.phone || null;
  const email = session.customer_details?.email?.toLowerCase() || null;
  const paymentIntentId = idOf(session.payment_intent as string | { id: string } | null);

  const paid = await markOrderPaid(orderId, {
    paidAt,
    name: name.trim(),
    email,
    phone,
    amount: session.amount_total ?? order.amount,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
  });

  await ensureRaffleTickets(orderId);
  if (paid) {
    const fee = await stripeFee(paymentIntentId);
    if (fee) await db.update(raffleOrders).set({ stripeFeePence: fee }).where(eq(raffleOrders.id, orderId));
    if (email) await upsertCustomerRecord({ email, name, phone });
  }
  await sendRaffleTicketsEmail(orderId);
}

/** checkout.session.expired: the buyer never paid, so the tickets go back. */
export async function expireRaffleOrder(sessionId: string) {
  const [order] = await db
    .update(raffleOrders)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(eq(raffleOrders.stripeCheckoutSessionId, sessionId), eq(raffleOrders.status, "pending")))
    .returning();
  if (order) await releaseTickets(order.raffleId, order.quantity);
}

/**
 * Backstop for a missed checkout.session.expired: pending orders well past
 * their hold are given back. The grace period keeps us from racing Stripe.
 */
export async function releaseStaleRaffleOrders(now = new Date()) {
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
  // The status condition makes each release happen once, even if the webhook
  // for the same session lands at the same moment.
  const expired = await db
    .update(raffleOrders)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(raffleOrders.status, "pending"), lt(raffleOrders.expiresAt, cutoff)))
    .returning({ raffleId: raffleOrders.raffleId, quantity: raffleOrders.quantity });
  for (const order of expired) await releaseTickets(order.raffleId, order.quantity);
  return expired.length;
}

/**
 * Refunds, whether issued from our admin or the Stripe dashboard, arrive as
 * charge.refunded. A full refund voids the order's tickets (they keep their
 * numbers, so none is reissued) and frees them for sale again.
 */
export async function applyRaffleRefund(paymentIntentId: string, amountRefunded: number) {
  const [order] = await db
    .select()
    .from(raffleOrders)
    .where(and(eq(raffleOrders.stripePaymentIntentId, paymentIntentId), inArray(raffleOrders.status, ["paid", "refunded"])))
    .limit(1);
  if (!order) return false;
  const full = amountRefunded >= order.amount;
  await db
    .update(raffleOrders)
    .set({ refundedAmount: Math.min(amountRefunded, order.amount), status: full ? "refunded" : order.status, updatedAt: new Date() })
    .where(eq(raffleOrders.id, order.id));
  if (full && order.status !== "refunded") {
    await db.update(raffleTickets).set({ void: true }).where(eq(raffleTickets.orderId, order.id));
    await releaseTickets(order.raffleId, order.quantity);
  }
  return true;
}
