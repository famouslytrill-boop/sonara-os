"use strict";

// Push notifications that cost nothing per message.
//
// `docs/architecture/2026-08-26-ZERO-MARGIN-COMMS.md` ranked this first of the
// zero-margin capabilities, and the reason is narrow and checkable: the Push
// API, the Notifications API and the Service Worker API are standard browser
// features, and **the browser vendor's push service does the delivery and is
// free**. There is no account to open, no per-message charge and no subscriber
// tier. It reaches exactly the population SMS is usually bought to reach --
// people who have already used the site.
//
// It replaces "your job is confirmed", "your invoice is due", "your booking is
// tomorrow". It does not replace reaching a stranger who has never opened the
// page; that is carrier SMS, and it stays priced in
// `lib/sonara-paid-capabilities.cjs` as `telephony`.
//
// ## Off by default, and that is a rule rather than a preference
//
// AGENTS.md: *"Sounds, voice announcements, haptics, SMS, push, and email
// alerts must be off or explicitly user-controlled by default."* Being free
// does not make it default-on. Nothing here sends without a stored subscription
// that a person created by granting permission, and `pushReadiness()` reports
// setup-required until an owner configures VAPID.
//
// ## The crypto, and why it is written out rather than depended on
//
// Three specifications stack up:
//
//   RFC 8030 -- the delivery protocol: POST to the endpoint the browser gave.
//   RFC 8291 -- payload encryption, so the push service relays a message it
//               cannot read. This is the part that must be exactly right.
//   RFC 8292 -- VAPID: a signed JWT identifying the sender.
//
// Everything below uses `node:crypto` only, which keeps this project's
// zero-dependency policy and, more importantly, keeps a cryptographic
// dependency out of a path that handles customer content.
//
// **The encryption is verified against RFC 8291's own published test vector**,
// not against my reasoning about it. Section 5 of that RFC fixes both key
// pairs, the salt and the auth secret, and publishes the exact ciphertext. The
// test reproduces it byte for byte. Appendix A publishes every intermediate
// value -- shared secret, PRK_key, IKM, PRK, CEK, nonce -- and each is asserted
// separately, so a failure names the step that is wrong rather than only that
// the output differs. Recalled crypto is wrong crypto; this is the difference
// between checking and believing.

const crypto = require("node:crypto");

const REQUIRED = Object.freeze(["getEnv"]);

// RFC 8188's record size. 4096 is what every browser push service accepts and
// what the RFC's example uses; a payload larger than one record is not
// supported here, and `encrypt` refuses rather than silently truncating.
const RECORD_SIZE = 4096;

// The uncompressed P-256 point form: 0x04 || X(32) || Y(32).
const PUBLIC_KEY_BYTES = 65;
const AUTH_SECRET_BYTES = 16;

// A push service will not accept a VAPID token valid for longer than 24 hours.
// Twelve keeps a comfortable margin and still lets one token cover a batch.
const VAPID_MAX_SECONDS = 12 * 60 * 60;

function b64url(buffer) {
  return Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value) {
  // Padding restored explicitly. Buffer.from tolerates its absence, but a
  // length that is not a multiple of 4 has silently decoded short for people
  // before, and this is a path where a short key is a wrong key.
  const normalised = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

/**
 * HKDF as RFC 8291 uses it: one extract, then one expand of a single block.
 *
 * Written out rather than using `crypto.hkdfSync` because every output here is
 * 32 bytes or fewer, so the expand is exactly one HMAC with a trailing 0x01 --
 * and the explicit form is the one that can be compared against the RFC's
 * intermediate values line by line.
 */
function hkdf(salt, ikm, info, length) {
  const prk = hmac(salt, ikm);
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);
}

/**
 * Whether push is configured, and what is missing if not.
 *
 * Three states. `setup_required` means an owner has not generated VAPID keys;
 * `unavailable` means something it needs cannot be read. A page showing the
 * same message for both sends somebody to configure what is already configured.
 */
function pushReadiness(deps) {
  const getEnv = deps?.getEnv;
  if (typeof getEnv !== "function") {
    return { ok: false, status: "unavailable", detail: "No environment reader was supplied to this module." };
  }
  const publicKey = getEnv("VAPID_PUBLIC_KEY");
  const privateKey = getEnv("VAPID_PRIVATE_KEY");
  const subject = getEnv("VAPID_SUBJECT");
  const missing = [];
  if (!publicKey) missing.push("VAPID_PUBLIC_KEY");
  if (!privateKey) missing.push("VAPID_PRIVATE_KEY");
  // RFC 8292 requires `sub` to be a mailto: or https: URI. A push service will
  // reject the token without it, and the rejection is opaque -- so it is
  // checked here where the message can name the cause.
  if (!subject) missing.push("VAPID_SUBJECT");
  if (missing.length) {
    return {
      ok: false,
      status: "setup_required",
      missing,
      detail: `Push notifications are off. Generate a VAPID key pair and set ${missing.join(", ")}.`
    };
  }
  if (!/^(mailto:|https:\/\/)/.test(String(subject))) {
    return {
      ok: false,
      status: "unavailable",
      detail: "VAPID_SUBJECT must be a mailto: or https: URI. A push service rejects the token otherwise, and says nothing useful about why."
    };
  }
  return { ok: true, status: "configured", publicKey: String(publicKey) };
}

