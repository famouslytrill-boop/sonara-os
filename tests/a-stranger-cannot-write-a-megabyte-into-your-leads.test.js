"use strict";

// `/chat/:slug` is one of two endpoints in this application a person with no
// account can write through. The other is `/book/:slug`, and that one has
// clamped every field since it was written:
//
//     String(req.body?.customer_name  || "").trim().slice(0, 120)
//     String(req.body?.customer_email || "").trim().slice(0, 320)
//     String(req.body?.customer_phone || "").trim().slice(0, 40)
//     String(req.body?.notes          || "").trim().slice(0, 1000)
//
// The chat path did not. Visitor answers funnel through `recordAnswer`, which
// used `cleanText` — trim, reject empty, and nothing else. `express.urlencoded`
// caps a request at 1mb and the chat rate limiter caps the frequency, so this
// was never a way to fill a database. It was a way for a stranger to put a
// megabyte in the `name` field of a lead, which then renders on the owner's
// list page. The owner suffers and did nothing.
//
// `cleanText` is deliberately still unbounded, because most of its callers read
// the **owner's own** profile configuration — industries, regions,
// disqualifiers — and truncating what a business typed about itself would be
// its own defect. The bound belongs where untrusted input enters.
//
// ## Truncating is right for text and wrong for an identifier
//
// This is the half the first version of the fix got wrong, and it is the
// interesting part.
//
// A name or a free-text answer can be cut: the tail is lost and nothing else
// changes. An email address or a phone number cannot. Truncating one does not
// shorten it — it makes it point somewhere else.
// `someone@example.com.attacker.tld` cut at the wrong byte is
// `someone@example.com`: a different, real person's address, stored as though
// the visitor had typed it, and then emailed by whatever the business does with
// a lead.
//
// So identifiers are **refused** when over-long, and the visitor is told.
// "We could not accept that" is always better than quietly recording a value
// somebody did not give.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  recordAnswer,
  questionsFor,
  OTHER_VALUE,
  VISITOR_LIMITS
} = require("../lib/sonara-lead-capture-script.cjs");

// Questions come from the profile's own fields rather than a list handed in, so
// these are the real shapes `/chat/:slug` produces. An industries profile gives
// a choice question that allows "something else", which is the free-text box a
// visitor can actually type into.
const PROFILE = Object.freeze({ industries: ["Plumbing", "Electrical"] });

