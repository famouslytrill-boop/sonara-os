const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");

describe("responsive interface QA", () => {
  it("serves the canonical application stylesheet", async () => {
    const styles = await request(app).get("/sonara-application-ui.css");
    assert.equal(styles.status, 200);
    assert.match(styles.headers["content-type"], /css/);
    assert.match(styles.text, /SONARA canonical responsive interface/);
  });

  it("renders a standard header and native mobile menu", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /<header class="sonara-site-header">/);
    assert.match(res.text, /<nav class="sonara-desktop-nav" aria-label="Primary">/);
    assert.match(res.text, /<details class="sonara-mobile-menu">/);
    assert.match(res.text, /<summary aria-label="Open navigation">Menu<\/summary>/);
    assert.doesNotMatch(res.text, /sonara-command-button/);
    assert.doesNotMatch(res.text, /sonara-quick-bar/);
  });

  it("keeps core destinations available in both navigation modes", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    for (const href of ["/start", "/business-builder", "/creator-studio", "/growth-studio", "/free-tools", "/pricing", "/support", "/login", "/signup"]) {
      const escaped = href.replace(/\//g, "\\/");
      const matches = res.text.match(new RegExp(`href="${escaped}"`, "g")) || [];
      assert.equal(matches.length, 2, `${href} should exist in desktop and mobile navigation`);
    }
  });

  it("prevents the rejected overlapping and floating patterns", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.doesNotMatch(res.text, /Keep it moving/i);
    assert.doesNotMatch(res.text, /Launch command center/i);
    assert.doesNotMatch(res.text, /Live configuration/i);
    assert.doesNotMatch(res.text, /Mobile-ready &bull;/i);
    assert.doesNotMatch(res.text, /data-sonara-interface/);
    assert.match(res.headers["cache-control"] || "", /no-store/);
  });

  it("supports narrow-screen reflow without fixed navigation", () => {
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-application-ui.css"), "utf8");
    assert.match(styles, /main,\s*\nfooter \{\s*\n\s*width: min\(var\(--app-content\), calc\(100% - 40px\)\)/);
    assert.match(styles, /@media \(max-width: 420px\)/);
    assert.match(styles, /width: calc\(100% - 20px\)/);
    assert.match(styles, /grid-template-columns: 1fr/);
    assert.match(styles, /overflow-x: hidden/);
    assert.doesNotMatch(styles, /position:\s*fixed/i);
    assert.doesNotMatch(styles, /backdrop-filter:\s*blur/i);
  });

  it("keeps research boundaries documented", () => {
    const premium = fs.readFileSync(path.join(__dirname, "..", "docs", "SONARA_PREMIUM_UX_RESEARCH.md"), "utf8");
    assert.match(premium, /Implementation tasks/);
    assert.match(premium, /What must NOT be copied/);
    const external = fs.readFileSync(path.join(__dirname, "..", "docs", "SONARA_EXTERNAL_REPOSITORY_RESEARCH.md"), "utf8");
    assert.match(external, /patterns only/i);
  });
});
