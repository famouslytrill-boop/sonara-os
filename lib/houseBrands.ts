export type SonaraProductKey = "businessBuilder" | "creatorStudio" | "growthStudio";
export type HouseBrandKey = SonaraProductKey;
export type HouseBrandSection = "features" | "how-it-works" | "app" | "pricing" | "security" | "resources";

export type SonaraProduct = {
  key: SonaraProductKey;
  slug: "business-builder" | "creator-studio" | "growth-studio";
  name: string;
  route: string;
  accent: string;
  category: string;
  tagline: string;
  positioning: string;
  audience: string;
  modules: string[];
  outcomes: string[];
  pricing: string[];
};

export const sonaraProducts: Record<SonaraProductKey, SonaraProduct> = {
  businessBuilder: {
    key: "businessBuilder",
    slug: "business-builder",
    name: "Business Builder",
    route: "/business-builder",
    accent: "#2DD4BF",
    category: "Business operations",
    tagline: "Create, launch, run, and manage a business.",
    positioning:
      "Guided systems for proof, payments, bookings, customer records, files, reviews, and operational intelligence.",
    audience: "service businesses, local operators, solo founders, and teams that need a cleaner way to launch and run.",
    modules: [
      "Smart Setup Wizard",
      "Business Passport",
      "Customer Records",
      "Quotes and Payment Options",
      "Booking/Appointments",
      "Files & Records",
      "Operations Board",
      "Reviews",
      "Alerts",
      "Training/SOPs",
      "Trust Shield",
    ],
    outcomes: ["Launch a usable business profile", "Connect payment and booking paths", "Keep records organized"],
    pricing: ["Free", "Starter", "Core", "Pro"],
  },
  creatorStudio: {
    key: "creatorStudio",
    slug: "creator-studio",
    name: "Creator Studio",
    route: "/creator-studio",
    accent: "#818CF8",
    category: "Creator operations",
    tagline: "Organize, protect, publish, and monetize creative work.",
    positioning:
      "A creator workspace for assets, proof, release planning, offers, rights notes, content calendars, and monetization tracking.",
    audience: "creators, educators, digital product sellers, studios, media teams, and collaborators.",
    modules: [
      "Creator Passport",
      "Asset Vault",
      "Release Planner",
      "Offer Builder",
      "Media Records",
      "Prompt Playbook",
      "Content Calendar",
      "Rights/License Notes",
      "Monetization Tracker",
      "Growth Links",
    ],
    outcomes: ["Keep creative assets organized", "Prepare releases with rights notes", "Turn work into clear offers"],
    pricing: ["Free", "Starter", "Core", "Pro"],
  },
  growthStudio: {
    key: "growthStudio",
    slug: "growth-studio",
    name: "Growth Studio",
    route: "/growth-studio",
    accent: "#38BDF8",
    category: "Growth systems",
    tagline: "Attract customers, leads, fans, referrals, reviews, and revenue.",
    positioning:
      "Growth systems for campaigns, offers, follow-up, reviews, referrals, research, and next best actions.",
    audience: "business owners, creators, agencies, community builders, and teams turning attention into follow-up.",
    modules: [
      "Campaign Builder",
      "Lead Inbox",
      "Customer Follow-up",
      "Review Engine",
      "Referral Engine",
      "Offer Studio",
      "Research Lab",
      "Trend Radar",
      "Growth Dashboard",
      "Creator-to-business marketplace preview",
    ],
    outcomes: ["Plan campaigns without fake urgency", "Queue safe follow-up", "Improve reviews and referrals"],
    pricing: ["Free", "Growth", "Pro", "Agency/Scale"],
  },
};

export const products = Object.values(sonaraProducts);

export const sharedInfrastructure = [
  "Trust Shield",
  "Proof-to-Payment",
  "Business Memory Graph",
  "Smart Setup Wizard",
  "Research Lab",
  "Graph Builder",
  "Files & Records",
  "Access Control",
  "Billing & Entitlements",
  "Alerts & Signals",
  "AI Governance",
  "Customer Success",
  "Launch Readiness",
] as const;

export function getSonaraProduct(slug: string | undefined) {
  return products.find((product) => product.slug === slug);
}

export function getHouseBrand(key: HouseBrandKey) {
  return sonaraProducts[key];
}
