"use strict";

// Two checks of the same property, disagreeing.
//
// Whether a plan can actually be sold is asked in two places:
//
//   lib/sonara-billing.cjs         at checkout, where the key is always present
//   scripts/verify-stripe-env.mjs in the release chain
//
// The release check must agree with the runtime on live Stripe object health,
// and it must agree with the pricing ladder about which missing prices are
// actually release blockers. A superseded plan that the page intentionally
// hides is not the same thing as an offered plan whose price is missing.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const releaseCheck = fs.readFileSync(path.join(root, "scripts", "verify-stripe-env.mjs"), "utf8");
const runtimeGuard = fs.readFileSync(path.join(root, "lib", "sonara-billing.cjs"), "utf8");
const ladder = fs.readFileSync(path.join(root, "lib", "sonara-stripe-plans.cjs"), "utf8");

describe("the two Stripe checks ask the same question", () => {
  it("fails a required live run when one price matches and another cannot be reached", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-stripe-partial-"));
    try {
      fs.mkdirSync(path.join(dir, "scripts"));
      fs.mkdirSync(path.join(dir, "lib"));
      fs.writeFileSync(path.join(dir, "scripts", "verify-stripe-env.mjs"), releaseCheck);
      fs.writeFileSync(path.join(dir, ".env.example"), "PRICE_ONE=\nPRICE_TWO=\n");
      fs.writeFileSync(path.join(dir, "server.js"), `// stripe-signature
module.exports = { STRIPE_PLANS: {
  first: { env: 'PRICE_ONE', mode: 'payment', amountCents: 100, price: '$1/mo' },
  second: { env: 'PRICE_TWO', mode: 'payment', amountCents: 100, price: '$1/mo' }
}};
`);
      fs.writeFileSync(path.join(dir, "lib", "sonara-stripe-plans.cjs"), "module.exports = { offeredPlanKeys: () => ['first', 'second'] };\n");
      fs.writeFileSync(path.join(dir, "provider.cjs"), `global.fetch = async (url) => {
  if (String(url).includes('price_two')) throw new Error('synthetic transport failure');
  return new Response(JSON.stringify({active:true,unit_amount:100,currency:'usd',product:{active:true}}));
};\n`);
      const result = spawnSync(process.execPath, ["--require", "./provider.cjs", "scripts/verify-stripe-env.mjs", "--require-live"], {
        cwd: dir, encoding: "utf8", timeout: 10000,
        env: { ...process.env, STRIPE_SECRET_KEY: ['rk','live','synthetic'].join('_'), PRICE_ONE: "price_one", PRICE_TWO: "price_two" }
      });
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /Stripe charges exactly what the pricing page advertises/);
      assert.match(result.stderr, /second: could not reach Stripe; amounts not compared/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("is reading all three source files", () => {
    assert.ok(
      releaseCheck.length > 500 && runtimeGuard.length > 500 && ladder.length > 500,
      "a source file came back empty; this check has gone blind"
    );
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
    const summaries = [...releaseCheck.matchAll(/console\.log\(\s*\n?\s*"\\nStripe configuration verified[^"]*"/g)];
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
    const flagAt = releaseCheck.indexOf("comparedLivePrices = true");
    const successAt = releaseCheck.indexOf("Stripe charges exactly what the pricing page advertises");
    assert.ok(flagAt > 0 && successAt > 0, "could not find the success path");
    assert.ok(
      flagAt < successAt && successAt - flagAt < 200,
      "comparedLivePrices is not set on the success path, so it can report a comparison that did not conclude"
    );
  });

  it("uses the pricing page's ladder decision before failing a missing price under --require-live", () => {
    assert.match(ladder, /function offeredPlanKeys\(/, "the pricing ladder no longer exposes its offer decision");
    assert.match(
      releaseCheck,
      /offeredPlanKeys\(/,
      "the release check no longer asks the pricing ladder which plans are actually offered"
    );
    assert.match(
      releaseCheck,
      /requireLive && offeredPlans\.has\(plan\)/,
      "--require-live still treats every non-hidden plan as mandatory instead of only plans the pricing page offers"
    );
    assert.doesNotMatch(
      releaseCheck,
      /requireLive && !config\.hiddenUntilBuyable/,
      "the old missing-price rule is back; superseded Starter/Core/Pro would block deployment after the new ladder is live"
    );
  });
});
