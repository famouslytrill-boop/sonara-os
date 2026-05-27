import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/business-builder",
        "/creator-studio",
        "/growth-studio",
        "/about",
        "/pricing",
        "/trust",
        "/legal",
        "/privacy",
        "/terms",
        "/support",
      ],
      disallow: ["/api/", "/admin/", "/dashboard/", "/account/", "/app/"],
    },
    sitemap: "https://sonaraindustries.com/sitemap.xml",
    host: "https://sonaraindustries.com",
  };
}
