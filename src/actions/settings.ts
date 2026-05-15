"use server";

import { db } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getSettings() {
  const rows = await db.select().from(siteSettings).limit(1);
  return rows[0] || null;
}

export async function updateSettings(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const settings = await getSettings();

  const updateData = {
    mapLatitude: (formData.get("mapLatitude") as string) || "50.325178",
    mapLongitude: (formData.get("mapLongitude") as string) || "-3.80193",
    mapZoom: (formData.get("mapZoom") as string) || "351",
    emailAddress:
      (formData.get("emailAddress") as string) ||
      "hello@loddiswellcommunitytrust.org",
    postalAddress: (formData.get("postalAddress") as string) || null,
    villageHallAddress: (formData.get("villageHallAddress") as string) || null,
    pavilionAddress: (formData.get("pavilionAddress") as string) || null,
    bookingsPhoneNumber: (formData.get("bookingsPhoneNumber") as string) || null,
    phoneNumber: (formData.get("phoneNumber") as string) || null,
    updatedAt: new Date(),
    updatedBy: session.user.id,
  };

  if (settings) {
    await db.update(siteSettings).set(updateData);
  } else {
    await db.insert(siteSettings).values(updateData);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/contact");
  revalidatePath("/");
}
