import { describe, expect, it } from "vitest";
import { unpaidHoldDeadline, unpaidHoldStep } from "@/lib/bookings";

const at = (iso: string) => new Date(iso);
const H = 60 * 60 * 1000;

describe("unpaidHoldDeadline", () => {
  it("holds for the configured days when the session is far off", () => {
    expect(unpaidHoldDeadline(at("2026-10-19T18:00:00Z"), at("2026-12-05T18:00:00Z"), 3)).toEqual(at("2026-10-22T18:00:00Z"));
  });
  it("ends 24 hours before a session that comes sooner", () => {
    expect(unpaidHoldDeadline(at("2026-11-18T12:00:00Z"), at("2026-11-20T18:00:00Z"), 3)).toEqual(at("2026-11-19T18:00:00Z"));
  });
  it("gives at least two hours, but never past the session start", () => {
    expect(unpaidHoldDeadline(at("2026-11-18T12:00:00Z"), at("2026-11-18T20:00:00Z"), 3)).toEqual(at("2026-11-18T14:00:00Z"));
    expect(unpaidHoldDeadline(at("2026-11-18T12:00:00Z"), at("2026-11-18T13:00:00Z"), 3)).toEqual(at("2026-11-18T13:00:00Z"));
  });
});

describe("unpaidHoldStep", () => {
  const createdAt = at("2026-11-18T12:00:00Z");
  const paymentDueAt = at("2026-11-21T12:00:00Z");
  const base = { createdAt, paymentDueAt, paymentReminderSentAt: null, paymentLastCallSentAt: null };
  const t = (hours: number) => new Date(createdAt.getTime() + hours * H);

  it("waits an hour, reminds once, then waits for the last call", () => {
    expect(unpaidHoldStep(base, t(0.5))).toBeNull();
    expect(unpaidHoldStep(base, t(1))).toBe("remind");
    expect(unpaidHoldStep({ ...base, paymentReminderSentAt: t(1) }, t(30))).toBeNull();
  });
  it("sends the last call 24 hours before the hold ends, once", () => {
    const reminded = { ...base, paymentReminderSentAt: t(1) };
    expect(unpaidHoldStep(reminded, t(48))).toBe("last_call");
    expect(unpaidHoldStep({ ...reminded, paymentLastCallSentAt: t(48) }, t(60))).toBeNull();
  });
  it("skips straight to the last call if the reminder was missed", () => {
    expect(unpaidHoldStep(base, t(50))).toBe("last_call");
  });
  it("releases once the hold has ended", () => {
    expect(unpaidHoldStep(base, t(72))).toBe("release");
  });
  it("gives a short hold just the reminder", () => {
    const short = { ...base, paymentDueAt: t(20) };
    expect(unpaidHoldStep(short, t(1))).toBe("remind");
    expect(unpaidHoldStep({ ...short, paymentReminderSentAt: t(1) }, t(19))).toBeNull();
    expect(unpaidHoldStep(short, t(20))).toBe("release");
  });
});
