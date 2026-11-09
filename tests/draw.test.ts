import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { execFileSync } from "node:child_process";
import * as schema from "@/lib/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle<typeof schema>>,
  session: { user: { id: "admin", email: "admin@example.test", role: "admin" } } as null | { user: { id: string; email: string; role: string } },
  send: vi.fn(), randomInt: vi.fn() }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("postmark", () => ({ ServerClient: class { sendEmail = state.send; } }));
vi.mock("node:crypto", async (original) => {
  const actual = await original<typeof import("node:crypto")>();
  return { ...actual, randomInt: (max: number) => { state.randomInt(max); return actual.randomInt(max); } };
});

import { pickWinners, secureShuffle } from "@/lib/draw/random";
import { drawRandomWinners, sendDrawNotifications } from "@/actions/lottery-admin";

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
  await pg.exec("TRUNCATE lottery_tickets, lottery_draws, email_logs, email_templates, audit_log CASCADE");
  state.send.mockReset().mockResolvedValue({ MessageID: "msg" });
  state.randomInt.mockReset();
});

// A fixed "random" source so ordering-dependent rules can be pinned down.
const first = () => 0;

describe("pickWinners", () => {
  const pool = Array.from({ length: 50 }, (_, i) => ({ ticket: i + 1, holder: `h${i % 5}` }));

  it("never picks the same entry twice", () => {
    for (let run = 0; run < 50; run++) {
      const winners = pickWinners(pool, 20);
      expect(new Set(winners.map((w) => w.ticket)).size).toBe(20);
    }
  });

  it("gives a holder at most one prize when a holder key is set", () => {
    const winners = pickWinners(pool, 10, { holderKey: (e) => e.holder });
    expect(winners).toHaveLength(5);
    expect(new Set(winners.map((w) => w.holder)).size).toBe(5);
  });

  it("leaves out excluded entries and earlier winners on a redraw", () => {
    const [redraw] = pickWinners(pool, 1, {
      holderKey: (e) => e.holder,
      excludeHolders: ["h0", "h1", "h2", "h3"],
      exclude: (e) => e.ticket === 5,
      rng: first,
    });
    expect(redraw.holder).toBe("h4");
    expect(redraw.ticket).not.toBe(5);
  });

  it("returns fewer winners than asked when the pool runs out, and none for zero", () => {
    expect(pickWinners(pool.slice(0, 3), 5)).toHaveLength(3);
    expect(pickWinners(pool, 0)).toEqual([]);
  });

  it("shuffles without changing the input", () => {
    const input = [1, 2, 3, 4];
    const out = secureShuffle(input);
    expect(input).toEqual([1, 2, 3, 4]);
    expect([...out].sort()).toEqual([1, 2, 3, 4]);
  });

  it("uses the cryptographic generator by default", () => {
    pickWinners(pool, 3);
    expect(state.randomInt).toHaveBeenCalled();
  });
});

async function subscriber(id: string, email: string, quantity = 1) {
  await state.db.insert(schema.lotteryTickets).values({ id, source: "manual", name: `Name ${id}`, email, quantity,
    amount: quantity * 1200, expiryDate: new Date("2027-12-31"), status: "active" });
}

describe("lottery draw on the shared code", () => {
  it("keeps the same result shape and one prize per holder", async () => {
    await subscriber("a", "a@example.test", 3);
    await subscriber("b", "b@example.test", 2);
    const result = await drawRandomWinners(5);
    expect(result.totalEntries).toBe(5);
    expect(result.uniqueSubscribers).toBe(2);
    expect(result.winners).toHaveLength(2);
    expect(new Set(result.winners.map((w) => w.email))).toEqual(new Set(["a@example.test", "b@example.test"]));
    for (const w of result.winners) expect(w).toMatchObject({ name: expect.any(String), ticketNumber: expect.any(Number) });
    expect(state.randomInt).toHaveBeenCalled();
  });

  it("sends once, refuses a second batch, and retries only the failed addresses", async () => {
    await subscriber("a", "a@example.test");
    await subscriber("b", "b@example.test");
    await subscriber("c", "bounce@example.test");
    const [draw] = await state.db.insert(schema.lotteryDraws)
      .values({ drawDate: new Date("2026-11-30"), results: [{ rank: 1, winner: "Name a", prize: "£50", ticketNumber: 1 }] })
      .returning();
    state.send.mockImplementation(async ({ To }: { To: string }) => {
      if (To.startsWith("bounce")) throw new Error("Inactive recipient");
      return { MessageID: `msg-${To}` };
    });

    expect(await sendDrawNotifications(draw.id)).toEqual({ sent: 2, failed: 1 });
    expect(await sendDrawNotifications(draw.id)).toMatchObject({ alreadySent: true });
    expect(state.send).toHaveBeenCalledTimes(3);

    state.send.mockClear().mockResolvedValue({ MessageID: "retry" });
    expect(await sendDrawNotifications(draw.id, { retry: true })).toEqual({ sent: 1, failed: 0 });
    expect(state.send).toHaveBeenCalledTimes(1);
    expect(state.send.mock.calls[0][0].To).toBe("bounce@example.test");
  });
});
