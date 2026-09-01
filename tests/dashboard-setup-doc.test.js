"use strict";

// docs/MANUAL_DASHBOARD_SETUP_FINAL.md is the file somebody follows to point
// production at Stripe. Until 2026-08-04 it was wrong in three ways at once:
//
//   - It named env vars the server has never read
//     (STRIPE_CREATOR_MONTHLY_PRICE_ID, STRIPE_PRO_MONTHLY_PRICE_ID) rather
//     than the ones in the plan table (STRIPE_PRICE_STARTER_MONTHLY, ...).
//   - The Price IDs it gave were the retired $9.99/$19.99 plans, whose Stripe
//     products were archived in June.
//   - Those IDs were mistranscribed: capital I where the real IDs have
//     lowercase l, so they would not have resolved even if they were current.
//
// Following it exactly produced a deployment where checkout reported that
// payments were not set up, with nothing anywhere to say why. A prose doc
// cannot fail, which is how it stayed wrong through several launches.
//
// This ties it to the code. The plan table is the authority on which env vars
// exist; the doc has to name those and no others.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const doc = fs.readFileSync(path.join(root, "docs/MANUAL_DASHBOARD_SETUP_FINAL.md"), "utf8");
const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");

// Every price env var the server reads: the primary `env:` on each plan plus
// its `envAliases`. Aliases are accepted at runtime but the doc should teach
// the primary name, so they are collected separately.
//
// Read from the plan table itself rather than by regex over server.js source.
// The regex version went blind the moment the table moved to lib/ -- it found
// nothing, and "no env vars are missing from the doc" was true of an empty
// list. The guard below caught it, and this removes the parser that needed
// guarding.
const { STRIPE_PLANS } = require("../lib/sonara-stripe-plans.cjs");

function planEnvNames() {
  const primary = new Set();
  const aliases = new Set();
  for (const config of Object.values(STRIPE_PLANS)) {
    if (config.env) primary.add(config.env);
    for (const alias of config.envAliases || []) aliases.add(alias);
  }
  return { primary: [...primary], aliases: [...aliases] };
}

// Retired Stripe prices. Products archived June 2026, prices archived
// 2026-08-04. The doc may name them under "Retired" but must never list one as
// a value to set.
const RETIRED_PRICE_IDS = ["price_1TS4jf0dKtlEU3lAgEX2tjV2", "price_1TS4l70dKtlEU3lAGmuQmmYO", "price_1TS4lc0dKtlEU3lAy98zUnFy"];

// The retired section names the old env vars and Price IDs on purpose, so
// every "must not appear" check runs against the doc with that section removed.
// Scanning the whole doc and exempting anything the retired section mentions
// would let the old names back into the operative text unnoticed -- the retired
// section names all of them, so the exemption would cover exactly the strings
// the check exists to catch.
const RETIRED_START = doc.indexOf("### Retired prices");
const RETIRED_END = doc.indexOf("## Vercel");
const RETIRED_SECTION = doc.slice(RETIRED_START, RETIRED_END);
const OPERATIVE = doc.replace(RETIRED_SECTION, "");

