// Check the Stripe configuration the deployed app actually uses.
//
// This script verifies the real server-side plan table and, when a Stripe key
// is available, compares every configured Stripe Price object against what the
// pricing page advertises. Under --require-live, a missing price is a failure
// only when that plan is actually offered by the current pricing ladder.
// Superseded plans that the page intentionally hides are not release blockers.

import { existsSync, readFileSync } from "node:fs";

const { STRIPE_PLANS } = await import("../server.js").then((m) => m.default || m);
const { offeredPlanKeys } = await import("../lib/sonara-stripe-plans.cjs").then((m) => m.default || m);
const { CONNECT_WEBHOOK_EVENTS } = await import("../lib/sonara-connected-checkout.cjs").then((m) => m.default || m);

let failed = false;
const ok = (message) => console.log(`[OK] ${message}`);
const fail = (message) => {
  console.error(`[FAIL] ${message}`);
  failed = true;
};
const skip = (message) => console.log(`[SKIP] ${message}`);
let comparedLivePrices = false;

// ---------------------------------------------------------------------------
// 1. Offline checks
// ---------------------------------------------------------------------------

const quotedPlans = Object.entries(STRIPE_PLANS).filter(([, config]) => config.quoted);
for (const [plan] of quotedPlans) {
  ok(`${plan} is quoted, so it is not sold through checkout and has no price to compare`);
}

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
const isPlaceholder = (value) => !value || /^(?:changeme|placeholder|your[_-]|xxx|todo)/i.test(value) || String(value).includes("...");
const isStripePriceId = (value) => /^price_[A-Za-z0-9]+$/.test(String(value || "").trim()) && !isPlaceholder(value);
const requireLive = process.argv.includes("--require-live");
const requireConnectCanary = process.argv.includes("--require-connect-canary");
let connectCanaryVerified = false;

function configuredPriceFor(config) {
  const names = [config.env].filter(Boolean);
  const values = names.map((name) => process.env[name]).filter(Boolean);
  return { names, values, priceId: values.find(isStripePriceId) };
}

// Use the exact same ladder-selection rule as /pricing. A valid-looking Price ID
// means checkout can attempt that plan; Stripe itself is checked below. This is
// intentionally separate from live validation so a wrong-account/archived/
// wrong-amount replacement still becomes the plan the verifier inspects and
// then fails for the real reason.
const offeredPlans = new Set(
  offeredPlanKeys((plan) => {
    if (plan === "free") return "enabled";
    const config = STRIPE_PLANS[plan];
    if (!config || config.quoted || !config.env) return "setup_required";
    return configuredPriceFor(config).priceId ? "enabled" : "setup_required";
  })
);

const looksLikeStripeKey = /^(?:sk|rk)_/.test(String(secret || ""));

