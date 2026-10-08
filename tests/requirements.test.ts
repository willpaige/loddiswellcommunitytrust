import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle<typeof schema>>,
  session: null as null | { user: { id: string; email: string; role: string } },
  send: vi.fn(), delivery: vi.fn(), head: vi.fn(), removeBlob: vi.fn() }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@vercel/blob", () => ({ head: state.head, del: state.removeBlob }));
vi.mock("postmark", () => ({ ServerClient: class { sendEmail = state.send; getOutboundMessageDetails = state.delivery; } }));

import { getBookingRequirementDetail, getBookingRequirementStatuses } from "@/lib/booking-requirements";
import { saveRequirementAnswers, uploadRequirementDocument, deleteRequirementDocument, getCustomerBookingRequirements, authorizeRequirementUpload } from "@/actions/booking-requirements";
import { getNextRequirementSessions } from "@/lib/requirement-schedule";
import { requirementStage, requirementNow, requirementRetryAt } from "@/lib/requirement-policy";
import { sendDueRequirementReminders, sendRequirementRequest } from "@/lib/requirement-reminders";
import { getRequirementQueue, resendRequirementRequest } from "@/actions/requirement-queue";
import { renderBodyTextAsHtml } from "@/lib/email/render";
import RequirementsPage from "@/app/account/bookings/[id]/requirements/page";

let pg: PGlite;
const now = new Date("2026-10-07T08:00:00Z");
beforeAll(async () => {
  pg = new PGlite(); state.db = drizzle(pg, { schema });
  // Historical migrations begin after an externally-created baseline. Build
  // that baseline from the actual schema, then exercise our real migration.
  const exported = execFileSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "export"], { encoding: "utf8" });
  await pg.exec(exported.slice(exported.indexOf("CREATE TABLE")));
  await pg.exec('DROP TABLE booking_requirement_messages; ALTER TABLE bookings DROP COLUMN requirement_completed_at, DROP COLUMN requirement_review_after; DROP INDEX booking_requirement_documents_url_idx;');
  await pg.exec(readFileSync("drizzle/migrations/0027_booking_requirement_flow.sql", "utf8"));
});
afterAll(async () => { vi.useRealTimers(); await pg?.close(); });
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
  await pg.exec("TRUNCATE users, facilities, requirement_sets, site_settings, email_templates, email_logs, audit_log CASCADE");
  process.env.POSTMARK_API_KEY = "test-token"; process.env.NEXT_PUBLIC_APP_URL = "https://example.test";
  state.send.mockReset().mockResolvedValue({ MessageID: "test-message" });
  state.delivery.mockReset().mockResolvedValue({ MessageEvents: [{ Type: "Delivered" }] });
  state.head.mockReset(); state.removeBlob.mockReset().mockResolvedValue(undefined);
  await state.db.insert(schema.users).values({ id: "guest", email: "guest@example.test", role: "customer" });
  state.session = { user: { id: "guest", email: "guest@example.test", role: "customer" } };
  await state.db.insert(schema.facilities).values({ id: "hall", slug: "hall", name: "Village hall" });
  await state.db.insert(schema.siteSettings).values({ id: "settings", emailAddress: "hello@example.test" });
  await state.db.insert(schema.requirementSets).values({ id: "set", name: "Hire information" });
  await state.db.insert(schema.requirementQuestions).values([
    { id: "insurance", setId: "set", label: "Do you need insurance?", type: "yes_no", requiresDocumentOnYes: true, updatedAt: new Date("2026-01-01") },
    { id: "purpose", setId: "set", label: "Purpose", type: "text", updatedAt: new Date("2026-01-01") },
  ]);
});

