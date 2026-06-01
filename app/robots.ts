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
        "/status",
        "/docs",
        "/api-webhooks",
        "/integrations",
        "/changelog",
        "/legal",
        "/privacy",
        "/terms",
        "/support",
        "/contact",
        "/help",
        "/feedback",
        "/research-lab",
        "/open-source",
      ],
      disallow: ["/api/", "/admin/", "/dashboard/", "/account/", "/app/"],
    },
    sitemap: "https://sonaraindustries.com/sitemap.xml",
    host: "https://sonaraindustries.com",
  };
}
