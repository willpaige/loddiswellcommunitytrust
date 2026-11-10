import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { execFileSync } from "node:child_process";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle<typeof schema>>,
  session: { user: { id: "admin", email: "admin@example.test", role: "admin" } } as null | { user: { id: string; email: string; role: string } },
  send: vi.fn(), createSession: vi.fn(), retrieveIntent: vi.fn(), createRefund: vi.fn() }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { url }); } }));
vi.mock("postmark", () => ({ ServerClient: class { sendEmail = state.send; } }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({
  checkout: { sessions: { create: state.createSession } },
  paymentIntents: { retrieve: state.retrieveIntent },
  refunds: { create: state.createRefund },
}) }));

import { deriveRaffleState, ticketsRemaining } from "@/lib/raffles/state";
import { compressRanges, formatTicket } from "@/lib/raffles/numbers";
import { ukInputToDate, dateToUkInput } from "@/lib/raffles/time";
import { reserveTickets, releaseTickets } from "@/lib/raffles/capacity";
import { ensureRaffleTickets, markOrderPaid } from "@/lib/raffles/allocate";
import { createRaffle, updateRaffle, duplicateRaffle } from "@/actions/raffles";
import { applyRaffleRefund, completeRaffleOrder, expireRaffleOrder, releaseStaleRaffleOrders, startRaffleCheckout } from "@/lib/raffles/orders";
import { getIncomeTotals } from "@/lib/reports/queries";
import type Stripe from "stripe";
import { recordCashSale, refundRaffleOrder, resendRaffleTickets, updateCashSale, voidCashSale } from "@/actions/raffle-orders";
import { checkRaffleTicket, publishRaffleResults, redrawRafflePrize, retryRaffleDrawEmails, startRaffleDraw } from "@/actions/raffle-draws";
import { publicName } from "@/lib/raffles/draw";
import { registerRaffleInterest } from "@/actions/raffle-interest";
import { sendRaffleDrawReminders, sendRaffleOnSaleEmails } from "@/lib/raffles/jobs";
import { getRafflePromo, rafflePromoText, resetRafflePromoMemo } from "@/lib/raffles/promo";
import { unsubscribeToken, verifyUnsubscribeToken } from "@/lib/raffles/unsubscribe";
import { sendTemplateEmail } from "@/lib/email/send";
import { readFileSync } from "node:fs";
import { computeRaffleReturn } from "@/lib/raffles/limits";
import { getDueRaffleReturns, getRaffleReturn } from "@/actions/raffle-return";

let pg: PGlite;
beforeAll(async () => {
  process.env.POSTMARK_API_KEY = "test";
  process.env.AUTH_SECRET = "test-secret";
  pg = new PGlite(); state.db = drizzle(pg, { schema });
  const exported = execFileSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "export"], { encoding: "utf8" });
  await pg.exec(exported.slice(exported.indexOf("CREATE TABLE")));
  await state.db.insert(schema.users).values({ id: "admin", email: "admin@example.test", role: "admin" });
});
afterAll(async () => { await pg?.close(); });
beforeEach(async () => {
  await pg.exec("TRUNCATE raffles, raffle_orders, raffle_tickets, raffle_draws, raffle_interest, raffle_email_opt_outs, newsletter_subscribers, email_logs, email_templates, audit_log, lottery_tickets, lottery_payments CASCADE");
  // Buying tickets creates customer accounts, and accounts are part of the
  // raffle launch audience, so start each test with just the admin.
  await pg.exec("DELETE FROM users WHERE id <> 'admin'");
  state.session = { user: { id: "admin", email: "admin@example.test", role: "admin" } };
  state.send.mockReset().mockResolvedValue({ MessageID: "msg" });
  state.createSession.mockReset().mockImplementation(async () => ({ id: `cs_${Math.random().toString(36).slice(2)}`, url: "https://checkout.stripe.test/pay" }));
  state.createRefund.mockReset().mockResolvedValue({ id: "re_1" });
  state.retrieveIntent.mockReset().mockResolvedValue({ latest_charge: { balance_transaction: { fee: 35 } } });
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW);
  resetRafflePromoMemo();
});

const NOW = new Date("2026-11-10T12:00:00Z");
export async function raffle(overrides: Partial<typeof schema.raffles.$inferInsert> = {}) {
  const [row] = await state.db.insert(schema.raffles).values({
    id: "r1", slug: "november", title: "Win a wheelbarrow of booze", ticketPricePence: 200, maxTickets: 10,
    salesOpenAt: new Date("2026-11-01T09:00:00Z"), salesCloseAt: new Date("2026-11-30T19:00:00Z"),
    drawAt: new Date("2026-11-30T20:00:00Z"), published: true, minAge: 18,
    prizes: [{ rank: 1, title: "Wheelbarrow of booze", valuePence: 15000, costPence: 0 }],
    ...overrides,
  }).returning();
  return row;
}

async function order(overrides: Partial<typeof schema.raffleOrders.$inferInsert> = {}) {
  const [row] = await state.db.insert(schema.raffleOrders).values({
    raffleId: "r1", source: "stripe", name: "Sam", email: "sam@example.test", quantity: 5, amount: 1000,
    paymentMethod: "card", ...overrides,
  }).returning();
  return row;
}

