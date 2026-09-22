const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");
const { assetUrlPattern } = require("./helpers/asset-version.cjs");

describe("SONARA One interface QA", () => {
  it("serves the canonical stylesheet, prepaint, and interaction engine", async () => {
    const [styles, prepaint, engine] = await Promise.all([
      request(app).get("/sonara-application-ui.css"),
      request(app).get("/sonara-prepaint.js"),
      request(app).get("/sonara-one.js")
    ]);
    assert.equal(styles.status, 200);
    assert.match(styles.headers["content-type"], /css/);
    assert.match(styles.text, /SONARA One Experience System 2026/);
    assert.equal(prepaint.status, 200);
    assert.equal(engine.status, 200);
    assert.match(engine.text, /sonara:nexus:preferences:v1/);
  });

  it("renders a responsive brand interface with command and experience controls", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, assetUrlPattern("sonara-application-ui.css"));
    assert.match(res.text, assetUrlPattern("sonara-prepaint.js"));
    assert.match(res.text, assetUrlPattern("sonara-one.js"));
    assert.doesNotMatch(res.text, /<style[\s>]/i);
    assert.doesNotMatch(res.text, /<script(?![^>]+src=)[^>]*>/i);
    assert.match(res.text, /<header class="sonara-site-header">/);
    assert.match(res.text, /<nav class="sonara-desktop-nav" aria-label="Primary">/);
    assert.match(res.text, /<details class="sonara-mobile-menu">/);
    assert.match(res.text, /data-sonara-command/);
    assert.match(res.text, /data-sonara-settings/);
    assert.match(res.text, /id="sonara-command-dialog"/);
    assert.match(res.text, /id="sonara-settings-dialog"/);
    assert.match(res.text, /id="sonara-loader"/);
    assert.doesNotMatch(res.text, /sonara-quick-bar/);
  });

  it("keeps the simplified public destinations consistent in desktop and mobile navigation", async () => {
    const res = await request(app).get("/");
    const desktopStart = res.text.indexOf('<nav class="sonara-desktop-nav" aria-label="Primary">');
    const desktopEnd = desktopStart >= 0 ? res.text.indexOf("</nav>", desktopStart) : -1;
    const mobileStart = res.text.indexOf('<nav aria-label="Mobile primary">');
    const mobileEnd = mobileStart >= 0 ? res.text.indexOf("</nav>", mobileStart) : -1;
    const desktop = desktopStart >= 0 && desktopEnd >= 0 ? res.text.slice(desktopStart, desktopEnd + 6) : "";
    const mobile = mobileStart >= 0 && mobileEnd >= 0 ? res.text.slice(mobileStart, mobileEnd + 6) : "";
    assert.ok(desktop && mobile, "both public navigation surfaces should render");

    for (const href of ["/start", "/free-tools", "/pricing", "/login", "/signup"]) {
      assert.ok(desktop.includes(`href="${href}"`), `${href} should exist in desktop navigation`);
      assert.ok(mobile.includes(`href="${href}"`), `${href} should exist in mobile navigation`);
    }

    for (const href of ["/dashboard", "/support", "/business-builder", "/creator-studio", "/growth-studio"]) {
      assert.ok(!desktop.includes(`href="${href}"`), `${href} should stay out of primary desktop navigation`);
      assert.ok(!mobile.includes(`href="${href}"`), `${href} should stay out of primary mobile navigation`);
    }

    for (const label of ["Products", "Free Tools", "Pricing", "Sign in", "Start free"]) {
      assert.ok(desktop.includes(`>${label}<`), `${label} should be visible in desktop navigation`);
      assert.ok(mobile.includes(`>${label}<`), `${label} should be visible in mobile navigation`);
    }
  });

  it("prevents rejected legacy interfaces", async () => {
    const res = await request(app).get("/");
    assert.doesNotMatch(res.text, /Keep it moving/i);
    assert.doesNotMatch(res.text, /Launch command center/i);
    assert.doesNotMatch(res.text, /Live configuration/i);
    assert.doesNotMatch(res.text, /sonara-quick-bar/);
    assert.match(res.headers["cache-control"] || "", /no-store/);
  });

  it("supports performant motion, accessibility preferences, and narrow-screen reflow", () => {
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-application-ui.css"), "utf8");
    const engine = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-one.js"), "utf8");
    assert.match(styles, /@view-transition/);
    assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
    assert.match(styles, /@media\(max-width:420px\)/);
    assert.match(styles, /grid-template-columns:1fr/);
    assert.match(styles, /overflow-x:clip/);
    assert.match(engine, /prefers-reduced-motion/);
    assert.match(engine, /navigator\.vibrate/);
    assert.match(engine, /AudioContext/);
    assert.match(engine, /transform = `rotateX/);
  });

  it("documents the requested research groups and originality boundary", () => {
    const research = fs.readFileSync(path.join(__dirname, "..", "docs", "SONARA_NEXUS_RND_2026.md"), "utf8");
    for (const company of ["Apple", "Amazon", "Tesla", "Google", "Vizio", "LG", "Walmart", "Ford", "Chevrolet", "Volkswagen", "Spotify", "YouTube", "iTunes", "Xbox", "PlayStation", "Nintendo", "Universal", "Sony Music", "Apple Music", "YouTube Music", "Target", "Activision", "Rockstar", "Honda", "Microsoft", "Unreal Engine", "Rockville", "Fossil", "Adobe", "Disney", "Pixar", "DreamWorks", "Samsung"]) {
      assert.match(research, new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    assert.match(research, /prohibited/i);
    assert.match(research, /original SONARA system/i);
  });
});
