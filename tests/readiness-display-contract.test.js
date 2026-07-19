const assert = require("node:assert/strict");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const request = require("supertest");
const app = require("../server");

const root = path.join(__dirname, "..");
const applyScript = path.join(root, "scripts", "apply-readiness-display-contract.cjs");
const ENV_KEYS = [
  "VERCEL_ENV",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_REF",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FOUNDER_EMAILS",
  "ADMIN_EMAILS",
  "ADMIN_EMAIL"
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

function cardHeadingCount(html, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (html.match(new RegExp(`<h2>${escaped}</h2>`, "g")) || []).length;
}

describe("readiness display contract", () => {
  it("applies the runtime patch idempotently", function() {
    execFileSync(process.execPath, [applyScript], { cwd: root, stdio: "pipe" });
    execFileSync(process.execPath, [applyScript], { cwd: root, stdio: "pipe" });
  });

  it("renders one canonical card per human-facing readiness concept", async function() {
    const snapshot = snapshotEnv();
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_SHA = "preview123";
    process.env.VERCEL_GIT_COMMIT_REF = "codex/readiness-preview";
    process.env.ADMIN_EMAIL = "owner@sonaraindustries.com";
    delete process.env.FOUNDER_EMAILS;
    delete process.env.ADMIN_EMAILS;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const response = await request(app)
        .get("/business-builder/launch-readiness")
        .set("Accept", "text/html");

      assert.equal(response.status, 200);
      const headings = [
        "Deployment environment",
        "Account database",
        "Payment connection",
        "Payment updates",
        "Email delivery",
        "Google sign-in",
        "Founder/Admin protection",
        "Checkout",
        "Owner legal approval",
        "Pricing catalog",
        "Legal pages",
        "Legal review boundary"
      ];

      for (const heading of headings) {
        assert.equal(cardHeadingCount(response.text, heading), 1, `${heading} should render exactly once`);
      }

      assert.match(response.text, /Preview deployment/);
      assert.match(response.text, /Preview-scoped configuration only/);
      assert.match(response.text, /preview123/);
      assert.match(response.text, /codex\/readiness-preview/);
      assert.doesNotMatch(response.text, /<h2>Founder access<\/h2>/);
      assert.doesNotMatch(response.text, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|ADMIN_EMAIL/);
    } finally {
      restoreEnv(snapshot);
    }
  });

  it("keeps machine-readable readiness aliases unchanged", async function() {
    const snapshot = snapshotEnv();
    process.env.VERCEL_ENV = "preview";
    process.env.ADMIN_EMAIL = "owner@sonaraindustries.com";
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const response = await request(app)
        .get("/api/readiness")
        .set("Accept", "application/json");

      assert.equal(response.status, 200);
      assert.equal(response.body.services.supabase, "missing");
      assert.equal(response.body.services.accountDatabase, "missing");
      assert.equal(response.body.services.founderAccess, "configured");
      assert.equal(response.body.services.adminProtection, "missing");
    } finally {
      restoreEnv(snapshot);
    }
  });
});
