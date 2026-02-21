import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
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
    "/contact",
    "/terms",
    "/privacy",
  ];

  return staticPages.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/contact" ? 0.8 : 0.6,
  }));
}
