"use strict";

// Two checks of the same property, disagreeing.
//
// Whether a plan can actually be sold is asked in two places:
//
//   lib/sonara-billing.cjs      at checkout, where the key is always present
//   scripts/verify-stripe-env.mjs  in the release chain, where it usually is not
//
// The runtime guard expands the Stripe product and refuses
// `price_product_archived`, because archiving a product does not clear its
// prices' active flag -- so `price.active` alone reads true and only the product
// says otherwise. The release check read `price.active` and stopped, which meant
// it would pass a configuration the running server rejects. The release output
// is the line people read, so the more optimistic of the two was the one on
// display.
//
// The second defect was in the summary. The last line read "Stripe
// configuration verified against the deployed server" whether or not the live
// comparison ran -- and it never runs in CI, because STRIPE_SECRET_KEY is not
// there. The [SKIP] line said the amounts had not been compared and the summary
// two lines later said the configuration was verified. The skip was honest and
// the summary overwrote it.
//
// These are source assertions rather than behavioural ones because the online
// half cannot run here: it needs a live secret, and a test that supplies one
// would either be a secret in the repository or a network call in the suite.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const releaseCheck = fs.readFileSync(path.join(root, "scripts", "verify-stripe-env.mjs"), "utf8");
const runtimeGuard = fs.readFileSync(path.join(root, "lib", "sonara-billing.cjs"), "utf8");

describe("the two Stripe checks ask the same question", () => {
  it("is reading both files", () => {
    assert.ok(releaseCheck.length > 500 && runtimeGuard.length > 500, "a source file came back empty; this check has gone blind");
  });

  it("both expand the product rather than trusting price.active", () => {
    for (const [name, source] of [["scripts/verify-stripe-env.mjs", releaseCheck], ["lib/sonara-billing.cjs", runtimeGuard]]) {
      assert.match(
        source,
        /expand\[\]=product/,
        `${name} reads a Stripe price without expanding its product, so an archived product reads as sellable`
      );
    }
  });

  it("both refuse a live price whose product is archived", () => {
    for (const [name, source] of [["scripts/verify-stripe-env.mjs", releaseCheck], ["lib/sonara-billing.cjs", runtimeGuard]]) {
      assert.match(
        source,
        /product\.active === false/,
        `${name} does not check whether the product behind the price is archived`
      );
    }
  });

  it("does not claim the live prices were checked when they were not", () => {
    // The property that broke. A summary printed unconditionally cannot be
    // telling the truth in both branches, because one of them skipped the work.
    const summaries = [...releaseCheck.matchAll(/console\.log\(\s*\n?\s*"\\nStripe configuration verified[^"]*"/g)];
    // The script has two summary branches -- one for the run that compared live
    // prices and one for the run that could not. Without this the loop below
    // asserts nothing the moment somebody rewords the sentence it matches on,
    // and the check goes green over exactly the defect it was written for: a
    // summary printed unconditionally that claims work which was skipped.
    assert.ok(
      summaries.length >= 2,
      `only ${summaries.length} summary lines parsed from scripts/verify-stripe-env.mjs; this check has gone blind`
    );
    for (const summary of summaries) {
      assert.ok(
        /including live prices/.test(summary[0]) || /offline/.test(summary[0]),
        `this summary claims verification without saying which half ran:\n${summary[0]}`
      );
    }
    assert.match(releaseCheck, /comparedLivePrices/, "nothing tracks whether the live comparison happened");
    assert.match(
      releaseCheck,
      /if \(comparedLivePrices\)/,
      "the summary is not conditional on whether the live comparison ran"
    );
  });

  it("only reports live prices as compared after a price actually matched", () => {
    // Setting the flag early -- when the key is found, say -- would restore the
    // original lie in a new place. It has to be set on the success path, after
    // every refusal has had its chance.
    const flagAt = releaseCheck.indexOf("comparedLivePrices = true");
    const successAt = releaseCheck.indexOf("Stripe charges exactly what the pricing page advertises");
    assert.ok(flagAt > 0 && successAt > 0, "could not find the success path");
    assert.ok(
      flagAt < successAt && successAt - flagAt < 200,
      "comparedLivePrices is not set on the success path, so it can report a comparison that did not conclude"
    );
  });
});
