"use strict";

// Leaked-password protection, and specifically the two ways it could go wrong.
//
// Supabase Auth's own leaked-password setting has been disabled since the
// advisor reported it on 2026-07-27. It is a dashboard toggle, so nothing here
// can turn it on and nothing here would notice it being turned off again --
// scripts/verify-production-project-identity.mjs has been printing a WARNING
// about it on every deploy since. lib/sonara-leaked-password.cjs is the half
// that does not depend on that toggle.
//
// Two failure modes matter more than the happy path:
//
//   Refusing a good password. A padded response carries real suffixes with a
//   count of 0 as filler. Reading one of those as a hit would reject a password
//   that is not in the corpus at all, and the person would have no way to tell
//   why.
//
//   Blocking signup when the service is down. This must fail open. An auth path
//   that hard-fails on a third-party dependency is a worse outage than the one
//   it is guarding against.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  isPasswordLeaked,
  LEAKED_PASSWORD_MESSAGE,
  sha1Upper
} = require("../lib/sonara-leaked-password.cjs");

// Build a range response the way the real service does: suffixes of the same
// prefix, one count each.
function rangeBody(lines) {
  return lines.map(([suffix, count]) => `${suffix}:${count}`).join("\r\n");
}

function suffixOf(password) {
  return sha1Upper(password).slice(5);
}

function stubFetch(handler) {
  return async (url, init) => handler(String(url), init || {});
}

function okResponse(body) {
  return { ok: true, status: 200, text: async () => body };
}

describe("leaked password lookup", () => {
  it("never sends the password or its full hash", async () => {
    const seen = [];
    await isPasswordLeaked("correct horse battery staple", {
      fetch: stubFetch((url, init) => {
        seen.push({ url, headers: init.headers });
        return okResponse(rangeBody([["0000000000000000000000000000000000A", 3]]));
      })
    });

    assert.equal(seen.length, 1);
    const digest = sha1Upper("correct horse battery staple");
    const requested = seen[0].url;

    assert.ok(requested.startsWith("https://api.pwnedpasswords.com/range/"));
    const sent = requested.slice("https://api.pwnedpasswords.com/range/".length);
    assert.equal(sent, digest.slice(0, 5), "the request must carry exactly the five-character prefix");
    assert.equal(sent.length, 5);

    // The things that must never appear anywhere in the request.
    assert.ok(!requested.includes(digest), "the full hash was sent");
    assert.ok(!requested.includes(digest.slice(5)), "the hash suffix was sent");
    assert.ok(!requested.toLowerCase().includes("correct"), "the password was sent");
    assert.equal(seen[0].headers["Add-Padding"], "true", "padding was not requested, so response size leaks the prefix");
  });

  it("refuses a password that is in the corpus", async () => {
    const password = "Password123!";
    const result = await isPasswordLeaked(password, {
      fetch: stubFetch(() => okResponse(rangeBody([
        ["FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", 12],
        [suffixOf(password), 4823],
        ["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", 7]
      ])))
    });
    assert.deepEqual(result, { leaked: true, checked: true, count: 4823 });
  });

  it("allows a password that is not in the corpus", async () => {
    const result = await isPasswordLeaked("a-passphrase-that-is-not-in-any-corpus-8f2a", {
      fetch: stubFetch(() => okResponse(rangeBody([
        ["FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", 12],
        ["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", 7]
      ])))
    });
    assert.deepEqual(result, { leaked: false, checked: true, count: 0 });
  });

  it("treats a zero count as padding rather than a breach", async () => {
    // This is the case that would silently reject good passwords. Padded
    // responses include real-looking suffixes with count 0; matching on the
    // suffix alone would call this a hit.
    const password = "an-unbreached-passphrase-2f9c";
    const result = await isPasswordLeaked(password, {
      fetch: stubFetch(() => okResponse(rangeBody([[suffixOf(password), 0]])))
    });
    assert.equal(result.leaked, false, "a padding entry was read as a breach");
    assert.equal(result.checked, true);
  });

  it("matches the suffix case-insensitively and ignores surrounding whitespace", async () => {
    const password = "another-test-passphrase-77b1";
    const result = await isPasswordLeaked(password, {
      fetch: stubFetch(() => okResponse(`${suffixOf(password).toLowerCase()} : 9 \r\n`))
    });
    assert.equal(result.leaked, true);
    assert.equal(result.count, 9);
  });

  describe("fails open rather than blocking the account", () => {
    const cases = [
      ["the service is unreachable", stubFetch(() => { throw new Error("ENOTFOUND"); })],
      ["the service returns 503", stubFetch(() => ({ ok: false, status: 503, text: async () => "" }))],
      ["the service returns 429", stubFetch(() => ({ ok: false, status: 429, text: async () => "" }))],
      ["the body cannot be read", stubFetch(() => ({ ok: true, status: 200, text: async () => { throw new Error("aborted"); } }))],
      ["the body is not in the expected format", stubFetch(() => okResponse("<html>maintenance</html>"))]
    ];

    for (const [name, fetchImpl] of cases) {
      it(`allows the password when ${name}`, async () => {
        const result = await isPasswordLeaked("some-password-value", { fetch: fetchImpl });
        assert.equal(result.leaked, false, "a service problem blocked a signup");
        assert.equal(result.checked, false, "an unchecked password was reported as checked");
        assert.ok(result.reason, "an unchecked result must say why");
      });
    }

    // Passing { fetch: null } does NOT exercise this: the module falls back to
    // globalThis.fetch, so the first version of this test quietly made a real
    // request to the live service and passed on the abort timeout. The runtime
    // has to actually have no fetch.
    it("allows the password when no fetch implementation exists", async () => {
      const original = globalThis.fetch;
      let attempted = false;
      globalThis.fetch = () => { attempted = true; throw new Error("no test should reach the network"); };
      try {
        const result = await isPasswordLeaked("some-password-value", { fetch: null });
        assert.equal(attempted, true, "the fallback to globalThis.fetch is gone; this check no longer means anything");
        assert.equal(result.leaked, false);
        assert.equal(result.checked, false);

        globalThis.fetch = undefined;
        const withoutFetch = await isPasswordLeaked("some-password-value", { fetch: null });
        assert.equal(withoutFetch.leaked, false, "a runtime without fetch blocked a signup");
        assert.equal(withoutFetch.checked, false);
        assert.match(withoutFetch.reason, /fetch/i);
      } finally {
        globalThis.fetch = original;
      }
    });

    it("does not hang when the service never answers", async () => {
      const started = Date.now();
      const result = await isPasswordLeaked("some-password-value", {
        timeoutMs: 40,
        fetch: (url, init) =>
          new Promise((resolve, reject) => {
            // Resolve only on abort, which is what a hung service looks like.
            init.signal.addEventListener("abort", () => reject(new Error("aborted")));
          })
      });
      assert.equal(result.leaked, false);
      assert.equal(result.checked, false);
      assert.ok(Date.now() - started < 2000, "the lookup did not abort");
    });
  });

  it("says why in words a person can act on, without quoting a count", () => {
    assert.match(LEAKED_PASSWORD_MESSAGE, /public data breach/i);
    assert.match(LEAKED_PASSWORD_MESSAGE, /choose a different one/i);
    // A count invites treating a low number as acceptable, and it is not
    // something the person can do anything about.
    assert.doesNotMatch(LEAKED_PASSWORD_MESSAGE, /\d/, "the message quotes a number");
  });

  it("uses the digest the corpus is indexed by", () => {
    // Pinned against a known value rather than recomputed, so a change of
    // algorithm shows up here instead of as an API that silently never matches.
    assert.equal(sha1Upper("password"), "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8");
    assert.equal(sha1Upper("password"), crypto.createHash("sha1").update("password").digest("hex").toUpperCase());
  });
});

