const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const app = require("../server");
const { SONARA_BRAND_REGISTRY } = require("../lib/sonara-brand-registry.cjs");

const LEGACY_ASSET_PATTERN = /sonara-(?:brand-system|friendly-premium|interface-engine|launch-ui|cohesive-2027|builder-2027|premium-mobile|premium-access|premium-ux)/i;
const countMatches = (value, pattern) => (value.match(pattern) || []).length;

describe("canonical responsive application interface", () => {
  it("keeps the parent, approved companies, SONARA One modes, routes, and prices in one registry", () => {
    assert.equal(SONARA_BRAND_REGISTRY.parent.name, "SONARA Industries");
    assert.equal(SONARA_BRAND_REGISTRY.parent.platform, "SONARA One");
    assert.equal(SONARA_BRAND_REGISTRY.parent.message, "Build, create, and grow—without losing control.");
    assert.deepEqual(SONARA_BRAND_REGISTRY.products.map((product) => product.name), ["Business Builder", "Creator Studio", "Growth Studio"]);
    assert.deepEqual(SONARA_BRAND_REGISTRY.products.map((product) => product.experienceMode), ["Forge", "Canvas", "Signal"]);
    assert.deepEqual(SONARA_BRAND_REGISTRY.plans.map((plan) => plan.price), ["$0", "$7/mo", "$19/mo", "$39/mo"]);
  });

  it("renders one clean SONARA One homepage without retired visual systems", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /sonara-application-ui\.css\?v=sonara-ui-20260725-v6/);
    assert.equal(countMatches(res.text, /sonara-application-ui\.css/g), 1);
    assert.doesNotMatch(res.text, LEGACY_ASSET_PATTERN);
    assert.doesNotMatch(res.text, /<style[\s>]/i);
    assert.match(res.text, /class="sonara-site-header"/);
    assert.match(res.text, /class="sonara-mobile-menu"/);
    assert.match(res.text, /Launch your work\. Run it professionally\. Grow with evidence\./);
    assert.match(res.text, /Choose the studio that matches the work\./);
    assert.match(res.text, /Business Builder/);
    assert.match(res.text, /Creator Studio/);
    assert.match(res.text, /Growth Studio/);
    assert.match(res.text, /FORGE/);
    assert.match(res.text, /CANVAS/);
    assert.match(res.text, /SIGNAL/);
    assert.doesNotMatch(res.text, /sonara-command-button|sonara-interface-face|sonara-quick-bar/);
    assert.doesNotMatch(res.text, /Keep it moving|Trinity Loop/i);
    assert.match(res.headers["cache-control"] || "", /no-store/);
  });

  it("serves the SONARA One interface assets and original brand family", async () => {
    for (const asset of [
      "/sonara-application-ui.css",
      "/sonara-prepaint.js",
      "/sonara-one.js",
      "/brand/sonara-industries-mark.svg",
      "/brand/business-builder-mark.svg",
      "/brand/creator-studio-mark.svg",
      "/brand/growth-studio-mark.svg"
    ]) {
      const response = await request(app).get(asset);
      assert.equal(response.status, 200, `${asset} missing`);
    }
  });

  it("keeps the layout reflow-safe without floating bottom navigation", () => {
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-application-ui.css"), "utf8");
    assert.match(styles, /@media\s*\(max-width:\s*680px\)/);
    assert.match(styles, /grid-template-columns:\s*1fr/);
    assert.match(styles, /max-width:\s*100%/);
    assert.match(styles, /overflow-x:\s*clip/);
    assert.match(styles, /\.sonara-mobile-menu/);
    assert.match(styles, /min-height:\s*44px/);
    assert.doesNotMatch(styles, /\.sonara-quick-bar/);
    assert.match(styles, /prefers-reduced-motion/);
  });

});
