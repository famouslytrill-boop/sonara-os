export type HouseBrandKey = "trackfoundry" | "lineready" | "noticegrid";

export type HouseBrandSection =
  | "features"
  | "how-it-works"
  | "app"
  | "pricing"
  | "security"
  | "resources";

export const houseBrands = {
  trackfoundry: {
    name: "TrackFoundry",
    tagline: "Build the artist. Shape the release.",
    category: "Music creation and release-readiness software.",
    audience: "independent artists, producers, labels, studios, managers, and creators",
    route: "/trackfoundry",
    accent: "#a78bfa",
    buttonVariant: "music" as const,
    modules: ["Artist DNA", "Catalog Vault", "Release Desk", "Transcript Studio", "Prompt Foundry", "Market Pulse"],
    outcomes: [
      "Clarify artist identity before release work begins.",
      "Organize tracks, transcripts, prompts, launch notes, and rights placeholders.",
      "Prepare releases with human review for rights, splits, metadata, and campaign readiness.",
    ],
    pricing: [
      ["Starter", "$19/mo", "Solo creator workspace with core release-readiness tools."],
      ["Studio", "$49/mo", "Expanded catalog, prompt, transcript, and team workflows."],
      ["Label", "$149/mo", "Multi-artist planning, review rooms, and launch operations."],
    ],
    resources: ["Release-readiness checklist", "Artist DNA starter guide", "Prompt export safety notes"],
  },
  lineready: {
    name: "LineReady",
    tagline: "Every shift ready.",
    category: "Restaurant operations and labor-control software.",
    audience: "restaurant owners, chefs, managers, food trucks, caterers, hospitality groups, and small franchises",
    route: "/lineready",
    accent: "#f59e0b",
    buttonVariant: "tableops" as const,
    modules: ["Labor Control", "Schedule Grid", "Recipe Costing", "Crew Chat", "Vendor Links", "Compliance Board"],
    outcomes: [
      "Keep daily shift work, recipes, vendors, compliance, and staff notes in one command center.",
      "Estimate labor, menu margins, and prep pressure before service starts.",
      "Queue sensitive actions like raises, role changes, and billing changes for human approval.",
    ],
    pricing: [
      ["Single Store", "$39/mo", "One-location command center for scheduling, recipes, and vendor links."],
      ["Operator", "$89/mo", "Labor controls, menu costing, compliance, and crew coordination."],
      ["Group", "$199/mo", "Multi-location workflows, manager views, and approval queues."],
    ],
    resources: ["Labor cost worksheet", "Recipe costing tutorial", "Shift-readiness checklist"],
  },
  noticegrid: {
    name: "NoticeGrid",
    tagline: "Local updates without the noise.",
    category: "Verified local information and public-notice software.",
    audience: "residents, libraries, schools, nonprofits, local businesses, city offices, and community organizations",
    route: "/noticegrid",
    accent: "#34d399",
    buttonVariant: "civic" as const,
    modules: ["Verified Feeds", "Notice Builder", "Local Grid", "Organization Pages", "Weather + Transit Links", "Quiet Alerting"],
    outcomes: [
      "Give organizations a clear place to publish verified local updates.",
      "Separate public notices, events, weather, transit, and organization pages from noisy social feeds.",
      "Require approval before public notices, mass notifications, external links, or generated public alerts go live.",
    ],
    pricing: [
      ["Community", "Free", "Public browsing, digest preferences, and basic local information access."],
      ["Organization", "$29/mo", "Verified pages, notices, events, and approval-gated publishing."],
      ["Municipal", "$149/mo", "Multi-department workflows, source checks, and public information controls."],
    ],
    resources: ["Verified notice guide", "Source trust checklist", "Quiet alerting tutorial"],
  },
} as const;

export function getHouseBrand(key: HouseBrandKey) {
  return houseBrands[key];
}
