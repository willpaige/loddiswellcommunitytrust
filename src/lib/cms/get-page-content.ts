import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import type { TiptapJSON } from "./render";

export type PageContent = {
  title: string;
  metaDescription: string | null;
  heroImageUrl: string | null;
  blocks: Record<string, TiptapJSON>;
  updatedAt: Date | null;
};

export const getPageContent = cache(async (slug: string): Promise<PageContent> => {
  const rows = await db
    .select()
    .from(pages)
    .where(eq(pages.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { title: "", metaDescription: null, heroImageUrl: null, blocks: {}, updatedAt: null };
  }
  let blocks: Record<string, TiptapJSON> = {};
  try {
    const parsed = JSON.parse(row.content);
    if (parsed && typeof parsed === "object") {
      blocks = parsed as Record<string, TiptapJSON>;
    }
  } catch {
    blocks = {};
  }
  return {
    title: row.title,
    metaDescription: row.metaDescription ?? null,
    heroImageUrl: row.heroImageUrl ?? null,
    blocks,
    updatedAt: row.updatedAt,
  };
});
