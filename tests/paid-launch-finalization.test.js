const assert = require("node:assert");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const request = require("supertest");
const app = require("../server");

const root = path.join(__dirname, "..");
const applyScript = path.join(root, "scripts", "apply-paid-launch-finalization.cjs");
const ENV_KEYS = [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER_MONTHLY",
  "STRIPE_PRICE_CORE_MONTHLY",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME"
];

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function setConfiguredCommerceEnv() {
  process.env.RESEND_API_KEY = "re_sonaraConfigured123456789";
  process.env.RESEND_FROM_EMAIL = "SONARA Industries <no-reply@sonaraindustries.com>";
  process.env.STRIPE_SECRET_KEY = "sk_test_sonaraConfigured123456789";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_sonaraConfigured123456789";
  process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_sonaraStarter123456789";
  process.env.STRIPE_PRICE_CORE_MONTHLY = "price_sonaraCore123456789";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_sonaraPro123456789";
  process.env.STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME = "price_sonaraSetup123456789";
}

describe("paid launch finalization", () => {
  it("applies the finalization patch idempotently", function() {
    execFileSync(process.execPath, [applyScript], { cwd: root, stdio: "pipe" });
    execFileSync(process.execPath, [applyScript], { cwd: root, stdio: "pipe" });
  });

  it("accepts Resend's documented friendly-name sender format", async function() {
    const snapshot = snapshotEnv();
    setConfiguredCommerceEnv();
    try {
      const response = await request(app).get("/api/readiness").set("Accept", "application/json");
      assert.equal(response.status, 200);
      assert.equal(response.body.services.resend, "configured");
      assert.equal(response.body.services.emailDelivery, "enabled");
      assert.deepEqual(response.body.invalid.resend, []);
    } finally {
      restoreEnv(snapshot);
    }
  });

  it("continues to reject placeholder addresses inside a friendly name", async function() {
    const snapshot = snapshotEnv();
    setConfiguredCommerceEnv();
    process.env.RESEND_FROM_EMAIL = "SONARA Industries <you@example.com>";
    try {
      const response = await request(app).get("/api/readiness").set("Accept", "application/json");
      assert.equal(response.body.services.resend, "invalid");
      assert.equal(response.body.services.emailDelivery, "invalid");
      assert.deepEqual(response.body.invalid.resend, ["RESEND_FROM_EMAIL"]);
    } finally {
      restoreEnv(snapshot);
    }
  });

  it("records owner approval while preserving the legal-review gate", async function() {
    const response = await request(app).get("/legal/terms").set("Accept", "text/html");
    assert.equal(response.status, 200);
    assert.match(response.text, /Owner-approved launch baseline/);
    assert.match(response.text, /qualified legal review remains required/);
    assert.match(response.text, /not represented as attorney-reviewed/);
    assert.match(response.text, /not legal advice/);
    assert.doesNotMatch(response.text, /Owner-review-required draft/);

    const readiness = await request(app).get("/api/readiness").set("Accept", "application/json");
    assert.equal(readiness.body.services.legalPages, "review_required");
    assert.equal(readiness.body.services.ownerLegalApproval, "owner_approved");
    assert.equal(readiness.body.services.pricingCatalog, "owner_approved");
    assert.equal(readiness.body.services.legalReviewBoundary, "not_attorney_reviewed");
  });

  it("retains the owner-approved affordable pricing catalog", async function() {
    const response = await request(app).get("/pricing").set("Accept", "text/html");
    assert.equal(response.status, 200);
    for (const expected of ["$0", "$7/mo", "$19/mo", "$39/mo", "One-time"]) {
      assert.match(response.text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("reports every configured Stripe checkout gate without granting paid access", async function() {
    const snapshot = snapshotEnv();
    setConfiguredCommerceEnv();
    try {
      const readiness = await request(app).get("/api/readiness").set("Accept", "application/json");
      assert.equal(readiness.body.services.stripe, "configured");
      assert.equal(readiness.body.services.stripeWebhook, "configured");
      assert.equal(readiness.body.services.checkout, "enabled");
      for (const plan of ["starter_monthly", "core_monthly", "pro_monthly", "business_builder_one_time"]) {
        assert.equal(readiness.body.checkoutPlans[plan].checkout, "enabled");
      }

      const billing = await request(app).get("/api/billing/status").set("Accept", "application/json");
      assert.equal(billing.status, 200);
      assert.equal(billing.body.checkout, "enabled");
      assert.equal(billing.body.stripe, "configured");
      assert.equal(billing.body.paidStatus, "not_verified");
    } finally {
      restoreEnv(snapshot);
    }
  });
});
