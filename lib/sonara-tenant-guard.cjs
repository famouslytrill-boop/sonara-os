// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Refuse a Supabase request that crosses tenants without saying so.
//
// Why this is not solved by RLS (CRIT-3 in the 2026-07-27 audit): every data
// path in this application uses the service-role key, which bypasses Row Level
// Security entirely. The ~1,600 RLS policies in the schema protect direct
// anon/authenticated Data API access and do nothing for application traffic.
// The real multi-tenant boundary is a developer remembering to append
// `&organization_id=eq.<id>` to each query.
//
// lib/sonara-tenant-data.cjs offered a safe way to build those queries, but
// nothing forced anybody to use it, and 75 call sites did not. Rewriting all 75
// would have been a large diff through codegen-managed files, and it still
// would not have stopped the 76th.
//
// So the check lives at the only place every one of them passes through: the
// fetch to the Supabase REST API. install() wraps global fetch, inspects
// anything addressed to /rest/v1/, and throws when a tenant-scoped table is
// queried or written without a tenant.
//
// This is a boundary, not a warning. It throws in every environment. A guard
// that logs and continues in production is exactly the pattern this codebase
// has been bitten by -- a signal that reports success without being true.
//
// EXEMPT_PATTERNS is the honest part of the design. Some unscoped access is
// legitimate: a lookup by a secret token, a founder operation deliberately
// spanning tenants, an existence probe that reads no rows. Each one is listed
// with the reason it is safe. Adding to that list is a visible decision in a
// diff, which is the whole point -- omission was invisible, exemption is not.

const { TENANT_SCOPED_TABLES, GLOBAL_TABLES } = require("./sonara-tenant-scoped-tables.cjs");

const TENANT_COLUMN = "organization_id";

class TenantGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "TenantGuardError";
  }
}

