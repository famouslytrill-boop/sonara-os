"use strict";

// Every GET route this server answers, accounted for.
//
// `lib/sonara-route-registry.cjs` is the *page* manifest: 308 routes with a
// title, a navigation placement, an indexing policy and a visibility. It is
// read by the sitemap, the navigation, the smoke tests and
// `scripts/verify-route-registry.cjs`, whose closing line reads
//
//   Route registry verification passed: 308 required GET routes, N total
//   registrations, no duplicates.
//
// **Measured 16 September 2026: the server answers 564 GET routes.** 256 of
// them are in no manifest, and the existing gate flags none of them, because
// the only reverse check it runs is `untrackedProductRoutes`, whose filter is
//
//   const PRODUCT_ROUTE_PATTERN = /^\/(business-builder|creator-studio|growth-studio)(?:\/|$)/;
//
// So `/api/...`, `/admin/...`, `/staff/...`, `/account/...`, `/legal/...`,
// `/research-lab/...` and `/owner/...` are outside the population it examines.
// It returned an empty list, the assertion passed on empty, and the line above
// printed. That is this repository's recurring defect twice over: a check
// measuring a narrower population than its message implies, and an assertion
// satisfied by a list that cannot contain anything.
//
// This module is the missing half. It does not re-declare pages and it does not
// decide access -- it says, for every served route the page manifest does not
// carry, which surface it belongs to and why that surface is not a page. A route
// matching no surface is a route nobody declared, and
// `scripts/verify-route-surface.mjs` fails on it.
//
// The list is two-sided on purpose, the way `lib/sonara-orphan-tables.cjs` is: a
// surface matching zero served routes fails as well, because a reason that no
// longer describes anything is worse than no reason at all -- it is what the
// next person reads instead of checking.
//
// `expectedAccess` is asserted by
// `tests/a-route-nobody-declared-still-answers.test.js`, which probes these
// routes against a configured server as an anonymous visitor. Sixty-seven of
// them had never been probed by anything before that test existed. Every value here
// was written from that probe rather than from reading the handlers.

// What a surface may claim about a signed-out visitor.
//
//   public       -- answers 200 to anybody, and is meant to.
//   public_alias -- an older or alternative path that redirects to a page
//                   anybody may open. It is a redirect, and following it has to
//                   reach 200 without a session.
//   signed_in    -- refuses a stranger: 401, 402, 403, or a redirect whose
//                   destination is a sign-in page.
//   parameterised -- carries a `:parameter`, so there is no single URL to probe.
//                    The parent page carries the metadata; see catalogueParent.
//   json         -- a JSON endpoint rather than a page. Access is asserted by
//                   the tenant-scoping and authorization checks, not by this one.
//
// `public_alias` exists because of a false pass in the first version of this
// module, found on 16 September 2026 by the test rather than by reading the
// code. `/onboarding`, `/feedback` and `/research-lab` were filed as
// `signed_in`, and the probe agreed -- because the probe accepted *any*
// redirect as a refusal, and all three redirect to a public page
// (`/account/setup`, `/contact?topic=feedback`, `/ecosystem`) through the
// `publicCompatibilityRoutes` map in server.js. A 303 to somewhere anybody may
// open is not a refusal, and a check that reads it as one would pass while an
// admin page quietly began redirecting to the home page.
//
// So `signed_in` now requires the destination to be a sign-in page, and these
// aliases are asserted for what they actually are. The reason worth recording
// is that the original entry carried a confident sentence explaining why
// `/research-lab` refused a stranger while its children served one. That
// sentence was reasoned, not verified; the redirect target was three lines away
// in server.js the whole time.
const ACCESS = Object.freeze(["public", "public_alias", "signed_in", "parameterised", "json"]);

