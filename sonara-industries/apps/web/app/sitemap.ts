import type { MetadataRoute } from "next";

const publicRoutes = [
  "",
  "/about",
  "/docs",
  "/trust",
  "/legal",
  "/privacy",
  "/terms",
  "/offline",
  "/trackfoundry",
  "/trackfoundry/features",
  "/trackfoundry/how-it-works",
  "/trackfoundry/app",
  "/trackfoundry/pricing",
  "/trackfoundry/security",
  "/trackfoundry/resources",
  "/trackfoundry/signup",
  "/lineready",
  "/lineready/features",
  "/lineready/how-it-works",
  "/lineready/app",
  "/lineready/pricing",
  "/lineready/security",
  "/lineready/resources",
  "/lineready/signup",
  "/noticegrid",
  "/noticegrid/features",
  "/noticegrid/how-it-works",
  "/noticegrid/app",
  "/noticegrid/pricing",
  "/noticegrid/security",
  "/noticegrid/resources",
  "/noticegrid/signup",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `https://sonaraindustries.com${route}`,
    lastModified,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route.includes("/app") ? 0.6 : 0.8,
  }));
}
