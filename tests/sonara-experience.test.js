const request = require("supertest");
const assert = require("assert");
const app = require("../server");

describe("SONARA One product experience", () => {
  it("presents the re-engineered company family and SONARA One modes", async () => {
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
    assert.match(res.text, /sonara-product-grid/);
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
    const engine = await request(app).get("/sonara-one.js");
    assert.equal(engine.status, 200);
    assert.match(engine.text, /sound\s*:\s*"off"/);
    assert.match(engine.text, /haptics\s*:\s*"off"/);
    assert.match(engine.text, /preferences\.sound\s*!==\s*"on"/);
    assert.match(engine.text, /preferences\.haptics\s*!==\s*"on"/);
    assert.doesNotMatch(engine.text, /\.mp3|\.wav|\.ogg/i);
  });

  it("provides localized interface dictionaries and accessible settings", async () => {
    const [page, engine] = await Promise.all([request(app).get("/"), request(app).get("/sonara-one.js")]);
    for (const language of ["en", "es", "fr", "de"]) {
      assert.match(engine.text, new RegExp(`${language}\\s*:\\s*\\{`));
    }
    for (const value of ["en", "es", "fr", "de"]) assert.match(page.text, new RegExp(`<option value="${value}"`));
    assert.match(page.text, /aria-live="polite"/);
    assert.match(page.text, /aria-labelledby="sonara-settings-title"/);
  });

  it("does not put two controls that look like a menu next to each other", async () => {
    // The settings button drew `M5 7h14M8 12h8M6 17h12` -- three plain
    // horizontal lines, which is the hamburger glyph -- and sat 77px from the
    // actual Menu button in the mobile header, measured in Chromium at 390px.
    // Two controls reading as the same thing is a navigation problem, not a
    // cosmetic one. It is now a sliders icon: the same lines with knobs on
    // them, which is what says "settings" rather than "menu".
    const page = await request(app).get("/");
    const button = page.text.match(/<button[^>]*data-sonara-settings[\s\S]*?<\/button>/);
    assert.ok(button, "the experience settings button was not found, so nothing here was checked");
    const svg = button[0].match(/<svg[\s\S]*?<\/svg>/);
    assert.ok(svg, "the settings button has no icon");
    assert.ok(
      /<circle/.test(svg[0]),
      "the settings icon has lost its knobs. Without them it is a stack of plain horizontal lines, " +
        "which is the hamburger glyph, and it sits beside the real Menu button in the mobile header."
    );

    // And it must not simply match the other header icon either.
    const command = page.text.match(/<button[^>]*data-sonara-command[\s\S]*?<\/button>/);
    assert.ok(command, "the command button was not found");
    const commandSvg = command[0].match(/<svg[\s\S]*?<\/svg>/);
    assert.ok(commandSvg, "the command button has no icon");
    assert.notEqual(svg[0], commandSvg[0], "the two header tool buttons draw the same icon");
  });
});
