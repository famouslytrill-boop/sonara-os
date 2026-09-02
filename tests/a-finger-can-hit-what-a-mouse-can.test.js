"use strict";

// AGENTS.md: "Mobile layouts must avoid overflow and use large enough tap
// targets." The overflow half is guarded by no-page-scrolls-sideways. This is
// the other half.
//
// Measured in Chromium at a 390px viewport with touch emulation on, across
// `/`, `/pricing`, `/products`, the three product pages, `/about`, `/contact`,
// `/login`, `/signup`, `/security`, `/terms` and `/privacy`:
//
//   30 footer links   20.5px tall, no padding, in a wrapping flex row with a
//                     9px row gap -- so two stacked legal links were 29.5px
//                     apart and a mis-tap opens the wrong legal document
//   a.brand           36px tall
//   summary (menu)    42px wide
//   a.sonara-skip     43.7px tall
//
// After: 0 tap targets under 44px on all 13 routes, with the sideways-scroll
// and in-flow-overflow counts still 0.
//
// Scoped to `@media (pointer: coarse)` and not to a width, because the rule is
// about fingers rather than screens: a 1024px tablet needs it, a 700px browser
// window on a laptop does not. Measured both ways -- with the coarse block
// suppressed the footer is 467px tall and 23 links are under 44px; with it
// applied the footer is 605px and none are. The header is 67px either way, so
// the brand rule fits inside the header height rather than growing it.
//
// This file cannot re-run that measurement: the suite has no browser, and
// adding one is a dependency decision rather than a test. It guards the rules
// instead, and says so rather than implying it measured a layout.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PUBLIC = path.join(__dirname, "..", "public");
const app = fs.readFileSync(path.join(PUBLIC, "sonara-application-ui.css"), "utf8");
const designSystem = fs.readFileSync(path.join(PUBLIC, "sonara-design-system.css"), "utf8");

// The tap-target rules live inside `@media (pointer: coarse)`, so a check that
// searched the whole stylesheet could be satisfied by a min-height written
// somewhere the rule never applies.
function coarseBlocks(source) {
  const blocks = [];
  const opener = /@media\s*\(\s*pointer\s*:\s*coarse\s*\)\s*\{/g;
  for (const match of source.matchAll(opener)) {
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") depth -= 1;
      i += 1;
    }
    blocks.push(source.slice(start, i - 1));
  }
  return blocks;
}

function declarationsFor(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const pattern = new RegExp(String.raw`${escaped}[^{}]*\{([^}]*)\}`, "g");
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

const coarse = coarseBlocks(app).join("\n");

describe("a finger can hit what a mouse can", () => {
  it("has a coarse-pointer block to read", () => {
    const blocks = coarseBlocks(app);
    assert.ok(
      blocks.length >= 1,
      "sonara-application-ui.css has no @media (pointer: coarse) block, so the tap-target rules " +
        "are gone or have moved and nothing below was checked"
    );
    assert.ok(coarse.length > 60, `the coarse block is ${coarse.length} bytes; this check has gone blind`);
  });

  it("gives footer links a height a finger can find", () => {
    const links = declarationsFor(coarse, "footer nav a");
    assert.ok(links.length, "no `footer nav a` rule inside @media (pointer: coarse)");
    assert.ok(
      links.some((block) => /min-height:\s*44px/.test(block)),
      "footer links no longer get a 44px min-height on touch; measured at 20.5px without it"
    );
    assert.ok(
      links.some((block) => /display:\s*inline-flex|display:\s*flex/.test(block)),
      "min-height does nothing on an inline box -- the footer link must be a flex box for it to apply"
    );
  });

  it("widens the narrowest footer link rather than only heightening it", () => {
    // "About" measured 35px wide. Height alone left it 35x44.
    const links = declarationsFor(coarse, "footer nav a");
    assert.ok(
      links.some((block) => /padding:\s*0\s+[1-9]/.test(block)),
      'the narrowest footer link ("About", measured at 35px) has lost the horizontal padding that widened it'
    );
  });

  it("does not space the footer twice", () => {
    // The row gap goes to 0 in the coarse block because min-height now supplies
    // the separation. Leaving both would add the old 9px on top of the new 44px.
    const navs = declarationsFor(coarse, "footer nav");
    assert.ok(navs.length, "no `footer nav` rule inside @media (pointer: coarse)");
    assert.ok(
      navs.some((block) => /row-gap:\s*0/.test(block)),
      "the footer row gap is no longer zeroed on touch, so the 44px targets and the 9px gap both apply"
    );
  });

  it("gives the brand link a height too", () => {
    const brand = declarationsFor(coarse, ".brand");
    assert.ok(
      brand.some((block) => /min-height:\s*44px/.test(block)),
      "the brand link no longer gets 44px on touch; measured at 36px without it"
    );
  });

  it("sizes the menu button at 44 rather than 42", () => {
    // `.sonara-mobile-menu>summary` is written twice: a base rule that already
    // said 44px, and a narrow-screen override that said 42px. Chromium measured
    // 42 because the override won. Taking the first block with a `min-width`
    // finds the base rule and never reads the one that decides -- so every
    // block has to be checked, not just one.
    const summary = declarationsFor(app, ".sonara-mobile-menu>summary");
    assert.ok(summary.length >= 2, `found ${summary.length} mobile menu summary rules; expected the base rule and its narrow-screen override`);
    const sized = summary.filter((block) => /min-width:/.test(block));
    assert.ok(sized.length, "no mobile menu summary rule sets a width");
    for (const block of sized) {
      const width = Number(block.match(/min-width:\s*(\d+)px/)[1]);
      assert.ok(
        width >= 44,
        `a mobile menu summary rule sets min-width: ${width}px. The button measured 42x48 when a ` +
          "narrow-screen override said 42, even though the base rule said 44."
      );
    }
  });

  it("keeps the skip link at a full 44px", () => {
    // It measured 43.7px -- a third of a pixel under, from 10px of padding
    // around a 23.7px line box. Padding alone could not be trusted to reach 44.
    const skip = declarationsFor(designSystem, ".sonara-skip");
    assert.ok(skip.length, "the .sonara-skip rule was not found");
    assert.ok(
      skip.some((block) => /min-height:\s*44px/.test(block)),
      "the skip link no longer states a 44px min-height; padding alone measured 43.7px"
    );
    assert.ok(
      skip.some((block) => /box-sizing:\s*border-box/.test(block)),
      "without border-box the skip link's padding is added to the 44px rather than counted inside it"
    );
  });

  it("leaves the mouse layout alone, so this is a touch rule and not a redesign", () => {
    // The desktop footer keeps its 9px row gap and the brand keeps its 36px.
    // Verified in Chromium: at 1440 with a mouse pointer, `footer nav` row-gap
    // reads 9px and a.brand measures 40px tall.
    const outside = app.replace(/@media\s*\(\s*pointer\s*:\s*coarse\s*\)\s*\{[\s\S]*?\n\}/g, "");
    const baseFooter = declarationsFor(outside, "footer nav");
    assert.ok(baseFooter.length, "the unscoped `footer nav` rule is gone, so the mouse layout is undefined");
    assert.ok(
      baseFooter.some((block) => /gap:\s*9px\s+18px/.test(block)),
      "the mouse footer no longer carries its own 9px/18px gap; the touch rule would then be the only spacing there is"
    );
  });
});
