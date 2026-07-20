const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");

describe("SONARA Nexus interface QA", () => {
  it("serves the canonical Nexus stylesheet and interaction engine", async () => {
    const [styles, engine] = await Promise.all([
      request(app).get("/sonara-application-ui.css"),
      request(app).get("/sonara-nexus.js")
    ]);
    assert.equal(styles.status, 200);
    assert.match(styles.headers["content-type"], /css/);
    assert.match(styles.text, /SONARA Nexus Experience System 2026/);
    assert.equal(engine.status, 200);
    assert.match(engine.headers["content-type"], /javascript/);
    assert.match(engine.text, /sonara:nexus:preferences:v1/);
  });

  it("renders a responsive brand shell with command and experience controls", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /sonara-application-ui\.css\?v=nexus-ui-20260720-v2/);
    assert.match(res.text, /sonara-prepaint\.js\?v=nexus-ui-20260720-v2/);
    assert.match(res.text, /sonara-nexus\.js\?v=nexus-ui-20260720-v2/);
    assert.doesNotMatch(res.text, /<style[\s>]/i);
    assert.doesNotMatch(res.text, /<script(?![^>]+src=)[^>]*>/i);
    assert.match(res.text, /<header class="sonara-site-header">/);
    assert.match(res.text, /<nav class="sonara-desktop-nav" aria-label="Primary">/);
    assert.match(res.text, /<details class="sonara-mobile-menu">/);
    assert.match(res.text, /data-nexus-command/);
    assert.match(res.text, /data-nexus-settings/);
    assert.match(res.text, /id="nexus-command-dialog"/);
    assert.match(res.text, /id="nexus-settings-dialog"/);
    assert.match(res.text, /id="nexus-loader"/);
    assert.doesNotMatch(res.text, /sonara-quick-bar/);
  });

  it("keeps core destinations available in desktop and mobile navigation", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    for (const href of ["/start", "/business-builder", "/creator-studio", "/growth-studio", "/free-tools", "/pricing", "/support", "/login", "/signup"]) {
      const escaped = href.replace(/\//g, "\\/");
      const matches = res.text.match(new RegExp(`href="${escaped}"`, "g")) || [];
      assert.ok(matches.length >= 2, `${href} should exist in desktop and mobile navigation`);
    }
  });

  it("prevents rejected legacy shells and unsupported claims", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.doesNotMatch(res.text, /Keep it moving/i);
    assert.doesNotMatch(res.text, /Launch command center/i);
    assert.doesNotMatch(res.text, /Live configuration/i);
    assert.doesNotMatch(res.text, /Mobile-ready &bull;/i);
    assert.doesNotMatch(res.text, /data-sonara-interface/);
    assert.match(res.headers["cache-control"] || "", /no-store/);
  });

  it("supports performant motion, accessibility preferences, and narrow-screen reflow", () => {
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-application-ui.css"), "utf8");
    const engine = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-nexus.js"), "utf8");
    assert.match(styles, /@view-transition/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(styles, /@media \(max-width: 420px\)/);
    assert.match(styles, /grid-template-columns:\s*1fr/);
    assert.match(styles, /overflow-x:\s*clip/);
    assert.match(engine, /prefers-reduced-motion/);
    assert.match(engine, /navigator\.vibrate/);
    assert.match(engine, /AudioContext/);
    assert.match(engine, /transform = `rotateX/);
    assert.doesNotMatch(styles, /\.sonara-quick-bar/);
  });

  it("documents research, implementation boundaries, and all requested research groups", () => {
    const research = fs.readFileSync(path.join(__dirname, "..", "docs", "SONARA_NEXUS_RND_2026.md"), "utf8");
    for (const company of ["Apple", "Amazon", "Tesla", "Google", "Vizio", "LG", "Walmart", "Ford", "Chevrolet", "Volkswagen", "Spotify", "YouTube", "iTunes", "Xbox", "PlayStation", "Nintendo", "Universal", "Sony Music", "Apple Music", "YouTube Music", "Target", "Activision", "Rockstar", "Honda", "Microsoft", "Unreal Engine", "Rockville", "Fossil", "Adobe", "Disney", "Pixar", "DreamWorks", "Samsung"]) {
      assert.match(research, new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    assert.match(research, /prohibited/i);
    assert.match(research, /original SONARA system/i);
  });
});
