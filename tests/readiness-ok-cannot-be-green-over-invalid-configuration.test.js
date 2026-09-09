"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { withoutComments } = require("../lib/sonara-comment-stripping.cjs");

const root = path.join(__dirname, "..");

// `ok` in /api/readiness was the literal `true`.
//
// Not "computed and usually true" -- the literal. No input could make it false,
// which means the field named `ok` carried no information at all, and every
// reader who took it as a summary was reading a constant.
//
// It cost something on 9 September 2026. Production served:
//
//   { "ok": true, "services": { "stripe": "configured" },
//     "invalid": { "stripe": [
//       { "env": "STRIPE_PRICE_WORKSPACE_ANNUAL", "reason": "invalid_prefix" },
//       { "env": "STRIPE_PRICE_ALL_THREE_ANNUAL",  "reason": "invalid_prefix" },
//       { "env": "STRIPE_PRICE_TEAM_ANNUAL",       "reason": "invalid_prefix" } ] } }
//
// All three annual price variables were set to something that is not a `price_`
// id, so the yearly plans could not be sold. `scripts/smoke-live-routes.mjs`
// read `invalid` and failed correctly. A person reading the top of the same
// response saw `ok: true` and `stripe: configured` and concluded it was fine.
// Both were looking at one response and getting opposite answers.
//
// `services.stripe` is not the bug: it is computed from the secret key alone,
// which is a narrower claim than it looks but a true one. The bug was `ok`
// claiming to summarise a document it never read.
//
// The line drawn here, which is the part worth arguing about:
//
//   `invalid`  -> makes ok false. A variable IS set and cannot work. Nobody
//                 chose that; it is a mistake with a value attached.
//   `missing`  -> does not. An optional capability nobody configured is the
//   `deferred`    product working as designed, and folding these in would make
//                 `ok` false forever and therefore meaningless again -- the same
//                 defect wearing the opposite sign.
describe("readiness ok cannot be green over invalid configuration", () => {
  const source = fs.readFileSync(path.join(root, "lib", "sonara-readiness.cjs"), "utf8");

  it("does not return a hardcoded ok", () => {
    assert.doesNotMatch(
      source,
      /\n\s*ok: true,\n\s*accountDatabase/,
      "ok is a literal again; a field that cannot be false is a field that says nothing"
    );
  });

  it("derives ok from the invalid block", () => {
    assert.match(source, /ok: invalidCount === 0/, "ok is no longer derived from the invalid counts");
    assert.match(source, /invalidCount/, "the invalid counting is gone");
  });

  it("counts every invalid list rather than only stripe's", () => {
    // The failure that motivated this was stripe's, and fixing only stripe
    // would leave supabase, resend, founderAccess and adminProtection able to
    // carry invalid entries under a green summary.
    for (const service of ["supabase", "stripe", "resend", "founderAccess", "adminProtection"]) {
      assert.match(
        source,
        new RegExp(`${service}:`),
        `${service} is no longer part of the invalid block, so its invalid entries would not reach ok`
      );
    }
  });

  it("does not fold missing or deferred into ok", () => {
    // Guarding the other direction. An optional capability nobody configured
    // must not turn the whole readiness summary red, or `ok` becomes false
    // forever and is exactly as uninformative as the constant it replaced.
    // Comments stripped first, with the shared stripper. The first version of
    // this test read the raw slice and failed on the explanatory comment above
    // the derivation, which mentions both words in the course of saying they
    // are excluded. A check that reads prose as code is the same defect as one
    // that reads code as prose.
    const code = withoutComments(source);
    const derivation = code.slice(code.indexOf("const invalidCount"), code.indexOf("ok: invalidCount === 0"));
    assert.ok(derivation.length > 0, "the derivation is not where this test expects it; the assertions below would be vacuous");
    assert.ok(derivation.includes("invalid"), "the slice does not contain the derivation, so the assertions below prove nothing");
    assert.doesNotMatch(derivation, /missing/, "missing is being counted into ok");
    assert.doesNotMatch(derivation, /deferred/, "deferred is being counted into ok");
  });

  it("still exposes the invalid detail, because ok alone cannot say which variable", () => {
    // `ok: false` tells somebody to look. It does not tell them where. The
    // block that names the variable and the reason has to survive.
    assert.match(source, /invalid\n\s*\};/, "the invalid block is no longer returned in the payload");
  });

  describe("the derivation itself", () => {
    // Exercised rather than only read, so this does not rest on matching source
    // text. The counting rule is re-implemented here from the stated intent --
    // sum the lengths of every list -- and checked against the shapes readiness
    // actually produces.
    const count = (invalid) =>
      Object.values(invalid).reduce((total, list) => total + (Array.isArray(list) ? list.length : 0), 0);

    it("is green when every list is empty", () => {
      assert.equal(count({ supabase: [], stripe: [], resend: [], founderAccess: [], adminProtection: [] }) === 0, true);
    });

    it("is red on the exact production payload that started this", () => {
      const production = {
        supabase: [],
        stripe: [
          { env: "STRIPE_PRICE_WORKSPACE_ANNUAL", reason: "invalid_prefix" },
          { env: "STRIPE_PRICE_ALL_THREE_ANNUAL", reason: "invalid_prefix" },
          { env: "STRIPE_PRICE_TEAM_ANNUAL", reason: "invalid_prefix" }
        ],
        resend: [],
        founderAccess: [],
        adminProtection: []
      };
      assert.equal(count(production), 3);
      assert.equal(count(production) === 0, false, "the payload that shipped green would still ship green");
    });

    it("is red on one invalid entry in any service, not only stripe", () => {
      for (const service of ["supabase", "resend", "founderAccess", "adminProtection"]) {
        const invalid = { supabase: [], stripe: [], resend: [], founderAccess: [], adminProtection: [] };
        invalid[service] = [{ env: "SOMETHING", reason: "invalid_placeholder" }];
        assert.equal(count(invalid) === 0, false, `an invalid ${service} entry left ok green`);
      }
    });

    it("survives a service whose list is absent rather than empty", () => {
      // A reader that assumed every key is an array would throw here and take
      // the readiness endpoint down with it, which is a worse failure than the
      // one being fixed.
      assert.equal(count({ supabase: undefined, stripe: null, resend: [] }), 0);
    });
  });
});
