export type BrandKey = "trackfoundry" | "lineready" | "noticegrid";
export type ProductMode = "Beginner Mode" | "Operator Mode" | "Expert Mode" | "Approval Mode";
export type OrganizationRole = "owner" | "admin" | "manager" | "staff" | "viewer" | "public";

export type BrandModule = {
  name: string;
  description: string;
};

export type PricingTier = {
  name: string;
  price: string;
  audience: string;
  features: string[];
  stripePriceEnv: string;
};

export type AppMetric = {
  label: string;
  value: string;
  helper: string;
};

export type BrandDefinition = {
  key: BrandKey;
  name: string;
  category: string;
  audience: string;
  tagline: string;
  problem: string;
  howItWorks: string[];
  modules: BrandModule[];
  pricing: PricingTier[];
  theme: {
    surface: string;
    accent: string;
    accent2: string;
    description: string;
  };
  dashboard: {
    metrics: AppMetric[];
    sidebar: string[];
    priorityWorkflow: string[];
    approvals: string[];
    emptyStates: string[];
    ctas: string[];
  };
  security: string[];
  resources: string[];
};

export const parentCompany = {
  name: "SONARA Industries",
  positioning: "A technology holding company that owns independent software companies.",
  tagline: "Independent systems. Shared infrastructure. Stronger markets.",
  operatingModel:
    "SONARA Industries owns the shared infrastructure, security posture, research layer, and operating discipline behind independent software companies.",
} as const;

export const productModes: Record<ProductMode, string> = {
  "Beginner Mode": "Hides complexity and shows only the next useful action.",
  "Operator Mode": "Daily workflow mode for teams running the system.",
  "Expert Mode": "Exposes formulas, exports, advanced settings, and deeper diagnostics.",
  "Approval Mode": "Shows risky actions waiting for a human owner or admin to approve.",
};

export const roleCapabilities: Record<OrganizationRole, string[]> = {
  owner: ["billing", "roles", "security", "approvals", "exports", "publishing"],
  admin: ["roles", "security", "approvals", "exports", "publishing"],
  manager: ["approvals", "exports", "team workflows"],
  staff: ["daily workflows", "drafts", "internal messages"],
  viewer: ["read-only dashboards"],
  public: ["public pages only"],
};

export const riskyActions = [
  "public notice publishing",
  "mass notifications",
  "billing changes",
  "user deletion",
  "role escalation",
  "public external links",
  "public civic notices",
  "AI-generated public alerts",
] as const;

