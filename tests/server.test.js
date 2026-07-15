const request = require("supertest");
const assert = require("assert");
const crypto = require("node:crypto");
const { URLSearchParams } = require("node:url");
const app = require("../server");

describe("public site", () => {
  it("GET / returns the SONARA launch baseline", async function() {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /LAUNCH OPERATING SYSTEM/);
    assert.match(res.text, /Business Builder/);
    assert.match(res.text, /Creator Studio/);
    assert.match(res.text, /Growth Studio/);
    assert.match(res.text, /data-sonara-interface="live"/);
    assert.match(res.text, /sonara-hero-stage/);
    assert.match(res.text, /sonara-status-panel/);
    assert.match(res.text, /href="\/business-builder\/dashboard"/);
    assert.match(res.text, /href="\/business-builder\/intake"/);
    assert.match(res.text, /href="\/creator-studio\/assets"/);
    assert.match(res.text, /href="\/creator-studio\/music-system"/);
    assert.match(res.text, /href="\/growth-studio\/campaigns"/);
    assert.match(res.text, /href="\/growth-studio\/leads"/);
    assert.match(res.text, /Setup required|setup-required|setup required/i);
    assert.doesNotMatch(res.text, /Express service is online/);
    assert.doesNotMatch(res.text, /â€¢|BusinessCreatorGrowth/);
  });

  for (const route of [
    "/business-builder",
    "/business-builder/login",
    "/business-builder/launch-readiness",
    "/creator-studio",
    "/creator-studio/launch-readiness",
    "/growth-studio",
    "/growth-studio/launch-readiness",
    "/contact",
    "/pricing",
    "/security",
    "/help",
    "/docs",
    "/signup",
    "/account",
    "/account/setup",
    "/logout"
  ]) {
    it(`GET ${route} returns 200`, async function() {
      const res = await request(app).get(route).set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.equal(res.type, "text/html");
      assert.doesNotMatch(res.text, /\[To be added\]/);
      assert.doesNotMatch(res.text, /shell/i);
      assert.doesNotMatch(res.text, /lorem/i);
      assert.doesNotMatch(res.text, /href="#"/i);
      assert.doesNotMatch(res.text, /â€¢|BusinessCreatorGrowth/);
    });
  }

  it("homepage includes mobile and PWA metadata", async function() {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.match(res.text, /name="viewport"/);
    assert.match(res.text, /name="theme-color"/);
    assert.match(res.text, /href="\/favicon.svg"/);
    assert.match(res.text, /rel="apple-touch-icon"/);
    assert.match(res.text, /href="\/site.webmanifest"/);
  });

  it("business builder includes Launch Setup Checklist", async function() {
    const res = await request(app).get("/business-builder").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Launch Setup Checklist/);
    assert.doesNotMatch(res.text, /Setup checklist/);
  });

  it("account setup includes a real organization setup action", async function() {
    const res = await request(app).get("/account/setup").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Create or attach organization/);
    assert.match(res.text, /action="\/account\/setup\/organization"/);
    assert.match(res.text, /profiles, organizations, and organization_memberships/);
  });

  it("business builder landing does not duplicate Launch Setup Checklist CTAs", async function() {
    const res = await request(app).get("/business-builder").set("Accept", "text/html");
    assert.equal(res.status, 200);
    const ctas = res.text.match(/<a class="action" href="\/business-builder\/launch-readiness">Launch checklist<\/a>/g) || [];
    assert.equal(ctas.length, 1);
  });

  it("pricing uses readable setup text", async function() {
    const res = await request(app).get("/pricing").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Checkout setup required/);
    assert.match(res.text, /payment connection/);
    assert.doesNotMatch(res.text, /setup_required/);
    assert.doesNotMatch(res.text, /Public readiness shell/);
    assert.match(res.text, /Public readiness checklist/);
  });

  it("public pages use customer-facing setup language", async function() {
    for (const route of ["/", "/pricing", "/login", "/signup", "/business-builder", "/creator-studio", "/growth-studio", "/help", "/docs"]) {
      const res = await request(app).get(route).set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.doesNotMatch(res.text, /Provider readiness|setup-aware|Backend-dependent|Authenticated customers|Billing webhook events|Stripe Webhook|Admin Protection/);
      assert.doesNotMatch(res.text, /SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY|ADMIN_PASSWORD_HASH/);
    }
  });

  it("footer links include all legal routes", async function() {
    const legalRoutes = [
      "/legal/terms",
      "/legal/privacy",
      "/legal/refund-policy",
      "/legal/cookie-policy",
      "/legal/acceptable-use",
      "/legal/accessibility",
      "/legal/earnings-disclaimer",
      "/legal/ai-disclaimer",
      "/legal/payment-terms",
      "/legal/data-processing",
      "/legal/security-policy",
      "/legal/disclaimer",
      "/legal/can-spam",
      "/legal/subprocessor-notice"
    ];
    const res = await request(app).get("/").set("Accept", "text/html");
    for (const route of legalRoutes) {
      assert.match(res.text, new RegExp(`href="${route}"`));
    }
  });
});

describe("icon assets", () => {
  for (const route of ["/", "/pricing", "/business-builder"]) {
    it(`GET ${route} includes icon metadata`, async function() {
      const res = await request(app).get(route).set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.match(res.text, /href="\/favicon.ico"/);
      assert.match(res.text, /href="\/favicon.svg"/);
      assert.match(res.text, /href="\/icons\/icon-180.png"/);
      assert.match(res.text, /href="\/site.webmanifest"/);
    });
  }

  it("GET /favicon.ico returns the ICO asset", async function() {
    const res = await request(app).get("/favicon.ico");
    assert.equal(res.status, 200);
    assert.match(res.type, /image|application\/octet-stream/);
  });

  it("GET /favicon.svg returns the SVG asset", async function() {
    const res = await request(app).get("/favicon.svg");
    assert.equal(res.status, 200);
    assert.equal(res.type, "image/svg+xml");
    assert.match(res.body.toString("utf8"), /SONARA Industries/);
  });

  it("GET /site.webmanifest returns the SONARA manifest", async function() {
    const res = await request(app).get("/site.webmanifest");
    assert.equal(res.status, 200);
    const manifest = JSON.parse(res.text);
    assert.equal(manifest.name, "SONARA Industries");
    assert.equal(manifest.short_name, "SONARA");
    assert.equal(manifest.theme_color, "#11101a");
    assert.equal(manifest.display, "standalone");
    assert.ok(manifest.icons.some((icon) => icon.src === "/icons/icon-192.png"));
    assert.ok(manifest.icons.some((icon) => icon.src === "/icons/icon-512.png"));
  });

  for (const route of ["/sonara-brand-system.css", "/sonara-friendly-premium.css", "/sonara-experience.js"]) {
    it(`GET ${route} returns public launch asset`, async function() {
      const res = await request(app).get(route);
      assert.equal(res.status, 200);
      assert.match(res.type, /css|javascript|ecmascript/);
      assert.doesNotMatch(res.text, /â€¢|BusinessCreatorGrowth/);
    });
  }

  for (const route of ["/icons/icon-192.png", "/icons/icon-512.png"]) {
    it(`GET ${route} returns png`, async function() {
      const res = await request(app).get(route);
      assert.equal(res.status, 200);
      assert.equal(res.type, "image/png");
    });
  }
});