if (!isPlaceholder(secret) && !looksLikeStripeKey) {
  const message = "STRIPE_SECRET_KEY is set but does not look like a Stripe API key (sk_... or rk_...), so live prices cannot be compared.";
  if (requireLive) fail(`${message} --require-live was passed, so not comparing is a failure.`);
  else skip(message);
} else if (isPlaceholder(secret) || !looksLikeStripeKey) {
  const message = "STRIPE_SECRET_KEY is not set, so live prices cannot be compared. Verify the amounts by hand -- see docs/pricing/2026-07-28-COMPETITOR-PRICING.md. A restricted key (rk_...) with read access to Prices is enough; this script only reads prices.";
  if (requireLive) fail(`${message} --require-live was passed, so not comparing is a failure.`);
  else skip(message);
} else {
  for (const [plan, config] of paidPlans) {
    const { names, values, priceId } = configuredPriceFor(config);

    if (!priceId) {
      if (values.length) {
        fail(
          `${plan}: ${names.filter((name) => process.env[name]).join(" / ")} is set but does not hold a Stripe price id. ` +
            "If this ran against an environment pulled from Vercel, the variable is probably marked sensitive there and pulls through redacted; " +
            "a price id is not a secret and does not need that flag."
        );
        continue;
      }

      const message = `${plan} has no Stripe price configured yet, so it cannot be sold and there is nothing to compare`;
      if (requireLive && offeredPlans.has(plan)) {
        fail(`${message}. It is offered on the pricing page, so --require-live treats that as unfinished.`);
      } else if (requireLive) {
        skip(`${message}. It is not offered by the current pricing ladder, so it is not a release blocker.`);
      } else {
        skip(message);
      }
      continue;
    }

    let price;
    try {
      const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}?expand[]=product`, {
        headers: { authorization: `Bearer ${secret}` }
      });

      if (!response.ok) {
        let detail = "";
        try {
          const body = await response.json();
          if (body?.error?.message) detail = ` -- Stripe said: ${body.error.message}`;
        } catch {
          // Keep the HTTP status when Stripe returns a non-JSON error body.
        }

        const hint = response.status === 403
          ? " A 403 is a permissions answer, not a missing price: the key is valid but is not allowed to read this. This request expands the product, so the restricted key needs BOTH Prices:read and Products:read."
          : response.status === 404
            ? " A 404 means no price with that id exists on the account this key belongs to -- check the id, and check live against test mode."
            : "";

        fail(`${plan}: Stripe returned ${response.status} for its configured price${detail}.${hint}`);
        continue;
      }

      price = await response.json();
    } catch {
      const message = `${plan}: could not reach Stripe; amounts not compared`;
      if (requireLive) fail(message);
      else skip(message);
      continue;
    }

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

if (requireLive && !comparedLivePrices) {
  fail("--require-live was passed and no live price was compared, so this run proves nothing about what Stripe charges");
}

// ---------------------------------------------------------------------------
// 3. Read-only Connect canary readiness
// ---------------------------------------------------------------------------
//
// This never creates a connected account, Checkout Session, charge, refund,
// dispute, transfer or payout. It answers whether the external Stripe side is
// ready for the existing direct-charge storefront/marketplace implementation to
// run one separately approved canary.
if (requireConnectCanary) {
  if (isPlaceholder(secret) || !/^sk_(?:test|live)_[A-Za-z0-9_]+$/.test(String(secret || ""))) {
    fail("--require-connect-canary needs a Stripe secret key with read access to Accounts and Webhook Endpoints");
  } else {
    const mode = String(process.env.SONARA_CUSTOMER_FUNDS_MODE || "");
    const enabled = String(process.env.STRIPE_CONNECT_ENABLED || "").toLowerCase();
    const webhookSecret = String(process.env.STRIPE_CONNECT_WEBHOOK_SECRET || "");
    const rawOrigin = String(
      process.env.PUBLIC_SITE_URL ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ""
    ).replace(/\/+$/, "");

    if (mode !== "connect_direct_reviewed") {
      fail(`Connect canary mode is ${JSON.stringify(mode || "unset")}; expected connect_direct_reviewed`);
    }
    if (enabled !== "true") fail("STRIPE_CONNECT_ENABLED is not true");
    if (!/^whsec_[A-Za-z0-9]{16,}$/.test(webhookSecret)) {
      fail("STRIPE_CONNECT_WEBHOOK_SECRET is missing or malformed");
    }

    let expectedWebhookUrl = "";
    try {
      const origin = new URL(rawOrigin);
      if (origin.protocol !== "https:" || origin.origin !== rawOrigin) throw new Error("origin required");
      expectedWebhookUrl = `${origin.origin}/api/webhooks/stripe-connect`;
    } catch {
      fail("A canonical HTTPS site origin is required to verify the Connect webhook endpoint");
    }

    const stripeRead = async (pathname) => {
      try {
        const response = await fetch(`https://api.stripe.com${pathname}`, {
          headers: { authorization: `Bearer ${secret}` }
        });
        if (!response.ok) {
          let detail = "";
          try {
            const body = await response.json();
            if (body?.error?.message) detail = `: ${body.error.message}`;
          } catch {}
          fail(`Stripe read ${pathname} returned HTTP ${response.status}${detail}`);
          return null;
        }
        return await response.json();
      } catch {
        fail(`Could not reach Stripe for read-only Connect verification: ${pathname}`);
        return null;
      }
    };

    const accounts = await stripeRead("/v1/accounts?limit=100");
    const eligibleAccounts = Array.isArray(accounts?.data)
      ? accounts.data.filter((account) =>
          account &&
          account.charges_enabled === true &&
          account.payouts_enabled === true &&
          account.details_submitted === true
        )
      : [];
    if (eligibleAccounts.length === 0) {
      fail("No connected Stripe account is fully submitted with charges and payouts enabled");
    } else {
      ok(`Connect has ${eligibleAccounts.length} connected account(s) eligible for a separately approved direct-charge canary`);
    }

    const endpoints = await stripeRead("/v1/webhook_endpoints?limit=100");
    const candidate = Array.isArray(endpoints?.data) && expectedWebhookUrl
      ? endpoints.data.find((endpoint) =>
          endpoint?.status === "enabled" &&
          endpoint?.url === expectedWebhookUrl &&
          endpoint?.connect === true
        )
      : null;

    if (!candidate) {
      fail(`No enabled Connect webhook endpoint exactly matches ${expectedWebhookUrl || "the canonical production URL"}`);
    } else {
      const enabledEvents = new Set(Array.isArray(candidate.enabled_events) ? candidate.enabled_events : []);
      const missingEvents = CONNECT_WEBHOOK_EVENTS.filter((event) =>
        !enabledEvents.has("*") && !enabledEvents.has(event)
      );
      if (missingEvents.length) {
        fail(`Connect webhook is missing required event(s): ${missingEvents.join(", ")}`);
      } else {
        ok("Connect webhook endpoint covers every event the application can settle or reverse");
      }
    }

    if (
      mode === "connect_direct_reviewed" &&
      enabled === "true" &&
      /^whsec_[A-Za-z0-9]{16,}$/.test(webhookSecret) &&
      expectedWebhookUrl &&
      eligibleAccounts.length > 0 &&
      candidate &&
      CONNECT_WEBHOOK_EVENTS.every((event) => {
        const set = new Set(Array.isArray(candidate.enabled_events) ? candidate.enabled_events : []);
        return set.has("*") || set.has(event);
      })
    ) {
      connectCanaryVerified = true;
    }
  }

  if (!connectCanaryVerified) {
    fail("--require-connect-canary was passed and the external Connect prerequisites are not complete");
  }
}

if (failed) {
  console.error("\nStripe configuration verification failed.");
  process.exit(1);
}

if (comparedLivePrices) {
  console.log(
    connectCanaryVerified
      ? "\nStripe configuration verified against live prices and read-only Connect canary prerequisites."
      : "\nStripe configuration verified against the deployed server, including live prices."
  );
} else {
  console.log(
    "\nStripe configuration verified offline: every paid plan names a variable, .env.example declares it, " +
    "and the page agrees with the configured amount.\nLive prices were NOT compared in this run, so what " +
    "Stripe would actually charge is unconfirmed here. lib/sonara-billing.cjs compares them at checkout, " +
    "where the key is always present."
  );
}
