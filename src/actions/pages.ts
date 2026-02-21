"use server";

import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getPages() {
  return db.select().from(pages).orderBy(pages.slug);
}

export async function getPage(slug: string) {
  const result = await db
    .select()
    .from(pages)
    .where(eq(pages.slug, slug))
    .limit(1);
  return result[0] || null;
}

export async function updatePage(slug: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db
    .update(pages)
    .set({
      title: formData.get("title") as string,
      content: formData.get("content") as string,
      metaDescription: (formData.get("metaDescription") as string) || null,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    })
    .where(eq(pages.slug, slug));

  revalidatePath(`/${slug}`);
  revalidatePath("/admin/pages");
}
