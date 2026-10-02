"use strict";

// A text field anybody can type into, and a regular expression that can be made to
// run slowly on what they type.
//
// `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` is the shape this repository has used for years and
// it is correct. It is also quadratic, because `[^@\s]` matches `.`, so
// `[^@\s]+\.[^@\s]+` can split a run of punctuation many ways and the engine tries
// them. CodeQL raised it as high severity on `lib/sonara-growth-events.cjs` on
// 2 October 2026 — "Polynomial regular expression used on uncontrolled data" — and
// it was right: that one runs on an email typed into a public RSVP form by anybody,
// and a long string is free to send and expensive to match.
//
// Measured on the shape CodeQL named (`!@!.` then repetitions of `!.`), the old
// pattern took 1.3ms at 2,005 characters, 4.9ms at 4,005 and 19.6ms at 8,005 —
// quadrupling as the length doubled. That is the signature, and it is why this is a
// real finding rather than a theoretical one.
//
// Two things have to stay true, and the second is the one that rots:
//
// **The replacement must be linear.** It walks the string with `indexOf` and one
// whitespace scan. There is no quantifier in it to be ambiguous, and it refuses
// anything over 320 characters before walking at all.
//
// **It must agree with the database.** Two check constraints enforce the shape
// themselves. A validator looser than the constraint produces a save that fails in
// production with no explanation, which is worse than refusing at the form. So the
// cases below are run against both.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { looksLikeEmail, normalizeEmail, EMAIL_MAX, EMAIL_MIN } = require("../lib/sonara-email-shape.cjs");
const { withoutComments } = require("../lib/sonara-comment-stripping.cjs");

const root = path.join(__dirname, "..");

// The two check constraints, as JavaScript. `[:space:]` is POSIX for `\s`, and the
// rest is identical — so this stands in for what PostgreSQL will do with the row.
//
// It is the slow pattern on purpose: it is the thing being agreed with, not the
// thing being shipped, and it only ever sees the short fixtures below.
const DATABASE_CONSTRAINT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

