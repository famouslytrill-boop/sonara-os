"use strict";

// Selling is never easier than publishing.
//
// Creator Studio's marketplace is the one surface where getting provenance wrong
// leaves the building: publishing something you do not hold the rights to is a
// problem, and charging somebody for it is a different and worse one. So
// `lib/sonara-creator-marketplace.cjs` **composes** publishReadiness from the
// approval graph rather than restating its conditions.
//
// That composition is the thing this file is really guarding, and the reason is
// not obvious: two functions each deciding "is this cleared" would agree on the
// day they were written and drift apart on the day somebody adds a blocker to one
// of them. The test below adds a blocker on the publish side and asserts it
// reaches the listing side, which is the only way to check a composition rather
// than a coincidence.
//
// It also guards a bug this module shipped with for about ten minutes and which
// is worth keeping a test over: `publicListing` compared the disclosure against
// the string "disclosed", which is not one of the three values the approval graph
// uses. A work whose AI disclosure had been recorded would have been shown to
// buyers as not disclosed -- silently, with nothing failing.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const market = require("../lib/sonara-creator-marketplace.cjs");
const graph = require("../lib/sonara-creator-approval-graph.cjs");

const root = path.join(__dirname, "..");
const MIGRATION = path.join(root, "supabase", "migrations", "20261003060000_a_marketplace_for_creative_work.sql");

const APPROVED = Object.freeze([{ state: "approved", decidedAt: "2026-10-01T00:00:00Z" }]);

// A human upload with no person in it: the simplest thing that can be sold.
function humanVersion(extra = {}) {
  return { id: "v1", source: "uploaded", provenance: { involves_person: false }, ...extra };
}
// Generated, and disclosed.
function machineVersion(extra = {}) {
  return { id: "v2", source: "generated", aiDisclosure: true, provenance: { involves_person: false }, ...extra };
}
function listing(extra = {}) {
  return {
    id: "l1",
    state: "listed",
    title: "A track",
    medium: "audio",
    price_cents: 2500,
    currency: "usd",
    licence: "commercial_single",
    rights_attested: true,
    ...extra
  };
}
function readiness(overrides = {}) {
  return market.listingReadiness({
    listing: listing(overrides.listing),
    version: overrides.version || humanVersion(),
    approvals: "approvals" in overrides ? overrides.approvals : APPROVED,
    storefrontCurrency: overrides.storefrontCurrency || "usd"
  });
}
function blockerIds(result) {
  return result.blockers.map((blocker) => blocker.id);
}

