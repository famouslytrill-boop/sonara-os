const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const app = require("../server");
const { SONARA_BRAND_REGISTRY } = require("../lib/sonara-brand-registry.cjs");

const LEGACY_ASSET_PATTERN = /sonara-(?:brand-system|friendly-premium|interface-engine|launch-ui|cohesive-2027|builder-2027|premium-mobile|premium-access|premium-ux)/i;

function countMatches(value, pattern) {
  return (value.match(pattern) || []).length;
}

describe("canonical responsive application interface", () => {
  it("keeps the canonical company, products, routes, and approved prices in one registry", () => {
    assert.equal(SONARA_BRAND_REGISTRY.parent.name, "SONARA Industries");
    assert.equal(SONARA_BRAND_REGISTRY.parent.platform, "SONARA One");
    assert.equal(SONARA_BRAND_REGISTRY.parent.message, "Build. Create. Grow.");
    assert.deepEqual(SONARA_BRAND_REGISTRY.products.map((product) => product.name), ["Business Builder", "Creator Studio", "Growth Studio"]);
    assert.deepEqual(SONARA_BRAND_REGISTRY.plans.map((plan) => plan.price), ["$0", "$7/mo", "$19/mo", "$39/mo"]);
  });

  it("renders one clean homepage shell without retired visual systems", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /sonara-application-ui\.css\?v=application-ui-20260720-v4/);
    assert.equal(countMatches(res.text, /sonara-application-ui\.css/g), 1);
    assert.doesNotMatch(res.text, LEGACY_ASSET_PATTERN);
    assert.doesNotMatch(res.text, /<style[\s>]/i);
    assert.match(res.text, /class="sonara-site-header"/);
    assert.match(res.text, /class="sonara-mobile-menu"/);
    assert.match(res.text, /Build what matters\./);
    assert.match(res.text, /Choose the workspace that fits the work\./);
    assert.doesNotMatch(res.text, /sonara-command-button/);
    assert.doesNotMatch(res.text, /sonara-interface-face/);
    assert.doesNotMatch(res.text, /sonara-quick-bar/);
    assert.doesNotMatch(res.text, /Keep it moving\./i);
    assert.doesNotMatch(res.text, /Trinity Loop/i);
    assert.doesNotMatch(res.text, /data-sonara-(?:builder|cohesive)/);
    assert.match(res.headers["cache-control"] || "", /no-store/);
  });

  it("serves the single interface stylesheet and brand assets", async () => {
    for (const asset of [
      "/sonara-application-ui.css",
      "/brand/sonara-industries-mark.svg",
      "/brand/business-builder-mark.svg",
      "/brand/creator-studio-mark.svg",
      "/brand/growth-studio-mark.svg"
    ]) {
      const response = await request(app).get(asset);
      assert.equal(response.status, 200, `${asset} missing`);
    }
  });

  it("keeps the layout reflow-safe and free of floating navigation", () => {
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-application-ui.css"), "utf8");
    assert.match(styles, /@media \(max-width: 760px\)/);
    assert.match(styles, /grid-template-columns: 1fr/);
    assert.match(styles, /max-width: 100%/);
    assert.match(styles, /overflow-x: hidden/);
    assert.match(styles, /\.sonara-mobile-menu/);
    assert.match(styles, /min-height: 44px/);
    assert.doesNotMatch(styles, /position:\s*fixed/i);
    assert.doesNotMatch(styles, /backdrop-filter:\s*blur/i);
    assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/i);
  });

  it("applies the canonical runtime patch idempotently", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-application-ui-"));
    fs.mkdirSync(path.join(temp, "scripts"), { recursive: true });
    const sample = `const path = require("node:path");\nconst app = { use() {} };\napp.use(express.static(path.join(__dirname, "public")));\n\napp.get("/", (req, res) => {\n  return res.status(200).type("html").send(layout({ title: "Old", sections: [] }));\n});\n\nregisterProduct("business-builder", {});\n\nfunction layout() { return \`<!doctype html>\n<html><head>\n<style>header{border-radius:30px}</style>\n<link rel="stylesheet" href="/sonara-builder-2027.css?v=old">\n<script defer src="/sonara-builder-2027.js?v=old"></script>\n  </head><body>\n<header><a class="brand" href="/">Old</a><button class="sonara-command-button">Menu</button></header>\n<main><aside class="sonara-interface-face">Old device</aside></main>\n<nav class="sonara-quick-bar" aria-label="Quick actions"><a href="/dashboard">Dashboard</a></nav>\n</body></html>\`; }\n`;
    fs.writeFileSync(path.join(temp, "server.js"), sample);
    fs.copyFileSync(path.join(__dirname, "..", "scripts", "apply-premium-ui-final.cjs"), path.join(temp, "scripts", "apply-premium-ui-final.cjs"));
    const run = () => execFileSync(process.execPath, [path.join(temp, "scripts", "apply-premium-ui-final.cjs")], { cwd: temp });
    run();
    const first = fs.readFileSync(path.join(temp, "server.js"), "utf8");
    run();
    const second = fs.readFileSync(path.join(temp, "server.js"), "utf8");
    assert.equal(second, first);
    assert.equal(countMatches(second, /sonara-application-ui\.css/g), 1);
    assert.doesNotMatch(second, LEGACY_ASSET_PATTERN);
    assert.doesNotMatch(second, /<style[\s>]/i);
    assert.match(second, /sonara-mobile-menu/);
    assert.doesNotMatch(second, /sonara-command-button/);
    assert.doesNotMatch(second, /sonara-interface-face/);
    assert.doesNotMatch(second, /sonara-quick-bar/);
  });
});
