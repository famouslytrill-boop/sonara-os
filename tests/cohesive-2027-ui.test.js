const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const app = require("../server");
const { SONARA_BRAND_REGISTRY } = require("../lib/sonara-brand-registry.cjs");
const { renderCohesiveHomepage } = require("../lib/sonara-cohesive-homepage.cjs");

describe("cohesive 2027 public presentation", () => {
  it("keeps the canonical company, platform, products, routes, and approved prices in one runtime registry", () => {
    assert.equal(SONARA_BRAND_REGISTRY.parent.name, "SONARA Industries");
    assert.equal(SONARA_BRAND_REGISTRY.parent.platform, "SONARA One");
    assert.equal(SONARA_BRAND_REGISTRY.parent.message, "Build. Create. Grow.");
    assert.deepEqual(SONARA_BRAND_REGISTRY.products.map((product) => product.name), ["Business Builder", "Creator Studio", "Growth Studio"]);
    assert.deepEqual(SONARA_BRAND_REGISTRY.plans.map((plan) => plan.price), ["$0", "$7/mo", "$19/mo", "$39/mo"]);
    for (const product of SONARA_BRAND_REGISTRY.products) {
      assert.match(product.route, /^\/(business-builder|creator-studio|growth-studio)$/);
      assert.match(product.logo, /^\/brand\//);
    }
  });

  it("renders the cohesive homepage with live readiness states and no fake operating claims", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /sonara-cohesive-2027\.css\?v=(?:cohesive-ui-20260719|premium-ux-20260720)/);
    assert.match(res.text, /sonara-cohesive-2027\.js\?v=(?:cohesive-ui-20260719|premium-ux-20260720)/);
    assert.match(res.text, /sonara-application-ui\.css\?v=application-ui-20260720-v1/);
    assert.doesNotMatch(res.text, /sonara-premium-mobile-final\.css/);
    assert.match(res.text, /data-sonara-cohesive/);
    assert.match(res.text, /Build what matters\./);
    assert.match(res.text, /Keep it moving\./);
    assert.match(res.text, /Trinity Loop/);
    assert.match(res.text, /Account database/);
    assert.match(res.text, /Founder\/Admin protection/);
    assert.doesNotMatch(res.text, /\b12 customers\b/i);
    assert.doesNotMatch(res.text, /children/i);
  });

  it("serves the cohesive assets and semantic product controls", async () => {
    for (const asset of ["/sonara-cohesive-2027.css", "/sonara-cohesive-2027.js", "/sonara-application-ui.css", "/brand/sonara-industries-mark.svg", "/brand/business-builder-mark.svg", "/brand/creator-studio-mark.svg", "/brand/growth-studio-mark.svg"]) {
      const response = await request(app).get(asset);
      assert.equal(response.status, 200, `${asset} missing`);
    }
    const res = await request(app).get("/");
    assert.match(res.text, /role="tablist" aria-label="SONARA products"/);
    assert.match(res.text, /role="tabpanel"/);
    assert.match(res.text, /data-sonara-milestone="6"/);
    assert.match(res.text, /href="\/account\/setup"/);
    assert.match(res.text, /href="\/readiness"/);
  });

  it("keeps enhancement code consent-safe and reduced-motion aware", () => {
    const script = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-cohesive-2027.js"), "utf8");
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-cohesive-2027.css"), "utf8");
    assert.match(script, /prefers-reduced-motion/);
    assert.doesNotMatch(script, /navigator\.vibrate/);
    assert.doesNotMatch(script, /AudioContext|webkitAudioContext/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  });

  it("renders status text with a non-color-only status marker", () => {
    const html = renderCohesiveHomepage({
      accountDatabase: "configured",
      paymentConnection: "configured",
      paymentUpdates: "configured",
      emailDelivery: "configured",
      founderAccess: "configured",
      services: { legalReviewBoundary: "not_attorney_reviewed" }
    });
    assert.match(html, /is-ready/);
    assert.match(html, />Configured</);
    assert.match(html, /qualified legal review remains open/i);
    assert.match(html, /<span aria-hidden="true"><\/span><div><strong>/);
  });

  it("applies the runtime patch idempotently", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-cohesive-ui-"));
    fs.mkdirSync(path.join(temp, "scripts"), { recursive: true });
    const sample = `const registerRouteRegistryRoutes = require("./routes/sonara-route-registry-routes.cjs");\n\napp.get("/", (req, res) => {\n  return res.status(200).type("html").send(\n    layout({ title: "Old", sections: [renderHomepageContent(getReadiness())] })\n  );\n});\n\nregisterProduct("business-builder", {});\n\nfunction renderHead() { return \`<head>\n    <script defer src="/sonara-interface-engine.js?v=clark-ui-20260718-preferences"></script>\n  </head>\`; }\n`;
    fs.writeFileSync(path.join(temp, "server.js"), sample);
    fs.copyFileSync(path.join(__dirname, "..", "scripts", "apply-cohesive-2027-ui.cjs"), path.join(temp, "scripts", "apply-cohesive-2027-ui.cjs"));
    execFileSync(process.execPath, ["scripts/apply-cohesive-2027-ui.cjs"], { cwd: temp });
    execFileSync(process.execPath, ["scripts/apply-cohesive-2027-ui.cjs"], { cwd: temp });
    const patched = fs.readFileSync(path.join(temp, "server.js"), "utf8");
    assert.equal((patched.match(/renderCohesiveHomepage\(getReadiness\(\)\)/g) || []).length, 1);
    assert.equal((patched.match(/sonara-cohesive-2027\.css/g) || []).length, 1);
    assert.equal((patched.match(/sonara-premium-ux\.css/g) || []).length, 1);
  });
});