describe("health and readiness", () => {
  it("GET /api/health returns ok", async function() {
    const res = await request(app).get("/api/health").set("Accept", "application/json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.app, "sonara-industries");
    assert.equal(res.body.runtime, "express");
    assert.ok(res.body.deployment);
    assert.ok(res.body.deployment.commitSha);
    assert.ok(res.body.deployment.branch);
    assert.ok(res.body.deployment.environment);
    assert.ok(res.body.timestamp);
    assert.doesNotMatch(JSON.stringify(res.body), /sk_|whsec_|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY/);
  });

  it("GET /api/readiness returns non-secret flags", async function() {
    const res = await request(app).get("/api/readiness").set("Accept", "application/json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(["configured", "missing", "invalid"].includes(res.body.services.supabase));
    assert.ok(["configured", "missing", "invalid"].includes(res.body.services.stripe));
    assert.ok(["configured", "missing", "invalid"].includes(res.body.services.resend));
    assert.ok(["configured", "missing", "deferred"].includes(res.body.services.googleOAuth));
    assert.ok(["configured", "missing", "invalid"].includes(res.body.services.adminProtection));
    assert.equal(res.body.services.legalPages, "review_required");
    assert.ok(["enabled", "setup_required"].includes(res.body.services.checkout));
    assert.ok(["enabled", "setup_required", "invalid"].includes(res.body.services.emailDelivery));
    assert.ok(["configured", "missing", "invalid"].includes(res.body.services.accountDatabase));
    assert.ok(["configured", "missing", "invalid"].includes(res.body.services.paymentConnection));
    assert.ok(["configured", "missing", "invalid"].includes(res.body.services.paymentUpdates));
    assert.equal(res.body.services.googleSignIn, "deferred");
    assert.ok(["configured", "missing", "invalid"].includes(res.body.services.founderAccess));
    assert.equal(res.text.includes("SUPABASE_SERVICE_ROLE_KEY="), false);
    assert.equal(res.text.includes("STRIPE_SECRET_KEY="), false);
  });

  it("GET /api/readiness accepts documented environment aliases", async function() {
    const keys = [
      "SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "SUPPORT_TO_EMAIL",
      "CONTACT_TO_EMAIL",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REDIRECT_URI",
      "PUBLIC_SITE_URL",
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_APP_URL",
      "APP_URL",
      "ADMIN_EMAILS",
      "ADMIN_EMAIL"
    ];
    const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sonara-status.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_status_check_value_1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_status_check_value_1234567890";
    process.env.RESEND_API_KEY = "re_status_check_value_1234567890";
    process.env.RESEND_FROM_EMAIL = "support@sonaraindustries.com";
    process.env.CONTACT_TO_EMAIL = "owner@sonaraindustries.com";
    process.env.GOOGLE_CLIENT_ID = "google-client-placeholder";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret-placeholder";
    process.env.GOOGLE_REDIRECT_URI = "https://sonaraindustries.com/auth/callback";
    process.env.NEXT_PUBLIC_SITE_URL = "https://sonaraindustries.com";
    process.env.ADMIN_EMAIL = "owner@sonaraindustries.com";

    const res = await request(app).get("/api/readiness").set("Accept", "application/json");

    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }

    assert.equal(res.status, 200);
    assert.equal(res.body.services.supabase, "configured");
    assert.equal(res.body.services.resend, "configured");
    assert.equal(res.body.services.googleOAuth, "deferred");
    assert.equal(res.body.services.adminProtection, "configured");
    assert.doesNotMatch(res.text, /service-role-placeholder/);
    assert.doesNotMatch(res.text, /google-secret-placeholder/);
  });

  it("GET /api/readiness marks placeholder provider values invalid", async function() {
    const keys = [
      "SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_STARTER_MONTHLY",
      "ADMIN_EMAILS",
      "ADMIN_EMAIL",
      "FOUNDER_EMAILS"
    ];
    const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
    process.env.RESEND_API_KEY = "resend-placeholder";
    process.env.RESEND_FROM_EMAIL = "sender@example.com";
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";
    process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_xxx";
    process.env.ADMIN_EMAILS = "your-email@example.com";

    const res = await request(app).get("/api/readiness").set("Accept", "application/json");

    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }

    assert.equal(res.status, 200);
    assert.equal(res.body.services.supabase, "invalid");
    assert.equal(res.body.services.stripe, "invalid");
    assert.equal(res.body.services.stripeWebhook, "invalid");
    assert.equal(res.body.services.resend, "invalid");
    assert.equal(res.body.services.adminProtection, "invalid");
    assert.equal(res.body.services.founderAccess, "invalid");
    assert.ok(res.body.invalid.stripe.some((item) => item.reason === "invalid_placeholder"));
  });
});

describe("contact support", () => {
  it("POST /contact validates required fields", async function() {
    const res = await request(app).post("/contact").type("form").send({ category: "contact" });
    assert.equal(res.status, 400);
    assert.match(res.text, /Request not accepted|validation_failed/);
  });

  it("POST /contact returns setup_required fallback safely when providers are missing", async function() {
    const res = await request(app)
      .post("/contact")
      .type("form")
      .send({
        category: "contact",
        name: "Launch Owner",
        email: "launch@example.com",
        subject: "Paid launch review",
        message: "Please review the paid launch readiness path.",
        consent: "yes"
      });
    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Reference ID:/);
    assert.match(res.text, /Setup required|received|email notification failed/i);
  });
});

