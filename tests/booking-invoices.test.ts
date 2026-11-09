import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { execFileSync } from "node:child_process";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle<typeof schema>>,
  stripe: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("@/lib/auth", () => ({ auth: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe: state.stripe }));
vi.mock("@/lib/email/send", () => ({ sendTemplateEmail: state.send }));
vi.mock("@/lib/requirement-reminders", () => ({ sendRequirementRequest: vi.fn() }));
import { runMonthlyInvoiceCycle } from "@/actions/bookings";
import { findInvoiceCoveringSessions } from "@/lib/booking-invoice-coverage";
import { monthPeriod } from "@/lib/booking-invoices";

let pg: PGlite;
const sessions = [5, 12, 19, 26].map(day => ({ startDate: new Date(`2026-10-${String(day).padStart(2, "0")}T18:00:00Z`) }));
beforeAll(async () => {
  pg = new PGlite(); state.db = drizzle(pg, { schema });
  const exported = execFileSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "export"], { encoding: "utf8" });
  await pg.exec(exported.slice(exported.indexOf("CREATE TABLE")));
});
afterAll(async () => { vi.useRealTimers(); await pg?.close(); });
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-07T08:00:00Z"));
  await pg.exec("TRUNCATE facilities, site_settings, audit_log CASCADE");
  state.stripe.mockReset().mockImplementation(() => { throw new Error("Unexpected Stripe call"); });
  state.send.mockReset().mockResolvedValue({ sent: true });
  await state.db.insert(schema.facilities).values({ id: "hall", slug: "hall", name: "Hall" });
  await state.db.insert(schema.bookings).values({ id: "booking", facilityId: "hall", customerName: "Test", customerEmail: "test@example.test",
    customerGroup: "business", status: "confirmed", paymentType: "invoice", amount: 2700, unitAmount: 1350, stripeCustomerId: "cus_test",
    startDate: sessions[0].startDate, endDate: new Date("2026-10-05T20:00:00Z") });
  await state.db.insert(schema.bookingOccurrences).values(sessions.map(session => ({ bookingId: "booking", facilityId: "hall",
    startDate: session.startDate, endDate: new Date(session.startDate.getTime() + 7200_000), status: "confirmed" as const })));
});
async function invoice(start = "2026-10-05T00:00:00Z", end = "2026-11-01T00:00:00Z", status: "paid" | "open" | "void" | "draft" = "paid") {
  await state.db.insert(schema.bookingInvoices).values({ id: "first", bookingId: "booking", periodStart: new Date(start), periodEnd: new Date(end),
    amount: 10800, sessionCount: 4, status, dueDate: new Date("2026-10-05"), paidOutOfBand: status === "paid" });
}
describe("monthly invoice session coverage", () => {
  it.each(["2026-10-05T00:00:00Z", "2026-10-04T23:00:00Z"])("does not invoice paid October sessions twice (first period %s)", async start => {
    await invoice(start);
    const result = await runMonthlyInvoiceCycle();
    expect(result).toMatchObject({ issued: 0, errors: [] });
    expect(await state.db.select().from(schema.bookingInvoices)).toHaveLength(1);
    expect(state.stripe).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled();
  });
  it("honours a first invoice that includes the following month", async () => {
    await invoice("2026-09-28T00:00:00Z");
    expect(await runMonthlyInvoiceCycle()).toMatchObject({ issued: 0, errors: [] });
    expect(state.stripe).not.toHaveBeenCalled();
  });
  it("stops on partial overlap rather than charging any session twice", async () => {
    await invoice("2026-10-05T00:00:00Z", "2026-10-19T00:00:00Z");
    const result = await runMonthlyInvoiceCycle();
    expect(result.issued).toBe(0); expect(result.errors[0]).toContain("overlap an existing invoice");
    expect(state.stripe).not.toHaveBeenCalled();
  });
  it("does not silently ignore overlapping unfinished drafts", async () => {
    await invoice("2026-10-05T00:00:00Z", undefined, "draft");
    await expect(findInvoiceCoveringSessions("booking", monthPeriod(2026, 9), sessions)).rejects.toThrow("overlap");
    expect(await findInvoiceCoveringSessions("booking", monthPeriod(2026, 9), sessions, "first")).toBeNull();
  });
  it("allows void invoices to be replaced and later months to be invoiced", async () => {
    await invoice("2026-10-05T00:00:00Z", undefined, "void");
    expect(await findInvoiceCoveringSessions("booking", monthPeriod(2026, 9), sessions)).toBeNull();
    await state.db.update(schema.bookingInvoices).set({ status: "paid" }).where(eq(schema.bookingInvoices.id, "first"));
    expect(await findInvoiceCoveringSessions("booking", monthPeriod(2026, 10), [{ startDate: new Date("2026-11-02T18:00:00Z") }])).toBeNull();
  });
  it("issues an uncovered month once and leaves the paid month alone", async () => {
    await invoice();
    vi.setSystemTime(new Date("2026-10-26T08:00:00Z"));
    await state.db.insert(schema.bookingOccurrences).values({ bookingId: "booking", facilityId: "hall",
      startDate: new Date("2026-11-02T18:00:00Z"), endDate: new Date("2026-11-02T20:00:00Z"), status: "confirmed" });
    const createItem = vi.fn().mockResolvedValue({ id: "ii_test" });
    const createInvoice = vi.fn().mockResolvedValue({ id: "in_test" });
    state.stripe.mockReturnValue({ invoiceItems: { create: createItem }, invoices: { create: createInvoice,
      finalizeInvoice: vi.fn().mockResolvedValue({ hosted_invoice_url: "https://example.test/invoice", invoice_pdf: null }) } });
    // mockReturnValue replaces the deliberately failing default implementation.
    expect(await runMonthlyInvoiceCycle()).toMatchObject({ issued: 1, errors: [] });
    expect(await runMonthlyInvoiceCycle()).toMatchObject({ issued: 0, errors: [] });
    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem.mock.calls[0][0].amount).toBe(2700);
    expect(createInvoice).toHaveBeenCalledTimes(1);
    expect(await state.db.select().from(schema.bookingInvoices)).toHaveLength(2);
  });
});
