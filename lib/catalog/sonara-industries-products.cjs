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
    // Was /products, which is the public index of the three studios -- three
    // marketing cards and no account in sight. This row is about one account
    // spanning all three, and /dashboard is where a signed-in customer sees
    // exactly that: their workspaces, billing, requests and activity together.
    "/dashboard",
    "one workspace across all three studios|billing in one place|your requests and activity",
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
    // Was /account/setup, which renders no cards at all -- a workspace name
    // box and a "Continue to Business Builder" button. /account is where an
    // organization is created or joined, which is what this row is about.
    "/account",
    "sign-in|create or join an organization|who is in it|what each person may do",
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
    // Was "File Storage", claiming "file storage | versions | approvals |
    // exports | provenance" and pointing at /dashboard. There is no file store
    // a customer can upload to anywhere in this product -- the only storage
    // path is the signed download of a Creator Studio generation result -- and
    // /dashboard is the workspace index, which holds no files at all.
    //
    // What does exist is /account/data: every table your account owns, a
    // download of all of it, and a way to ask for erasure. That is portability
    // rather than storage, so the row says that instead.
    "asset-document-vault",
    "Your Records, And Taking Them With You",
    "storage",
    "See every kind of record your account holds, download the lot, and ask for it to be erased.",
    "Leave whenever you want, with everything you put in.",
    "free",
    "beta",
    "/account/data",
    "what is kept|how long it is kept|download everything|erasure requests",
    "Supabase|export jobs",
    "Erasure is a request rather than a button, because an automated wipe of an organization is not a decision to take unreviewed."
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
    // Trimmed. The page states a portfolio thesis, a pricing position and the
    // rule that no market data is invented; it does not score opportunities or
    // run a validation portfolio, and claiming so on the card a customer reads
    // before paying is the fault this audit was looking for.
    "competitor evidence|market signals|written stop rules",
    "market intelligence|product lifecycle",
    "No build commitment without evidence, owner, cost ceiling, and review."
  ]
]);
