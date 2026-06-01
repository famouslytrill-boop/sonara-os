export type GoLiveStatus = "not_started" | "needs_review" | "ready" | "blocked";

export type GoLiveCategory =
  | "domain"
  | "ssl"
  | "env_vars"
  | "database"
  | "auth"
  | "stripe"
  | "webhooks"
  | "security_headers"
  | "source_leak_scan"
  | "rls"
  | "admin_protection"
  | "backups"
  | "monitoring"
  | "public_pages"
  | "pricing"
  | "onboarding"
  | "email_support"
  | "legal_pages"
  | "mobile_layout";

export type GoLiveLaunchStatus = "go" | "no_go";

export type GoLiveChecklistItem = Readonly<{
  id: string;
  category: GoLiveCategory;
  title: string;
  description: string;
  status: GoLiveStatus;
  critical: boolean;
  verification: string;
  remediation: string;
}>;

export type GoLiveChecklistSummary = Readonly<{
  total: number;
  ready: number;
  needsReview: number;
  blocked: number;
  notStarted: number;
  criticalOpen: number;
  launchStatus: GoLiveLaunchStatus;
}>;

export const goLiveStatusLabels: Readonly<Record<GoLiveStatus, string>> = Object.freeze({
  not_started: "Not started",
  needs_review: "Needs review",
  ready: "Ready",
  blocked: "Blocked"
});

export const goLiveCategoryLabels: Readonly<Record<GoLiveCategory, string>> = Object.freeze({
  domain: "Domain",
  ssl: "SSL",
  env_vars: "Environment variables",
  database: "Database",
  auth: "Auth",
  stripe: "Stripe",
  webhooks: "Webhooks",
  security_headers: "Security headers",
  source_leak_scan: "Source leak scan",
  rls: "RLS",
  admin_protection: "Admin protection",
  backups: "Backups",
  monitoring: "Monitoring",
  public_pages: "Public pages",
  pricing: "Pricing",
  onboarding: "Onboarding",
  email_support: "Email and support",
  legal_pages: "Legal pages",
  mobile_layout: "Mobile layout"
});

