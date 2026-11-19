import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "@/actions/events";
import { bookingBlocks, eventSeries, events } from "@/lib/db/schema";

const { batch, redirect } = vi.hoisted(() => ({
  batch: vi.fn(),
  redirect: vi.fn(() => { throw new Error("redirect"); }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: (table: unknown) => ({
      values: (rows: unknown) => ({ table, rows }),
    }),
    batch,
  },
}));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "staff", role: "editor" } }) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

function schedule(recurrence: string) {
  const form = new FormData();
  form.set("title", "Village event");
  form.set("recurringEvent", "on");
  form.set("recurrence", recurrence);
  form.set("seriesStartTime", "18:00");
  form.set("seriesEndTime", "21:00");
  return form;
}

describe("event scheduling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves each chosen date once with its own venue block and reminder setting", async () => {
    const form = schedule("selected_dates");
    for (const date of ["2027-01-22", "2027-01-08", "2027-01-22"]) {
      form.append("occurrenceDate", date);
    }
    form.set("blockBookings", "on");
    form.set("blockFacilityId", "hall");
    form.set("reminderEnabled", "on");

    await expect(createEvent(form)).rejects.toThrow("redirect");

    const [eventInsert, blockInsert] = batch.mock.calls[0][0];
    expect(eventInsert.table).toBe(events);
    expect(eventInsert.rows.map((row: { startDate: Date }) => row.startDate.toISOString())).toEqual([
      "2027-01-08T18:00:00.000Z",
      "2027-01-22T18:00:00.000Z",
    ]);
    expect(eventInsert.rows).toHaveLength(2);
    expect(blockInsert.table).toBe(bookingBlocks);
    expect(blockInsert.rows).toHaveLength(2);
    for (const [index, event] of eventInsert.rows.entries()) {
      expect(event.reminderEnabled).toBe(true);
      expect(blockInsert.rows[index]).toMatchObject({
        eventId: event.id,
        facilityId: "hall",
        startDate: event.startDate,
        endDate: event.endDate,
      });
    }
  });

  it("rejects impossible dates before writing any events", async () => {
    const form = schedule("selected_dates");
    form.append("occurrenceDate", "2027-02-30");

    await expect(createEvent(form)).rejects.toThrow("Choose a valid event date");
    expect(batch).not.toHaveBeenCalled();
  });

  it("finds the last Saturday in months with four or five Saturdays", async () => {
    const form = schedule("monthly_nth_weekday");
    form.set("weekOfMonth", "-1");
    form.set("weekday", "6");
    form.set("seriesStartMonth", "2027-01");
    form.set("monthsAhead", "2");

    await expect(createEvent(form)).rejects.toThrow("redirect");

    const [seriesInsert, eventInsert] = batch.mock.calls[0][0];
    expect(seriesInsert.table).toBe(eventSeries);
    expect(eventInsert.rows.map((row: { startDate: Date }) => row.startDate.toISOString())).toEqual([
      "2027-01-30T18:00:00.000Z",
      "2027-02-27T18:00:00.000Z",
    ]);
  });
});
