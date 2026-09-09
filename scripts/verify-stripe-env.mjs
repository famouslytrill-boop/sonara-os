// Check the Stripe configuration the deployed app actually uses.
//
// This script used to assert on `app/api/stripe/checkout/route.ts`,
// `lib/stripe.ts`, and environment variables named STRIPE_PRICE_STARTER,
// STRIPE_PRICE_AGENCY, STRIPE_PRICE_SETUP_99 and so on. None of those are read
// by the running server: Vercel serves `api/index.js`, which mounts
// `server.js`, and server.js reads STRIPE_PRICE_STARTER_MONTHLY,
// STRIPE_PRICE_CORE_MONTHLY and STRIPE_PRICE_PRO_MONTHLY. The check was
// describing a different application, and failed on every run without anybody
// noticing because no workflow calls it.
//
// It now checks the real thing, in two parts:
//
//   1. Offline: every paid plan names an environment variable, .env.example
//      declares it, and the price the pricing page prints agrees with the
//      amountCents the config holds.
//   2. Online, only when STRIPE_SECRET_KEY is present: fetch each configured
//      Price from Stripe and confirm the amount, currency, and interval match
//      what the page advertises. Stripe prices are immutable, so a price
//      created at the wrong amount can only be found by looking.
//
// The online half also refuses a plan that advertises no amount at all while
// Stripe holds a real one. That was previously skipped, and it is the case
// where a customer can least tell what they are agreeing to: the page says
// "One-time", and the first number they see is on Stripe's checkout page.
//
// Without a key the online half is skipped and said to be skipped. It never
// prints a key, a price ID, or any other secret.

import { existsSync, readFileSync } from "node:fs";

const { STRIPE_PLANS } = await import("../server.js").then((m) => m.default || m);

let failed = false;
const ok = (message) => console.log(`[OK] ${message}`);
const fail = (message) => {
  console.error(`[FAIL] ${message}`);
  failed = true;
};
let comparedLivePrices = false;
const skip = (message) => console.log(`[SKIP] ${message}`);

// ---------------------------------------------------------------------------
// 1. Offline checks
// ---------------------------------------------------------------------------

// Quoted plans declare no price environment variable on purpose, so they are
// not part of the price comparison. Named rather than silently absent, because
// "no env var" used to be how the undisclosed $197 charge stayed invisible.
const quotedPlans = Object.entries(STRIPE_PLANS).filter(([, config]) => config.quoted);
for (const [plan] of quotedPlans) ok(`${plan} is quoted, so it is not sold through checkout and has no price to compare`);

const paidPlans = Object.entries(STRIPE_PLANS).filter(([, config]) => config.env && !config.quoted);
if (!paidPlans.length) fail("no paid plan declares a Stripe price environment variable");

const envExample = existsSync(".env.example") ? readFileSync(".env.example", "utf8") : "";
if (!envExample) fail("missing .env.example");

for (const [plan, config] of paidPlans) {
  if (envExample.includes(`${config.env}=`)) ok(`.env.example declares ${config.env}`);
  else fail(`.env.example does not declare ${config.env}, which ${plan} needs`);
}

for (const [plan, config] of Object.entries(STRIPE_PLANS)) {
  if (config.amountCents === null || config.amountCents === undefined) continue;
  // The suffix is the billing period. This was "/mo" for every plan, which made
  // a yearly price impossible to write correctly -- the only string it accepted
  // for $190 a year was "$190/mo".
  const period = config.billedAnnually ? "/yr" : "/mo";
  const expected = config.amountCents === 0 ? "$0" : `$${config.amountCents / 100}${period}`;
  if (config.price === expected) ok(`${plan} advertises ${config.price}, matching its configured amount`);
  else fail(`${plan} advertises "${config.price}" but its configured amount is ${config.amountCents} cents`);
}

const serverSource = readFileSync("server.js", "utf8");
if (/constructEvent|stripe-signature/i.test(serverSource)) ok("Stripe webhook signature verification is present");
else fail("no Stripe webhook signature verification found in server.js");

// ---------------------------------------------------------------------------
// 2. Online checks
// ---------------------------------------------------------------------------

const secret = process.env.STRIPE_SECRET_KEY;
const isPlaceholder = (value) => !value || /^(?:changeme|placeholder|your[_-]|xxx|todo)/i.test(value) || value.includes("...");
const isStripePriceId = (value) => /^price_[A-Za-z0-9]+$/.test(String(value || "").trim()) && !isPlaceholder(value);

