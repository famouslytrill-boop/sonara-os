"use strict";

// The parts of a browser-to-browser call that are arithmetic.
//
// Tokens, expiry, what a signal is allowed to be, and which ICE servers a
// browser should be handed. Deliberately free of any database or network call
// so the rules can be tested without either -- the store lives in
// `lib/sonara-call-sessions.cjs` and the routes in
// `routes/sonara-call-routes.cjs`.
//
// ## Why the ICE servers are configuration and not a constant
//
// About 80-85% of WebRTC connections succeed peer to peer once each side knows
// its own public address, which is what a STUN server tells it. STUN is a few
// packets and costs nothing to run. The remaining 15-20% -- both ends behind
// symmetric NAT or a corporate firewall -- need a TURN relay, which does carry
// the audio and therefore does cost something.
//
// The tempting shortcut is to hardcode a public STUN address and ship. This
// codebase's own rule is against it: *"A hosted service with a free tier is a
// price, not a licence, and a shipped feature resting on one stops working when
// the tier changes -- which is the vendor's decision, not this project's."* A
// call feature whose connectivity depends on somebody else's goodwill is a
// feature that breaks on a day nobody here chose.
//
// So there is no default. With nothing configured, `callReadiness` reports
// setup_required and names the variable -- and calls still connect between two
// devices on the same network, because host candidates need no server at all.
// That is a small true capability rather than a large one that fails silently
// on the first call placed across the internet.
//
// ## TURN credentials are minted per call and expire
//
// A TURN username and password in page source is a permanent open relay for
// anybody who reads it, and anybody who can open the page can read it. The
// standard answer -- what coturn calls its REST API, and what every hosted TURN
// provider implements -- is an ephemeral credential:
//
//   username   = <unix expiry>:<name>
//   credential = base64(HMAC-SHA1(shared secret, username))
//
// The shared secret never leaves this server. The browser gets a username and
// password that stop working within the hour. `SONARA_TURN_SECRET` is therefore
// a secret in the AGENTS.md sense -- server-only, never rendered.

const crypto = require("node:crypto");

const ROLES = Object.freeze(["business", "customer"]);
const KINDS = Object.freeze(["offer", "answer", "candidate", "bye"]);
const STATUSES = Object.freeze(["ringing", "connected", "ended", "missed"]);

// How long a join link is good for. Short, because it is a bearer capability
// and the person it was sent to is about to use it -- a link that works
// tomorrow is a link that works for whoever the message was forwarded to.
const JOIN_TTL_SECONDS = 30 * 60;

// How long a minted TURN credential lasts. Longer than a call needs to start
// and shorter than a working day.
const TURN_TTL_SECONDS = 60 * 60;

// An SDP offer with a lot of candidates runs to a few kilobytes. 32KB is well
// clear of that and well short of a payload worth storing. Bounded because the
// alternative is an unbounded write from whoever holds a join token.
const MAX_PAYLOAD_BYTES = 32 * 1024;

// What one browser may hand another in one poll. A call that needs more than
// this many candidates is not going to connect on the next one either.
const MAX_SIGNALS_PER_POLL = 200;

function otherRole(role) {
  return role === "business" ? "customer" : "business";
}

/**
 * A join token: 32 random bytes, base64url.
 *
 * `randomBytes` rather than anything derived from time or an id. A token that
 * can be predicted from when the call was placed is not a token.
 */
