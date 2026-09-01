"use strict";

// A second factor is worth exactly as much as its arithmetic is correct, and
// the arithmetic has a published answer.
//
// RFC 4226 Appendix D and RFC 6238 Appendix B print the codes their algorithms
// produce for known secrets at known counters. Those numbers are the reason
// this project implements HOTP and TOTP rather than taking a dependency: an
// implementation that is subtly wrong cannot pass this file, and one that
// passes it agrees with every authenticator app in the world.
//
// The vectors are transcribed from the RFCs below. They are not values this
// implementation produced and then had written down after it — that would be a
// test asserting that the code does what the code does, which is the shape of
// check this repository is organised against. Two independent facts make the
// transcription checkable: an implementation with any of the classic errors
// fails many rows at once (the probes in docs/SPRINT_LOG.md list them), and the
// SHA-256 and SHA-512 rows come out right only if the truncation offset is read
// from the last byte of the digest rather than the twentieth.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const otp = require("../lib/sonara-otp.cjs");
const base32 = require("../lib/sonara-base32.cjs");
const enrolment = require("../lib/sonara-otp-enrolment.cjs");
const secretBox = require("../lib/sonara-secret-box.cjs");

// RFC 4226 Appendix D. Secret is the ASCII string "12345678901234567890".
const HOTP_SECRET = Buffer.from("12345678901234567890", "ascii");
const HOTP_VECTORS = [
  [0, "755224"], [1, "287082"], [2, "359152"], [3, "969429"], [4, "338314"],
  [5, "254676"], [6, "287922"], [7, "162583"], [8, "399871"], [9, "520489"]
];

// RFC 6238 Appendix B. Each algorithm uses a seed as long as its own hash
// needs: 20, 32 and 64 ASCII bytes of the repeating "1234567890".
const TOTP_SEEDS = {
  sha1: Buffer.from("12345678901234567890", "ascii"),
  sha256: Buffer.from("12345678901234567890123456789012", "ascii"),
  sha512: Buffer.from("1234567890123456789012345678901234567890123456789012345678901234", "ascii")
};
const TOTP_VECTORS = [
  [59, { sha1: "94287082", sha256: "46119246", sha512: "90693936" }],
  [1111111109, { sha1: "07081804", sha256: "68084774", sha512: "25091201" }],
  [1111111111, { sha1: "14050471", sha256: "67062674", sha512: "99943326" }],
  [1234567890, { sha1: "89005924", sha256: "91819424", sha512: "93441116" }],
  [2000000000, { sha1: "69279037", sha256: "90698825", sha512: "38618901" }],
  [20000000000, { sha1: "65353130", sha256: "77737706", sha512: "47863826" }]
];

// RFC 4648 section 10.
const BASE32_VECTORS = [
  ["", ""], ["f", "MY======"], ["fo", "MZXQ===="], ["foo", "MZXW6==="],
  ["foob", "MZXW6YQ="], ["fooba", "MZXW6YTB"], ["foobar", "MZXW6YTBOI======"]
];

const KEY = () => secretBox.keyFrom(() => "0123456789abcdef0123456789abcdef0123456789abcdef");

