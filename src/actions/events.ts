"use server";

import { db } from "@/lib/db";
import { bookingBlocks, eventSeries, events, facilities } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { asc, eq, desc, and, gte, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { addMonths } from "date-fns";

export async function getEvents() {
  return db.select().from(events).orderBy(desc(events.startDate));
}

export async function getEvent(id: string) {
  const result = await db.select().from(events).where(eq(events.id, id)).limit(1);
  const event = result[0];
  if (!event) return null;
  const [block] = await db
    .select({ facilityId: bookingBlocks.facilityId })
    .from(bookingBlocks)
    .where(eq(bookingBlocks.eventId, id))
    .limit(1);
  return { ...event, blockFacilityId: block?.facilityId ?? null };
}

export async function getUpcomingEvents(limit?: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Upcoming = published AND (endDate >= today, falling back to startDate when
  // there's no endDate). Ordered by startDate ascending so the next event is first.
  const query = db
    .select()
    .from(events)
    .where(
      and(
        eq(events.published, true),
        gte(sql`COALESCE(${events.endDate}, ${events.startDate})`, today)
      )
    )
    .orderBy(events.startDate);

  return limit ? query.limit(limit) : query;
}

export async function getEventFacilityOptions() {
  return db
    .select({
      id: facilities.id,
      name: facilities.name,
    })
    .from(facilities)
    .where(eq(facilities.bookable, true))
    .orderBy(asc(facilities.sortOrder), asc(facilities.name));
}

function eventDatesFromForm(formData: FormData) {
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = formData.get("endDate")
    ? new Date(formData.get("endDate") as string)
    : null;
  return { startDate, endDate };
}

function eventBlockEndDate(startDate: Date, endDate: Date | null, allDay: boolean) {
  if (endDate) return endDate;
  const fallback = new Date(startDate);
  fallback.setHours(allDay ? 24 : fallback.getHours() + 1, 0, 0, 0);
  return fallback;
}

function parseTime(value: string) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error("Use a valid event time.");
  }
  const [hours, minutes] = value.split(":").map(Number);
  return { hours, minutes };
}

function combineDateAndTime(date: Date, time: string) {
  const { hours, minutes } = parseTime(time);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, weekOfMonth: number) {
  const first = new Date(year, monthIndex, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, monthIndex, 1 + offset + (weekOfMonth - 1) * 7);
}

function recurringEventDates(formData: FormData) {
  const weekOfMonth = Math.max(1, Math.min(5, Number(formData.get("weekOfMonth") || 2)));
  const weekday = Math.max(0, Math.min(6, Number(formData.get("weekday") || 4)));
  const startTime = String(formData.get("seriesStartTime") || "");
  const endTime = String(formData.get("seriesEndTime") || "");
  const monthsAhead = Math.max(1, Math.min(36, Number(formData.get("monthsAhead") || 18)));
  const startMonth = new Date(String(formData.get("seriesStartMonth") || ""));
  if (Number.isNaN(startMonth.getTime())) throw new Error("Choose a recurrence start month.");
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  const excludeMonths = formData.getAll("excludeMonths").map((value) => Number(value));

  const dates: Array<{ startDate: Date; endDate: Date }> = [];
  for (let index = 0; index < monthsAhead; index += 1) {
    const month = addMonths(startMonth, index);
    const monthNumber = month.getMonth() + 1;
    if (excludeMonths.includes(monthNumber)) continue;
    const day = nthWeekdayOfMonth(month.getFullYear(), month.getMonth(), weekday, weekOfMonth);
    if (day.getMonth() !== month.getMonth()) continue;
    const startDate = combineDateAndTime(day, startTime);
    const endDate = combineDateAndTime(day, endTime);
    if (endDate <= startDate) throw new Error("Recurring event end time must be after start time.");
    dates.push({ startDate, endDate });
  }

  return {
    weekOfMonth,
    weekday,
    startTime,
    endTime,
    monthsAhead,
    startMonth,
    excludeMonths,
    dates,
  };
}

async function createEventBookingBlock({
  eventId,
  title,
  facilityId,
  startDate,
  endDate,
  allDay,
  sessionUserId,
}: {
  eventId: string;
  title: string;
  facilityId: string;
  startDate: Date;
  endDate: Date | null;
  allDay: boolean;
  sessionUserId: string | undefined;
}) {
  const blockEndDate = eventBlockEndDate(startDate, endDate, allDay);
  if (blockEndDate <= startDate) {
    throw new Error("Event booking block must end after it starts.");
  }

  await db.insert(bookingBlocks).values({
    facilityId,
    eventId,
    title: `Event: ${title}`,
    startDate,
    endDate: blockEndDate,
    notes: "Created from event calendar",
    createdBy: sessionUserId ?? null,
  });
}

