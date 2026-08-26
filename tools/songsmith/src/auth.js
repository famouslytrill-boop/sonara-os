"use strict";

// Accounts, passwords, sessions.
//
// The lifecycle the owner asked for is: **ask -> wait -> be approved -> sign
// in**. That is three states and not two, and the difference matters at the
// sign-in prompt rather than only in the database:
//
//   - `pending`  asked, nobody has decided. Signing in must fail.
//   - `active`   approved. Signing in works.
//   - `disabled` was approved and is not any more. Signing in must fail, and
//                any session that already exists must stop working *now*.
//
// ## Passwords
//
// scrypt, from `node:crypto`. It is memory-hard, it ships with Node, and it is
// the one password hash available here without taking a dependency. The
// parameters are stored *in the record* (`scrypt$N$r$p$salt$hash`), so raising
// the cost later does not invalidate every existing password -- old records
// keep verifying against the parameters they were written with.
//
// ## Comparisons are constant time, both of them
//
// `timingSafeEqual` for the password, and for the CSRF token. The second one is
// easy to forget: the session lookup is a database read keyed on a hash, but
// the CSRF check is a plain string comparison and would leak its prefix.
//
// ## The token in the cookie is never the token in the database
//
// The database stores `sha256(token)`. A stolen database backup is then a list
// of hashes, not a set of working logins. The cookie is the only place the
// token itself exists, and it is `HttpOnly`, `SameSite=Strict`, and `Secure`
// whenever the request arrived over HTTPS.

const crypto = require("node:crypto");
const db = require("./db.js");

const SESSION_DAYS = 14;
const COOKIE = "songsmith_session";

// scrypt cost. N=2^15 with r=8 needs about 32MB per hash, which is the point --
// it is what makes a stolen hash expensive to attack. `maxmem` has to be raised
// to match or Node refuses its own parameters.
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };

function hashPassword(password, params = SCRYPT) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(password), salt, params.keylen, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/**
 * Verify a password against a stored record.
 *
 * Returns false rather than throwing on a malformed record. A record this
 * cannot parse is a record nobody can sign in with, which is the safe end of
 * the mistake -- throwing would turn one corrupt row into a 500 on the sign-in
 * page for everybody.
 */
