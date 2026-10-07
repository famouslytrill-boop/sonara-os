// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const source = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
function recursiveCjs(dir, prefix = dir) {
  const current = path.join(ROOT, prefix);
  return fs.readdirSync(current, { withFileTypes: true }).flatMap((ent) => {
    const item = path.join(prefix, ent.name);
    if (ent.isDirectory()) return recursiveCjs(dir, item);
    return ent.isFile() && item.endsWith(".cjs") ? [item] : [];
  });
}

// Cheap source-level regression tripwire, NOT a security proof. Real release
// requires runtime route integration tests, live feature flags, and CI.
describe("fee-only money route coverage regression", () => {
  it("merchant checkout session creator has an early readiness gate", () => {
    const checkout = source("lib/sonara-connected-checkout.cjs");
    const creation = checkout.split("async function createSession")[1].split("// What reconciliation")[0];
    assert.match(creation, /checkoutReadiness\(deps\)/);
    assert.match(creation, /if \(!ready\.ok\) return/);
    assert.match(creation, /method: "POST"/);
  });
  it("all known marketplace/storefront purchase routes use guarded checkout creation", () => {
    const marketplace = source("routes/sonara-marketplace-checkout-routes.cjs");
    const merchant = source("routes/sonara-merchant-payment-routes.cjs");
    assert.match(marketplace, /checkout\.checkoutReadiness\(\{ getEnv \}\)/);
    assert.match(marketplace, /checkout\.createSession\(/);
    assert.match(merchant, /checkout\.checkoutReadiness\(stripeDeps\)/);
    assert.match(merchant, /checkout\.createSession\(/);
  });
  it("merchant account creation and onboarding are gated by Connect readiness", () => {
    const file = source("lib/sonara-connected-payments.cjs");
    for (const fn of ["createAccount", "onboardingLink", "canAcceptPayments"]) {
      const tail = file.split("async function " + fn)[1];
      assert.ok(tail, fn + " must exist");
      assert.match(tail.slice(0, 350), /connectReadiness\(deps\)/);
    }
    assert.match(file, /customerMoneyMode !== "connect_direct_reviewed"/);
  });
  it("no unchecked direct Stripe checkout session API is introduced in route/lib code", () => {
    const allowed = new Set([
      "lib/sonara-connected-checkout.cjs",
      // SONARA's own subscription billing is intentionally allowed.
      "lib/sonara-billing.cjs"
    ]);
    let checked = 0;
    for (const rel of [...recursiveCjs("lib"), ...recursiveCjs("routes")]) {
      const content = source(rel);
      const hasDirectSessionApi = content.includes("api.stripe.com/v1/checkout/sessions");
      if (hasDirectSessionApi) {
        assert.ok(allowed.has(rel.replace(/\\/g, "/")), "unreviewed Stripe checkout path in " + rel);
      }
      checked++;
    }
    const ownBilling = source("lib/sonara-billing.cjs");
    assert.match(ownBilling, /STRIPE_PLANS\[plan\]\.mode === "subscription"/);
    assert.ok(ownBilling.includes("\"https://api.stripe.com/v1/checkout/sessions\""));
    assert.doesNotMatch(ownBilling, /["']Stripe-Account["']/);
    assert.ok(checked > 10);
  });
  it("historic signed merchant webhooks remain separate from new checkout and SONARA billing", () => {
    const server = source("server.js");
    assert.match(server, /app\.post\("\/api\/webhooks\/stripe-connect"/);
    assert.match(server, /createConnectWebhookHandler/);
    assert.match(server, /app\.post\("\/api\/webhooks\/stripe"/);
    assert.match(server, /app\.post\("\/api\/checkout\/session"/);
    assert.match(server, /app\.post\("\/api\/billing\/create-portal-session"/);
  });
  it("sample env says external-only even if old Connect account was available", () => {
    const sample = source(".env.example");
    assert.match(sample, /^SONARA_CUSTOMER_FUNDS_MODE=external_only$/m);
    assert.match(sample, /^STRIPE_CONNECT_ENABLED=false$/m);
  });
});
