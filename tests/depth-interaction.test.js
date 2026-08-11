"use strict";

// The 3D layer, and the four ways it has to be able to switch itself off.
//
// Depth here is CSS 3D transforms in a perspective context plus one script that
// supplies the three things CSS cannot compute: pointer position, scroll
// distance, and whether an element has entered the viewport. There is no WebGL,
// no canvas, and no library -- which is not a boast, it is the constraint. The
// Content-Security-Policy is script-src 'self' with no CDN allowance and there
// is no bundler, so a 3D library was never available.
//
// What this file protects is the set of exits. Every part of the depth system
// has to disappear under reduced motion, under the user's own motion switch, on
// small screens, and in print -- and it has to stay off work screens entirely.
// Each new effect is one more thing that can forget one of those, and a forgotten
// exit is invisible to whoever added the effect, because they are not the person
// with vestibular disorder or the phone.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public", "sonara-design-system.css"), "utf8");
const script = fs.readFileSync(path.join(root, "public", "sonara-depth.js"), "utf8");

// Every effect the depth system renders, and the selector that turns it on.
const EFFECTS = [
  { name: "card tilt", selector: '.sonara-depth[data-sonara-tilt="on"]' },
  { name: "pointer spotlight", selector: '.sonara-depth[data-sonara-tilt="on"]::after' },
  { name: "hero parallax", selector: ".sonara-hero-stage" },
  { name: "backdrop", selector: ".sonara-stage::before" }
];

describe("the depth system", () => {
  it("renders every effect only inside a stage", () => {
    // .sonara-stage is rendered by lib/sonara-page-frame.cjs for marketing
    // surfaces and never for work screens, so scoping to it is how AGENTS.md's
    // "work screens stay calm" is enforced at runtime rather than remembered.
    for (const effect of EFFECTS) {
      const escaped = effect.selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const scoped = new RegExp(`\\.sonara-stage[^{]*${escaped}|${escaped}[^{]*\\.sonara-stage`);
      const unscoped = new RegExp(`^\\s*${escaped}\\s*\\{`, "m");
      assert.ok(
        scoped.test(css) || !unscoped.test(css),
        `${effect.name} is declared outside .sonara-stage, so it would render on work screens`
      );
    }
  });

  it("switches the spotlight off under reduced motion and the motion switch", () => {
    // Two independent switches, because the OS setting and the in-product
    // control are different people saying the same thing and either one is
    // enough.
    const spotlightOff = css.match(/\.sonara-depth\[data-sonara-tilt="on"\]::after\s*\{\s*display:\s*none/g) || [];
    assert.ok(
      spotlightOff.length >= 3,
      `the spotlight must be switched off under prefers-reduced-motion, data-sonara-motion="off" and on small screens; found ${spotlightOff.length} of those rules`
    );
    assert.match(css, /:root\[data-sonara-motion="off"\][\s\S]*?::after\s*\{\s*display:\s*none/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,200}?::after \{ display: none; \}/);
  });

  it("drops the whole layer in print", () => {
    // Every print block, not the first one. There is more than one, and reading
    // only the first said the spotlight printed when it does not -- the check
    // was wrong rather than the CSS.
    const printBlocks = css.split("@media print").slice(1).join("\n");
    assert.ok(printBlocks.length > 0, "no @media print block found; this check has gone blind");
    assert.ok(printBlocks.includes(".sonara-stage::before"), "the backdrop must not print");
    assert.ok(printBlocks.includes(".sonara-depth::after"), "the spotlight must not print");
  });

  it("gives each product its own light and backdrop", () => {
    // The point of a per-product colour is that the workspaces look different
    // from each other. If these three collapse to one rule, the colour system
    // is decoration rather than orientation.
    for (const [brand, token] of [
      ["sonara-business-builder", "--sonara-build"],
      ["sonara-creator-studio", "--sonara-create"],
      ["sonara-growth-studio", "--sonara-grow"]
    ]) {
      const backdrop = new RegExp(`\\.${brand} \\.sonara-stage::before[\\s\\S]{0,700}?${token}`);
      const spotlight = new RegExp(`\\.${brand} \\.sonara-stage \\.sonara-depth\\[data-sonara-tilt="on"\\]::after[\\s\\S]{0,300}?${token}`);
      assert.ok(backdrop.test(css), `${brand} has no backdrop using ${token}`);
      assert.ok(spotlight.test(css), `${brand} has no pointer spotlight using ${token}`);
    }
  });

  it("writes the pointer position from numbers it already had", () => {
    // The spotlight needs the pointer position. So does the tilt. Computing it
    // twice would double the per-frame work for one gradient, so the same
    // handler writes both -- and this fails if a second listener appears.
    assert.match(script, /--sonara-pointer-x/);
    assert.match(script, /--sonara-pointer-y/);
    const moveListeners = (script.match(/addEventListener\(\s*"pointermove"/g) || []).length;
    assert.ok(moveListeners <= 1, `expected at most one pointermove listener; found ${moveListeners}`);
  });

  it("clears everything it set when the pointer leaves", () => {
    // A card left holding --sonara-tilt-x is a card stuck mid-rotation, and a
    // card left holding --sonara-pointer-x is a highlight frozen where the
    // pointer last was. Both look like a rendering bug rather than an effect.
    for (const property of ["--sonara-tilt-x", "--sonara-tilt-y", "--sonara-pointer-x", "--sonara-pointer-y"]) {
      assert.ok(
        script.includes(`removeProperty("${property}")`),
        `${property} is set and never cleared, so it strands on the card`
      );
    }
  });

  it("adds no dependency, because it cannot", () => {
    // CSP is script-src 'self' and there is no bundler. This is the check that
    // notices when somebody reaches for three.js.
    assert.doesNotMatch(script, /\bimport\s|\brequire\(|https?:\/\//, "the depth script must stay self-contained");
    assert.doesNotMatch(css, /@import|url\(\s*['"]?https?:/, "the design system must not fetch anything");
  });
});
