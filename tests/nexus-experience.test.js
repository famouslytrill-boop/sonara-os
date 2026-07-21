const request = require("supertest");
const assert = require("assert");
const app = require("../server");

describe("SONARA Nexus product experience", () => {
  it("presents the re-engineered company family and Nexus modes", async () => {
    const res = await request(app).get("/");
    assert.equal(res.status, 200);
    assert.match(res.text, /Build, create, and grow—without losing control\./);
    assert.match(res.text, /Business Builder/);
    assert.match(res.text, /Creator Studio/);
    assert.match(res.text, /Growth Studio/);
    assert.match(res.text, /FORGE/);
    assert.match(res.text, /CANVAS/);
    assert.match(res.text, /SIGNAL/);
    assert.match(res.text, /One system\. Three focused ways to move\./);
    assert.match(res.text, /nexus-product-grid/);
  });

  it("serves the original Prism Wave SVG family", async () => {
    const assets = await Promise.all([
      request(app).get("/brand/sonara-industries-mark.svg"),
      request(app).get("/brand/business-builder-mark.svg"),
      request(app).get("/brand/creator-studio-mark.svg"),
      request(app).get("/brand/growth-studio-mark.svg")
    ]);
    const bodies = assets.map((asset) => asset.body.toString("utf8"));
    for (const asset of assets) {
      assert.equal(asset.status, 200);
      assert.match(asset.headers["content-type"], /svg/);
    }
    assert.match(bodies[0], /SONARA Prism Wave/);
    assert.match(bodies[1], /Business Builder Prism mark/);
    assert.match(bodies[2], /Creator Studio Prism mark/);
    assert.match(bodies[3], /Growth Studio Prism mark/);
  });

  it("keeps original sound and haptics optional", async () => {
    const engine = await request(app).get("/sonara-nexus.js");
    assert.equal(engine.status, 200);
    assert.match(engine.text, /sound\s*:\s*"off"/);
    assert.match(engine.text, /haptics\s*:\s*"off"/);
    assert.match(engine.text, /preferences\.sound\s*!==\s*"on"/);
    assert.match(engine.text, /preferences\.haptics\s*!==\s*"on"/);
    assert.doesNotMatch(engine.text, /\.mp3|\.wav|\.ogg/i);
  });

  it("provides localized interface dictionaries and accessible settings", async () => {
    const [page, engine] = await Promise.all([request(app).get("/"), request(app).get("/sonara-nexus.js")]);
    for (const language of ["en", "es", "fr", "de"]) {
      assert.match(engine.text, new RegExp(`${language}\\s*:\\s*\\{`));
    }
    for (const value of ["en", "es", "fr", "de"]) assert.match(page.text, new RegExp(`<option value="${value}"`));
    assert.match(page.text, /aria-live="polite"/);
    assert.match(page.text, /aria-labelledby="nexus-settings-title"/);
  });
});