// The shape shared by every public-page lookup in EXEMPT_PATTERNS, pinned rather
// than pattern-matched.
//
// A stranger reaching a page by its address has no organization to be filtered
// to, so the address IS the scope: one row, found by a slug or handle that a
// unique index makes unambiguous, with a filter that keeps unpublished rows out.
// That is safe only while the request is exactly that shape, so each exemption
// states the shape in full:
//
//   keys     exactly these query parameters, none extra and none repeated. A
//            second `slug=` or an added `or=` is a different query.
//   fixed    these parameters with exactly these values -- the filter keeping
//            drafts out, and `limit=1`.
//   address  the parameter naming the row, and the form its value must take:
//            `eq.` on one slug or id. Never `in.`, `like.` or `neq.`, which
//            would turn a lookup into an enumeration.
//   columns  the only columns the select may name. A stranger-facing lookup that
//            later grows `email` or `metadata` is refused here rather than
//            reaching a public page, and widening it is a visible line in this
//            file.
//
// None of the first eleven lookups that use this was in this list until 2 October
// 2026; the two growth_channels entries arrived with channels.
// scripts/report-tenant-scoped-queries.mjs recorded most of them as deliberate;
// this list, which is the one that runs, did not. So the guard refused every one,
// the route's fetch wrapper turned the refusal into a failed read, and
// /events/:slug, /store/:slug, /creator/:handle and /shared/:token answered a
// visitor with a 503 -- while every test of those pages passed in the suite,
// because none of them met this guard: some stubbed fetch outright, and the
// ones using tests/helpers/fake-supabase.cjs had it behind the fake whenever an
// earlier file had loaded server.js first. The fake now applies this guard
// itself, and tests/no-route-asks-for-what-the-guard-refuses.test.js drives
// every route in server.js through it.
const SLUG_VALUE = /^eq\.[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_VALUE = new RegExp(`^eq\\.${UUID}$`, "i");
// lib/sonara-shared-results.cjs SHARE_TOKEN_PATTERN: 24 random bytes, base64url.
const SHARE_TOKEN_VALUE = /^eq\.[A-Za-z0-9_-]{32}$/;
// A Stripe PaymentIntent id, as a refund or dispute event names it.
const PAYMENT_INTENT_VALUE = /^eq\.pi_[A-Za-z0-9]{8,}$/;
// The follower list asks for at most the 200 profiles it read follows for.
const UUID_LIST_VALUE = new RegExp(`^in\\.\\("${UUID}"(,"${UUID}"){0,199}\\)$`, "i");

function pinnedLookup({ keys, fixed = {}, address, columns }) {
  const expectedKeys = [...keys].sort().join(",");
  const allowedColumns = new Set(columns);
  return ({ method, query }) => {
    if (method !== "GET") return false;
    const params = new URLSearchParams(query);
    if ([...params.keys()].sort().join(",") !== expectedKeys) return false;
    for (const [key, value] of Object.entries(fixed)) {
      if (params.get(key) !== value) return false;
    }
    if (address && !address.pattern.test(params.get(address.key) || "")) return false;
    return String(params.get("select") || "").split(",").every((column) => allowedColumns.has(column));
  };
}

// A webhook lookup by id or payment intent, which must also carry the connected
// account the event came from. Without that filter a by-id read of an order would
// match the exemption from any route -- found by a falsification on 6 October 2026,
// when a receipt query with its token filter removed passed this guard.
const CONNECTED_ACCOUNT_VALUE = /^eq\.acct_[A-Za-z0-9]{8,}$/;
function connectedAccountLookup(spec) {
  const lookup = pinnedLookup({ ...spec, keys: [...spec.keys, "stripe_account_id"] });
  return (request) => lookup(request)
    && CONNECTED_ACCOUNT_VALUE.test(new URLSearchParams(request.query).get("stripe_account_id") || "");
}

// The columns a public creator page may read: lib/sonara-creator-profiles.cjs
// PUBLIC_PROFILE_COLUMNS, restated rather than required so that this boundary can
// be read in one file. A profile column added there and not here is refused, and
// the route test through this guard says so.
const PUBLIC_CREATOR_COLUMNS = Object.freeze(["id", "artist_name", "public_description", "public_handle", "published_at"]);

// Reads that legitimately cross tenants, each with why it is safe.
//
// `table` must match exactly. `when` receives { method, query, body } and
// returns true if this specific request is the exempt one -- so an exemption
// for "lookup by token hash" does not also excuse a full table scan.
const EXEMPT_PATTERNS = Object.freeze([
  {
    table: "agent_schedules",
    reason:
      "The scheduler runs every organization's due work, so the one read that finds due schedules is deliberately " +
      "unscoped -- there is no signed-in customer behind a cron and no single organization to scope it to. " +
      "Narrowed to the exact shape the tick issues: a GET filtered to enabled schedules. Every run it starts is " +
      "then scoped to the organization_id carried on the schedule row itself, and each of those queries is checked " +
      "here like any other.",
    when: ({ method, query }) => method === "GET" && /(^|&)enabled=eq\.true(&|$)/.test(query)
  },
  {
    table: "business_employee_invites",
    reason:
      "An invite is redeemed by presenting its token before the recipient belongs to anything. " +
      "The token hash is the credential; scoping by organization would require knowing the answer first.",
    when: ({ query }) => /token_hash=eq\./.test(query)
  },
  {
    table: "business_employee_invites",
    reason: "Marking a redeemed invite accepted, addressed by the primary key returned from the token lookup above.",
    when: ({ method, query }) => method === "PATCH" && /(^|&)id=eq\./.test(query)
  },
  {
    table: "billing_entitlements",
    reason:
      "Stripe webhooks arrive with no session. The organization comes out of the subscription metadata and " +
      "is written into the row; the upsert conflict target is (organization_id, entitlement_key), so the " +
      "tenant is carried in the body rather than the query.",
    when: ({ method, body }) => method === "POST" && bodyCarriesTenant(body)
  },
  {
    table: "billing_subscriptions",
    reason: "Same webhook path as billing_entitlements: the tenant is in the row being written, not the query.",
    when: ({ method, body }) => method === "POST" && bodyCarriesTenant(body)
  },
  {
    table: "purchases",
    reason: "Checkout completion, addressed by the Stripe session id, with the organization written into the row.",
    when: ({ method, body }) => method === "POST" && bodyCarriesTenant(body)
  },
  {
    table: "stripe_customers",
    reason: "Upsert keyed on stripe_customer_id; the organization is written into the row.",
    when: ({ method, body }) => method === "POST" && bodyCarriesTenant(body)
  },
  {
    table: "organizations",
    reason:
      "An organization row is itself the tenant. Looking one up by slug, or creating the first one, cannot " +
      "be scoped to an organization that does not exist yet.",
    when: () => true
  },
  {
    table: "public_booking_pages",
    reason:
      "A public booking link has no authenticated organization to provide as a filter. The published slug " +
      "resolves exactly one enabled page and supplies the organization_id used by every later booking read and write.",
    when: ({ method, query }) => {
      if (method !== "GET") return false;
      const params = new URLSearchParams(query);
      const select = "id,organization_id,slug,headline,intro,time_zone,opening_hours,slot_minutes,lead_time_hours,horizon_days,assign_staff";
      const keys = [...params.keys()].sort();
      return (
        keys.join(",") === "enabled,limit,select,slug" &&
        /^eq\.[a-z0-9-]{1,80}$/.test(params.get("slug") || "") &&
        params.get("enabled") === "is.true" &&
        params.get("select") === select &&
        params.get("limit") === "1"
      );
    }
  },
  {
    table: "growth_events",
    reason:
      "GET and POST /events/:slug -- a published event's public page, and the RSVP form on it. A visitor has no " +
      "organization. growth_events_slug_key makes the slug name one event, status=neq.draft keeps an unpublished one " +
      "unreachable by guessing (a cancelled one stays readable so a booked person is told), and the organization_id " +
      "it returns scopes every later read and the RSVP write.",
    when: pinnedLookup({
      keys: ["select", "slug", "status", "limit"],
      fixed: { status: "neq.draft", limit: "1" },
      address: { key: "slug", pattern: SLUG_VALUE },
      columns: ["id", "organization_id", "venue_id", "title", "summary", "kind", "status", "starts_at", "ends_at", "capacity", "slug", "cancellation_reason"]
    })
  },
  {
    table: "growth_events",
    reason:
      "The address check inside POST /api/growth/events/publish, behind growth_studio workspace access. It looks " +
      "across organizations to say 'taken by somebody else' instead of handing the owner a constraint violation. " +
      "Only `id` is selected, and it is compared against the caller's own event; nothing else crosses.",
    when: pinnedLookup({
      keys: ["select", "slug", "limit"],
      fixed: { limit: "1" },
      address: { key: "slug", pattern: SLUG_VALUE },
      columns: ["id"]
    })
  },
  {
    table: "merchant_storefronts",
    reason:
      "GET and POST /store/:slug -- a published shop and its order form. merchant_storefronts_slug_key makes the slug " +
      "name one shop and enabled=eq.true keeps an unpublished one unreachable. The organization_id it returns scopes " +
      "the catalogue read and the order write.",
    when: pinnedLookup({
      keys: ["select", "slug", "enabled", "limit"],
      fixed: { enabled: "eq.true", limit: "1" },
      address: { key: "slug", pattern: SLUG_VALUE },
      columns: ["id", "organization_id", "slug", "enabled", "headline", "intro", "currency", "accepts_orders"]
    })
  },
  {
    table: "merchant_storefronts",
    reason:
      "The address check inside POST /api/business/storefront/publish, behind a business manager. Only " +
      "organization_id is selected and it is compared against the caller's own, so the answer is taken or not.",
    when: pinnedLookup({
      keys: ["select", "slug", "limit"],
      fixed: { limit: "1" },
      address: { key: "slug", pattern: SLUG_VALUE },
      columns: ["organization_id"]
    })
  },
  {
    table: "creator_artist_profiles",
    reason:
      "GET /creator/:handle, a public creator page. creator_artist_profiles_public_handle_key makes the handle name " +
      "one profile, a handle is only ever set by publishing, and status=eq.active keeps a suspended one off. Only " +
      "the public columns are selectable.",
    when: pinnedLookup({
      keys: ["select", "public_handle", "status", "limit"],
      fixed: { status: "eq.active", limit: "1" },
      address: { key: "public_handle", pattern: SLUG_VALUE },
      columns: PUBLIC_CREATOR_COLUMNS
    })
  },
  {
    table: "creator_artist_profiles",
    reason:
      "Follow and unfollow: is this id a published, active profile? Only id and public_handle are selectable, so a " +
      "guessed uuid for a private profile returns a null handle and nothing of its draft content.",
    when: pinnedLookup({
      keys: ["select", "id", "status", "limit"],
      fixed: { status: "eq.active", limit: "1" },
      address: { key: "id", pattern: UUID_VALUE },
      columns: ["id", "public_handle"]
    })
  },
  {
    table: "creator_artist_profiles",
    reason:
      "GET /account/following. The ids come from the signed-in person's own creator_follows rows, and " +
      "public_handle=not.is.null with status=eq.active means only profiles anybody could open come back -- an " +
      "unpublished one leaves the list rather than showing its draft name to a follower.",
    when: pinnedLookup({
      keys: ["select", "id", "public_handle", "status"],
      fixed: { public_handle: "not.is.null", status: "eq.active" },
      address: { key: "id", pattern: UUID_LIST_VALUE },
      columns: PUBLIC_CREATOR_COLUMNS
    })
  },
  {
    table: "lead_capture_pages",
    reason:
      "GET and POST /chat/:slug, an enabled lead-capture page. lead_capture_pages_slug_key makes the slug name one " +
      "page and enabled=is.true keeps a switched-off one unreachable. The organization_id it returns scopes every " +
      "later read and the lead write.",
    when: pinnedLookup({
      keys: ["slug", "enabled", "select", "limit"],
      fixed: { enabled: "is.true", limit: "1" },
      address: { key: "slug", pattern: SLUG_VALUE },
      columns: ["id", "organization_id", "slug", "headline", "greeting", "closing"]
    })
  },
  {
    table: "lead_capture_pages",
    reason:
      "The address check inside POST /api/lead-capture-page, behind a signed-in customer. Only organization_id is " +
      "selected and it is compared against the caller's own.",
    when: pinnedLookup({
      keys: ["slug", "select", "limit"],
      fixed: { limit: "1" },
      address: { key: "slug", pattern: SLUG_VALUE },
      columns: ["organization_id"]
    })
  },
  {
    table: "scroll_sites",
    reason:
      "GET /s/:slug, a published scroll. The slug is unique across the table and published_at=not.is.null keeps an " +
      "unpublished draft unreachable. Only title, document and slug are selectable -- not organization_id, because " +
      "the page reads nothing further.",
    when: pinnedLookup({
      keys: ["select", "slug", "published_at", "limit"],
      fixed: { published_at: "not.is.null", limit: "1" },
      address: { key: "slug", pattern: SLUG_VALUE },
      columns: ["title", "document", "slug"]
    })
  },
  {
    table: "shared_links",
    reason:
      "GET /shared/:token and /shared/:token/invoice.pdf, opened by somebody with no account. The token IS the " +
      "capability -- 24 random bytes, base64url -- and revoked_at=is.null is how revoking one takes it away. Only " +
      "resource_type, resource_id and organization_id are selectable, and every read after this one is scoped by " +
      "that organization.",
    when: pinnedLookup({
      keys: ["select", "token", "revoked_at", "limit"],
      fixed: { revoked_at: "is.null", limit: "1" },
      address: { key: "token", pattern: SHARE_TOKEN_VALUE },
      columns: ["resource_type", "resource_id", "organization_id"]
    })
  },
  {
    table: "growth_channels",
    reason:
      "GET /channels/:handle and the report form on it -- a public channel. growth_channels_handle_key makes the " +
      "handle name one channel and state=eq.public keeps a draft or hidden one unreachable by guessing. The " +
      "organization_id it returns scopes the post read and the report write.",
    when: pinnedLookup({
      keys: ["select", "handle", "state", "limit"],
      fixed: { state: "eq.public", limit: "1" },
      address: { key: "handle", pattern: SLUG_VALUE },
      columns: ["id", "organization_id", "handle", "title", "about", "state"]
    })
  },
  {
    table: "growth_channels",
    reason:
      "The address check inside POST /api/growth/channels, behind growth_studio workspace access. Only " +
      "organization_id is selected; any row at all means the address is taken.",
    when: pinnedLookup({
      keys: ["select", "handle", "limit"],
      fixed: { limit: "1" },
      address: { key: "handle", pattern: SLUG_VALUE },
      columns: ["organization_id"]
    })
  },
  {
    table: "creator_listings",
    reason:
      "POST /marketplace/:id/buy, by a signed-in buyer who belongs to none of the seller's organizations. The " +
      "listing id and state=eq.listed find one listing on sale; the organization_id it returns is the seller, and " +
      "every read after it -- the version, its approvals, the pinned file, the payment account -- is scoped by that.",
    when: pinnedLookup({
      keys: ["select", "id", "state", "limit"],
      fixed: { state: "eq.listed", limit: "1" },
      address: { key: "id", pattern: UUID_VALUE },
      columns: ["id", "organization_id", "title", "price_cents", "currency", "licence", "state", "rights_attested", "consent_attested", "version_id"]
    })
  },
  {
    table: "creator_marketplace_orders",
    reason:
      "POST /api/webhooks/stripe-connect, after the event's signature is verified. A checkout event names its order " +
      "by id, and the order is the only place the seller is recorded, so it is found first; every check after it " +
      "compares the event against this row, and every write is scoped by the organization_id it carries.",
    when: connectedAccountLookup({
      keys: ["select", "id", "limit"],
      fixed: { limit: "1" },
      address: { key: "id", pattern: UUID_VALUE },
      columns: ["id", "organization_id", "listing_id", "version_id", "buyer_user_id", "licence", "price_cents", "currency", "stripe_account_id", "checkout_session_id", "payment_intent_id", "state"]
    })
  },
  {
    table: "creator_marketplace_orders",
    reason:
      "The same webhook for a refund or a dispute, which names the payment intent rather than the order. One order " +
      "per payment intent; the account on the event is compared with the order's before anything changes.",
    when: connectedAccountLookup({
      keys: ["select", "payment_intent_id", "limit"],
      fixed: { limit: "1" },
      address: { key: "payment_intent_id", pattern: PAYMENT_INTENT_VALUE },
      columns: ["id", "organization_id", "listing_id", "version_id", "buyer_user_id", "licence", "price_cents", "currency", "stripe_account_id", "checkout_session_id", "payment_intent_id", "state"]
    })
  },
  {
    table: "merchant_orders",
    reason:
      "GET /store/:slug/orders/:orderId, a storefront buyer's receipt. The buyer has no account; the receipt token is " +
      "the capability -- 24 random bytes, only its SHA-256 stored -- and the order is found by its id AND that hash, so " +
      "a wrong token and a wrong id are the same miss. Only id and organization_id are selectable; every read after " +
      "it (the order's details, its lines, the shop's name) is scoped by that organization.",
    when: (request) => {
      if (!pinnedLookup({
        keys: ["select", "id", "buyer_token_hash", "limit"],
        fixed: { limit: "1" },
        address: { key: "id", pattern: UUID_VALUE },
        columns: ["id", "organization_id"]
      })(request)) return false;
      return /^eq\.[a-f0-9]{64}$/.test(new URLSearchParams(request.query).get("buyer_token_hash") || "");
    }
  },
  {
    table: "merchant_orders",
    reason:
      "POST /api/webhooks/stripe-connect for a storefront checkout, after the signature is verified. The event names " +
      "its order by id and the order is the only place the shop is recorded; every field of the event is compared " +
      "with this row before anything changes, and every write is scoped by the organization_id it carries.",
    when: connectedAccountLookup({
      keys: ["select", "id", "limit"],
      fixed: { limit: "1" },
      address: { key: "id", pattern: UUID_VALUE },
      columns: ["id", "organization_id", "status", "payment_state", "subtotal_cents", "currency", "stripe_account_id", "checkout_session_id", "payment_intent_id", "amount_paid_cents", "refunded_cents"]
    })
  },
  {
    table: "merchant_orders",
    reason:
      "The same webhook for a storefront refund or dispute, which names the payment intent rather than the order. One " +
      "order per payment intent (a unique index); the event's account is compared with the order's before anything changes.",
    when: connectedAccountLookup({
      keys: ["select", "payment_intent_id", "limit"],
      fixed: { limit: "1" },
      address: { key: "payment_intent_id", pattern: PAYMENT_INTENT_VALUE },
      columns: ["id", "organization_id", "status", "payment_state", "subtotal_cents", "currency", "stripe_account_id", "checkout_session_id", "payment_intent_id", "amount_paid_cents", "refunded_cents"]
    })
  },
  {
    table: "growth_campaign_sends",
    reason:
      "POST /api/webhooks/resend, after the provider's signature is verified. A delivery receipt names only the " +
      "provider's message id, and the accepted send carrying that id is the only place the organization and campaign " +
      "are recorded, so it is found first; the receipt row is written with the organization this row carries. One " +
      "accepted send per message id, and only accepted rows have one.",
    when: pinnedLookup({
      keys: ["select", "provider_message_id", "status", "limit"],
      fixed: { status: "eq.accepted", limit: "1" },
      address: { key: "provider_message_id", pattern: UUID_VALUE },
      columns: ["organization_id", "campaign_id", "email"]
    })
  },
  {
    table: "organization_memberships",
    reason:
      "Resolving which organizations a user belongs to. This is the query that produces the organization id " +
      "every other query is then scoped by, so it necessarily runs before one is known. It is always " +
      "filtered by user_id, which is the caller's own verified identity.",
    when: ({ query, method, body }) => /user_id=eq\./.test(query) || (method === "POST" && bodyCarriesTenant(body))
  },
  {
    table: "business_memberships",
    reason: "Same as organization_memberships: resolves the caller's own workspaces from their verified user id.",
    when: ({ query, method, body }) => /user_id=eq\./.test(query) || (method === "POST" && bodyCarriesTenant(body))
  },
  {
    table: "support_requests",
    reason:
      "Founder support console. Admin-gated at the route, and its purpose is to see every tenant's requests -- " +
      "a support queue scoped to one tenant would not be a support queue.",
    when: () => true
  },
  {
    table: "service_catalog_items",
    reason: "The published catalog is the same for everyone; it is marketing copy, not customer data.",
    when: () => true
  }
]);

function bodyCarriesTenant(body) {
  if (!body) return false;
  const text = typeof body === "string" ? body : String(body);
  // Every row in the payload must carry it. An array where only the first row
  // does would otherwise pass, writing the rest to whatever the database
  // defaults to.
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  if (!rows.length) return false;
  return rows.every((row) => row && typeof row === "object" && row[TENANT_COLUMN] !== undefined && row[TENANT_COLUMN] !== null);
}

function queryCarriesTenant(query) {
  // eq. is the normal case; in. covers a caller scoping to several
  // organizations they have been shown to belong to.
  return new RegExp(`(^|&)${TENANT_COLUMN}=(eq|in)\\.`).test(query);
}

// Two shapes are scoped without naming an organization. Both are rules rather
// than per-table exemptions, because they are properties of the query itself
// and adding a table should not require remembering to list it again.

// `?select=id&limit=1` -- an existence probe. Twelve of these run on the
// readiness screens to answer "is this table reachable". It returns at most one
// id and no customer data. It does reveal whether *somebody* has a row, which
// is why the shape is pinned tightly: any other column, or any larger limit,
// stops being a probe and needs a real scope.
function isExistenceProbe(method, query) {
  if (method !== "GET" && method !== "HEAD") return false;
  const parameters = new URLSearchParams(query);
  const keys = [...parameters.keys()].sort();
  if (keys.join(",") !== "limit,select") return false;
  return parameters.get("select") === "id" && parameters.get("limit") === "1";
}

// A small measured set of tenant tables belongs to one person inside an
// organization. For those tables, filtering by user_id is narrower than
// organization_id and is therefore an acceptable boundary.
//
// This MUST stay table-specific. The previous generic rule treated a user_id
// filter as sufficient on every tenant table, so a future
// customer_records?user_id=eq.<attacker-controlled-value> query could bypass the
// organization boundary. The list mirrors PERSONAL_READ_TABLES in
// scripts/generate-member-read-policies.cjs and additions need the same privacy
// review as an RLS policy.
const PERSONAL_SCOPED_TABLES = Object.freeze(new Set([
  "business_employee_profiles",
  "sonara_platforms",
  "user_notifications",
  "user_preferences"
]));

// A buyer's own purchases, which span every seller they bought from. An order's
// organization_id is the SELLER's, so "my orders" cannot be filtered by
// organization -- the buyer belongs to none of them. The person who bought is the
// scope, through the column that names them. Table-specific for the same reason as
// PERSONAL_SCOPED_TABLES, and `eq.` only: one buyer, never a list of them.
const BUYER_SCOPED_TABLES = Object.freeze(new Map([
  ["creator_marketplace_orders", "buyer_user_id"],
  ["creator_licence_grants", "buyer_user_id"]
]));

/** The column that scopes a read to one person on this table, or null. */
function personalColumnFor(table) {
  if (PERSONAL_SCOPED_TABLES.has(table)) return "user_id";
  return BUYER_SCOPED_TABLES.get(table) || null;
}

function isCallerScoped(table, query) {
  if (PERSONAL_SCOPED_TABLES.has(table)) return /(^|&)user_id=(eq|in)\./.test(query);
  const buyer = BUYER_SCOPED_TABLES.get(table);
  return Boolean(buyer) && new RegExp(`(^|&)${buyer}=eq\\.${UUID}(&|$)`, "i").test(query);
}

/**
 * Decide whether a Supabase REST request is allowed to proceed.
 * Returns { allowed: true } or { allowed: false, message }.
 */
function inspect(method, url, body) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return { allowed: true };
  }

  const match = parsed.pathname.match(/\/rest\/v1\/([a-z0-9_]+)/i);
  if (!match) return { allowed: true };

  const table = match[1].toLowerCase();

  // This actor-owned relationship crosses organization boundaries by design.
  // The migration proposal is NOT yet in the generated registry. We still
  // restrict its exact query shapes here before checking GLOBAL_TABLES; when
  // the reviewed migration is eventually generated, this protection stays.
  if (table === "growth_channel_blocks") {
    const p = parsed.searchParams;
    const actual = [...p.keys()].sort().join(",");
    const methodName = String(method || "GET").toUpperCase();
    const uuidFilter = (name) => UUID_VALUE.test(p.get(name) || "");
    const deny = { allowed: false, message: "Channel block access requires a verified actor and exact query shape." };
    if (methodName === "GET" && actual === "limit,select,viewer_user_id"
      && p.get("select") === "channel_id"
      && p.get("limit") === "501"
      && uuidFilter("viewer_user_id")) return { allowed: true };
    if (methodName === "DELETE" && actual === "channel_id,viewer_user_id"
      && uuidFilter("channel_id") && uuidFilter("viewer_user_id")) return { allowed: true };
    if (methodName === "POST" && actual === "on_conflict"
      && p.get("on_conflict") === "viewer_user_id,channel_id") {
      let row = null;
      try { row = typeof body === "string" ? JSON.parse(body) : body; } catch { return deny; }
      if (row && !Array.isArray(row) && typeof row === "object"
        && Object.keys(row).sort().join(",") === "channel_id,viewer_user_id"
        && typeof row.channel_id === "string" && UUID_VALUE.test("eq." + row.channel_id)
        && typeof row.viewer_user_id === "string" && UUID_VALUE.test("eq." + row.viewer_user_id)) {
        return { allowed: true };
      }
    }
    return deny;
  }

  // Stored procedures enforce their own scoping in SQL, where the check can
  // see the caller. Second-guessing them from the URL would mean reading
  // arguments this layer cannot interpret.
  if (parsed.pathname.includes("/rest/v1/rpc/")) return { allowed: true };

  if (!TENANT_SCOPED_TABLES.has(table)) {
    if (GLOBAL_TABLES.has(table)) return { allowed: true };
    // Unknown is not global. The migration-derived registry is part of the
    // authorization boundary, so a table absent from both classifications is
    // configuration drift and must fail closed. This converts a stale registry
    // from a possible cross-tenant leak into an explicit availability failure
    // that CI/readiness can detect before production traffic depends on it.
    return {
      allowed: false,
      message:
        `${String(method || "GET").toUpperCase()} on "${table}" cannot be authorized because the table is not classified as ` +
        `tenant-scoped or global. Regenerate lib/sonara-tenant-scoped-tables.cjs from migrations before using it.\n` +
        `  Path: ${parsed.pathname}${parsed.search}`
    };
  }

  const query = parsed.search.replace(/^\?/, "");
  const upperMethod = String(method || "GET").toUpperCase();

  if (upperMethod === "POST") {
    if (bodyCarriesTenant(body)) return { allowed: true };
  } else if (queryCarriesTenant(query) || isCallerScoped(table, query) || isExistenceProbe(upperMethod, query)) {
    return { allowed: true };
  }

  for (const exemption of EXEMPT_PATTERNS) {
    if (exemption.table !== table) continue;
    if (exemption.when({ method: upperMethod, query, body })) return { allowed: true };
  }

  return {
    allowed: false,
    message:
      `${upperMethod} on "${table}" has no tenant scope. ${table} carries ${TENANT_COLUMN}, so this request ` +
      `would read or write across every organization.\n` +
      `  Fix: add ${TENANT_COLUMN}=eq.<id> to the query (or ${TENANT_COLUMN} to each row of a POST body).\n` +
      `  If crossing tenants is genuinely intended, add an entry to EXEMPT_PATTERNS in ` +
      `lib/sonara-tenant-guard.cjs with the reason it is safe.\n` +
      `  Path: ${parsed.pathname}${parsed.search}`
  };
}

