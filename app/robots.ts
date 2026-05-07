import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/trackfoundry",
        "/lineready",
        "/noticegrid",
        "/about",
        "/docs",
        "/pricing",
        "/trust",
        "/legal",
        "/privacy",
        "/terms",
        "/support",
      ],
      disallow: ["/api/", "/admin/", "/dashboard/", "/account/"],
    },
    sitemap: "https://sonaraindustries.com/sitemap.xml",
    host: "https://sonaraindustries.com",
  };
}
