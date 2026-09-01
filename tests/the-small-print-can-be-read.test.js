"use strict";

// Whether the text this application ships can be read, and whether the palette
// stayed one palette.
//
// "Colour grading" is mostly taste and taste is not checkable. Contrast is the
// half that is: WCAG 2.1 defines relative luminance and a contrast ratio
// exactly, so whether somebody can read the small print on a card is arithmetic.
//
// Two real defects were in the shipped stylesheet when this was written:
// --nx-faint at 3.78:1 and --nx-blue at 4.16:1 on white, both below AA and both
// used for text a customer reads. They were corrected by lowering lightness
// alone -- hue moved under one degree and saturation did not move -- which is
// what "grading" should mean: the palette still looks like itself and the words
// became legible.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chainCommands } = require("../lib/sonara-release-chain.cjs");

const ROOT = path.join(__dirname, "..");
const STYLESHEET = path.join(ROOT, "public", "sonara-application-ui.css");

function toRgb(hex) {
  const raw = String(hex).replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.slice(0, 6);
  return /^[0-9a-fA-F]{6}$/.test(full) ? [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) : null;
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const first = relativeLuminance(toRgb(foreground));
  const second = relativeLuminance(toRgb(background));
  const [lighter, darker] = first > second ? [first, second] : [second, first];
  return (lighter + 0.05) / (darker + 0.05);
}

function tokens(source, selector) {
  // The selector is passed in plain -- `html[data-theme="dark"]` -- and escaped
  // exactly once here. An earlier version took a pre-escaped selector and
  // escaped it again; it happened to match anyway, which is the worst outcome,
  // because a regex that works by accident stops working when somebody tidies it.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const pattern = new RegExp(String.raw`(^|\})\s*` + escaped + String.raw`\s*\{([^}]*)\}`, "m");
  const match = source.match(pattern);
  if (!match) return null;
  return Object.fromEntries(
    [...match[2].matchAll(/--(nx-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*(?:;|$)/g)].map((entry) => [entry[1], entry[2]])
  );
}

describe("the small print can be read", () => {
  const source = fs.readFileSync(STYLESHEET, "utf8");
  const light = tokens(source, ":root");
  const dark = { ...light, ...tokens(source, 'html[data-theme="dark"]') };

  it("agrees with values anybody can check", () => {
    // Guards the arithmetic before it guards the palette. Black on white is
    // exactly 21:1 and a colour against itself is exactly 1:1; a formula that
    // gets those wrong produces plausible ratios for everything else.
    assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.01);
    assert.ok(Math.abs(contrast("#ffffff", "#ffffff") - 1) < 1e-9);
    assert.ok(Math.abs(contrast("#767676", "#ffffff") - 4.54) < 0.02, "the AA boundary grey did not land where WCAG puts it");
  });

  it("found the token blocks at all", () => {
    assert.ok(light && Object.keys(light).length > 10, "the light token block was not read; everything below is vacuous");
    assert.ok(Object.keys(tokens(source, 'html[data-theme="dark"]') || {}).length > 5, "the dark token block was not read");
  });

  it("reads at AA in both themes, for every colour a customer reads words in", () => {
    const readable = ["nx-text", "nx-ink", "nx-muted", "nx-faint", "nx-danger", "nx-success", "nx-warning", "nx-violet", "nx-blue"];
    for (const [name, palette] of [["light", light], ["dark", dark]]) {
      for (const token of readable) {
        const ratio = contrast(palette[token], palette["nx-surface"]);
        assert.ok(
          ratio >= 4.5,
          `${name}: --${token} (${palette[token]}) on --nx-surface (${palette["nx-surface"]}) is ${ratio.toFixed(2)}:1, below AA for text`
        );
      }
    }
  });

  it("keeps the focus ring visible, which is what keyboard navigation runs on", () => {
    for (const [name, palette] of [["light", light], ["dark", dark]]) {
      for (const background of ["nx-surface", "nx-bg"]) {
        const ratio = contrast(palette["nx-focus"], palette[background]);
        assert.ok(ratio >= 3, `${name}: the focus ring on --${background} is ${ratio.toFixed(2)}:1, below the 3:1 WCAG sets for a control`);
      }
    }
  });

  it("did not fix contrast by turning the palette grey", () => {
    // The correction that always passes a contrast check is desaturation, and it
    // costs the design everything. The accents have to stay accents.
    const accents = { "nx-violet": 40, "nx-blue": 60, "nx-danger": 35, "nx-success": 30 };
    for (const [token, minimumSaturation] of Object.entries(accents)) {
      const [r, g, b] = toRgb(light[token]).map((value) => value / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lightness = (max + min) / 2;
      const saturation = max === min ? 0 : lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
      assert.ok(
        saturation * 100 >= minimumSaturation,
        `--${token} is only ${(saturation * 100).toFixed(0)}% saturated; contrast was bought by draining the colour`
      );
    }
  });

  it("is checked on every release, not only here", () => {
    // A property held by a test and not by the chain is a property that holds
    // until somebody runs the chain instead of the tests.
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    assert.ok(manifest.scripts["verify:contrast"], "there is no verify:contrast script");
    // Asked of lib/sonara-release-chain.cjs, not of the string. Everything
    // after verify:db now sits in verify:gates so CI can run the whole gate in
    // one step, and matching the literal chain reported this check as missing
    // from a chain that runs it.
    assert.ok(
      chainCommands(manifest.scripts).includes("verify:contrast"),
      "the contrast check is not in the release chain, so a failing colour would ship"
    );
  });
});
