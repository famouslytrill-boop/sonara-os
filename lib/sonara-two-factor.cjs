"use strict";

// The second factor as a flow, rather than as arithmetic.
//
// `lib/sonara-otp.cjs` answers "is this the right code". This answers the
// questions that make that worth asking: whose factor, has it been confirmed,
// has this code already been spent, how many wrong guesses have there been, and
// -- the one that decides whether any of it means anything -- **has the session
// been granted yet**.
//
// ## The reason a pending challenge exists
//
// Signing in here exchanges an email and password with Supabase for an access
// token, and the token is set as a session cookie the moment it arrives. A
// second factor asked for after that point is a form somebody can navigate away
// from. They already hold a working session; the code prompt is decoration.
//
// So when an account has a confirmed factor the tokens never reach the browser.
// They are sealed and parked in `pending_auth_challenges`, and the browser gets
// an opaque id. Only a correct code exchanges that id for the session. The row
// is single use, expires in minutes, and counts its own failed attempts --
// three things a cookie held by the person being challenged could not do.
//
// ## What this module refuses to do
//
// **It never confirms a factor the person has not proved.** Enrolment writes a
// row with `confirmed_at` null, and nothing treats an unconfirmed factor as a
// reason to challenge anybody. A factor that could lock somebody out before
// they have shown their phone produces the codes is a support incident, not a
// security feature.
//
// **It never turns the factor off without a code.** Disabling is a security
// setting change, and somebody sitting at a signed-in browser they borrowed is
// exactly who a second factor exists to stop. A recovery code is accepted
// instead, because losing the phone is the case the recovery codes are for.

const crypto = require("node:crypto");
const otp = require("./sonara-otp.cjs");
const enrolment = require("./sonara-otp-enrolment.cjs");
const secretBox = require("./sonara-secret-box.cjs");

const FACTOR_TABLE = "user_auth_factors";
const CODE_TABLE = "user_recovery_codes";
const CHALLENGE_TABLE = "pending_auth_challenges";

// Minutes. Long enough to find a phone that is in another room, short enough
// that a challenge left open on a shared machine is not a way in an hour later.
const CHALLENGE_TTL_SECONDS = 300;
// RFC 4226 section 7.3 asks a validator to throttle. Five is enough for a
// person fumbling a six-digit code and far too few to search a million of them.
const MAX_ATTEMPTS = 5;

/** The opaque id the browser holds, and the digest that is stored for it. */
function newChallengeToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

/**
 * The live factor for a person, if there is one.
 *
 * Three answers, and callers have to keep them apart: `{ ok: true, factor }`,
 * `{ ok: true, factor: null }` for somebody who has not set one up, and
 * `{ ok: false }` for a read that did not happen. Treating the third as the
 * second signs somebody in without their second factor during an outage, which
 * is the failure this whole module exists to prevent.
 */
async function liveFactor(store, userId) {
  if (!userId) return { ok: true, factor: null };
  const found = await store.list(
    FACTOR_TABLE,
    `?select=id,sealed_secret,confirmed_at,last_used_step&user_id=eq.${encodeURIComponent(userId)}&disabled_at=is.null&limit=1`
  );
  if (!found?.ok) return { ok: false };
  return { ok: true, factor: found.rows?.[0] || null };
}

/** Whether signing in as this person must be held back for a code. */
async function challengeRequired(store, userId) {
  const live = await liveFactor(store, userId);
  if (!live.ok) return { ok: false };
  return { ok: true, required: Boolean(live.factor && live.factor.confirmed_at) };
}

/**
 * Start enrolling a factor.
 *
 * Returns the secret, the URI and the recovery codes **once**. Nothing here can
 * show them again: the secret is sealed on the way into storage and the codes
 * are hashed, which is the point of both.
 */
async function beginEnrolment(store, key, { userId, account }) {
  if (!key?.ok) return { ok: false, code: key?.code || "setup_required" };
  const live = await liveFactor(store, userId);
  if (!live.ok) return { ok: false, code: "unreadable" };
  // A confirmed factor is not replaced silently. Turning it off is its own
  // action, and it needs a code.
  if (live.factor?.confirmed_at) return { ok: false, code: "already_enrolled" };

  // An unconfirmed one is abandoned rather than kept: somebody who started
  // enrolment, closed the tab and came back should get a fresh secret rather
  // than one that may be half-scanned into an app.
  if (live.factor) {
    const retired = await store.patch(FACTOR_TABLE, `id=eq.${encodeURIComponent(live.factor.id)}`, { disabled_at: new Date().toISOString() });
    if (retired?.ok === false) return { ok: false, code: "unwritable" };
  }

  const made = enrolment.newEnrolment({ account });
  const saved = await store.insert(FACTOR_TABLE, {
    user_id: userId,
    factor_type: "totp",
    sealed_secret: secretBox.seal(made.secret, key)
  });
  if (saved?.ok === false || !saved?.rows?.[0]?.id) return { ok: false, code: "unwritable" };
  const factorId = saved.rows[0].id;

  const pepper = secretBox.pepper(key);
  const rows = made.recoveryCodes.map((code) => {
    const hashed = enrolment.hashRecoveryCode(code, { pepper });
    return { user_id: userId, factor_id: factorId, salt: hashed.salt, hash: hashed.hash };
  });
  // Replace rather than append: codes from an abandoned enrolment are for a
  // secret nothing will ever accept, and leaving them would tell somebody they
  // have twenty when ten of them cannot work.
  await store.remove(CODE_TABLE, `user_id=eq.${encodeURIComponent(userId)}`);
  const storedCodes = await store.insert(CODE_TABLE, rows);
  if (storedCodes?.ok === false) return { ok: false, code: "unwritable" };

  return {
    ok: true,
    factorId,
    uri: made.uri,
    readableSecret: made.readableSecret,
    recoveryCodes: made.recoveryCodes
  };
}

