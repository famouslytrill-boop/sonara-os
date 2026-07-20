const request = require("supertest");
const assert = require("assert");
const app = require("../server");

describe("SONARA Nexus product experience", () => {
  it("presents the re-engineered product family", async () => {
    const res = await request(app).get("/");
    assert.equal(res.status, 200);
    assert.match(res.text, /Make work move\./);
    assert.match(res.text, /SONARA Forge/);
    assert.match(res.text, /SONARA Canvas/);
    assert.match(res.text, /SONARA Signal/);
    assert.match(res.text, /One system\. Three ways to move\./);
    assert.match(res.text, /nexus-product-grid/);
  });

  it("serves the original Prism Wave SVG family", async () => {
    const assets = await Promise.all([
      request(app).get("/brand/sonara-industries-mark.svg"),
      request(app).get("/brand/business-builder-mark.svg"),
      request(app).get("/brand/creator-studio-mark.svg"),
      request(app).get("/brand/growth-studio-mark.svg")
    ]);
    for (const asset of assets) {
      assert.equal(asset.status, 200);
      assert.match(asset.headers["content-type"], /svg/);
    }
    assert.match(assets[0].text, /SONARA Prism Wave/);
    assert.match(assets[1].text, /SONARA Forge mark/);
    assert.match(assets[2].text, /SONARA Canvas mark/);
    assert.match(assets[3].text, /SONARA Signal mark/);
  });

  it("keeps original sound and haptics optional", async () => {
    const engine = await request(app).get("/sonara-nexus.js");
    assert.equal(engine.status, 200);
    assert.match(engine.text, /sound:"off"/);
    assert.match(engine.text, /haptics:"on"/);
    assert.match(engine.text, /preferences\.sound!=="on"/);
    assert.match(engine.text, /preferences\.haptics==="on"/);
    assert.doesNotMatch(engine.text, /\.mp3|\.wav|\.ogg/i);
  });

  it("provides localized shell dictionaries and accessible settings", async () => {
    const [page, engine] = await Promise.all([request(app).get("/"), request(app).get("/sonara-nexus.js")]);
    for (const language of ["en", "es", "fr", "de"]) assert.match(engine.text, new RegExp(`${language}:\\{`));
    for (const value of ["en", "es", "fr", "de"]) assert.match(page.text, new RegExp(`<option value="${value}"`));
    assert.match(page.text, /aria-live="polite"/);
    assert.match(page.text, /aria-labelledby="nexus-settings-title"/);
  });
});