/**
 * A P-256 key pair, ready to be pasted into the environment.
 *
 * Here rather than in a script so the format cannot drift from what the sender
 * expects: whatever produces the keys and whatever reads them share one
 * definition of the encoding.
 */
function generateVapidKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const raw = publicKey.export({ type: "spki", format: "der" });
  // The uncompressed point is the last 65 bytes of the SPKI encoding.
  const point = raw.subarray(raw.length - PUBLIC_KEY_BYTES);
  const d = privateKey.export({ format: "jwk" }).d;
  return { publicKey: b64url(point), privateKey: d };
}

function privateKeyObject(d) {
  const bytes = fromB64url(d);
  if (bytes.length !== 32) return null;
  // Derived rather than stored: a JWK private key needs its public coordinates,
  // and computing them is what proves the private scalar is usable at all.
  const point = crypto.createPublicKey({
    key: { kty: "EC", crv: "P-256", d: b64url(bytes), x: "", y: "" },
    format: "jwk"
  });
  return point;
}

/**
 * The `Authorization` header a push service wants.
 *
 * `aud` is the *origin* of the endpoint, not the endpoint. Sending the full URL
 * is the mistake that produces a 401 the push service does not explain.
 */
function vapidHeaders(deps, endpoint, { now = Date.now(), expiresInSeconds = VAPID_MAX_SECONDS } = {}) {
  const readiness = pushReadiness(deps);
  if (!readiness.ok) return { ok: false, code: readiness.status, detail: readiness.detail };

  let audience;
  try {
    audience = new URL(endpoint).origin;
  } catch {
    return { ok: false, code: "bad_endpoint", detail: "The push endpoint is not a URL." };
  }
  if (expiresInSeconds > VAPID_MAX_SECONDS) {
    return { ok: false, code: "expiry_too_long", detail: `A push service refuses a token valid for more than 24 hours; ${VAPID_MAX_SECONDS} seconds is the limit used here.` };
  }

  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64url(JSON.stringify({
    aud: audience,
    exp: Math.floor(now / 1000) + expiresInSeconds,
    sub: String(deps.getEnv("VAPID_SUBJECT"))
  }));
  const signingInput = `${header}.${body}`;

  let key;
  try {
    const d = fromB64url(deps.getEnv("VAPID_PRIVATE_KEY"));
    if (d.length !== 32) return { ok: false, code: "bad_private_key", detail: "VAPID_PRIVATE_KEY is not a 32-byte P-256 scalar." };
    const publicPoint = fromB64url(deps.getEnv("VAPID_PUBLIC_KEY"));
    if (publicPoint.length !== PUBLIC_KEY_BYTES || publicPoint[0] !== 4) {
      return { ok: false, code: "bad_public_key", detail: "VAPID_PUBLIC_KEY is not an uncompressed P-256 point." };
    }
    key = crypto.createPrivateKey({
      key: {
        kty: "EC",
        crv: "P-256",
        d: b64url(d),
        x: b64url(publicPoint.subarray(1, 33)),
        y: b64url(publicPoint.subarray(33, 65))
      },
      format: "jwk"
    });
  } catch (error) {
    return { ok: false, code: "bad_key", detail: `The VAPID key pair could not be read: ${error.message}` };
  }

  // `dsaEncoding: "ieee-p1363"` is the raw r||s form JWT requires. Node's
  // default is DER, which a push service rejects -- and the rejection is a bare
  // 401 with no indication that the signature format is the problem.
  const signature = crypto.sign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });

  return {
    ok: true,
    headers: {
      Authorization: `vapid t=${signingInput}.${b64url(signature)}, k=${deps.getEnv("VAPID_PUBLIC_KEY")}`
    }
  };
}

/**
 * Encrypt one payload, RFC 8291, `aes128gcm`.
 *
 * `salt` and `serverKeys` are parameters only so the RFC's test vector can be
 * reproduced exactly. In every real call they are omitted and generated here --
 * a caller that supplied a fixed salt in production would be reusing a nonce
 * across messages, which is the one mistake AES-GCM does not survive.
 */
