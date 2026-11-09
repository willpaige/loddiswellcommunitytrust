"use server";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { TZDate } from "@date-fns/tz";
import { db } from "@/lib/db";
import { raffleDraws, raffleOrders, raffleTickets, raffles } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { getStripe } from "@/lib/stripe";
import { requireStaff } from "@/lib/raffles/auth";
import { releaseTickets, reserveTickets } from "@/lib/raffles/capacity";
import { ensureRaffleTickets } from "@/lib/raffles/allocate";
import { applyRaffleRefund, sendRaffleTicketsEmail } from "@/lib/raffles/orders";
import { compressRanges } from "@/lib/raffles/numbers";
import { upsertCustomerRecord } from "@/actions/customer-records";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CashSaleState = {
  error: string | null;
  added?: { name: string; quantity: number; numbers: string };
};

export type RaffleOrderRow = typeof raffleOrders.$inferSelect & { tickets: number[]; voidTickets: number[] };

function revalidate(raffleId: string) {
  revalidatePath(`/admin/raffles/${raffleId}`);
  revalidatePath("/admin/raffles");
}

async function drawRun(raffleId: string) {
  const [draw] = await db.select({ id: raffleDraws.id }).from(raffleDraws).where(eq(raffleDraws.raffleId, raffleId)).limit(1);
  return !!draw;
}

/** "2026-11-09" from a date input → noon UK time that day. */
function ukDateToNoon(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  return new Date(new TZDate(y, m - 1, d, 12, 0, 0, "Europe/London").getTime());
}

export async function getRaffleOrders(raffleId: string): Promise<RaffleOrderRow[]> {
  await requireStaff();
  const orders = await db
    .select()
    .from(raffleOrders)
    .where(and(eq(raffleOrders.raffleId, raffleId), inArray(raffleOrders.status, ["paid", "refunded", "void", "pending"])))
    .orderBy(desc(raffleOrders.paidAt), desc(raffleOrders.createdAt));
  const tickets = await db
    .select({ orderId: raffleTickets.orderId, n: raffleTickets.ticketNumber, void: raffleTickets.void })
    .from(raffleTickets)
    .where(eq(raffleTickets.raffleId, raffleId))
    .orderBy(asc(raffleTickets.ticketNumber));
  const byOrder = new Map<string, { live: number[]; void: number[] }>();
  for (const t of tickets) {
    const entry = byOrder.get(t.orderId) ?? { live: [], void: [] };
    (t.void ? entry.void : entry.live).push(t.n);
    byOrder.set(t.orderId, entry);
  }
  return orders.map((o) => ({ ...o, tickets: byOrder.get(o.id)?.live ?? [], voidTickets: byOrder.get(o.id)?.void ?? [] }));
}

export async function getRaffleSalesByDay(raffleId: string) {
  await requireStaff();
  const rows = await db
    .select({
      day: sql<string>`to_char(${raffleOrders.paidAt} at time zone 'UTC' at time zone 'Europe/London', 'YYYY-MM-DD')`,
      tickets: sql<number>`sum(${raffleOrders.quantity})::int`,
    })
    .from(raffleOrders)
    .where(and(eq(raffleOrders.raffleId, raffleId), eq(raffleOrders.status, "paid")))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.map((r) => ({ day: r.day, tickets: Number(r.tickets) }));
}

/**
 * A sale taken in person. Needs a name and a way to reach the buyer if they
 * win (phone or email). Numbers come from the same sequence as online sales
 * and count against the cap. Dated when the money was taken, not when typed.
 */
export async function recordCashSale(raffleId: string, _prev: CashSaleState, formData: FormData): Promise<CashSaleState> {
  const session = await requireStaff();
  const [raffle] = await db.select().from(raffles).where(eq(raffles.id, raffleId)).limit(1);
  if (!raffle) return { error: "That raffle no longer exists." };
  if (raffle.cancelledAt) return { error: "This raffle has been cancelled." };
  if (await drawRun(raffleId)) return { error: "The draw has already run, so no more tickets can be added." };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const quantity = Number(formData.get("quantity"));
  const method = String(formData.get("paymentMethod") ?? "cash");
  const paidAt = ukDateToNoon(String(formData.get("paidOn") ?? ""));
  const soldBy = String(formData.get("soldBy") ?? "").trim() || null;
  const ageConfirmed = formData.get("ageConfirmed") === "on";
  const emailNumbers = formData.get("emailNumbers") === "on";

  if (!name) return { error: "Enter the buyer's full name." };
  if (!phone && !email) return { error: "Enter a phone number or an email, so we can reach them if they win." };
  if (email && !EMAIL_RE.test(email)) return { error: "That email address doesn't look right." };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) return { error: "Enter how many tickets, from 1 to 500." };
  if (method !== "cash" && method !== "cheque" && method !== "transfer") return { error: "Choose how they paid." };
  if (!paidAt) return { error: "Enter the date the money was taken." };
  if (paidAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) return { error: "The date taken can't be in the future." };
  if (raffle.minAge >= 18 && !ageConfirmed) return { error: "Confirm the buyer is 18 or over. This raffle has an alcohol prize." };

  if (!(await reserveTickets(raffleId, quantity, { online: false }))) {
    const left = raffle.maxTickets !== null ? Math.max(0, raffle.maxTickets - raffle.ticketsReserved) : 0;
    return { error: `Only ${left} ticket${left === 1 ? " is" : "s are"} left under the cap.` };
  }

  const [order] = await db
    .insert(raffleOrders)
    .values({
      raffleId,
      source: "manual",
      status: "paid",
      name,
      email,
      phone,
      quantity,
      amount: quantity * raffle.ticketPricePence,
      paymentMethod: method,
      soldBy,
      ageConfirmed,
      paidAt,
      createdBy: session.user?.id ?? null,
    })
    .returning();
  const tickets = await ensureRaffleTickets(order.id);
  if (email) await upsertCustomerRecord({ email, name, phone });
  if (email && emailNumbers) await sendRaffleTicketsEmail(order.id);

  const numbers = compressRanges(tickets.map((t) => t.ticketNumber));
  await logAudit({
    action: "create",
    entity: "raffle",
    entityId: raffleId,
    description: `Recorded ${method} sale: ${name}, ${quantity} ticket(s) ${numbers}`,
    metadata: { orderId: order.id },
  });
  revalidate(raffleId);
  return { error: null, added: { name, quantity, numbers } };
}