describe("auth setup", () => {
  const supabaseEnvKeys = [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  ];
  let originalSupabaseEnv;

  beforeEach(() => {
    originalSupabaseEnv = Object.fromEntries(supabaseEnvKeys.map((key) => [key, process.env[key]]));
    for (const key of supabaseEnvKeys) delete process.env[key];
  });

  afterEach(() => {
    for (const key of supabaseEnvKeys) {
      if (originalSupabaseEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalSupabaseEnv[key];
    }
  });

  it("GET /login renders email login with password visibility control", async function() {
    const res = await request(app).get("/login").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Login with email/);
    assert.match(res.text, /Show password/);
    assert.match(res.text, /data-toggle-password/);
    assert.doesNotMatch(res.text, /Google OAuth/);
  });

  it("GET /business-builder/login renders email login without Google OAuth", async function() {
    const res = await request(app).get("/business-builder/login").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Business Builder Login/);
    assert.match(res.text, /Login with email/);
    assert.match(res.text, /Show password/);
    assert.doesNotMatch(res.text, /Google OAuth/);
  });

  it("GET /auth/callback is disabled while Google OAuth is deferred", async function() {
    const res = await request(app).get("/auth/callback").set("Accept", "application/json");
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "disabled");
    assert.equal(res.body.service, "google_oauth");
  });

  it("GET /auth/login redirects to /login by default", async function() {
    const res = await request(app).get("/auth/login");
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/login");
  });

  it("GET /auth/login redirects browser requests to /login even when JSON is accepted", async function() {
    const res = await request(app).get("/auth/login").set("Accept", "application/json");
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/login");
  });

  it("GET /auth/login?format=json returns JSON readiness", async function() {
    const res = await request(app).get("/auth/login?format=json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.code, "login_ready");
    assert.equal(res.body.sessionStored, false);
    assert.equal(res.body.action, "/auth/login");
  });

  it("GET /auth/login with x-sonara-api-client returns JSON readiness", async function() {
    const res = await request(app).get("/auth/login").set("x-sonara-api-client", "true");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.code, "login_ready");
    assert.equal(res.body.sessionStored, false);
  });

  it("GET /auth/login with x-sonara-api-client: false redirects to /login", async function() {
    const res = await request(app).get("/auth/login").set("x-sonara-api-client", "false");
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/login");
  });

  it("GET /auth/signup redirects to /signup by default", async function() {
    const res = await request(app).get("/auth/signup");
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/signup");
  });

  it("GET /auth/signup redirects browser requests to /signup even when JSON is accepted", async function() {
    const res = await request(app).get("/auth/signup").set("Accept", "application/json");
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/signup");
  });

  it("GET /auth/signup?format=json returns JSON readiness", async function() {
    const res = await request(app).get("/auth/signup?format=json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.code, "signup_ready");
    assert.equal(res.body.sessionStored, false);
    assert.equal(res.body.action, "/auth/signup");
  });

  it("GET /auth/signup with x-sonara-api-client returns JSON readiness", async function() {
    const res = await request(app).get("/auth/signup").set("x-sonara-api-client", "true");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.code, "signup_ready");
  });

  it("GET /signup renders password visibility control", async function() {
    const res = await request(app).get("/signup").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Create account/);
    assert.match(res.text, /Show password/);
    assert.match(res.text, /data-toggle-password/);
  });

  it("customer dashboards require authentication", async function() {
    const topLevel = await request(app).get("/dashboard").set("Accept", "text/html");
    assert.equal(topLevel.status, 303);
    assert.equal(topLevel.headers.location, "/login");

    const browser = await request(app).get("/business-builder/dashboard").set("Accept", "text/html");
    assert.equal(browser.status, 303);
    assert.equal(browser.headers.location, "/login");

    const api = await request(app).get("/business-builder/dashboard").set("Accept", "application/json");
    assert.equal(api.status, 503);
    assert.equal(api.body.code, "setup_required");

    const settings = await request(app).get("/settings").set("Accept", "text/html");
    assert.equal(settings.status, 303);
    assert.equal(settings.headers.location, "/login");
  });

  it("customer bearer sessions can access protected customer routes", async function() {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";

    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000001", email: "customer@example.com" }) };
      }
      return { ok: false, json: async () => [] };
    };

    const dashboard = await request(app).get("/dashboard").set("Authorization", "Bearer customer-session").set("Accept", "text/html");
    const settings = await request(app).get("/settings").set("Authorization", "Bearer customer-session").set("Accept", "text/html");
    const businessBuilder = await request(app).get("/business-builder/dashboard").set("Authorization", "Bearer customer-session").set("Accept", "text/html");
    const businessIntake = await request(app).get("/business-builder/intake").set("Authorization", "Bearer customer-session").set("Accept", "text/html");
    const creatorAssets = await request(app).get("/creator-studio/assets").set("Authorization", "Bearer customer-session").set("Accept", "text/html");
    const growthCampaigns = await request(app).get("/growth-studio/campaigns").set("Authorization", "Bearer customer-session").set("Accept", "text/html");

    global.fetch = originalFetch;

    assert.equal(dashboard.status, 200);
    assert.match(dashboard.text, /Dashboard/);
    assert.match(dashboard.text, /Free access/);
    assert.match(dashboard.text, /Paid access/);
    assert.match(dashboard.text, /Logout/);
    assert.equal(settings.status, 200);
    assert.match(settings.text, /Language preference/);
    assert.match(settings.text, /Logout/);
    assert.equal(businessBuilder.status, 200);
    assert.match(businessBuilder.text, /Business Builder Dashboard/);
    assert.match(businessBuilder.text, /Logout/);
    assert.equal(businessIntake.status, 200);
    assert.match(businessIntake.text, /Intake &amp; Request Queue/);
    assert.match(businessIntake.text, /Record intake/);
    assert.equal(creatorAssets.status, 200);
    assert.match(creatorAssets.text, /Asset Catalog/);
    assert.match(creatorAssets.text, /Create asset record/);
    assert.equal(growthCampaigns.status, 200);
    assert.match(growthCampaigns.text, /Campaign Workspace/);
    assert.match(growthCampaigns.text, /Create campaign plan/);
  });

  it("POST /logout redirects browser requests to /login", async function() {
    const res = await request(app).post("/logout").set("Accept", "text/html");
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/login");
  });

  it("POST /auth/signup browser form does not show raw JSON when Supabase is missing", async function() {
    const keys = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
    const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];

    const res = await request(app)
      .post("/auth/signup")
      .set("Accept", "text/html")
      .type("form")
      .send({ email: "owner@example.com", password: "password123" });

    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }

    assert.equal(res.status, 503);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Access not completed/);
    assert.doesNotMatch(res.text, /\{"ok":/);
  });

  it("POST /auth/login browser form stores an HttpOnly session cookie and unlocks free dashboard access", async function() {
    const keys = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
    const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";

    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes("/auth/v1/token")) {
        return { ok: true, json: async () => ({ access_token: "customer-session-token", expires_in: 3600 }) };
      }
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000101", email: "customer@example.com" }) };
      }
      return { ok: false, json: async () => [] };
    };

    const agent = request.agent(app);
    const login = await agent
      .post("/auth/login")
      .set("Accept", "text/html")
      .type("form")
      .send({ email: "customer@example.com", password: "password123" });
    const dashboard = await agent.get("/dashboard").set("Accept", "text/html");

    global.fetch = originalFetch;
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }

    assert.equal(login.status, 303);
    assert.equal(login.headers.location, "/dashboard");
    const cookie = login.headers["set-cookie"]?.find((value) => value.startsWith("sonara_customer_session="));
    assert.ok(cookie);
    assert.match(cookie, /HttpOnly/);
    assert.equal(dashboard.status, 200);
    assert.match(dashboard.text, /Free access/);
    assert.match(dashboard.text, /Paid access/);
    assert.match(dashboard.text, /Paid workspaces stay locked/);
  });

  it("POST /auth/login returns setup_required when Supabase is missing", async function() {
    const keys = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
    const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];

    const res = await request(app).post("/auth/login").send({ email: "owner@example.com", password: "password123" });

    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }

    assert.equal(res.status, 503);
    assert.equal(res.body.code, "setup_required");
  });

  it("POST /auth/login uses public Supabase Auth config without requiring the service role key", async function() {
    const keys = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
    const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes("/auth/v1/token")) {
        return { ok: true, json: async () => ({ access_token: "customer-session-token", expires_in: 3600 }) };
      }
      return { ok: false, json: async () => [] };
    };

    const res = await request(app).post("/auth/login").send({ email: "owner@example.com", password: "password123" });

    global.fetch = originalFetch;
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.sessionStored, true);
  });

  it("POST /auth/signup returns setup_required when Supabase is missing", async function() {
    const keys = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
    const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];

    const res = await request(app).post("/auth/signup").send({ email: "owner@example.com", password: "password123" });

    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }

    assert.equal(res.status, 503);
    assert.equal(res.body.code, "setup_required");
  });
});