// Installed-ness belongs to the target, not to this module. It was a single
// boolean, so the first install anywhere made every later one a silent no-op --
// including onto a test's own scope object, where the test then exercised an
// unwrapped fetch and concluded the guard worked. Tracking the target is more
// correct and it is what stops a test passing without testing anything.
const installedTargets = new WeakSet();

/**
 * Wrap global fetch so every Supabase REST request is inspected.
 *
 * Wrapping rather than replacing matters: tests/setup-env.cjs installs its own
 * offline firewall over fetch, and the two have to compose. Whatever is present
 * when this runs keeps handling the request once the check passes.
 */
function install(options = {}) {
  const target = options.global || globalThis;
  if (installedTargets.has(target)) return false;
  if (typeof target.fetch !== "function") return false;

  const inner = target.fetch;
  const guarded = async function sonaraTenantGuardedFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || String(input);
    if (/\/rest\/v1\//.test(url)) {
      const verdict = inspect(init?.method || "GET", url, init?.body);
      if (!verdict.allowed) throw new TenantGuardError(verdict.message);
    }
    return inner.call(this, input, init);
  };

  Object.defineProperty(guarded, "__sonaraTenantGuard", { value: true, enumerable: false });
  // tests/setup-env.cjs identifies its firewall by a tagged property. Carry the
  // tag across so wrapping it does not make the runtime think the firewall is
  // gone and start letting real requests out.
  if (inner.__sonaraOfflineFirewall) {
    Object.defineProperty(guarded, "__sonaraOfflineFirewall", { value: true, enumerable: false });
  }

  target.fetch = guarded;
  installedTargets.add(target);
  return true;
}

module.exports = {
  install,
  inspect,
  bodyCarriesTenant,
  queryCarriesTenant,
  isExistenceProbe,
  isCallerScoped,
  personalColumnFor,
  PERSONAL_SCOPED_TABLES,
  BUYER_SCOPED_TABLES,
  TenantGuardError,
  EXEMPT_PATTERNS,
  TENANT_COLUMN
};