export async function updateCashSale(orderId: string, _prev: CashSaleState, formData: FormData): Promise<CashSaleState> {
  await requireStaff();
  const [order] = await db.select().from(raffleOrders).where(eq(raffleOrders.id, orderId)).limit(1);
  if (!order || order.source !== "manual" || order.status !== "paid") return { error: "Only cash sales can be edited here." };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const soldBy = String(formData.get("soldBy") ?? "").trim() || null;
  const paidAt = ukDateToNoon(String(formData.get("paidOn") ?? ""));
  if (!name) return { error: "Enter the buyer's full name." };
  if (!phone && !email) return { error: "Enter a phone number or an email." };
  if (email && !EMAIL_RE.test(email)) return { error: "That email address doesn't look right." };
  if (!paidAt) return { error: "Enter the date the money was taken." };

  await db.update(raffleOrders).set({ name, phone, email, soldBy, paidAt, updatedAt: new Date() }).where(eq(raffleOrders.id, orderId));
  if (email) await upsertCustomerRecord({ email, name, phone });
  await logAudit({ action: "update", entity: "raffle", entityId: order.raffleId, description: `Edited cash sale for ${name}`, metadata: { orderId } });
  revalidate(order.raffleId);
  return { error: null };
}

/** Cancels a cash sale entered in error. The numbers stay, marked void. */
export async function voidCashSale(orderId: string, reason: string) {
  await requireStaff();
  const [order] = await db.select().from(raffleOrders).where(eq(raffleOrders.id, orderId)).limit(1);
  if (!order || order.source !== "manual" || order.status !== "paid") throw new Error("Only cash sales can be voided.");
  if (await drawRun(order.raffleId)) throw new Error("The draw has already run.");
  if (!reason.trim()) throw new Error("Give a reason.");

  const [voided] = await db
    .update(raffleOrders)
    .set({ status: "void", updatedAt: new Date() })
    .where(and(eq(raffleOrders.id, orderId), eq(raffleOrders.status, "paid")))
    .returning();
  if (!voided) return;
  await db.update(raffleTickets).set({ void: true }).where(eq(raffleTickets.orderId, orderId));
  await releaseTickets(order.raffleId, order.quantity);
  await logAudit({
    action: "delete",
    entity: "raffle",
    entityId: order.raffleId,
    description: `Voided cash sale for ${order.name}: ${reason.trim()}`,
    metadata: { orderId },
  });
  revalidate(order.raffleId);
}

/** Refunds a card order in full through Stripe. Not allowed once drawn. */
export async function refundRaffleOrder(orderId: string) {
  await requireStaff();
  const [order] = await db.select().from(raffleOrders).where(eq(raffleOrders.id, orderId)).limit(1);
  if (!order || order.source !== "stripe" || order.status !== "paid" || !order.stripePaymentIntentId) {
    throw new Error("Only paid card orders can be refunded.");
  }
  if (await drawRun(order.raffleId)) throw new Error("The draw has already run, so tickets can't be refunded.");

  await getStripe().refunds.create(
    { payment_intent: order.stripePaymentIntentId },
    { idempotencyKey: `raffle-refund-${order.id}` }
  );
  // charge.refunded will arrive too; applying it now just means the admin
  // sees the result straight away. Both paths are idempotent.
  await applyRaffleRefund(order.stripePaymentIntentId, order.amount);
  await logAudit({ action: "update", entity: "raffle", entityId: order.raffleId, description: `Refunded ${order.name}'s order in full`, metadata: { orderId } });
  revalidate(order.raffleId);
}

export async function resendRaffleTickets(orderId: string) {
  await requireStaff();
  const [order] = await db.select().from(raffleOrders).where(eq(raffleOrders.id, orderId)).limit(1);
  if (!order?.email || order.status !== "paid") throw new Error("This order has no email to send to.");
  await sendRaffleTicketsEmail(orderId, { resend: true });
  revalidate(order.raffleId);
}

/** Ends online sales now, e.g. to run the draw early on the night. */
export async function closeRaffleSalesNow(raffleId: string) {
  await requireStaff();
  const now = new Date();
  const [row] = await db
    .update(raffles)
    .set({ salesCloseAt: now, updatedAt: now })
    .where(and(eq(raffles.id, raffleId), sql`${raffles.salesCloseAt} > ${now}`))
    .returning({ slug: raffles.slug });
  if (row) {
    await logAudit({ action: "update", entity: "raffle", entityId: raffleId, description: "Closed sales early" });
    revalidatePath(`/raffles/${row.slug}`);
  }
  revalidate(raffleId);
}
