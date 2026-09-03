#!/usr/bin/env node
"use strict";

// Two palettes render on every page. This checks they are in the same theme.
//
// public/sonara-design-system.css declares --sonara-*. public/sonara-application-ui.css
// declares --nx-* and also uses --sonara-* colours in 32 places, eight of them
// as the `color` of some text. Both stylesheets
// load on every page, in that order.
//
// They resolved their themes differently. --sonara-* falls back on
// prefers-color-scheme when no theme is stamped:
//
//     @media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { ... } }
//
// so its base :root block is the dark one and a dark-preferring device gets it.
// --nx-* had no such fallback: its base :root block is the LIGHT one, flipped
// only by `html[data-theme="dark"]`.
//
// sonara-prepaint.js stamps data-theme on every load, so with JavaScript on the
// two always agreed and nothing showed. With JavaScript off, on a device asking
// for dark, --sonara-* went dark and --nx-* stayed light -- on the same page,
// in the same rule. Measured: --sonara-text-2 at its dark value (#BCC6E4) on
// --nx-surface at its light value (#ffffff) is **1.70:1**. The same pair when
// the two agree is 9.49:1.
//
// Three states, not two. A theme is stamped dark, stamped light, or not stamped
// at all -- and the third is the one nothing was checking.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { contrastRatio } = require(path.join(root, "lib", "sonara-contrast.cjs"));

const APP = path.join(root, "public", "sonara-application-ui.css");
const SYSTEM = path.join(root, "public", "sonara-design-system.css");

function fail(lines) {
  process.stderr.write(`${lines.join("\n")}\n`);
  process.exit(1);
}

// Matched by exact selector rather than by position, for the reason
// verify-colour-contrast.mjs records: splitting a file at the first mention of
// "dark" once read a prefers-contrast block as the dark palette and produced a
// table that was confidently wrong.
function blockFor(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const pattern = new RegExp(String.raw`(^|\}|\{)\s*` + escaped + String.raw`\s*\{([^}]*)\}`, "m");
  const match = source.match(pattern);
  return match ? match[2] : null;
}

function colours(block, prefix) {
  if (block === null) return null;
  const pattern = new RegExp(String.raw`--(${prefix}[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*(?:;|$)`, "g");
  return Object.fromEntries(
    [...block.matchAll(pattern)].map(([, name, hex]) => [name, hex.toLowerCase()])
  );
}

const app = fs.readFileSync(APP, "utf8");
const system = fs.readFileSync(SYSTEM, "utf8");

// --nx-*: the light base, the stamped dark override, and the un-stamped dark
// fallback that this check exists for.
const nxLight = colours(blockFor(app, ":root"), "nx-");
const nxStampedDark = colours(blockFor(app, 'html[data-theme="dark"]'), "nx-");
const nxUnstampedDark = colours(blockFor(app, 'html:not([data-theme="light"])'), "nx-");

// --sonara-*: the base block is the dark one; the light values sit behind the
// media query and the explicit stamp.
const sonaraDark = colours(blockFor(system, ":root"), "sonara-");
const sonaraLight = colours(blockFor(system, ':root[data-theme="light"]'), "sonara-");

const missing = [];
if (!nxLight) missing.push("the :root block in sonara-application-ui.css");
if (!nxStampedDark) missing.push('the html[data-theme="dark"] block in sonara-application-ui.css');
if (!nxUnstampedDark) {
  missing.push(
    'the html:not([data-theme="light"]) block in sonara-application-ui.css -- ' +
      "the prefers-color-scheme fallback that keeps the two palettes in the same theme when no theme is stamped"
  );
}
if (!sonaraDark) missing.push("the :root block in sonara-design-system.css");
if (!sonaraLight) missing.push('the :root[data-theme="light"] block in sonara-design-system.css');
if (missing.length) {
  fail(["Theme palette check cannot run. These blocks were not found:", ...missing.map((line) => `  ${line}`)]);
}

// Blindness guards. Every comparison below is satisfied by two empty objects.
const blind = [];
if (Object.keys(nxLight).length < 10) blind.push(`the --nx-* light palette holds ${Object.keys(nxLight).length} colours; this check has gone blind`);
if (Object.keys(sonaraDark).length < 10) blind.push(`the --sonara-* dark palette holds ${Object.keys(sonaraDark).length} colours; this check has gone blind`);
if (Object.keys(nxStampedDark).length < 10) blind.push(`the stamped dark --nx-* palette holds ${Object.keys(nxStampedDark).length} colours; this check has gone blind`);
if (blind.length) fail(["Theme palette check cannot run:", ...blind.map((line) => `  ${line}`)]);