describe("you cannot sell what you cannot publish", () => {
  describe("the happy case, so the refusals below mean something", () => {
    it("clears an approved human upload with a price and a licence", () => {
      const result = readiness();
      assert.equal(result.ok, true, result.blockers.map((b) => b.sentence).join(" "));
    });

    it("clears a generated work whose disclosure was recorded", () => {
      assert.equal(readiness({ version: machineVersion() }).ok, true);
    });

    it("says checkout is not connected rather than implying a buyer can pay", () => {
      // No payment provider is configured; AGENTS.md and OWNER-STEPS put that
      // behind the owner's credentials. A page saying "ready to sell" with a Buy
      // button that cannot charge is the fake-button shape.
      assert.match(market.listingSentence(readiness()), /[Cc]heckout is not connected/);
    });
  });

  describe("every publish blocker is a listing blocker", () => {
    it("refuses a version nobody approved", () => {
      const result = readiness({ approvals: [] });
      assert.equal(result.ok, false);
      assert.ok(blockerIds(result).includes("not_publishable"));
      assert.ok(result.blockers.some((blocker) => blocker.from === "not_approved"));
    });

    it("refuses a version whose approvals could not be read", () => {
      // null, not []. A failed read is not an absence of approvals.
      const result = readiness({ approvals: null });
      assert.ok(result.blockers.some((blocker) => blocker.from === "approval_unreadable"));
    });

    it("refuses a generated version whose disclosure nobody recorded", () => {
      const result = readiness({ version: machineVersion({ aiDisclosure: undefined }) });
      assert.ok(result.blockers.some((blocker) => blocker.from === "disclosure_not_recorded"));
    });

    it("refuses a version that was withdrawn after being approved", () => {
      const result = readiness({
        approvals: [
          { state: "approved", decidedAt: "2026-10-01T00:00:00Z" },
          { state: "withdrawn", decidedAt: "2026-10-02T00:00:00Z" }
        ]
      });
      assert.ok(result.blockers.some((blocker) => blocker.from === "not_approved"));
    });

    // The assertion that makes this a composition rather than a coincidence.
    it("carries through whatever the publish side refuses, by its own id", () => {
      const publishIds = new Set();
      for (const probe of [
        { approvals: [] },
        { approvals: null },
        { version: machineVersion({ aiDisclosure: undefined }) }
      ]) {
        const publish = graph.publishReadiness(probe.version || humanVersion(), "approvals" in probe ? probe.approvals : APPROVED);
        for (const blocker of publish.blockers) publishIds.add(blocker.id);
        const listed = readiness(probe);
        for (const blocker of publish.blockers) {
          assert.ok(
            listed.blockers.some((carried) => carried.from === blocker.id),
            `publishReadiness refuses with ${blocker.id} and the listing does not carry it`
          );
        }
      }
      // Non-empty, and covering the three the publish side can raise. An empty
      // set would satisfy the loop above while proving nothing.
      assert.ok(publishIds.size >= 3, `only ${publishIds.size} publish blockers exercised; this check has gone blind`);
    });

    it("reads the publish decision from the approval graph rather than its own copy", () => {
      const source = fs.readFileSync(path.join(root, "lib", "sonara-creator-marketplace.cjs"), "utf8");
      assert.match(source, /require\("\.\/sonara-creator-approval-graph\.cjs"\)/);
      assert.match(source, /publishReadiness\(version, approvals\)/);
      // A second opinion on "is it approved" is a way for the first to stop
      // mattering. The module must not re-derive it.
      assert.doesNotMatch(source, /approvalStateOf|APPROVAL_STATES/);
    });
  });

  describe("rights, and an unanswered attestation", () => {
    it("refuses when nobody recorded whether the rights are held", () => {
      assert.ok(blockerIds(readiness({ listing: { rights_attested: undefined } })).includes("rights_not_attested"));
      assert.ok(blockerIds(readiness({ listing: { rights_attested: null } })).includes("rights_not_attested"));
    });

    it("refuses when the rights are recorded as not held", () => {
      assert.ok(blockerIds(readiness({ listing: { rights_attested: false } })).includes("rights_denied"));
    });

    it("tells the two apart", () => {
      // "Nobody asked" and "they said no" are different sentences and the creator
      // does different things about them.
      const unanswered = readiness({ listing: { rights_attested: undefined } });
      const denied = readiness({ listing: { rights_attested: false } });
      assert.notDeepEqual(blockerIds(unanswered), blockerIds(denied));
    });

    it("reads three states out of an attestation", () => {
      assert.equal(market.attestationOf(true), market.ATTESTED.yes);
      assert.equal(market.attestationOf(false), market.ATTESTED.no);
      assert.equal(market.attestationOf(undefined), market.ATTESTED.not_recorded);
      assert.equal(market.attestationOf(null), market.ATTESTED.not_recorded);
      assert.notEqual(market.ATTESTED.no, market.ATTESTED.not_recorded);
    });
  });

  describe("consent, which is a different question from rights", () => {
    it("keeps malformed person declarations unanswered instead of bypassing consent", () => {
      for (const value of [null, undefined, "", "unknown", 0, 1, [], {}, "FALSE"]) {
        const result = readiness({ version: humanVersion({ provenance: { involves_person: value } }) });
        assert.equal(result.involvesAPerson, null);
        assert.equal(result.consentNeeded, true);
        assert.ok(blockerIds(result).includes("consent_not_recorded"));
        assert.equal(result.ok, false);
      }
      assert.equal(readiness({ version: humanVersion({ provenance: { involves_person: "false" } }) }).ok, true);
    });
    it("does not ask for consent when no person is in the work", () => {
      const result = readiness({ version: humanVersion({ provenance: { involves_person: false } }) });
      assert.equal(result.consentNeeded, false);
      assert.equal(result.ok, true);
    });

    it("refuses when a person is in it and consent was not recorded", () => {
      const result = readiness({ version: humanVersion({ provenance: { involves_person: true } }) });
      assert.ok(blockerIds(result).includes("consent_not_recorded"));
    });

    it("refuses when nobody recorded whether a person is in it at all", () => {
      // The third state again, one level up. "No person is in this" makes the
      // consent question moot; "nobody said" does not, and treating silence as
      // "no person" is how a synthetic voice gets sold.
      const result = readiness({ version: humanVersion({ provenance: {} }) });
      assert.equal(result.involvesAPerson, null);
      assert.equal(result.consentNeeded, true);
      assert.ok(blockerIds(result).includes("consent_not_recorded"));
    });

    it("refuses when consent is recorded as not given", () => {
      const result = readiness({
        version: humanVersion({ provenance: { involves_person: true } }),
        listing: { consent_attested: false }
      });
      assert.ok(blockerIds(result).includes("consent_denied"));
    });

    it("clears a work with a person in it once consent is recorded", () => {
      const result = readiness({
        version: humanVersion({ provenance: { involves_person: true } }),
        listing: { consent_attested: true }
      });
      assert.equal(result.ok, true, result.blockers.map((b) => b.sentence).join(" "));
    });

    it("does not let holding the rights stand in for having consent", () => {
      // The whole reason these are two columns. rights_attested is true here.
      const result = readiness({ version: humanVersion({ provenance: { involves_person: true } }) });
      assert.equal(result.rights, market.ATTESTED.yes);
      assert.equal(result.ok, false);
    });
  });

  describe("a price nobody set is not free", () => {
    it("rejects coercible non-prices and amounts that cannot be represented exactly", () => {
      for (const value of [true, false, [], [100], {}, " ", "0x64", "1e2", 2147483648, Number.MAX_SAFE_INTEGER + 1, "9007199254740993"]) {
        assert.ok(blockerIds(readiness({ listing: { price_cents: value } })).includes("price_unreadable"));
      }
      assert.equal(readiness({ listing: { price_cents: "2500" } }).priceCents, 2500);
      assert.equal(readiness({ listing: { price_cents: 2147483647 } }).ok, true);
    });
    it("refuses a price of zero with its own reason", () => {
      assert.ok(blockerIds(readiness({ listing: { price_cents: 0 } })).includes("price_not_set"));
    });

    it("refuses a price it could not read, and says it was not read", () => {
      for (const value of [undefined, null, "", "abc", -1, 12.5]) {
        const result = readiness({ listing: { price_cents: value } });
        assert.ok(
          blockerIds(result).includes("price_unreadable"),
          `${JSON.stringify(value)} did not refuse as unreadable`
        );
      }
      const sentence = market.listingSentence(readiness({ listing: { price_cents: null } }));
      assert.match(sentence, /not been read/);
    });

    it("tells zero apart from unreadable", () => {
      assert.notDeepEqual(
        blockerIds(readiness({ listing: { price_cents: 0 } })),
        blockerIds(readiness({ listing: { price_cents: null } }))
      );
    });
  });

  describe("what the buyer is told they may do with it", () => {
    it("refuses a listing with no licence chosen", () => {
      assert.ok(blockerIds(readiness({ listing: { licence: "" } })).includes("licence_not_chosen"));
    });

    it("refuses a licence this marketplace does not offer", () => {
      assert.ok(blockerIds(readiness({ listing: { licence: "do_whatever" } })).includes("licence_unknown"));
    });

    it("gives every licence a sentence a buyer could act on", () => {
      assert.ok(market.LICENCES.length >= 3, `only ${market.LICENCES.length} licences; this check has gone blind`);
      for (const licence of market.LICENCES) {
        assert.ok(licence.means && licence.means.length > 25, `${licence.key} does not say what it means`);
        assert.doesNotMatch(licence.means, /\bperpetual\b|\birrevocable\b|\bsublicensable\b/i, `${licence.key} explains itself in licence-speak: ${licence.means}`);
      }
    });

    it("says that an exclusive transfer cannot be undone", () => {
      const exclusive = market.LICENCES.find((licence) => licence.key === "exclusive_transfer");
      assert.match(exclusive.means, /cannot be undone/i);
    });
  });

  describe("currency", () => {
    it("refuses rather than converting", () => {
      const result = readiness({ listing: { currency: "gbp" }, storefrontCurrency: "usd" });
      assert.ok(blockerIds(result).includes("currency_mismatch"));
      assert.match(market.listingSentence(result), /invent a rate nobody agreed/);
    });
  });

  describe("what a visitor to the marketplace sees", () => {
    it("shows nothing for a listing that is not cleared", () => {
      assert.equal(market.publicListing({ listing: listing(), readiness: readiness({ approvals: [] }) }), null);
    });

    it("shows nothing for a draft, a withdrawal, or an exclusive sale", () => {
      for (const state of ["draft", "withdrawn", "sold_exclusively"]) {
        assert.equal(
          market.publicListing({ listing: listing({ state }), readiness: readiness() }),
          null,
          `${state} was shown publicly`
        );
      }
    });

    it("shows the work, the price and the licence", () => {
      const shown = market.publicListing({ listing: listing(), readiness: readiness() });
      assert.equal(shown.priceCents, 2500);
      assert.equal(shown.licence.key, "commercial_single");
      assert.ok(shown.licence.means);
    });

    it("never shows the creator's own attestations", () => {
      const shown = market.publicListing({ listing: listing(), readiness: readiness() });
      const keys = Object.keys(shown).join(",");
      // A creator's record of their own diligence is not a buyer's business, and
      // this is asserted by construction rather than by remembering to delete.
      for (const leak of ["rights", "rights_attested", "consent", "consent_attested", "note", "created_by"]) {
        assert.ok(!keys.includes(leak), `the public listing exposes ${leak}`);
      }
    });

    it("tells a buyer when a machine made it", () => {
      const shown = market.publicListing({ listing: listing(), readiness: readiness({ version: machineVersion() }) });
      // The bug this module shipped with for ten minutes: compared against the
      // string "disclosed", which is not one of the approval graph's three values,
      // so a disclosed work read as not disclosed. Silent, and in the worst
      // direction.
      assert.equal(shown.aiDisclosed, true);
      assert.equal(shown.madeByMachine, true);
    });

    it("says nothing either way when nobody recorded it and no machine was involved", () => {
      const shown = market.publicListing({ listing: listing(), readiness: readiness({ version: humanVersion() }) });
      // null, not false. A boolean here would tell a buyer "not AI" about a work
      // where the question was never put.
      assert.equal(shown.aiDisclosed, null);
      assert.equal(shown.madeByMachine, false);
    });

    it("reads the disclosure through the approval graph's own values", () => {
      const source = fs.readFileSync(path.join(root, "lib", "sonara-creator-marketplace.cjs"), "utf8");
      assert.match(source, /DISCLOSURE\.declared_ai/);
      assert.match(source, /DISCLOSURE\.declared_human/);
      // A literal standing in for another module's enum is wrong the moment
      // either side is renamed, and nothing says so.
      assert.doesNotMatch(source, /=== "disclosed"/);
    });
  });

  describe("the migration says this to the database too", () => {
    const sql = fs.readFileSync(MIGRATION, "utf8");

    it("reads a migration worth measuring", () => {
      assert.ok(sql.length > 2000, `the migration is ${sql.length} bytes; this check has gone blind`);
    });

    it("points a listing at a version rather than an asset", () => {
      assert.match(sql, /version_id uuid not null references public\.creator_asset_versions\(id\)/);
      assert.doesNotMatch(sql, /asset_id uuid not null references public\.creator_assets/);
    });

    it("keeps both attestations nullable and gives price_cents no default", () => {
      assert.match(sql, /rights_attested boolean,/);
      assert.match(sql, /consent_attested boolean,/);
      assert.doesNotMatch(sql, /price_cents integer not null default 0/);
    });

    it("asserts its own shape against the live catalogue", () => {
      for (const claim of [
        /of 2 nullable attestations/,
        /price_cents has default/,
        /this table records what is being asked for, not a payment/,
        /no state check constraint/
      ]) {
        assert.match(sql, claim, `the migration no longer asserts ${claim}`);
      }
    });

    it("holds no card data, settlement or payout", () => {
      // AGENTS.md forbids storing card data or CVV. Asserted against the
      // catalogue in the migration; asserted here against the column list.
      const table = sql.slice(sql.indexOf("create table if not exists public.creator_listings"));
      const body = table.slice(0, table.indexOf(");"));
      for (const forbidden of ["card", "cvv", "payout", "settled"]) {
        assert.ok(!body.includes(forbidden), `the table declares a ${forbidden} column`);
      }
    });
  });
});
