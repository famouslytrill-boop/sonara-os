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

// Licence text that says, in words, that nothing has been granted or confirmed.
const NO_GRANT = /none declared|no licence declared|no license declared/i;
const UNVERIFIED = /not verified|unverified|could not be (confirmed|verified)/i;

// Statuses that mean code may end up in the product.
const ADOPTION_STATUSES = new Set(["optional_adapter_after_review"]);

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
  });
});
