"use strict";

// A tap is not a hover, but the browser reports one anyway.
//
// On a touch screen there is no pointer to move away, so :hover latches onto
// the tapped element and stays there until the next tap lands somewhere else.
// Bind a 3D tilt to :hover and a customer tapping a card gets it rotated and
// left rotated -- not a hover effect, a stuck one. The fix is the pointer
// query: (hover: hover) and (pointer: fine) is true only where a real pointer
// can leave.
//
// public/sonara-design-system.css already did this, and
// tests/marketing-depth-surface.test.js already checked it -- by reading
// sonara-design-system.css and only that file. Meanwhile
// public/sonara-application-ui.css, linked by the same frame and loaded after
// it, carried two ungated 3D hover rules on .sonara-product. Nothing was
// broken on screen, because a more specific body.sonara-home-v3 rule sat on
// top of them and that one was gated -- so the guarantee held only for as long
// as .sonara-product rendered on the home page and nowhere else. A card of the
// same class on any other page would have brought the stuck tilt back, and
// every check would still have passed.
//
// So this check does not name a file. It reads the stylesheets the page frame
// actually links and holds all of them to the same rule, because the defect was
// never in a particular file -- it was in checking one file and concluding
// something about the pages.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

const frame = fs.readFileSync(path.join(root, "lib", "sonara-page-frame.cjs"), "utf8");
const SERVED = [...new Set(
  [...frame.matchAll(/rel="stylesheet" href="\/([A-Za-z0-9._-]+\.css)/g)].map((match) => match[1])
)];

// A transform that moves an element through the Z axis or rotates it out of the
// page plane. A flat translate/scale has no depth to strand, so it is not the
// subject here.
const THREE_D = /rotateX|rotateY|rotate3d|translateZ|translate3d\([^)]*,[^)]*,\s*[^0]|perspective\(/;
const POINTER_GATE = /hover:\s*hover/;

// Walks a stylesheet and returns every :hover / :focus rule that applies a 3D
// transform, paired with the @media context it sits inside. Written as a walker
// rather than a regex because the answer depends entirely on nesting: the same
// selector is correct inside one @media block and wrong outside it.
function depthHoverRules(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const open = [];
  const found = [];
  let selector = "";

  for (let i = 0; i < source.length; i += 1) {
    const character = source[i];

    if (character === "{") {
      const head = selector.trim();
      selector = "";
      if (head.startsWith("@")) {
        open.push(head);
        continue;
      }
      let depth = 1;
      let body = "";
      while (i + 1 < source.length) {
        i += 1;
        if (source[i] === "{") depth += 1;
        else if (source[i] === "}") {
          depth -= 1;
          if (depth === 0) break;
        }
        body += source[i];
      }
      // transform: none is a rule turning depth off, which is the opposite of
      // the problem -- the reduced-motion blocks are full of them.
      if (/:hover|:focus/.test(head) && THREE_D.test(body) && !/transform:\s*none/.test(body)) {
        found.push({
          selector: head.replace(/\s+/g, " "),
          media: open.filter((query) => query.startsWith("@media")).join(" ")
        });
      }
      continue;
    }

    if (character === "}") {
      open.pop();
      selector = "";
      continue;
    }

    selector += character;
  }

  return found;
}

describe("depth never latches onto a tap", () => {
  it("is looking at the stylesheets the frame links", () => {
    // Both halves matter. If the frame regex stops matching, SERVED empties and
    // every loop below passes over nothing.
    assert.ok(SERVED.length >= 2, `only ${SERVED.length} stylesheets found in the frame; this check has gone blind`);
    for (const stylesheet of SERVED) {
      assert.ok(
        fs.existsSync(path.join(root, "public", stylesheet)),
        `the frame links /${stylesheet}, which is not in public/`
      );
    }
  });

  it("finds 3D hover rules to check", () => {
    // The marketing surfaces do tilt on hover. If this drops to zero the effect
    // was removed and this file is guarding nothing -- which is worth failing
    // over, because a silent pass would read exactly like a healthy one.
    const total = SERVED
      .map((stylesheet) => depthHoverRules(fs.readFileSync(path.join(root, "public", stylesheet), "utf8")).length)
      .reduce((sum, count) => sum + count, 0);
    assert.ok(total > 0, "no 3D hover rules found in any served stylesheet; this check has gone blind");
  });

  for (const stylesheet of SERVED) {
    it(`${stylesheet} gates every 3D hover behind a real pointer`, () => {
      const rules = depthHoverRules(fs.readFileSync(path.join(root, "public", stylesheet), "utf8"));
      const ungated = rules.filter((rule) => !POINTER_GATE.test(rule.media));
      assert.deepEqual(
        ungated.map((rule) => rule.selector),
        [],
        `${stylesheet} tilts on :hover without (hover: hover), so a tap on a touch screen leaves the element rotated. ` +
          "Wrap the rule in @media (hover: hover) and (pointer: fine), as sonara-design-system.css does."
      );
    });
  }

  it("does not let specificity be the thing keeping a tap safe", () => {
    // The rule that saved the home page was body.sonara-home-v3 .sonara-product
    // -- correct, gated, and more specific than the ungated rule underneath it.
    // That is a fine way to win a cascade and a poor way to hold a guarantee:
    // it depended on where the card rendered, not on what the card was. Every
    // 3D hover rule has to be gated on its own, whatever sits above it.
    const gatedByBodyClass = SERVED.flatMap((stylesheet) =>
      depthHoverRules(fs.readFileSync(path.join(root, "public", stylesheet), "utf8"))
        .filter((rule) => /^body\./.test(rule.selector))
    );
    for (const rule of gatedByBodyClass) {
      assert.match(
        rule.media,
        POINTER_GATE,
        `${rule.selector} is scoped to a body class rather than a pointer, so the same card on another page tilts on tap`
      );
    }
  });
});
