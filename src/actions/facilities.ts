"use server";

import { db } from "@/lib/db";
import { facilities } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function getFacilities() {
  return db.select().from(facilities).orderBy(facilities.sortOrder);
}

export async function getFacility(slug: string) {
  const result = await db
    .select()
    .from(facilities)
    .where(eq(facilities.slug, slug))
    .limit(1);
  return result[0] || null;
}

export async function updateFacility(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const featuresRaw = formData.get("features") as string;
  const ratesRaw = formData.get("rates") as string;

  await db
    .update(facilities)
    .set({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || "{}",
      address: (formData.get("address") as string) || null,
      capacity: formData.get("capacity")
        ? Number(formData.get("capacity"))
        : null,
      features: featuresRaw ? JSON.parse(featuresRaw) : null,
      rates: ratesRaw ? JSON.parse(ratesRaw) : null,
      bookingInfo: (formData.get("bookingInfo") as string) || null,
      externalBookingUrl:
        (formData.get("externalBookingUrl") as string) || null,
      heroImageUrl: (formData.get("heroImageUrl") as string) || null,
      published: formData.get("published") !== "off",
      updatedAt: new Date(),
    })
    .where(eq(facilities.id, id));

  await logAudit({
    action: "update",
    entity: "facility",
    entityId: id,
    description: `Updated facility: ${formData.get("name")}`,
  });

  revalidatePath("/facilities");
  revalidatePath("/admin/facilities");
}