const ROUTE_SURFACES = Object.freeze([
  {
    key: "json_api",
    label: "JSON API",
    pattern: /^\/api\//,
    expectedAccess: "json",
    reason:
      "A JSON endpoint has no title, no navigation placement and no indexing policy, which are three of the four fields the page registry requires. Putting them there would mean inventing metadata for something no person ever opens. Their access is covered by report-tenant-scoped-queries and the authorization checks."
  },
  {
    key: "record_detail_and_edit",
    label: "One record, and the form that edits it",
    // Deliberately anchored to the areas it covers rather than written as a
    // bare /:[A-Za-z]/. A pattern matching any parameter at all would also
    // swallow every token-addressed share link below, and two surfaces claiming
    // one route is not an accounting -- it is whichever one was listed first.
    // accountRoutes reports that as `ambiguous` and the gate fails on it.
    pattern: /^\/(business-builder|creator-studio|growth-studio|product-lifecycle|prompt-library|requests)\/[^?]*:[A-Za-z]/,
    expectedAccess: "parameterised",
    reason:
      "A route carrying a parameter is one customer's record rather than a destination: there is no /business-builder/owner/invoices/:recordId to put in a menu. catalogueParent already requires the parent to be catalogued, so the area cannot hide behind the parameter."
  },
  {
    key: "legal_document_alias",
    label: "Legal documents served under /legal/",
    pattern: /^\/legal\/|^\/subprocessor-notice$/,
    expectedAccess: "public",
    ownerDecision: "docs/owner/LEGAL-URL-DECISION.md",
    reason:
      "These are the canonical addresses of SONARA's legal documents, and none of them is in the page manifest. legalAliasPages() in server.js treats /legal/x as the `source` -- its own comment says so -- and serves the short /privacy, /terms, /cookies form as an alias carrying a canonical link back here. Measured 16 September 2026: all eight pairs serve byte-identical content AND an identical canonical tag pointing at /legal/..., so the duplicate-content question is already answered correctly and is NOT what this record is about. Two things are: the sitemap lists seven aliases whose own canonical points at a URL the sitemap omits, and SIX documents are published only here with no manifest entry at all -- ai-disclaimer, payment-terms, data-processing, disclaimer, can-spam, security-policy, each ~14KB, robots unset, reachable by anyone. Publishing legal text is an owner-approval category in AGENTS.md, so this surface accounts for them without changing a byte of what is served."
  },
  {
    key: "staff_area",
    label: "Staff area",
    pattern: /^\/staff(?:\/|$)/,
    expectedAccess: "signed_in",
    reason:
      "Six pages an employee opens rather than a business owner, so they sit outside the owner navigation the page registry describes. /staff/location is the one worth naming: it is a location page, and until it was probed on 16 September 2026 nothing in this repository had ever checked that it turns a stranger away. It does."
  },
  {
    key: "admin_console",
    label: "Admin console",
    pattern: /^\/admin(?:\/|$)/,
    expectedAccess: "signed_in",
    publicExceptions: ["/admin/login"],
    reason:
      "Internal operator screens. PUBLIC_SITEMAP_ROUTES explicitly refuses any /admin route, so the page registry is the wrong home for them; they still have to be accounted for somewhere, which is here. /admin/login is the exception a sign-in page always is -- a login screen that required a login could not be used."
  },
  {
    key: "account_and_session",
    label: "Account settings and session steps",
    pattern: /^\/account\/|^\/settings(?:\/|$)|^\/login\/|^\/auth\//,
    expectedAccess: "signed_in",
    reason:
      "Steps inside a session rather than destinations: the second factor, the notification preferences, the data export, the verification step after a password. /auth/login and /auth/signup are older paths for the declared /login and /signup."
  },
  {
    key: "consent_withdrawal",
    label: "Withdrawing consent",
    pattern: /^\/growth\/unsubscribe$/,
    expectedAccess: "public",
    reason:
      "This one MUST answer a signed-out visitor, and that is why it has its own surface rather than sharing the Growth Studio prefix. Somebody unsubscribing from a campaign does not have an account, and an unsubscribe link that asked them to sign in first would be a consent control that does not work. The expectedAccess value above is the assertion, not a description."
  },
  {
    key: "public_compatibility_alias",
    label: "Older paths kept working",
    pattern: /^\/onboarding$|^\/feedback$|^\/trust$|^\/research-lab$|^\/manifest\.webmanifest$/,
    expectedAccess: "public_alias",
    reason:
      "Four of these come from the publicCompatibilityRoutes map in server.js and one is the web-app manifest: /onboarding -> /account/setup, /feedback -> /contact?topic=feedback, /trust -> /security, /research-lab -> /ecosystem, /manifest.webmanifest -> /site.webmanifest. They exist so a link somebody already published keeps working, which is exactly why they must not be quietly dropped: an alias is a promise to whoever pasted the old URL. Measured 16 September 2026 -- each answers a redirect, and following it reaches 200 with no session.",
    aliasTargets: Object.freeze({
      "/onboarding": "/account/setup",
      "/feedback": "/contact?topic=feedback",
      "/trust": "/security",
      "/research-lab": "/ecosystem",
      "/manifest.webmanifest": "/site.webmanifest"
    })
  },
  {
    key: "research_lab_catalog",
    label: "Research Lab public catalogs",
    pattern:
      /^\/research-lab\/(requested-repositories|latest-screenshot-intake|huggingface|open-source)$|^\/infrastructure$|^\/ecosystem$|^\/formulas$|^\/docs$/,
    expectedAccess: "public",
    reason:
      "The readable side of the governed research records: what has been reviewed, what its licence says, and what is deliberately not enabled. Public on purpose -- the whole point of these pages is that the decisions are checkable. Nothing here executes any catalogued tool."
  },
  {
    key: "research_lab_internal",
    label: "Research Lab subsystem detail",
    pattern: /^\/research-lab\/subsystems(?:\/|$)/,
    expectedAccess: "signed_in",
    reason:
      "Eleven subsystem pages that read internal inventories -- which tables exist, which modules are unreferenced, which repositories were reviewed and refused. Measured 16 September 2026: each redirects a signed-out visitor to /admin/login. The four published catalogs alongside them are separately accounted for by research_lab_catalog, and the /research-lab index itself is an alias to /ecosystem rather than a page, which is why it is not here."
  },
  {
    key: "owner_control_plane",
    label: "Owner control plane",
    pattern: /^\/owner(?:\/|$)/,
    expectedAccess: "signed_in",
    reason:
      "Where the owner approves what an agent proposed. lib/sonara-agent-queue.cjs writes a refused run to agent_pending_actions and this is the read-and-approve side, so it is the last surface that should ever be reachable without a session."
  },
  {
    key: "progressive_web_app",
    label: "Installable app files",
    pattern: /^\/offline$/,
    expectedAccess: "public",
    reason:
      "Files the browser fetches rather than pages a person opens. The offline page in particular is only ever rendered by the service worker when the network is gone, so it must not depend on a session."
  },
  {
    key: "public_share_link",
    label: "Something a customer published",
    pattern: /^\/s\/|^\/book\/|^\/chat\/|^\/call\/|^\/creator\/|^\/shared\//,
    expectedAccess: "parameterised",
    reason:
      "One customer's published answer, booking page, or invoice, reached by a token or a handle they chose to hand out. Deliberately absent from the sitemap: publishing these links is the customer's decision, not ours. /shared exists as a declared page and is the explainer somebody lands on when they trim one of these."
  }
]);

