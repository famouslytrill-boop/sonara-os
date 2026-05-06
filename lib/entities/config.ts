export type EntitySlug =
  | "parent-company"
  | "creator-music-technology"
  | "business-operations"
  | "community-public-information";

export type EntityType =
  | "parent_company"
  | "creator_music_technology"
  | "business_operations"
  | "community_public_information";

export type EntityRole = "owner" | "admin" | "operator" | "viewer";

export type EntityConfig = {
  slug: EntitySlug;
  name: string;
  shortName: string;
  entityType: EntityType;
  description: string;
  audience: string;
  theme: {
    accent: string;
    accentSoft: string;
    gradient: string;
  };
  heartbeatTypes: string[];
  proactiveActions: Array<{
    title: string;
    actionType: string;
    priority: "low" | "medium" | "high" | "critical";
    requiresApproval: boolean;
  }>;
  tools: Array<{
    name: string;
    type: string;
    status: "active" | "paused" | "disabled" | "setup_required";
    requiresApproval: boolean;
  }>;
  connectors: Array<{
    name: string;
    type: string;
    status: "connected" | "disconnected" | "setup_required" | "error" | "disabled";
  }>;
};

export const entityConfigs: EntityConfig[] = [
  {
    slug: "parent-company",
    name: "Parent Company",
    shortName: "Parent",
    entityType: "parent_company",
    description:
      "Parent governance for security, billing, infrastructure, audit logs, deployment readiness, and cross-entity policy.",
    audience: "Parent administrators and trusted operators",
    theme: {
      accent: "#22D3EE",
      accentSoft: "rgba(34, 211, 238, 0.16)",
      gradient: "from-cyan-400 via-violet-500 to-slate-200",
    },
    heartbeatTypes: ["system", "database", "auth", "security", "workers", "connectors"],
    proactiveActions: [
      { title: "Backup check", actionType: "backup", priority: "high", requiresApproval: false },
      { title: "Security review", actionType: "security", priority: "high", requiresApproval: true },
      { title: "Deployment readiness review", actionType: "deployment", priority: "medium", requiresApproval: true },
    ],
    tools: [
      { name: "Security Review Agent", type: "security_review", status: "setup_required", requiresApproval: true },
      { name: "Database Review Agent", type: "db_review", status: "setup_required", requiresApproval: true },
      { name: "Stripe Review Agent", type: "stripe_review", status: "setup_required", requiresApproval: true },
    ],
    connectors: [
      { name: "Supabase", type: "supabase", status: "setup_required" },
      { name: "Stripe", type: "stripe", status: "setup_required" },
      { name: "GitHub", type: "github", status: "setup_required" },
    ],
  },
  {
    slug: "creator-music-technology",
    name: "Creator/Music Technology Company",
    shortName: "Creator/Music",
    entityType: "creator_music_technology",
    description:
      "Creator infrastructure for music projects, asset workflows, release readiness, catalog operations, and creator tooling.",
    audience: "Artists, producers, studios, labels, and creator teams",
    theme: {
      accent: "#A855F7",
      accentSoft: "rgba(168, 85, 247, 0.16)",
      gradient: "from-violet-400 via-fuchsia-500 to-cyan-300",
    },
    heartbeatTypes: ["creator_tools", "storage", "browser", "workers", "security"],
    proactiveActions: [
      { title: "Release checklist review", actionType: "creator_tooling", priority: "medium", requiresApproval: false },
      { title: "Asset storage check", actionType: "storage", priority: "medium", requiresApproval: false },
      { title: "Project dashboard QA", actionType: "testing", priority: "medium", requiresApproval: false },
      { title: "Creator market setup check", actionType: "creator_tooling", priority: "low", requiresApproval: true },
    ],
    tools: [
      { name: "Browser Research Agent", type: "browser_research", status: "setup_required", requiresApproval: false },
      { name: "Release Ops Agent", type: "release_ops", status: "setup_required", requiresApproval: true },
      { name: "QA Testing Agent", type: "qa_testing", status: "setup_required", requiresApproval: false },
    ],
    connectors: [
      { name: "Public Web Sources", type: "public_web", status: "setup_required" },
      { name: "GitHub", type: "github", status: "setup_required" },
      { name: "MCP Server", type: "mcp", status: "setup_required" },
    ],
  },
  {
    slug: "business-operations",
    name: "Business Operations Company",
    shortName: "Business Ops",
    entityType: "business_operations",
    description:
      "Operations infrastructure for restaurants and small businesses, including staff workflows, QR/order checks, vendor links, and daily systems.",
    audience: "Restaurants, small businesses, managers, staff, and operations teams",
    theme: {
      accent: "#F59E0B",
      accentSoft: "rgba(245, 158, 11, 0.16)",
      gradient: "from-amber-300 via-orange-500 to-rose-400",
    },
    heartbeatTypes: ["business_ops", "database", "auth", "storage", "stripe", "workers"],
    proactiveActions: [
      { title: "QR/order flow test", actionType: "business_ops", priority: "medium", requiresApproval: false },
      { title: "Staff task flow test", actionType: "testing", priority: "medium", requiresApproval: false },
      { title: "Inventory alert test", actionType: "business_ops", priority: "low", requiresApproval: true },
      { title: "Customer feedback test", actionType: "business_ops", priority: "low", requiresApproval: false },
    ],
    tools: [
      { name: "Business Ops Agent", type: "business_ops", status: "setup_required", requiresApproval: true },
      { name: "Worker Ops Agent", type: "worker_ops", status: "setup_required", requiresApproval: true },
      { name: "Support Triage Agent", type: "support_triage", status: "setup_required", requiresApproval: true },
    ],
    connectors: [
      { name: "Custom API", type: "custom_api", status: "setup_required" },
      { name: "Google Workspace", type: "google_workspace", status: "setup_required" },
      { name: "Slack", type: "slack", status: "setup_required" },
    ],
  },
  {
    slug: "community-public-information",
    name: "Community/Public Information Company",
    shortName: "Community Info",
    entityType: "community_public_information",
    description:
      "Public information aggregation and approval-gated communication workflows for source-linked community notices.",
    audience: "Residents, local organizations, libraries, nonprofits, and public-facing teams",
    theme: {
      accent: "#10B981",
      accentSoft: "rgba(16, 185, 129, 0.16)",
      gradient: "from-emerald-300 via-sky-400 to-blue-500",
    },
    heartbeatTypes: ["community_info", "public_feed", "browser", "connectors", "security"],
    proactiveActions: [
      { title: "Public source review", actionType: "public_info", priority: "high", requiresApproval: true },
      { title: "Organization page review", actionType: "community_ops", priority: "medium", requiresApproval: true },
      { title: "Feed freshness check", actionType: "community_ops", priority: "medium", requiresApproval: false },
      { title: "Disclaimer review", actionType: "content", priority: "high", requiresApproval: true },
    ],
    tools: [
      { name: "Community Ops Agent", type: "community_ops", status: "setup_required", requiresApproval: true },
      { name: "Documentation Agent", type: "documentation", status: "setup_required", requiresApproval: false },
      { name: "Browser Research Agent", type: "browser_research", status: "setup_required", requiresApproval: false },
    ],
    connectors: [
      { name: "RSS/Public Web", type: "public_web", status: "setup_required" },
      { name: "MCP Server", type: "mcp", status: "setup_required" },
      { name: "Custom API", type: "custom_api", status: "setup_required" },
    ],
  },
];

export function getEntityBySlug(slug: string): EntityConfig | undefined {
  return entityConfigs.find((entity) => entity.slug === slug);
}

export function requireEntityBySlug(slug: string): EntityConfig {
  const entity = getEntityBySlug(slug);
  if (!entity) {
    throw new Error(`Unknown entity slug: ${slug}`);
  }
  return entity;
}

export const entityDashboardSections = [
  { label: "Overview", path: "" },
  { label: "Browser", path: "browser" },
  { label: "Bookmarks", path: "bookmarks" },
  { label: "Notes", path: "notes" },
  { label: "Heartbeat", path: "heartbeat" },
  { label: "Actions", path: "actions" },
  { label: "Agents", path: "agents" },
  { label: "Automations", path: "automations" },
  { label: "Connectors", path: "connectors" },
] as const;