// --require-live turns every reason this script has for not comparing into a
// failure, so the run's exit code means what its last line says.
//
// Without it the online half skips and the script exits 0, and both
// docs/owner/OWNER-STEPS.md and docs/owner/PRICE-CUTOVER-RUNBOOK.md have to
// tell the owner to "read the last line rather than the exit code". That
// instruction was followed exactly as written and the thing it guards against
// happened anyway: on 8 September 2026 the live pricing page advertised
// $29/$59/$109 while acct_1TRSqj0dKtlEU3lA held no price at any of those
// amounts, so every headline plan refused checkout with `price_mismatch`. A
// green run had been recorded before the cutover and told nobody.
//
// So the cutover step is now a command that fails rather than a paragraph
// somebody has to read carefully.
const requireLive = process.argv.includes("--require-live");

// `rk_` is accepted as well as `sk_`, and that is the point rather than a
// loosening.
//
// Everything this script does with the key is one call: GET /v1/prices/{id}.
// A Stripe *restricted* key with read access to Prices covers it, and a
// restricted key that leaks cannot charge anybody, refund anybody, or read a
// customer. Requiring `sk_` meant the only key that worked here was the one
// that can do everything -- and this now runs inside
// .github/workflows/controlled-production-deploy.yml, so that was a full
// live secret key sitting in CI to perform three reads.
//
// Rejecting `rk_` was also silent in the worst way: a restricted key fell into
// the branch below and was reported as "STRIPE_SECRET_KEY is not set", sending
// somebody to set a variable they had already set.
const looksLikeStripeKey = /^(?:sk|rk)_/.test(String(secret || ""));

