import type { MetadataRoute } from "next";

const publicRoutes = [
  "",
  "/about",
  "/business-builder",
  "/creator-studio",
  "/growth-studio",
  "/pricing",
  "/trust",
  "/legal",
  "/legal/terms",
  "/legal/privacy",
  "/legal/refund-policy",
  "/legal/acceptable-use",
  "/legal/security",
  "/privacy",
  "/terms",
  "/support",
  "/contact",
  "/offline",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `https://sonaraindustries.com${route}`,
    lastModified,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
