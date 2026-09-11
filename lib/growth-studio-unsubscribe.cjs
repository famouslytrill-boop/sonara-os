"use strict";

// The way out of a campaign, which is the half of consent nothing had built.
//
// `growth_contact_consents` records permission per channel and purpose, and
// `growth-studio-sender.cjs` refuses to send to anybody whose row says
// `withdrawn`. **Nothing could set it.** An owner could, from a form; the person
// who actually received the email could not, and they are the only one whose
// decision it is.
//
// So the consent system was elaborate and one-way: it could be granted and
// honoured, and never withdrawn by the person it belonged to.
//
// This product's own /legal/can-spam page tells a customer that "a working
// unsubscribe" is one of the basics. Shipping a sender with none would be this
// application telling somebody a rule and then handing them a tool that cannot
// keep it.
//
// ## The standard, read rather than remembered
//
// RFC 8058, read 10 September 2026. One-click unsubscribe requires:
//
//   * "one List-Unsubscribe header field and one List-Unsubscribe-Post header
//     field in the message. The List-Unsubscribe header field MUST contain one
//     HTTPS URI."
//   * "The List-Unsubscribe-Post header MUST contain the single key/value pair
//     'List-Unsubscribe=One-Click'."
//   * The mail client POSTs `List-Unsubscribe=One-Click` as the body.
//   * "The mail sender MUST NOT return an HTTPS redirect."
//   * "The POST request MUST NOT include cookies, HTTP authorization, or any
//     other context information" -- so the URI itself has to carry the identity.
//     That is what the token below is for.
//   * The message "MUST have a valid DKIM signature that covers at least the
//     List-Unsubscribe and List-Unsubscribe-Post headers." **That part is the
//     provider's**, and it is worth stating plainly: Resend signs with DKIM for
//     a verified sending domain, so this is only compliant while
//     RESEND_FROM_EMAIL is on a domain verified there. Nothing in this file can
//     check that, and pretending otherwise would be a comment nobody verified.
//
// ## Why GET does not unsubscribe anybody
//
// The in-body link is a GET and it renders a confirmation with a button. That
// looks like an extra step and it is not optional: **mail security scanners and
// inbox proxies prefetch links.** A GET that withdrew consent on load would
// unsubscribe people who never clicked, and the owner would see contacts
// dropping out of every campaign with no explanation.
//
// The RFC 8058 POST is different and is honoured immediately: a mail client
// making it is acting on a person pressing Unsubscribe in their mail app, which
// is the person deciding.

const crypto = require("node:crypto");

const UNSUBSCRIBE_PATH = "/growth/unsubscribe";

// Bumped if the token layout ever changes, so an old link fails to verify
// rather than being read under the wrong rules.
const TOKEN_VERSION = "u1";

// The domain separators. HMAC-ing one of these against the base secret gives a
// key that signs unsubscribe tokens and nothing else -- so a token cannot be
// replayed against another signature scheme, and the derived key does not
// reveal the secret it came from.
//
// **Two contexts, one per source, and that is a correction.** Both sources
// originally used a single context, so if SONARA_UNSUBSCRIBE_SECRET and
// SUPABASE_SERVICE_ROLE_KEY ever held the same string they derived the same
// key -- the two inputs were separated from other schemes and not from each
// other. A test asking whether they differ found it.
//
// The consequence is worth stating because it is operational: **setting
// SONARA_UNSUBSCRIBE_SECRET for the first time changes the key**, so unsubscribe
// links already sitting in inboxes stop verifying. Set it before the first
// campaign, or accept that the links from before it stop working -- which is
// the same trade as rotating the service role key, in the other direction.
const KEY_CONTEXT = "sonara:growth-unsubscribe:v1";
const KEY_CONTEXT_DERIVED = "sonara:growth-unsubscribe:from-service-role:v1";

// The one channel this covers.
//
// Campaign sending is email only, so withdrawal is recorded on the email
// channel. A token that could name its own channel would let a link withdraw
// somebody's SMS permission from an email nobody sent by SMS.
const CHANNEL = "email";

