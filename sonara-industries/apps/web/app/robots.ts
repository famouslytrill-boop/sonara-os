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
        "/pricing",
        "/trust",
        "/legal",
        "/privacy",
        "/terms",
        "/docs",
      ],
      disallow: ["/api/", "/admin/", "/account/"],
    },
    sitemap: "https://sonaraindustries.com/sitemap.xml",
    host: "https://sonaraindustries.com",
  };
}
