const request = require("supertest");
const assert = require("assert");
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
    assert.doesNotMatch(res.text, /Express service is online/);
  });

  for (const route of [
    "/business-builder",
    "/business-builder/dashboard",
    "/business-builder/launch-readiness",
    "/creator-studio",
    "/creator-studio/dashboard",
    "/creator-studio/launch-readiness",
    "/growth-studio",
    "/growth-studio/dashboard",
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

  it("pricing uses readable setup text", async function() {
    const res = await request(app).get("/pricing").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Checkout setup required/);
    assert.doesNotMatch(res.text, /setup_required/);
    assert.doesNotMatch(res.text, /Public readiness shell/);
    assert.match(res.text, /Public readiness checklist/);
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
  for (const route of ["/", "/pricing", "/business-builder/dashboard"]) {
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
    assert.deepEqual(res.body, { ok: true });
  });

  it("GET /api/readiness returns non-secret flags", async function() {
    const res = await request(app).get("/api/readiness").set("Accept", "application/json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(["configured", "missing"].includes(res.body.services.supabase));
    assert.ok(["configured", "missing"].includes(res.body.services.stripe));
    assert.ok(["configured", "missing"].includes(res.body.services.resend));
    assert.ok(["configured", "missing"].includes(res.body.services.googleOAuth));
    assert.ok(["configured", "missing"].includes(res.body.services.adminProtection));
    assert.equal(res.body.services.legalPages, "review_required");
    assert.ok(["enabled", "setup_required"].includes(res.body.services.checkout));
    assert.ok(["enabled", "setup_required"].includes(res.body.services.emailDelivery));
    assert.equal(res.text.includes("SUPABASE_SERVICE_ROLE_KEY="), false);
    assert.equal(res.text.includes("STRIPE_SECRET_KEY="), false);
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
  it("POST /auth/login returns setup_required when Supabase is missing", async function() {
    const res = await request(app).post("/auth/login").send({ email: "owner@example.com", password: "password123" });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "setup_required");
  });

  it("POST /auth/signup returns setup_required when Supabase is missing", async function() {
    const res = await request(app).post("/auth/signup").send({ email: "owner@example.com", password: "password123" });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "setup_required");
  });
});

describe("product module APIs", () => {
  it("POST /api/business-builder/offers validates input", async function() {
    const res = await request(app).post("/api/business-builder/offers").send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "validation_failed");
  });

  it("POST /api/business-builder/offers returns deterministic output", async function() {
    const res = await request(app).post("/api/business-builder/offers").send({
      serviceType: "mobile detailing",
      audience: "busy local drivers",
      priceIdea: "$99",
      deliverables: "wash, wax, interior",
      proofPoints: "insured, local"
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.output.pricePosition, "$99");
  });

  it("POST /api/creator-studio/offers validates input", async function() {
    const res = await request(app).post("/api/creator-studio/offers").send({});
    assert.equal(res.status, 400);
  });

  it("POST /api/growth-studio/campaigns validates input", async function() {
    const res = await request(app).post("/api/growth-studio/campaigns").send({});
    assert.equal(res.status, 400);
  });
});

describe("pricing and checkout", () => {
  it("POST /api/checkout/session returns setup_required when Stripe is missing", async function() {
    const res = await request(app).post("/api/checkout/session").send({ plan: "starter_monthly" });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "setup_required");
  });

  it("POST /api/checkout/session rejects invalid plans", async function() {
    const res = await request(app).post("/api/checkout/session").send({ plan: "unknown" });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "invalid_plan");
  });

  it("POST /api/webhooks/stripe handles missing setup/signature safely", async function() {
    const res = await request(app).post("/api/webhooks/stripe").set("Content-Type", "application/json").send({ id: "evt_test" });
    assert.ok([400, 503].includes(res.status));
    assert.match(res.text, /setup_required|invalid_signature/);
  });
});

describe("auth and admin", () => {
  const adminToken = "test-admin-token-1234567890abcdef123456";
  let originalAdminToken;
  let originalAdminEmails;

  beforeEach(() => {
    originalAdminToken = process.env.ADMIN_ACCESS_TOKEN;
    originalAdminEmails = process.env.ADMIN_EMAILS;
    process.env.ADMIN_ACCESS_TOKEN = adminToken;
    process.env.ADMIN_EMAILS = "founder@example.com";
  });

  afterEach(() => {
    if (originalAdminToken === undefined) delete process.env.ADMIN_ACCESS_TOKEN;
    else process.env.ADMIN_ACCESS_TOKEN = originalAdminToken;
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdminEmails;
  });

  it("GET /login returns 200", async function() {
    const res = await request(app).get("/login").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Login/);
  });

  it("GET /admin without auth returns JSON 401 for API clients", async function() {
    const res = await request(app).get("/admin").set("Accept", "application/json");
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { ok: false, code: "admin_auth_required" });
  });

  it("GET /admin with Authorization Bearer succeeds", async function() {
    const res = await request(app).get("/admin").set("Authorization", `Bearer ${adminToken}`).set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Protected founder operations/);
    assert.doesNotMatch(res.text, new RegExp(adminToken));
  });

  it("GET /admin with x-admin-token succeeds", async function() {
    const res = await request(app).get("/admin").set("x-admin-token", adminToken).set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Protected founder operations/);
  });

  it("GET /admin with temporary query token succeeds", async function() {
    const res = await request(app).get(`/admin?admin_token=${encodeURIComponent(adminToken)}`).set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Protected founder operations/);
    assert.doesNotMatch(res.text, new RegExp(adminToken));
  });

  it("GET /admin/env-readiness requires protection", async function() {
    const res = await request(app).get("/admin/env-readiness").set("Accept", "application/json");
    assert.equal(res.status, 401);
    assert.match(res.text, /admin_auth_required/);
  });

  it("GET /admin/login renders HTML", async function() {
    const res = await request(app).get("/admin/login").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Admin login/);
    assert.doesNotMatch(res.text, new RegExp(adminToken));
  });

  it("POST /admin/login with bad token fails", async function() {
    const res = await request(app).post("/admin/login").type("form").send({ token: "wrong-token" });
    assert.equal(res.status, 401);
    assert.match(res.text, /Admin access denied/);
  });

  it("POST /admin/login with good token sets HttpOnly cookie", async function() {
    const res = await request(app).post("/admin/login").type("form").send({ token: adminToken });
    assert.equal(res.status, 303);
    const cookie = res.headers["set-cookie"]?.find((value) => value.startsWith("sonara_admin_session="));
    assert.ok(cookie);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.doesNotMatch(cookie, new RegExp(adminToken));
  });

  it("GET /admin with valid cookie succeeds", async function() {
    const agent = request.agent(app);
    const login = await agent.post("/admin/login").type("form").send({ token: adminToken });
    assert.equal(login.status, 303);

    const res = await agent.get("/admin").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Protected founder operations/);
  });

  it("POST /admin/logout clears cookie", async function() {
    const agent = request.agent(app);
    await agent.post("/admin/login").type("form").send({ token: adminToken });

    const res = await agent.post("/admin/logout");
    assert.equal(res.status, 303);
    const cookie = res.headers["set-cookie"]?.find((value) => value.startsWith("sonara_admin_session="));
    assert.ok(cookie);
    assert.match(cookie, /Expires=Thu, 01 Jan 1970/);
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
    assert.equal(res.body.error, "not_found");
  });
});
