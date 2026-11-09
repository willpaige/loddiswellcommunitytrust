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

let pg: PGlite;
beforeAll(async () => {
  process.env.POSTMARK_API_KEY = "test";
  pg = new PGlite(); state.db = drizzle(pg, { schema });
  const exported = execFileSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "export"], { encoding: "utf8" });
  await pg.exec(exported.slice(exported.indexOf("CREATE TABLE")));
  await state.db.insert(schema.users).values({ id: "admin", email: "admin@example.test", role: "admin" });
});
afterAll(async () => { await pg?.close(); });
beforeEach(async () => {
  await pg.exec("TRUNCATE raffles, raffle_orders, raffle_tickets, raffle_draws, raffle_interest, email_logs, email_templates, audit_log CASCADE");
  state.session = { user: { id: "admin", email: "admin@example.test", role: "admin" } };
  state.send.mockReset().mockResolvedValue({ MessageID: "msg" });
  state.createSession.mockReset().mockImplementation(async () => ({ id: `cs_${Math.random().toString(36).slice(2)}`, url: "https://checkout.stripe.test/pay" }));
  state.createRefund.mockReset().mockResolvedValue({ id: "re_1" });
  state.retrieveIntent.mockReset().mockResolvedValue({ latest_charge: { balance_transaction: { fee: 35 } } });
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW);
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
