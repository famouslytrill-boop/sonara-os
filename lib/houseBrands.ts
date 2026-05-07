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
    accent: "#9B5CFF",
    modules: ["Artist DNA", "Catalog Vault", "Release Desk", "Transcript Studio", "Prompt Foundry", "Market Pulse"],
    pricing: ["Starter $19/mo", "Studio $49/mo", "Label $149/mo"],
  },
  lineready: {
    name: "LineReady",
    tagline: "Every shift ready.",
    category: "Restaurant operations and labor-control software.",
    audience: "restaurant owners, chefs, managers, food trucks, caterers, hospitality groups, and small franchises",
    route: "/lineready",
    accent: "#FFB454",
    modules: ["Labor Control", "Schedule Grid", "Recipe Costing", "Crew Chat", "Vendor Links", "Compliance Board"],
    pricing: ["Single Store $39/mo", "Operator $89/mo", "Group $199/mo"],
  },
  noticegrid: {
    name: "NoticeGrid",
    tagline: "Local updates without the noise.",
    category: "Verified local information and public-notice software.",
    audience: "residents, libraries, schools, nonprofits, local businesses, city offices, and community organizations",
    route: "/noticegrid",
    accent: "#2DD4BF",
    modules: ["Verified Feeds", "Notice Builder", "Local Grid", "Organization Pages", "Weather + Transit Links", "Quiet Alerting"],
    pricing: ["Community Free", "Organization $29/mo", "Municipal $149/mo"],
  },
} as const;

export function getHouseBrand(key: HouseBrandKey) {
  return houseBrands[key];
}
