"use strict";

// The register's licence text and its integration status have to agree.
//
// scripts/check-license-risk.mjs already refuses a record that is high or
// unknown risk while claiming commercial use is allowed. That gate reads two
// fields -- licenseRisk and commercialUseStatus -- and both are typed by hand.
// Set licenseRisk to "low" on a reciprocal licence and the gate has nothing
// left to object to, because the only other thing it looks at is a regex for
// "gpl" in the licence string. OSL-3.0 does not contain "gpl". Neither does
// "None declared".
//
// So these checks read the licence sentence itself, which is the field someone
// writes truthfully even when they are wrong about the risk tier. Twenty-five
// repositories went through intake at once; five came back reciprocal and two
// had no licence at all. Those are the two shapes that cost something if they
// are quietly reclassified later, and neither existing gate catches it.

const assert = require("node:assert/strict");
const { readOpenSourceTools } = require("../lib/sonara-open-source-registry.cjs");

// Reciprocal in the sense that matters for a hosted product: using the software
// to serve users over a network triggers the obligation to release source.
// AGPL and OSL say so directly; GPL is included because a shipped bundle
// distributes it, and this product ships JavaScript to browsers.
const RECIPROCAL = /\b(agpl|gpl|osl|sspl|eupl)\b|affero|open software license/i;

// Licences that permit use but withhold *commercial* use, and licences that
// publish source while forbidding the one thing this product is.
//
// Neither is caught by RECIPROCAL, and both are strictly worse for us than a
// reciprocal licence. Reciprocal has a price -- release the source. These have
// no price: no term this project can accept unlocks them, only the author
// relicensing.
//
// Both patterns exist because a record walked through the gap. A repository
// submitted as a Claude skill library, with 44.3k stars and a `.claude-plugin`
// directory, is CC BY-NC 4.0: "not primarily intended for or directed towards
// commercial advantage or monetary compensation". SONARA One is sold on paid
// plans. Popularity and plugin format say nothing about the licence, and until
// this pattern existed nothing in the register's checks would have objected to
// it being marked an adaptation source.
const NONCOMMERCIAL = /\bnon-?commercial\b|\bCC[ -]BY[ -]NC\b|\bNC[ -]4\.0\b/i;

// Source-available, not open source: the source is published and offering it
// as a hosted or managed service is forbidden. SONARA One is a hosted service,
// so this is the clause aimed at us. ELv2 and BUSL are the two that have
// actually arrived here.
const SOURCE_AVAILABLE = /elastic license|\bELv2\b|business source license|\bBUSL\b|\bSSPL\b|commons clause/i;

// Licence text that says, in words, that nothing has been granted or confirmed.
const NO_GRANT = /none declared|no licence declared|no license declared/i;
const UNVERIFIED = /not verified|unverified|could not be (confirmed|verified)/i;

// Statuses that mean code may end up in the product.
// Both, not just the first. This set was "optional_adapter_after_review" alone,
// so the checks below measured the status meaning "an adapter may be built"
// while skipping the status meaning "an adapter is built and something calls
// it" -- the stronger commitment, and the only one where code from a
// repository is already here. A check named for the whole adoption path that
// covers half of it reports a guarantee it never tested.
const ADOPTION_STATUSES = new Set(["optional_adapter_after_review", "adapter_built"]);