describe("raffle state", () => {
  const base = { published: true, cancelledAt: null, salesOpenAt: new Date("2026-11-01T09:00:00Z"),
    salesCloseAt: new Date("2026-11-30T19:00:00Z"), maxTickets: 500, ticketsReserved: 100 };
  it.each([
    [{ published: false }, {}, "draft"],
    [{ cancelledAt: NOW }, {}, "cancelled"],
    [{}, { now: new Date("2026-10-31T12:00:00Z") }, "coming_soon"],
    [{}, {}, "live"],
    [{ ticketsReserved: 455 }, {}, "last_few"],
    [{}, { now: new Date("2026-11-30T08:00:00Z") }, "last_few"],
    [{ ticketsReserved: 500 }, {}, "sold_out"],
    [{}, { now: new Date("2026-11-30T19:00:00Z") }, "closed"],
    [{}, { drawPublished: true }, "drawn"],
    [{ maxTickets: null, ticketsReserved: 9999 }, {}, "live"],
  ] as const)("%o %o → %s", (patch, opts, expected) => {
    expect(deriveRaffleState({ ...base, ...patch }, { now: NOW, ...opts })).toBe(expected);
  });
  it("counts what's left only when there is a cap", () => {
    expect(ticketsRemaining({ maxTickets: 10, ticketsReserved: 7 })).toBe(3);
    expect(ticketsRemaining({ maxTickets: null, ticketsReserved: 7 })).toBeNull();
  });
});

describe("ticket numbers and UK times", () => {
  it("formats and compresses ranges", () => {
    expect(formatTicket(247)).toBe("#0247");
    expect(compressRanges([317, 313, 314, 315, 316, 320, 322, 321])).toBe("0313–0317, 0320–0322");
    expect(compressRanges([5])).toBe("0005");
  });
  it("reads admin times as UK local time in winter and summer", () => {
    expect(ukInputToDate("2026-11-30T20:00")?.toISOString()).toBe("2026-11-30T20:00:00.000Z");
    expect(ukInputToDate("2026-07-01T20:00")?.toISOString()).toBe("2026-07-01T19:00:00.000Z");
    expect(dateToUkInput(new Date("2026-07-01T19:00:00Z"))).toBe("2026-07-01T20:00");
    expect(ukInputToDate("nonsense")).toBeNull();
  });
});

describe("ticket cap", () => {
  it("never oversells, even with buyers racing for the last tickets", async () => {
    await raffle();
    const attempts = await Promise.all(Array.from({ length: 6 }, () => reserveTickets("r1", 3, { online: true, now: NOW })));
    expect(attempts.filter(Boolean)).toHaveLength(3);
    const [row] = await state.db.select().from(schema.raffles);
    expect(row.ticketsReserved).toBe(9);
    expect(await reserveTickets("r1", 2, { online: true, now: NOW })).toBe(false);
    await releaseTickets("r1", 3);
    expect(await reserveTickets("r1", 2, { online: true, now: NOW })).toBe(true);
  });
  it("refuses online sales outside the window but lets cash sales in after close", async () => {
    await raffle();
    const after = new Date("2026-11-30T19:30:00Z");
    expect(await reserveTickets("r1", 1, { online: true, now: after })).toBe(false);
    expect(await reserveTickets("r1", 1, { online: false, now: after })).toBe(true);
    await state.db.update(schema.raffles).set({ cancelledAt: NOW });
    expect(await reserveTickets("r1", 1, { online: false, now: after })).toBe(false);
  });
});

