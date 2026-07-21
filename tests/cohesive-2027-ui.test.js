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
  it("keeps the parent, approved companies, Nexus modes, routes, and prices in one registry", () => {
    assert.equal(SONARA_BRAND_REGISTRY.parent.name, "SONARA Industries");
    assert.equal(SONARA_BRAND_REGISTRY.parent.platform, "SONARA Nexus");
    assert.equal(SONARA_BRAND_REGISTRY.parent.message, "Build, create, and grow—without losing control.");
    assert.deepEqual(SONARA_BRAND_REGISTRY.products.map((product) => product.name), ["Business Builder", "Creator Studio", "Growth Studio"]);
    assert.deepEqual(SONARA_BRAND_REGISTRY.products.map((product) => product.experienceMode), ["Forge", "Canvas", "Signal"]);
    assert.deepEqual(SONARA_BRAND_REGISTRY.plans.map((plan) => plan.price), ["$0", "$7/mo", "$19/mo", "$39/mo"]);
  });

  it("renders one clean Nexus homepage without retired visual systems", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /sonara-application-ui\.css\?v=nexus-ui-20260721-v4/);
    assert.equal(countMatches(res.text, /sonara-application-ui\.css/g), 1);
    assert.doesNotMatch(res.text, LEGACY_ASSET_PATTERN);
    assert.doesNotMatch(res.text, /<style[\s>]/i);
    assert.match(res.text, /class="sonara-site-header"/);
    assert.match(res.text, /class="sonara-mobile-menu"/);
    assert.match(res.text, /Build, create, and grow—without losing control\./);
    assert.match(res.text, /One system\. Three focused ways to move\./);
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

  it("serves the Nexus interface assets and original brand family", async () => {
    for (const asset of [
      "/sonara-application-ui.css",
      "/sonara-prepaint.js",
      "/sonara-nexus.js",
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

  it("applies the Nexus runtime patch idempotently", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-nexus-ui-"));
    fs.mkdirSync(path.join(temp, "scripts"), { recursive: true });
    fs.mkdirSync(path.join(temp, "public"), { recursive: true });
    fs.cpSync(path.join(__dirname, "..", "ui", "nexus"), path.join(temp, "ui", "nexus"), { recursive: true });
    const sample = `const path = require("node:path");\nconst app = { use() {} };\napp.use(express.static(path.join(__dirname, "public")));\n\napp.get("/", (req, res) => {\n  return res.status(200).type("html").send(layout({ title: "Old", sections: [] }));\n});\n\nregisterProduct("business-builder", {});\n\nfunction layout({ variant = "standard" }) { const brandClass = "sonara-platform"; return \`<!doctype html>\n<html><head>\n<style>header{border-radius:30px}</style>\n<link rel="stylesheet" href="/sonara-builder-2027.css?v=old">\n<script defer src="/sonara-builder-2027.js?v=old"></script>\n  </head><body class="\${escapeHtml(brandClass)} \${variant === "home" ? "sonara-home-v3" : "sonara-standard-page"}">\n<header><a class="brand" href="/">Old</a></header>\n<main><section class="hero" data-sonara-interface="live">\${variant === "home" ? \`<aside class="sonara-interface-face">Old device</aside>\` : ""}</section></main>\n<nav class="sonara-quick-bar" aria-label="Quick actions"><a href="/dashboard">Dashboard</a></nav>\n</body></html>\`; }\n`;
    fs.writeFileSync(path.join(temp, "server.js"), sample);
    fs.copyFileSync(path.join(__dirname, "..", "scripts", "apply-premium-ui-final.cjs"), path.join(temp, "scripts", "apply-premium-ui-final.cjs"));
    const run = () => execFileSync(process.execPath, [path.join(temp, "scripts", "apply-premium-ui-final.cjs")], { cwd: temp });
    run();
    const first = fs.readFileSync(path.join(temp, "server.js"), "utf8");
    run();
    const second = fs.readFileSync(path.join(temp, "server.js"), "utf8");
    assert.equal(second, first);
    assert.equal(countMatches(second, /sonara-application-ui\.css/g), 1);
    assert.equal(countMatches(second, /sonara-nexus\.js/g), 1);
    assert.doesNotMatch(second, LEGACY_ASSET_PATTERN);
    assert.doesNotMatch(second, /<style[\s>]/i);
    assert.match(second, /sonara-mobile-menu/);
    assert.doesNotMatch(second, /sonara-command-button|sonara-interface-face|sonara-quick-bar/);
  });
});