async function booking(id = "booking", start = "2026-10-20T12:00:00Z", status: "confirmed" | "cancelled" | "pending_payment" = "confirmed") {
  await state.db.insert(schema.bookings).values({ id, facilityId: "hall", customerGroup: "team_community", customerName: "Guest", customerEmail: "guest@example.test", status,
    startDate: new Date(start), endDate: new Date(new Date(start).getTime() + 3600_000), requirementSetId: "set" });
  await state.db.insert(schema.bookingOccurrences).values({ bookingId: id, facilityId: "hall", startDate: new Date(start), endDate: new Date(new Date(start).getTime() + 3600_000), status });
}
function answers(id = "booking", values = { insurance: "no", purpose: "Community event" }) {
  const form = new FormData(); form.set("bookingId", id);
  Object.entries(values).forEach(([key, value]) => form.set(`answer_${key}`, value)); return form;
}

describe("form persistence and access", () => {
  it("redirects an email link through sign-in and preserves its destination", async () => {
    state.session = null;
    await expect(RequirementsPage({ params: Promise.resolve({ id: "booking" }) })).rejects.toMatchObject({ digest: expect.stringContaining("/account/login?callbackUrl=%2Faccount%2Fbookings%2Fbooking%2Frequirements") });
  });
  it("saves partial answers without erasing others, persists completion and stops chasing", async () => {
    await booking();
    await saveRequirementAnswers(answers());
    expect((await getBookingRequirementDetail("booking", "set")).complete).toBe(true);
    const partial = new FormData(); partial.set("bookingId", "booking"); partial.set("answer_purpose", "Changed event");
    await saveRequirementAnswers(partial);
    const [row] = await state.db.select().from(schema.bookings);
    expect(row.requirementCompletedAt).toEqual(now);
    expect((await getBookingRequirementStatuses(["booking"])).get("booking")?.complete).toBe(true);
    expect((await sendDueRequirementReminders()).sent).toBe(0);
    partial.set("answer_purpose", "  "); await saveRequirementAnswers(partial);
    expect((await getBookingRequirementDetail("booking", "set")).complete).toBe(false);
    expect((await state.db.select().from(schema.bookings))[0].requirementCompletedAt).toBeNull();
  });
  it("requires a document for yes; verifies stored metadata, accepts 10 MB and deduplicates retries", async () => {
    await booking(); await saveRequirementAnswers(answers("booking", { insurance: "yes", purpose: "Party" }));
    expect((await getBookingRequirementDetail("booking", "set")).complete).toBe(false);
    const pathname = "booking-documents/booking/insurance/test.pdf";
    const url = `https://test.public.blob.vercel-storage.com/${pathname}`;
    state.head.mockResolvedValue({ pathname, url, size: 10 * 1024 * 1024, contentType: "application/pdf" });
    const form = new FormData(); form.set("bookingId", "booking"); form.set("questionId", "insurance"); form.set("url", url); form.set("fileName", "insurance.pdf");
    expect((await uploadRequirementDocument(form)).complete).toBe(true);
    await uploadRequirementDocument(form);
    const docs = await state.db.select().from(schema.bookingRequirementDocuments); expect(docs).toHaveLength(1);
    const remove = new FormData(); remove.set("documentId", docs[0].id); await deleteRequirementDocument(remove);
    expect((await getBookingRequirementDetail("booking", "set")).complete).toBe(false);
    state.head.mockResolvedValue({ pathname, url, size: 10 * 1024 * 1024 + 1, contentType: "application/pdf" });
    await expect(uploadRequirementDocument(form)).rejects.toThrow(/10 MB/);
    form.set("url", "https://example.com/forged.pdf"); await expect(uploadRequirementDocument(form)).rejects.toThrow(/Invalid document/);
  });
  it("rejects anonymous, other-customer, cancelled and finished booking edits", async () => {
    await booking(); state.session = null; await expect(saveRequirementAnswers(answers())).rejects.toThrow("Unauthorized");
    state.session = { user: { id: "guest", email: "other@example.test", role: "customer" } };
    await expect(getCustomerBookingRequirements("booking")).rejects.toThrow("Booking not found");
    state.session.user.email = "guest@example.test";
    await booking("past", "2026-09-01T12:00:00Z"); await expect(saveRequirementAnswers(answers("past"))).rejects.toThrow("no upcoming sessions");
    await booking("cancelled", undefined, "cancelled"); await expect(saveRequirementAnswers(answers("cancelled"))).rejects.toThrow("cancelled");
    await expect(authorizeRequirementUpload("booking", "insurance")).rejects.toThrow("Save a yes answer");
  });
  it("keeps a started recurring series editable using the next session", async () => {
    await booking("booking", "2026-09-01T12:00:00Z");
    await state.db.insert(schema.bookingOccurrences).values({ bookingId: "booking", facilityId: "hall", startDate: new Date("2026-10-14T12:00:00Z"), endDate: new Date("2026-10-14T13:00:00Z"), status: "confirmed" });
    expect((await getCustomerBookingRequirements("booking")).booking.startDatePast).toBe(false);
    expect((await getNextRequirementSessions(["booking"])).get("booking")).toEqual(new Date("2026-10-14T12:00:00Z"));
    expect((await saveRequirementAnswers(answers())).complete).toBe(true);
  });
  it("requests fresh answers only when a question's requirements change", async () => {
    await booking(); await saveRequirementAnswers(answers());
    await state.db.update(schema.requirementQuestions).set({ label: "Updated purpose", updatedAt: new Date(now.getTime() + 1) }).where(eq(schema.requirementQuestions.id, "purpose"));
    const detail = await getBookingRequirementDetail("booking", "set"); expect(detail.complete).toBe(false);
    expect(detail.questions.find(q => q.questionId === "insurance")?.answered).toBe(true);
    expect((await getBookingRequirementStatuses(["booking"])).get("booking")?.complete).toBe(false);
  });
  it("requires a fresh form after a relevant booking change, retaining historical answers", async () => {
    await booking(); await saveRequirementAnswers(answers());
    vi.setSystemTime(new Date(now.getTime() + 60_000));
    await state.db.update(schema.bookings).set({ requirementReviewAfter: new Date(), requirementCompletedAt: null }).where(eq(schema.bookings.id, "booking"));
    expect((await getBookingRequirementDetail("booking", "set")).questions.every(q => !q.answered)).toBe(true);
    expect(await state.db.select().from(schema.bookingRequirementResponses)).toHaveLength(2);
    expect((await sendRequirementRequest("booking")).sent).toBe(1);
  });
});