if (!isPlaceholder(secret) && !looksLikeStripeKey) {
  // Present, and not a Stripe API key. A third state, and neither of the two
  // messages below describes it. The value is never printed.
  const message = "STRIPE_SECRET_KEY is set but does not look like a Stripe API key (sk_... or rk_...), so live prices cannot be compared.";
  if (requireLive) fail(`${message} --require-live was passed, so not comparing is a failure.`);
  else skip(message);
} else if (isPlaceholder(secret) || !looksLikeStripeKey) {
  const message = "STRIPE_SECRET_KEY is not set, so live prices cannot be compared. Verify the amounts by hand -- see docs/pricing/2026-07-28-COMPETITOR-PRICING.md. A restricted key (rk_...) with read access to Prices is enough; this script only reads prices.";
  if (requireLive) fail(`${message} --require-live was passed, so not comparing is a failure.`);
  else skip(message);
} else {
  for (const [plan, config] of paidPlans) {
    const names = [config.env, ...(config.envAliases || [])];
    const values = names.map((name) => process.env[name]).filter(Boolean);
    const priceId = values.find(isStripePriceId);

    if (!priceId) {
      // Set-but-unusable is a different fault from unset, and it looked
      // identical here: `.find(v => v.startsWith("price_"))` returns undefined
      // for both, so a variable holding something that is not a price id was
      // reported as "no Stripe price configured yet".
      //
      // The case that matters is not hypothetical. This check is meant to run
      // inside .github/workflows/controlled-production-deploy.yml against an
      // environment pulled with `vercel env pull`, and that workflow already
      // records why: "Sensitive variables pulled from Vercel are not returned
      // as plaintext." A price id marked sensitive in Vercel therefore arrives
      // redacted, and the old message would have sent somebody to create a
      // price that already exists.
      //
      // The value is never printed. It is configuration, and on this path it
      // may be a redaction marker of unknown shape.
      if (values.length) {
        fail(
          `${plan}: ${names.filter((name) => process.env[name]).join(" / ")} is set but does not hold a Stripe price id. ` +
            "If this ran against an environment pulled from Vercel, the variable is probably marked sensitive there and pulls through redacted; " +
            "a price id is not a secret and does not need that flag."
        );
        continue;
      }

      // A plan the page deliberately does not show yet is allowed to have no
      // price; a plan on the page is not. hiddenUntilBuyable is the same flag
      // lib/sonara-readiness.cjs uses to report a price as deferred rather than
      // missing, so the two agree about which absences are intended.
      const message = `${plan} has no Stripe price configured yet, so it cannot be sold and there is nothing to compare`;
      if (requireLive && !config.hiddenUntilBuyable) fail(`${message}. It is offered on the pricing page, so --require-live treats that as unfinished.`);
      else skip(message);
      continue;
    }

    let price;
    try {
      // The product is expanded because lib/sonara-billing.cjs expands it and
      // refuses `price_product_archived` at checkout. Without it this check
      // passed a configuration the running server rejects: archiving a product
      // in Stripe does not clear its prices' active flag, so `price.active`
      // alone reads true and only the product says otherwise. Two checks of the
      // same property that disagree are worse than one, because the release
      // output is the one people read.
      const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}?expand[]=product`, {
        headers: { authorization: `Bearer ${secret}` }
      });
      if (!response.ok) {
        fail(`${plan}: Stripe returned ${response.status} for its configured price`);
        continue;
      }
      price = await response.json();
    } catch (error) {
      // A network failure is not a configuration failure. Say so rather than
      // failing a deploy over a blip.
      skip(`${plan}: could not reach Stripe (${error.message}); amounts not compared`);
      continue;
    }

    // A plan that advertises no amount is the quiet case. Until now the
    // comparison was skipped whenever amountCents was null, which is exactly
    // when nobody can tell what a customer will be charged: the page says
    // "One-time", the button says "Start checkout", and the first number the
    // customer sees is on Stripe's page after they have committed.
    //
    // This does not decide what the price should be. It refuses to let a real
    // charge stay undisclosed.
    if ((config.amountCents === null || config.amountCents === undefined) && Number.isFinite(price.unit_amount) && price.unit_amount > 0) {
      fail(
        `${plan}: the pricing page shows no amount, but Stripe will charge ` +
          `${(price.unit_amount / 100).toFixed(2)} ${String(price.currency).toUpperCase()}. ` +
          "Put the amount on the page, or make this a quoted service that does not go through checkout."
      );
      continue;
    }
    if (config.amountCents !== null && config.amountCents !== undefined && price.unit_amount !== config.amountCents) {
      fail(`${plan}: the pricing page says ${config.price} but Stripe charges ${(price.unit_amount / 100).toFixed(2)} ${String(price.currency).toUpperCase()}`);
      continue;
    }
    if (price.currency && price.currency !== "usd") {
      fail(`${plan}: the pricing page quotes dollars but Stripe charges ${String(price.currency).toUpperCase()}`);
      continue;
    }
    // Against the period the plan actually advertises, not always "month".
    // Pinned to "month" this rejected a correctly created yearly price as
    // wrong -- the check would have fired the first time the owner set up
    // annual billing, on a Stripe price that was right.
    const expectedInterval = config.billedAnnually ? "year" : "month";
    if (config.mode === "subscription" && price.recurring?.interval !== expectedInterval) {
      fail(
        `${plan}: the pricing page says "${config.billedAnnually ? "/yr" : "/mo"}" but Stripe bills ` +
          `${price.recurring?.interval || "one-off"}`
      );
      continue;
    }
    if (price.active === false) {
      fail(`${plan}: its Stripe price is archived, so checkout would fail`);
      continue;
    }
    if (price.product && typeof price.product === "object" && price.product.active === false) {
      fail(`${plan}: its Stripe price is live but the product behind it is archived, so Stripe would refuse the checkout`);
      continue;
    }
    comparedLivePrices = true;
    ok(`${plan}: Stripe charges exactly what the pricing page advertises`);
  }
}

// The guard against measuring nothing. Every claim above is satisfied by a run
// that compared no prices at all, so under --require-live the population is
// asserted before the exit code is decided.
if (requireLive && !comparedLivePrices) {
  fail("--require-live was passed and no live price was compared, so this run proves nothing about what Stripe charges");
}

if (failed) {
  console.error("\nStripe configuration verification failed.");
  process.exit(1);
}
// What this run actually established.
//
// The last line used to read "Stripe configuration verified against the deployed
// server" whether or not the live comparison ran -- and it never runs in CI,
// because STRIPE_SECRET_KEY is not present there. So every release output ended
// with a sentence claiming the amounts had been checked against Stripe when the
// [SKIP] two lines above said they had not. The skip was honest and the summary
// overwrote it, and the summary is the line people read.
if (comparedLivePrices) {
  console.log("\nStripe configuration verified against the deployed server, including live prices.");
} else {
  console.log(
    "\nStripe configuration verified offline: every paid plan names a variable, .env.example declares it, " +
    "and the page agrees with the configured amount.\nLive prices were NOT compared in this run, so what " +
    "Stripe would actually charge is unconfirmed here. lib/sonara-billing.cjs compares them at checkout, " +
    "where the key is always present."
  );
}
