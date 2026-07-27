"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const app = require("../server");

const designSystem = fs.readFileSync(path.join(publicDir, "sonara-design-system.css"), "utf8");
const controls = fs.readFileSync(path.join(publicDir, "sonara-experience-controls.js"), "utf8");

describe("design system consolidation", () => {
  it("serves exactly one token source", () => {
    // Before consolidation, --accent was defined in seven stylesheets and load
    // order decided the winner, which is why mobile needed a "fix" and then a
    // "final". Exactly one file may declare tokens.
    // Only :root declarations count. A scoped override -- for example a
    // product card setting --sonara-accent to its own studio colour -- is the
    // token system working as intended, not a competing definition.
    const rootDeclaresAccent = (css) =>
      (css.replace(/\/\*[\s\S]*?\*\//g, "").match(/:root[^{]*\{[^}]*\}/g) || []).some((block) =>
        /--sonara-accent\s*:/.test(block)
      );

    const stylesheets = fs.readdirSync(publicDir).filter((name) => name.endsWith(".css"));
    const tokenSources = stylesheets.filter((name) =>
      rootDeclaresAccent(fs.readFileSync(path.join(publicDir, name), "utf8"))
    );

    assert.deepEqual(
      tokenSources,
      ["sonara-design-system.css"],
      `exactly one stylesheet may define design tokens, found: ${tokenSources.join(", ")}`
    );
  });

  it("no longer ships the orphaned stylesheets", () => {
    const removed = [
      "sonara-brand-system.css",
      "sonara-builder-2027.css",
      "sonara-cohesive-2027.css",
      "sonara-cohesive-2027-base.css",
      "sonara-friendly-premium.css",
      "sonara-interface-engine.css",
      "sonara-launch-ui.css",
      "sonara-premium-access-2027.css",
      "sonara-premium-mobile-final.css",
      "sonara-premium-mobile-fix.css",
      "sonara-premium-ux.css"
    ];

    for (const name of removed) {
      assert.equal(
        fs.existsSync(path.join(publicDir, name)),
        false,
        `${name} was never linked by any renderer and must not ship`
      );
    }
  });

  it("keeps every served stylesheet reachable from a renderer", () => {
    const runtime = [
      fs.readFileSync(path.join(root, "server.js"), "utf8"),
      ...fs
        .readdirSync(path.join(root, "routes"))
        .filter((name) => name.endsWith(".cjs"))
        .map((name) => fs.readFileSync(path.join(root, "routes", name), "utf8"))
    ].join("\n");

    for (const name of fs.readdirSync(publicDir).filter((entry) => entry.endsWith(".css"))) {
      assert.ok(runtime.includes(name), `${name} ships but no renderer links it`);
    }
  });
});

describe("motion, sound, and haptics default to off", () => {
  // AGENTS.md: "Sounds, voice announcements, haptics, SMS, push, and email
  // alerts must be off or explicitly user-controlled by default."
  it("ships sound and haptics off", () => {
    assert.match(controls, /sound:\s*"off"/, "sound must default to off");
    assert.match(controls, /haptics:\s*"off"/, "haptics must default to off");
  });

  it("never plays or vibrates without an explicit opt-in", () => {
    assert.match(controls, /if \(state\.sound !== "on"\) return null;/);
    assert.match(controls, /if \(state\.haptics !== "on"\) return;/);
  });

  it("honours the operating system reduced-motion setting even when motion is allowed", () => {
    assert.match(controls, /state\.motion !== "off" && !systemPrefersReducedMotion\(\)/);
  });

  it("zeroes every motion token under reduced motion rather than per-rule opt-out", () => {
    assert.match(designSystem, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(designSystem, /--sonara-dur-3:\s*0ms/);
  });

  it("creates no audio context on load", () => {
    // A speculative AudioContext costs an audio thread on every page view and
    // is blocked before user interaction anyway.
    assert.match(controls, /var audio = null;/);
    assert.doesNotMatch(controls, /new\s+(?:window\.)?AudioContext\(\)\s*;/);
  });
});

describe("design system respects the platform constraints", () => {
  it("uses CSS 3D rather than a vendored WebGL library", () => {
    assert.match(designSystem, /perspective/);
    assert.match(designSystem, /translate3d|translateZ/);

    // Check for an actual dependency, not the word. An earlier revision of this
    // test matched /webgl/i and failed on the comment explaining that WebGL is
    // deliberately not used.
    const vendored = fs
      .readdirSync(publicDir)
      .filter((name) => /three|babylon|webgl/i.test(name));
    assert.deepEqual(vendored, [], `no 3D library may be vendored into public/: ${vendored.join(", ")}`);
  });

  it("adds no external asset reference, since CSP forbids third-party origins", () => {
    const external = designSystem.match(/url\(\s*["']?https?:/gi) || [];
    assert.equal(external.length, 0, `design system must not fetch cross-origin assets: ${external.join(", ")}`);
    assert.doesNotMatch(controls, /fetch\(|XMLHttpRequest|import\(/, "controls must make no network calls");
  });

  it("keeps mobile tap targets at 44px and prevents overflow", () => {
    assert.match(designSystem, /--sonara-tap:\s*44px/);
    assert.match(designSystem, /max-width:\s*100%/);
  });

  it("gives work surfaces a calm treatment", () => {
    // AGENTS.md: work screens should be calm, clear, and operational.
    assert.match(designSystem, /\[data-sonara-surface="work"\]/);
  });
});

describe("style sources actually reach the served stylesheet", () => {
  const styleDir = path.join(root, "ui", "sonara", "styles");
  const assembled = fs.readFileSync(path.join(publicDir, "sonara-application-ui.css"), "utf8");

  // scripts/apply-premium-ui-final.cjs assembles this directory with:
  //   const canonicalFiles = allFiles.filter((file) => /^99-/.test(file));
  //   const files = canonicalFiles.length ? canonicalFiles : allFiles;
  // so anything not named 99-* is silently dropped. Six files -- including
  // 00-foundation.css -- were excluded that way, which is why later files
  // ended up redefining tokens the foundation was meant to own. This test
  // makes the rule visible instead of surprising.
  const EXCLUDED_BY_DESIGN = new Set([
    "00-foundation.css",
    "01-shell-hero.css",
    "02-products-flow.css",
    "03-components-responsive.css",
    "04-mobile-header.css",
    "05-legacy-layout-compat.css"
  ]);

  it("ships every style source that is not knowingly excluded", () => {
    const sources = fs.readdirSync(styleDir).filter((name) => name.endsWith(".css"));
    const silentlyDropped = sources.filter(
      (name) => !/^99-/.test(name) && !EXCLUDED_BY_DESIGN.has(name)
    );

    assert.deepEqual(
      silentlyDropped,
      [],
      "these style sources will be silently dropped by the assembler because they are not named 99-*: " +
        `${silentlyDropped.join(", ")}. Rename them to 99-* or add them to EXCLUDED_BY_DESIGN.`
    );
  });

  it("assembles the marketing surface", () => {
    assert.match(assembled, /SONARA marketing surface/);
  });

  it("keeps the marketing surface out of the operational screens", () => {
    // AGENTS.md: work screens should be calm, clear, and operational.
    // Not a CSS parser -- an earlier revision tried to be and tripped over an
    // @media block. This looks for the specific shape of a global rule: a
    // selector beginning at column zero that is neither an at-rule nor scoped.
    const marketing = fs
      .readFileSync(path.join(styleDir, "99-zzzzz-marketing-surface.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    const globalRules = (marketing.match(/^(?![@}\s])(?!body\.sonara-home-v3)(?!:root\[data-sonara-motion).+$/gm) || [])
      .map((line) => line.trim())
      .filter((line) => line.endsWith("{") || line.endsWith(","));

    assert.deepEqual(
      globalRules,
      [],
      `marketing rules must stay scoped to the public shell, found global: ${globalRules.join(" | ")}`
    );
  });

  it("declares no design tokens at :root", () => {
    // Scoped overrides are fine -- the studio cards each set their own accent.
    // Declaring at :root would put it back in competition with the design system.
    const marketing = fs
      .readFileSync(path.join(styleDir, "99-zzzzz-marketing-surface.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const rootBlocks = marketing.match(/:root[^{]*\{[^}]*\}/g) || [];
    const declaring = rootBlocks.filter((block) => /--sonara-(accent|bg|surface|text)[a-z0-9-]*\s*:/.test(block));
    assert.deepEqual(declaring, [], "marketing surface must not declare design tokens at :root");
  });
});

describe("pages load the design system", () => {
  it("links the stylesheet and controls on a rendered page", async () => {
    const response = await request(app).get("/").set("accept", "text/html");
    assert.equal(response.status, 200);
    assert.match(response.text, /sonara-design-system\.css/);
    assert.match(response.text, /sonara-experience-controls\.js/);
  });

  it("serves both assets", async () => {
    for (const asset of ["/sonara-design-system.css", "/sonara-experience-controls.js"]) {
      const response = await request(app).get(asset);
      assert.equal(response.status, 200, `${asset} must be served`);
    }
  });
});