const problems = [];

// 1. The un-stamped dark palette must be the stamped one, exactly. Two copies of
//    a palette that drift apart mean a visitor with JavaScript off sees colours
//    nobody chose and nothing measures.
const stampedNames = Object.keys(nxStampedDark).sort();
const unstampedNames = Object.keys(nxUnstampedDark).sort();
for (const name of stampedNames) {
  if (!(name in nxUnstampedDark)) {
    problems.push(`--${name} is set for a stamped dark theme but not for a dark device with no theme stamped.`);
  } else if (nxUnstampedDark[name] !== nxStampedDark[name]) {
    problems.push(
      `--${name} is ${nxStampedDark[name]} when dark is stamped and ${nxUnstampedDark[name]} when it is not. ` +
        "The two dark palettes have drifted."
    );
  }
}
for (const name of unstampedNames) {
  if (!(name in nxStampedDark)) {
    problems.push(`--${name} is set for a dark device with no theme stamped but not for a stamped dark theme.`);
  }
}

// 2. The pairs that actually occur: a --sonara-* colour used as a foreground in
//    sonara-application-ui.css, on an --nx-* ground from the same file.
//
//    Read from the stylesheet rather than listed, so a rule added later is
//    covered. Only theme-varying foregrounds matter -- an accent that is one
//    colour in both themes cannot disagree with anything.
const usedSonaraColours = new Set(
  [...app.matchAll(/(?:^|[^-\w])color\s*:\s*var\(\s*--(sonara-[a-z0-9-]+)\s*\)/g)].map(([, name]) => name)
);
const themeVarying = [...usedSonaraColours].filter(
  (name) => sonaraLight[name] && sonaraDark[name] && sonaraLight[name] !== sonaraDark[name]
);

if (usedSonaraColours.size === 0) {
  fail([
    "No rule in sonara-application-ui.css sets `color` from a --sonara-* token.",
    "Eight rules did when this check was written -- four on --sonara-text-2, one on --sonara-text-3, two on --sonara-accent and one on --sonara-accent-contrast -- so the matcher has stopped working rather than the rules having gone.",
    "Check how the two token families are spelled before trusting this check again."
  ]);
}

// Three states. In each, which --sonara-* values apply and which --nx-* values
// apply, resolved the way a browser resolves them.
const STATES = [
  {
    name: 'data-theme="dark" stamped',
    sonara: sonaraDark,
    nx: { ...nxLight, ...nxStampedDark }
  },
  {
    name: 'data-theme="light" stamped',
    sonara: { ...sonaraDark, ...sonaraLight },
    nx: nxLight
  },
  {
    name: "no theme stamped, device asks for dark",
    sonara: sonaraDark,
    nx: { ...nxLight, ...nxUnstampedDark }
  }
];

const GROUNDS = ["nx-bg", "nx-surface"];
const MINIMUM = 4.5;
let measured = 0;

for (const state of STATES) {
  for (const name of themeVarying) {
    const foreground = state.sonara[name];
    if (!foreground) continue;
    for (const ground of GROUNDS) {
      const background = state.nx[ground];
      if (!background) continue;
      measured += 1;
      const ratio = contrastRatio(foreground, background);
      if (ratio < MINIMUM) {
        problems.push(
          `${state.name}: --${name} (${foreground}) on --${ground} (${background}) is ${ratio.toFixed(2)}:1, ` +
            `below ${MINIMUM}:1. The two palettes are in different themes.`
        );
      }
    }
  }
}

if (measured === 0) {
  fail([
    "No cross-palette pair was measured, so this check proved nothing.",
    `Theme-varying --sonara-* colours used in the application stylesheet: ${themeVarying.length}.`,
    "Either the token names changed or the grounds did."
  ]);
}

if (problems.length) {
  fail([
    "Theme palettes disagree.",
    "",
    ...problems.map((problem) => `  ${problem}`),
    "",
    `Checked ${STATES.length} theme states over ${themeVarying.length} shared colours and ${GROUNDS.length} grounds.`
  ]);
}

process.stdout.write(
  `Theme palettes agree: ${STATES.length} theme states -- stamped dark, stamped light, and no stamp on a dark device -- ` +
    `with ${measured} cross-palette pairs measured, all at or above ${MINIMUM}:1. ` +
    `${stampedNames.length} dark tokens declared identically in both dark blocks. ` +
    `${themeVarying.length} of the ${usedSonaraColours.size} --sonara-* colours used in the application stylesheet vary by theme.\n`
);
process.exit(0);