// Which surface accounts for a route, or null. The first match wins, and
// verify-route-surface.mjs separately fails when two surfaces claim one route,
// because "the first one happened to match" is not an accounting.
function surfaceFor(route) {
  const value = String(route || "");
  return ROUTE_SURFACES.find((surface) => surface.pattern.test(value)) || null;
}

function surfacesMatching(route) {
  const value = String(route || "");
  return ROUTE_SURFACES.filter((surface) => surface.pattern.test(value));
}

// Read the GET routes Express actually answers, from the app rather than from a
// list somebody maintained. This is the whole point: a route that exists is
// visible here even when nothing declares it.
function servedGetRoutes(app) {
  const routes = new Set();
  const stack = (app && app._router && app._router.stack) || [];
  for (const layer of stack) {
    if (!layer.route) continue;
    const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
    for (const method of Object.keys(layer.route.methods)) {
      if (method !== "get") continue;
      for (const route of paths) routes.add(route);
    }
  }
  return [...routes].sort();
}

// The accounting itself, as data, so the gate and the test agree by construction
// rather than by both being written carefully.
function accountRoutes(app, registryPaths) {
  const declared = new Set(registryPaths || []);
  const served = servedGetRoutes(app);
  const undeclared = served.filter((route) => !declared.has(route));

  const unaccounted = [];
  const ambiguous = [];
  const bySurface = new Map(ROUTE_SURFACES.map((surface) => [surface.key, []]));

  for (const route of undeclared) {
    const matches = surfacesMatching(route);
    if (!matches.length) {
      unaccounted.push(route);
      continue;
    }
    if (matches.length > 1) {
      ambiguous.push(`${route} -> ${matches.map((surface) => surface.key).join(", ")}`);
    }
    bySurface.get(matches[0].key).push(route);
  }

  const emptySurfaces = ROUTE_SURFACES
    .filter((surface) => bySurface.get(surface.key).length === 0)
    .map((surface) => surface.key);

  return { served, declared: [...declared], undeclared, unaccounted, ambiguous, emptySurfaces, bySurface };
}

module.exports = { ACCESS, ROUTE_SURFACES, surfaceFor, surfacesMatching, servedGetRoutes, accountRoutes };
