"use strict";

// Paper has no scrolling.
//
// The marketing entrance holds cards at opacity 0 until an IntersectionObserver
// reports them on screen. Printing never scrolls, so nothing is ever reported,
// so everything the entrance was waiting on prints blank.
//
// Measured with print media emulated, before the @media print rule existed:
//
//   /          9 of 9 entrance elements at opacity 0 -- all three product
//              cards, all three availability cards, all three eyebrow strips.
//              A hero and empty paper.
//   /pricing   2 of 3 -- "What it would cost elsewhere" and "Every plan
//              includes" both gone.
//   /start     3 of 6 of the numbered steps.
//
// This is the common case, not an edge one. Printing or saving to PDF usually
// happens on arrival, before scrolling anywhere, which is exactly when the most
// content is still hidden. Someone printing the pricing page to show a partner
// would get the plans and none of the context around them.
//
// The general rule these checks hold: a stylesheet may hide content that
// something will later reveal, but only if print is told to reveal it too,
// because print is the one medium where the reveal can never happen.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

// Only stylesheets the page frame actually links. A rule in an unlinked file
// cannot hide anything -- .sonara-skip sat unstyled in
// ui/sonara/styles/00-foundation.css for exactly that reason.
const frame = fs.readFileSync(path.join(root, "lib", "sonara-page-frame.cjs"), "utf8");
const SERVED = [...new Set([...frame.matchAll(/rel="stylesheet" href="\/([A-Za-z0-9._-]+\.css)/g)].map((match) => match[1]))];

function read(name) {
  return fs.readFileSync(path.join(root, "public", name), "utf8");
}

// Returns the body of every `@media print { ... }` block in a stylesheet.
// Brace-counted rather than regex-matched, because the block contains nested
// rules and a lazy regex would stop at the first inner closing brace.
function printBlocks(css) {
  const blocks = [];
  const pattern = /@media\s+print\s*\{/g;
  let match;
  while ((match = pattern.exec(css)) !== null) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (index < css.length && depth > 0) {
      if (css[index] === "{") depth += 1;
      else if (css[index] === "}") depth -= 1;
      index += 1;
    }
    blocks.push(css.slice(start, index - 1));
  }
  return blocks;
}

// Selectors of rules that set opacity to 0, ignoring anything already inside an
// @media print block.
function hidingSelectors(css) {
  let outside = css;
  for (const block of printBlocks(css)) outside = outside.replace(block, "");
  const found = [];
  for (const match of outside.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = match[2];
    // The value has to be exactly zero, and the terminator is required. Without
    // it this matched `opacity: 0.86` on .sonara-depth__layer--far -- a
    // decorative depth layer that is dimmed, not hidden -- and reported it as
    // content that prints blank.
    if (!/opacity\s*:\s*0(?:\.0+)?\s*(?:!important)?\s*[;}]/.test(declarations)) continue;
    // Keyframes set opacity: 0 as a starting frame; that is animation, not a
    // resting state, and the print block disables animation outright.
    if (/^\s*(?:from|to|\d+%)\s*$/.test(match[1])) continue;
    found.push(match[1].trim().replace(/\s+/g, " "));
  }
  return found;
}

describe("printing a marketing page", () => {
  it("looks at the stylesheets the frame actually serves", () => {
    assert.ok(SERVED.length >= 2, `only ${SERVED.length} stylesheets found in the frame; this check has gone blind`);
    assert.ok(SERVED.includes("sonara-design-system.css"), "the design system is not linked by the frame");
  });

  it("tells print to reveal the entrance content", () => {
    const blocks = printBlocks(read("sonara-design-system.css"));
    assert.ok(blocks.length > 0, "the design system has no @media print block, so unscrolled content prints blank");
    const combined = blocks.join("\n");
    assert.match(combined, /\[data-sonara-enter\]/, "@media print does not mention the entrance elements");
    assert.match(combined, /opacity:\s*1\s*!important/, "@media print does not force the entrance content visible");
    // Without !important the rule loses to
    // :root[data-sonara-depth="ready"] .sonara-stage [data-sonara-enter],
    // which carries an id-free but far more specific selector.
    assert.match(combined, /transform:\s*none\s*!important/, "@media print does not neutralise the entrance transform");
  });

  it("covers every selector that hides content, not just the one that was noticed", () => {
    // The generalisation. Any future rule that parks content at opacity 0
    // needs a print counterpart, or it prints blank the same way.
    for (const stylesheet of SERVED) {
      const css = read(stylesheet);
      const hidden = hidingSelectors(css);
      if (!hidden.length) continue;
      const covered = printBlocks(css).join("\n");
      assert.ok(covered, `${stylesheet} hides content at opacity 0 but has no @media print block: ${hidden.join(" | ")}`);
      for (const selector of hidden) {
        // Match on any token from the selector rather than the whole thing or
        // its last part: the print rule is deliberately written more broadly
        // than the rule it counteracts, and ".sonara-loader.is-ready" is
        // answered by a print rule on ".sonara-loader".
        //
        // Being mentioned is the bar, not being revealed. Some of these should
        // stay hidden on paper -- a dismissed loader, an idle progress bar --
        // and that is a fine answer. What is not fine is no answer, which is
        // how the marketing cards ended up printing blank.
        const tokens = selector.match(/\[data-[a-z-]+\]|\.[a-zA-Z][\w-]*/g) || [];
        assert.ok(tokens.length, `could not identify a selector token in: ${selector}`);
        assert.ok(
          tokens.some((token) => covered.includes(token)),
          `${stylesheet} hides "${selector}" but @media print never mentions it, so it prints blank or prints over the content`
        );
      }
    }
  });

  it("does not print the skip link over the first page", () => {
    // Fixed-position and visually hidden on screen; on paper it would land on
    // top of the content. It is a keyboard affordance, and paper has no
    // keyboard.
    const combined = printBlocks(read("sonara-design-system.css")).join("\n");
    assert.match(combined, /\.sonara-skip\s*\{[^}]*display:\s*none/, "the skip link is not hidden for print");
  });
});
