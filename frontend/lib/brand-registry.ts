export type BrandKey = "business-builder" | "creator-studio" | "growth-studio";
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
    "SONARA Industries owns the shared infrastructure, security posture, research layer, and operating discipline behind Business Builder, Creator Studio, and Growth Studio.",
} as const;

export const productModes: Record<ProductMode, string> = {
  "Beginner Mode": "Hides complexity and shows only the next useful action.",
  "Operator Mode": "Daily workflow mode for teams running the system.",
  "Expert Mode": "Exposes advanced settings, exports, diagnostics, and approval context.",
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
  "customer-facing campaigns",
  "billing changes",
  "price changes",
  "refunds",
  "user deletion",
  "role escalation",
  "public external links",
  "AI-generated public media",
] as const;

export const brands: Record<BrandKey, BrandDefinition> = {
  "business-builder": {
    key: "business-builder",
    name: "Business Builder",
    category: "Business operations",
    audience: "Service businesses, local operators, solo founders, and teams that need a clean launch path.",
    tagline: "Create, launch, run, and manage a business.",
    problem:
      "Operators lose time when proof, payment links, bookings, customers, files, reviews, and launch tasks live in separate systems.",
    howItWorks: [
      "Create a business profile and setup checklist.",
      "Add safe payment and booking links without storing card data.",
      "Organize customers, offers, reviews, records, and approval-gated follow-up.",
    ],
    modules: [
      { name: "Smart Setup Wizard", description: "Guides profile, payment, booking, customer, and review readiness." },
      { name: "Business Passport", description: "Stores proof, trust details, and launch-ready business profile context." },
      { name: "Customer Records", description: "Tracks customers, consent, notes, tags, and follow-up drafts." },
      { name: "Payment Options", description: "Stores external payment URLs and warnings without raw card handling." },
      { name: "Bookings", description: "Stores booking links, call-to-book paths, and appointment request context." },
      { name: "Reviews", description: "Queues review requests and testimonial records for owner review." },
    ],
    pricing: [
      { name: "Free", price: "$0", audience: "Exploration", stripePriceEnv: "", features: ["Setup checklist", "Profile draft", "Launch warnings"] },
      { name: "Starter", price: "$9-$15/mo", audience: "Solo operators", stripePriceEnv: "STRIPE_PRICE_STARTER", features: ["Profile", "Payment links", "Booking links"] },
      { name: "Core", price: "Around $29/mo", audience: "Working businesses", stripePriceEnv: "STRIPE_PRICE_CORE", features: ["Records", "Offers", "Reviews"] },
    ],
    theme: {
      surface: "#081915",
      accent: "#2DD4BF",
      accent2: "#5EEAD4",
      description: "Trustworthy, operational, calm, and readable.",
    },
    dashboard: {
      metrics: [
        { label: "Setup progress", value: "62%", helper: "Payment and review setup pending" },
        { label: "Open customers", value: "12", helper: "3 follow-up drafts" },
        { label: "Money path", value: "Draft", helper: "No payment custody" },
      ],
      sidebar: ["Profile", "Customers", "Bookings", "Payments", "Reviews", "Files"],
      priorityWorkflow: ["Finish profile", "Add payment option", "Add booking link", "Queue review draft"],
      approvals: ["Public payment link", "Offer publishing", "Review request send"],
      emptyStates: ["No customer records yet", "No payment option yet", "No booking link yet"],
      ctas: ["Create profile", "Add payment link", "Queue follow-up"],
    },
    security: [
      "Organization-scoped records",
      "No raw card data",
      "Owner approval for customer-facing sends",
      "Audit logs for payment-link changes",
      "Opt-out and consent-aware follow-up",
    ],
    resources: ["Business setup guide", "Payment-link safety", "Review request safety", "Launch checklist"],
  },
  "creator-studio": {
    key: "creator-studio",
    name: "Creator Studio",
    category: "Creator operations",
    audience: "Creators, educators, studios, media teams, digital product sellers, and collaborators.",
    tagline: "Organize, protect, publish, and monetize creative work.",
    problem:
      "Creative teams need one place for assets, rights notes, offers, launch planning, media records, and monetization paths.",
    howItWorks: [
      "Create a creator profile and proof card draft.",
      "Organize assets, rights notes, launch tasks, and offers.",
      "Keep public publishing and AI media outputs behind owner approval.",
    ],
    modules: [
      { name: "Creator Passport", description: "Profile, proof, and launch context for a creator workspace." },
      { name: "Asset Vault", description: "Asset records, source notes, rights notes, and usage context." },
      { name: "Release Planner", description: "Launch tasks, publishing readiness, and collaboration notes." },
      { name: "Offer Builder", description: "Digital product, service, and monetization offer drafts." },
      { name: "Prompt Playbook", description: "Guided AI tasks with safety warnings and approval routing." },
      { name: "Content Calendar", description: "Planned posts, releases, and campaign drafts." },
    ],
    pricing: [
      { name: "Free", price: "$0", audience: "Exploration", stripePriceEnv: "", features: ["Proof draft", "Asset notes", "Setup checklist"] },
      { name: "Starter", price: "$9-$15/mo", audience: "Creators", stripePriceEnv: "STRIPE_PRICE_STARTER", features: ["Proof card", "Assets", "Offers"] },
      { name: "Pro", price: "$79-$99/mo", audience: "Creator teams", stripePriceEnv: "STRIPE_PRICE_PRO", features: ["Approval queue", "Advanced records", "Priority support"] },
    ],
    theme: {
      surface: "#111322",
      accent: "#818CF8",
      accent2: "#A5B4FC",
      description: "Creative, precise, media-aware, and rights-conscious.",
    },
    dashboard: {
      metrics: [
        { label: "Proof readiness", value: "Draft", helper: "Rights notes incomplete" },
        { label: "Asset records", value: "24", helper: "6 need source notes" },
        { label: "Launch tasks", value: "9", helper: "2 approval required" },
      ],
      sidebar: ["Proof", "Assets", "Offers", "Calendar", "Rights", "Launch"],
      priorityWorkflow: ["Add rights note", "Create offer", "Review launch checklist", "Approve proof card"],
      approvals: ["Proof publishing", "AI media export", "Rights-sensitive copy"],
      emptyStates: ["No asset records yet", "No offer draft yet", "No content calendar yet"],
      ctas: ["Add asset", "Build offer", "Create release plan"],
    },
    security: [
      "Rights notes before publishing",
      "Owner approval for public AI media",
      "No impersonation workflows",
      "Audit logs for asset publishing",
      "Draft-only legal and policy copy",
    ],
    resources: ["Creator proof guide", "Asset rights guide", "Release planning guide", "AI media safety"],
  },
  "growth-studio": {
    key: "growth-studio",
    name: "Growth Studio",
    category: "Growth systems",
    audience: "Business owners, creators, agencies, community builders, and growth operators.",
    tagline: "Attract customers, leads, fans, referrals, reviews, and revenue.",
    problem:
      "Growth work breaks when campaigns, offers, follow-up, reviews, referrals, and research are disconnected from approval and safety rules.",
    howItWorks: [
      "Create offers, campaigns, and audience-safe follow-up drafts.",
      "Rank next best actions with explainable recommendation signals.",
      "Require owner approval before sending campaigns or public claims.",
    ],
    modules: [
      { name: "Campaign Builder", description: "Draft campaigns, announcements, and launch messages." },
      { name: "Lead Inbox", description: "Organize leads and follow-up state." },
      { name: "Review Engine", description: "Prepare review request drafts and testimonial records." },
      { name: "Referral Engine", description: "Plan referral campaigns without fake urgency or hidden terms." },
      { name: "Research Lab", description: "Capture market observations and positioning notes." },
      { name: "Growth Dashboard", description: "Shows next best action, risk, confidence, and approval requirement." },
    ],
    pricing: [
      { name: "Free", price: "$0", audience: "Exploration", stripePriceEnv: "", features: ["Campaign drafts", "Setup checklist", "Warnings"] },
      { name: "Growth", price: "$49-$59/mo", audience: "Growth teams", stripePriceEnv: "STRIPE_PRICE_GROWTH", features: ["Campaigns", "Referrals", "Review drafts"] },
      { name: "Agency/Scale", price: "$149-$199/mo or custom", audience: "Agencies", stripePriceEnv: "STRIPE_PRICE_AGENCY", features: ["Multi-workspace planning", "Admin review", "Client setup"] },
    ],
    theme: {
      surface: "#071827",
      accent: "#38BDF8",
      accent2: "#7DD3FC",
      description: "Momentum-focused, transparent, and claim-safe.",
    },
    dashboard: {
      metrics: [
        { label: "Pending campaigns", value: "5", helper: "All owner-review required" },
        { label: "Review drafts", value: "8", helper: "Consent check required" },
        { label: "Next action", value: "Offer", helper: "Explainable ranking" },
      ],
      sidebar: ["Campaigns", "Leads", "Reviews", "Referrals", "Research", "Recommendations"],
      priorityWorkflow: ["Update stale offer", "Draft review request", "Review pending campaign", "Resolve safety warning"],
      approvals: ["Campaign send", "Public ad copy", "Customer-facing follow-up"],
      emptyStates: ["No campaign drafts yet", "No leads yet", "No referral draft yet"],
      ctas: ["Create campaign", "Queue review draft", "Review recommendations"],
    },
    security: [
      "No auto-sent campaigns",
      "No fake scarcity or fake reviews",
      "Sensitive attributes excluded from ranking",
      "Owner approval for customer messaging",
      "Audit logs for public campaign changes",
    ],
    resources: ["Campaign safety guide", "Review request guide", "Recommendation transparency", "Referral launch guide"],
  },
};

export const brandList = Object.values(brands);

export function getBrand(key: BrandKey) {
  return brands[key];
}

export function isBrandKey(value: string): value is BrandKey {
  return value === "business-builder" || value === "creator-studio" || value === "growth-studio";
}