async function syncEventBookingBlock({
  eventId,
  title,
  formData,
  sessionUserId,
}: {
  eventId: string;
  title: string;
  formData: FormData;
  sessionUserId: string | undefined;
}) {
  const shouldBlock = formData.get("blockBookings") === "on";
  const facilityId = String(formData.get("blockFacilityId") || "");
  const allDay = formData.get("allDay") === "on";
  const { startDate, endDate } = eventDatesFromForm(formData);

  await db.delete(bookingBlocks).where(eq(bookingBlocks.eventId, eventId));

  if (!shouldBlock) return;
  if (!facilityId) throw new Error("Choose a venue to block for this event.");

  await createEventBookingBlock({
    eventId,
    title,
    facilityId,
    startDate,
    endDate,
    allDay,
    sessionUserId,
  });
}

export async function createEvent(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const sessionUserId = session.user.id;

  const recurring = formData.get("recurringEvent") === "on";
  const id = createId();
  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || "{}";
  const location = formData.get("location") as string;
  const imageUrl = (formData.get("imageUrl") as string) || null;
  const externalUrl = (formData.get("externalUrl") as string) || null;
  const allDay = formData.get("allDay") === "on";
  const published = formData.get("published") !== "off";
  const shouldBlock = formData.get("blockBookings") === "on";
  const blockFacilityId = String(formData.get("blockFacilityId") || "");

  if (recurring) {
    if (shouldBlock && !blockFacilityId) throw new Error("Choose a venue to block for this event.");
    const rule = recurringEventDates(formData);
    if (rule.dates.length === 0) {
      throw new Error("No event dates were generated for this recurring rule.");
    }
    const seriesId = createId();
    await db.insert(eventSeries).values({
      id: seriesId,
      title,
      description,
      location,
      imageUrl,
      externalUrl,
      published,
      allDay,
      recurrence: "monthly_nth_weekday",
      weekOfMonth: rule.weekOfMonth,
      weekday: rule.weekday,
      startTime: rule.startTime,
      endTime: rule.endTime,
      startMonth: rule.startMonth,
      monthsAhead: rule.monthsAhead,
      excludeMonths: rule.excludeMonths,
      blockFacilityId: shouldBlock ? blockFacilityId : null,
      createdBy: sessionUserId,
    });

    const occurrenceIds = rule.dates.map(() => createId());
    await db.insert(events).values(
      rule.dates.map((date, index) => ({
        id: occurrenceIds[index],
        seriesId,
        title,
        description,
        location,
        startDate: date.startDate,
        endDate: date.endDate,
        allDay,
        imageUrl,
        externalUrl,
        published,
        createdBy: sessionUserId,
      }))
    );
    if (shouldBlock) {
      await db.insert(bookingBlocks).values(
        rule.dates.map((date, index) => ({
          facilityId: blockFacilityId,
          eventId: occurrenceIds[index],
          title: `Event: ${title}`,
          startDate: date.startDate,
          endDate: date.endDate,
          notes: "Created from recurring event calendar",
          createdBy: sessionUserId,
        }))
      );
    }

    await logAudit({
      action: "create",
      entity: "event",
      entityId: seriesId,
      description: `Created recurring event series: ${title}`,
      metadata: { occurrences: rule.dates.length },
    });

    revalidatePath("/admin/events");
    revalidatePath("/admin/bookings/availability");
    revalidatePath("/booking");
    revalidatePath("/events");
    redirect("/admin/events");
  }

  const { startDate, endDate } = eventDatesFromForm(formData);
  await db.insert(events).values({
    id,
    title,
    description,
    location,
    startDate,
    endDate,
    allDay,
    imageUrl,
    externalUrl,
    published,
    createdBy: sessionUserId,
  });
  await syncEventBookingBlock({
    eventId: id,
    title,
    formData,
    sessionUserId,
  });

  await logAudit({
    action: "create",
    entity: "event",
    entityId: id,
    description: `Created event: ${formData.get("title")}`,
  });

  revalidatePath("/admin/events");
  revalidatePath("/admin/bookings/availability");
  revalidatePath("/booking");
  revalidatePath("/events");
  redirect("/admin/events");
}

export async function updateEvent(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const sessionUserId = session.user.id;

  const title = formData.get("title") as string;
  const { startDate, endDate } = eventDatesFromForm(formData);

  await db
    .update(events)
    .set({
      title,
      description: (formData.get("description") as string) || "{}",
      location: formData.get("location") as string,
      startDate,
      endDate,
      allDay: formData.get("allDay") === "on",
      imageUrl: (formData.get("imageUrl") as string) || null,
      externalUrl: (formData.get("externalUrl") as string) || null,
      published: formData.get("published") !== "off",
      updatedAt: new Date(),
    })
    .where(eq(events.id, id));
  await syncEventBookingBlock({
    eventId: id,
    title,
    formData,
    sessionUserId,
  });

  await logAudit({
    action: "update",
    entity: "event",
    entityId: id,
    description: `Updated event: ${formData.get("title")}`,
  });

  revalidatePath("/admin/events");
  revalidatePath("/admin/bookings/availability");
  revalidatePath("/booking");
  revalidatePath("/events");
  redirect("/admin/events");
}

export async function deleteEvent(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.delete(events).where(eq(events.id, id));

  await logAudit({
    action: "delete",
    entity: "event",
    entityId: id,
    description: "Deleted event",
  });

  revalidatePath("/admin/events");
  revalidatePath("/admin/bookings/availability");
  revalidatePath("/booking");
  revalidatePath("/events");
}
