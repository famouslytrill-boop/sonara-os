import {
  ownerConfirmationCategories,
  sensitiveActionRegistry,
  type ActionRiskLevel,
  type OwnerConfirmationCategory
} from "@signal-os/owner-confirmation-lock";

export type AdminCommandRoute =
  | "/admin/command-center"
  | "/admin/users"
  | "/admin/organizations"
  | "/admin/billing"
  | "/admin/payments"
  | "/admin/owner-review"
  | "/admin/autopilot"
  | "/admin/open-source-intake"
  | "/admin/github-update-watcher"
  | "/admin/ai-cost-control"
  | "/admin/production-readiness"
  | "/admin/security-settings"
  | "/admin/deployment-sync"
  | "/admin/prompt-library"
  | "/admin/recommendation-audit"
  | "/admin/market-pattern-lab"
  | "/admin/notification-settings"
  | "/admin/profitability-dashboard"
  | "/admin/support"
  | "/admin/audit-logs"
  | "/admin/system-health"
  | "/admin/settings"
  | "/security-center"
  | "/admin/reliability-center";

export type AdminStatus = "ready" | "setup" | "review" | "blocked" | "beta";

export type AdminSidebarLink = Readonly<{
  label: string;
  route: AdminCommandRoute;
  group: "Overview" | "Platform" | "Controls";
}>;

export type AdminMetric = Readonly<{
  title: string;
  value: string;
  description: string;
  status: AdminStatus;
}>;

export type AdminHealthItem = Readonly<{
  title: string;
  status: AdminStatus;
  risk: ActionRiskLevel;
  description: string;
  href?: AdminCommandRoute;
}>;

export type AdminAuditEvent = Readonly<{
  time: string;
  actor: string;
  action: string;
  productArea: string;
  risk: ActionRiskLevel;
  status: string;
}>;

export type AdminApprovalItem = Readonly<{
  category: OwnerConfirmationCategory;
  title: string;
  productArea: string;
  risk: ActionRiskLevel;
  status: "queued_for_owner_review" | "blocked";
  description: string;
}>;

export type AdminSubPage = Readonly<{
  route: AdminCommandRoute;
  title: string;
  description: string;
  status: AdminStatus;
  cards: readonly AdminMetric[];
  warnings: readonly string[];
}>;

export const adminSidebarLinks: readonly AdminSidebarLink[] = Object.freeze([
  Object.freeze({ label: "Command Center", route: "/admin/command-center", group: "Overview" }),
  Object.freeze({ label: "System Health", route: "/admin/system-health", group: "Overview" }),
  Object.freeze({ label: "Users", route: "/admin/users", group: "Platform" }),
  Object.freeze({ label: "Organizations", route: "/admin/organizations", group: "Platform" }),
  Object.freeze({ label: "Billing", route: "/admin/billing", group: "Platform" }),
  Object.freeze({ label: "Payments", route: "/admin/payments", group: "Platform" }),
  Object.freeze({ label: "Owner Review", route: "/admin/owner-review", group: "Controls" }),
  Object.freeze({ label: "Autopilot", route: "/admin/autopilot", group: "Controls" }),
  Object.freeze({
    label: "Open-Source Intake",
    route: "/admin/open-source-intake",
    group: "Controls"
  }),
  Object.freeze({
    label: "GitHub Updates",
    route: "/admin/github-update-watcher",
    group: "Controls"
  }),
  Object.freeze({ label: "AI Cost Control", route: "/admin/ai-cost-control", group: "Controls" }),
  Object.freeze({
    label: "Production Readiness",
    route: "/admin/production-readiness",
    group: "Controls"
  }),
  Object.freeze({
    label: "Security Settings",
    route: "/admin/security-settings",
    group: "Controls"
  }),
  Object.freeze({ label: "Deployment Sync", route: "/admin/deployment-sync", group: "Controls" }),
  Object.freeze({
    label: "Prompt Library",
    route: "/admin/prompt-library",
    group: "Controls"
  }),
  Object.freeze({
    label: "Recommendation Audit",
    route: "/admin/recommendation-audit",
    group: "Controls"
  }),
  Object.freeze({
    label: "Market Pattern Lab",
    route: "/admin/market-pattern-lab",
    group: "Controls"
  }),
  Object.freeze({
    label: "Notification Settings",
    route: "/admin/notification-settings",
    group: "Controls"
  }),
  Object.freeze({
    label: "Profitability",
    route: "/admin/profitability-dashboard",
    group: "Controls"
  }),
  Object.freeze({ label: "Support", route: "/admin/support", group: "Controls" }),
  Object.freeze({ label: "Audit Logs", route: "/admin/audit-logs", group: "Controls" }),
  Object.freeze({ label: "Admin Settings", route: "/admin/settings", group: "Controls" }),
  Object.freeze({ label: "Security Center", route: "/security-center", group: "Controls" }),
  Object.freeze({
    label: "Reliability Center",
    route: "/admin/reliability-center",
    group: "Controls"
  })
]);