describe("open-source register licence terms", () => {
  const records = readOpenSourceTools();

  it("parses records to check", () => {
    // Without this the three checks below pass by having nothing to look at,
    // which is the failure mode they exist to prevent elsewhere.
    assert.ok(records.length > 20, `expected the register to parse; got ${records.length} records`);
  });

  it("does not treat an undeclared licence as permission", () => {
    // A repository with no licence is all rights reserved, not permissive.
    // Nobody in this project can grant what the author has not.
    const wrong = records
      .filter((record) => NO_GRANT.test(record.license))
      .filter((record) => record.integrationStatus !== "blocked");
    assert.deepEqual(
      wrong.map((record) => `${record.name} (${record.integrationStatus})`),
      [],
      "records whose licence text says nothing was declared must be blocked, because default copyright grants nothing"
    );
  });

  it("does not allow commercial use on a licence nobody has confirmed", () => {
    const wrong = records
      .filter((record) => UNVERIFIED.test(record.license))
      .filter((record) => record.commercialUseStatus === "allowed_after_review");
    assert.deepEqual(
      wrong.map((record) => record.name),
      [],
      "a licence recorded as unverified cannot also be recorded as cleared for commercial use"
    );
  });

  it("keeps reciprocal licences out of the adoption path", () => {
    // Reading these is free and is why they are in the register at all.
    // Incorporating one obliges releasing this product's source under the same
    // terms, which is the owner's decision to make explicitly rather than
    // something that arrives through a status field.
    const wrong = records
      .filter((record) => RECIPROCAL.test(record.license))
      .filter((record) => ADOPTION_STATUSES.has(record.integrationStatus));
    assert.deepEqual(
      wrong.map((record) => `${record.name} (${record.license})`),
      [],
      "a reciprocal licence cannot be marked as an adaptation source; network use of the product would trigger the source-release obligation"
    );
  });

  it("keeps NonCommercial licences out of the adoption path, and out of commercial use", () => {
    // Stricter than the reciprocal check above, and deliberately so. A
    // reciprocal licence can be adopted at a price this project could choose to
    // pay. A NonCommercial licence cannot be adopted at any price, because the
    // thing it withholds is what this product does for a living.
    const adopting = records
      .filter((record) => NONCOMMERCIAL.test(record.license))
      .filter((record) => ADOPTION_STATUSES.has(record.integrationStatus));
    assert.deepEqual(
      adopting.map((record) => `${record.name} (${record.license})`),
      [],
      "a NonCommercial licence cannot be an adaptation source for a product sold on paid plans"
    );

    const cleared = records
      .filter((record) => NONCOMMERCIAL.test(record.license))
      .filter((record) => record.commercialUseStatus === "allowed_after_review" || record.commercialUseStatus === "allowed");
    assert.deepEqual(
      cleared.map((record) => `${record.name} (${record.commercialUseStatus})`),
      [],
      "no internal review can clear a NonCommercial licence for commercial use; only the author relicensing can"
    );
  });

  it("keeps source-available licences out of the adoption path", () => {
    // Published source is not permission. ELv2 and BUSL forbid offering the
    // software as a hosted or managed service, which is precisely what this
    // product is.
    const wrong = records
      .filter((record) => SOURCE_AVAILABLE.test(record.license))
      .filter((record) => ADOPTION_STATUSES.has(record.integrationStatus));
    assert.deepEqual(
      wrong.map((record) => `${record.name} (${record.license})`),
      [],
      "a source-available licence forbids offering the software as a hosted service, which is what SONARA One is"
    );
  });

  it("names a settled licence on everything in the adoption path", () => {
    // The three checks above catch licences that say, in words, that nothing
    // was granted. They do not catch a licence field that says "review this
    // before adapter work" while the record is already marked as an adaptation
    // source -- which is what Crawl4AI said. Its licence turned out to be
    // Apache-2.0 and always had been, so nothing had gone wrong; the field just
    // held a to-do that outlived itself, and a to-do reads exactly like a
    // finding to whoever checks next.
    //
    // A record that may have code taken from it has to open with a licence
    // somebody can look up. Qualifications after it are fine -- "MIT; model
    // licences are reviewed separately" is a settled licence with a true note
    // attached -- but the first thing said has to be the licence.
    //
    // Two named project licences are settled without being SPDX. "Dify Open
    // Source License" and "Open WebUI License" are single documents somebody
    // can open and read, which is the property this check is actually testing
    // for; an allowlist keeps that judgement visible rather than letting a
    // looser pattern admit the next vague sentence as well.
    const IDENTIFIER =
      /^(MIT|MIT-0|Apache-2\.0|BSD-[23]-Clause|ISC|CC0-1\.0|CC-BY-4\.0|Unlicense|MPL-2\.0|Zlib|Dify Open Source License|Open WebUI License)\b/;
    const vague = records
      .filter((record) => ADOPTION_STATUSES.has(record.integrationStatus))
      .filter((record) => !IDENTIFIER.test(record.license));
    assert.deepEqual(
      vague.map((record) => `${record.name}: "${record.license.slice(0, 60)}"`),
      [],
      "a record code may be adapted from must state its licence first; a sentence about reviewing it later is not a licence"
    );
  });

  it("finds the reciprocal and undeclared records it is meant to be watching", () => {
    // The three checks above are satisfied by an empty register. This one
    // fails if the licence sentences stop being written in a form the patterns
    // can read, which would leave the checks green and blind.
    const reciprocal = records.filter((record) => RECIPROCAL.test(record.license));
    const undeclared = records.filter((record) => NO_GRANT.test(record.license));
    assert.ok(
      reciprocal.length >= 4,
      `expected the register to still contain reciprocal-licensed records; found ${reciprocal.length}`
    );
    assert.ok(
      undeclared.length >= 2,
      `expected the register to still contain records with no licence declared; found ${undeclared.length}`
    );
    // Same reasoning for the two patterns added above: they gate nothing if the
    // register stops containing anything they can match, and a green check over
    // an empty population is the failure this file exists to prevent.
    const noncommercial = records.filter((record) => NONCOMMERCIAL.test(record.license));
    const sourceAvailable = records.filter((record) => SOURCE_AVAILABLE.test(record.license));
    assert.ok(
      noncommercial.length >= 1,
      `expected the register to still contain a NonCommercial record; found ${noncommercial.length}`
    );
    assert.ok(
      sourceAvailable.length >= 1,
      `expected the register to still contain a source-available record; found ${sourceAvailable.length}`
    );
  });
});
