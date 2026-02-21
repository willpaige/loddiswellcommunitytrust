"use server";

import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getEvents() {
  return db.select().from(events).orderBy(desc(events.startDate));
}

export async function getEvent(id: string) {
  const result = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return result[0] || null;
}

export async function getUpcomingEvents(limit = 5) {
  return db
    .select()
    .from(events)
    .where(eq(events.published, true))
    .orderBy(events.startDate)
    .limit(limit);
}

export async function createEvent(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = createId();
  await db.insert(events).values({
    id,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || "{}",
    location: formData.get("location") as string,
    startDate: new Date(formData.get("startDate") as string),
    endDate: formData.get("endDate")
      ? new Date(formData.get("endDate") as string)
      : null,
    allDay: formData.get("allDay") === "on",
    imageUrl: (formData.get("imageUrl") as string) || null,
    published: formData.get("published") !== "off",
    createdBy: session.user.id,
  });

  revalidatePath("/admin/events");
  revalidatePath("/events");
  redirect("/admin/events");
}

export async function updateEvent(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db
    .update(events)
    .set({
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || "{}",
      location: formData.get("location") as string,
      startDate: new Date(formData.get("startDate") as string),
      endDate: formData.get("endDate")
        ? new Date(formData.get("endDate") as string)
        : null,
      allDay: formData.get("allDay") === "on",
      imageUrl: (formData.get("imageUrl") as string) || null,
      published: formData.get("published") !== "off",
      updatedAt: new Date(),
    })
    .where(eq(events.id, id));

  revalidatePath("/admin/events");
  revalidatePath("/events");
  redirect("/admin/events");
}

export async function deleteEvent(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.delete(events).where(eq(events.id, id));

  revalidatePath("/admin/events");
  revalidatePath("/events");
}
