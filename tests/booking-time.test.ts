import { describe, expect, it } from "vitest";
import { earliestBookingDate } from "@/lib/booking-time";

describe("earliest booking date", () => {
  const now = new Date("2026-10-16T09:30:00Z");

  it.each(["admin", "editor"])("allows %s to book today but not yesterday", (role) => {
    const earliest = earliestBookingDate(role, now);
    expect(earliest.toISOString()).toBe("2026-10-16T00:00:00.000Z");
    expect(new Date("2026-10-15T18:00:00Z") < earliest).toBe(true);
    expect(new Date("2026-10-16T18:00:00Z") >= earliest).toBe(true);
  });

  it.each([undefined, "customer", "member", "unknown"])("requires tomorrow for role %s", (role) => {
    expect(earliestBookingDate(role, now).toISOString()).toBe("2026-10-17T00:00:00.000Z");
  });

  it("uses the UK day during the summer-time midnight boundary", () => {
    const midnight = new Date("2026-10-16T23:30:00Z");
    expect(earliestBookingDate("admin", midnight).toISOString()).toBe("2026-10-17T00:00:00.000Z");
    expect(earliestBookingDate(undefined, midnight).toISOString()).toBe("2026-10-18T00:00:00.000Z");
  });

  it("rolls public bookings into the next year", () => {
    expect(earliestBookingDate(undefined, new Date("2026-12-31T18:00:00Z")).toISOString())
      .toBe("2027-01-01T00:00:00.000Z");
  });
});