describe("a one-time password matches the RFC", () => {
  it("has vectors to check, so this is not passing on an empty list", () => {
    assert.equal(HOTP_VECTORS.length, 10, "RFC 4226 Appendix D has ten counters");
    assert.equal(TOTP_VECTORS.length, 6, "RFC 6238 Appendix B has six times");
    assert.equal(BASE32_VECTORS.length, 7, "RFC 4648 section 10 has seven strings");
  });

  it("produces RFC 4226 Appendix D for every counter", () => {
    for (const [counter, expected] of HOTP_VECTORS) {
      assert.equal(otp.hotp(HOTP_SECRET, counter), expected, `HOTP at counter ${counter}`);
    }
  });

  it("produces RFC 6238 Appendix B for every time and every algorithm", () => {
    let checked = 0;
    for (const [time, byAlgorithm] of TOTP_VECTORS) {
      for (const [algorithm, expected] of Object.entries(byAlgorithm)) {
        assert.equal(
          otp.totp(TOTP_SEEDS[algorithm], { at: time, digits: 8, algorithm }),
          expected,
          `TOTP at T=${time} with ${algorithm}`
        );
        checked += 1;
      }
    }
    // The SHA-256 and SHA-512 rows are the ones that catch an offset read from
    // byte 19 rather than from the last byte, so a run that skipped them would
    // miss the error this loop exists for.
    assert.equal(checked, 18, `only ${checked} vectors checked; this check has gone blind`);
  });

  it("counts the way RFC 4226 says, eight bytes big-endian", () => {
    assert.equal(otp.counterBytes(0).toString("hex"), "0000000000000000");
    assert.equal(otp.counterBytes(1).toString("hex"), "0000000000000001");
    // RFC 6238 Appendix B prints these three T values in hex beside the codes.
    assert.equal(otp.counterBytes(0x23523ec).toString("hex"), "00000000023523ec");
    assert.equal(otp.counterBytes(0x273ef07).toString("hex"), "000000000273ef07");
    assert.equal(otp.counterBytes(0x3f940aa).toString("hex"), "0000000003f940aa");
  });

  it("turns a clock into the counter RFC 6238 specifies", () => {
    assert.equal(otp.stepAt(0), 0);
    assert.equal(otp.stepAt(29), 0);
    assert.equal(otp.stepAt(30), 1);
    assert.equal(otp.stepAt(59), 1, "RFC 6238 Appendix B says T=1 at 59 seconds");
    assert.equal(otp.stepAt(1111111109), 0x23523ec, "the hex the RFC prints for that row");
  });

  it("round-trips base32 against RFC 4648 section 10", () => {
    for (const [plain, encoded] of BASE32_VECTORS) {
      assert.equal(base32.encode(Buffer.from(plain)), encoded, `encoding ${JSON.stringify(plain)}`);
      if (!plain) continue;
      assert.equal(base32.decode(encoded).bytes.toString(), plain, `decoding ${encoded}`);
    }
    // A secret is typed by hand off a screen when a camera is not available.
    assert.equal(base32.decode("mzxw6ytboi").bytes.toString(), "foobar", "lowercase refused");
    assert.equal(base32.decode("MZXW 6YTB OI").bytes.toString(), "foobar", "spaces refused");
    assert.equal(base32.decode("MZXW6YTB!").ok, false, "a character outside the alphabet was accepted");
    assert.equal(base32.decode("").ok, false, "an empty secret was accepted");
  });

  describe("verifying a submitted code", () => {
    const secret = HOTP_SECRET;
    // T=1111111109 is one of the RFC's own rows, so the code below is a value
    // the specification prints rather than one this implementation chose.
    const at = 1111111109;
    const step = otp.stepAt(at);
    const code = otp.totp(secret, { at });

    it("accepts the code for the step the clock is in", () => {
      assert.deepEqual(otp.verify(secret, code, { at }), { ok: true, step });
    });

    it("accepts one step either side, because clocks drift", () => {
      // RFC 6238 section 5.2: a validator should allow a transmission delay of
      // one time step. Somebody who takes four seconds to type a code that
      // appeared at second 28 is not wrong.
      assert.equal(otp.verify(secret, code, { at: at + 30 }).ok, true, "a code from the previous step was refused");
      assert.equal(otp.verify(secret, code, { at: at - 30 }).ok, true, "a code from the next step was refused");
    });

    it("refuses two steps away", () => {
      // Exactly two, not three. The first version of this used +/-90 seconds --
      // three steps -- and so stayed green when the window was widened from one
      // step to two, which is the change it exists to catch. Every extra step
      // is another thirty seconds an intercepted code stays usable, so the
      // boundary is the thing to assert.
      assert.equal(otp.stepAt(at + 60) - otp.stepAt(at), 2, "this test is not measuring two steps");
      assert.equal(otp.verify(secret, code, { at: at + 60 }).ok, false, "a code two steps old was accepted");
      assert.equal(otp.verify(secret, code, { at: at - 60 }).ok, false, "a code two steps early was accepted");
    });

    it("refuses a code that has already been used", () => {
      // RFC 6238 section 5.2, and the reason it matters: without this a code
      // read over somebody's shoulder or out of a screenshot is good for the
      // rest of its thirty seconds.
      const first = otp.verify(secret, code, { at });
      assert.equal(first.ok, true);
      const again = otp.verify(secret, code, { at, lastUsedStep: first.step });
      assert.equal(again.ok, false);
      assert.equal(again.code, "reused", "a spent code was reported as simply wrong");
    });

    it("refuses an earlier step inside the window as well", () => {
      // A code from the step before the one already spent is just as spent.
      const previous = otp.totp(secret, { at: at - 30 });
      const answer = otp.verify(secret, previous, { at, lastUsedStep: step });
      assert.equal(answer.ok, false);
      assert.equal(answer.code, "reused");
    });

    it("tells a typo apart from a spent code apart from a wrong shape", () => {
      assert.equal(otp.verify(secret, "12345", { at }).code, "malformed");
      assert.equal(otp.verify(secret, "abcdef", { at }).code, "malformed");
      assert.equal(otp.verify(secret, "", { at }).code, "malformed");
      assert.equal(otp.verify(secret, "000000", { at }).code, "no_match");
    });

    it("accepts a code typed with the spaces people put in it", () => {
      const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
      assert.equal(otp.verify(secret, spaced, { at }).ok, true);
    });
  });

  describe("the enrolment a phone can actually read", () => {
    it("builds a URI whose secret decodes back to the one stored", () => {
      const made = enrolment.newEnrolment({ account: "ada@example.com" });
      const inUri = /[?&]secret=([A-Z2-7]+)/.exec(made.uri);
      assert.ok(inUri, `no secret parameter in ${made.uri}`);
      assert.ok(base32.decode(inUri[1]).bytes.equals(made.secret), "the app would be given a different secret from the one stored");
    });

    it("escapes the label, so a colon in a name cannot split it", () => {
      const uri = enrolment.provisioningUri({ secret: Buffer.alloc(20), account: "a:b@example.com" });
      const path = uri.slice("otpauth://totp/".length, uri.indexOf("?"));
      assert.equal(path.split(":").length, 2, `the label has more than one separator: ${path}`);
      assert.match(uri, /issuer=SONARA%20One/, "the issuer parameter is missing");
    });

    it("stays on the defaults every authenticator agrees on", () => {
      const uri = enrolment.provisioningUri({ secret: Buffer.alloc(20), account: "ada@example.com" });
      // Several widely used apps ignore these parameters and compute SHA-1,
      // six digits, thirty seconds whatever the URI says. Sending a non-default
      // value they ignore is a factor that never matches, with nothing on
      // either side reporting a problem.
      for (const parameter of ["algorithm=", "digits=", "period="]) {
        assert.ok(!uri.includes(parameter), `the URI sends ${parameter}, which some apps ignore`);
      }
      assert.equal(otp.DEFAULT_DIGITS, 6);
      assert.equal(otp.DEFAULT_STEP_SECONDS, 30);
    });

    it("gives a secret somebody can read off a screen", () => {
      const made = enrolment.newEnrolment({ account: "ada@example.com" });
      assert.match(made.readableSecret, /^([A-Z2-7]{4} )+[A-Z2-7]{1,4}$/);
      assert.ok(base32.decode(made.readableSecret).bytes.equals(made.secret), "the readable form decodes to a different secret");
    });

    it("makes a secret at least as long as RFC 4226 requires", () => {
      // Section 4, R6: the shared secret must be at least 128 bits, and the RFC
      // recommends 160.
      assert.ok(otp.newSecret().length >= 20, "the shared secret is shorter than the RFC allows");
    });
  });

  describe("recovery codes", () => {
    const pepper = secretBox.pepper(KEY());

    it("uses no character somebody could misread", () => {
      // The first version of this drew from the base32 alphabet with a comment
      // claiming the confusable characters were not in it. Base32 is A-Z plus
      // 2-7: it has no 0, 1, 8 or 9, but O, I and L are all there.
      for (const character of "ILOU01") {
        assert.ok(!enrolment.RECOVERY_ALPHABET.includes(character), `${character} is still in the recovery alphabet`);
      }
      for (const code of enrolment.newRecoveryCodes()) {
        assert.match(code.replace(/-/g, ""), /^[ABCDEFGHJKMNPQRSTVWXYZ234567]+$/, code);
      }
    });

    it("makes codes long enough that the hash's speed does not matter", () => {
      const codes = enrolment.newRecoveryCodes();
      assert.equal(codes.length, enrolment.RECOVERY_CODE_COUNT);
      const characters = codes[0].replace(/-/g, "").length;
      const bits = characters * Math.log2(enrolment.RECOVERY_ALPHABET.length);
      assert.ok(bits >= 90, `a recovery code carries only ${bits.toFixed(1)} bits`);
    });

    it("makes a different set every time", () => {
      const first = enrolment.newRecoveryCodes();
      const second = enrolment.newRecoveryCodes();
      assert.equal(new Set([...first, ...second]).size, first.length + second.length, "two draws produced a repeat");
    });

    it("matches however somebody types it", () => {
      const codes = enrolment.newRecoveryCodes();
      const stored = codes.map((code) => {
        const made = enrolment.hashRecoveryCode(code, { pepper });
        return { salt: made.salt, hash: made.hash, usedAt: null };
      });
      assert.deepEqual(enrolment.matchRecoveryCode(codes[4], stored, pepper), { ok: true, index: 4 });
      assert.deepEqual(enrolment.matchRecoveryCode(codes[4].toLowerCase(), stored, pepper), { ok: true, index: 4 });
      assert.deepEqual(enrolment.matchRecoveryCode(codes[4].replace(/-/g, " "), stored, pepper), { ok: true, index: 4 });
    });

    it("refuses a code that has been spent, and says so", () => {
      const codes = enrolment.newRecoveryCodes();
      const stored = codes.map((code) => {
        const made = enrolment.hashRecoveryCode(code, { pepper });
        return { salt: made.salt, hash: made.hash, usedAt: null };
      });
      stored[2].usedAt = "2026-09-01T00:00:00Z";
      const answer = enrolment.matchRecoveryCode(codes[2], stored, pepper);
      assert.equal(answer.ok, false);
      assert.equal(answer.code, "already_used");
    });

    it("stores nothing that looks like the code it was shown", () => {
      const codes = enrolment.newRecoveryCodes();
      const made = enrolment.hashRecoveryCode(codes[0], { pepper });
      const normalized = enrolment.normalizeRecoveryCode(codes[0]);
      assert.ok(!made.hash.includes(normalized), "the stored hash contains the code");
      assert.ok(!made.salt.includes(normalized), "the salt contains the code");
    });

    it("refuses to hash or match without the pepper", () => {
      // The pepper is the whole reason this is not a bare digest: it lives in
      // the environment, so a database read on its own gets nothing usable.
      // Hashing without one quietly would remove that property and leave every
      // assertion above still passing.
      const codes = enrolment.newRecoveryCodes();
      assert.equal(enrolment.hashRecoveryCode(codes[0], {}).ok, false);
      assert.equal(enrolment.hashRecoveryCode(codes[0], { pepper: Buffer.alloc(0) }).code, "no_pepper");
      assert.equal(enrolment.matchRecoveryCode(codes[0], [{ salt: "a", hash: "b" }]).code, "no_pepper");
    });

    it("gives a different hash under a different pepper", () => {
      const other = secretBox.pepper(secretBox.keyFrom(() => "ffffffffffffffffffffffffffffffffffffffffffffffff"));
      const code = enrolment.newRecoveryCodes()[0];
      const salt = "0123456789abcdef";
      assert.notEqual(
        enrolment.hashRecoveryCode(code, { salt, pepper }).hash,
        enrolment.hashRecoveryCode(code, { salt, pepper: other }).hash
      );
    });
  });

  describe("the key the secrets are sealed with", () => {
    it("refuses to run rather than storing a secret in the clear", () => {
      // A second factor that silently stores its secrets unencrypted because a
      // variable was missing is worse than one that will not turn on: the first
      // tells everybody they are protected.
      assert.equal(secretBox.keyFrom(() => "").code, "setup_required");
      assert.equal(secretBox.keyFrom(() => undefined).code, "setup_required");
      assert.equal(secretBox.keyFrom(() => "too-short").code, "key_too_short");
      assert.equal(secretBox.keyFrom(() => "a".repeat(secretBox.MINIMUM_KEY_LENGTH)).ok, true);
    });

    it("seals a secret so the stored value does not contain it", () => {
      const secret = otp.newSecret();
      const sealed = secretBox.seal(secret, KEY());
      for (const encoding of ["hex", "base64", "base64url", "utf8"]) {
        assert.ok(!sealed.includes(secret.toString(encoding)), `the sealed value contains the secret as ${encoding}`);
      }
      assert.ok(secretBox.open(sealed, KEY()).bytes.equals(secret), "a sealed secret did not come back");
    });

    it("refuses a row edited in the database rather than opening it to something else", () => {
      const sealed = secretBox.seal(otp.newSecret(), KEY());
      const parts = sealed.split(".");
      parts[3] = Buffer.from(crypto.randomBytes(20)).toString("base64url");
      assert.equal(secretBox.open(parts.join("."), KEY()).ok, false, "a tampered ciphertext opened");
      assert.equal(secretBox.open(sealed, secretBox.keyFrom(() => "f".repeat(48))).ok, false, "the wrong key opened it");
      assert.equal(secretBox.open("not-sealed-at-all", KEY()).code, "not_sealed");
      assert.equal(secretBox.open("", KEY()).code, "not_sealed");
    });

    it("never uses the same bytes for sealing and for peppering", () => {
      // One key for two constructions is how a weakness in one becomes a
      // weakness in the other.
      //
      // The first version of this asserted only that the pepper was not the raw
      // key material and did not appear inside a sealed value. Both stayed true
      // when `pepper()` was changed to derive under the sealing label, which is
      // exactly the reuse it was written to prevent. So the label is pinned:
      // the pepper is recomputed here from the module's own published constant,
      // and deriving it under any other label fails.
      const key = KEY();
      assert.notEqual(secretBox.SEAL_LABEL, secretBox.PEPPER_LABEL, "both purposes use one label");
      const expected = Buffer.from(
        crypto.hkdfSync("sha256", key.material, Buffer.alloc(0), Buffer.from(secretBox.PEPPER_LABEL, "utf8"), 32)
      );
      assert.ok(secretBox.pepper(key).equals(expected), "the pepper is not derived under PEPPER_LABEL");
      assert.notEqual(secretBox.pepper(key).toString("hex"), key.material.toString("hex"));
      assert.ok(!secretBox.seal(Buffer.alloc(20), key).includes(secretBox.pepper(key).toString("base64url")));
    });
  });
});