it("adds form links to existing customized templates without overwriting or duplicating them", async () => {
  await state.db.insert(schema.emailTemplates).values({ id: "custom", key: "booking_confirmation", category: "bookings", name: "Custom", subject: "My subject", body: "My custom confirmation wording", variables: [] });
  const migration = readFileSync("drizzle/migrations/0027_booking_requirement_flow.sql", "utf8");
  const updates = migration.slice(migration.indexOf("UPDATE email_templates"));
  await pg.exec(updates); await pg.exec(updates);
  const [template] = await state.db.select().from(schema.emailTemplates);
  expect(template.body).toBe("My custom confirmation wording\n\n{{requirementsNotice}}");
  expect(template.subject).toBe("My subject");
  expect(template.variables).toEqual(["requirementsNotice"]);
});

it("renders clickable form URLs while escaping customer HTML", () => {
  const html = renderBodyTextAsHtml('<script>bad</script>\n\nhttps://example.test/form?a=1&b=2');
  expect(html).not.toContain('<script>');
  expect(html).toContain('<a href="https://example.test/form?a=1&amp;b=2">');
});

describe("durable reminders", () => {
  it("alerts the manager when an accepted message subsequently bounces", async () => {
    await booking(); await sendRequirementRequest("booking");
    state.delivery.mockResolvedValue({ MessageEvents: [{ Type: "Bounced" }] });
    await sendDueRequirementReminders();
    expect(state.send).toHaveBeenCalledTimes(2);
    expect(state.send.mock.calls[1][0].To).toBe("hello@example.test");
    await sendDueRequirementReminders(); expect(state.send).toHaveBeenCalledTimes(2);
    expect((await state.db.select().from(schema.bookingRequirementMessages)).find(m => m.kind === "customer")?.deliveryStatus).toBe("bounced");
  });
  it("sends immediately, does not duplicate simultaneous requests, and catches up missed milestones", async () => {
    await booking("booking", "2026-11-01T12:00:00Z");
    await Promise.all([sendRequirementRequest("booking"), sendRequirementRequest("booking")]);
    expect(state.send).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-10-27T08:00:00Z"));
    await sendDueRequirementReminders(); expect(state.send).toHaveBeenCalledTimes(2);
    await sendDueRequirementReminders(); expect(state.send).toHaveBeenCalledTimes(2);
    const records = await state.db.select().from(schema.bookingRequirementMessages);
    expect(records.some(m => m.stage.endsWith(":7d"))).toBe(true);
    expect(records.some(m => m.stage.endsWith(":14d"))).toBe(false);
  });
  it("handles short-notice bookings and independently alerts the manager", async () => {
    await booking("booking", "2026-10-08T12:00:00Z");
    await sendRequirementRequest("booking");
    expect(state.send.mock.calls.map(c => c[0].To).sort()).toEqual(["guest@example.test", "hello@example.test"]);
    expect(state.send.mock.calls[0][0].TextBody).toContain("complete this now");
  });
  it("continues after rejection, alerts the manager, backs off and retries", async () => {
    await booking(); await booking("second");
    state.send.mockImplementation(async ({ To }) => { if (To === "guest@example.test") throw new Error("Inactive recipient"); return { MessageID: "manager-message" }; });
    const result = await sendDueRequirementReminders(); expect(result.failed).toBe(2); expect(result.sent).toBe(2);
    const count = state.send.mock.calls.length;
    await sendDueRequirementReminders(); expect(state.send).toHaveBeenCalledTimes(count);
    vi.setSystemTime(new Date(now.getTime() + 3600_000)); state.send.mockResolvedValue({ MessageID: "recovered" });
    await sendDueRequirementReminders(); expect(state.send).toHaveBeenCalledTimes(count + 2);
    expect((await state.db.select().from(schema.bookingRequirementMessages)).filter(m => m.kind === "customer").every(m => m.status === "sent" && m.attempts === 2)).toBe(true);
  });
  it("records disabled templates as failures rather than pretending mail was sent", async () => {
    await booking(); await sendRequirementRequest("booking");
    await state.db.update(schema.emailTemplates).set({ enabled: false }).where(eq(schema.emailTemplates.key, "booking_requirements_customer"));
    const result = await sendRequirementRequest("booking", "manual-disabled"); expect(result.failed).toBe(1);
  });
  it("protects admin resends and supplies an actionable queue", async () => {
    await booking(); await expect(getRequirementQueue()).rejects.toThrow("Unauthorized");
    state.session!.user.role = "admin";
    expect((await getRequirementQueue()).rows[0].progress).toBe("Not started");
    const form = new FormData(); form.set("bookingId", "booking"); form.set("requestId", "test-request-00000001");
    expect((await resendRequirementRequest({ message: "" }, form)).message).toBe("Reminder sent.");
    await resendRequirementRequest({ message: "" }, form); expect(state.send).toHaveBeenCalledTimes(1);
    expect((await getRequirementQueue()).rows[0].delivery).toBe("Delivered to mail server");
  });
});

it("handles UK summer/winter time and exact reminder boundaries", () => {
  expect(requirementNow(new Date("2026-07-01T08:00:00Z")).toISOString()).toBe("2026-07-01T09:00:00.000Z");
  expect(requirementNow(new Date("2026-12-01T08:00:00Z")).toISOString()).toBe("2026-12-01T08:00:00.000Z");
  expect(requirementStage(new Date("2026-10-09T09:00:00Z"), requirementNow(now))).toBe("48h");
  expect(requirementStage(requirementNow(now), requirementNow(now))).toBeNull();
  expect(requirementRetryAt(10, now).getTime() - now.getTime()).toBe(24 * 3600_000);
});