describe("an email check cannot be made slow", () => {
  describe("it agrees with the two check constraints", () => {
    // Every case the constraint and the validator both have to answer the same way.
    // Short, because the constraint pattern is the quadratic one and this is the
    // only place it is still evaluated.
    const CASES = [
      "a@b.co", "dale@example.com", "x.y@a.b.c", "a@b..c", "a-b@c-d.org",
      "UPPER@Example.COM", "a@b.c", "x@y.zz",
      "", "a", "ab", "a@b", "@b.co", "a@.co", "a@b.", "a@", "@",
      "a b@c.co", "a@b c.co", "a\t@b.co", "a@b.co\n",
      "a@@b.co", "a@b@c.co", "a@b.co@d.co",
      ".@b.co", "a@.b.co", "a@b.co."
    ];

    it("reads a population worth measuring", () => {
      assert.ok(CASES.length >= 20, `only ${CASES.length} cases; this check has gone blind`);
    });

    // The dangerous direction, and the only one that matters.
    //
    // A validator LOOSER than the constraint accepts at the form what the row then
    // refuses, and the customer gets a save that failed with no explanation. A
    // validator TIGHTER than the constraint refuses something the database would
    // have taken, which costs nothing and is where this one deliberately sits.
    //
    // The first draft of this asserted exact agreement in both directions and failed
    // on "a@b.co." -- which PostgreSQL accepts, because `[^@\s]+` matches a dot, so
    // "co." satisfies the final group. Refusing a trailing dot is right; asserting
    // exact agreement was the overclaim.
    it("never accepts what the database would refuse", () => {
      const dangerous = CASES
        .filter((value) => looksLikeEmail(value) && !DATABASE_CONSTRAINT.test(value))
        .map((value) => JSON.stringify(value));
      assert.deepEqual(
        dangerous,
        [],
        "the validator accepts what the row refuses, so a form will take an address that then fails to save:\n  " + dangerous.join("\n  ")
      );
    });

    // Where it is deliberately tighter, listed so a new one has to be noticed rather
    // than appearing in a diff nobody reads.
    it("is tighter than the database only where recorded", () => {
      // One entry. A second said "a@b." and the two-sided half below refused it: the
      // database rejects that one too, because its final group needs at least one
      // character after the dot. A reason that describes no disagreement is exactly
      // what the next person reads instead of checking.
      const KNOWN_TIGHTER = Object.freeze({
        "a@b.co.": "a trailing dot after a real label. PostgreSQL takes it because `[^@\\s]+` matches a dot, so \"co.\" satisfies the final group. Nobody types it meaning to, and a stored address with a trailing dot is one nobody can match against later."
      });
      const tighter = CASES.filter((value) => !looksLikeEmail(value) && DATABASE_CONSTRAINT.test(value));
      const unrecorded = tighter.filter((value) => !KNOWN_TIGHTER[value]);
      assert.deepEqual(
        unrecorded.map((value) => JSON.stringify(value)),
        [],
        "the validator refuses these and the database would take them, and no reason is recorded:\n  "
          + unrecorded.map((value) => JSON.stringify(value)).join("\n  ")
      );
      // Two-sided: a recorded reason that no longer describes anything is what the
      // next person reads instead of checking.
      const spent = Object.keys(KNOWN_TIGHTER).filter((value) => !tighter.includes(value));
      assert.deepEqual(spent, [], `these reasons no longer describe a disagreement: ${spent.join(", ")}`);
    });

    it("accepts and refuses something, so the agreement is not vacuous", () => {
      // Two checks agreeing on "no" for everything would also pass the test above.
      assert.ok(CASES.some((value) => looksLikeEmail(value)), "nothing was accepted");
      assert.ok(CASES.some((value) => !looksLikeEmail(value)), "nothing was refused");
    });
  });

  describe("it cannot be made to run slowly", () => {
    // The exact shape CodeQL named: '!@!.' followed by many repetitions of '!.'.
    const pathological = (repetitions) => `!@!.${"!.".repeat(repetitions)}@`;

    it("refuses an over-long input before walking it", () => {
      // The structural half, and the one that does not depend on a clock. Even if
      // the walk were expensive, nothing over 320 characters reaches it.
      const long = pathological(5000);
      assert.ok(long.length > EMAIL_MAX, "the fixture is not long enough to test the bound");
      assert.equal(looksLikeEmail(long), false);
      assert.ok(EMAIL_MAX <= 320, `EMAIL_MAX is ${EMAIL_MAX}; an address longer than a real one should not be walked`);
      assert.ok(EMAIL_MIN >= 3, "an address shorter than a@b cannot be valid");
    });

    it("holds no ambiguous quantifier to backtrack over", () => {
      // Comments stripped before scanning. The first draft failed here on the
      // module's own header, which quotes the old pattern in order to explain why it
      // was replaced -- prose matched as code, the same mistake made twice already
      // in this session's work. The stripper is the shared one.
      const source = withoutComments(fs.readFileSync(path.join(root, "lib", "sonara-email-shape.cjs"), "utf8"));
      // The shape that was replaced. Asserted absent from the replacement, because
      // the obvious way for this fix to be undone is somebody putting it back.
      assert.doesNotMatch(source, /\[\^@\\s\]\+\\\.\[\^@\\s\]\+/, "the quadratic pattern is back in the replacement");
      assert.doesNotMatch(source, /\+\\\.\[/, "a quantifier followed by an escaped dot and a class is the backtracking shape");
      // And the walk is index arithmetic, which is what makes it linear.
      assert.ok(source.includes("indexOf"), "the validator no longer walks the string by index");
      assert.ok(source.includes("lastIndexOf"), "the validator no longer checks for a second @ by index");
    });

    it("stays flat where the old pattern grew", () => {
      // A timing assertion with a generous ceiling. The old pattern took ~20ms at
      // 8,005 characters and quadrupled as length doubled; a linear walk of a
      // 320-character maximum cannot approach this even on a loaded runner.
      const started = process.hrtime.bigint();
      for (let run = 0; run < 2000; run += 1) looksLikeEmail(pathological(200));
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      assert.ok(elapsedMs < 2000, `2000 pathological inputs took ${elapsedMs.toFixed(0)}ms; the walk is no longer linear`);
    });
  });

  describe("the two public forms use it", () => {
    const USERS = [
      path.join(root, "lib", "sonara-growth-events.cjs"),
      path.join(root, "lib", "sonara-merchant-storefront.cjs")
    ];

    it("reads the files it claims to check", () => {
      for (const file of USERS) {
        assert.ok(fs.existsSync(file), `${file} is gone; this check is measuring nothing`);
      }
    });

    it("holds no email pattern of its own any more", () => {
      for (const file of USERS) {
        const raw = fs.readFileSync(file, "utf8");
        assert.ok(
          raw.includes("sonara-email-shape.cjs"),
          `${path.relative(root, file)} does not use the shared email check`
        );
        // Comments stripped for the same reason as above: both files explain in a
        // comment which pattern they stopped using.
        assert.doesNotMatch(
          withoutComments(raw),
          /\[\^@\\s\]\+\\\.\[\^@\\s\]\+/,
          `${path.relative(root, file)} has its own quadratic email pattern again`
        );
      }
    });

    it("still refuses what it refused before", () => {
      // The behaviour the swap must not have changed, asserted through each
      // module's own normaliser rather than through the shared function.
      const events = require("../lib/sonara-growth-events.cjs");
      const store = require("../lib/sonara-merchant-storefront.cjs");
      assert.deepEqual([...events.normalizeRsvp({ display_name: "A", email: "nope" }).problems], ["email_shape"]);
      assert.equal(events.normalizeRsvp({ display_name: "A", email: "a@b.co" }).ok, true);
      assert.deepEqual([...store.normalizeBuyer({ buyer_name: "A", buyer_email: "nope" }).problems], ["email_shape"]);
      assert.equal(store.normalizeBuyer({ buyer_name: "A", buyer_email: "a@b.co" }).ok, true);
    });
  });

  describe("normalising is separate from checking", () => {
    it("trims and lowercases", () => {
      assert.equal(normalizeEmail("  Dale@Example.COM "), "dale@example.com");
      assert.equal(normalizeEmail(null), "");
      assert.equal(normalizeEmail(undefined), "");
    });

    // The reason they are separate functions: validating a cleaned-up value and
    // then storing the raw one is how a trailing space reaches a unique index and
    // one person ends up holding two rows.
    it("is what the callers store", () => {
      const events = require("../lib/sonara-growth-events.cjs");
      const store = require("../lib/sonara-merchant-storefront.cjs");
      assert.equal(events.normalizeRsvp({ display_name: "A", email: "  Dale@Example.COM " }).rsvp.email, "dale@example.com");
      assert.equal(store.normalizeBuyer({ buyer_name: "A", buyer_email: "  Dale@Example.COM " }).buyer.buyerEmail, "dale@example.com");
    });
  });
});
