const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");
const builderManifest = require("../config/sonara-builder-system.json");
const packageJson = require("../package.json");

const LEGACY_ASSET_PATTERN = /sonara-(?:cohesive-2027|builder-2027|premium-mobile-fix|interface-engine|launch-ui|premium-access-2027|premium-ux)/i;

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

  it("uses the same Nexus application frame on public and product routes", async () => {
    for (const route of ["/", "/business-builder", "/creator-studio", "/growth-studio", "/login", "/pricing", "/support"]) {
      const response = await request(app).get(route).set("Accept", "text/html");
      assert.equal(response.status, 200, `${route} unavailable`);
      assert.match(response.text, /sonara-application-ui\.css\?v=nexus-ui-20260720-v3/);
      assert.match(response.text, /sonara-prepaint\.js\?v=nexus-ui-20260720-v3/);
      assert.match(response.text, /sonara-nexus\.js\?v=nexus-ui-20260720-v3/);
      assert.doesNotMatch(response.text, /<style[\s>]/i);
      assert.doesNotMatch(response.text, /<script(?![^>]+src=)[^>]*>/i);
      assert.match(response.text, /class="sonara-site-header"/);
      assert.match(response.text, /class="sonara-mobile-menu"/);
      assert.doesNotMatch(response.text, LEGACY_ASSET_PATTERN);
      assert.doesNotMatch(response.text, /sonara-quick-bar|sonara-interface-face/);
    }
  });

  it("keeps product workflows linked without decorative preview devices", async () => {
    const response = await request(app).get("/").set("Accept", "text/html");
    for (const href of ["/business-builder/dashboard", "/creator-studio/dashboard", "/growth-studio/dashboard", "/free-tools", "/pricing", "/service-catalog", "/requests", "/deliverables"]) {
      assert.match(response.text, new RegExp(`href="${href.replace(/\//g, "\\/")}"`));
    }
    assert.doesNotMatch(response.text, /Launch command center|Live configuration|Mobile-ready/i);
  });

  it("keeps the canonical stylesheet responsive, accessible, and motion-safe", () => {
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-application-ui.css"), "utf8");
    assert.match(styles, /@media\s*\(max-width:\s*920px\)/);
    assert.match(styles, /@media\s*\(max-width:\s*680px\)/);
    assert.match(styles, /@media\s*\(max-width:\s*420px\)/);
    assert.match(styles, /prefers-reduced-motion/);
    assert.match(styles, /grid-template-columns:\s*1fr/);
    assert.match(styles, /overflow-x:\s*clip/);
    assert.match(styles, /min-height:\s*44px/);
    assert.doesNotMatch(styles, /\.sonara-quick-bar/);
  });
});
