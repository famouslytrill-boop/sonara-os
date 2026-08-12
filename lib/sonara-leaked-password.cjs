"use strict";

// Refuse passwords that are already in a public breach corpus.
//
// The security advisor reported Supabase Auth's leaked-password protection
// disabled on 2026-07-27, and it has stayed disabled since:
// scripts/verify-production-project-identity.mjs prints a WARNING about it on
// every deploy. That setting is a dashboard toggle on the Supabase project, so
// nothing in this repository can turn it on, and nothing in this repository
// would notice if somebody turned it off again.
//
// This is the half that does not depend on a toggle. It runs server-side,
// before the password is ever sent to Supabase, so the protection exists
// whether or not the dashboard setting is enabled. When the owner does enable
// it, the two agree rather than conflict -- both refuse the same passwords.
//
// The check uses the k-anonymity range API, which never sees the password or
// its full hash:
//
//   1. SHA-1 the password locally.
//   2. Send the first five hex characters of the digest -- and nothing else.
//   3. The service returns every suffix sharing that prefix, roughly 800 of
//      them, and the comparison happens here.
//
// Add-Padding asks for the response to be padded to a uniform size, so the
// number of bytes on the wire does not narrow down which prefix was requested.
//
// SHA-1 is correct here and not a weakness: it is the digest the corpus is
// indexed by, it is being used to look up a value rather than to protect one,
// and the password never leaves this process.
//
// It fails OPEN. If the service is slow, down, blocked by egress rules, or
// returns something unexpected, the signup proceeds. A third-party outage must
// not stop people creating accounts, and an authentication path that hard-fails
// on an external dependency is a worse problem than the one being solved. Every
// such case is reported through the `checked` flag so a caller can log the
// difference between "checked and clean" and "could not check".

const crypto = require("node:crypto");

const RANGE_API = "https://api.pwnedpasswords.com/range";

// Long enough for a normal round trip, short enough that a hanging service does
// not hold a signup open. The test value keeps the suite fast, matching the
// pattern server.js already uses for its database reads.
const TIMEOUT_MS = process.env.NODE_ENV === "test" ? 100 : 1500;

function sha1Upper(value) {
  return crypto.createHash("sha1").update(value, "utf8").digest("hex").toUpperCase();
}

/**
 * @returns {Promise<{ leaked: boolean, checked: boolean, count: number, reason?: string }>}
 *   leaked  - true only when the password was positively found in the corpus.
 *   checked - false when the lookup could not be completed, in which case
 *             leaked is always false and the caller should allow the password.
 */
async function isPasswordLeaked(password, options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch;
  if (typeof password !== "string" || !password) {
    return { leaked: false, checked: false, count: 0, reason: "no password supplied" };
  }
  if (typeof fetchImpl !== "function") {
    return { leaked: false, checked: false, count: 0, reason: "no fetch implementation available" };
  }

  const digest = sha1Upper(password);
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || TIMEOUT_MS);

  let response;
  try {
    response = await fetchImpl(`${RANGE_API}/${prefix}`, {
      headers: { "Add-Padding": "true", Accept: "text/plain" },
      signal: controller.signal
    });
  } catch {
    return { leaked: false, checked: false, count: 0, reason: "breach corpus unreachable" };
  } finally {
    clearTimeout(timeout);
  }

  if (!response || !response.ok) {
    return { leaked: false, checked: false, count: 0, reason: `breach corpus returned ${response ? response.status : "no response"}` };
  }

  let text;
  try {
    text = await response.text();
  } catch {
    return { leaked: false, checked: false, count: 0, reason: "breach corpus response unreadable" };
  }

  if (typeof text !== "string" || !text.includes(":")) {
    return { leaked: false, checked: false, count: 0, reason: "breach corpus response was not in the expected format" };
  }

  for (const line of text.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    if (line.slice(0, separator).trim().toUpperCase() !== suffix) continue;
    // Padded responses carry real suffixes with a count of 0. Those are filler,
    // not findings, and treating one as a breach would reject a good password.
    const count = Number.parseInt(line.slice(separator + 1).trim(), 10);
    if (!Number.isFinite(count) || count <= 0) return { leaked: false, checked: true, count: 0 };
    return { leaked: true, checked: true, count };
  }

  return { leaked: false, checked: true, count: 0 };
}

// One wording, used by every caller, so the reason a password was refused reads
// the same in the signup form and the reset form. It does not say how many
// times the password appeared -- that is a number the person cannot act on, and
// it invites treating a low count as acceptable.
const LEAKED_PASSWORD_MESSAGE =
  "That password has appeared in a public data breach, so it is not safe to use here. " +
  "Choose a different one — a password you have not used anywhere else.";

module.exports = { isPasswordLeaked, LEAKED_PASSWORD_MESSAGE, sha1Upper };