describe("product module APIs", () => {
  const supabaseEnvKeys = [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  ];
  const organizationId = "00000000-0000-0000-0000-000000000061";
  let originalSupabaseEnv;

  beforeEach(() => {
    originalSupabaseEnv = Object.fromEntries(supabaseEnvKeys.map((key) => [key, process.env[key]]));
    for (const key of supabaseEnvKeys) delete process.env[key];
  });

  afterEach(() => {
    for (const key of supabaseEnvKeys) {
      if (originalSupabaseEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalSupabaseEnv[key];
    }
  });

  function configureSupabase() {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sonara-employees.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_employee_status_key_1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_employee_status_key_1234567890";
  }

  it("POST /api/business-builder/offers validates input", async function() {
    const res = await request(app).post("/api/business-builder/offers").send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "validation_failed");
  });

  it("POST /api/business-builder/offers requires customer auth before returning free module output", async function() {
    configureSupabase();
    const res = await request(app).post("/api/business-builder/offers").send({
      serviceType: "mobile detailing",
      audience: "busy local drivers",
      priceIdea: "$99",
      deliverables: "wash, wax, interior",
      proofPoints: "insured, local"
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "customer_auth_required");
  });

  it("POST /api/business-builder/offers returns deterministic free output for authenticated customers", async function() {
    configureSupabase();
    const calls = [];
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET", body: options.body });
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000101", email: "customer@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: organizationId }] };
      }
      if (String(url).includes("/activity_events")) {
        return { ok: true, json: async () => [{ id: "activity-1" }] };
      }
      if (String(url).includes("/module_outputs") && options.method === "POST") {
        return { ok: true, json: async () => [{ id: "module-output-1" }] };
      }
      return { ok: true, json: async () => [] };
    };

    const res = await request(app).post("/api/business-builder/offers").set("Authorization", "Bearer customer-session").send({
      serviceType: "mobile detailing",
      audience: "busy local drivers",
      priceIdea: "$99",
      deliverables: "wash, wax, interior",
      proofPoints: "insured, local"
    });

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.saved, true);
    assert.equal(res.body.output.pricePosition, "$99");
    const insert = calls.find((call) => call.url.includes("/module_outputs") && call.method === "POST");
    assert.ok(insert);
    assert.equal(JSON.parse(insert.body).organization_id, organizationId);
  });

  it("POST /api/business-builder/offers returns HTML confirmation for browser forms", async function() {
    configureSupabase();
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000109", email: "customer@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: organizationId }] };
      }
      if (String(url).includes("/module_outputs") && options.method === "POST") {
        return { ok: true, json: async () => [{ id: "module-output-2" }] };
      }
      return { ok: true, json: async () => [] };
    };

    const res = await request(app)
      .post("/api/business-builder/offers")
      .set("Authorization", "Bearer customer-session")
      .set("Accept", "text/html")
      .type("form")
      .send({
        serviceType: "mobile detailing",
        audience: "busy local drivers",
        priceIdea: "$99",
        deliverables: "wash, wax, interior",
        proofPoints: "insured, local"
      });

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Business offer recorded/);
    assert.match(res.text, /Reference ID: module-output-2/);
  });

  it("POST /api/business-builder/intake writes intake requests and activity when configured", async function() {
    configureSupabase();
    const calls = [];
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET", body: options.body });
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000107", email: "customer@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: organizationId }] };
      }
      if (String(url).includes("/intake_requests") && options.method === "POST") {
        return { ok: true, json: async () => [{ id: "00000000-0000-0000-0000-000000000201" }] };
      }
      if (String(url).includes("/activity_events")) return { ok: true, json: async () => [{ id: "activity-1" }] };
      return { ok: true, json: async () => [] };
    };

    const res = await request(app)
      .post("/api/business-builder/intake")
      .set("Authorization", "Bearer customer-session")
      .send({
        name: "Launch Owner",
        email: "owner@example.com",
        serviceInterest: "business setup",
        message: "I need help launching a service business."
      });

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.equal(res.body.saved, true);
    assert.equal(res.body.intakeRequestId, "00000000-0000-0000-0000-000000000201");
    assert.ok(calls.some((call) => call.url.includes("/intake_requests") && call.method === "POST"));
    assert.ok(calls.some((call) => call.url.includes("/activity_events") && call.method === "POST"));
  });

  it("GET and POST /api/business-builder/checklist use launch checklist records", async function() {
    configureSupabase();
    const checklistId = "00000000-0000-0000-0000-000000000301";
    const calls = [];
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET", body: options.body });
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000108", email: "customer@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: organizationId }] };
      }
      if (String(url).includes("/launch_checklist_items") && (options.method || "GET") === "GET") {
        return { ok: true, json: async () => [{ id: checklistId, title: "Confirm offer", status: "todo" }] };
      }
      if (String(url).includes("/launch_checklist_items") && options.method === "POST") {
        return { ok: true, json: async () => [{ id: checklistId, title: "Confirm offer", status: "todo" }] };
      }
      if (String(url).includes("/activity_events")) return { ok: true, json: async () => [{ id: "activity-1" }] };
      return { ok: true, json: async () => [] };
    };

    const list = await request(app).get("/api/business-builder/checklist").set("Authorization", "Bearer customer-session");
    const create = await request(app)
      .post("/api/business-builder/checklist")
      .set("Authorization", "Bearer customer-session")
      .send({ title: "Confirm offer", category: "Offer" });

    global.fetch = originalFetch;

    assert.equal(list.status, 200);
    assert.equal(list.body.items[0].id, checklistId);
    assert.equal(create.status, 200);
    assert.equal(create.body.saved, true);
    assert.ok(calls.some((call) => call.url.includes("/launch_checklist_items") && call.method === "POST"));
  });

  it("POST /api/creator-studio/offers validates input", async function() {
    const res = await request(app).post("/api/creator-studio/offers").send({});
    assert.equal(res.status, 400);
  });

  it("POST /api/creator-studio/assets writes creator_assets when configured", async function() {
    configureSupabase();
    const calls = [];
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET", body: options.body });
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000110", email: "creator@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: organizationId }] };
      }
      if (String(url).includes("/creator_assets") && options.method === "POST") {
        return { ok: true, json: async () => [{ id: "creator-asset-1" }] };
      }
      if (String(url).includes("/module_outputs") && options.method === "POST") {
        return { ok: true, json: async () => [{ id: "module-output-asset-1" }] };
      }
      return { ok: true, json: async () => [] };
    };

    const res = await request(app)
      .post("/api/creator-studio/assets")
      .set("Authorization", "Bearer customer-session")
      .send({ title: "Launch photo set", type: "image", platform: "site", status: "ready", rightsNotes: "owned" });

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.equal(res.body.saved, true);
    assert.equal(res.body.domainRecordSaved, true);
    assert.equal(res.body.domainTable, "creator_assets");
    const insert = calls.find((call) => call.url.includes("/creator_assets") && call.method === "POST");
    assert.ok(insert);
    assert.equal(JSON.parse(insert.body).organization_id, organizationId);
  });

  it("POST /api/growth-studio/campaigns validates input", async function() {
    const res = await request(app).post("/api/growth-studio/campaigns").send({});
    assert.equal(res.status, 400);
  });

  it("POST /api/growth-studio/campaigns and leads write growth tables when configured", async function() {
    configureSupabase();
    const calls = [];
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET", body: options.body });
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000111", email: "growth@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: organizationId }] };
      }
      if (String(url).includes("/growth_campaigns") && options.method === "POST") {
        return { ok: true, json: async () => [{ id: "growth-campaign-1" }] };
      }
      if (String(url).includes("/growth_leads") && options.method === "POST") {
        return { ok: true, json: async () => [{ id: "growth-lead-1" }] };
      }
      if (String(url).includes("/module_outputs") && options.method === "POST") {
        return { ok: true, json: async () => [{ id: "module-output-growth-1" }] };
      }
      return { ok: true, json: async () => [] };
    };

    const campaign = await request(app)
      .post("/api/growth-studio/campaigns")
      .set("Authorization", "Bearer customer-session")
      .send({ goal: "book consults", audience: "local owners", offer: "audit", channel: "email", timeline: "14 days" });
    const lead = await request(app)
      .post("/api/growth-studio/leads")
      .set("Authorization", "Bearer customer-session")
      .send({ name: "Alex", email: "alex@example.com", source: "website", consentStatus: "explicit" });

    global.fetch = originalFetch;

    assert.equal(campaign.status, 200);
    assert.equal(campaign.body.domainTable, "growth_campaigns");
    assert.equal(lead.status, 200);
    assert.equal(lead.body.domainTable, "growth_leads");
    assert.ok(calls.some((call) => call.url.includes("/growth_campaigns") && call.method === "POST"));
    assert.ok(calls.some((call) => call.url.includes("/growth_leads") && call.method === "POST"));
  });

  it("GET /api/business-builder/records stays locked without paid billing state", async function() {
    configureSupabase();
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000102", email: "customer@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: organizationId }] };
      }
      if (String(url).includes("/billing_entitlements")) return { ok: true, json: async () => [] };
      if (String(url).includes("/billing_subscriptions")) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [] };
    };

    const res = await request(app).get("/api/business-builder/records").set("Authorization", "Bearer customer-session");

    global.fetch = originalFetch;

    assert.equal(res.status, 402);
    assert.equal(res.body.code, "upgrade_required");
  });

  it("GET /api/business-builder/records unlocks only from active billing entitlement state", async function() {
    configureSupabase();
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000103", email: "customer@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: organizationId }] };
      }
      if (String(url).includes("/billing_entitlements")) {
        return { ok: true, json: async () => [{ entitlement_key: "starter_monthly", status: "active" }] };
      }
      if (String(url).includes("/module_outputs")) {
        return { ok: true, json: async () => [{ id: "module-output-1", module_key: "offer_builder" }] };
      }
      return { ok: true, json: async () => [] };
    };

    const res = await request(app).get("/api/business-builder/records").set("Authorization", "Bearer customer-session");

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.equal(res.body.code, "records_available");
    assert.equal(res.body.records.length, 1);
  });

  it("customer paid workspace pages stay locked without billing state", async function() {
    configureSupabase();
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000105", email: "customer@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: organizationId }] };
      }
      if (String(url).includes("/user_roles")) return { ok: true, json: async () => [] };
      if (String(url).includes("/billing_entitlements")) return { ok: true, json: async () => [] };
      if (String(url).includes("/billing_subscriptions")) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [] };
    };

    const res = await request(app).get("/business-builder/customers").set("Authorization", "Bearer customer-session").set("Accept", "text/html");

    global.fetch = originalFetch;

    assert.equal(res.status, 402);
    assert.match(res.text, /Upgrade required/);
    assert.match(res.text, /payment updates/);
  });

  it("active billing state unlocks paid workspace pages for customers", async function() {
    configureSupabase();
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000106", email: "customer@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: organizationId }] };
      }
      if (String(url).includes("/user_roles")) return { ok: true, json: async () => [] };
      if (String(url).includes("/billing_entitlements")) {
        return { ok: true, json: async () => [{ entitlement_key: "starter_monthly", status: "active" }] };
      }
      return { ok: true, json: async () => [] };
    };

    const res = await request(app).get("/business-builder/customers").set("Authorization", "Bearer customer-session").set("Accept", "text/html");

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.match(res.text, /Customer Records/);
    assert.match(res.text, /Paid tools are available/);
  });

  it("GET /business-builder/billing renders authenticated billing actions", async function() {
    configureSupabase();
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000109", email: "customer@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: organizationId }] };
      }
      if (String(url).includes("/user_roles")) return { ok: true, json: async () => [] };
      if (String(url).includes("/billing_subscriptions")) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [] };
    };

    const res = await request(app).get("/business-builder/billing").set("Authorization", "Bearer customer-session").set("Accept", "text/html");

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.match(res.text, /Billing actions/);
    assert.match(res.text, /Manage billing portal/);
    assert.match(res.text, /Upgrade: Starter monthly/);
  });
});

