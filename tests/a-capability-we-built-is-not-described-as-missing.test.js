"use strict";

// A comment saying a capability does not exist, in a product where it does.
//
// `lib/sonara-invoice-settlement.cjs` told every reader "There is no Stripe
// Connect in this application. No connected-account model, no `on_behalf_of`,
// no `transfer_data`, no table holding a business's Stripe account." That was
// true when it was written and stopped being true on 26 August 2026, when
// lib/sonara-connected-payments.cjs, routes/sonara-connected-payment-routes.cjs
// and 20260826090000_business_payment_accounts.sql landed.
//
// `docs/market/2026-08-26-PER-PRODUCT-COMPETITOR-REASSESSMENT.md` carried the
// same belief into the competitive record, twice, as "the gap that is worth
// closing first". So the largest thing this product had gained was recorded
// everywhere as the largest thing it lacked.
//
// This is `CLAUDE.md`'s fifth shape -- an exemption whose reason has expired --
// and it is worse than no reason at all, because a stale reason is what the
// next person reads instead of checking.
//
// The check is two-sided on purpose, which is the part that makes it worth
// having. It fails when a document claims the capability is missing while the
// code has it, AND it fails when the code loses the capability while the
// documents have stopped saying so. Only one of those directions is the bug
// that happened; a check written for that direction alone would quietly go
// blind if Connect were ever removed.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));

// A capability, how to tell whether the code really has it, and the sentences
// that must not be said about it while it does.
//
// `presentWhen` is deliberately more than "a file exists": a module nothing
// mounts is not a capability, and this repository has shipped a route file
// nobody mounted before.
const CAPABILITIES = [
  {
    name: "Stripe Connect: a business being paid by its own customers",
    presentWhen: () =>
      exists("lib/sonara-connected-payments.cjs") &&
      exists("routes/sonara-connected-payment-routes.cjs") &&
      fs.readdirSync(path.join(root, "supabase", "migrations")).some((file) => file.includes("business_payment_accounts")) &&
      /registerConnectedPaymentRoutes\(app/.test(read("server.js")),
    // Where the belief was recorded. Each file is read whole; a claim moved to
    // another paragraph of the same file is still caught.
    documents: [
      "lib/sonara-invoice-settlement.cjs",
      "docs/market/2026-08-26-PER-PRODUCT-COMPETITOR-REASSESSMENT.md"
    ],
    // Phrases that assert the absence. Matched case-insensitively.
    absenceClaims: [
      /there is no stripe connect in this application/i,
      /the same missing connect/i,
      /a creator cannot sell anything through it/i,
      /a customer cannot pay an invoice through it/i
    ],
    // A quotation of the old claim is how a correction is written, so a line
    // that is visibly quoting or dating itself is not an assertion.
    quotedMarkers: [
      /^\s*\/\/\s*>/,
      /^\s*>/,
      /used to say/i,
      /stopped being true/i,
      /corrected \d/i,
      /superseded/i,
      // A struck-through claim carrying its own correction. Markdown's ~~ alone
      // is not enough -- struck-through text is still text somebody reads -- so
      // the line must also say it is no longer true, and when.
      /~~[\s\S]*~~[\s\S]*no longer true/i,
      /~~[\s\S]*~~[\s\S]*closed \d/i
    ]
  }
];

function assertingLines(source, patterns, quotedMarkers) {
  return source
    .split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => patterns.some((pattern) => pattern.test(line)))
    .filter(({ line }) => !quotedMarkers.some((marker) => marker.test(line)));
}

describe("a capability we built is not described as missing", () => {
  it("has capabilities to check, so none of this passes on an empty list", () => {
    assert.ok(CAPABILITIES.length >= 1, "no capabilities registered; this check has gone blind");
    for (const capability of CAPABILITIES) {
      assert.ok(capability.documents.length >= 1, `${capability.name} names no documents to check`);
      assert.ok(capability.absenceClaims.length >= 1, `${capability.name} names no absence claims to look for`);
      for (const document of capability.documents) {
        assert.ok(exists(document), `${capability.name} points at ${document}, which does not exist`);
      }
    }
  });

  it("finds the capability actually present in the code, not merely on disk", () => {
    for (const capability of CAPABILITIES) {
      assert.ok(
        capability.presentWhen(),
        `${capability.name} is registered here as present and the code no longer has it. ` +
          "Either restore it, or remove it from this register AND put the honest 'not built' note back into every document listed."
      );
    }
  });

  it("says nothing that claims the capability is missing", () => {
    for (const capability of CAPABILITIES) {
      for (const document of capability.documents) {
        const found = assertingLines(read(document), capability.absenceClaims, capability.quotedMarkers);
        assert.equal(
          found.length,
          0,
          `${document} still says the product lacks ${capability.name}:\n` +
            found.map(({ number, line }) => `  ${document}:${number}  ${line.trim()}`).join("\n") +
            "\n\nThe code has it. A stale reason is what the next person reads instead of checking."
        );
      }
    }
  });

  it("would notice the claim coming back", () => {
    // The motivating bug, reproduced against the checker rather than the tree,
    // because the alternative is trusting a check that has never matched
    // anything. If this stops finding the sentence the fix removed, the
    // patterns have drifted and the case above is passing on nothing.
    const asItWas = [
      "// **There is no Stripe Connect in this application.** No connected-account",
      "// model, no `on_behalf_of`, no `transfer_data`, no table holding a business's"
    ].join("\n");
    const [capability] = CAPABILITIES;
    const found = assertingLines(asItWas, capability.absenceClaims, capability.quotedMarkers);
    assert.equal(found.length, 1, "the patterns no longer match the sentence this check exists to catch");
  });

  it("still catches a struck-through claim that does not say it is corrected", () => {
    // Strikethrough on its own must not be an escape hatch. A reader scanning
    // for what the product cannot do reads struck-through text too, and a claim
    // crossed out with no date and no correction is still the claim.
    const [capability] = CAPABILITIES;
    const struckButUncorrected = "- ~~**A creator cannot sell anything through it.**~~";
    assert.equal(
      assertingLines(struckButUncorrected, capability.absenceClaims, capability.quotedMarkers).length,
      1,
      "strikethrough alone now hides a claim from this check"
    );
    const struckAndDated = "- ~~**A creator cannot sell anything through it.**~~ **No longer true, 26 August 2026** -- the same Connect path serves both.";
    assert.equal(
      assertingLines(struckAndDated, capability.absenceClaims, capability.quotedMarkers).length,
      0,
      "a struck-through claim that says when it stopped being true is a correction, not an assertion"
    );
  });

  it("does not mistake a dated correction for the claim itself", () => {
    // The correction quotes the old wording, so a checker that cannot tell a
    // quotation from an assertion makes the honest fix impossible to write.
    const correction = [
      "// **Corrected 6 September 2026.** This comment used to say:",
      "//   > There is no Stripe Connect in this application. No connected-account"
    ].join("\n");
    const [capability] = CAPABILITIES;
    assert.equal(assertingLines(correction, capability.absenceClaims, capability.quotedMarkers).length, 0);
  });
});
