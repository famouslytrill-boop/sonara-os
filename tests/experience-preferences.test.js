"use strict";

// The Experience settings dialog has three toggles -- motion, sound, tactile
// feedback -- and none of them survived a page load.
//
// Two scripts each kept their own copy of those preferences:
//
//   sonara-one.js owns the dialog. Its change handler writes
//   "sonara:nexus:preferences:v2" and sets data-sonara-motion / -sound /
//   -haptics on <html>.
//
//   sonara-experience-controls.js kept "sonara.experience.v1" and wrote the
//   same three attributes from it -- and nothing anywhere ever wrote to that
//   store, because no caller reached window.sonaraExperience.set(). It was
//   permanently at its defaults.
//
// The page frame loads them in that order with defer, and the second one calls
// apply() unconditionally at startup. So every navigation overwrote the user's
// choice with defaults, while the checkbox kept showing the choice, because
// sonara-one.js ticks it from the store that did get written. The dialog
// reported a setting it was not applying.
//
// For sound and haptics the clobber wrote "off", which is the direction
// AGENTS.md requires by default -- so the visible symptom was only that the
// toggles did nothing. For motion it wrote "on", which put animation back for
// someone who had switched it off.
//
// These checks are about the invariant rather than the incident: one persisted
// source of truth, and one writer per attribute.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const SHARED_KEY = "sonara:nexus:preferences:v2";
const ATTRIBUTES = ["data-sonara-motion", "data-sonara-sound", "data-sonara-haptics"];

const one = read("public/sonara-one.js");
const controls = read("public/sonara-experience-controls.js");
const frame = read("lib/sonara-page-frame.cjs");

describe("experience preferences have one source of truth", () => {
  it("reads the store the settings dialog actually writes", () => {
    // The dialog's writer.
    assert.ok(one.includes(SHARED_KEY), "sonara-one.js no longer uses the shared preference key");
    assert.ok(
      controls.includes(SHARED_KEY),
      "sonara-experience-controls.js is not reading the store the dialog writes, so its copy will drift again"
    );
  });

  it("prefers the dialog's store over its own legacy key", () => {
    const loader = controls.slice(controls.indexOf("function load()"), controls.indexOf("function motionEnabled"));
    const sharedAt = loader.indexOf("SHARED_STORAGE_KEY");
    const legacyAt = loader.indexOf("STORAGE_KEY)", sharedAt === -1 ? 0 : sharedAt);
    assert.ok(sharedAt !== -1, "load() does not read the shared store");
    assert.ok(
      sharedAt < legacyAt || legacyAt === -1,
      "the legacy store is consulted before the dialog's, so a stale value would win"
    );
  });

  it("re-reads before applying rather than trusting a value from page load", () => {
    // apply() on its own uses whatever state held at load time. The dialog can
    // have written since; that stale read is how the copies diverged.
    assert.match(controls, /function refresh\(\)/);
    assert.match(controls, /state = load\(\);/);
    const listeners = controls.slice(controls.indexOf("if (window.matchMedia)"));
    assert.match(listeners, /addEventListener\("change", refresh\)/, "the OS-change listener still applies a stale value");
    assert.match(listeners, /addEventListener\("storage"/, "a change in another tab never reaches this one");
  });

  it("merges when it writes, so language and theme are not dropped", () => {
    const saver = controls.slice(controls.indexOf("function save()"), controls.indexOf("function refresh()"));
    assert.match(saver, /readStore\(SHARED_STORAGE_KEY\) \|\| \{\}/, "save() replaces the store instead of merging into it");
    assert.match(saver, /existing\.motion/);
  });

  it("never lets an in-app choice override the operating system", () => {
    // "on" maps to "auto", which still defers to prefers-reduced-motion. A hard
    // "on" here would let the dialog re-enable animation for someone whose OS
    // asked for none.
    assert.match(controls, /motion: parsed\.motion === "off" \? "off" : "auto"/);
    assert.match(controls, /state\.motion !== "off" && !systemPrefersReducedMotion\(\)/);
  });

  it("keeps sound and haptics off unless they were explicitly turned on", () => {
    // AGENTS.md: sounds and haptics must be off or explicitly user-controlled
    // by default. Anything other than the exact string "on" resolves to off.
    assert.match(controls, /sound: parsed\.sound === "on" \? "on" : "off"/);
    assert.match(controls, /haptics: parsed\.haptics === "on" \? "on" : "off"/);
    assert.match(controls, /defaults = \{[\s\S]*?sound: "off"[\s\S]*?haptics: "off"/);
  });

  it("loads the dialog before the file that applies its preferences", () => {
    // defer preserves document order, and the applier has to run after the
    // owner of the store. If these ever swap, the applier reads before the
    // dialog has restored anything.
    const dialogAt = frame.indexOf("/sonara-one.js");
    const controlsAt = frame.indexOf("/sonara-experience-controls.js");
    assert.ok(dialogAt !== -1 && controlsAt !== -1);
    assert.ok(dialogAt < controlsAt, "the experience controls now load before the dialog that owns the store");
  });

  it("keeps every consumer of the motion attribute reading the same name", () => {
    // The design system CSS, the depth script, and this file all key off the
    // same attribute. A rename in one place would silently disable the others.
    const styles = read("public/sonara-design-system.css");
    const depth = read("public/sonara-depth.js");
    for (const [name, source] of [["design system", styles], ["depth script", depth], ["experience controls", controls]]) {
      assert.ok(source.includes("data-sonara-motion"), `${name} no longer reads data-sonara-motion`);
    }
  });

  it("still guards motion independently of the attribute", () => {
    // Belt and braces, and deliberately so: the attribute is written by
    // JavaScript and this bug is proof that can go wrong. The stylesheet and
    // the depth script each check prefers-reduced-motion directly, so an
    // incorrect attribute cannot animate for someone who asked for stillness.
    const styles = read("public/sonara-design-system.css");
    const depth = read("public/sonara-depth.js");
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(depth, /prefers-reduced-motion: reduce/);
  });

  it("declares every attribute it owns", () => {
    for (const attribute of ATTRIBUTES) {
      assert.ok(controls.includes(attribute), `${attribute} is no longer applied`);
    }
  });
});
