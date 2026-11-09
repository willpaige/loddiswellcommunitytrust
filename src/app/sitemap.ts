import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { raffles } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://loddiswellcommunitytrust.org";

  const staticPages = [
    "",
    "/about",
    "/facilities",
    "/facilities/village-hall",
    "/facilities/pavilion",
    "/facilities/tennis-courts",
    "/facilities/playing-field",
    "/facilities/pump-track",
    "/booking",
    "/events",
    "/lottery",
    "/lottery/terms",
    "/raffles",
    "/raffles/terms",
    "/contact",
    "/terms",
    "/privacy",
  ];

  const pages: MetadataRoute.Sitemap = staticPages.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/contact" ? 0.8 : 0.6,
  }));

  // Every published raffle keeps its page as a permanent results page.
  const rafflePages = await db
    .select({ slug: raffles.slug, updatedAt: raffles.updatedAt })
    .from(raffles)
    .where(eq(raffles.published, true));
  return [
    ...pages,
    ...rafflePages.map((r) => ({
      url: `${baseUrl}/raffles/${r.slug}`,
      lastModified: r.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
