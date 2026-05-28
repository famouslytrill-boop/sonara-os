export type CrawlPolicyStatus = "allowed_with_permission" | "blocked" | "needs_review";

export type CrawlPolicyRule = {
  label: string;
  status: CrawlPolicyStatus;
  detail: string;
};

export const crawlPolicyRules: CrawlPolicyRule[] = [
  {
    label: "User-owned websites",
    status: "allowed_with_permission",
    detail: "Allowed when the user confirms ownership or authorization and rate limits are respected.",
  },
  {
    label: "Public docs and READMEs",
    status: "allowed_with_permission",
    detail: "Allowed for research summaries when robots.txt, license terms, and provider terms allow access.",
  },
  {
    label: "Public product pages",
    status: "allowed_with_permission",
    detail: "Allowed for market research notes when collection is transparent and rate limited.",
  },
  {
    label: "Paywalled or private data",
    status: "blocked",
    detail: "Blocked. Do not bypass paywalls, logins, platform rules, or access controls.",
  },
  {
    label: "Social platform mass scraping",
    status: "blocked",
    detail: "Blocked. Use official APIs, public datasets, or user-provided exports where permitted.",
  },
  {
    label: "Government or public data",
    status: "needs_review",
    detail: "Review source terms, attribution, freshness, and permitted use before collection.",
  },
];

export const crawlPolicyDefaults = {
  maxDepth: "1-2 levels until reviewed",
  rateLimit: "slow, respectful, and source-specific",
  storage: "summary placeholders only until database/RLS review",
  liveCrawling: "disabled",
} as const;
