const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");
const builderManifest = require("../config/sonara-builder-system.json");
const packageJson = require("../package.json");

const LEGACY_ASSET_PATTERN = /sonara-(?:cohesive-2027|builder-2027|premium-mobile-fix|interface-engine|launch-ui)/i;

describe("application-wide route presentation", () => {
  it("keeps one authoritative production stack in the builder manifest", () => {
    assert.equal(builderManifest.sourceOfTruth.code, "GitHub");
    assert.equal(builderManifest.sourceOfTruth.deployment, "Vercel");
    assert.equal(builderManifest.sourceOfTruth.database, "Supabase Postgres");
    assert.equal(builderManifest.sourceOfTruth.billing, "Stripe");
    assert.equal(builderManifest.sourceOfTruth.email, "Resend");
    assert.match(builderManifest.builders.base44, /isolated prototypes only/i);
  });

  it("does not regenerate retired UI systems during builds or tests", () => {
    const runtime = packageJson.scripts["apply:runtime"];
    assert.doesNotMatch(runtime, /apply:cohesive-ui/);
    assert.doesNotMatch(runtime, /apply:builder-ui/);
    assert.equal(packageJson.scripts["apply:cohesive-ui"], undefined);
    assert.equal(packageJson.scripts["apply:builder-ui"], undefined);
    assert.match(runtime, /apply:premium-ui-final/);
  });

  it("uses the same responsive shell on public and product routes", async () => {
    for (const route of ["/", "/business-builder", "/creator-studio", "/growth-studio", "/login", "/pricing", "/support"]) {
      const response = await request(app).get(route).set("Accept", "text/html");
      assert.equal(response.status, 200, `${route} unavailable`);
      assert.match(response.text, /sonara-application-ui\.css\?v=application-ui-20260720-v4/);
      assert.doesNotMatch(response.text, /<style[\s>]/i);
      assert.match(response.text, /class="sonara-site-header"/);
      assert.match(response.text, /class="sonara-mobile-menu"/);
      assert.doesNotMatch(response.text, LEGACY_ASSET_PATTERN);
      assert.doesNotMatch(response.text, /sonara-quick-bar/);
      assert.doesNotMatch(response.text, /sonara-interface-face/);
    }
  });

  it("keeps product workflows linked without decorative preview shells", async () => {
    const response = await request(app).get("/").set("Accept", "text/html");
    assert.match(response.text, /href="\/business-builder\/dashboard"/);
    assert.match(response.text, /href="\/creator-studio\/dashboard"/);
    assert.match(response.text, /href="\/growth-studio\/dashboard"/);
    assert.match(response.text, /href="\/free-tools"/);
    assert.match(response.text, /href="\/pricing"/);
    assert.doesNotMatch(response.text, /Launch command center/i);
    assert.doesNotMatch(response.text, /Live configuration/i);
  });

  it("keeps the canonical stylesheet mobile-first, accessible, and motion-safe", () => {
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-application-ui.css"), "utf8");
    assert.match(styles, /@media \(max-width: 920px\)/);
    assert.match(styles, /@media \(max-width: 760px\)/);
    assert.match(styles, /@media \(max-width: 420px\)/);
    assert.match(styles, /prefers-reduced-motion/);
    assert.match(styles, /grid-template-columns: 1fr/);
    assert.match(styles, /overflow-wrap: anywhere/);
    assert.match(styles, /min-height: 44px/);
    assert.doesNotMatch(styles, /position:\s*fixed/i);
  });
});
