"use strict";

// The words a customer reads before paying.
//
// An audit of all twenty-three products trimmed nine capability lists to what
// their page renders -- and left the summaries alone. `capabilities` is an
// internal field nobody outside this repository sees. `summary` and
// `customerOutcome` are printed on the catalog card. So the half that was fixed
// was the half nobody reads, and "Products, services, licences, bundles,
// prices, delivery files, payment links, and your refund position" stayed on a
// product whose page drafts an offer and saves it.
//
// This is the list of things the copy may not promise, each with the reason it
// is not there to promise. It is a work queue in the same sense as
// NO_FORM_NEEDED in tests/form-reachability.test.js: an entry leaves when the
// feature arrives, not when the wording gets softened.

const assert = require("node:assert/strict");
const { RECOMMENDED_PRODUCT_CATALOG } = require("../lib/sonara-recommended-product-catalog.cjs");

// Each phrase, and why no product may claim it. Written as a regex over the
// customer-facing text of every catalog row.
const NOT_BUILT = Object.freeze([
  [/\bbundles?\b/i, "Nothing groups products into a bundle. Creator Studio's offer page drafts one offer at a time."],
  [/\bdelivery files?\b/i, "There is no delivery-file path. The only storage in the product is the signed download of a generation result."],
  [/\bpayment links?\b/i, "No page mints a payment link for a customer's own buyer. Stripe checkout exists for SONARA's own plans."],
  [/\bUTM\b/i, "No UTM builder exists. Attribution reports on conversions that were recorded, it does not construct links."],
  [/\brefund position\b/i, "Refunds are owner-approval-only by AGENTS.md and no page states a refund position."],
  [/\bscored opportunit/i, "Market intelligence states a thesis and stop rules. Opportunity scoring is in the module, not on the page."],
  [/\bvalidation portfolio\b/i, "Same page, same reason: not rendered anywhere a customer can reach."],
  [/\breferral tracking\b/i, "Not built. The providers page lists connected services and what they have run."],
  [/\banswer[- ]engine\b/i, "Not built, and it is the kind of claim -- being cited by an assistant -- nobody can guarantee anyway."],
  [/\brenewal reminders?\b/i, "Removed from the exports product for this reason and must not come back in prose."],
  [/\bCSV mapping\b/i, "No import path exists. Grep for it and the only hits are historical migrations."],
  [/\bfile storage\b/i, "No customer-facing file store. This was a whole product row until the audit; it must not return as a phrase."]
]);

// Every field a customer reads on the catalog card.
function customerFacingText(item) {
  return [item.name, item.summary, item.customerOutcome].join(" ");
}

describe("the catalog copy claims nothing unbuilt", () => {
  it("is reading the catalog, rather than an empty list", () => {
    assert.ok(RECOMMENDED_PRODUCT_CATALOG.length >= 20, "the catalog is empty; every check below would pass");
    const words = RECOMMENDED_PRODUCT_CATALOG.reduce((total, item) => total + customerFacingText(item).split(/\s+/).length, 0);
    assert.ok(words >= 400, `only ${words} words of customer-facing copy found; the fields have moved`);
  });

  it("promises nothing the product does not do", () => {
    const promises = [];
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      const text = customerFacingText(item);
      for (const [pattern, reason] of NOT_BUILT) {
        if (pattern.test(text)) promises.push(`${item.name}: ${pattern} -- ${reason}`);
      }
    }
    assert.deepEqual(
      promises,
      [],
      `these products promise something nothing builds:\n  ${promises.join("\n  ")}\n\n` +
        "Build it, or take it out of the copy. Softening the wording while the feature stays absent is the thing this check exists to stop."
    );
  });

  // The capability list is internal, and it drifted apart from the summary
  // precisely because nothing compared them. This does not try to parse prose
  // against a list -- it checks the two are not wildly different in scope,
  // which is the failure that actually happened: nine lists cut, nine summaries
  // untouched.
  it("keeps the internal list and the customer copy in the same story", () => {
    const mismatched = [];
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      const text = customerFacingText(item);
      for (const [pattern, reason] of NOT_BUILT) {
        if (pattern.test(item.capabilities.join(" "))) {
          mismatched.push(`${item.name} lists "${pattern}" as a capability -- ${reason}`);
        }
      }
      // A summary that is far longer than what the product claims to do is how
      // the overclaiming rows read before the audit.
      if (item.capabilities.length <= 3 && text.split(/\s+/).length > 60) {
        mismatched.push(`${item.name} claims ${item.capabilities.length} capabilities and spends ${text.split(/\s+/).length} words describing them`);
      }
    }
    assert.deepEqual(mismatched, [], mismatched.join("\n  "));
  });

  // And the check refuses something, so a green result is not an empty list of
  // patterns matched against nothing.
  it("would catch a promise that came back", () => {
    const reintroduced = { name: "Test", summary: "Bundles, payment links and a UTM builder.", customerOutcome: "" };
    const caught = NOT_BUILT.filter(([pattern]) => pattern.test(customerFacingText(reintroduced)));
    assert.ok(caught.length >= 3, `the patterns matched ${caught.length} of three deliberate promises`);
    assert.ok(NOT_BUILT.length >= 10, `only ${NOT_BUILT.length} patterns; the list has been emptied rather than earned`);
    for (const [, reason] of NOT_BUILT) {
      assert.ok(String(reason).length >= 40, "every banned phrase needs a real reason, not a placeholder");
    }
  });
});
