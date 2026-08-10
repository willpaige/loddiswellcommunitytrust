import { addDays } from "date-fns";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { BOOKING_HORIZON_DAYS, toWatermarkDate } from "@/lib/booking-recurrence";
import { bookingBlockSeries, bookingBlocks, bookingOccurrences, facilities } from "./schema";

// Deliberately does NOT set process.env.TZ. The block tables use `timestamp`
// without a time zone, drizzle writes `toISOString()` and reads back as UTC, and
// the deployed runtime is UTC — so the stored wall-clock value IS the time
// villagers see. Anchors below are therefore built with UTC setters, which makes
// this seed produce identical rows whatever timezone it is run from. Using local
// setters here stores BST times an hour early on the production clock.
const FACILITY_SLUG = "tennis-courts";
const NOTES = "Loddiswell Tennis Club standing session";

// Deterministic primary keys so a re-run updates these series rather than
// duplicating them. capacity stays null: club sessions take both courts.
const sessions = [
  { id: "seed-tennis-club-saturday", title: "Tennis Club session", weekday: 6, startHour: 9, endHour: 12 },
  { id: "seed-tennis-club-sunday", title: "Tennis Club session", weekday: 0, startHour: 9, endHour: 12 },
  { id: "seed-tennis-club-tuesday", title: "Tennis Club night", weekday: 2, startHour: 17, endHour: 21 },
];

// Weekly occurrences stepped in whole UTC days. date-fns `addWeeks` preserves
// the LOCAL wall clock, which silently shifts these blocks by an hour across the
// BST/GMT boundary whenever the seed is run from a non-UTC machine. On Vercel
// (TZ=UTC) the nightly top-up's addWeeks is equivalent to this, so the two paths
// agree; here we make that explicit rather than depending on the shell's TZ.
function utcWeeklyOccurrences(
  anchorStart: Date,
  anchorEnd: Date,
  fromExclusive: Date | null,
  until: Date
) {
  const out: Array<{ startDate: Date; endDate: Date }> = [];
  const week = 7 * 24 * 60 * 60 * 1000;
  for (let index = 0; index < 1000; index += 1) {
    const startDate = new Date(anchorStart.getTime() + index * week);
    if (startDate > until) break;
    if (fromExclusive && startDate <= fromExclusive) continue;
    out.push({ startDate, endDate: new Date(anchorEnd.getTime() + index * week) });
  }
  return out;
}

// First occurrence strictly in the future, so seeding can never backfill a pile
// of historical blocks. UTC throughout — see the note above.
function nextWeekdayAt(weekday: number, hour: number) {
  const now = new Date();
  const date = new Date(now);
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + ((weekday - date.getUTCDay() + 7) % 7));
  if (date <= now) date.setUTCDate(date.getUTCDate() + 7);
  return date;
}

export async function seedTennisClubSessions() {
  const [facility] = await db
    .select({ id: facilities.id })
    .from(facilities)
    .where(eq(facilities.slug, FACILITY_SLUG))
    .limit(1);
  if (!facility) {
    throw new Error("Tennis courts must be seeded before tennis club sessions.");
  }

  const now = new Date();
  const horizonEnd = addDays(now, BOOKING_HORIZON_DAYS);

  // A block neither cancels nor even notices an existing booking, so surface
  // any collision rather than quietly double-booking the courts.
  const existingOccurrences = await db
    .select({
      bookingId: bookingOccurrences.bookingId,
      startDate: bookingOccurrences.startDate,
      endDate: bookingOccurrences.endDate,
    })
    .from(bookingOccurrences)
    .where(
      and(
        eq(bookingOccurrences.facilityId, facility.id),
        ne(bookingOccurrences.status, "cancelled"),
        lt(bookingOccurrences.startDate, horizonEnd),
        gt(bookingOccurrences.endDate, now)
      )
    );

  let created = 0;
  let clashes = 0;

  for (const item of sessions) {
    const [existing] = await db
      .select()
      .from(bookingBlockSeries)
      .where(eq(bookingBlockSeries.id, item.id))
      .limit(1);

    let series = existing;
    if (!series) {
      const startDate = nextWeekdayAt(item.weekday, item.startHour);
      // Derived from startDate, never recomputed — resolving the weekday twice
      // can land the two on different weeks and invert the range.
      const endDate = new Date(startDate);
      endDate.setUTCHours(item.endHour, 0, 0, 0);
      [series] = await db
        .insert(bookingBlockSeries)
        .values({
          id: item.id,
          facilityId: facility.id,
          title: item.title,
          startDate,
          endDate,
          recurrence: "weekly",
          indefinite: true,
          repeatCount: 1,
          capacity: null,
          notes: NOTES,
          createdBy: null,
        })
        .returning();
    } else {
      // Leave startDate/endDate untouched so occurrence dates never drift.
      await db
        .update(bookingBlockSeries)
        .set({
          facilityId: facility.id,
          title: item.title,
          indefinite: true,
          capacity: null,
          notes: NOTES,
        })
        .where(eq(bookingBlockSeries.id, item.id));
    }

    // Warn across the whole horizon, not just the new tail, so the report is
    // stable across re-runs.
    for (const range of utcWeeklyOccurrences(series.startDate, series.endDate, null, horizonEnd)) {
      const clash = existingOccurrences.find(
        (occurrence) =>
          occurrence.startDate < range.endDate && occurrence.endDate > range.startDate
      );
      if (clash) {
        clashes += 1;
        console.warn(
          `  ! ${item.title} on ${range.startDate.toISOString()} overlaps booking ${clash.bookingId} — the block does not cancel it.`
        );
      }
    }

    // Same watermark the nightly extend-bookings cron uses, so the two are
    // interchangeable and repeated runs insert nothing.
    const [{ maxStart }] = await db
      .select({ maxStart: sql<string | null>`max(${bookingBlocks.startDate})` })
      .from(bookingBlocks)
      .where(eq(bookingBlocks.seriesId, item.id));

    const ranges = utcWeeklyOccurrences(
      series.startDate,
      series.endDate,
      toWatermarkDate(maxStart),
      horizonEnd
      // With no watermark (all blocks deleted) the generator replays from the
      // immutable anchor, so drop past dates rather than back-filling history.
    ).filter((range) => range.startDate >= now);

    if (ranges.length > 0) {
      const inserted = await db
        .insert(bookingBlocks)
        .values(
          ranges.map((range) => ({
            facilityId: facility.id,
            seriesId: item.id,
            title: item.title,
            startDate: range.startDate,
            endDate: range.endDate,
            capacity: null,
            notes: NOTES,
            createdBy: null,
          }))
        )
        // Untargeted: the (series_id, start_date) index is partial, and Postgres
        // will not match a targeted ON CONFLICT to one without repeating its
        // predicate. The only other unique constraint is the generated id.
        .onConflictDoNothing()
        .returning({ id: bookingBlocks.id });
      created += inserted.length;
    }
  }

  console.log(
    `  ✓ ${sessions.length} tennis club series (${created} new blocks${clashes ? `, ${clashes} clashes reported` : ""})`
  );
}
