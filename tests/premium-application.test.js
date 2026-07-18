const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");

const SUPABASE_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

function snapshotEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function setSupabaseEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
}

function customerFetchMock() {
  return async (url) => {
    if (String(url).includes("/auth/v1/user")) {
      return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000301", email: "customer@example.com" }) };
    }
    return { ok: false, json: async () => [] };
  };
}

describe("premium application rebuild", () => {
  describe("brand system", () => {
    for (const asset of [
      "/brand/sonara-industries-mark.svg",
      "/brand/sonara-industries-logo.svg",
      "/brand/sonara-os-mark.svg",
      "/brand/business-builder-mark.svg",
      "/brand/creator-studio-mark.svg",
      "/brand/growth-studio-mark.svg",
      "/brand/admin-mark.svg",
      "/brand/sonara-mark-mono.svg",
      "/brand/sonara-mark-light.svg"
    ]) {
      it(`serves ${asset}`, async function() {
        const res = await request(app).get(asset);
        assert.equal(res.status, 200);
        assert.match(res.headers["content-type"], /svg/);
        assert.match(res.body.toString("utf8"), /<title>/);
      });
    }

    it("favicon uses the v2 mark and keeps the accessible label", async function() {
      const res = await request(app).get("/favicon.svg");
      assert.equal(res.status, 200);
      const body = res.body.toString("utf8");
      assert.match(body, /SONARA Industries/);
      assert.match(body, /fav-wave/);
    });

    it("header shows the brand mark on every page", async function() {
      const res = await request(app).get("/").set("Accept", "text/html");
      assert.match(res.text, /sonara-brand-mark/);
      assert.match(res.text, /\/brand\/sonara-industries-mark\.svg/);
    });
  });

  describe("app frame v2", () => {
    it("homepage tells the Software-in-a-Service story in plain words", async function() {
      const res = await request(app).get("/").set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.match(res.text, /SONARA turns business, creator, and growth work into guided software workflows/);
      assert.match(res.text, /How SONARA works/);
      assert.match(res.text, /Free tools preview/);
      assert.match(res.text, /Paid workflows preview/);
      assert.match(res.text, /Trust and readiness/);
    });

    it("header exposes the command palette trigger", async function() {
      const res = await request(app).get("/").set("Accept", "text/html");
      assert.match(res.text, /data-sonara-command/);
      assert.match(res.text, /sonara-command-button/);
    });

    it("interface engine ships palette, haptics, and safety guards", function() {
      const engine = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-interface-engine.js"), "utf8");
      assert.match(engine, /sonara-command-palette/);
      assert.match(engine, /navigator\.vibrate/);
      assert.match(engine, /localStorage/);
      assert.match(engine, /prefers-reduced-motion/);
      assert.doesNotMatch(engine, /requestAdapter/);
    });

    it("settings page offers the haptics disable toggle", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock();
      try {
        const res = await request(app).get("/settings").set("Authorization", "Bearer customer-session").set("Accept", "text/html");
        assert.equal(res.status, 200);
        assert.match(res.text, /Haptic feedback/);
        assert.match(res.text, /data-sonara-haptics-toggle/);
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });

    it("design tokens v2 exist in the brand system stylesheet", function() {
      const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-brand-system.css"), "utf8");
      assert.match(styles, /sonara-tokens-v2/);
      assert.match(styles, /--sonara-motion-base/);
      assert.match(styles, /--sonara-status-critical/);
    });
  });

  describe("service catalog v2 and lifecycle", () => {
    it("catalog items carry inputs, turnaround, deliverable type, and access tier", async function() {
      const res = await request(app).get("/service-catalog").set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.match(res.text, /Launch Offer Builder/);
      assert.match(res.text, /Consent-Safe Outreach Checklist/);
      assert.match(res.text, /Inputs:/);
      assert.match(res.text, /Turnaround:/);
      assert.match(res.text, /Deliverable:/);
      assert.match(res.text, /Access: (Free tool|Paid service)/);
    });

    it("requests page shows the canonical ten-state lifecycle", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock();
      try {
        const res = await request(app).get("/requests").set("Authorization", "Bearer customer-session").set("Accept", "text/html");
        assert.equal(res.status, 200);
        for (const label of ["Draft", "Needs customer info", "Approved", "Complete", "Blocked", "Setup required"]) {
          assert.match(res.text, new RegExp(label), `${label} missing from lifecycle`);
        }
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });
  });

  describe("product isolation routes", () => {
    it("product request views are scoped per product", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock();
      try {
        for (const [route, name] of [
          ["/business-builder/requests", "Business Builder requests"],
          ["/creator-studio/requests", "Creator Studio requests"],
          ["/growth-studio/requests", "Growth Studio requests"]
        ]) {
          const res = await request(app).get(route).set("Authorization", "Bearer customer-session").set("Accept", "text/html");
          assert.equal(res.status, 200, `${route} should render for a logged-in customer`);
          assert.match(res.text, new RegExp(name));
        }
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });

    it("content planning pages exist for creator and growth studios", async function() {
      for (const route of ["/creator-studio/content", "/growth-studio/content"]) {
        const res = await request(app).get(route).set("Accept", "text/html");
        assert.equal(res.status, 200);
        assert.doesNotMatch(res.text, /â€¢/);
      }
    });

    it("business operations pages require login and never fake data", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      for (const key of SUPABASE_KEYS) delete process.env[key];
      try {
        for (const route of ["/business-builder/inventory", "/business-builder/vendors", "/business-builder/locations"]) {
          const res = await request(app).get(route).set("Accept", "text/html");
          assert.equal(res.status, 303, `${route} should redirect anonymous browsers`);
          assert.equal(res.headers.location, "/login");
        }
      } finally {
        restoreEnv(snapshot);
      }
    });

    it("admin integrations view requires founder access", async function() {
      const res = await request(app).get("/admin/integrations").set("Accept", "application/json");
      assert.ok([401, 503].includes(res.status));
      assert.equal(res.body.ok, false);
    });
  });

  describe("PWA and caching", () => {
    it("service worker uses a versioned cache with stale-asset replacement", async function() {
      const res = await request(app).get("/sw.js");
      assert.equal(res.status, 200);
      assert.match(res.text, /clark-ui-20260718-preferences/);
      assert.match(res.text, /stale-while-revalidate/i);
      assert.match(res.text, /caches\.delete/);
    });
  });

  describe("optional AI gateway flags", () => {
    const { getOptionalAiGatewayReadiness, AI_GATEWAY_ENV_KEYS } = require("../lib/optional-ai-gateway.cjs");
    const GATEWAY_KEYS = [
      ...AI_GATEWAY_ENV_KEYS.enabled,
      ...AI_GATEWAY_ENV_KEYS.baseUrl,
      ...AI_GATEWAY_ENV_KEYS.apiKey,
      ...AI_GATEWAY_ENV_KEYS.model
    ];

    it("OMNIROUTE_ENABLED=false disables the gateway even with a URL set", function() {
      const snapshot = snapshotEnv(GATEWAY_KEYS);
      for (const key of GATEWAY_KEYS) delete process.env[key];
      process.env.OMNIROUTE_ENABLED = "false";
      process.env.OMNIROUTE_BASE_URL = "http://localhost:20128/v1";
      try {
        const readiness = getOptionalAiGatewayReadiness();
        assert.equal(readiness.enabled, false);
        assert.equal(readiness.status, "disabled");
      } finally {
        restoreEnv(snapshot);
      }
    });

    it("reports the requested model without exposing keys", function() {
      const snapshot = snapshotEnv(GATEWAY_KEYS);
      for (const key of GATEWAY_KEYS) delete process.env[key];
      process.env.OMNIROUTE_BASE_URL = "http://localhost:20128/v1";
      process.env.OMNIROUTE_API_KEY = "secret-gateway-key";
      process.env.OMNIROUTE_MODEL = "auto";
      try {
        const readiness = getOptionalAiGatewayReadiness();
        assert.equal(readiness.status, "configured");
        assert.equal(readiness.model, "auto");
        assert.ok(!JSON.stringify(readiness).includes("secret-gateway-key"));
      } finally {
        restoreEnv(snapshot);
      }
    });
  });

  describe("infrastructure files", () => {
    it("Dockerfile is production-safe", function() {
      const dockerfile = fs.readFileSync(path.join(__dirname, "..", "Dockerfile"), "utf8");
      assert.match(dockerfile, /USER node/);
      assert.match(dockerfile, /HEALTHCHECK/);
      assert.doesNotMatch(dockerfile, /SUPABASE_SERVICE_ROLE_KEY=|STRIPE_SECRET_KEY=|sk_live|whsec_/);
      const dockerignore = fs.readFileSync(path.join(__dirname, "..", ".dockerignore"), "utf8");
      assert.match(dockerignore, /\.env/);
      assert.match(dockerignore, /node_modules/);
    });

    it("notifications and integrations migration exists", function() {
      const sql = fs.readFileSync(
        path.join(__dirname, "..", "supabase", "migrations", "20260714150000_sonara_notifications_and_integrations.sql"),
        "utf8"
      );
      assert.match(sql, /create table if not exists public\.user_notifications/);
      assert.match(sql, /create table if not exists public\.integration_statuses/);
      assert.match(sql, /enable row level security/);
    });

    it("launch storage migration keeps every customer bucket private and scoped", function() {
      const sql = fs.readFileSync(
        path.join(__dirname, "..", "supabase", "migrations", "20260716130000_launch_storage_buckets.sql"),
        "utf8"
      );
      for (const bucket of ["avatars", "business-assets", "creator-assets", "music-stems", "release-packages", "support-attachments", "exports"]) {
        assert.match(sql, new RegExp(`'${bucket}'`), `${bucket} missing from storage migration`);
      }
      assert.doesNotMatch(sql, /'[^']+',\s*'[^']+',\s*true/);
      assert.match(sql, /public\.is_org_member/);
      assert.match(sql, /auth\.uid\(\)::text = \(storage\.foldername\(name\)\)\[2\]/);
    });
  });
});
