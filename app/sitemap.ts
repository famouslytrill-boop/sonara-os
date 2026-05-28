import type { MetadataRoute } from "next";
import { openSourceTools } from "../data/open-source-tools";

const publicRoutes = [
  "",
  "/about",
  "/business-builder",
  "/creator-studio",
  "/creator-studio/tools",
  "/creator-studio/tools/animation",
  "/creator-studio/tools/open-source",
  "/creator-studio/tools/video",
  "/creator-studio/tools/design",
  "/creator-studio/tools/ai-agents",
  "/growth-studio",
  "/growth-studio/intelligence",
  "/growth-studio/content-signals",
  "/growth-studio/recommendation-research",
  "/research-lab",
  "/research-lab/open-source",
  "/research-lab/model-comparison",
  "/research-lab/creator-tools",
  "/research-lab/growth-intelligence",
  "/research-lab/multimodal",
  "/research-lab/safety-review",
  "/research-lab/crawling",
  "/pricing",
  "/trust",
  "/legal",
  "/legal/terms",
  "/legal/privacy",
  "/legal/refund-policy",
  "/legal/acceptable-use",
  "/legal/open-source-policy",
  "/legal/security",
  "/privacy",
  "/terms",
  "/support",
  "/contact",
  "/offline",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const staticRoutes = publicRoutes.map((route) => ({
    url: `https://sonaraindustries.com${route}`,
    lastModified,
    changeFrequency: route === "" ? ("weekly" as const) : ("monthly" as const),
    priority: route === "" ? 1 : 0.8,
  }));

  return [
    ...staticRoutes,
    ...openSourceTools.map((tool) => ({
      url: `https://sonaraindustries.com/research-lab/open-source/${tool.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
