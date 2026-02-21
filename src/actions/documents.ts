"use server";

import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function getDocuments() {
  return db.select().from(documents).orderBy(desc(documents.createdAt));
}

export async function getDocumentsByCategory(
  category: "minutes" | "agm" | "policy" | "report" | "other"
) {
  return db
    .select()
    .from(documents)
    .where(eq(documents.category, category))
    .orderBy(desc(documents.publishedDate));
}

export async function uploadDocument(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("No file provided");

  const blob = await put(`documents/${file.name}`, file, {
    access: "public",
  });

  await db.insert(documents).values({
    id: createId(),
    title: formData.get("title") as string,
    category: formData.get("category") as
      | "minutes"
      | "agm"
      | "policy"
      | "report"
      | "other",
    fileUrl: blob.url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    publishedDate: formData.get("publishedDate")
      ? new Date(formData.get("publishedDate") as string)
      : new Date(),
    uploadedBy: session.user.id,
  });

  await logAudit({
    action: "upload",
    entity: "document",
    description: `Uploaded document: ${formData.get("title")}`,
    metadata: { fileName: file.name, fileSize: file.size, category: formData.get("category") },
  });

  revalidatePath("/admin/documents");
  revalidatePath("/about");
}

export async function deleteDocument(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const doc = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (doc[0]) {
    try {
      await del(doc[0].fileUrl);
    } catch {
      // Blob may already be deleted
    }
    await db.delete(documents).where(eq(documents.id, id));

    await logAudit({
      action: "delete",
      entity: "document",
      entityId: id,
      description: `Deleted document: ${doc[0].title}`,
    });
  }

  revalidatePath("/admin/documents");
  revalidatePath("/about");
}
