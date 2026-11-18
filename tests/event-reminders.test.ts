import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";

const state = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof drizzle<typeof schema>>,
  postmark: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("@/lib/raffles/promo", () => ({
  rafflePromoForEmail: async () => ({
    text: "Village raffle. £1 a ticket. https://example.test/raffles/village",
    card: { eyebrow: "Raffle on now", title: "Village raffle", text: "£1 a ticket", url: "https://example.test/raffles/village" },
  }),
}));
vi.mock("postmark", async (importOriginal) => ({
  ...await importOriginal<typeof import("postmark")>(),
  ServerClient: class { sendEmail = state.postmark; },
}));

import { sendEventReminders } from "@/lib/email/event-reminders";

let pg: PGlite;
beforeAll(async () => {
  pg = new PGlite();
  state.db = drizzle(pg, { schema });
  const exported = execFileSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "export"], { encoding: "utf8" });
  await pg.exec(exported.slice(exported.indexOf("CREATE TABLE")));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
afterAll(async () => { await pg?.close(); });

it("sends tomorrow's published reminder at 10am UK time and retries only failed recipients", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.stubEnv("POSTMARK_API_KEY", "test");
  vi.stubEnv("POSTMARK_BROADCAST_STREAM", "trust-news");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
  vi.setSystemTime(new Date("2026-07-19T08:59:00Z"));
  const tomorrow = new Date("2026-07-20T09:30:00Z");
  await state.db.insert(schema.events).values([
    { id: "coffee", title: "Coffee Morning", location: "Village Hall", startDate: tomorrow, reminderEnabled: true },
    { id: "quiz", title: "Quiz Night", startDate: new Date("2026-07-22T19:00:00Z"), reminderEnabled: true },
    { id: "draft", title: "Draft event", startDate: tomorrow, published: false, reminderEnabled: true },
    { id: "no-reminder", title: "Evening walk", startDate: new Date("2026-07-23T19:00:00Z") },
  ]);
  await state.db.insert(schema.newsletterSubscribers).values([
    { email: "one@example.test" },
    { email: "two@example.test" },
    { email: "ONE@example.test" },
    { email: "three@example.test", status: "unsubscribed" },
    { email: "THREE@example.test" },
  ]);
  state.postmark.mockResolvedValueOnce({ MessageID: "first" })
    .mockRejectedValueOnce(new Error("Temporary provider failure"))
    .mockResolvedValueOnce({ MessageID: "second" });

  expect(await sendEventReminders()).toEqual({ sent: 0, failed: 0 });
  expect(state.postmark).not.toHaveBeenCalled();

  vi.setSystemTime(new Date("2026-07-19T09:00:00Z"));
  const runs = await Promise.all([sendEventReminders(), sendEventReminders()]);
  expect(runs.reduce((count, result) => count + result.sent, 0)).toBe(1);
  expect(runs.reduce((count, result) => count + result.failed, 0)).toBe(1);
  expect(state.postmark.mock.calls.map(([message]) => message.To)).toEqual(["one@example.test", "two@example.test"]);
  const [message] = state.postmark.mock.calls[0];
  expect(message).toMatchObject({ Subject: "Tomorrow in Loddiswell: Coffee Morning", MessageStream: "trust-news" });
  expect(message.HtmlBody).toContain("Monday 20 July, 9:30am");
  expect(message.HtmlBody).toContain("/events#event-coffee");
  expect(message.HtmlBody).toContain("/events#event-quiz");
  expect(message.HtmlBody).toContain("/raffles/village");
  expect(message.HtmlBody).toContain("/lottery");
  expect(message.HtmlBody).toContain("{{{ pm:unsubscribe }}}");
  expect(message.TextBody).toContain("/events#event-quiz");

  vi.setSystemTime(new Date("2026-07-19T10:00:00Z"));
  expect(await sendEventReminders()).toEqual({ sent: 1, failed: 0 });
  expect(state.postmark.mock.calls[2][0].To).toBe("two@example.test");
  expect(await sendEventReminders()).toEqual({ sent: 0, failed: 0 });
  expect(state.postmark).toHaveBeenCalledTimes(3);
});
