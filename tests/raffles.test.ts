import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { execFileSync } from "node:child_process";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle<typeof schema>>,
  session: { user: { id: "admin", email: "admin@example.test", role: "admin" } } as null | { user: { id: string; email: string; role: string } },
  send: vi.fn() }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { url }); } }));
vi.mock("postmark", () => ({ ServerClient: class { sendEmail = state.send; } }));

import { deriveRaffleState, ticketsRemaining } from "@/lib/raffles/state";
import { compressRanges, formatTicket } from "@/lib/raffles/numbers";
import { ukInputToDate, dateToUkInput } from "@/lib/raffles/time";
import { reserveTickets, releaseTickets } from "@/lib/raffles/capacity";
import { ensureRaffleTickets, markOrderPaid } from "@/lib/raffles/allocate";
import { createRaffle, updateRaffle, duplicateRaffle } from "@/actions/raffles";

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
