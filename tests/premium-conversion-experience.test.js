const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");

describe("premium public conversion experience", () => {
  it("communicates the offer, audience, and next actions immediately", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /Launch your work\. Run it professionally\. Grow with evidence\./);
    assert.match(res.text, /founders, creators, and small teams/);
    assert.match(res.text, /Create free account/);
    assert.match(res.text, /Explore the three studios/);
    assert.match(res.text, /Compare plans/);
    assert.match(res.text, /Customer outcomes/);
    assert.match(res.text, /Professional systems built around the result you need next/);
  });

  it("keeps public exploration primary while preserving existing-customer workspace access", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    for (const route of ["/business-builder", "/creator-studio", "/growth-studio"]) {
      assert.match(res.text, new RegExp(`href="${route}"`));
    }
    for (const route of ["/business-builder/dashboard", "/creator-studio/dashboard", "/growth-studio/dashboard"]) {
      assert.match(res.text, new RegExp(`href="${route}"`));
    }
    assert.match(res.text, /aria-label="Existing customer workspaces"/);
  });

  it("keeps lifecycle and entitlement restrictions visible", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    for (const text of [
      "Transparent availability",
      "Active or beta",
      "Setup required",
      "Coming soon, or in review",
      "Not open yet",
      "your plan covers it"
    ]) {
      assert.match(res.text, new RegExp(text, "i"));
    }
    assert.match(res.text, /href="\/service-catalog"/);
    assert.match(res.text, /href="\/readiness"/);
  });

  it("uses proof-based copy without fake prestige or unsupported social proof", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.match(res.text, /Proof policy/);
    assert.match(res.text, /does not publish fake testimonials/);
    assert.match(res.text, /false scarcity/i);
    assert.doesNotMatch(res.text, /\$10K|\$500,000 branding campaign|fictional customer count|guaranteed search placement/i);
  });

  it("ships the mobile-first conversion layout and accessible tap targets", () => {
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-application-ui.css"), "utf8");
    assert.match(styles, /SONARA Premium Conversion Experience 2026/);
    assert.match(styles, /\.sonara-launch-boundary/);
    assert.match(styles, /\.sonara-outcome-grid/);
    assert.match(styles, /\.sonara-lifecycle-grid/);
    assert.match(styles, /@media\(max-width:680px\)[\s\S]*\.sonara-home-v3 \.sonara-hero-scene\{display:none\}/);
    assert.match(styles, /min-height:48px/);
    assert.match(styles, /grid-template-columns:1fr/);
  });

  it("keeps localized client copy synchronized with the server-rendered hero", () => {
    const engine = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-one.js"), "utf8");
    assert.match(engine, /Launch your work\. Run it professionally\. Grow with evidence\./);
    assert.match(engine, /Lanza tu trabajo\. Opéralo profesionalmente\. Crece con evidencia\./);
    assert.match(engine, /Lancez votre travail\. Gérez-le professionnellement\. Progressez avec des preuves\./);
    assert.match(engine, /Starten Sie Ihre Arbeit\. Führen Sie sie professionell\. Wachsen Sie mit Nachweisen\./);
    assert.match(engine, /Lance seu trabalho\. Opere profissionalmente\. Cresça com evidências\./);
  });
});
