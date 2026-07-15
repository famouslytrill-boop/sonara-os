const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");

describe("premium interface layer", () => {
  it("serves the interface engine assets", async function() {
    const script = await request(app).get("/sonara-interface-engine.js");
    assert.equal(script.status, 200);
    assert.match(script.headers["content-type"], /javascript/);
    const styles = await request(app).get("/sonara-interface-engine.css");
    assert.equal(styles.status, 200);
    assert.match(styles.headers["content-type"], /css/);
  });

  it("homepage loads the interface engine and renders the app frame", async function() {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /sonara-interface-engine\.css/);
    assert.match(res.text, /sonara-interface-engine\.js/);
    assert.match(res.text, /data-sonara-interface="live"/);
    assert.match(res.text, /sonara-hero-stage/);
    assert.match(res.text, /sonara-panel-tiles/);
    assert.match(res.text, /sonara-quick-bar/);
  });

  it("hero command panel tiles link to the three product workspaces", async function() {
    const res = await request(app).get("/").set("Accept", "text/html");
    const panel = res.text.match(/<div class="sonara-panel-tiles"[\s\S]*?<\/div>/);
    assert.ok(panel, "panel tiles markup missing");
    assert.match(panel[0], /href="\/business-builder\/dashboard"/);
    assert.match(panel[0], /href="\/creator-studio\/dashboard"/);
    assert.match(panel[0], /href="\/growth-studio\/dashboard"/);
  });

  it("mobile quick bar links the core loop with real routes", async function() {
    const res = await request(app).get("/").set("Accept", "text/html");
    const bar = res.text.match(/<nav class="sonara-quick-bar"[\s\S]*?<\/nav>/);
    assert.ok(bar, "quick bar markup missing");
    for (const href of ["/dashboard", "/requests", "/support", "/account"]) {
      assert.match(bar[0], new RegExp(`href="${href.replace(/\//g, "\\/")}"`), `${href} missing from quick bar`);
    }
  });

  it("proof pill uses clean readable separators", async function() {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.match(res.text, /Mobile-ready &bull; Paid-ready &bull; Operator-controlled/);
    assert.doesNotMatch(res.text, /â€¢/);
  });

  it("interface engine implements the progressive-enhancement capability ladder", function() {
    const engine = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-interface-engine.js"), "utf8");
    assert.match(engine, /prefers-reduced-motion/, "reduced motion guard missing");
    assert.match(engine, /navigator\.gpu/, "WebGPU feature detection missing");
    assert.match(engine, /saveData/, "low-power save-data guard missing");
    assert.match(engine, /deviceMemory/, "device memory guard missing");
    assert.match(engine, /visibilitychange/, "hidden-tab pause missing");
    assert.match(engine, /devicePixelRatio/, "pixel ratio cap missing");
    assert.doesNotMatch(engine, /requestAdapter/, "engine must never request a WebGPU adapter at page load");
  });

  it("interface engine styles freeze motion for reduced-motion users", function() {
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-interface-engine.css"), "utf8");
    assert.match(styles, /prefers-reduced-motion/);
    assert.match(styles, /\.sonara-quick-bar/);
    assert.match(styles, /aria-current="page"/);
  });

  it("hero clip fix stays present so long titles never clip", function() {
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-friendly-premium.css"), "utf8");
    assert.match(styles, /sonara-hero-clip-fix/);
    assert.match(styles, /overflow-wrap: break-word/);
  });

  it("research documents exist with implementation tasks", function() {
    const premium = fs.readFileSync(path.join(__dirname, "..", "docs", "SONARA_PREMIUM_UX_RESEARCH.md"), "utf8");
    assert.match(premium, /Implementation tasks/);
    assert.match(premium, /What must NOT be copied/);
    const external = fs.readFileSync(path.join(__dirname, "..", "docs", "SONARA_EXTERNAL_REPOSITORY_RESEARCH.md"), "utf8");
    assert.match(external, /patterns only/i);
  });
});