describe("ticket allocation", () => {
  it("marks paid once and numbers each order once, however often it is retried", async () => {
    await raffle({ maxTickets: null });
    const a = await order();
    const b = await order({ quantity: 2, amount: 400 });
    expect(await markOrderPaid(a.id, { paidAt: NOW })).not.toBeNull();
    expect(await markOrderPaid(a.id, { paidAt: NOW })).toBeNull();
    await markOrderPaid(b.id, { paidAt: NOW });

    const first = await ensureRaffleTickets(a.id);
    await Promise.all([ensureRaffleTickets(a.id), ensureRaffleTickets(a.id)]);
    await ensureRaffleTickets(b.id);
    const tickets = await state.db.select().from(schema.raffleTickets);
    expect(first.map((t) => t.ticketNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(tickets).toHaveLength(7);
    expect(new Set(tickets.map((t) => t.ticketNumber)).size).toBe(7);
  });
  it("gives a pending order no tickets", async () => {
    await raffle();
    const a = await order();
    expect(await ensureRaffleTickets(a.id)).toEqual([]);
  });
});

function raffleForm(patch: Record<string, string> = {}) {
  const form = new FormData();
  const values: Record<string, string> = {
    title: "Win a wheelbarrow of booze", slug: "", ticketPrice: "2.00", maxTickets: "500", maxPerOrder: "50",
    quickPicks: "1, 5, 10, 20", minAge: "18", salesOpenAt: "2026-11-01T09:00", salesCloseAt: "2026-11-30T19:00",
    drawAt: "2026-11-30T20:00", claimDays: "14", published: "on", featured: "on",
    prizes: JSON.stringify([{ title: "Wheelbarrow of booze", valuePence: 15000, costPence: 0 }]),
    ...patch,
  };
  for (const [k, v] of Object.entries(values)) form.set(k, v);
  return form;
}

describe("creating and editing raffles", () => {
  it("is for staff only", async () => {
    state.session = { user: { id: "cust", email: "c@example.test", role: "customer" } };
    await expect(createRaffle({ error: null }, raffleForm())).rejects.toThrow("Unauthorized");
    state.session = null;
    await expect(createRaffle({ error: null }, raffleForm())).rejects.toThrow("Unauthorized");
  });
  it("creates from the form, making the slug from the title and featuring only one", async () => {
    await raffle({ id: "old", slug: "old", featured: true });
    await expect(createRaffle({ error: null }, raffleForm())).rejects.toMatchObject({ message: "NEXT_REDIRECT" });
    const rows = await state.db.select().from(schema.raffles);
    const created = rows.find((r) => r.id !== "old")!;
    expect(created).toMatchObject({ slug: "win-a-wheelbarrow-of-booze", ticketPricePence: 200, maxTickets: 500, minAge: 18, featured: true });
    expect(created.salesOpenAt.toISOString()).toBe("2026-11-01T09:00:00.000Z");
    expect(rows.find((r) => r.id === "old")!.featured).toBe(false);
  });
  it("rejects bad dates, a taken slug and a too-low price", async () => {
    await raffle();
    expect(await createRaffle({ error: null }, raffleForm({ drawAt: "2026-11-29T20:00" }))).toMatchObject({ error: expect.stringContaining("draw") });
    expect(await createRaffle({ error: null }, raffleForm({ slug: "november" }))).toMatchObject({ error: expect.stringContaining("already used") });
    expect(await createRaffle({ error: null }, raffleForm({ ticketPrice: "0.10" }))).toMatchObject({ error: expect.stringContaining("price") });
  });
  it("locks the price and protects the cap once tickets are sold", async () => {
    await raffle({ ticketsReserved: 8 });
    expect(await updateRaffle("r1", { error: null }, raffleForm({ slug: "november", ticketPrice: "3" }))).toMatchObject({ error: expect.stringContaining("price can't change") });
    expect(await updateRaffle("r1", { error: null }, raffleForm({ slug: "november", maxTickets: "5" }))).toMatchObject({ error: expect.stringContaining("cap") });
    await expect(updateRaffle("r1", { error: null }, raffleForm({ slug: "november", maxTickets: "20" }))).rejects.toMatchObject({ message: "NEXT_REDIRECT" });
  });
  it("duplicates as an unpublished draft a month later, with prizes cleared", async () => {
    await raffle({ featured: true, ticketsReserved: 8, ticketsIssued: 8 });
    await expect(duplicateRaffle("r1")).rejects.toMatchObject({ url: expect.stringMatching(/\/admin\/raffles\/.+\/edit/) });
    const [copy] = await state.db.select().from(schema.raffles).where(eq(schema.raffles.slug, "november-copy"));
    expect(copy).toMatchObject({ published: false, featured: false, prizes: [], ticketsReserved: 0, ticketsIssued: 0, ticketPricePence: 200 });
    expect(copy.drawAt.toISOString()).toBe("2026-12-30T20:00:00.000Z");
  });
});

function completedSession(order: { id: string; stripeCheckoutSessionId: string | null }, patch: Partial<Stripe.Checkout.Session> = {}) {
  return {
    id: order.stripeCheckoutSessionId,
    metadata: { type: "raffle_entry", raffleId: "r1", orderId: order.id },
    amount_total: 1000,
    payment_intent: "pi_1",
    customer_details: { email: "Sam@Example.test", name: "Card Name", phone: null },
    custom_fields: [
      { key: "full_name", text: { value: "Sam Taylor" } },
      { key: "phone", text: { value: "07700 900123" } },
    ],
    ...patch,
  } as unknown as Stripe.Checkout.Session;
}

async function checkout(quantity = 5, extra: Partial<Parameters<typeof startRaffleCheckout>[0]> = {}) {
  const result = await startRaffleCheckout({ raffleId: "r1", quantity, ageConfirmed: true, marketingOptOut: false, ...extra }, NOW);
  const [order] = await state.db.select().from(schema.raffleOrders).orderBy(schema.raffleOrders.createdAt);
  return { result, order };
}

describe("online checkout", () => {
  it("holds the tickets, records a pending order and opens a 30-minute Stripe session", async () => {
    await raffle();
    const { result, order } = await checkout();
    expect(result).toEqual({ url: "https://checkout.stripe.test/pay" });
    expect(order).toMatchObject({ status: "pending", quantity: 5, amount: 1000, ageConfirmed: true });
    expect(order.stripeCheckoutSessionId).toMatch(/^cs_/);
    const params = state.createSession.mock.calls[0][0];
    expect(params).toMatchObject({ mode: "payment", metadata: { type: "raffle_entry", orderId: order.id } });
    expect(params.line_items[0]).toMatchObject({ quantity: 5, price_data: { currency: "gbp", unit_amount: 200 } });
    expect(params.expires_at).toBe(Math.floor(NOW.getTime() / 1000) + 30 * 60);
    expect((await state.db.select().from(schema.raffles))[0].ticketsReserved).toBe(5);
  });
  it("refuses a missing age confirmation, too many tickets, and sales outside the window", async () => {
    await raffle();
    expect((await checkout(1, { ageConfirmed: false })).result).toMatchObject({ status: 400 });
    expect((await checkout(51)).result).toMatchObject({ status: 400 });
    expect((await checkout(11)).result).toMatchObject({ status: 409, error: "Only 10 tickets are left." });
    await state.db.update(schema.raffles).set({ salesCloseAt: new Date("2026-11-09T00:00:00Z") });
    expect((await checkout(1)).result).toMatchObject({ status: 409 });
    expect(state.createSession).not.toHaveBeenCalled();
  });
  it("gives the hold back when Stripe fails", async () => {
    await raffle();
    state.createSession.mockRejectedValueOnce(new Error("Stripe down"));
    const { result, order } = await checkout();
    expect(result).toMatchObject({ status: 502 });
    expect(order.status).toBe("expired");
    expect((await state.db.select().from(schema.raffles))[0].ticketsReserved).toBe(0);
  });
});

describe("Stripe webhook handling", () => {
  it("completes an order once: buyer details, numbers, fee, customer record and one email", async () => {
    await raffle();
    const { order } = await checkout();
    const session = completedSession(order);
    const paidAt = new Date("2026-11-10T12:05:00Z");
    await completeRaffleOrder(session, paidAt);
    await completeRaffleOrder(session, paidAt);

    const [paid] = await state.db.select().from(schema.raffleOrders);
    expect(paid).toMatchObject({ status: "paid", name: "Sam Taylor", email: "sam@example.test", phone: "07700 900123",
      stripePaymentIntentId: "pi_1", stripeFeePence: 35 });
    expect(paid.paidAt?.toISOString()).toBe(paidAt.toISOString());
    expect((await state.db.select().from(schema.raffleTickets)).map((t) => t.ticketNumber).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(state.send).toHaveBeenCalledTimes(1);
    expect(state.send.mock.calls[0][0]).toMatchObject({ To: "sam@example.test", Subject: expect.stringContaining("0001–0005") });
    expect(await state.db.select().from(schema.users).where(eq(schema.users.email, "sam@example.test"))).toHaveLength(1);
  });
  it("releases the hold when a session expires, once", async () => {
    await raffle();
    const { order } = await checkout();
    await expireRaffleOrder(order.stripeCheckoutSessionId!);
    await expireRaffleOrder(order.stripeCheckoutSessionId!);
    expect((await state.db.select().from(schema.raffles))[0].ticketsReserved).toBe(0);
    expect((await state.db.select().from(schema.raffleOrders))[0].status).toBe("expired");
  });
  it("backstops missed expiry events after a grace period, and still honours a late payment", async () => {
    await raffle();
    const { order } = await checkout();
    expect(await releaseStaleRaffleOrders(new Date("2026-11-10T12:40:00Z"))).toBe(0);
    expect(await releaseStaleRaffleOrders(new Date("2026-11-10T12:50:00Z"))).toBe(1);
    expect((await state.db.select().from(schema.raffles))[0].ticketsReserved).toBe(0);
    await completeRaffleOrder(completedSession(order), new Date("2026-11-10T12:51:00Z"));
    expect((await state.db.select().from(schema.raffleOrders))[0].status).toBe("paid");
    expect((await state.db.select().from(schema.raffles))[0].ticketsReserved).toBe(5);
    expect(await state.db.select().from(schema.raffleTickets)).toHaveLength(5);
  });
  it("voids tickets and frees them on a full refund, keeps them on a partial one", async () => {
    await raffle();
    const { order } = await checkout();
    await completeRaffleOrder(completedSession(order), NOW);
    expect(await applyRaffleRefund("pi_1", 400)).toBe(true);
    expect((await state.db.select().from(schema.raffleTickets)).every((t) => !t.void)).toBe(true);
    await applyRaffleRefund("pi_1", 1000);
    const [refunded] = await state.db.select().from(schema.raffleOrders);
    expect(refunded).toMatchObject({ status: "refunded", refundedAmount: 1000 });
    expect((await state.db.select().from(schema.raffleTickets)).every((t) => t.void)).toBe(true);
    expect((await state.db.select().from(schema.raffles))[0].ticketsReserved).toBe(0);
    expect(await applyRaffleRefund("pi_unknown", 100)).toBe(false);
  });
});

describe("income ledger", () => {
  it("counts each raffle order once, on the day paid, net of refunds, split card/offline", async () => {
    await raffle({ maxTickets: null });
    await order({ status: "paid", paidAt: new Date("2026-11-03T10:00:00Z"), amount: 1000 });
    await order({ status: "paid", source: "manual", paymentMethod: "cash", paidAt: new Date("2026-11-04T10:00:00Z"), amount: 400 });
    await order({ status: "refunded", paidAt: new Date("2026-11-05T10:00:00Z"), amount: 600, refundedAmount: 600 });
    await order({ status: "pending", amount: 999 });
    await order({ status: "paid", paidAt: new Date("2026-10-30T10:00:00Z"), amount: 200 });
    const totals = await getIncomeTotals(new Date("2026-11-01T00:00:00Z"), new Date("2026-12-01T00:00:00Z"));
    expect(totals).toMatchObject({ raffle: 1400, total: 1400, card: 1000, offline: 400, payments: 3 });
  });
});

function cashForm(patch: Record<string, string | null> = {}) {
  const values: Record<string, string | null> = {
    name: "Barbara Hughes", phone: "07700 900123", email: "", quantity: "3", paymentMethod: "cash",
    paidOn: "2026-11-08", soldBy: "Quiz night", ageConfirmed: "on", emailNumbers: "on", ...patch,
  };
  const form = new FormData();
  for (const [k, v] of Object.entries(values)) if (v !== null) form.set(k, v);
  return form;
}

describe("cash sales", () => {
  it("needs a name and a phone or email, an 18+ confirmation, and a real date", async () => {
    await raffle();
    expect((await recordCashSale("r1", { error: null }, cashForm({ name: "" }))).error).toMatch(/name/);
    expect((await recordCashSale("r1", { error: null }, cashForm({ phone: "", email: "" }))).error).toMatch(/phone number or an email/);
    expect((await recordCashSale("r1", { error: null }, cashForm({ email: "not-an-email" }))).error).toMatch(/email/);
    expect((await recordCashSale("r1", { error: null }, cashForm({ ageConfirmed: null }))).error).toMatch(/18/);
    expect((await recordCashSale("r1", { error: null }, cashForm({ paidOn: "2026-12-25" }))).error).toMatch(/future/);
    expect(await state.db.select().from(schema.raffleOrders)).toHaveLength(0);
  });
  it("accepts a phone-only buyer, dates it when taken, numbers it and counts it against the cap", async () => {
    await raffle();
    const result = await recordCashSale("r1", { error: null }, cashForm());
    expect(result).toEqual({ error: null, added: { name: "Barbara Hughes", quantity: 3, numbers: "0001–0003" } });
    const [row] = await state.db.select().from(schema.raffleOrders);
    expect(row).toMatchObject({ source: "manual", status: "paid", paymentMethod: "cash", phone: "07700 900123", email: null, amount: 600, soldBy: "Quiz night" });
    expect(row.paidAt?.toISOString()).toBe("2026-11-08T12:00:00.000Z");
    expect(state.send).not.toHaveBeenCalled();
    expect((await recordCashSale("r1", { error: null }, cashForm({ quantity: "8" }))).error).toMatch(/Only 7 tickets/);
  });
  it("emails the numbers when an email is given, and can be resent on request", async () => {
    await raffle();
    await recordCashSale("r1", { error: null }, cashForm({ email: "barbara@example.test" }));
    expect(state.send).toHaveBeenCalledTimes(1);
    const [row] = await state.db.select().from(schema.raffleOrders);
    await resendRaffleTickets(row.id);
    expect(state.send).toHaveBeenCalledTimes(2);
  });
  it("edits contact details, and voids with the numbers kept but out of the draw", async () => {
    await raffle();
    await recordCashSale("r1", { error: null }, cashForm());
    const [row] = await state.db.select().from(schema.raffleOrders);
    expect((await updateCashSale(row.id, { error: null }, cashForm({ phone: "", email: "" }))).error).toMatch(/phone/);
    expect((await updateCashSale(row.id, { error: null }, cashForm({ email: "b@example.test" }))).error).toBeNull();
    await expect(voidCashSale(row.id, " ")).rejects.toThrow("reason");
    await voidCashSale(row.id, "Entered twice");
    expect((await state.db.select().from(schema.raffleOrders))[0]).toMatchObject({ status: "void", email: "b@example.test" });
    expect((await state.db.select().from(schema.raffleTickets)).every((t) => t.void)).toBe(true);
    expect((await state.db.select().from(schema.raffles))[0].ticketsReserved).toBe(0);
    await recordCashSale("r1", { error: null }, cashForm({ quantity: "1" }));
    const fresh = (await state.db.select().from(schema.raffleTickets)).filter((t) => !t.void);
    expect(fresh.map((t) => t.ticketNumber)).toEqual([4]);
  });
  it("locks sales, voids and refunds once the draw has run", async () => {
    await raffle();
    await recordCashSale("r1", { error: null }, cashForm());
    const [cash] = await state.db.select().from(schema.raffleOrders);
    await state.db.insert(schema.raffleDraws).values({ raffleId: "r1", method: "system", poolSize: 3, poolChecksum: "x",
      poolSnapshot: [1, 2, 3], results: [], drawnAt: NOW });
    expect((await recordCashSale("r1", { error: null }, cashForm())).error).toMatch(/draw has already run/);
    await expect(voidCashSale(cash.id, "late")).rejects.toThrow("draw has already run");
  });
});

describe("refunds from the admin", () => {
  it("refunds a card order through Stripe once, then voids its tickets", async () => {
    await raffle();
    const { order } = await checkout();
    await completeRaffleOrder(completedSession(order), NOW);
    await refundRaffleOrder(order.id);
    expect(state.createRefund).toHaveBeenCalledWith({ payment_intent: "pi_1" }, { idempotencyKey: `raffle-refund-${order.id}` });
    expect((await state.db.select().from(schema.raffleOrders))[0].status).toBe("refunded");
    await expect(refundRaffleOrder(order.id)).rejects.toThrow("Only paid card orders");
  });
  it("is staff only", async () => {
    state.session = { user: { id: "c", email: "c@example.test", role: "customer" } };
    await expect(refundRaffleOrder("any")).rejects.toThrow("Unauthorized");
    await expect(recordCashSale("r1", { error: null }, cashForm())).rejects.toThrow("Unauthorized");
  });
});

const AFTER_CLOSE = new Date("2026-11-30T19:30:00Z");

/** Three buyers: Sam (email, 3 tickets), Jo (email, 2), Barbara (phone only, 1). */
async function drawableRaffle(prizes = 3) {
  await raffle({ maxTickets: null, prizes: Array.from({ length: prizes }, (_, i) => ({ rank: i + 1, title: `Prize ${i + 1}`, valuePence: 1000, costPence: 0 })) });
  for (const [name, email, phone, quantity] of [
    ["Sam Taylor", "sam@example.test", null, 3],
    ["Jo Smith", "jo@example.test", null, 2],
    ["Barbara Hughes", null, "07700 900123", 1],
  ] as const) {
    const o = await order({ name, email, phone, quantity, amount: quantity * 200, status: "pending" });
    await markOrderPaid(o.id, { paidAt: NOW });
    await ensureRaffleTickets(o.id);
  }
  await state.db.insert(schema.siteSettings).values({ emailAddress: "trust@example.test" });
  vi.setSystemTime(AFTER_CLOSE);
}

async function theDraw() {
  const [draw] = await state.db.select().from(schema.raffleDraws);
  return draw;
}

const drawInput = (patch: Partial<Parameters<typeof startRaffleDraw>[0]> = {}) => ({
  raffleId: "r1", method: "system" as const, onePerPerson: true, prizeOrder: [3, 2, 1], ...patch,
});

describe("running the draw", () => {
  beforeEach(async () => { await pg.exec("TRUNCATE site_settings CASCADE"); });

  it("won't draw before sales close or while a checkout is in progress", async () => {
    await drawableRaffle();
    vi.setSystemTime(NOW);
    expect((await startRaffleDraw(drawInput())).error).toMatch(/Sales haven't closed/);
    vi.setSystemTime(AFTER_CLOSE);
    await order({ status: "pending", expiresAt: new Date(AFTER_CLOSE.getTime() + 60_000) });
    expect((await startRaffleDraw(drawInput())).error).toMatch(/checkout\(s\) are still in progress/);
    expect(await state.db.select().from(schema.raffleDraws)).toHaveLength(0);
  });

  it("draws once, saves winners in draw order, one prize per person, from paid non-void tickets only", async () => {
    await drawableRaffle();
    // A refunded order's tickets must never win.
    const refunded = await order({ name: "Refunded", email: "r@example.test", quantity: 10, status: "pending" });
    await markOrderPaid(refunded.id, { paidAt: NOW });
    await ensureRaffleTickets(refunded.id);
    await state.db.update(schema.raffleOrders).set({ status: "refunded" }).where(eq(schema.raffleOrders.id, refunded.id));
    await state.db.update(schema.raffleTickets).set({ void: true }).where(eq(schema.raffleTickets.orderId, refunded.id));

    expect((await startRaffleDraw(drawInput())).error).toBeNull();
    const draw = await theDraw();
    expect(draw.results.map((r) => r.rank)).toEqual([3, 2, 1]);
    expect(draw.poolSize).toBe(6);
    expect(draw.poolSnapshot.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(draw.results.map((r) => r.orderId)).size).toBe(3);
    expect(draw.results.every((r) => r.orderId !== refunded.id)).toBe(true);
    expect((await startRaffleDraw(drawInput())).error).toMatch(/already been drawn/);
  });

  it("records a physical draw, checking every number", async () => {
    await drawableRaffle(2);
    const input = (nums: number[], onePerPerson = true) => drawInput({ method: "physical", prizeOrder: [1, 2], physicalNumbers: nums, onePerPerson });
    expect((await startRaffleDraw(input([1, 99]))).error).toMatch(/#0099 isn't a valid ticket/);
    expect((await startRaffleDraw(input([1, 1]))).error).toMatch(/twice/);
    expect((await startRaffleDraw(input([1, 2]))).error).toMatch(/only win once/);
    expect((await startRaffleDraw(input([1, 2], false))).error).toBeNull();
    expect((await theDraw()).results.map((r) => r.ticketNumber)).toEqual([1, 2]);
  });

  it("redraws from the frozen pool, skipping everyone who has won, and keeps the history", async () => {
    await drawableRaffle(2);
    await startRaffleDraw(drawInput({ prizeOrder: [1, 2] }));
    const before = await theDraw();
    expect((await redrawRafflePrize("r1", 1, " ")).error).toMatch(/reason/);
    expect((await redrawRafflePrize("r1", 1, "Winner is under 18")).error).toBeNull();
    const after = await theDraw();
    const first = after.results.find((r) => r.rank === 1)!;
    const others = before.results.map((r) => r.orderId);
    expect(others).not.toContain(first.orderId);
    expect(first.history).toEqual([expect.objectContaining({ ticketNumber: before.results[0].ticketNumber, reason: "Winner is under 18" })]);
    // Three entrants, two prizes: after one redraw nobody is left.
    expect((await redrawRafflePrize("r1", 1, "No reply by the claim date")).error).toMatch(/nobody left/);
  });

  it("publishes: one email per person, winners get the winner email instead, trustees get the summary", async () => {
    await drawableRaffle();
    await startRaffleDraw(drawInput());
    const result = await publishRaffleResults("r1");
    expect(result.error).toBeNull();
    const sent = state.send.mock.calls.map((c) => c[0] as { To: string; Subject: string; TextBody: string });
    const to = sent.map((m) => m.To).sort();
    // Sam and Jo both won (3 entrants, 3 prizes, one each), Barbara has no email.
    expect(to).toEqual(["jo@example.test", "sam@example.test", "trust@example.test"]);
    expect(sent.filter((m) => m.Subject.startsWith("You've won"))).toHaveLength(2);
    const manager = sent.find((m) => m.To === "trust@example.test")!;
    expect(manager.TextBody).toContain("Barbara Hughes");
    expect(manager.TextBody).toContain("07700 900123");
    expect(result.summary?.noEmail).toEqual([expect.objectContaining({ name: "Barbara Hughes", prize: expect.any(String) })]);
    expect((await theDraw()).publishedAt).not.toBeNull();

    state.send.mockClear();
    expect((await retryRaffleDrawEmails("r1")).error).toBeNull();
    expect(state.send).not.toHaveBeenCalled();
  });

  it("sends the results email to non-winners with their own numbers, and retries only failures", async () => {
    await drawableRaffle(1);
    // Pin the winner: Jo holds tickets 4 and 5.
    await startRaffleDraw(drawInput({ method: "physical", prizeOrder: [1], physicalNumbers: [4] }));
    state.send.mockImplementation(async ({ To }: { To: string }) => {
      if (To === "jo@example.test") throw new Error("Inactive recipient");
      return { MessageID: "m" };
    });
    const result = await publishRaffleResults("r1");
    expect(result.summary).toMatchObject({ winnerEmails: 1, resultsEmails: 1, failed: 1 });
    const mails = state.send.mock.calls.map((c) => c[0] as { To: string; Subject: string; TextBody: string });
    const sam = mails.find((m) => m.To === "sam@example.test")!;
    expect(sam.Subject).toContain("did you win");
    expect(sam.TextBody).toContain("0001–0003");
    expect(sam.TextBody).toContain("#0004 · Jo S.");
    const jo = mails.find((m) => m.To === "jo@example.test")!;
    expect(jo.Subject).toBe("You've won Prize 1!");
    expect(jo.TextBody).toContain("Your other tickets in this draw: 0005");
    expect(jo.TextBody).toContain("photo ID");

    state.send.mockReset().mockResolvedValue({ MessageID: "retry" });
    await retryRaffleDrawEmails("r1");
    expect(state.send.mock.calls.map((c) => c[0].To)).toEqual(["jo@example.test"]);
  });

  it("after publishing, a redraw emails only the new winner", async () => {
    await drawableRaffle(1);
    await startRaffleDraw(drawInput({ prizeOrder: [1] }));
    await publishRaffleResults("r1");
    state.send.mockClear();
    await redrawRafflePrize("r1", 1, "Winner declined the prize");
    const draw = await theDraw();
    const [newWinner] = await state.db.select().from(schema.raffleOrders).where(eq(schema.raffleOrders.id, draw.results[0].orderId));
    const calls = state.send.mock.calls.map((c) => c[0]);
    if (newWinner.email) {
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ To: newWinner.email, Subject: expect.stringContaining("You've won") });
    } else {
      expect(calls).toHaveLength(0);
    }
  });

  it("checks tickets publicly only once results are published", async () => {
    await drawableRaffle(1);
    await startRaffleDraw(drawInput({ prizeOrder: [1] }));
    const winning = (await theDraw()).results[0].ticketNumber;
    expect(await checkRaffleTicket("r1", String(winning))).toEqual({ status: "unknown" });
    await publishRaffleResults("r1");
    expect(await checkRaffleTicket("r1", `#${winning}`)).toMatchObject({ status: "won", prize: "Prize 1" });
    const losing = [1, 2, 3, 4, 5, 6].find((n) => n !== winning)!;
    expect(await checkRaffleTicket("r1", String(losing))).toEqual({ status: "lost" });
    expect(await checkRaffleTicket("r1", "999")).toEqual({ status: "unknown" });
  });

  it("shows winners publicly as first name and initial", () => {
    expect(publicName("Jo Smith")).toBe("Jo S.");
    expect(publicName("  mary anne  o'brien ")).toBe("mary O.");
    expect(publicName("Cher")).toBe("Cher");
  });
});

function interestForm(email: string, raffleId = "") {
  const form = new FormData();
  form.set("email", email);
  form.set("raffleId", raffleId);
  return form;
}

describe("notify me and the hourly raffle emails", () => {
  it("records a reminder sign-up once, and rejects bad input", async () => {
    await raffle({ salesOpenAt: new Date("2026-11-20T09:00:00Z") });
    expect((await registerRaffleInterest({ ok: false, message: "" }, interestForm("nope"))).ok).toBe(false);
    expect((await registerRaffleInterest({ ok: false, message: "" }, interestForm("a@example.test", "missing"))).ok).toBe(false);
    await registerRaffleInterest({ ok: false, message: "" }, interestForm("A@Example.test", "r1"));
    await registerRaffleInterest({ ok: false, message: "" }, interestForm("a@example.test", "r1"));
    await registerRaffleInterest({ ok: false, message: "" }, interestForm("next@example.test"));
    await registerRaffleInterest({ ok: false, message: "" }, interestForm("next@example.test"));
    const rows = await state.db.select().from(schema.raffleInterest);
    expect(rows.map((r) => r.email).sort()).toEqual(["a@example.test", "next@example.test"]);
  });

  it("emails sign-ups and past entrants once when sales open, skipping anyone who opted out", async () => {
    await raffle({ id: "old", slug: "old", salesOpenAt: new Date("2026-10-01T09:00:00Z"), salesCloseAt: new Date("2026-10-30T19:00:00Z"), drawAt: new Date("2026-10-30T20:00:00Z") });
    await raffle({ salesOpenAt: new Date("2026-11-20T09:00:00Z") });
    await order({ raffleId: "old", email: "fan@example.test", status: "paid", paidAt: NOW });
    await order({ raffleId: "old", email: "quiet@example.test", status: "paid", paidAt: NOW, marketingOptOut: true });
    await registerRaffleInterest({ ok: false, message: "" }, interestForm("asked@example.test", "r1"));
    await registerRaffleInterest({ ok: false, message: "" }, interestForm("quiet@example.test"));

    expect(await sendRaffleOnSaleEmails(new Date("2026-11-20T08:00:00Z"))).toBe(0);
    expect(await sendRaffleOnSaleEmails(new Date("2026-11-20T09:30:00Z"))).toBe(3);
    const to = state.send.mock.calls.map((c) => c[0].To).sort();
    expect(to).toEqual(["admin@example.test", "asked@example.test", "fan@example.test"]);
    expect(state.send.mock.calls[0][0].TextBody).toContain("/raffles/unsubscribe?e=");
    expect(await sendRaffleOnSaleEmails(new Date("2026-11-20T10:30:00Z"))).toBe(0);
  });

  it("emails everyone the Trust holds an address for at launch, once each, minus unsubscribes", async () => {
    await raffle({ salesOpenAt: new Date("2026-11-20T09:00:00Z") });
    await state.db.insert(schema.lotteryTickets).values([
      { name: "Lottery Player", email: "Player@Example.test", amount: 100, expiryDate: NOW },
      { name: "Lottery Player", email: "player@example.test", amount: 100, expiryDate: NOW },
      { name: "Gone", email: "gone@example.test", amount: 100, expiryDate: NOW },
    ]);
    await state.db.insert(schema.newsletterSubscribers).values([
      { email: "reader@example.test" },
      { email: "left@example.test", status: "unsubscribed" },
    ]);
    await state.db.insert(schema.raffleEmailOptOuts).values({ email: "gone@example.test" });

    expect(await sendRaffleOnSaleEmails(new Date("2026-11-20T09:30:00Z"))).toBe(3);
    const to = state.send.mock.calls.map((c) => c[0].To).sort();
    expect(to).toEqual(["admin@example.test", "player@example.test", "reader@example.test"]);
  });

  it("reminds entrants on the morning of the draw only, once, with their numbers", async () => {
    await raffle({ maxTickets: null });
    const o = await order({ email: "sam@example.test", quantity: 2, status: "pending" });
    await markOrderPaid(o.id, { paidAt: NOW });
    await ensureRaffleTickets(o.id);
    expect(await sendRaffleDrawReminders(new Date("2026-11-29T10:00:00Z"))).toBe(0);
    expect(await sendRaffleDrawReminders(new Date("2026-11-30T08:00:00Z"))).toBe(0);
    expect(await sendRaffleDrawReminders(new Date("2026-11-30T10:00:00Z"))).toBe(1);
    expect(state.send.mock.calls[0][0].TextBody).toContain("0001–0002");
    expect(await sendRaffleDrawReminders(new Date("2026-11-30T11:00:00Z"))).toBe(0);
  });

  it("only unsubscribes with a valid signed link", () => {
    const token = unsubscribeToken("Sam@Example.test");
    expect(verifyUnsubscribeToken("sam@example.test", token)).toBe(true);
    expect(verifyUnsubscribeToken("someone@example.test", token)).toBe(false);
    expect(verifyUnsubscribeToken("sam@example.test", "forged")).toBe(false);
  });
});

describe("cross-selling the raffle", () => {
  it("promotes the featured raffle with an urgent label, and nothing when none is on", async () => {
    expect(await getRafflePromo()).toBeNull();
    await raffle({ featured: true, maxTickets: 100, ticketsReserved: 95 });
    expect(await getRafflePromo()).toMatchObject({ slug: "november", price: "£2", label: "Only 5 left", onSale: true });
  });

  it("adds the raffle line to emails that ask for {{rafflePromo}}, and tidies it away when there's none", async () => {
    await sendTemplateEmail({ key: "lottery_welcome", to: "a@example.test", variables: { name: "A", quantity: 1, ticketNumbers: "7" } });
    const without = state.send.mock.calls[0][0].TextBody as string;
    expect(without.endsWith("Every ticket helps maintain our village facilities.")).toBe(true);

    await raffle({ featured: true });
    resetRafflePromoMemo();
    expect(await rafflePromoText()).toContain("/raffles/november");
    await sendTemplateEmail({ key: "lottery_welcome", to: "b@example.test", variables: { name: "B", quantity: 1, ticketNumbers: "8" } });
    expect(state.send.mock.calls[1][0].TextBody).toContain("This month's raffle: Win a wheelbarrow of booze. £2 a ticket");
  });

  it("migration 0030 adds the line to stored templates once, keeping edited wording", async () => {
    await state.db.insert(schema.emailTemplates).values([
      { key: "lottery_welcome", category: "lottery", name: "x", description: "x", subject: "s", body: "Edited by a trustee.", variables: ["name"] },
      { key: "booking_confirmation", category: "bookings", name: "x", description: "x", subject: "s", body: "Already {{rafflePromo}}", variables: ["rafflePromo"] },
    ]);
    const sqlText = readFileSync("drizzle/migrations/0030_raffle_email_promo.sql", "utf8");
    await pg.exec(sqlText);
    await pg.exec(sqlText);
    const rows = await state.db.select().from(schema.emailTemplates);
    const welcome = rows.find((r) => r.key === "lottery_welcome")!;
    expect(welcome.body).toBe("Edited by a trustee.\n\n{{rafflePromo}}");
    expect(welcome.variables).toEqual(["name", "rafflePromo"]);
    expect(rows.find((r) => r.key === "booking_confirmation")!.body).toBe("Already {{rafflePromo}}");
  });
});

describe("council return", () => {
  const prizes = [
    { rank: 1, title: "Booze", valuePence: 15000, costPence: 0 },
    { rank: 2, title: "Voucher", valuePence: 2500, costPence: 2500 },
  ];
  it("works out proceeds, costs and the share to the Trust's purposes", () => {
    const r = computeRaffleReturn({
      prizes, drawAt: new Date("2026-11-30T20:00:00Z"), otherExpensesPence: 600, yearProceeds: 741_400,
      orders: [
        { quantity: 400, amount: 80_000, refundedAmount: 0, stripeFeePence: 1800, status: "paid" },
        { quantity: 100, amount: 20_000, refundedAmount: 0, stripeFeePence: 0, status: "paid" },
        { quantity: 3, amount: 600, refundedAmount: 600, stripeFeePence: 30, status: "refunded" },
      ],
    });
    expect(r).toMatchObject({ ticketsSold: 500, proceeds: 100_000, prizesBought: 2500, prizesDonatedValue: 15000, stripeFees: 1830, otherExpenses: 600 });
    expect(r.toPurposes).toBe(100_000 - 2500 - 1830 - 600);
    expect(r.shareToPurposes).toBeCloseTo(0.9507, 3);
    expect(r.dueBy.toISOString()).toBe("2027-02-28T20:00:00.000Z");
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });
  it("flags a lottery that breaks the limits", () => {
    const r = computeRaffleReturn({
      prizes: [{ rank: 1, title: "Car", valuePence: 3_000_000, costPence: 2_500_000 }],
      drawAt: new Date("2026-11-30T20:00:00Z"), otherExpensesPence: 0, yearProceeds: 26_000_000,
      orders: [{ quantity: 10_500, amount: 2_100_000, refundedAmount: 0, stripeFeePence: 0, status: "paid" }],
    });
    expect(r.checks.map((c) => c.ok)).toEqual([false, false, false, false]);
  });
  it("includes the monthly lottery in the year total, and reminds about unsubmitted returns", async () => {
    await raffle({ prizes });
    await order({ status: "paid", paidAt: NOW, amount: 1000 });
    const [ticket] = await state.db.insert(schema.lotteryTickets).values({ source: "manual", name: "L", email: "l@example.test",
      amount: 1200, expiryDate: new Date("2027-11-01") }).returning();
    await state.db.insert(schema.lotteryPayments).values({ ticketId: ticket.id, source: "manual", reference: "x", amount: 1200, paidAt: NOW });
    const data = await getRaffleReturn("r1");
    expect(data?.figures).toMatchObject({ proceeds: 1000, yearProceeds: 2200 });

    expect(await getDueRaffleReturns(new Date("2027-01-15T00:00:00Z"))).toHaveLength(0);
    await state.db.insert(schema.raffleDraws).values({ raffleId: "r1", method: "system", poolSize: 5, poolChecksum: "x", poolSnapshot: [], results: [], drawnAt: NOW });
    expect(await getDueRaffleReturns(new Date("2027-01-15T00:00:00Z"))).toHaveLength(0);
    expect(await getDueRaffleReturns(new Date("2027-02-10T00:00:00Z"))).toMatchObject([{ id: "r1", overdue: false }]);
    expect(await getDueRaffleReturns(new Date("2027-03-10T00:00:00Z"))).toMatchObject([{ id: "r1", overdue: true }]);
    await state.db.update(schema.raffles).set({ returnSubmittedAt: NOW });
    expect(await getDueRaffleReturns(new Date("2027-03-10T00:00:00Z"))).toHaveLength(0);
  });
});