const commandMetrics: readonly AdminMetric[] = Object.freeze([
  metric("Total users", "No live data yet", "Auth/user persistence is not connected.", "setup"),
  metric(
    "Active organizations",
    "No live data yet",
    "Organization counts require production database wiring.",
    "setup"
  ),
  metric(
    "Active subscriptions",
    "No live data yet",
    "Subscription status must come from verified Stripe records.",
    "setup"
  ),
  metric(
    "Failed payments",
    "No live data yet",
    "Failed payment counts require verified Stripe webhook data.",
    "review"
  ),
  metric(
    "Pending owner approvals",
    "Setup-mode queue",
    "Owner Review Queue renders sample-sensitive categories only.",
    "review"
  ),
  metric(
    "Pending customer campaigns",
    "Drafts only",
    "Customer-facing sends require owner approval and opt-out review.",
    "review"
  ),
  metric(
    "Pending AI media approvals",
    "Drafts only",
    "Voice, visual, and video outputs remain approval-gated.",
    "review"
  ),
  metric(
    "Security warnings",
    "Review required",
    "Security Center routes are admin-ready and must be verified with real auth.",
    "review"
  ),
  metric(
    "Reliability warnings",
    "Manual review",
    "Provider health is not live-monitored in this shell.",
    "review"
  ),
  metric(
    "Support tickets",
    "No live data yet",
    "Support request persistence is not connected.",
    "setup"
  ),
  metric(
    "Stripe webhook status",
    "Setup required",
    "Webhook status must be verified with signed Stripe events.",
    "blocked"
  ),
  metric(
    "Domain/SSL status",
    "Placeholder",
    "Production domain and SSL checks require deployed environment verification.",
    "review"
  )
]);

const revenueMetrics: readonly AdminMetric[] = Object.freeze([
  metric(
    "Monthly recurring revenue",
    "Placeholder",
    "Do not show revenue totals until real Stripe subscription data exists.",
    "setup"
  ),
  metric(
    "Setup-service revenue",
    "Placeholder",
    "Do not show setup revenue until real paid service records exist.",
    "setup"
  ),
  metric(
    "Payment custody",
    "Not held by app",
    "Provider-hosted payment flows handle sensitive payment data.",
    "ready"
  )
]);

export function createAdminCommandCenterSnapshot() {
  return Object.freeze({
    metrics: commandMetrics,
    revenue: revenueMetrics,
    health: createSystemHealthItems(),
    approvals: createOwnerApprovalItems(),
    auditEvents: createRecentAuditEvents()
  });
}

export function getAdminSubPage(route: AdminCommandRoute): AdminSubPage {
  return adminSubPages[route] ?? adminSubPages["/admin/command-center"];
}

export function createOwnerApprovalItems(): readonly AdminApprovalItem[] {
  return Object.freeze(
    sensitiveActionRegistry.map((entry) =>
      Object.freeze({
        category: entry.category,
        title: `${entry.title} approvals`,
        productArea: entry.integrations.join(", "),
        risk: entry.riskLevel,
        status: entry.riskLevel === "critical" ? "blocked" : "queued_for_owner_review",
        description: entry.summary
      })
    )
  );
}

