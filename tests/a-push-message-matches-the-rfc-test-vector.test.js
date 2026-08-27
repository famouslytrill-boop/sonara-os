"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const push = require("../lib/sonara-web-push.cjs");

// RFC 8291 section 5 and appendix A. Every value here is copied from the RFC,
// not computed by this repository, which is the whole point: an implementation
// checked against its own output is checked against its own misunderstanding.
//
// https://www.rfc-editor.org/rfc/rfc8291.txt
const RFC = Object.freeze({
  plaintext: "When I grow up, I want to be a watermelon",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  receiverPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  receiverPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  senderPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  senderPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  // Appendix A intermediate values, each asserted on its own so a failure names
  // the step rather than only that the ciphertext differs.
  ecdhSecret: "kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs",
  ikm: "S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg",
  cek: "oIhVW04MRdy2XN9CiKLxTg",
  nonce: "4h_95klXJ5E_qnoN",
  // Section 5, with the presentation line wrapping removed.
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
    "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
    "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
});

// Rebuild the RFC's sender key pair as node key objects, so `encrypt` can be
// driven with exactly the RFC's inputs rather than a random pair.
function senderKeys() {
  const point = push.fromB64url(RFC.senderPublic);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: RFC.senderPrivate,
    x: push.b64url(point.subarray(1, 33)),
    y: push.b64url(point.subarray(33, 65))
  };
  return {
    privateKey: crypto.createPrivateKey({ key: jwk, format: "jwk" }),
    publicKey: crypto.createPublicKey({ key: { ...jwk, d: undefined }, format: "jwk" })
  };
}

describe("push message encryption", () => {
  describe("against RFC 8291's own test vector", () => {
    it("derives the shared secret the RFC publishes", () => {
      const point = push.fromB64url(RFC.receiverPublic);
      const receiverPublic = crypto.createPublicKey({
        key: { kty: "EC", crv: "P-256", x: push.b64url(point.subarray(1, 33)), y: push.b64url(point.subarray(33, 65)) },
        format: "jwk"
      });
      const secret = crypto.diffieHellman({ privateKey: senderKeys().privateKey, publicKey: receiverPublic });
      assert.equal(push.b64url(secret), RFC.ecdhSecret);
    });

    it("derives the input keying material the RFC publishes", () => {
      const point = push.fromB64url(RFC.receiverPublic);
      const receiverPublic = crypto.createPublicKey({
        key: { kty: "EC", crv: "P-256", x: push.b64url(point.subarray(1, 33)), y: push.b64url(point.subarray(33, 65)) },
        format: "jwk"
      });
      const ecdh = crypto.diffieHellman({ privateKey: senderKeys().privateKey, publicKey: receiverPublic });
      const keyInfo = Buffer.concat([
        Buffer.from("WebPush: info\0", "utf8"),
        push.fromB64url(RFC.receiverPublic),
        push.fromB64url(RFC.senderPublic)
      ]);
      const ikm = push.hkdf(push.fromB64url(RFC.authSecret), ecdh, keyInfo, 32);
      assert.equal(push.b64url(ikm), RFC.ikm);
    });

    it("derives the content encryption key and nonce the RFC publishes", () => {
      const ikm = push.fromB64url(RFC.ikm);
      const salt = push.fromB64url(RFC.salt);
      const cek = push.hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
      const nonce = push.hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);
      assert.equal(push.b64url(cek), RFC.cek);
      assert.equal(push.b64url(nonce), RFC.nonce);
    });

    // The one that settles it. Same keys, same salt, same plaintext, and the
    // bytes have to match the RFC's published ciphertext exactly.
    it("produces the exact body the RFC publishes", () => {
      const result = push.encrypt(
        RFC.plaintext,
        { p256dh: RFC.receiverPublic, auth: RFC.authSecret },
        { salt: push.fromB64url(RFC.salt), serverKeys: senderKeys() }
      );
      assert.equal(result.ok, true);
      assert.equal(push.b64url(result.body), RFC.body);
    });
  });

  describe("what it refuses", () => {
    it("refuses a subscription key that is not an uncompressed P-256 point", () => {
      const result = push.encrypt("hello", { p256dh: push.b64url(Buffer.alloc(65)), auth: RFC.authSecret });
      assert.equal(result.ok, false);
      assert.equal(result.code, "bad_subscription_key");
    });

    it("refuses an auth secret that is not sixteen bytes", () => {
      const result = push.encrypt("hello", { p256dh: RFC.receiverPublic, auth: push.b64url(Buffer.alloc(8)) });
      assert.equal(result.code, "bad_auth_secret");
    });

    it("refuses a payload too large for one record rather than truncating it", () => {
      // A truncated notification is a wrong notification, and it is the failure
      // a customer sees rather than the operator.
      const result = push.encrypt(Buffer.alloc(5000), { p256dh: RFC.receiverPublic, auth: RFC.authSecret });
      assert.equal(result.code, "payload_too_large");
    });

    it("marks the record as the last one", () => {
      // 0x02 is the final-record delimiter. 0x01 means another follows, and a
      // receiver that sees it waits for one that never arrives.
      const result = push.encrypt("x", { p256dh: RFC.receiverPublic, auth: RFC.authSecret });
      assert.equal(result.ok, true);
      // Decrypt it back with the receiver's private key to read the delimiter.
      const point = push.fromB64url(RFC.receiverPublic);
      const receiverPrivate = crypto.createPrivateKey({
        key: {
          kty: "EC", crv: "P-256", d: RFC.receiverPrivate,
          x: push.b64url(point.subarray(1, 33)), y: push.b64url(point.subarray(33, 65))
        },
        format: "jwk"
      });
      const salt = result.body.subarray(0, 16);
      const serverPublic = result.body.subarray(21, 21 + 65);
      const ciphertext = result.body.subarray(21 + 65);
      const serverKey = crypto.createPublicKey({
        key: { kty: "EC", crv: "P-256", x: push.b64url(serverPublic.subarray(1, 33)), y: push.b64url(serverPublic.subarray(33, 65)) },
        format: "jwk"
      });
      const ecdh = crypto.diffieHellman({ privateKey: receiverPrivate, publicKey: serverKey });
      const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0", "utf8"), point, serverPublic]);
      const ikm = push.hkdf(push.fromB64url(RFC.authSecret), ecdh, keyInfo, 32);
      const cek = push.hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
      const nonce = push.hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);
      const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
      decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
      const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
      assert.equal(plain[plain.length - 1], 2);
      assert.equal(plain.subarray(0, plain.length - 1).toString("utf8"), "x");
    });

    it("uses a different salt and key pair every time", () => {
      // A reused salt means a reused nonce with the same key, which is the one
      // mistake AES-GCM does not survive.
      const one = push.encrypt("same", { p256dh: RFC.receiverPublic, auth: RFC.authSecret });
      const two = push.encrypt("same", { p256dh: RFC.receiverPublic, auth: RFC.authSecret });
      assert.notEqual(one.salt.toString("hex"), two.salt.toString("hex"));
      assert.notEqual(one.serverPublic.toString("hex"), two.serverPublic.toString("hex"));
      assert.notEqual(one.body.toString("hex"), two.body.toString("hex"));
    });
  });
});