export const brands: Record<BrandKey, BrandDefinition> = {
  trackfoundry: {
    key: "trackfoundry",
    name: "TrackFoundry",
    category: "Music creation and release-readiness software.",
    audience: "Independent artists, producers, labels, studios, managers, and creators.",
    tagline: "Build the artist. Shape the release.",
    problem:
      "Music teams lose momentum when songs, notes, transcripts, prompts, media assets, and release decisions scatter across tools.",
    howItWorks: [
      "Capture artist identity, track details, and release context.",
      "Run a readiness workflow across catalog, assets, prompts, rights placeholders, and campaign notes.",
      "Export structured release materials only after a human reviews risky or public-facing actions.",
    ],
    modules: [
      { name: "Artist DNA", description: "Identity, voice, influence boundaries, cadence notes, and creative direction." },
      { name: "Catalog Vault", description: "Track catalog, media vault, key, BPM, structure, mix notes, and assets." },
      { name: "Release Desk", description: "Release-readiness checklist, campaign assets, rights/splits placeholders, and launch tasks." },
      { name: "Transcript Studio", description: "Transcription, lyric notes, cadence notes, and version review." },
      { name: "Prompt Foundry", description: "Prompt export slots, anti-repetition fields, and influence-safe direction." },
      { name: "Market Pulse", description: "Practical market signals and positioning without claiming guaranteed outcomes." },
    ],
    pricing: [
      {
        name: "Starter",
        price: "$19/mo",
        audience: "Solo artists and producers",
        stripePriceEnv: "STRIPE_TRACKFOUNDRY_STARTER_PRICE_ID",
        features: ["Artist DNA", "Catalog Vault", "Release checklist", "Prompt export slots"],
      },
      {
        name: "Studio",
        price: "$49/mo",
        audience: "Studios and managers",
        stripePriceEnv: "STRIPE_TRACKFOUNDRY_STUDIO_PRICE_ID",
        features: ["Media vault", "Transcript Studio", "Campaign assets", "Approval queue"],
      },
      {
        name: "Label",
        price: "$149/mo",
        audience: "Labels and multi-artist teams",
        stripePriceEnv: "STRIPE_TRACKFOUNDRY_LABEL_PRICE_ID",
        features: ["Multi-artist catalog", "Team roles", "Advanced exports", "Release operations"],
      },
    ],
    theme: {
      surface: "#101018",
      accent: "#8B5CF6",
      accent2: "#22D3EE",
      description: "Premium dark studio interface, waveform energy, violet/cyan accents, modern music-tech confidence.",
    },
    dashboard: {
      metrics: [
        { label: "Release readiness", value: "74/100", helper: "Needs rights and campaign proof" },
        { label: "Open tracks", value: "18", helper: "4 ready for review" },
        { label: "Prompt exports", value: "32", helper: "Influence-safe drafts" },
      ],
      sidebar: ["Artist DNA", "Catalog Vault", "Release Desk", "Transcript Studio", "Prompt Foundry", "Market Pulse"],
      priorityWorkflow: ["Finish key/BPM notes", "Attach cover draft", "Review splits placeholder", "Approve prompt export"],
      approvals: ["Public external link", "Campaign copy export", "Rights-sensitive asset"],
      emptyStates: ["No transcript uploaded yet", "No campaign assets attached", "No split notes recorded"],
      ctas: ["Add track", "Run readiness", "Export release packet"],
    },
    security: [
      "Organization-scoped catalog access",
      "Owner/admin approvals for public links and exports",
      "Audit logs for release changes",
      "Private media vault boundaries",
      "No direct artist cloning or copyrighted imitation workflows",
    ],
    resources: ["Release-readiness tutorial", "Influence DNA guide", "Transcript workflow", "Rights placeholder checklist"],
  },
  lineready: {
    key: "lineready",
    name: "LineReady",
    category: "Restaurant operations and labor-control software.",
    audience: "Restaurant owners, chefs, managers, food trucks, caterers, hospitality groups, and small franchises.",
    tagline: "Every shift ready.",
    problem:
      "Restaurant teams need one calm place to control labor, schedules, recipes, vendor links, repairs, certifications, and crew communication.",
    howItWorks: [
      "Load employees, roles, availability, job titles, pay rates, and store context.",
      "Plan shifts, estimate labor cost, review recipe margin, and track compliance work.",
      "Queue sensitive changes like raises, billing, role escalation, and public links for approval.",
    ],
    modules: [
      { name: "Labor Control", description: "Labor percentage, future projections, payroll links, raises, promotions, holidays, transfers, and placement." },
      { name: "Schedule Grid", description: "Employee scheduling, job titles, addresses, phone numbers, new hires, and shift coverage." },
      { name: "Recipe Costing", description: "Recipe costing, menu margin, pricing floors, QR menu links, and menu pricing." },
      { name: "Crew Chat", description: "Staff messages, profile pictures, announcements, and manager review." },
      { name: "Vendor Links", description: "Suppliers, payroll, insurance, repairs, servicing, and vendor contacts." },
      { name: "Compliance Board", description: "Permits, certifications, food safety tasks, insurance dates, and tutorials." },
    ],
    pricing: [
      {
        name: "Single Store",
        price: "$39/mo",
        audience: "One location",
        stripePriceEnv: "STRIPE_LINEREADY_SINGLE_STORE_PRICE_ID",
        features: ["Schedule Grid", "Labor calculator", "Recipe costing", "Compliance Board"],
      },
      {
        name: "Operator",
        price: "$89/mo",
        audience: "Hands-on operators",
        stripePriceEnv: "STRIPE_LINEREADY_OPERATOR_PRICE_ID",
        features: ["Future projections", "Crew Chat", "Vendor Links", "QR menu links"],
      },
      {
        name: "Group",
        price: "$199/mo",
        audience: "Small groups and franchises",
        stripePriceEnv: "STRIPE_LINEREADY_GROUP_PRICE_ID",
        features: ["Multi-store views", "Transfers", "Advanced approvals", "Owner controls"],
      },
    ],
    theme: {
      surface: "#17120E",
      accent: "#F59E0B",
      accent2: "#E76F51",
      description: "Warm restaurant command center, charcoal, warm white, amber, terracotta, fast and easy to understand.",
    },
    dashboard: {
      metrics: [
        { label: "Labor cost", value: "27.8%", helper: "Within target" },
        { label: "Open shifts", value: "5", helper: "2 need manager review" },
        { label: "Menu margin", value: "68%", helper: "One item below floor" },
      ],
      sidebar: ["Labor Control", "Schedule Grid", "Recipe Costing", "Crew Chat", "Vendor Links", "Compliance Board"],
      priorityWorkflow: ["Fill dinner line", "Review overtime risk", "Update recipe cost", "Renew permit reminder"],
      approvals: ["Raise request", "Role escalation", "Public QR menu link"],
      emptyStates: ["No repairs logged", "No vendor link attached", "No transfer request pending"],
      ctas: ["Build schedule", "Calculate labor", "Price menu item"],
    },
    security: [
      "Owner-only billing and role controls",
      "Manager-scoped schedule and employee access",
      "Audit logs for payroll-adjacent changes",
      "Approval queue for raises, promotions, transfers, and public links",
      "Private employee contact fields scoped to organization roles",
    ],
    resources: ["Labor percentage tutorial", "Recipe margin guide", "Schedule placement guide", "Permit and certification checklist"],
  },
  noticegrid: {
    key: "noticegrid",
    name: "NoticeGrid",
    category: "Verified local information and public-notice software.",
    audience: "Residents, libraries, schools, nonprofits, local businesses, city offices, and community organizations.",
    tagline: "Local updates without the noise.",
    problem:
      "Local updates are scattered across social feeds, websites, PDFs, and word of mouth, making trust and visibility hard.",
    howItWorks: [
      "Create verified organization pages and connect source checks.",
      "Draft notices, events, quiet alerts, and digest updates with visibility controls.",
      "Require approval before publishing public notices, mass notifications, or generated public alerts.",
    ],
    modules: [
      { name: "Verified Feeds", description: "Public feed sources, source trust scores, source checks, weather, transit, and local alerts." },
      { name: "Notice Builder", description: "Public notices, private drafts, visibility controls, QR codes, and approval queue." },
      { name: "Local Grid", description: "Calm local information layout for events, updates, and verified sources." },
      { name: "Organization Pages", description: "Verified pages for libraries, schools, nonprofits, businesses, and city offices." },
      { name: "Weather + Transit Links", description: "Helpful local context links without pretending to be an emergency system." },
      { name: "Quiet Alerting", description: "Digest mode, low-noise alerts, and approval-first public messaging." },
    ],
    pricing: [
      {
        name: "Community",
        price: "Free",
        audience: "Residents and small community groups",
        stripePriceEnv: "STRIPE_NOTICEGRID_COMMUNITY_PRICE_ID",
        features: ["Public browsing", "Digest preferences", "Basic organization pages"],
      },
      {
        name: "Organization",
        price: "$29/mo",
        audience: "Libraries, nonprofits, schools, and local businesses",
        stripePriceEnv: "STRIPE_NOTICEGRID_ORGANIZATION_PRICE_ID",
        features: ["Notice Builder", "QR codes", "Verified source checks", "Quiet alerts"],
      },
      {
        name: "Municipal",
        price: "$149/mo",
        audience: "City offices and public information teams",
        stripePriceEnv: "STRIPE_NOTICEGRID_MUNICIPAL_PRICE_ID",
        features: ["Multiple organizations", "Approval queues", "Digest controls", "Audit logs"],
      },
    ],
    theme: {
      surface: "#0D1720",
      accent: "#2563EB",
      accent2: "#14B8A6",
      description: "Civic, calm, trustworthy, accessible, blue, teal, slate, clear public-information layout.",
    },
    dashboard: {
      metrics: [
        { label: "Source trust", value: "91/100", helper: "3 sources need re-check" },
        { label: "Pending notices", value: "7", helper: "2 public approvals needed" },
        { label: "Quiet digests", value: "14", helper: "Scheduled this week" },
      ],
      sidebar: ["Verified Feeds", "Notice Builder", "Local Grid", "Organization Pages", "Weather + Transit Links", "Quiet Alerting"],
      priorityWorkflow: ["Verify source", "Review public notice", "Attach transit link", "Schedule quiet digest"],
      approvals: ["Public civic notice", "Mass notification", "Generated alert draft"],
      emptyStates: ["No events posted", "No source check attached", "No digest audience selected"],
      ctas: ["Build notice", "Verify source", "Preview digest"],
    },
    security: [
      "Public users cannot publish notices",
      "Organization-scoped drafting and approval",
      "Audit logs for public notices and source changes",
      "Mass notifications require approval",
      "Not an emergency dispatch, voting, medical alert, or law-enforcement system",
    ],
    resources: ["Verified notice tutorial", "Source trust guide", "Quiet alerting guide", "Organization QR code setup"],
  },
};

export const brandList = Object.values(brands);

export function getBrand(key: BrandKey) {
  return brands[key];
}

export function isBrandKey(value: string): value is BrandKey {
  return value === "trackfoundry" || value === "lineready" || value === "noticegrid";
}