export function createSystemHealthItems(): readonly AdminHealthItem[] {
  return Object.freeze([
    health(
      "Business Builder",
      "review",
      "medium",
      "MVP pages render, but real org-scoped writes still require production verification.",
      "/admin/command-center"
    ),
    health(
      "Creator Studio",
      "review",
      "medium",
      "Creator surfaces render; media approval queues remain owner-review gated.",
      "/admin/command-center"
    ),
    health(
      "Growth Studio",
      "review",
      "medium",
      "Growth drafts render; campaign sends must remain approval-gated.",
      "/admin/command-center"
    ),
    health(
      "Stripe",
      "blocked",
      "high",
      "Live billing requires verified checkout, portal, and signed webhook handling.",
      "/admin/billing"
    ),
    health(
      "Security Center",
      "review",
      "high",
      "Admin route exists; production role enforcement must be verified.",
      "/security-center"
    ),
    health(
      "Deployment Sync",
      "review",
      "high",
      "Domain, cloud, auth, paywall, and security checks are local/setup-mode until verified.",
      "/admin/deployment-sync"
    ),
    health(
      "Reliability Center",
      "review",
      "medium",
      "Manual provider status only; no fake uptime or provider-health claims.",
      "/admin/reliability-center"
    )
  ]);
}

export function createRecentAuditEvents(): readonly AdminAuditEvent[] {
  return Object.freeze([
    audit(
      "Setup mode",
      "system",
      "Owner review queue initialized for launch review.",
      "Owner Confirmation Lock",
      "high",
      "requires owner review"
    ),
    audit(
      "Setup mode",
      "system",
      "Stripe webhook status is not live-verified.",
      "Billing/Stripe",
      "high",
      "blocked until configured"
    ),
    audit(
      "Setup mode",
      "system",
      "Provider health cards are manual review records.",
      "Reliability Center",
      "medium",
      "manual review"
    ),
    audit(
      "Setup mode",
      "system",
      "Unknown sensitive actions default to owner review.",
      "Security Center",
      "high",
      "policy enforced"
    )
  ]);
}

export function getOwnerApprovalCoverage(): readonly OwnerConfirmationCategory[] {
  return ownerConfirmationCategories;
}

