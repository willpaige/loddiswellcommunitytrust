"use server";

import { db } from "@/lib/db";
import { bookingBlocks, events, facilities } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { asc, eq, desc, and, gte, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";

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

export async function createEvent(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = createId();
  const title = formData.get("title") as string;
  const { startDate, endDate } = eventDatesFromForm(formData);

  await db.insert(events).values({
    id,
    title,
    description: (formData.get("description") as string) || "{}",
    location: formData.get("location") as string,
    startDate,
    endDate,
    allDay: formData.get("allDay") === "on",
    imageUrl: (formData.get("imageUrl") as string) || null,
    externalUrl: (formData.get("externalUrl") as string) || null,
    published: formData.get("published") !== "off",
    createdBy: session.user.id,
  });
  await syncEventBookingBlock({
    eventId: id,
    title,
    formData,
    sessionUserId: session.user.id,
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
    sessionUserId: session.user.id,
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
