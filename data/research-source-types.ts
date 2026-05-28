export type ResearchSourceType = {
  label: string;
  examples: string[];
  defaultStatus: "allowed_with_permission" | "blocked" | "needs_review";
};

export const researchSourceTypes: ResearchSourceType[] = [
  {
    label: "User-owned websites",
    examples: ["company homepage", "owned landing page", "owned help docs"],
    defaultStatus: "allowed_with_permission",
  },
  {
    label: "Public docs",
    examples: ["official documentation", "public README", "release notes"],
    defaultStatus: "allowed_with_permission",
  },
  {
    label: "Public product pages",
    examples: ["pricing page", "feature page", "public changelog"],
    defaultStatus: "allowed_with_permission",
  },
  {
    label: "Restricted/private sources",
    examples: ["paywalled pages", "private accounts", "login-required dashboards"],
    defaultStatus: "blocked",
  },
  {
    label: "Public data sites",
    examples: ["government data", "public statistics", "open datasets"],
    defaultStatus: "needs_review",
  },
];