const adminSubPages: Readonly<Record<AdminCommandRoute, AdminSubPage>> = Object.freeze({
  "/admin/command-center": subPage(
    "/admin/command-center",
    "Administrator Command Center",
    "Owner/admin launch dashboard for platform-wide health, approvals, billing, support, and audit review.",
    "review",
    commandMetrics,
    [
      "This page is setup-mode. It does not show live user, billing, payment, or support totals.",
      "Critical financial and security actions require owner role and Owner Confirmation Lock."
    ]
  ),
  "/admin/users": subPage(
    "/admin/users",
    "Users",
    "Review user account readiness without exposing private account data.",
    "setup",
    [
      metric("Total users", "No live data yet", "Requires production auth/user database.", "setup"),
      metric(
        "Admin users",
        "No live data yet",
        "Owner/admin roles require real auth checks.",
        "setup"
      ),
      metric(
        "Suspended users",
        "No live data yet",
        "No suspension workflow is live in this shell.",
        "setup"
      )
    ],
    ["User emails, tokens, and private account data must not appear in setup-mode UI."]
  ),
  "/admin/organizations": subPage(
    "/admin/organizations",
    "Organizations",
    "Review organization readiness and membership boundaries.",
    "setup",
    [
      metric(
        "Active organizations",
        "No live data yet",
        "Requires production database/RLS wiring.",
        "setup"
      ),
      metric(
        "Ownerless organizations",
        "Unknown",
        "Must be blocked before launch if detected.",
        "blocked"
      ),
      metric(
        "Role checks",
        "Scaffolded",
        "Owner/admin/member/viewer roles require production verification.",
        "review"
      )
    ],
    ["Organization-scoped records must remain private to members with the correct role."]
  ),
  "/admin/billing": subPage(
    "/admin/billing",
    "Billing",
    "Review subscription and checkout readiness without exposing Stripe secrets.",
    "blocked",
    [
      ...revenueMetrics,
      metric(
        "Checkout route",
        "Env-gated",
        "Checkout must safely block until Stripe env is configured.",
        "review"
      ),
      metric(
        "Customer portal",
        "Protected",
        "Portal access must require auth and verified Stripe customer records.",
        "review"
      )
    ],
    [
      "Stripe secret keys, webhook secrets, price IDs, payout details, and tokens are never displayed."
    ]
  ),
  "/admin/payments": subPage(
    "/admin/payments",
    "Payments",
    "Review payment option and provider-link safety.",
    "review",
    [
      metric(
        "Payment options",
        "No live data yet",
        "External payment links require validation and review.",
        "setup"
      ),
      metric(
        "Failed payments",
        "No live data yet",
        "Requires signed Stripe webhook records.",
        "review"
      ),
      metric(
        "Raw card storage",
        "Blocked",
        "The app must not store raw card numbers or CVV.",
        "ready"
      )
    ],
    ["Payment links must be provider-hosted or external URLs; no custody of customer funds in MVP."]
  ),
  "/admin/owner-review": subPage(
    "/admin/owner-review",
    "Owner Review",
    "Review all sensitive action categories before execution.",
    "review",
    [
      metric(
        "Sensitive categories",
        String(ownerConfirmationCategories.length),
        "All required categories are registered.",
        "ready"
      ),
      metric(
        "Unknown sensitive actions",
        "Owner review",
        "Unknown categories must not default to safe.",
        "ready"
      ),
      metric(
        "Always blocked actions",
        "Blocked",
        "Audit log deletion and payout destination changes stay blocked.",
        "ready"
      )
    ],
    ["Approval buttons in this static shell are disabled and do not execute live actions."]
  ),
  "/admin/autopilot": subPage(
    "/admin/autopilot",
    "Autopilot",
    "Review queued routine actions and automation safety boundaries.",
    "review",
    [
      metric(
        "Routine actions",
        "Draft/queue only",
        "Routine work may draft, flag, recommend, and queue.",
        "review"
      ),
      metric(
        "Customer sends",
        "Owner approval",
        "Customer-facing sends cannot execute automatically.",
        "ready"
      ),
      metric("High-risk execution", "Disabled", "High-risk automation flags remain off.", "ready")
    ],
    [
      "Autopilot cannot issue refunds, change prices, publish proof, delete data, or send campaigns without approval."
    ]
  ),
  "/admin/open-source-intake": subPage(
    "/admin/open-source-intake",
    "Open-Source Intake",
    "Review external GitHub and open-source candidates before anything is copied, installed, vendored, self-hosted, or exposed to users.",
    "review",
    [
      metric(
        "Candidate registry",
        "Setup-mode",
        "Owner-provided external projects are tracked as intake candidates only.",
        "review"
      ),
      metric(
        "Blocked tooling",
        "Enforced",
        "Scraping and unofficial messaging automation stay blocked by default.",
        "blocked"
      ),
      metric(
        "License review",
        "Required",
        "GPL, AGPL, unknown, and unreviewed licenses require owner/legal review.",
        "review"
      )
    ],
    [
      "Do not copy external source code, install candidate repos, or claim integrations without explicit review."
    ]
  ),
  "/admin/github-update-watcher": subPage(
    "/admin/github-update-watcher",
    "GitHub Update Watcher",
    "Report-only watcher for selected external repositories and dependency update signals.",
    "review",
    [
      metric(
        "Auto-update",
        "Disabled",
        "No production dependencies are updated automatically.",
        "ready"
      ),
      metric("Auto-merge", "Disabled", "Update reports do not merge code.", "ready"),
      metric("Owner approval", "Required", "Adoption requires owner approval.", "review")
    ],
    ["Watcher output is advisory and must not install or copy external code."]
  ),
  "/admin/ai-cost-control": subPage(
    "/admin/ai-cost-control",
    "AI Cost Control",
    "Review AI run cost guardrails without exposing provider keys.",
    "review",
    [
      metric(
        "Expensive runs",
        "Owner approval",
        "High-cost runs require owner approval.",
        "review"
      ),
      metric(
        "Auto expensive jobs",
        "Disabled",
        "The system cannot auto-run expensive AI jobs.",
        "ready"
      )
    ],
    ["Provider keys and raw prompts must stay server-side/redacted."]
  ),
  "/admin/production-readiness": subPage(
    "/admin/production-readiness",
    "Production Readiness",
    "Review final launch blockers and go-live status.",
    "review",
    [
      metric(
        "Cloud connection",
        "Not verified",
        "Local checks do not prove production deployment.",
        "review"
      ),
      metric(
        "Critical blockers",
        "Manual review",
        "Security, auth, Stripe, domain, and owner approval blockers must be reviewed.",
        "blocked"
      )
    ],
    ["Do not mark launch ready until final commands and manual cloud checks pass."]
  ),
  "/admin/security-settings": subPage(
    "/admin/security-settings",
    "Security Settings",
    "Review sensitive security settings and provider boundaries.",
    "review",
    [
      metric(
        "Security changes",
        "Owner approval",
        "Security setting changes require owner review.",
        "ready"
      ),
      metric(
        "Safety gate disable",
        "Blocked",
        "Routine automation cannot disable security gates.",
        "blocked"
      )
    ],
    ["Critical settings require owner role only in production."]
  ),
  "/admin/deployment-sync": subPage(
    "/admin/deployment-sync",
    "Deployment Sync",
    "Review canonical domain, GitHub, Vercel, Supabase, Stripe, Docker, Rancher, auth, paywall, and security readiness.",
    "review",
    [
      metric(
        "Canonical domain",
        "sonaraindustries.com",
        "Primary public and app route domain for launch.",
        "review"
      ),
      metric(
        "Cloud status",
        "Not verified",
        "Local checks do not prove GitHub, Vercel, Supabase, Stripe, Docker, or Rancher connection.",
        "review"
      ),
      metric(
        "Secrets",
        "Redacted",
        "Keys, tokens, database URLs, webhook secrets, and payout details are never shown.",
        "ready"
      )
    ],
    [
      "Do not claim production domain, SSL, cloud, Stripe, Supabase, or Rancher connection until real verification passes."
    ]
  ),
  "/admin/prompt-library": subPage(
    "/admin/prompt-library",
    "Admin Prompt Library",
    "Review guided prompt templates and prompt safety boundaries.",
    "review",
    [
      metric(
        "Prompt outputs",
        "Draft-only",
        "Templates do not call AI providers or send output.",
        "ready"
      ),
      metric(
        "High-risk prompts",
        "Owner review",
        "Public, customer-facing, legal, pricing, refund, campaign, review, and media prompts require approval.",
        "review"
      )
    ],
    ["Do not copy third-party prompt sheets or publish generated output without review."]
  ),
  "/admin/recommendation-audit": subPage(
    "/admin/recommendation-audit",
    "Recommendation Audit",
    "Review ranking explanations and approval requirements.",
    "review",
    [
      metric("Auto execution", "Disabled", "Recommendations do not execute actions.", "ready"),
      metric(
        "Customer-facing actions",
        "Owner review",
        "Campaign and customer suggestions require owner review.",
        "review"
      )
    ],
    ["Sensitive attributes, fake urgency, fake scarcity, and fake reviews are blocked."]
  ),
  "/admin/market-pattern-lab": subPage(
    "/admin/market-pattern-lab",
    "Market Pattern Lab",
    "Review lawful market research notes and pattern categories.",
    "setup",
    [
      metric(
        "Competitor code copying",
        "Blocked",
        "Protected code and copy cannot be copied.",
        "blocked"
      ),
      metric("Public observation", "Allowed", "Use lawful public observations only.", "ready")
    ],
    ["Research must become original implementation notes before use."]
  ),
  "/admin/notification-settings": subPage(
    "/admin/notification-settings",
    "Notification Settings",
    "Review optional sound notification controls.",
    "setup",
    [
      metric("Sound autoplay", "Blocked", "Sounds must be user-controlled.", "ready"),
      metric(
        "Accessibility",
        "Required",
        "Respect reduced-motion and reduced-sound preferences.",
        "ready"
      )
    ],
    ["No annoying autoplay or mandatory sound cues."]
  ),
  "/admin/profitability-dashboard": subPage(
    "/admin/profitability-dashboard",
    "Profitability Dashboard",
    "Review revenue model and setup-service path without fake revenue claims.",
    "review",
    [
      metric(
        "Revenue totals",
        "Hidden until real data",
        "Do not show fake MRR or setup revenue.",
        "ready"
      ),
      metric("Guarantees", "Blocked", "No guaranteed income, customers, or growth claims.", "ready")
    ],
    ["Marketplace fees require future legal and payment review."]
  ),
  "/admin/support": subPage(
    "/admin/support",
    "Support",
    "Review customer/support request readiness.",
    "setup",
    [
      metric(
        "Open support tickets",
        "No live data yet",
        "Support persistence is not connected.",
        "setup"
      ),
      metric(
        "Billing support",
        "Manual review",
        "Refund/dispute work requires owner approval.",
        "review"
      ),
      metric(
        "Security reports",
        "Manual review",
        "Security issues must be escalated and audit-ready.",
        "review"
      )
    ],
    ["Do not expose private support messages or customer data in admin summaries."]
  ),
  "/admin/audit-logs": subPage(
    "/admin/audit-logs",
    "Audit Logs",
    "Review sensitive action history and blocked-action records.",
    "review",
    [
      metric(
        "Recent audit activity",
        "Setup-mode events",
        "Shows audit readiness without live private logs.",
        "review"
      ),
      metric(
        "Audit log deletion",
        "Always blocked",
        "Deleting audit logs is not allowed.",
        "ready"
      ),
      metric(
        "Sensitive events",
        "Audit-ready",
        "Billing, owner lock, role, provider, AI, and legal actions are modeled.",
        "review"
      )
    ],
    ["Audit logs must be append-only/admin-visible in production and must never expose secrets."]
  ),
  "/admin/system-health": subPage(
    "/admin/system-health",
    "System Health",
    "Review domain, deployment, Stripe, security, and reliability status.",
    "review",
    [
      metric(
        "Domain/SSL",
        "Placeholder",
        "Production domain and SSL must be verified after deploy.",
        "review"
      ),
      metric(
        "Database",
        "Setup required",
        "Supabase/RLS must be verified in target environment.",
        "blocked"
      ),
      metric(
        "Health endpoint",
        "Build artifact",
        "Static health route exists in generated output.",
        "review"
      )
    ],
    [
      "No uptime, provider health, or production-readiness claim should appear without verified checks."
    ]
  ),
  "/admin/settings": subPage(
    "/admin/settings",
    "Admin Settings",
    "Review administrative settings boundaries.",
    "review",
    [
      metric(
        "Owner role changes",
        "Owner confirmation",
        "Role and owner changes require approval.",
        "ready"
      ),
      metric(
        "Provider keys",
        "Server-only",
        "Provider keys must not be displayed client-side.",
        "ready"
      ),
      metric(
        "Security gates",
        "Protected",
        "Disabling security gates is blocked from routine automation.",
        "ready"
      )
    ],
    ["Critical financial/security settings require owner role only."]
  ),
  "/security-center": subPage(
    "/security-center",
    "Security Center",
    "Review launch security gates, sensitive actions, source leak prevention, and provider safety.",
    "review",
    [
      metric(
        "Security alerts",
        "Review required",
        "Security Center pages are admin-ready.",
        "review"
      ),
      metric("Source leak scan", "Available", "Run scan before each release.", "ready"),
      metric(
        "AI provider safety",
        "Gated",
        "External sensitive-data routing requires approval.",
        "review"
      )
    ],
    ["Security routes require owner/admin access in production."]
  ),
  "/admin/reliability-center": subPage(
    "/admin/reliability-center",
    "Reliability Center",
    "Review provider health, incidents, continuity mode, and recovery checklist.",
    "review",
    [
      metric(
        "Provider health",
        "Manual review",
        "No fake live provider status is shown.",
        "review"
      ),
      metric(
        "Incidents",
        "Draft records",
        "Incident records do not publish automatically.",
        "review"
      ),
      metric("Continuity mode", "Manual only", "Auto-failover is disabled.", "ready")
    ],
    ["Public status remains private/off unless explicitly configured and approved."]
  )
});

function metric(
  title: string,
  value: string,
  description: string,
  status: AdminStatus
): AdminMetric {
  return Object.freeze({ title, value, description, status });
}

function health(
  title: string,
  status: AdminStatus,
  risk: ActionRiskLevel,
  description: string,
  href?: AdminCommandRoute
): AdminHealthItem {
  return Object.freeze({ title, status, risk, description, href });
}

function audit(
  time: string,
  actor: string,
  action: string,
  productArea: string,
  risk: ActionRiskLevel,
  status: string
): AdminAuditEvent {
  return Object.freeze({ time, actor, action, productArea, risk, status });
}

function subPage(
  route: AdminCommandRoute,
  title: string,
  description: string,
  status: AdminStatus,
  cards: readonly AdminMetric[],
  warnings: readonly string[]
): AdminSubPage {
  return Object.freeze({
    route,
    title,
    description,
    status,
    cards: Object.freeze([...cards]),
    warnings: Object.freeze([...warnings])
  });
}