describe("the manual dashboard setup checklist", () => {
  const { primary, aliases } = planEnvNames();

  it("reads the plan table it is being checked against", () => {
    assert.ok(primary.length >= 3, `only ${primary.length} price env vars parsed from server.js; this check has gone blind`);
    // Without this, a renamed heading collapses RETIRED_SECTION to "" and
    // OPERATIVE silently becomes the whole document, exempting nothing.
    assert.ok(RETIRED_START > 0 && RETIRED_END > RETIRED_START, "the retired-prices section was not found; the section split has gone blind");
    assert.ok(OPERATIVE.length < doc.length, "removing the retired section changed nothing");
  });

  it("names every price env var the server reads", () => {
    const missing = primary.filter((name) => !doc.includes(name));
    assert.deepEqual(missing, [], `the checklist does not mention: ${missing.join(", ")}`);
  });

  it("names no price env var the server does not read", () => {
    const known = new Set([...primary, ...aliases]);
    const named = [...new Set([...OPERATIVE.matchAll(/`(STRIPE_[A-Z_]+)`/g)].map((match) => match[1]))];
    // Non-price Stripe variables the checklist legitimately covers.
    const nonPrice = new Set(["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"]);
    const unknown = named.filter((name) => !known.has(name) && !nonPrice.has(name));
    assert.deepEqual(unknown, [], `the checklist names env vars nothing reads: ${unknown.join(", ")}`);
  });

  it("does not tell anyone to configure a retired price", () => {
    for (const priceId of RETIRED_PRICE_IDS) {
      assert.ok(!OPERATIVE.includes(priceId), `${priceId} is archived in Stripe but appears outside the retired section`);
      assert.ok(doc.includes(priceId), `${priceId} should stay recorded in the retired section so a stale copy can be recognised`);
    }
  });

  it("writes Price IDs that could actually resolve", () => {
    // The mistranscription was capital I for lowercase l. Stripe IDs are
    // base62, so a capital I is legal in principle -- but every real ID in this
    // account uses "0dKtlEU3lA", and the typo'd ones read "0dKtIEU3IA". Pin the
    // exact confusion that happened rather than guessing at a general rule.
    const written = [...doc.matchAll(/price_[A-Za-z0-9]+/g)];
    // A document with no Price IDs in it would satisfy the loop below while
    // proving nothing about the transcription this test exists to catch.
    assert.ok(written.length >= 3, `only ${written.length} Price IDs found in the checklist; this check has gone blind`);
    for (const match of written) {
      assert.ok(!match[0].includes("0dKtIEU3IA"), `${match[0]} has capital I where the real IDs have lowercase l`);
    }
  });

  it("keeps the price IDs it lists distinct", () => {
    // Two plans sharing a Price ID would bill the wrong amount and nothing in
    // the checkout guard could tell, because each price matches itself.
    const ids = [...OPERATIVE.matchAll(/`(price_[A-Za-z0-9]+)`/g)].map((match) => match[1]);
    assert.ok(ids.length >= 3, `only ${ids.length} price IDs found in the operative section`);
    assert.equal(new Set(ids).size, ids.length, `the checklist lists the same Price ID for more than one plan: ${ids.join(", ")}`);
  });

  it("lists exactly the webhook events the handler acts on", () => {
    // The old list included invoice.payment_succeeded and
    // invoice.payment_failed, which no code has ever handled -- an operator
    // subscribing to them got deliveries into a branch that returns `ignored`,
    // and would reasonably assume failed payments were being recorded.
    const billing = fs.readFileSync(path.join(root, "lib/sonara-billing.cjs"), "utf8");
    const handled = new Set();
    for (const match of billing.matchAll(/event\.type === "([a-z_.]+)"/g)) handled.add(match[1]);
    for (const list of billing.matchAll(/\[((?:"[a-z_.]+",?\s*)+)\]\.includes\(event\.type\)/g)) {
      for (const type of list[1].matchAll(/"([a-z_.]+)"/g)) handled.add(type[1]);
    }
    assert.ok(handled.size >= 4, `only ${handled.size} event types parsed from lib/sonara-billing.cjs; this check has gone blind`);

    const section = doc.slice(doc.indexOf("## Stripe webhook"), doc.indexOf("## Supabase"));
    const listed = new Set([...section.matchAll(/^- `([a-z_.]+)`$/gm)].map((match) => match[1]));
    assert.deepEqual([...listed].sort(), [...handled].sort(), "the checklist's event list and the handler's dispatch have drifted apart");
  });

  it("names a webhook path the server actually routes", () => {
    const section = doc.slice(doc.indexOf("## Stripe webhook"), doc.indexOf("## Supabase"));
    const routed = new Set([...serverSource.matchAll(/app\.post\("(\/api\/[a-z/]*(?:webhook|stripe)[a-z/]*)"/g)].map((match) => match[1]));
    const named = [...new Set([...section.matchAll(/https:\/\/[a-z.]+(\/api\/[a-z/]+)|`(\/api\/[a-z/]+)`/g)].map((match) => match[1] || match[2]))];
    assert.ok(named.length > 0, "the checklist names no webhook path");
    const unrouted = named.filter((route) => !routed.has(route));
    assert.deepEqual(unrouted, [], `the checklist points Stripe at paths the server does not serve: ${unrouted.join(", ")}`);
  });

  it("does not promise that a configured env var means a live webhook", () => {
    // /readiness reports payment updates as "configured" from the presence of
    // STRIPE_WEBHOOK_SECRET. That is a check on the environment, not on Stripe
    // having an endpoint pointed here, and the two can disagree silently.
    const webhookSection = doc.slice(doc.indexOf("## Stripe webhook"), doc.indexOf("## Supabase"));
    // Whitespace-tolerant: the sentence wraps, so \s+ rather than a literal
    // space. Matching a fixed string here would fail on a reflow.
    assert.match(
      webhookSection.replace(/\s+/g, " "),
      /not a check on Stripe having a live endpoint/i,
      "the checklist does not warn that readiness only checks the env var"
    );
  });

  it("carries no retired public product names", () => {
    // AGENTS.md: retired names stay in docs/archive/legacy-names.md. The
    // retired-price section names the old plans on purpose, so it is exempt.
    assert.ok(!OPERATIVE.includes("SONARA OS"), "a retired public name appears in the operative checklist");
  });
});