describe("business builder employee portal", () => {
  const supabaseEnvKeys = [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "SUPPORT_TO_EMAIL"
  ];
  let originalEnv;

  beforeEach(() => {
    originalEnv = Object.fromEntries(supabaseEnvKeys.map((key) => [key, process.env[key]]));
    for (const key of supabaseEnvKeys) delete process.env[key];
  });

  afterEach(() => {
    for (const key of supabaseEnvKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  function configureSupabase() {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sonara-employees.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_employee_status_key_1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_employee_status_key_1234567890";
  }

  it("GET /business-builder/employees redirects browser users to Business Builder login when auth is missing", async function() {
    const res = await request(app).get("/business-builder/employees").set("Accept", "text/html");
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/business-builder/login");
  });

  it("normal customers cannot access Business Builder employee management", async function() {
    configureSupabase();
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000021", email: "customer@example.com" }) };
      }
      if (String(url).includes("/business_memberships")) return { ok: true, json: async () => [] };
      return { ok: false, json: async () => [] };
    };

    const res = await request(app).get("/business-builder/employees").set("Authorization", "Bearer customer-session").set("Accept", "application/json");

    global.fetch = originalFetch;

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "business_forbidden");
  });

  it("employee invite creation rejects owner-submitted passwords", async function() {
    configureSupabase();
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000022", email: "owner@example.com" }) };
      }
      if (String(url).includes("/business_memberships")) {
        return { ok: true, json: async () => [{ id: "membership-1", organization_id: "00000000-0000-0000-0000-000000000031", workspace_id: "00000000-0000-0000-0000-000000000041", role: "owner", status: "active" }] };
      }
      return { ok: true, json: async () => [] };
    };

    const res = await request(app)
      .post("/api/business-builder/employees/invite")
      .set("Authorization", "Bearer owner-session")
      .set("Accept", "application/json")
      .send({
        workspaceId: "00000000-0000-0000-0000-000000000041",
        organizationId: "00000000-0000-0000-0000-000000000031",
        name: "Employee One",
        email: "employee@example.com",
        role: "employee",
        password: "owner-created-password"
      });

    global.fetch = originalFetch;

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "password_not_allowed");
  });

  it("employee invite stores a token hash and never returns raw token or password", async function() {
    configureSupabase();
    const calls = [];
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET", body: options.body });
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000023", email: "owner@example.com" }) };
      }
      if (String(url).includes("/business_memberships")) {
        return { ok: true, json: async () => [{ id: "membership-1", organization_id: "00000000-0000-0000-0000-000000000031", workspace_id: "00000000-0000-0000-0000-000000000041", role: "owner", status: "active" }] };
      }
      if (String(url).includes("/business_employee_invites") && options.method === "POST") {
        return { ok: true, json: async () => [{ id: "invite-1" }] };
      }
      if (String(url).includes("/admin_audit_events")) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [] };
    };

    const res = await request(app)
      .post("/api/business-builder/employees/invite")
      .set("Authorization", "Bearer owner-session")
      .set("Accept", "application/json")
      .send({
        workspaceId: "00000000-0000-0000-0000-000000000041",
        organizationId: "00000000-0000-0000-0000-000000000031",
        name: "Employee One",
        email: "employee@example.com",
        role: "employee",
        permissions: "intake,records"
      });

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.delivery, "setup_required");
    assert.equal("inviteUrl" in res.body, false);
    assert.equal("token" in res.body, false);
    const insert = calls.find((call) => call.url.includes("/business_employee_invites") && call.method === "POST");
    assert.ok(insert);
    const record = JSON.parse(insert.body);
    assert.ok(record.token_hash);
    assert.equal("token" in record, false);
    assert.equal("password" in record, false);
    assert.deepEqual(record.permissions, ["intake", "records"]);
  });

  it("employee invite acceptance fails safely when Supabase Auth is missing", async function() {
    const res = await request(app)
      .post("/business-builder/invite/accept")
      .set("Accept", "application/json")
      .send({ token: "invite-token", email: "employee@example.com", password: "password123" });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "setup_required");
    assert.equal(res.body.service, "supabase_auth");
  });
});

