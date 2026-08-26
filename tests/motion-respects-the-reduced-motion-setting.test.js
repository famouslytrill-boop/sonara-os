"use strict";

// Every client asset that starts motion must also respect
// prefers-reduced-motion.
//
// The property already held when this was written -- eight files start motion
// and all eight carry a guard -- so this test is not fixing a defect. It exists
// because nothing was holding the property in place. tests/motion-brand-system.test.js
// asserts that public/sonara-application-ui.css has a reduced-motion block,
// which is true and is about that one loader; a ninth file that animates
// without a guard would fail nothing, and the whole suite would stay green
// while the guarantee quietly stopped being true.
//
// AGENTS.md puts sounds, voice announcements and haptics off by default or
// under explicit user control. Motion is the same kind of thing and the
// operating system already carries the user's answer, so the only correct
// behaviour is to read it.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PUBLIC_DIR = path.join(__dirname, "..", "public");

// CSS and JavaScript start motion in different ways, so they are detected
// differently. Neither pattern is exhaustive and neither needs to be: this
// check has to catch the ordinary ways somebody adds movement, and a file
// doing something exotic enough to slip past both is a file somebody thought
// hard about.
const CSS_STARTS_MOTION = /@keyframes|animation\s*:|transition\s*:/;
const JS_STARTS_MOTION = /requestAnimationFrame|\.animate\s*\(|style\.(?:transform|opacity)\s*=|transition\s*=/;
const RESPECTS_THE_SETTING = /prefers-reduced-motion/;

function clientAssets() {
  return fs
    .readdirSync(PUBLIC_DIR)
    .filter((name) => /\.(css|js)$/.test(name))
    .map((name) => path.join(PUBLIC_DIR, name));
}

function filesThatStartMotion() {
  const found = [];
  for (const file of clientAssets()) {
    const source = fs.readFileSync(file, "utf8");
    const pattern = file.endsWith(".css") ? CSS_STARTS_MOTION : JS_STARTS_MOTION;
    if (pattern.test(source)) found.push({ file, source });
  }
  return found;
}

describe("motion respects the reduced-motion setting", () => {
  const animating = filesThatStartMotion();

  it("finds the files that start motion", () => {
    // Without this the check below passes by having nothing to look at, which
    // is the failure it exists to prevent. A rename of public/ or a change to
    // how motion is written would empty the list, and an empty list satisfies
    // "every one of them is guarded" perfectly.
    assert.ok(
      animating.length >= 5,
      `expected several client assets to start motion; found ${animating.length}. ` +
        "If motion genuinely moved elsewhere, point this check at where it went rather than deleting it."
    );
  });

  it("guards every one of them", () => {
    const unguarded = animating
      .filter((entry) => !RESPECTS_THE_SETTING.test(entry.source))
      .map((entry) => path.relative(path.join(__dirname, ".."), entry.file));

    assert.deepEqual(
      unguarded,
      [],
      "these client assets start motion without reading prefers-reduced-motion, so a user who asked their " +
        "operating system for less movement gets it anyway"
    );
  });
});