/** Prove the phone produces the codes, and turn the factor on. */
async function confirmEnrolment(store, key, { userId, code, at = Date.now() / 1000 }) {
  if (!key?.ok) return { ok: false, code: key?.code || "setup_required" };
  const live = await liveFactor(store, userId);
  if (!live.ok) return { ok: false, code: "unreadable" };
  if (!live.factor) return { ok: false, code: "not_started" };
  if (live.factor.confirmed_at) return { ok: false, code: "already_enrolled" };

  const opened = secretBox.open(live.factor.sealed_secret, key);
  if (!opened.ok) return { ok: false, code: "cannot_open" };

  const answer = otp.verify(opened.bytes, code, { at, lastUsedStep: live.factor.last_used_step });
  if (!answer.ok) return { ok: false, code: answer.code };

  const saved = await store.patch(FACTOR_TABLE, `id=eq.${encodeURIComponent(live.factor.id)}`, {
    confirmed_at: new Date(at * 1000).toISOString(),
    last_used_step: answer.step
  });
  if (saved?.ok === false) return { ok: false, code: "unwritable" };
  return { ok: true };
}

/**
 * Turn the factor off.
 *
 * Requires a working code or a recovery code. A signed-in browser is not proof
 * that the person sitting at it is the account holder -- that is the whole
 * premise of a second factor, and a disable button that only needed a session
 * would hand it straight back.
 */
async function disableFactor(store, key, { userId, code, recoveryCode, at = Date.now() / 1000 }) {
  const proof = await proveSecondFactor(store, key, { userId, code, recoveryCode, at });
  if (!proof.ok) return proof;

  const now = new Date(at * 1000).toISOString();
  const disabled = await store.patch(FACTOR_TABLE, `id=eq.${encodeURIComponent(proof.factor.id)}`, { disabled_at: now });
  if (disabled?.ok === false) return { ok: false, code: "unwritable" };
  // The codes go with it. Leaving them would mean turning the factor back on
  // later silently re-arms a list somebody printed months ago.
  await store.remove(CODE_TABLE, `user_id=eq.${encodeURIComponent(userId)}`);
  return { ok: true };
}

/**
 * Check a code or a recovery code against a person's live factor.
 *
 * The shared half of confirming, disabling and completing a challenge. Returns
 * `{ ok: true, factor, usedRecoveryCode }` or `{ ok: false, code }` with the
 * reason -- `reused` and `already_used` stay distinct from `no_match`, because
 * telling somebody their correct code is wrong sends them looking for the wrong
 * problem.
 */
async function proveSecondFactor(store, key, { userId, code, recoveryCode, at = Date.now() / 1000 }) {
  if (!key?.ok) return { ok: false, code: key?.code || "setup_required" };
  const live = await liveFactor(store, userId);
  if (!live.ok) return { ok: false, code: "unreadable" };
  if (!live.factor || !live.factor.confirmed_at) return { ok: false, code: "not_enrolled" };

  if (recoveryCode) {
    const stored = await store.list(
      CODE_TABLE,
      `?select=id,salt,hash,used_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=50`
    );
    if (!stored?.ok) return { ok: false, code: "unreadable" };
    const rows = (stored.rows || []).map((row) => ({ salt: row.salt, hash: row.hash, usedAt: row.used_at }));
    const matched = enrolment.matchRecoveryCode(recoveryCode, rows, secretBox.pepper(key));
    if (!matched.ok) return { ok: false, code: matched.code };
    const spent = await store.patch(
      CODE_TABLE,
      `id=eq.${encodeURIComponent(stored.rows[matched.index].id)}`,
      { used_at: new Date(at * 1000).toISOString() }
    );
    // The write is what makes it single use. If it did not happen the code is
    // still live, and reporting success would spend nothing while opening the
    // account -- so this refuses rather than letting it through.
    if (spent?.ok === false) return { ok: false, code: "unwritable" };
    return { ok: true, factor: live.factor, usedRecoveryCode: true };
  }

  const opened = secretBox.open(live.factor.sealed_secret, key);
  if (!opened.ok) return { ok: false, code: "cannot_open" };
  const answer = otp.verify(opened.bytes, code, { at, lastUsedStep: live.factor.last_used_step });
  if (!answer.ok) return { ok: false, code: answer.code };

  // Recorded before the caller is told yes. RFC 6238 section 5.2: the same code
  // must not be accepted twice, and a step written after the session is granted
  // is a step that is not written at all if the request dies in between.
  const marked = await store.patch(FACTOR_TABLE, `id=eq.${encodeURIComponent(live.factor.id)}`, { last_used_step: answer.step });
  if (marked?.ok === false) return { ok: false, code: "unwritable" };
  return { ok: true, factor: live.factor, usedRecoveryCode: false, step: answer.step };
}