describe("pricing and checkout", () => {
  const validStripeSecret = ["sk", "test", "checkout_ready"].join("_");
  const invalidPriceSecretPrefix = ["sk", "live", "wrong"].join("_");
  const validStarterPrice = ["price", "starter"].join("_");
  const validCorePrice = ["price", "core"].join("_");
  const stripeEnvKeys = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_STARTER_MONTHLY",
    "STRIPE_PRICE_CORE_MONTHLY",
    "STRIPE_PRICE_PRO_MONTHLY",
    "STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME",
    "STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY",
    "STRIPE_PRICE_ID_CREATOR_STUDIO_MONTHLY",
    "STRIPE_PRICE_ID_GROWTH_STUDIO_MONTHLY",
    "STRIPE_PRICE_ID_BUSINESS_BUILDER_ONETIME",
    "STRIPE_SUCCESS_URL",
    "STRIPE_CANCEL_URL",
    "APP_URL",
    "PUBLIC_SITE_URL",
    "NODE_ENV",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  ];
  let originalStripeEnv;

  beforeEach(() => {
    originalStripeEnv = Object.fromEntries(stripeEnvKeys.map((key) => [key, process.env[key]]));
    for (const key of stripeEnvKeys) delete process.env[key];
  });

  afterEach(() => {
    for (const key of stripeEnvKeys) {
      if (originalStripeEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalStripeEnv[key];
    }
  });

  function configureSupabaseForCheckout() {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
  }

  function mockCheckoutFetch(calls = []) {
    const organizationId = "00000000-0000-0000-0000-000000000071";
    return async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET", body: options.body });
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000104", email: "customer@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: organizationId }] };
      }
      if (String(url).includes("api.stripe.com/v1/customers")) {
        return { ok: true, json: async () => ({ id: "cus_test_customer" }) };
      }
      if (String(url).includes("api.stripe.com/v1/checkout/sessions")) {
        return { ok: true, json: async () => ({ url: "https://checkout.stripe.com/c/session_test" }) };
      }
      if (String(url).includes("/stripe_customers")) {
        return { ok: true, json: async () => [] };
      }
      return { ok: true, json: async () => [] };
    };
  }

  it("GET /pricing returns pricing cards", async function() {
    const res = await request(app).get("/pricing").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Starter monthly/);
    assert.match(res.text, /Core monthly/);
    assert.match(res.text, /Pro monthly/);
    assert.match(res.text, /Business Builder setup/);
  });

  it("GET /pricing does not globally disable checkout when optional plan prices are missing", async function() {
    process.env.STRIPE_SECRET_KEY = validStripeSecret;
    process.env.STRIPE_PRICE_STARTER_MONTHLY = validStarterPrice;
    process.env.STRIPE_PRICE_CORE_MONTHLY = validCorePrice;

    const res = await request(app).get("/pricing").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.equal((res.text.match(/Start checkout/g) || []).length, 2);
    assert.match(res.text, /Checkout is not configured for this plan yet/);
  });

  it("GET /pricing accepts house-of-brands Stripe price aliases", async function() {
    process.env.STRIPE_SECRET_KEY = validStripeSecret;
    process.env.STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY = validStarterPrice;
    process.env.STRIPE_PRICE_ID_CREATOR_STUDIO_MONTHLY = validCorePrice;

    const res = await request(app).get("/pricing").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.equal((res.text.match(/Start checkout/g) || []).length, 2);
  });

  it("GET /pricing does not count the free plan as paid checkout readiness", async function() {
    const res = await request(app).get("/pricing").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Checkout setup required until the payment connection and plan settings are configured/);

    const readiness = await request(app).get("/api/readiness").set("Accept", "application/json");
    assert.equal(readiness.body.services.checkout, "setup_required");
  });

  it("GET /api/checkout/session returns 405", async function() {
    const res = await request(app).get("/api/checkout/session").set("Accept", "application/json");
    assert.equal(res.status, 405);
    assert.equal(res.body.code, "method_not_allowed");
  });

  it("POST /api/checkout/session returns setup_required when Stripe is missing", async function() {
    configureSupabaseForCheckout();
    const originalFetch = global.fetch;
    global.fetch = mockCheckoutFetch();

    const res = await request(app).post("/api/checkout/session").set("Authorization", "Bearer customer-session").send({ plan: "starter_monthly" });

    global.fetch = originalFetch;

    assert.equal(res.status, 503);
    assert.equal(res.body.code, "setup_required");
    assert.equal(res.body.service, "stripe_secret_key");
  });

  it("POST /api/checkout/session rejects invalid plans", async function() {
    const res = await request(app).post("/api/checkout/session").send({ plan: "unknown" });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "invalid_plan");
  });

  it("POST /api/checkout/session rejects plan with missing price env", async function() {
    configureSupabaseForCheckout();
    process.env.STRIPE_SECRET_KEY = validStripeSecret;
    const originalFetch = global.fetch;
    global.fetch = mockCheckoutFetch();

    const res = await request(app).post("/api/checkout/session").set("Authorization", "Bearer customer-session").send({ plan: "starter_monthly" });

    global.fetch = originalFetch;

    assert.equal(res.status, 503);
    assert.equal(res.body.service, "stripe_price");
    assert.match(res.body.env, /STRIPE_PRICE_STARTER_MONTHLY/);
    assert.match(res.body.env, /STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY/);
    assert.equal(res.body.reason, "missing");
  });

  it("POST /api/checkout/session redirects browser form posts to login before auth", async function() {
    process.env.STRIPE_SECRET_KEY = validStripeSecret;
    process.env.STRIPE_PRICE_STARTER_MONTHLY = validStarterPrice;
    process.env.APP_URL = "https://sonaraindustries.com";
    configureSupabaseForCheckout();

    const res = await request(app)
      .post("/api/checkout/session")
      .type("form")
      .set("Accept", "text/html")
      .send({ plan: "starter_monthly" });

    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/login");
  });

  it("POST /api/checkout/session redirects browser form posts to Stripe", async function() {
    configureSupabaseForCheckout();
    process.env.STRIPE_SECRET_KEY = validStripeSecret;
    process.env.STRIPE_PRICE_STARTER_MONTHLY = validStarterPrice;
    process.env.APP_URL = "https://sonaraindustries.com";

    const calls = [];
    const originalFetch = global.fetch;
    global.fetch = mockCheckoutFetch(calls);

    const res = await request(app)
      .post("/api/checkout/session")
      .set("Authorization", "Bearer customer-session")
      .type("form")
      .set("Accept", "text/html")
      .send({ plan: "starter_monthly" });

    global.fetch = originalFetch;

    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "https://checkout.stripe.com/c/session_test");
    const stripeCall = calls.find((call) => call.url.includes("api.stripe.com/v1/checkout/sessions"));
    assert.ok(stripeCall);
    const params = new URLSearchParams(stripeCall.body);
    assert.equal(params.get("customer"), "cus_test_customer");
    assert.equal(params.get("metadata[plan]"), "starter_monthly");
    assert.equal(params.get("metadata[organization_id]"), "00000000-0000-0000-0000-000000000071");
    assert.equal(params.get("subscription_data[metadata][plan]"), "starter_monthly");
    assert.equal(params.get("subscription_data[metadata][organization_id]"), "00000000-0000-0000-0000-000000000071");
  });

  it("POST /api/billing/create-checkout-session aliases checkout creation", async function() {
    configureSupabaseForCheckout();
    process.env.STRIPE_SECRET_KEY = validStripeSecret;
    process.env.STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY = validStarterPrice;
    process.env.APP_URL = "https://sonaraindustries.com";

    const originalFetch = global.fetch;
    global.fetch = mockCheckoutFetch();

    const res = await request(app)
      .post("/api/billing/create-checkout-session")
      .set("Authorization", "Bearer customer-session")
      .set("Accept", "application/json")
      .send({ priceKey: "business_builder_monthly" });

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.equal(res.body.checkout_url, "https://checkout.stripe.com/c/session_test");
  });

  it("POST /api/billing/create-portal-session creates Stripe portal sessions safely", async function() {
    configureSupabaseForCheckout();
    process.env.STRIPE_SECRET_KEY = validStripeSecret;
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000104", email: "customer@example.com" }) };
      }
      if (String(url).includes("/organization_members")) {
        return { ok: true, json: async () => [{ organization_id: "00000000-0000-0000-0000-000000000071" }] };
      }
      if (String(url).includes("/stripe_customers") && (options.method || "GET") === "GET") {
        return { ok: true, json: async () => [{ stripe_customer_id: "cus_test_customer" }] };
      }
      if (String(url).includes("api.stripe.com/v1/billing_portal/sessions")) {
        return { ok: true, json: async () => ({ url: "https://billing.stripe.com/session/test" }) };
      }
      return { ok: true, json: async () => [] };
    };

    const res = await request(app)
      .post("/api/billing/create-portal-session")
      .set("Authorization", "Bearer customer-session")
      .set("Accept", "application/json")
      .send({});

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.equal(res.body.portal_url, "https://billing.stripe.com/session/test");
  });

  it("POST /api/checkout/session returns JSON for API callers", async function() {
    configureSupabaseForCheckout();
    process.env.STRIPE_SECRET_KEY = validStripeSecret;
    process.env.STRIPE_PRICE_STARTER_MONTHLY = validStarterPrice;
    process.env.APP_URL = "https://sonaraindustries.com";

    const originalFetch = global.fetch;
    global.fetch = mockCheckoutFetch();

    const res = await request(app)
      .post("/api/checkout/session")
      .set("Authorization", "Bearer customer-session")
      .set("Accept", "application/json")
      .send({ plan: "starter_monthly" });

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.equal(res.body.checkout_url, "https://checkout.stripe.com/c/session_test");
  });

  it("Stripe price validation rejects secret, product, and customer prefixes", async function() {
    configureSupabaseForCheckout();
    process.env.STRIPE_SECRET_KEY = validStripeSecret;
    process.env.STRIPE_PRICE_STARTER_MONTHLY = invalidPriceSecretPrefix;
    process.env.STRIPE_PRICE_CORE_MONTHLY = "prod_wrong";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "cus_wrong";
    const originalFetch = global.fetch;
    global.fetch = mockCheckoutFetch();

    const readiness = await request(app).get("/api/readiness").set("Accept", "application/json");
    assert.equal(readiness.status, 200);
    const invalidEnvs = readiness.body.invalid.stripe.map((item) => item.env);
    assert.ok(invalidEnvs.some((env) => env.includes("STRIPE_PRICE_STARTER_MONTHLY")));
    assert.ok(invalidEnvs.some((env) => env.includes("STRIPE_PRICE_CORE_MONTHLY")));
    assert.ok(invalidEnvs.some((env) => env.includes("STRIPE_PRICE_PRO_MONTHLY")));

    const checkout = await request(app).post("/api/checkout/session").set("Authorization", "Bearer customer-session").send({ plan: "starter_monthly" });
    global.fetch = originalFetch;
    assert.equal(checkout.status, 503);
    assert.equal(checkout.body.reason, "invalid_prefix");
  });

  it("POST /api/webhooks/stripe handles missing setup/signature safely", async function() {
    const res = await request(app).post("/api/webhooks/stripe").set("Content-Type", "application/json").send({ id: "evt_test" });
    assert.ok([400, 503].includes(res.status));
    assert.match(res.text, /setup_required|invalid_signature/);
  });

  it("POST /api/webhooks/stripe rejects invalid signatures when configured", async function() {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_signature_status_key_1234567890";
    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=123,v1=bad")
      .send({ id: "evt_test", type: "payment_intent.payment_failed" });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "invalid_signature");
  });

  it("POST /api/stripe/webhook rejects invalid signatures on the canonical endpoint", async function() {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_signature_status_key_1234567890";
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=123,v1=bad")
      .send({ id: "evt_test", type: "invoice.payment_failed" });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "invalid_signature");
  });

  it("POST /api/webhooks/stripe audits valid failure events without unlocking access", async function() {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_signature_status_key_1234567890";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sonara-webhooks.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_webhook_status_key_1234567890";
    const payload = JSON.stringify({
      id: "evt_payment_failed",
      type: "payment_intent.payment_failed",
      livemode: false,
      data: { object: { object: "payment_intent", customer: "cus_test" } }
    });
    const timestamp = "1234567890";
    const signature = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest("hex");
    const calls = [];
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), body: options.body });
      return { ok: true, json: async () => [] };
    };

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", `t=${timestamp},v1=${signature}`)
      .send(payload);

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.equal(res.body.received, true);
    assert.ok(calls.some((call) => call.url.includes("/billing_webhook_events")));
    assert.equal(calls.some((call) => call.url.includes("/billing_entitlements")), false);
    assert.equal(calls.some((call) => call.url.includes("/billing_subscriptions")), false);
  });

  it("POST /api/webhooks/stripe records active subscription state from valid subscription events", async function() {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_signature_status_key_1234567890";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sonara-webhooks.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_webhook_status_key_1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_webhook_status_key_1234567890";
    const organizationId = "00000000-0000-0000-0000-000000000051";
    const payload = JSON.stringify({
      id: "evt_subscription_updated",
      type: "customer.subscription.updated",
      livemode: false,
      data: {
        object: {
          id: "sub_test",
          customer: "cus_test",
          status: "active",
          current_period_end: 1893456000,
          cancel_at_period_end: false,
          metadata: { organization_id: organizationId, plan: "starter_monthly" }
        }
      }
    });
    const timestamp = "1234567890";
    const signature = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest("hex");
    const calls = [];
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), body: options.body });
      return { ok: true, json: async () => [] };
    };

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", `t=${timestamp},v1=${signature}`)
      .send(payload);

    global.fetch = originalFetch;

    assert.equal(res.status, 200);
    assert.equal(res.body.received, true);
    const subscription = calls.find((call) => call.url.includes("/billing_subscriptions"));
    const entitlement = calls.find((call) => call.url.includes("/billing_entitlements"));
    assert.ok(subscription);
    assert.ok(entitlement);
    assert.equal(JSON.parse(subscription.body).status, "active");
    assert.equal(JSON.parse(entitlement.body).status, "active");
  });
});

