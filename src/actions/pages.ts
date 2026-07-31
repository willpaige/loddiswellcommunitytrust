"use server";

import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { pageSchemas } from "@/lib/cms/page-schemas";

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

  const schema = pageSchemas[slug];
  if (!schema) throw new Error(`Unknown page: ${slug}`);

  const title = (formData.get("title") as string)?.trim() || schema.title;
  const metaDescription =
    (formData.get("metaDescription") as string)?.trim() || null;
  const blocksRaw = (formData.get("blocks") as string) || "{}";

  let blocks: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(blocksRaw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      blocks = parsed as Record<string, unknown>;
    }
  } catch {
    throw new Error("Invalid blocks JSON");
  }

  const allowedKeys = new Set(schema.blocks.map((b) => b.key));
  const filtered: Record<string, unknown> = {};
  let heroImageUrl: string | null = null;

  for (const [key, value] of Object.entries(blocks)) {
    if (allowedKeys.has(key)) {
      if (key === "hero_image" && typeof value === "string") {
        heroImageUrl = value || null;
      } else {
        filtered[key] = value;
      }
    }
  }

  // Insert rather than update when the page has never been saved — pages added
  // to the schema after the last seed run have no row yet.
  await db
    .insert(pages)
    .values({
      slug,
      title,
      content: JSON.stringify(filtered),
      metaDescription,
      heroImageUrl,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    })
    .onConflictDoUpdate({
      target: pages.slug,
      set: {
        title,
        content: JSON.stringify(filtered),
        metaDescription,
        heroImageUrl,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      },
    });

  await logAudit({
    action: "update",
    entity: "page",
    entityId: slug,
    description: `Updated page: ${title}`,
  });

  const publicPath =
    schema.publicPath ?? (slug === "home" ? "/" : `/${slug}`);
  revalidatePath(publicPath);
  revalidatePath("/admin/pages");
}
