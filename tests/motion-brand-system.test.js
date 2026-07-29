const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");
const { SONARA_BRAND_REGISTRY } = require("../lib/sonara-brand-registry.cjs");

const root = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("SONARA motion brand system", () => {
  it("renders the light and dark startup experience without fake progress", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /sonara-ui-20260725-v6-motion3/);
    assert.match(res.text, /class="sonara-startup-stage"/);
    assert.match(res.text, /sonara-one-mark-v3\.svg/);
    assert.match(res.text, /sonara-one-mark-v3-dark\.svg/);
    assert.match(res.text, /Preparing your workspace/);
    assert.match(res.text, /data-sonara-loader-skip/);
    assert.match(res.text, /Build\. Create\. Grow\./);
    assert.doesNotMatch(res.text, />\s*(?:68|72)%\s*</);
  });

  it("uses the v3 logo family while retaining legacy migration metadata", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    for (const asset of [
      "/brand/sonara-one-mark-v3.svg",
      "/brand/business-builder-mark-v3.svg",
      "/brand/creator-studio-mark-v3.svg",
      "/brand/growth-studio-mark-v3.svg"
    ]) {
      assert.match(res.text, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(res.text, /data-legacy-mark="\/brand\/sonara-industries-mark\.svg"/);
  });

  it("serves every new SVG logo and identity variant", async () => {
    const assets = [
      "/brand/sonara-one-mark-v3.svg",
      "/brand/sonara-one-mark-v3-dark.svg",
      "/brand/sonara-one-mark-v3-mono.svg",
      "/brand/sonara-industries-logo-v3.svg",
      "/brand/business-builder-mark-v3.svg",
      "/brand/business-builder-logo-v3.svg",
      "/brand/creator-studio-mark-v3.svg",
      "/brand/creator-studio-logo-v3.svg",
      "/brand/growth-studio-mark-v3.svg",
      "/brand/growth-studio-logo-v3.svg"
    ];
    for (const asset of assets) {
      const res = await request(app).get(asset);
      assert.equal(res.status, 200, `${asset} should be available`);
      assert.match(res.headers["content-type"], /svg/);
      assert.match(res.body.toString("utf8"), /<svg/);
    }
  });

  it("ships restrained CSS 3D motion with dark mode and reduced-motion fallbacks", () => {
    const styles = read("public/sonara-application-ui.css");
    assert.match(styles, /SONARA Motion Brand System 2026/);
    assert.match(styles, /html\[data-theme="dark"\] \.sonara-loader/);
    assert.match(styles, /perspective:900px/);
    assert.match(styles, /transform-style:preserve-3d/);
    assert.match(styles, /@keyframes sonaraMarkMaterialize/);
    assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
    assert.match(styles, /animation:none!important/);
  });

  it("uses first-session startup, short route loading, skip control, and fail-safe timeouts", () => {
    const engine = read("public/sonara-one.js");
    assert.match(engine, /sonara:startup:v3/);
    assert.match(engine, /sessionStorage\.getItem/);
    assert.match(engine, /firstVisit \? "startup" : "route"/);
    assert.match(engine, /data-sonara-loader-skip/);
    assert.match(engine, /firstVisit \? 2600 : 1400/);
    assert.match(engine, /Loading SONARA One/);
    assert.doesNotMatch(engine, /(?:68|72)%/);
  });

  it("registers and caches the new identity without changing plan prices", () => {
    assert.equal(SONARA_BRAND_REGISTRY.parent.logo, "/brand/sonara-one-mark-v3.svg");
    assert.equal(SONARA_BRAND_REGISTRY.parent.darkLogo, "/brand/sonara-one-mark-v3-dark.svg");
    assert.deepEqual(
      SONARA_BRAND_REGISTRY.products.map((product) => product.logo),
      [
        "/brand/business-builder-mark-v3.svg",
        "/brand/creator-studio-mark-v3.svg",
        "/brand/growth-studio-mark-v3.svg"
      ]
    );
    assert.deepEqual(SONARA_BRAND_REGISTRY.plans.map((plan) => plan.price), ["$0", "$7/mo", "$19/mo", "$39/mo"]);

    const worker = read("public/sw.js");
    assert.match(worker, /preferences-motion3/);
    assert.match(worker, /sonara-one-mark-v3\.svg/);
    assert.match(worker, /sonara-application-ui\.css\?v=sonara-ui-20260725-v6-motion3/);
  });

});
