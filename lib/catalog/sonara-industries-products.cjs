"use strict";

// Row shape:
//   [serviceKey, name, category, summary, customerOutcome,
//    planFloor, lifecycleStatus, route, capabilities, dependencies, safetyBoundary]
//
// name, summary and customerOutcome are printed on the catalog a customer
// reads before deciding to pay, so they are written for that reader. The
// remaining fields are internal and keep their precise names.

module.exports = Object.freeze([
  [
    "nexus-shared-operating-spine",
    "One Connected Account",
    "platform",
    "Your customers, files, billing, and history stay in one place across all three studios.",
    "Move between studios without typing the same details in twice.",
    "free",
    "beta",
    "/products",
    "shared organizations|customer evidence|assets|billing|integrations|workflow audit",
    "Supabase|shared database contract",
    "Tenant isolation and server-side controls remain mandatory."
  ],
  [
    "identity-organizations-access",
    "Logins, Team & Permissions",
    "platform",
    "Sign-up, sign-in, your team, and who is allowed to do what in each workspace.",
    "Give each person exactly the access they should have, and nothing more.",
    "free",
    "active",
    "/account/setup",
    "authentication|organizations|memberships|roles|session controls",
    "Supabase Auth|RLS",
    "Unknown access defaults to denied; service-role credentials never reach clients."
  ],
  [
    "billing-entitlements",
    "Plans & Billing",
    "billing",
    "Subscriptions, one-off purchases, and which features your plan opens up.",
    "Pay for what you use, and get access the moment payment clears.",
    "free",
    "beta",
    "/pricing",
    "Stripe checkout|webhooks|subscriptions|purchases|entitlements",
    "Stripe|billing tables",
    "No raw card data; access changes require verified provider events."
  ],
  [
    "asset-document-vault",
    "File Storage",
    "storage",
    "Private storage for documents, media, exports, and approvals, organised by the work that produced them.",
    "Keep important files safe, easy to find, and yours to take with you.",
    "free",
    "beta",
    "/dashboard",
    "file storage|versions|approvals|exports|provenance",
    "Supabase Storage|storage policies",
    "Uploads require tenant-scoped policies and rights-aware metadata."
  ],
  [
    "integration-hub",
    "Connected Accounts",
    "integrations",
    "Safe connections to payments, email, publishing, file storage, and analytics.",
    "Connect the tools you already use without handing over your passwords.",
    "free",
    "beta",
    "/account/integrations",
    "provider registry|connection status|job history|retries|cost visibility",
    "provider gateway|server configuration",
    "Adapters stay disabled until configured, reviewed, and authorized."
  ],
  [
    "audit-security-readiness-center",
    "Security & Status Center",
    "security",
    "One place to see permissions, records, connections, and admin activity across your account.",
    "Spot a problem before it reaches your customers.",
    "free",
    "beta",
    "/readiness",
    "health checks|database contract|security reviews|admin audit|provider readiness",
    "audit logs|readiness probes",
    "Status views never expose secrets or private customer rows."
  ],
  [
    "market-intelligence-product-lifecycle",
    "Research & Roadmap",
    "strategy",
    "Dated research, scored opportunities, live experiments, the numbers behind them, and honest stop rules.",
    "Decide what to build next from evidence instead of a hunch.",
    "free",
    "active",
    "/market-intelligence",
    "competitor evidence|market signals|opportunity scoring|validation portfolio|stage reviews",
    "market intelligence|product lifecycle",
    "No build commitment without evidence, owner, cost ceiling, and review."
  ]
]);