function verifyPassword(password, record) {
  const parts = String(record || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, expected] = parts;
  const params = { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem };
  if (!Number.isFinite(params.N) || !Number.isFinite(params.r) || !Number.isFinite(params.p)) return false;
  let want;
  try {
    want = Buffer.from(expected, "base64");
  } catch {
    return false;
  }
  if (!want.length) return false;
  let got;
  try {
    got = crypto.scryptSync(String(password), Buffer.from(salt, "base64"), want.length, params);
  } catch {
    return false;
  }
  // Lengths must match before timingSafeEqual, which throws on a mismatch.
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

function newToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function sameString(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// --- the account lifecycle ------------------------------------------------

const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

/**
 * Somebody asks for an account.
 *
 * The first account ever created is an active admin -- there has to be
 * somebody to approve the second one, and an installation whose only admin
 * path is editing the database by hand is an installation nobody can run.
 * Every account after it is `pending`.
 */
function requestAccount(database, { email, password, displayName, reason }) {
  const address = String(email || "").trim();
  if (!EMAIL.test(address)) return { ok: false, problem: "That does not look like an email address." };
  if (String(password || "").length < 10) {
    return { ok: false, problem: "Use a password of at least 10 characters." };
  }
  if (db.findUserByEmail(database, address)) {
    // Deliberately the same outcome whether or not the address is taken, so
    // this form cannot be used to find out who has an account here.
    return { ok: true, existing: true };
  }
  const first = db.listUsers(database).length === 0;
  const user = db.createUser(database, {
    id: crypto.randomUUID(),
    email: address,
    displayName: String(displayName || "").trim().slice(0, 60),
    passwordHash: hashPassword(password),
    reason: String(reason || "").trim().slice(0, 500),
    isAdmin: first,
    status: first ? "active" : "pending"
  });
  return { ok: true, user, first };
}

/**
 * Sign in.
 *
 * The password is verified *before* the status is looked at, and the same
 * generic message comes back for a wrong password and for a non-existent
 * account. A pending or disabled account gets its own message, because at that
 * point the password was right and the person is entitled to know why they
 * cannot get in -- telling them "wrong password" would send them round a reset
 * loop that could never work.
 */
function signIn(database, { email, password, now = Date.now() }) {
  const user = db.findUserByEmail(database, email);
  // Run a hash even when there is no such user, so the response time does not
  // say whether the address exists.
  const record = user ? user.password_hash : hashPassword("no-such-user-placeholder");
  const correct = verifyPassword(password, record);
  if (!user || !correct) return { ok: false, problem: "That email and password do not match." };

  if (user.status === "pending") {
    return { ok: false, pending: true, problem: "Your account is waiting to be approved. You will be able to sign in once it is." };
  }
  if (user.status !== "active") {
    return { ok: false, disabled: true, problem: "This account has been disabled." };
  }

  const token = newToken();
  db.createSession(database, {
    tokenHash: hashToken(token),
    userId: user.id,
    expiresAt: now + SESSION_DAYS * 24 * 60 * 60 * 1000,
    now
  });
  return { ok: true, user, token };
}

/**
 * Who is making this request.
 *
 * The user's *current* status is read on every call, not remembered from
 * sign-in. Disabling an account also deletes its sessions (see `db.js`), so
 * this is belt and braces -- but the check is one line and the failure it
 * guards against is "the admin pressed disable and nothing happened".
 */
function currentUser(database, token, now = Date.now()) {
  if (!token) return null;
  const row = db.findSession(database, hashToken(token), now);
  if (!row) return null;
  if (row.status !== "active") return null;
  return row;
}

function signOut(database, token) {
  if (token) db.deleteSession(database, hashToken(token));
}

// --- cookies --------------------------------------------------------------

function readCookies(header) {
  const out = {};
  for (const piece of String(header || "").split(";")) {
    const at = piece.indexOf("=");
    if (at === -1) continue;
    out[piece.slice(0, at).trim()] = decodeURIComponent(piece.slice(at + 1).trim());
  }
  return out;
}

function sessionCookie(token, { secure, maxAge = SESSION_DAYS * 24 * 60 * 60 }) {
  const bits = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    // Strict rather than Lax: nothing here is meant to be reached by following
    // a link from somewhere else, and Strict is what makes a cross-site POST
    // arrive with no session at all rather than with the victim's.
    "SameSite=Strict",
    `Max-Age=${maxAge}`
  ];
  if (secure) bits.push("Secure");
  return bits.join("; ");
}

function clearedCookie(secure) {
  return sessionCookie("", { secure, maxAge: 0 });
}

// --- CSRF -----------------------------------------------------------------
//
// SameSite=Strict already stops the cross-site form post. This is the second
// layer, because SameSite is a browser behaviour and a browser that got it
// wrong -- or a user agent that is not a browser -- would leave the first layer
// with nothing behind it. The token is derived from the session rather than
// stored, so there is no per-form state to expire.

function csrfToken(sessionToken, secret) {
  return crypto.createHmac("sha256", secret).update(`csrf:${sessionToken}`).digest("base64url");
}

function csrfOk(sessionToken, secret, presented) {
  if (!sessionToken || !presented) return false;
  return sameString(csrfToken(sessionToken, secret), presented);
}

module.exports = {
  hashPassword, verifyPassword, newToken, hashToken, sameString,
  requestAccount, signIn, currentUser, signOut,
  readCookies, sessionCookie, clearedCookie,
  csrfToken, csrfOk,
  COOKIE, SESSION_DAYS, SCRYPT, EMAIL
};