describe("the password choice paths are guarded", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.join(__dirname, "..");
  const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

  it("checks at signup and at reset, and not at login", () => {
    const auth = read("lib/sonara-customer-auth.cjs");
    assert.match(auth, /isPasswordLeaked/, "signup does not check for leaked passwords");
    // The guard must sit inside the signup branch. Checking on login would put
    // a third-party round trip in front of every sign-in, and would lock out
    // the person whose password has just appeared in a corpus at the moment
    // they are trying to get in and change it.
    const guard = auth.slice(auth.indexOf('if (mode === "signup") {'), auth.indexOf("const endpoint"));
    assert.match(guard, /isPasswordLeaked/, "the leaked-password check is not scoped to signup");

    const reset = read("routes/sonara-route-registry-routes.cjs");
    const resetHandler = reset.slice(reset.indexOf('app.post("/auth/reset-password"'), reset.indexOf('app.get("/account/profile"'));
    assert.match(resetHandler, /isPasswordLeaked/, "the reset flow does not check for leaked passwords");
    assert.match(resetHandler, /LEAKED_PASSWORD_MESSAGE/);
  });

  it("keeps reporting the Supabase setting this does not replace", () => {
    // The application check and the dashboard toggle are different guarantees:
    // this one covers the paths in this repository, the toggle covers every
    // path Supabase Auth serves. Turning one on is not a reason to stop
    // reporting the other.
    const identity = read("scripts/verify-production-project-identity.mjs");
    assert.match(identity, /password_hibp_enabled/);
    assert.match(identity, /SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION/);
  });
});