/** Park a correct password's session behind the code prompt. */
async function startChallenge(store, key, { userId, session, at = Date.now() / 1000 }) {
  if (!key?.ok) return { ok: false, code: key?.code || "setup_required" };
  const { token, hash } = newChallengeToken();
  const saved = await store.insert(CHALLENGE_TABLE, {
    user_id: userId,
    token_hash: hash,
    sealed_session: secretBox.seal(Buffer.from(JSON.stringify(session || {})), key),
    expires_at: new Date((at + CHALLENGE_TTL_SECONDS) * 1000).toISOString()
  });
  if (saved?.ok === false) return { ok: false, code: "unwritable" };
  return { ok: true, token, expiresInSeconds: CHALLENGE_TTL_SECONDS };
}

/**
 * Exchange a challenge id and a code for the session that was held back.
 *
 * Every refusal path leaves the challenge less usable than it found it: a wrong
 * code costs an attempt, and the fifth wrong code consumes the row outright
 * rather than leaving it to expire.
 */
async function completeChallenge(store, key, { token, code, recoveryCode, at = Date.now() / 1000 }) {
  if (!key?.ok) return { ok: false, code: key?.code || "setup_required" };
  if (!token) return { ok: false, code: "no_challenge" };

  const found = await store.list(
    CHALLENGE_TABLE,
    `?select=id,user_id,sealed_session,expires_at,attempts,consumed_at&token_hash=eq.${encodeURIComponent(hashToken(token))}&limit=1`
  );
  if (!found?.ok) return { ok: false, code: "unreadable" };
  const challenge = found.rows?.[0];
  if (!challenge) return { ok: false, code: "no_challenge" };
  // Spent and expired are separate answers because they are separate mistakes:
  // one is a replayed link, the other is somebody who took too long.
  if (challenge.consumed_at) return { ok: false, code: "already_used" };
  if (Date.parse(challenge.expires_at) <= at * 1000) return { ok: false, code: "expired" };
  if (Number(challenge.attempts || 0) >= MAX_ATTEMPTS) return { ok: false, code: "too_many_attempts" };

  const proof = await proveSecondFactor(store, key, { userId: challenge.user_id, code, recoveryCode, at });
  if (!proof.ok) {
    const attempts = Number(challenge.attempts || 0) + 1;
    await store.patch(CHALLENGE_TABLE, `id=eq.${encodeURIComponent(challenge.id)}`, {
      attempts,
      // Killed outright at the cap rather than left to expire, so the remaining
      // minutes are not five more minutes of guessing.
      ...(attempts >= MAX_ATTEMPTS ? { consumed_at: new Date(at * 1000).toISOString() } : {})
    });
    return { ok: false, code: proof.code, attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts) };
  }

  // Consumed before the session is handed back, for the same reason the step is
  // written first: a row marked used after the response is a row that is not
  // marked at all if the request dies in between.
  const consumed = await store.patch(CHALLENGE_TABLE, `id=eq.${encodeURIComponent(challenge.id)}`, {
    consumed_at: new Date(at * 1000).toISOString()
  });
  if (consumed?.ok === false) return { ok: false, code: "unwritable" };

  const opened = secretBox.open(challenge.sealed_session, key);
  if (!opened.ok) return { ok: false, code: "cannot_open" };
  let session = null;
  try {
    session = JSON.parse(opened.bytes.toString("utf8"));
  } catch {
    return { ok: false, code: "cannot_open" };
  }
  if (!session?.accessToken) return { ok: false, code: "cannot_open" };
  return { ok: true, session, usedRecoveryCode: proof.usedRecoveryCode };
}

/** How many recovery codes are left, for a page that has to say. */
async function countRecoveryCodes(store, userId) {
  const stored = await store.list(
    CODE_TABLE,
    `?select=used_at&user_id=eq.${encodeURIComponent(userId)}&limit=50`
  );
  if (!stored?.ok) return { ok: false };
  const rows = stored.rows || [];
  return { ok: true, total: rows.length, left: rows.filter((row) => !row.used_at).length };
}

module.exports = {
  FACTOR_TABLE,
  CODE_TABLE,
  CHALLENGE_TABLE,
  CHALLENGE_TTL_SECONDS,
  MAX_ATTEMPTS,
  hashToken,
  newChallengeToken,
  liveFactor,
  challengeRequired,
  beginEnrolment,
  confirmEnrolment,
  disableFactor,
  proveSecondFactor,
  startChallenge,
  completeChallenge,
  countRecoveryCodes
};