function newJoinToken() {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Ephemeral TURN credentials, valid until `ttlSeconds` from now.
 *
 * `name` is carried in the username so a relay's own logs can tell one caller
 * from another. It is not trusted for anything and is stripped to a safe set --
 * a colon in it would move the expiry boundary, which is the one part of this
 * string that has to be unambiguous.
 */
function turnCredentials(secret, { now = Date.now(), ttlSeconds = TURN_TTL_SECONDS, name = "sonara" } = {}) {
  const expiry = Math.floor(now / 1000) + ttlSeconds;
  const safeName = String(name).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "sonara";
  const username = `${expiry}:${safeName}`;
  // SHA-1 is not a security choice here and is not negotiable: it is what the
  // TURN REST API specifies and what every relay implementing it verifies
  // against. The secret's length is what carries the strength.
  const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");
  return { username, credential, expiresAt: new Date(expiry * 1000).toISOString() };
}

/**
 * Whether a call can be placed at all, and what a browser needs to place one.
 *
 * Three states, not two. `ok: false` with a status of `setup_required` is an
 * owner who has not configured a STUN address; it is not an error and it is not
 * a working call.
 */
function callReadiness(deps, options = {}) {
  const getEnv = typeof deps?.getEnv === "function" ? deps.getEnv : () => "";
  const stun = String(getEnv("SONARA_STUN_URLS") || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const turnUrl = String(getEnv("SONARA_TURN_URL") || "").trim();
  const turnSecret = String(getEnv("SONARA_TURN_SECRET") || "").trim();

  const bad = stun.filter((url) => !/^stuns?:/i.test(url));
  if (bad.length) {
    return {
      ok: false,
      status: "misconfigured",
      detail: `SONARA_STUN_URLS must contain stun: or stuns: addresses. Not that: ${bad.join(", ")}`,
      iceServers: [],
      relay: false
    };
  }
  if (turnUrl && !/^turns?:/i.test(turnUrl)) {
    return {
      ok: false,
      status: "misconfigured",
      detail: "SONARA_TURN_URL must be a turn: or turns: address.",
      iceServers: [],
      relay: false
    };
  }
  // A relay address with no secret cannot be used, and a secret with no address
  // has nothing to sign for. Either alone is a half-configured relay, and
  // saying so is better than silently running without one.
  if (Boolean(turnUrl) !== Boolean(turnSecret)) {
    return {
      ok: false,
      status: "misconfigured",
      detail: "SONARA_TURN_URL and SONARA_TURN_SECRET must be set together, or neither.",
      iceServers: [],
      relay: false
    };
  }

  if (!stun.length) {
    return {
      ok: false,
      status: "setup_required",
      // Written for whoever has to fix it, and honest about what still works.
      detail: "Calling needs SONARA_STUN_URLS set to a STUN address before two browsers on different networks can find each other.",
      iceServers: [],
      relay: false
    };
  }

  const iceServers = [{ urls: stun }];
  if (turnUrl) {
    const minted = turnCredentials(turnSecret, { now: options.now ?? Date.now(), name: options.name });
    iceServers.push({ urls: [turnUrl], username: minted.username, credential: minted.credential });
  }

  return {
    ok: true,
    status: "ready",
    iceServers,
    // Said plainly because it is the difference between "most calls connect"
    // and "every call connects", and the page tells the person which they have.
    relay: Boolean(turnUrl)
  };
}

/**
 * Whether a signal a browser posted is one this application will store.
 *
 * Returns `{ ok }` or `{ ok: false, code, detail }`. The payload's *contents*
 * are never inspected beyond their size: an SDP is opaque here by design, and a
 * validator that half-understood one would reject working calls while
 * protecting nothing.
 */
function validateSignal({ role, kind, payload } = {}) {
  if (!ROLES.includes(role)) return { ok: false, code: "unknown_role" };
  if (!KINDS.includes(kind)) return { ok: false, code: "unknown_kind", detail: `Expected one of ${KINDS.join(", ")}.` };
  if (payload === null || payload === undefined || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, code: "payload_not_an_object" };
  }
  let encoded;
  try {
    encoded = JSON.stringify(payload);
  } catch {
    // Circular, or something that cannot be serialised. Refused rather than
    // stored partially.
    return { ok: false, code: "payload_unreadable" };
  }
  if (Buffer.byteLength(encoded, "utf8") > MAX_PAYLOAD_BYTES) {
    return { ok: false, code: "payload_too_large", detail: `A signal must be under ${MAX_PAYLOAD_BYTES} bytes.` };
  }
  return { ok: true };
}

/**
 * Whether a call is still one somebody may join or signal on.
 *
 * A missing `expires_at` is treated as expired rather than as no expiry. The
 * column is not null, so absence means the row could not be read properly --
 * and reading "no expiry" out of that is how a bearer token becomes permanent.
 */
function joinable(session, now = Date.now()) {
  if (!session) return { ok: false, code: "no_such_call" };
  if (!STATUSES.includes(String(session.status))) return { ok: false, code: "unknown_status" };
  if (session.status === "ended" || session.status === "missed") return { ok: false, code: "call_over" };
  const expires = session.expires_at ? Date.parse(String(session.expires_at)) : NaN;
  if (!Number.isFinite(expires)) return { ok: false, code: "no_expiry" };
  if (expires <= now) return { ok: false, code: "link_expired" };
  return { ok: true };
}

/** When a call placed now should stop being joinable. */
function expiryFrom(now = Date.now(), ttlSeconds = JOIN_TTL_SECONDS) {
  return new Date(now + ttlSeconds * 1000).toISOString();
}

module.exports = {
  ROLES, KINDS, STATUSES,
  JOIN_TTL_SECONDS, TURN_TTL_SECONDS, MAX_PAYLOAD_BYTES, MAX_SIGNALS_PER_POLL,
  otherRole, newJoinToken, turnCredentials, callReadiness, validateSignal, joinable, expiryFrom
};