describe("VAPID", () => {
  function deps(env) {
    return { getEnv: (name) => env[name] };
  }

  const KEYS = push.generateVapidKeys();
  const CONFIGURED = {
    VAPID_PUBLIC_KEY: KEYS.publicKey,
    VAPID_PRIVATE_KEY: KEYS.privateKey,
    VAPID_SUBJECT: "mailto:owner@example.com"
  };

  it("generates a key pair this module can then use", () => {
    // The generator and the signer share one definition of the encoding, so
    // this asserts they actually agree rather than that each looks plausible.
    const point = push.fromB64url(KEYS.publicKey);
    assert.equal(point.length, 65);
    assert.equal(point[0], 4);
    assert.equal(push.fromB64url(KEYS.privateKey).length, 32);
  });

  it("is off until an owner configures it", () => {
    const readiness = push.pushReadiness(deps({}));
    assert.equal(readiness.ok, false);
    assert.equal(readiness.status, "setup_required");
    assert.deepEqual(readiness.missing, ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]);
  });

  it("separates 'not configured' from 'configured wrongly'", () => {
    const wrong = push.pushReadiness(deps({ ...CONFIGURED, VAPID_SUBJECT: "owner@example.com" }));
    assert.equal(wrong.status, "unavailable");
    assert.notEqual(wrong.status, "setup_required");
  });

  it("signs a token whose audience is the endpoint's origin, not the endpoint", () => {
    // Sending the full URL is the mistake that produces a 401 the push service
    // does not explain.
    const result = push.vapidHeaders(deps(CONFIGURED), "https://fcm.googleapis.com/fcm/send/abc123");
    assert.equal(result.ok, true);
    const token = result.headers.Authorization.match(/t=([^,]+)/)[1];
    const claims = JSON.parse(push.fromB64url(token.split(".")[1]).toString("utf8"));
    assert.equal(claims.aud, "https://fcm.googleapis.com");
    assert.equal(claims.sub, "mailto:owner@example.com");
  });

  it("produces a signature a verifier accepts, in the raw form JWT requires", () => {
    // Node signs DER by default and a push service rejects that with a bare
    // 401. Verifying with ieee-p1363 is what proves the encoding is right.
    const result = push.vapidHeaders(deps(CONFIGURED), "https://push.example.net/x");
    const token = result.headers.Authorization.match(/t=([^,]+)/)[1];
    const [header, body, signature] = token.split(".");
    const point = push.fromB64url(CONFIGURED.VAPID_PUBLIC_KEY);
    const publicKey = crypto.createPublicKey({
      key: { kty: "EC", crv: "P-256", x: push.b64url(point.subarray(1, 33)), y: push.b64url(point.subarray(33, 65)) },
      format: "jwk"
    });
    const verified = crypto.verify(
      "sha256",
      Buffer.from(`${header}.${body}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      push.fromB64url(signature)
    );
    assert.equal(verified, true);
  });

  it("refuses an expiry longer than a push service will accept", () => {
    const result = push.vapidHeaders(deps(CONFIGURED), "https://push.example.net/x", { expiresInSeconds: 60 * 60 * 48 });
    assert.equal(result.code, "expiry_too_long");
  });
});

describe("sending", () => {
  const KEYS = push.generateVapidKeys();
  const deps = {
    getEnv: (name) => ({
      VAPID_PUBLIC_KEY: KEYS.publicKey,
      VAPID_PRIVATE_KEY: KEYS.privateKey,
      VAPID_SUBJECT: "mailto:owner@example.com"
    })[name]
  };
  const subscription = {
    endpoint: "https://push.example.net/send/abc",
    p256dh: RFC.receiverPublic,
    auth: RFC.authSecret
  };

  it("does not send when push is not configured", async () => {
    const result = await push.send({ getEnv: () => undefined }, subscription, "hello", {
      fetchImpl: async () => { throw new Error("should not have been called"); }
    });
    assert.equal(result.code, "setup_required");
  });

  // The distinction that decides whether a row is deleted. Getting it wrong
  // either keeps sending to a browser that is gone for ever, or deletes a live
  // subscription because a push service had a bad minute.
  it("separates a dead subscription from a push service having a bad minute", async () => {
    for (const status of [404, 410]) {
      const result = await push.send(deps, subscription, "x", { fetchImpl: async () => ({ ok: false, status }) });
      assert.equal(result.code, "subscription_gone", `${status} should mean the subscription is gone`);
    }
    for (const status of [429, 500, 503]) {
      const result = await push.send(deps, subscription, "x", { fetchImpl: async () => ({ ok: false, status }) });
      assert.equal(result.code, "retry_later", `${status} should mean try again`);
    }
  });

  it("does not report an unreachable push service as a dead subscription", async () => {
    const result = await push.send(deps, subscription, "x", {
      fetchImpl: async () => { throw new Error("network down"); }
    });
    assert.equal(result.code, "unreachable");
    assert.notEqual(result.code, "subscription_gone");
  });

  it("never carries the push service's rejection body through", async () => {
    // A rejection can quote the Authorization header back, and that header
    // contains the VAPID token.
    const result = await push.send(deps, subscription, "x", {
      fetchImpl: async () => ({ ok: false, status: 400, text: async () => "bad token vapid t=SECRETTOKEN" })
    });
    assert.equal(result.code, "refused");
    assert.equal(JSON.stringify(result).includes("SECRETTOKEN"), false);
  });

  it("sends the headers the protocol requires", async () => {
    let seen = null;
    await push.send(deps, subscription, "hello", {
      fetchImpl: async (url, options) => { seen = { url, options }; return { ok: true, status: 201 }; }
    });
    assert.equal(seen.url, subscription.endpoint);
    assert.equal(seen.options.headers["Content-Encoding"], "aes128gcm");
    assert.match(seen.options.headers.Authorization, /^vapid t=.+, k=.+$/);
    assert.ok(Buffer.isBuffer(seen.options.body));
  });

  it("refuses an endpoint that is not https", async () => {
    const result = await push.send(deps, { ...subscription, endpoint: "http://push.example.net/x" }, "x", {
      fetchImpl: async () => { throw new Error("should not have been called"); }
    });
    assert.equal(result.code, "bad_endpoint");
  });
});
