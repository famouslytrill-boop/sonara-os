"use strict";

// A creator profile with a public address, and the people who follow it.
//
// `creator_artist_profiles` has carried `public_description` since the artist
// system landed, and nothing had ever put one on a page a stranger could reach.
// This is the part of that which is decidable without a database: what a handle
// may be, which handles nobody may take, and what a public profile is allowed to
// say. routes/sonara-creator-profile-routes.cjs does the reading and writing.
//
// ## What a public profile shows, and what it does not
//
// `creator_artist_profiles` holds six jsonb columns that are the artist's
// working material: private_backstory, voice_identity, genre_blend,
// writing_rules, visual_rules, prompt_rules. **None of them is published, and
// the naming is not the reason.** private_backstory is obviously private;
// voice_identity and prompt_rules are the ones that matter, because publishing
// them hands somebody the instructions for reproducing an artist's voice --
// which is the anti-clone rule in AGENTS.md, not a preference.
//
// So the published set is three fields: the name, the description written to be
// public, and how many people follow. Anything added to this table later is
// private until somebody decides otherwise here, which is the safe direction.

const PUBLIC_PROFILE_COLUMNS = Object.freeze(["id", "artist_name", "public_description", "public_handle", "published_at"]);

const NEVER_PUBLISHED_COLUMNS = Object.freeze([
  "organization_id",
  "platform_id",
  "user_id",
  "artist_key",
  "private_backstory",
  "voice_identity",
  "genre_blend",
  "writing_rules",
  "visual_rules",
  "prompt_rules"
]);

// The shape, matching the check constraint in migration 20260819080000: three to
// thirty-two characters of lowercase letters, digits and hyphens, not starting or
// ending with a hyphen.
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const HANDLE_MIN = 3;
const HANDLE_MAX = 32;

// Handles nobody may take.
//
// Two separate reasons, and both matter:
//
//   * **Routing.** /creator/<handle> is its own path, so a handle cannot shadow
//     a top-level route today -- but the reserved list includes them anyway,
//     because the cheapest future change is to serve profiles from the root, and
//     a handle called `login` would make that change impossible rather than
//     merely awkward.
//   * **Impersonation.** `support`, `admin`, `billing`, `security` and `official`
//     are what somebody registers in order to be believed. That is worth
//     refusing whether or not a route exists.
//
// Kept as a literal list rather than derived from the route registry. Deriving
// it would mean a handle that is legal today becomes illegal when somebody adds
// a page -- silently invalidating a URL a creator has already printed on
// something.
const RESERVED_HANDLES = Object.freeze(new Set([
  // Every top-level segment this application serves today.
  "about", "acceptable-use", "accessibility", "account", "admin", "api", "auth",
  "billing", "business-builder", "contact", "cookies", "creator", "creator-studio",
  "dashboard", "deliverables", "earnings-disclaimer", "forgot-password", "free-tools",
  "growth-studio", "help", "how-it-works", "leadforge", "legal", "login", "logout",
  "market-intelligence", "notifications", "owner", "pricing", "privacy",
  "product-lifecycle", "products", "prompt-library", "readiness", "refund-policy",
  "requests", "reset-password", "robots", "search", "security", "service-catalog", "shared",
  "signup", "sitemap", "start", "support", "terms", "tutorials",
  // Words somebody takes in order to be mistaken for us.
  "official", "sonara", "sonara-one", "sonaraindustries", "staff", "team",
  "moderator", "root", "system", "verify", "verified", "payments", "payment",
  "invoice", "invoices", "refund", "refunds", "password", "settings", "null",
  "undefined", "new", "edit", "delete"
]));

/**
 * Whether a handle may be taken, and if not, what to tell the person.
 * Returns the normalized handle on success -- callers must store that rather
 * than what was typed, or "Nova" and "nova" become two different profiles.
 */
function checkHandle(value) {
  const raw = String(value == null ? "" : value).trim().toLowerCase();
  if (!raw) return { ok: false, code: "handle_required", message: "Pick an address for your profile. It becomes the end of your link." };
  if (raw.length < HANDLE_MIN) return { ok: false, code: "handle_too_short", message: `An address needs at least ${HANDLE_MIN} characters.` };
  if (raw.length > HANDLE_MAX) return { ok: false, code: "handle_too_long", message: `An address can be at most ${HANDLE_MAX} characters.` };
  if (!HANDLE_PATTERN.test(raw)) {
    return {
      ok: false,
      code: "handle_shape",
      message: "Use lowercase letters, numbers and hyphens only, starting and ending with a letter or number."
    };
  }
  if (RESERVED_HANDLES.has(raw)) {
    // Named as taken rather than as forbidden. "That address is not available"
    // is true and tells somebody guessing at reserved words nothing.
    return { ok: false, code: "handle_reserved", message: "That address is not available. Try another one." };
  }
  return { ok: true, handle: raw };
}

function profilePath(handle) {
  const checked = checkHandle(handle);
  return checked.ok ? `/creator/${checked.handle}` : null;
}

// A follower count somebody can act on, said in words rather than only a number.
//
// Zero is a real answer and gets a real sentence. "0 followers" under a profile
// its owner has just published reads as failure; "Nobody is following this yet"
// is the same fact and is what a person would say.
function followerSummary(count) {
  // Number(null) is 0 and Number("") is 0, so `Number.isFinite(Number(count))`
  // turns "we could not count" into "nobody follows this". Absent is checked
  // before the conversion, not after it.
  const total = count === null || count === undefined || count === ""
    ? null
    : Number.isFinite(Number(count)) ? Math.max(0, Math.round(Number(count))) : null;
  if (total === null) return { total: null, sentence: "We could not count the followers just now." };
  if (total === 0) return { total: 0, sentence: "Nobody is following this yet." };
  if (total === 1) return { total: 1, sentence: "1 person follows this." };
  return { total, sentence: `${total.toLocaleString("en-US")} people follow this.` };
}

/**
 * What a public profile page renders, from one row and a follower count.
 * Data rather than markup, so a test can assert what is in it without searching
 * HTML for the absence of a thing.
 */
function publicProfileView(row, followerCount) {
  if (!row || typeof row !== "object") return null;
  const name = String(row.artist_name || "").trim();
  if (!name) return null;
  const description = String(row.public_description || "").trim();
  return {
    name,
    handle: String(row.public_handle || "").trim(),
    // The absence of a description is not an error and is not filler. A profile
    // with a name and a follow button is still a profile.
    description: description || null,
    followers: followerSummary(followerCount)
  };
}

module.exports = {
  HANDLE_MAX,
  HANDLE_MIN,
  HANDLE_PATTERN,
  NEVER_PUBLISHED_COLUMNS,
  PUBLIC_PROFILE_COLUMNS,
  RESERVED_HANDLES,
  checkHandle,
  followerSummary,
  profilePath,
  publicProfileView
};