// What signs the token, and the honest account of where it comes from.
//
// `SONARA_UNSUBSCRIBE_SECRET` when set. Otherwise derived from
// `SUPABASE_SERVICE_ROLE_KEY`, which is already required, already server-only,
// and present anywhere this application functions at all -- so the feature
// works on deploy without a new owner step, which matters for something a
// campaign must not be sent without.
//
// **The cost of the fallback, stated rather than buried: rotating the service
// role key invalidates every unsubscribe link already in somebody's inbox.**
// They live there for months. An owner who rotates that key should set
// SONARA_UNSUBSCRIBE_SECRET first, and it is documented in the owner steps for
// that reason.
//
// Returns null when neither is available. Callers must treat null as "do not
// send", never as "send without one".
function deriveSigningKey(getEnv = (name) => process.env[name]) {
  const dedicated = String(getEnv("SONARA_UNSUBSCRIBE_SECRET") || "").trim();
  if (dedicated) return crypto.createHmac("sha256", dedicated).update(KEY_CONTEXT).digest();

  const serviceRole = String(getEnv("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (serviceRole) return crypto.createHmac("sha256", serviceRole).update(KEY_CONTEXT_DERIVED).digest();

  return null;
}

function base64url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signature(key, payload) {
  return base64url(crypto.createHmac("sha256", key).update(payload).digest()).slice(0, 32);
}

// A token naming exactly one contact's email permission in one organization.
//
// The organization is in it as well as the lead, because the write it authorises
// is organization-scoped -- the service-role key bypasses row-level security, so
// a withdrawal that did not name the organization would be a write with no
// tenant boundary.
function signToken({ organizationId, leadId, key } = {}) {
  const organization = String(organizationId || "").trim();
  const lead = String(leadId || "").trim();
  if (!organization || !lead || !key) return null;

  const payload = `${TOKEN_VERSION}.${organization}.${lead}`;
  return `${payload}.${signature(key, payload)}`;
}

// Read a token back, or say why not.
//
// Every refusal is the same shape and none of them says whether the contact
// exists: this is an unauthenticated endpoint, so a reply that distinguished
// "no such lead" from "bad signature" would answer questions about somebody
// else's contact list.
function verifyToken(token, key) {
  if (!key) return { ok: false, code: "unsubscribe_not_configured" };

  const parts = String(token || "").split(".");
  if (parts.length !== 4) return { ok: false, code: "malformed_token" };

  const [version, organizationId, leadId, provided] = parts;
  if (version !== TOKEN_VERSION) return { ok: false, code: "unknown_token_version" };

  const expected = signature(key, `${version}.${organizationId}.${leadId}`);

  // Constant-time, and length-checked first because timingSafeEqual throws on a
  // length mismatch rather than returning false -- the same correction
  // lib/sonara-billing.cjs already carries for the Stripe signature.
  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, code: "bad_signature" };

  // Checked after the signature, deliberately. A malformed id inside a validly
  // signed token is our own bug; a malformed id in an unsigned one is somebody
  // probing, and it should not get a different answer from a bad signature.
  if (!isUuid(organizationId) || !isUuid(leadId)) return { ok: false, code: "bad_signature" };

  return { ok: true, organizationId, leadId, channel: CHANNEL };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

// The HTTPS URI the headers and the body link both point at.
//
// Returns null without an https origin rather than building an http one. RFC
// 8058 requires HTTPS, and `lib/sonara-site-origin.cjs` already refuses to
// invent a host -- a link that looks sendable and is not is worse than no link,
// and here it would also be an unsubscribe that does not work.
function unsubscribeUrl({ origin, token } = {}) {
  const base = String(origin || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//.test(base) || !token) return null;
  return `${base}${UNSUBSCRIBE_PATH}?t=${encodeURIComponent(token)}`;
}

// The two headers, exactly as RFC 8058 specifies them.
function unsubscribeHeaders(url) {
  if (!url) return null;
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
  };
}

// The visible way out, for the mail clients that do not implement RFC 8058.
//
// The headers alone are not enough: they are honoured by Gmail, Yahoo and
// Outlook and not by everything, and a recipient in a client that ignores them
// would have no way out at all. So the link goes in the body too.
function withUnsubscribeLine(body, url) {
  if (!url) return null;
  return `${String(body || "").trimEnd()}\n\n---\nTo stop receiving these emails, open ${url}`;
}

module.exports = {
  UNSUBSCRIBE_PATH,
  TOKEN_VERSION,
  KEY_CONTEXT,
  KEY_CONTEXT_DERIVED,
  CHANNEL,
  deriveSigningKey,
  signToken,
  verifyToken,
  unsubscribeUrl,
  unsubscribeHeaders,
  withUnsubscribeLine
};