function encrypt(payload, { p256dh, auth }, { salt, serverKeys } = {}) {
  const plaintext = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), "utf8");

  const clientPublic = fromB64url(p256dh);
  if (clientPublic.length !== PUBLIC_KEY_BYTES || clientPublic[0] !== 4) {
    return { ok: false, code: "bad_subscription_key", detail: "The subscription's p256dh is not an uncompressed P-256 point." };
  }
  const authSecret = fromB64url(auth);
  if (authSecret.length !== AUTH_SECRET_BYTES) {
    return { ok: false, code: "bad_auth_secret", detail: "The subscription's auth secret is not 16 bytes." };
  }

  // One record only. The header, the key and the GCM tag all come out of the
  // record budget, and a payload that does not fit has to be refused rather
  // than cut short: a truncated notification is a wrong notification.
  const overhead = 16 + 4 + 1 + PUBLIC_KEY_BYTES + 1 + 16;
  if (plaintext.length + overhead > RECORD_SIZE) {
    return { ok: false, code: "payload_too_large", detail: `A push payload must fit one ${RECORD_SIZE}-byte record; this one needs ${plaintext.length + overhead}.` };
  }

  const recordSalt = salt ? Buffer.from(salt) : crypto.randomBytes(16);
  const server = serverKeys || crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const serverPublicDer = server.publicKey.export({ type: "spki", format: "der" });
  const serverPublic = serverPublicDer.subarray(serverPublicDer.length - PUBLIC_KEY_BYTES);

  const clientKeyObject = crypto.createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: b64url(clientPublic.subarray(1, 33)),
      y: b64url(clientPublic.subarray(33, 65))
    },
    format: "jwk"
  });

  const ecdhSecret = crypto.diffieHellman({ privateKey: server.privateKey, publicKey: clientKeyObject });

  // RFC 8291 §3.3. The key_info binds both public keys into the derivation, so
  // a message encrypted for one subscriber cannot be replayed at another.
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    clientPublic,
    serverPublic
  ]);
  const ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const cek = hkdf(recordSalt, ikm, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdf(recordSalt, ikm, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);

  // 0x02 marks the last record. 0x01 would mean another follows, and a receiver
  // that sees it waits for one that never arrives.
  const padded = Buffer.concat([plaintext, Buffer.from([2])]);

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);

  const recordSizeField = Buffer.alloc(4);
  recordSizeField.writeUInt32BE(RECORD_SIZE, 0);

  const body = Buffer.concat([
    recordSalt,
    recordSizeField,
    Buffer.from([serverPublic.length]),
    serverPublic,
    ciphertext
  ]);

  return { ok: true, body, salt: recordSalt, serverPublic };
}

/**
 * Send one notification.
 *
 * Returns a reason code on every refusal. Two of the push service's own
 * statuses are carried through distinctly, because they mean different things
 * to the caller: **404 and 410 mean the subscription is dead** and the row
 * should be deleted, while a 429 or a 5xx means try later. Treating them alike
 * either keeps sending to a browser that is gone for ever, or deletes a live
 * subscription because a push service had a bad minute.
 */
async function send(deps, subscription, payload, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const readiness = pushReadiness(deps);
  if (!readiness.ok) return { ok: false, code: readiness.status, detail: readiness.detail };

  const endpoint = subscription?.endpoint;
  if (!endpoint || !/^https:\/\//.test(String(endpoint))) {
    return { ok: false, code: "bad_endpoint", detail: "A push endpoint must be an https URL." };
  }

  const encrypted = encrypt(payload, { p256dh: subscription.p256dh, auth: subscription.auth });
  if (!encrypted.ok) return encrypted;

  const vapid = vapidHeaders(deps, endpoint, options);
  if (!vapid.ok) return vapid;

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        ...vapid.headers,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(options.ttlSeconds ?? 3600)
      },
      body: encrypted.body
    });
  } catch {
    return { ok: false, code: "unreachable", detail: "The push service could not be reached. The subscription is not necessarily gone." };
  }

  const status = response?.status ?? 0;
  if (status === 404 || status === 410) {
    return { ok: false, code: "subscription_gone", status, detail: "The push service says this subscription no longer exists. Delete the row." };
  }
  if (status === 429 || status >= 500) {
    return { ok: false, code: "retry_later", status, detail: "The push service is refusing right now. The subscription is still good." };
  }
  if (!response?.ok) {
    // The body is not carried through: a rejection can quote the Authorization
    // header back, which contains the VAPID token.
    return { ok: false, code: "refused", status, detail: "The push service refused the message." };
  }
  return { ok: true, status };
}

module.exports = {
  REQUIRED,
  RECORD_SIZE,
  VAPID_MAX_SECONDS,
  b64url,
  fromB64url,
  hkdf,
  pushReadiness,
  generateVapidKeys,
  privateKeyObject,
  vapidHeaders,
  encrypt,
  send
};