describe("a stranger cannot write a megabyte into your leads", () => {
  describe("the harness is capable of failing", () => {
    it("has limits to test, and they are plausible", () => {
      for (const key of ["name", "email", "phone", "free"]) {
        assert.ok(
          Number.isInteger(VISITOR_LIMITS[key]) && VISITOR_LIMITS[key] > 0,
          `VISITOR_LIMITS.${key} is not a usable bound; this check has gone blind`
        );
      }
      assert.ok(VISITOR_LIMITS.free >= 200, "the free-text bound is so small it would truncate ordinary answers");
    });

    it("still accepts an ordinary answer", () => {
      // If this cannot pass, every refusal below is measuring a harness that
      // refuses everything.
      const recorded = recordAnswer(PROFILE, "contact", {
        name: "Ada Lovelace", email: "ada@example.com", phone: "07700 900123"
      });
      assert.ok(recorded.ok, `an ordinary contact answer was refused: ${recorded.code}`);
      assert.equal(recorded.value.name, "Ada Lovelace");
      assert.equal(recorded.value.email, "ada@example.com");
    });
  });

  describe("text is truncated, because the tail is all that is lost", () => {
    it("bounds a name a visitor typed a megabyte into", () => {
      const recorded = recordAnswer(PROFILE, "contact", {
        name: "A".repeat(1_000_000), email: "ada@example.com"
      });
      assert.ok(recorded.ok, "a long name should be accepted and cut, not refused");
      assert.equal(
        recorded.value.name.length,
        VISITOR_LIMITS.name,
        "the name was stored unbounded, so it renders at full length on the owner's lead list"
      );
    });

    it("bounds the 'something else' box on a choice question", () => {
      // The free-text path a visitor can really reach: pick "other", then type.
      const question = questionsFor(PROFILE).find((entry) => entry.key === "industry");
      assert.ok(question?.allowOther, "the industry question no longer offers a free-text alternative");

      const recorded = recordAnswer(PROFILE, "industry", { value: OTHER_VALUE, other: "B".repeat(50_000) });
      assert.ok(recorded.ok, `a long free-text answer should be cut, not refused: ${recorded.code}`);
      assert.equal(
        String(recorded.value).length,
        VISITOR_LIMITS.free,
        "the free-text answer was stored unbounded"
      );
    });
  });

  describe("an identifier is refused, because a cut one points somewhere else", () => {
    it("refuses an over-long email rather than truncating it into a different address", () => {
      // The attack this exists for, spelled out: the submitted value contains a
      // real address as a prefix. Truncation would store that person's address.
      const victimised = `someone@example.com${".attacker".repeat(80)}`;
      assert.ok(victimised.length > VISITOR_LIMITS.email, "the fixture is not actually over-long");

      const recorded = recordAnswer(PROFILE, "contact", { email: victimised });
      assert.equal(
        recorded.ok,
        false,
        "an over-long email was accepted. If it was truncated, the stored address may belong to somebody who " +
          "never filled in this form"
      );
      assert.equal(recorded.code, "email_too_long");
      assert.match(recorded.message, /too long/i, "the visitor is not told why their answer was refused");
    });

    it("refuses an over-long phone number for the same reason", () => {
      const recorded = recordAnswer(PROFILE, "contact", { phone: "1".repeat(VISITOR_LIMITS.phone + 1) });
      assert.equal(recorded.ok, false, "an over-long phone number was accepted; a cut one is a different number");
      assert.equal(recorded.code, "phone_too_long");
    });

    it("accepts an identifier exactly at the limit, so the bound is not off by one", () => {
      const local = "a".repeat(VISITOR_LIMITS.email - "@example.com".length);
      const exact = `${local}@example.com`;
      assert.equal(exact.length, VISITOR_LIMITS.email);
      const recorded = recordAnswer(PROFILE, "contact", { email: exact });
      assert.ok(recorded.ok, "an address exactly at the limit was refused; the bound is off by one");
      assert.equal(recorded.value.email, exact, "an accepted identifier must be stored exactly as given");
    });
  });

  describe("the owner's own configuration is not bounded by this", () => {
    it("leaves cleanText unbounded, because it reads what the business typed about itself", () => {
      const source = fs.readFileSync(path.join(__dirname, "..", "lib", "sonara-lead-capture-script.cjs"), "utf8");
      // Its own body only. Slicing to the next named function would sweep in
      // visitorText, which truncates on purpose -- and that is what this
      // assertion got wrong on its first run.
      const start = source.indexOf("function cleanText");
      const body = source.slice(start, source.indexOf("\n}", start));
      assert.doesNotMatch(
        body,
        /\.slice\(/,
        "cleanText now truncates. Most of its callers read the owner's own profile -- industries, regions, " +
          "disqualifiers -- and silently cutting what a business typed about itself is a different defect from " +
          "the one this file is about"
      );
    });
  });

  describe("both public write paths agree", () => {
    it("uses the same numbers the booking page has always used", () => {
      // Two public endpoints disagreeing about how long a phone number may be
      // is the kind of difference that becomes a bug report nobody can
      // reproduce.
      const booking = fs.readFileSync(
        path.join(__dirname, "..", "routes", "sonara-public-booking-routes.cjs"), "utf8"
      );
      for (const [field, limit] of [["name", VISITOR_LIMITS.name], ["email", VISITOR_LIMITS.email], ["phone", VISITOR_LIMITS.phone]]) {
        assert.ok(
          booking.includes(`.slice(0, ${limit})`),
          `the booking page no longer clamps anything at ${limit}, so the chat path's ${field} bound now disagrees ` +
            "with it. Change both together or record why they differ"
        );
      }
    });
  });
});