export const goLiveChecklistItems: readonly GoLiveChecklistItem[] = Object.freeze([
  Object.freeze({
    id: "domain-production-url",
    category: "domain",
    title: "Production domain points to the live deployment",
    description: "The root and www hostnames must resolve to the intended production app.",
    status: "needs_review",
    critical: true,
    verification:
      "Verify DNS records and visit the production domain from a clean browser session.",
    remediation: "Fix DNS records or hosting project domain assignment before launch."
  }),
  Object.freeze({
    id: "ssl-active",
    category: "ssl",
    title: "SSL certificate is active",
    description: "Production traffic must be served over HTTPS with no mixed-content warnings.",
    status: "needs_review",
    critical: true,
    verification:
      "Check the browser lock, certificate issuer, expiry, and HTTPS redirect behavior.",
    remediation: "Wait for certificate provisioning or repair domain configuration."
  }),
  Object.freeze({
    id: "env-production-values",
    category: "env_vars",
    title: "Production env vars are configured",
    description: "Required public and server env vars must be set in hosting, never committed.",
    status: "blocked",
    critical: true,
    verification: "Compare hosting env vars with .env.example and production checklist docs.",
    remediation: "Add missing production values in the hosting provider and redeploy."
  }),
  Object.freeze({
    id: "database-connection",
    category: "database",
    title: "Database connection verified",
    description: "Production database connectivity and migration state must be verified.",
    status: "blocked",
    critical: true,
    verification: "Run database health checks and confirm required migrations are applied.",
    remediation: "Configure Supabase or database connection and apply reviewed migrations."
  }),
  Object.freeze({
    id: "auth-routes",
    category: "auth",
    title: "Auth routes and session behavior verified",
    description: "Protected app areas must require a signed-in user before private data is shown.",
    status: "needs_review",
    critical: true,
    verification: "Test signed-out, signed-in, and no-organization states.",
    remediation: "Repair route protection before enabling public signups."
  }),
  Object.freeze({
    id: "stripe-live-mode",
    category: "stripe",
    title: "Stripe billing configured safely",
    description: "Hosted checkout, customer portal, and webhook config must be validated.",
    status: "needs_review",
    critical: true,
    verification: "Confirm live-mode Stripe keys, price IDs, and webhook endpoint settings.",
    remediation: "Keep billing in setup mode until Stripe config and webhook verification pass."
  }),
  Object.freeze({
    id: "webhook-signatures",
    category: "webhooks",
    title: "Webhook signatures verified",
    description: "Stripe and future provider webhooks must reject unsigned or replayed payloads.",
    status: "blocked",
    critical: true,
    verification: "Send a signed test event and confirm invalid signatures are blocked.",
    remediation: "Configure webhook secrets and signature checks before accepting live events."
  }),
  Object.freeze({
    id: "security-headers",
    category: "security_headers",
    title: "Security headers deployed",
    description: "CSP, frame, content type, referrer, and permissions policies must be active.",
    status: "needs_review",
    critical: true,
    verification: "Inspect response headers on the production domain.",
    remediation: "Apply static or hosting-specific headers before launch."
  }),
  Object.freeze({
    id: "source-leak-scan-clean",
    category: "source_leak_scan",
    title: "Source leak scan is clean",
    description:
      "Build output must not expose env files, secrets, service-role keys, or source maps.",
    status: "needs_review",
    critical: true,
    verification: "Run pnpm run security:scan-artifacts after a fresh production build.",
    remediation: "Remove exposed artifacts or secrets and rebuild before launch."
  }),
  Object.freeze({
    id: "rls-policies",
    category: "rls",
    title: "RLS policies verified",
    description: "Organization-scoped tables must prevent cross-tenant reads and writes.",
    status: "blocked",
    critical: true,
    verification: "Run manual SQL checks for anonymous, member, and non-member access.",
    remediation: "Keep writes disabled until RLS policies are reviewed and tested."
  }),
  Object.freeze({
    id: "admin-routes-protected",
    category: "admin_protection",
    title: "Admin routes are protected",
    description: "Admin and security pages must require elevated access before production use.",
    status: "needs_review",
    critical: true,
    verification: "Confirm signed-out users cannot access admin-only production actions.",
    remediation: "Add or repair admin role checks before launch."
  }),
  Object.freeze({
    id: "backup-plan-approved",
    category: "backups",
    title: "Backup and restore plan approved",
    description: "Production data needs a tested backup, restore, and retention plan.",
    status: "blocked",
    critical: true,
    verification: "Confirm backup schedule, restore owner, and last restore test evidence.",
    remediation: "Define and test backups before accepting production customer data."
  }),
  Object.freeze({
    id: "monitoring-ready",
    category: "monitoring",
    title: "Monitoring and alert ownership ready",
    description: "Deployment, error, billing, and database alerts need owners and response paths.",
    status: "needs_review",
    critical: true,
    verification: "Confirm alert channels, owners, thresholds, and escalation process.",
    remediation: "Set monitoring contacts and incident process before launch."
  }),
  Object.freeze({
    id: "public-pages-reviewed",
    category: "public_pages",
    title: "Public pages reviewed",
    description: "Marketing, security, support, and product pages must avoid fake claims.",
    status: "needs_review",
    critical: false,
    verification: "Review public copy for launch accuracy and safe claims.",
    remediation: "Update copy before public launch."
  }),
  Object.freeze({
    id: "pricing-reviewed",
    category: "pricing",
    title: "Pricing is final for launch",
    description: "Pricing tiers, setup services, and CTAs must match owner-approved launch terms.",
    status: "needs_review",
    critical: true,
    verification: "Compare pricing page against approved billing plan and Stripe price IDs.",
    remediation: "Correct pricing or keep checkout disabled until approved."
  }),
  Object.freeze({
    id: "onboarding-reviewed",
    category: "onboarding",
    title: "Onboarding flow reviewed",
    description: "Setup flow must explain incomplete states without pretending data is live.",
    status: "needs_review",
    critical: false,
    verification: "Complete each product setup path on desktop and mobile.",
    remediation: "Fix unclear setup states before inviting beta users."
  }),
  Object.freeze({
    id: "support-channel-ready",
    category: "email_support",
    title: "Email and support channel ready",
    description: "Support contact, response owner, and issue intake path must be ready.",
    status: "needs_review",
    critical: true,
    verification: "Send a test support request and confirm owner response path.",
    remediation: "Configure support email or keep beta invites closed."
  }),
  Object.freeze({
    id: "legal-pages-approved",
    category: "legal_pages",
    title: "Legal placeholders approved for launch",
    description: "Terms and privacy pages must not imply legal review if still placeholders.",
    status: "needs_review",
    critical: true,
    verification: "Review legal pages with the owner and counsel where required.",
    remediation: "Replace placeholders or block public launch until approved."
  }),
  Object.freeze({
    id: "mobile-layout-reviewed",
    category: "mobile_layout",
    title: "Mobile layout reviewed",
    description: "Core public and app routes must be readable and usable on small screens.",
    status: "needs_review",
    critical: false,
    verification: "Test homepage, pricing, onboarding, dashboards, billing, and support on mobile.",
    remediation: "Fix blocking overflow, unreadable text, or inaccessible controls."
  })
]);

export function summarizeGoLiveChecklist(
  items: readonly GoLiveChecklistItem[] = goLiveChecklistItems
): GoLiveChecklistSummary {
  const ready = items.filter((item) => item.status === "ready").length;
  const needsReview = items.filter((item) => item.status === "needs_review").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const notStarted = items.filter((item) => item.status === "not_started").length;
  const criticalOpen = items.filter((item) => item.critical && item.status !== "ready").length;

  return Object.freeze({
    total: items.length,
    ready,
    needsReview,
    blocked,
    notStarted,
    criticalOpen,
    launchStatus: criticalOpen === 0 && blocked === 0 ? "go" : "no_go"
  });
}

export function getGoLiveItemsByCategory(
  category: GoLiveCategory,
  items: readonly GoLiveChecklistItem[] = goLiveChecklistItems
) {
  return items.filter((item) => item.category === category);
}

export function getCriticalGoLiveBlockers(
  items: readonly GoLiveChecklistItem[] = goLiveChecklistItems
) {
  return items.filter((item) => item.critical && item.status !== "ready");
}
