import { and, gte, inArray, like, lt, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookingOccurrences, bookings, facilities } from "./schema";

// Booking times are UK wall-clock values stored as UTC (see src/lib/booking-time.ts),
// so seed in UTC to match what the app writes.
process.env.TZ = "UTC";

const CUSTOMER_EMAIL = "hello@loddiswellcommunitytrust.org";
const SEED_PREFIX = "seed-2026-27";
const HORIZON_START = localDate("2026-08-01", "00:00");
const HORIZON_END = localDate("2027-08-01", "00:00");

type FacilitySlug = "pavilion" | "village-hall";
type CustomerGroup = "parent_private" | "team_community";
type Session = { startDate: Date; endDate: Date };
type BookingSeed = {
  id: string;
  facilitySlug: FacilitySlug;
  title: string;
  customerGroup: CustomerGroup;
  sessions: Session[];
};

function localDate(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function dateKey(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function session(date: string, startTime: string, endTime: string): Session {
  return {
    startDate: localDate(date, startTime),
    endDate: localDate(date, endTime),
  };
}

function datesBetween(
  start: string,
  end: string,
  include: (date: Date) => boolean
) {
  const dates: string[] = [];
  const cursor = localDate(start, "12:00");
  const last = localDate(end, "12:00");

  while (cursor <= last) {
    if (include(cursor)) dates.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function weeklyDates(start: string, end: string, weekday: number) {
  return datesBetween(start, end, (date) => date.getDay() === weekday);
}

function nthWeekdayDates(
  start: string,
  end: string,
  weekday: number,
  weekOfMonth: number
) {
  return datesBetween(
    start,
    end,
    (date) =>
      date.getDay() === weekday &&
      Math.ceil(date.getDate() / 7) === weekOfMonth
  );
}

function sessionsForDates(dates: string[], startTime: string, endTime: string) {
  return dates.map((date) => session(date, startTime, endTime));
}

function repeatingBooking(
  key: string,
  facilitySlug: FacilitySlug,
  title: string,
  dates: string[],
  startTime: string,
  endTime: string
): BookingSeed {
  return {
    id: `${SEED_PREFIX}-${key}`,
    facilitySlug,
    title,
    customerGroup: "team_community",
    sessions: sessionsForDates(dates, startTime, endTime),
  };
}

function privateBooking(
  key: string,
  facilitySlug: FacilitySlug,
  sessions: Session[],
  title = "Private hire"
): BookingSeed {
  return {
    id: `${SEED_PREFIX}-${key}`,
    facilitySlug,
    title,
    customerGroup: title === "Private hire" ? "parent_private" : "team_community",
    sessions,
  };
}

function buildBookingSeeds(): BookingSeed[] {
  const artClubWednesday = weeklyDates("2026-08-01", "2027-07-31", 3).filter(
    (date) => date !== "2026-09-09"
  );
  const artClubThursday = weeklyDates("2026-08-01", "2027-07-31", 4);
  const lineDancing = weeklyDates("2026-08-01", "2027-07-31", 4);
  const bookClub = nthWeekdayDates("2026-08-01", "2027-07-31", 1, 3).filter(
    (date) => date !== "2026-08-17"
  );
  const forum = nthWeekdayDates("2026-09-01", "2027-07-31", 2, 3).filter(
    (_, index) => index % 2 === 0
  );

  return [
    repeatingBooking(
      "pavilion-book-club",
      "pavilion",
      "Book Club",
      bookClub,
      "19:30",
      "22:00"
    ),
    repeatingBooking(
      "pavilion-art-club-wednesday",
      "pavilion",
      "Art Club",
      artClubWednesday,
      "16:45",
      "18:15"
    ),
    repeatingBooking(
      "pavilion-art-club-thursday",
      "pavilion",
      "Art Club",
      artClubThursday,
      "17:45",
      "19:15"
    ),
    repeatingBooking(
      "pavilion-bingo",
      "pavilion",
      "Bingo",
      nthWeekdayDates("2026-08-01", "2027-07-31", 4, 3),
      "19:15",
      "22:00"
    ),
    repeatingBooking(
      "pavilion-pop-up-cafe",
      "pavilion",
      "Pop Up Café",
      nthWeekdayDates("2026-09-01", "2027-07-31", 6, 1),
      "09:00",
      "12:00"
    ),
    repeatingBooking(
      "pavilion-community-forum",
      "pavilion",
      "Loddiswell Community Forum",
      forum,
      "19:00",
      "22:00"
    ),
    repeatingBooking(
      "village-hall-pilates",
      "village-hall",
      "Pilates",
      weeklyDates("2026-08-01", "2027-07-31", 2),
      "18:00",
      "19:00"
    ),
    repeatingBooking(
      "village-hall-line-dancing",
      "village-hall",
      "Line dancing",
      lineDancing,
      "19:30",
      "21:00"
    ),
    repeatingBooking(
      "village-hall-womens-institute",
      "village-hall",
      "Women’s Institute",
      nthWeekdayDates("2026-09-01", "2027-07-31", 4, 2),
      "14:00",
      "16:00"
    ),
    repeatingBooking(
      "village-hall-qi-gong",
      "village-hall",
      "Qi Gong",
      weeklyDates("2026-09-01", "2027-04-30", 0),
      "18:30",
      "20:00"
    ),
    privateBooking(
      "pavilion-private-2026-08-09",
      "pavilion",
      [session("2026-08-09", "13:00", "18:00")]
    ),
    privateBooking(
      "pavilion-private-2026-08-10-morning",
      "pavilion",
      [session("2026-08-10", "09:00", "13:00")]
    ),
    privateBooking(
      "pavilion-private-2026-08-10-evening",
      "pavilion",
      [session("2026-08-10", "19:00", "22:00")]
    ),
    privateBooking(
      "pavilion-private-2026-08-17",
      "pavilion",
      [session("2026-08-17", "19:00", "22:00")]
    ),
    privateBooking(
      "pavilion-private-2026-09-06",
      "pavilion",
      [session("2026-09-06", "09:00", "23:00")]
    ),
    privateBooking(
      "pavilion-private-2026-09-09",
      "pavilion",
      [session("2026-09-09", "13:00", "18:00")]
    ),
    privateBooking(
      "pavilion-private-2026-09-14",
      "pavilion",
      [session("2026-09-14", "19:00", "22:00")]
    ),
    privateBooking(
      "pavilion-private-2026-09-27",
      "pavilion",
      [session("2026-09-27", "12:00", "18:00")]
    ),
    privateBooking(
      "pavilion-agm-2026-09-09",
      "pavilion",
      [session("2026-09-09", "19:00", "22:00")],
      "LPFVHT AGM"
    ),
    privateBooking(
      "pavilion-light-up-loddiswell-2026-12-04",
      "pavilion",
      [session("2026-12-04", "16:00", "23:00")],
      "Light Up Loddiswell"
    ),
    privateBooking(
      "village-hall-private-2026-08-23",
      "village-hall",
      [session("2026-08-23", "13:00", "17:00")]
    ),
    privateBooking(
      "village-hall-private-2026-09-09",
      "village-hall",
      [session("2026-09-09", "13:00", "18:00")]
    ),
  ];
}

function assertValidSeeds(seeds: BookingSeed[]) {
  const occurrences = seeds.flatMap((booking) =>
    booking.sessions.map((item) => ({
      ...item,
      bookingId: booking.id,
      facilitySlug: booking.facilitySlug,
      title: booking.title,
    }))
  );

  if (seeds.length !== 22 || occurrences.length !== 304) {
    throw new Error(
      `Unexpected booking seed totals: ${seeds.length} bookings and ${occurrences.length} occurrences.`
    );
  }

  for (const booking of seeds) {
    if (booking.sessions.length === 0) {
      throw new Error(`Seed booking ${booking.id} has no occurrences.`);
    }
    for (const item of booking.sessions) {
      if (
        item.startDate >= item.endDate ||
        item.startDate < HORIZON_START ||
        item.endDate > HORIZON_END
      ) {
        throw new Error(`Seed booking ${booking.id} has an invalid occurrence.`);
      }
    }
  }

  const sorted = [...occurrences].sort(
    (left, right) => left.startDate.getTime() - right.startDate.getTime()
  );
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    for (let otherIndex = index + 1; otherIndex < sorted.length; otherIndex += 1) {
      const other = sorted[otherIndex];
      if (other.startDate >= current.endDate) break;
      if (
        current.facilitySlug === other.facilitySlug &&
        current.startDate < other.endDate &&
        current.endDate > other.startDate
      ) {
        throw new Error(
          `Seed conflict at ${current.facilitySlug}: ${current.title} overlaps ${other.title} on ${dateKey(current.startDate)}.`
        );
      }
    }
  }
}

export async function seedBookings() {
  const seeds = buildBookingSeeds();
  assertValidSeeds(seeds);

  const facilityRows = await db
    .select({ id: facilities.id, slug: facilities.slug })
    .from(facilities)
    .where(inArray(facilities.slug, ["pavilion", "village-hall"]));
  const facilityIds = new Map(facilityRows.map((row) => [row.slug, row.id]));
  const pavilionId = facilityIds.get("pavilion");
  const villageHallId = facilityIds.get("village-hall");
  if (!pavilionId || !villageHallId) {
    throw new Error("Pavilion and Village Hall must be seeded before bookings.");
  }

  const seedIds = seeds.map((booking) => booking.id);
  const existingSeedBookings = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(like(bookings.id, `${SEED_PREFIX}-%`));
  const existingSeedIds = existingSeedBookings.map((booking) => booking.id);
  const allSeedOwnedIds = [...new Set([...seedIds, ...existingSeedIds])];
  const staleSeedIds = existingSeedIds.filter((id) => !seedIds.includes(id));
  const existingOccurrences = await db
    .select({
      bookingId: bookingOccurrences.bookingId,
      facilityId: bookingOccurrences.facilityId,
      startDate: bookingOccurrences.startDate,
      endDate: bookingOccurrences.endDate,
    })
    .from(bookingOccurrences)
    .where(
      and(
        ne(bookingOccurrences.status, "cancelled"),
        gte(bookingOccurrences.endDate, HORIZON_START),
        lt(bookingOccurrences.startDate, HORIZON_END),
        notInArray(bookingOccurrences.bookingId, allSeedOwnedIds)
      )
    );

  const conflicts: string[] = [];
  for (const booking of seeds) {
    const facilityId = facilityIds.get(booking.facilitySlug)!;
    for (const item of booking.sessions) {
      const conflict = existingOccurrences.find(
        (existing) =>
          existing.facilityId === facilityId &&
          existing.startDate < item.endDate &&
          existing.endDate > item.startDate
      );
      if (conflict) {
        conflicts.push(
          `${booking.title} on ${dateKey(item.startDate)} conflicts with booking ${conflict.bookingId}`
        );
      }
    }
  }
  if (conflicts.length > 0) {
    throw new Error(
      `Booking seed aborted because unrelated bookings already occupy these slots:\n${conflicts.join("\n")}`
    );
  }

  const bookingRows = seeds.map((booking) => {
    const first = booking.sessions[0];
    return {
      id: booking.id,
      userId: null,
      facilityId: facilityIds.get(booking.facilitySlug)!,
      offeringId: null,
      customerGroup: booking.customerGroup,
      customerName: booking.title,
      organisationName: null,
      customerEmail: CUSTOMER_EMAIL,
      customerPhone: null,
      notes: "Seeded 2026–27 venue timetable",
      status: "confirmed" as const,
      paymentType: "manual" as const,
      amount: 0,
      discountPercent: 0,
      discountAmount: 0,
      startDate: first.startDate,
      endDate: first.endDate,
      recurrence: "none" as const,
      scheduleType: booking.sessions.length > 1 ? ("custom" as const) : ("regular" as const),
      indefinite: false,
      billingInterval: null,
      repeatCount: booking.sessions.length,
      promoteOnSite: false,
      promotionUrl: null,
      promotionEventId: null,
    };
  });

  const occurrenceRows = seeds.flatMap((booking) => {
    const facilityId = facilityIds.get(booking.facilitySlug)!;
    return booking.sessions.map((item) => ({
      id: `${booking.id}-occ-${dateKey(item.startDate)}-${String(item.startDate.getHours()).padStart(2, "0")}${String(item.startDate.getMinutes()).padStart(2, "0")}`,
      bookingId: booking.id,
      facilityId,
      startDate: item.startDate,
      endDate: item.endDate,
      status: "confirmed" as const,
      allocatedAmount: 0,
    }));
  });

  await db.batch([
    db.delete(bookingOccurrences).where(inArray(bookingOccurrences.bookingId, allSeedOwnedIds)),
    db.delete(bookings).where(
      staleSeedIds.length > 0
        ? inArray(bookings.id, staleSeedIds)
        : inArray(bookings.id, ["__no_stale_seed_bookings__"])
    ),
    db
      .insert(bookings)
      .values(bookingRows)
      .onConflictDoUpdate({
        target: bookings.id,
        set: {
          facilityId: sql`excluded.facility_id`,
          userId: null,
          offeringId: null,
          customerGroup: sql`excluded.customer_group`,
          customerName: sql`excluded.customer_name`,
          customerEmail: CUSTOMER_EMAIL,
          customerPhone: null,
          organisationName: null,
          notes: "Seeded 2026–27 venue timetable",
          status: "confirmed",
          paymentType: "manual",
          amount: 0,
          discountPercent: 0,
          discountAmount: 0,
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
          recurrence: "none",
          scheduleType: sql`excluded.schedule_type`,
          indefinite: false,
          billingInterval: null,
          repeatCount: sql`excluded.repeat_count`,
          promoteOnSite: false,
          promotionUrl: null,
          promotionEventId: null,
        },
      }),
    db.insert(bookingOccurrences).values(occurrenceRows),
  ]);

  console.log(`  ✓ ${seeds.length} bookings (${occurrenceRows.length} occurrences)`);
}
