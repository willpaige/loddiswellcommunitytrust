"use server";

import { db } from "@/lib/db";
import { images } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function getImages() {
  return db.select().from(images).orderBy(desc(images.createdAt));
}

export async function uploadImage(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("No file provided");

  const altText = formData.get("altText") as string;
  if (!altText) throw new Error("Alt text is required for accessibility");

  const blob = await put(`images/${file.name}`, file, {
    access: "public",
  });

  await db.insert(images).values({
    id: createId(),
    url: blob.url,
    altText,
    fileSize: file.size,
    uploadedBy: session.user.id,
  });

  await logAudit({
    action: "upload",
    entity: "image",
    description: `Uploaded image: ${altText}`,
    metadata: { fileName: file.name, fileSize: file.size },
  });

  revalidatePath("/admin/images");
}

export async function deleteImage(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const img = await db
    .select()
    .from(images)
    .where(eq(images.id, id))
    .limit(1);

  if (img[0]) {
    try {
      await del(img[0].url);
    } catch {
      // Blob may already be deleted
    }
    await db.delete(images).where(eq(images.id, id));

    await logAudit({
      action: "delete",
      entity: "image",
      entityId: id,
      description: `Deleted image: ${img[0].altText}`,
    });
  }

  revalidatePath("/admin/images");
}
