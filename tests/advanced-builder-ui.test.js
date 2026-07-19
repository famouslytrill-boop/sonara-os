const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const app = require("../server");
const { renderAdvancedBuilderHomepage } = require("../lib/sonara-advanced-builder-homepage.cjs");
const builderManifest = require("../config/sonara-builder-system.json");

describe("advanced builder presentation", () => {
  it("keeps one authoritative production stack in the builder manifest", () => {
    assert.equal(builderManifest.sourceOfTruth.code, "GitHub");
    assert.equal(builderManifest.sourceOfTruth.deployment, "Vercel");
    assert.equal(builderManifest.sourceOfTruth.database, "Supabase Postgres");
    assert.equal(builderManifest.sourceOfTruth.billing, "Stripe");
    assert.equal(builderManifest.sourceOfTruth.email, "Resend");
    assert.match(builderManifest.builders.base44, /isolated prototypes only/i);
    assert.match(builderManifest.builders.builderCompatible, /Builder\.io or Plasmic/i);
  });

  it("renders the redesigned homepage while preserving live readiness and compatibility contracts", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /sonara-builder-2027\.css\?v=advanced-builder-20260719/);
    assert.match(res.text, /sonara-builder-2027\.js\?v=advanced-builder-20260719/);
    assert.match(res.text, /data-sonara-builder/);
    assert.match(res.text, /data-sonara-cohesive/);
    assert.match(res.text, /A clearer way to build, create, and grow\./);
    assert.match(res.text, /Trinity Loop/);
    assert.match(res.text, /Account database/);
    assert.match(res.text, /Founder\/Admin protection/);
    assert.match(res.text, /role="tablist" aria-label="SONARA products"/);
    assert.match(res.text, /data-sonara-milestone="6"/);
    assert.match(res.text, /href="\/account\/setup"/);
    assert.match(res.text, /href="\/readiness"/);
    assert.doesNotMatch(res.text, /\b12 customers\b/i);
    assert.doesNotMatch(res.text, /guaranteed revenue/i);
  });

  it("serves the builder assets across public routes", async () => {
    for (const asset of ["/sonara-builder-2027.css", "/sonara-builder-2027.js"]) {
      const response = await request(app).get(asset);
      assert.equal(response.status, 200, `${asset} missing`);
    }
    for (const route of ["/", "/business-builder", "/creator-studio", "/growth-studio", "/login", "/pricing"]) {
      const response = await request(app).get(route).set("Accept", "text/html");
      assert.equal(response.status, 200, `${route} unavailable`);
      assert.match(response.text, /sonara-builder-2027\.css/);
      assert.match(response.text, /sonara-builder-2027\.js/);
    }
  });

  it("keeps enhancement code consent-safe, keyboard-aware, and reduced-motion aware", () => {
    const script = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-builder-2027.js"), "utf8");
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-builder-2027.css"), "utf8");
    assert.match(script, /prefers-reduced-motion/);
    assert.match(script, /ArrowRight/);
    assert.match(script, /aria-expanded/);
    assert.match(script, /startViewTransition/);
    assert.doesNotMatch(script, /navigator\.vibrate/);
    assert.doesNotMatch(script, /AudioContext|webkitAudioContext/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(styles, /@container/);
    assert.match(styles, /view-transition-name/);
  });

  it("renders non-color-only readiness markers", () => {
    const html = renderAdvancedBuilderHomepage({
      accountDatabase: "configured",
      paymentConnection: "configured",
      paymentUpdates: "configured",
      emailDelivery: "configured",
      founderAccess: "configured",
      services: { legalReviewBoundary: "not_attorney_reviewed" }
    });
    assert.match(html, /sonara-builder-status is-ready/);
    assert.match(html, />Configured</);
    assert.match(html, /Qualified review open/);
    assert.match(html, /<span aria-hidden="true"><\/span><div><strong>/);
  });

  it("applies the builder patch idempotently after the cohesive compatibility layer", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-builder-ui-"));
    fs.mkdirSync(path.join(temp, "scripts"), { recursive: true });
    const sample = `const registerRouteRegistryRoutes = require("./routes/sonara-route-registry-routes.cjs");\nconst { renderCohesiveHomepage } = require("./lib/sonara-cohesive-homepage.cjs");\n\napp.get("/", (req, res) => {\n  return res.status(200).type("html").send(layout({ title: "Old", sections: [\`\${renderCohesiveHomepage(getReadiness())}\`] }));\n});\n\nregisterProduct("business-builder", {});\n\nfunction renderHead() { return \`<head>\n    <script defer src="/sonara-cohesive-2027.js?v=cohesive-ui-20260719"></script>\n  </head>\`; }\n`;
    fs.writeFileSync(path.join(temp, "server.js"), sample);
    fs.copyFileSync(path.join(__dirname, "..", "scripts", "apply-advanced-builder-ui.cjs"), path.join(temp, "scripts", "apply-advanced-builder-ui.cjs"));
    const run = () => execFileSync(process.execPath, [path.join(temp, "scripts", "apply-advanced-builder-ui.cjs")], { cwd: temp });
    run();
    const first = fs.readFileSync(path.join(temp, "server.js"), "utf8");
    run();
    const second = fs.readFileSync(path.join(temp, "server.js"), "utf8");
    assert.equal(second, first);
    assert.equal((second.match(/renderAdvancedBuilderHomepage/g) || []).length, 2);
    assert.equal((second.match(/sonara-builder-2027\.css/g) || []).length, 1);
    assert.equal((second.match(/sonara-builder-2027\.js/g) || []).length, 1);
  });
});
