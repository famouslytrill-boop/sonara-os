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
  const expected = config.amountCents === 0 ? "$0" : `$${config.amountCents / 100}/mo`;
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

if (isPlaceholder(secret) || !secret.startsWith("sk_")) {
  skip("STRIPE_SECRET_KEY is not set, so live prices cannot be compared. Verify the amounts by hand -- see docs/pricing/2026-07-28-COMPETITOR-PRICING.md.");
} else {
  for (const [plan, config] of paidPlans) {
    const priceId = [config.env, ...(config.envAliases || [])].map((name) => process.env[name]).find((value) => value && value.startsWith("price_"));

    if (!priceId) {
      skip(`${plan} has no Stripe price configured yet, so it cannot be sold and there is nothing to compare`);
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
    if (config.mode === "subscription" && price.recurring?.interval !== "month") {
      fail(`${plan}: the pricing page says "/mo" but Stripe bills ${price.recurring?.interval || "one-off"}`);
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
