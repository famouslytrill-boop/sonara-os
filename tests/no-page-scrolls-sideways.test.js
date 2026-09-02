"use strict";

// Every marketing page could be swiped sideways into empty space.
//
// Measured in Chromium against the running application, not inferred:
// `window.scrollTo(9999, 0)` moved `scrollX` to 34 at a 390px viewport. The
// document was 424 wide inside that 390 viewport, and walking every element
// and pseudo-element found what reached 424:
//
//   .sonara-stage::before        inset -8rem -12% auto   -> left=-34 right=424
//   .sonara-hero-stage::before   inset -20% -10% auto    -> left=-27 right=417
//
// Both are deliberate full-bleed decoration, documented as such where they are
// written, and neither is the thing to change. Being absolutely positioned,
// they grow the scrollable area, and nothing readable is out there.
// AGENTS.md: "Mobile layouts must avoid overflow."
//
// `body{overflow-x:clip}` was already present and did nothing, because the
// scrolling box is the documentElement and that was `overflow-x:visible`. The
// fix puts the clip where the scrolling actually happens. After it: sideways=0
// at 390, 820 and 1440 across `/`, `/pricing` and `/products`, with the sticky
// header still holding and both glows still painting.
//
// This file cannot re-run that measurement: the suite has no browser, and
// adding one is a dependency decision rather than a test. So it guards the
// rule instead, and says plainly that it is guarding a rule rather than a
// behaviour -- a weaker check, honestly labelled, is better than one that
// implies it measured something it did not.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PUBLIC = path.join(__dirname, "..", "public");

// The two bleeds live in two different stylesheets, so a check reading one of
// them can only ever see half of its own reason.
const sheets = {
  app: path.join(PUBLIC, "sonara-application-ui.css"),
  designSystem: path.join(PUBLIC, "sonara-design-system.css")
};
const css = Object.fromEntries(
  Object.entries(sheets).map(([name, file]) => [name, fs.readFileSync(file, "utf8")])
);

// For a bare element selector like `html` or `body`, which appear as ordinary
// words inside comments too. Anchoring to the start of a line or the end of the
// previous rule is what keeps a sentence mentioning `html` from being read as
// the html rule.
function ruleFor(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const match = source.match(new RegExp(String.raw`(?:^|\})\s*${escaped}\s*\{([^}]*)\}`, "m"));
  return match ? match[1] : null;
}

// `.sonara-stage::before` is written eight times across the design system --
// the bleeding rule, plus media-query and per-product variants that only
// restate colour or switch it off. Taking the first textual match would let a
// check that means "the glow still bleeds" be satisfied by one of the others,
// so every block is collected and the caller says which one it needs.
function rulesFor(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  // The selector may be the tail of a compound one -- the hero glow is written
  // `body.sonara-home-v3 .hero.sonara-hero-stage::before` -- so this matches it
  // wherever it sits in the selector, and only requires that a declaration
  // block follows. That is deliberately loose: a mention inside a comment can
  // pick up the next rule's block. Every caller asks whether *some* block says
  // what it needs, so an extra block cannot make a check pass -- only fail it
  // less often than it should, which is why the callers below assert on the
  // declarations rather than on the count.
  const pattern = new RegExp(String.raw`${escaped}[^{}]*\{([^}]*)\}`, "g");
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

describe("no page scrolls sideways", () => {
  it("has both stylesheets to read", () => {
    for (const [name, source] of Object.entries(css)) {
      assert.ok(
        source.length > 20000,
        `${sheets[name]} is ${source.length} bytes; this check has gone blind`
      );
    }
  });

  it("clips horizontal overflow on the element that actually scrolls", () => {
    const html = ruleFor(css.app, "html");
    assert.ok(html, "the html rule was not found, so nothing here was checked");
    assert.match(
      html,
      /overflow-x:\s*clip/,
      "html no longer clips horizontal overflow. The full-bleed decorations on " +
        ".sonara-stage::before and .sonara-hero-stage::before make the document wider than the " +
        "viewport, and body{overflow-x:clip} does not stop it -- the scrolling box is the " +
        "documentElement."
    );
  });

  it("clips rather than hides, because hidden breaks the sticky header", () => {
    // `overflow-x: hidden` on html makes it a scroll container, and the site
    // header is position:sticky. Verified in Chromium: with clip the header
    // holds at top=0 through a 600px scroll on every page tested.
    const html = ruleFor(css.app, "html");
    assert.doesNotMatch(html, /overflow-x:\s*hidden/, "overflow-x:hidden on html would break the sticky site header");
  });

  it("keeps the body rule too, so the two do not drift into disagreeing", () => {
    const body = ruleFor(css.app, "body");
    assert.ok(body, "the body rule was not found");
    assert.match(body, /overflow-x:\s*clip/, "body no longer clips, so only one of the two boxes is guarded");
  });

  it("does not lay out the mobile menu while it is closed", () => {
    // A separate finding from the same measurement pass, and not a cause of the
    // sideways scroll: the closed menu's ten links were laid out at right=440
    // in a 390px viewport -- off-screen, but still in the tab order and still
    // found by find-in-page. A closed <details> does not stop an absolutely
    // positioned child being laid out.
    //
    // Opening it was re-checked in Chromium afterwards: 10 visible links, panel
    // 390px wide and fully inside the viewport, and a pixel behind the panel
    // moved rgb(123,130,154) -> rgb(13,16,24), so it paints over the page
    // rather than through it.
    assert.match(
      css.app,
      /\.sonara-mobile-menu:not\(\[open\]\)\s*>\s*nav\s*\{[^}]*display:\s*none/,
      "a closed mobile menu is laid out again, which puts its links outside the viewport while shut"
    );
  });

  it("names the bleeds it is protecting against, so the reason survives", () => {
    // These two pseudo-elements are the whole reason for the clip. If both are
    // ever removed the rule becomes unnecessary, and this assertion is what
    // tells the next person that the rule and the bleeds belong to each other.
    //
    // The selectors below are the ones written in the stylesheets. Chromium
    // reports the elements as `main.sonara-ds.sonara-stage::before` and
    // `section.hero.sonara-hero-stage::before`, which are element descriptions
    // rather than selectors; matching on those would be matching a note about
    // the code instead of the code.
    const stageBlocks = rulesFor(css.designSystem, ".sonara-stage::before");
    assert.ok(
      stageBlocks.some((block) => /position:\s*absolute/.test(block)),
      "no .sonara-stage::before rule in sonara-design-system.css positions the glow any more; " +
        "if both bleeds have been removed, re-measure before keeping the clip"
    );
    const heroBlocks = rulesFor(css.app, ".sonara-hero-stage::before");
    assert.ok(
      heroBlocks.some((block) => /position:\s*absolute/.test(block)),
      "no .sonara-hero-stage::before rule in sonara-application-ui.css positions the glow any more; " +
        "if both bleeds have been removed, re-measure before keeping the clip"
    );
  });

  it("still lets the bleeds bleed, rather than fixing them by cancelling them", () => {
    // The point of the clip is that the decoration keeps its negative inset and
    // the page stops scrolling anyway. A later "fix" that pulls the insets back
    // to 0 would also make sideways=0, and would quietly delete the design.
    const stageBlocks = rulesFor(css.designSystem, ".sonara-stage::before");
    assert.ok(stageBlocks.length, "no .sonara-stage::before rule was found at all");
    assert.ok(
      stageBlocks.some((block) => /inset:[^;]*-\d/.test(block)),
      "no .sonara-stage::before rule bleeds outward any more, so the clip is guarding nothing"
    );
  });
});