describe("auth and admin", () => {
  const adminAccessToken = "admin-session-token-placeholder";
  const adminPassword = "correct-founder-password-123";
  let originalAdminEmails;
  let originalAdminEmail;
  let originalSupabaseUrl;
  let originalSupabaseAnon;
  let originalSupabaseServiceRole;
  let originalStripeSecret;
  let originalStripeWebhookSecret;
  let originalStripeStarterPrice;

  beforeEach(() => {
    originalAdminEmails = process.env.ADMIN_EMAILS;
    originalAdminEmail = process.env.ADMIN_EMAIL;
    originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    originalSupabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    originalSupabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    originalStripeSecret = process.env.STRIPE_SECRET_KEY;
    originalStripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    originalStripeStarterPrice = process.env.STRIPE_PRICE_STARTER_MONTHLY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sonara-admin.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_admin_status_key_1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_admin_status_key_1234567890";
    process.env.ADMIN_EMAILS = "founder@example.com";
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_ACCESS_TOKEN;
  });

  afterEach(() => {
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdminEmails;
    if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = originalAdminEmail;
    if (originalSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    if (originalSupabaseAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnon;
    if (originalSupabaseServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseServiceRole;
    if (originalStripeSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalStripeSecret;
    if (originalStripeWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalStripeWebhookSecret;
    if (originalStripeStarterPrice === undefined) delete process.env.STRIPE_PRICE_STARTER_MONTHLY;
    else process.env.STRIPE_PRICE_STARTER_MONTHLY = originalStripeStarterPrice;
  });

  function installAdminFetchMock(options = {}) {
    const {
      email = "founder@example.com",
      roles = ["owner"],
      tokenOk = true,
      userOk = true
    } = options;
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, fetchOptions = {}) => {
      const requestUrl = String(url);
      calls.push({ url: requestUrl, method: fetchOptions.method || "GET", body: fetchOptions.body });
      if (requestUrl.includes("/auth/v1/token")) {
        return tokenOk
          ? { ok: true, json: async () => ({ access_token: adminAccessToken, expires_in: 3600 }) }
          : { ok: false, json: async () => ({}) };
      }
      if (requestUrl.includes("/auth/v1/user")) {
        return userOk
          ? { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000003", email }) }
          : { ok: false, json: async () => ({}) };
      }
      if (requestUrl.includes("/user_roles")) return { ok: true, json: async () => roles.map((role) => ({ role })) };
      if (requestUrl.includes("/rest/v1/")) return { ok: true, headers: { get: () => "0-0/1" }, json: async () => [] };
      return { ok: true, json: async () => [] };
    };
    return { calls, restore: () => { global.fetch = originalFetch; } };
  }

  it("GET /login returns 200", async function() {
    const res = await request(app).get("/login").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Login/);
    assert.doesNotMatch(res.text, /Google/);
  });

  it("GET /admin without auth returns JSON 401 for API clients", async function() {
    const res = await request(app).get("/admin").set("Accept", "application/json");
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { ok: false, code: "admin_auth_required" });
  });

  it("GET /admin with Supabase owner bearer succeeds", async function() {
    const mock = installAdminFetchMock();
    const res = await request(app).get("/admin").set("Authorization", "Bearer owner-session").set("Accept", "text/html");
    mock.restore();

    assert.equal(res.status, 200);
    assert.match(res.text, /Protected founder operations/);
    assert.match(res.text, /Users and roles/);
    assert.match(res.text, /Billing and webhooks/);
    assert.match(res.text, /Support queue/);
    assert.match(res.text, /Product catalog/);
    assert.match(res.text, /System and storage/);
    assert.match(res.text, /href="\/admin\/database"/);
    assert.match(res.text, /href="\/admin\/storage"/);
    assert.match(res.text, /Logout/);
    assert.doesNotMatch(res.text, /owner-session/);
    assert.ok(mock.calls.some((call) => call.url.includes("/user_roles")));
  });

  it("owner/admin override can access all internal product workspaces", async function() {
    const mock = installAdminFetchMock();
    for (const route of ["/dashboard", "/business-builder/dashboard", "/business-builder/customers", "/business-builder/employees", "/creator-studio/dashboard", "/creator-studio/monetization", "/growth-studio/dashboard", "/growth-studio/analytics"]) {
      const res = await request(app).get(route).set("Authorization", "Bearer owner-session").set("Accept", "text/html");
      assert.equal(res.status, 200, route);
      assert.match(res.text, /Owner\/Admin access|Employee access|Dashboard|Analytics|Monetization/);
      assert.doesNotMatch(res.text, /owner-session/);
    }
    mock.restore();
  });

  it("admin control-center routes require founder access and render safely", async function() {
    const routes = [
      "/admin/users",
      "/admin/roles",
      "/admin/subscriptions",
      "/admin/webhooks",
      "/admin/support",
      "/admin/catalog",
      "/admin/system",
      "/admin/database",
      "/admin/storage",
      "/admin/business-builder",
      "/admin/creator-studio",
      "/admin/growth-studio"
    ];
    const mock = installAdminFetchMock();
    for (const route of routes) {
      const res = await request(app).get(route).set("Authorization", "Bearer owner-session").set("Accept", "text/html");
      assert.equal(res.status, 200, route);
      assert.match(res.text, /Founder operations/);
      assert.doesNotMatch(res.text, /owner-session/);
      assert.doesNotMatch(res.text, /service-role-value-that-must-not-render|sk_test_value_that_must_not_render|whsec_value_that_must_not_render/);
    }
    mock.restore();
  });

  it("GET /admin rejects normal customer bearer sessions", async function() {
    const mock = installAdminFetchMock({ email: "customer@example.com", roles: [] });
    const admin = await request(app).get("/admin").set("Authorization", "Bearer customer-session").set("Accept", "application/json");
    const login = await request(app).get("/admin/login").set("Authorization", "Bearer customer-session").set("Accept", "application/json");
    mock.restore();

    assert.equal(admin.status, 401);
    assert.equal(admin.body.code, "admin_auth_required");
    assert.equal(login.status, 403);
    assert.equal(login.body.code, "admin_forbidden");
  });

  it("POST /admin/login rejects normal customer bearer sessions", async function() {
    const mock = installAdminFetchMock({ email: "customer@example.com", roles: [] });
    const res = await request(app)
      .post("/admin/login")
      .set("Authorization", "Bearer customer-session")
      .set("Accept", "application/json")
      .type("form")
      .send({ email: "founder@example.com", password: adminPassword });
    mock.restore();

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "admin_forbidden");
  });

  it("GET /admin/login renders Supabase email/password admin form safely", async function() {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_status_key_1234567890";
    process.env.STRIPE_SECRET_KEY = "sk_test_sonara_status_key_1234567890";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_sonara_status_key_1234567890";
    process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_sonara_status_1234567890";

    const res = await request(app).get("/admin/login").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Admin login/);
    assert.match(res.text, /Founder email/);
    assert.match(res.text, /Password/);
    assert.match(res.text, /Sign in to admin/);
    assert.match(res.text, /Supabase email login/);
    assert.match(res.text, /Founder email allowlist or user_roles/);
    assert.doesNotMatch(res.text, /Admin token|ADMIN_ACCESS_TOKEN|ADMIN_PASSWORD|ADMIN_PASSWORD_HASH/);
    assert.match(res.text, /grid-template-columns: repeat\(auto-fit, minmax\(280px, 1fr\)\)/);
    assert.match(res.text, /overflow-wrap: anywhere/);
    assert.match(res.text, /word-break: break-word/);
    assert.match(res.text, /STRIPE_PRICE_STARTER_MONTHLY/);
    assert.match(res.text, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(res.text, /Configured/);
    assert.doesNotMatch(res.text, /service_role_status_key_1234567890/);
    assert.doesNotMatch(res.text, /sk_test_sonara_status_key_1234567890/);
    assert.doesNotMatch(res.text, /whsec_sonara_status_key_1234567890/);
    assert.doesNotMatch(res.text, /price_sonara_status_1234567890/);
    assert.doesNotMatch(res.text, new RegExp(adminPassword));
  });

  it("GET /admin/login shows safe missing Supabase admin readiness", async function() {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_EMAIL;

    const res = await request(app).get("/admin/login").set("Accept", "text/html");
    assert.equal(res.status, 503);
    assert.match(res.text, /Supabase email login and founder access rules are required/);
    assert.match(res.text, /Supabase email login/);
    assert.match(res.text, /Missing/);
    assert.doesNotMatch(res.text, /ADMIN_ACCESS_TOKEN|ADMIN_PASSWORD/);
  });

  it("GET /admin/login marks placeholder integration values invalid without exposing them", async function() {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";
    process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_xxx";
    process.env.RESEND_API_KEY = "resend-placeholder";
    process.env.RESEND_FROM_EMAIL = "sender@example.com";
    process.env.ADMIN_EMAILS = "your-email@example.com";

    const res = await request(app).get("/admin/login").set("Accept", "text/html");

    assert.equal(res.status, 503);
    assert.match(res.text, /Invalid placeholder/);
    assert.doesNotMatch(res.text, /anon-placeholder|service-role-placeholder|sk_test_placeholder|whsec_placeholder|price_xxx|resend-placeholder/);
  });

  it("POST /admin/login with incorrect email or password fails safely", async function() {
    const mock = installAdminFetchMock({ tokenOk: false });
    const res = await request(app).post("/admin/login").type("form").send({ email: "founder@example.com", password: "wrong-password" });
    mock.restore();

    assert.equal(res.status, 401);
    assert.match(res.text, /Admin access denied/);
    assert.match(res.text, /Email or password is incorrect/);
  });

  it("POST /admin/login with non-admin account fails safely", async function() {
    const mock = installAdminFetchMock({ email: "customer@example.com", roles: [] });
    const res = await request(app).post("/admin/login").type("form").send({ email: "customer@example.com", password: adminPassword });
    mock.restore();

    assert.equal(res.status, 403);
    assert.match(res.text, /Admin access denied/);
    assert.match(res.text, /This account is not an admin/);
  });

  it("POST /admin/login with admin email/password sets HttpOnly cookie", async function() {
    const mock = installAdminFetchMock();
    const res = await request(app).post("/admin/login").type("form").send({ email: "founder@example.com", password: adminPassword });
    mock.restore();

    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/admin");
    const cookie = res.headers["set-cookie"]?.find((value) => value.startsWith("sonara_admin_session="));
    assert.ok(cookie);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.doesNotMatch(cookie, new RegExp(adminPassword));
  });

  it("GET /admin with valid admin session cookie succeeds", async function() {
    const agent = request.agent(app);
    const mock = installAdminFetchMock();
    const login = await agent.post("/admin/login").type("form").send({ email: "founder@example.com", password: adminPassword });
    assert.equal(login.status, 303);

    const res = await agent.get("/admin").set("Accept", "text/html");
    mock.restore();

    assert.equal(res.status, 200);
    assert.match(res.text, /Protected founder operations/);
  });

  it("POST /admin/logout clears cookie", async function() {
    const agent = request.agent(app);
    const mock = installAdminFetchMock();
    await agent.post("/admin/login").type("form").send({ email: "founder@example.com", password: adminPassword });

    const res = await agent.post("/admin/logout");
    mock.restore();

    assert.equal(res.status, 303);
    const cookie = res.headers["set-cookie"]?.find((value) => value.startsWith("sonara_admin_session="));
    assert.ok(cookie);
    assert.match(cookie, /Expires=Thu, 01 Jan 1970/);
  });

  it("admin JSON APIs return safe overview and env status", async function() {
    const mock = installAdminFetchMock();
    const overview = await request(app).get("/api/admin/overview").set("Authorization", "Bearer owner-session").set("Accept", "application/json");
    const env = await request(app).get("/api/admin/env-status").set("Authorization", "Bearer owner-session").set("Accept", "application/json");
    const database = await request(app).get("/api/admin/database-readiness").set("Authorization", "Bearer owner-session").set("Accept", "application/json");
    const storage = await request(app).get("/api/admin/storage-readiness").set("Authorization", "Bearer owner-session").set("Accept", "application/json");
    mock.restore();

    assert.equal(overview.status, 200);
    assert.equal(overview.body.ok, true);
    assert.ok(Object.prototype.hasOwnProperty.call(overview.body.metrics, "users"));
    assert.equal(env.status, 200);
    assert.equal(env.body.ok, true);
    assert.ok(Array.isArray(env.body.checks));
    assert.equal(database.status, 200);
    assert.ok(Array.isArray(database.body.tables));
    assert.ok(database.body.tables.some((item) => item.table === "creator_assets"));
    assert.equal(storage.status, 200);
    assert.ok(Array.isArray(storage.body.buckets));
    assert.ok(storage.body.buckets.some((item) => item.bucket === "creator-assets"));
    assert.doesNotMatch(JSON.stringify(env.body), /service-role-value-that-must-not-render|sk_test_value_that_must_not_render|whsec_value_that_must_not_render/);
    assert.doesNotMatch(JSON.stringify(database.body), /service-role-value-that-must-not-render|sk_test_value_that_must_not_render|whsec_value_that_must_not_render/);
    assert.doesNotMatch(JSON.stringify(storage.body), /service-role-value-that-must-not-render|sk_test_value_that_must_not_render|whsec_value_that_must_not_render/);
  });
});
describe("legal pages", () => {
  for (const route of [
    "/legal/terms",
    "/legal/privacy",
    "/legal/refund-policy",
    "/legal/cookie-policy",
    "/legal/acceptable-use",
    "/legal/accessibility",
    "/legal/disclaimer",
    "/legal/earnings-disclaimer",
    "/legal/ai-disclaimer",
    "/legal/payment-terms",
    "/legal/data-processing",
    "/legal/security-policy",
    "/legal/can-spam",
    "/legal/subprocessor-notice"
  ]) {
    it(`GET ${route} returns legal draft`, async function() {
      const res = await request(app).get(route).set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.equal(res.type, "text/html");
      assert.doesNotMatch(res.text, /\[To be added\]/);
      assert.match(res.text, /qualified legal review/);
      assert.match(res.text, /not legal advice/);
    });
  }

  for (const route of ["/terms", "/privacy", "/refund-policy", "/cookies", "/acceptable-use", "/accessibility", "/earnings-disclaimer"]) {
    it(`GET ${route} returns legal alias`, async function() {
      const res = await request(app).get(route).set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.match(res.text, /qualified legal review/);
      assert.match(res.text, /not legal advice/);
    });
  }
});

describe("mobile and app readiness", () => {
  it("GET /site.webmanifest returns valid JSON", async function() {
    const res = await request(app).get("/site.webmanifest").set("Accept", "application/manifest+json");
    assert.equal(res.status, 200);
    const manifest = JSON.parse(res.text);
    assert.equal(manifest.name, "SONARA Industries");
    assert.equal(manifest.display, "standalone");
  });
});

describe("fallback", () => {
  it("unknown route returns 404", async function() {
    const res = await request(app).get("/unknown-route").set("Accept", "application/json");
    assert.equal(res.status, 404);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.code, "not_found");
    assert.equal(res.body.error, "not_found");
  });
});
