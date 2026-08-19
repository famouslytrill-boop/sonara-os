import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Whether the text this application ships can actually be read.
//
// "Colour grading" is mostly taste, and taste is not checkable. Contrast is the
// half that is: WCAG 2.1 defines relative luminance and a contrast ratio
// exactly, so whether a customer can read the small print on a card is
// arithmetic rather than an opinion.
//
// This computes the ratio for every text-on-surface pair the stylesheets
// actually declare, in both themes, and fails when one drops below the level for
// the job that colour does.
//
// ## What is checked against what
//
//   * 4.5:1 for body text -- WCAG 2.1 AA, the level almost every accessibility
//     policy names.
//   * 3:1 for large text and for a control's own boundary, which is the level AA
//     sets for text at 24px (or 18.66px bold) and for user-interface components.
//   * Decorative hairlines are not checked. A card's edge at 1.3:1 is a hairline
//     and not a control boundary; requiring 3:1 of it would mean drawing boxes
//     nobody asked for. The rule is that a colour is checked at the level its
//     JOB requires, and the job is declared below rather than inferred.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STYLESHEET = path.join(root, "public", "sonara-application-ui.css");
const failures = [];
const fail = (message) => failures.push(message);

// ---------------------------------------------------------------------------
// WCAG 2.1 relative luminance and contrast
// ---------------------------------------------------------------------------

function toRgb(hex) {
  const raw = String(hex).replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

// The 0.03928 threshold and the 2.4 exponent are the sRGB transfer function as
// WCAG 2.1 states it. Copied from the specification rather than approximated,
// because an eyeballed gamma curve produces ratios that look plausible and are
// wrong by enough to pass a failing pair.
function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const a = toRgb(foreground);
  const b = toRgb(background);
  if (!a || !b) return null;
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const [lighter, darker] = first > second ? [first, second] : [second, first];
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Reading the tokens out of the stylesheet
// ---------------------------------------------------------------------------

// Blocks are matched by their exact selector rather than by position in the
// file. An earlier version of this split the file at the first mention of a dark
// theme and silently read a prefers-contrast block as the dark palette --
// producing a table of ratios that was confidently wrong, which is worse than no
// table.
function tokensForSelector(source, selector) {
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

const source = fs.readFileSync(STYLESHEET, "utf8");
const light = tokensForSelector(source, ":root");
const darkOverrides = tokensForSelector(source, 'html[data-theme="dark"]');

if (!light) fail("Could not read the :root token block; nothing below was checked.");
if (!darkOverrides) fail('Could not read the html[data-theme="dark"] token block; the dark theme was not checked.');

// A theme is the light palette with the dark block's overrides on top, which is
// exactly how the cascade resolves it in a browser.
const dark = { ...(light || {}), ...(darkOverrides || {}) };

// ---------------------------------------------------------------------------
// What each colour is for, and therefore what it has to clear
// ---------------------------------------------------------------------------
//
// Declared, not guessed. A token's required ratio follows from the job it does,
// and writing the job down here is what stops somebody lowering a threshold to
// make a failure go away.
const PAIRS = [
  { foreground: "nx-text", background: "nx-bg", job: "body text on the page", minimum: 4.5 },
  { foreground: "nx-text", background: "nx-surface", job: "body text on a card", minimum: 4.5 },
  { foreground: "nx-ink", background: "nx-bg", job: "headings on the page", minimum: 4.5 },
  { foreground: "nx-ink", background: "nx-surface", job: "headings on a card", minimum: 4.5 },
  { foreground: "nx-muted", background: "nx-surface", job: "secondary text on a card", minimum: 4.5 },
  // .fine is the class the share links, the record counts and the "this is not
  // saved" notices use, and it is small. Small print is the text most likely to
  // matter and least likely to be legible.
  { foreground: "nx-faint", background: "nx-surface", job: "small print on a card", minimum: 4.5 },
  { foreground: "nx-danger", background: "nx-surface", job: "an error somebody has to read", minimum: 4.5 },
  { foreground: "nx-success", background: "nx-surface", job: "a confirmation somebody has to read", minimum: 4.5 },
  { foreground: "nx-warning", background: "nx-surface", job: "a warning somebody has to read", minimum: 4.5 },
  // A link is text, so it takes the text level. A button's fill is a component
  // boundary and takes 3:1 -- its label's contrast is against the fill, not
  // against the page, and is checked separately below.
  { foreground: "nx-violet", background: "nx-surface", job: "a link on a card", minimum: 4.5 },
  { foreground: "nx-blue", background: "nx-surface", job: "a link on a card", minimum: 4.5 },
  // Focus has to be visible against what it surrounds or keyboard navigation is
  // guesswork. WCAG puts non-text UI at 3:1.
  { foreground: "nx-focus", background: "nx-surface", job: "the focus ring", minimum: 3 },
  { foreground: "nx-focus", background: "nx-bg", job: "the focus ring on the page", minimum: 3 }
];

const rows = [];
for (const [themeName, tokens] of [["light", light], ["dark", dark]]) {
  if (!tokens) continue;
  for (const pair of PAIRS) {
    const foreground = tokens[pair.foreground];
    const background = tokens[pair.background];
    if (!foreground || !background) {
      fail(`${themeName}: --${pair.foreground} or --${pair.background} is not defined, so "${pair.job}" was never checked.`);
      continue;
    }
    const ratio = contrastRatio(foreground, background);
    if (ratio === null) {
      fail(`${themeName}: --${pair.foreground} (${foreground}) or --${pair.background} (${background}) is not a colour this can measure.`);
      continue;
    }
    rows.push({ theme: themeName, ...pair, foregroundValue: foreground, backgroundValue: background, ratio });
    if (ratio < pair.minimum) {
      fail(
        `${themeName}: ${pair.job} is ${ratio.toFixed(2)}:1 `
        + `(--${pair.foreground} ${foreground} on --${pair.background} ${background}), below the ${pair.minimum}:1 it needs.`
      );
    }
  }
}

// The guard that stops this passing on nothing. A selector rename, a token
// rename, or a regex that stopped matching would all leave `rows` short while
// every assertion above passed vacuously.
const expected = PAIRS.length * 2;
if (rows.length !== expected) {
  fail(`Only ${rows.length} of ${expected} pairs were measured, so this run did not check what it claims to.`);
}

// A sanity check on the arithmetic itself, against values anybody can verify:
// black on white is exactly 21:1, and a colour against itself is exactly 1:1.
const blackOnWhite = contrastRatio("#000000", "#ffffff");
if (!blackOnWhite || Math.abs(blackOnWhite - 21) > 0.01) {
  fail(`The contrast arithmetic is wrong: black on white came out at ${blackOnWhite}, and it is 21:1.`);
}
if (Math.abs(contrastRatio("#7454f5", "#7454f5") - 1) > 1e-9) {
  fail("The contrast arithmetic is wrong: a colour against itself is 1:1.");
}

if (failures.length) {
  console.error("Colour contrast check failed:");
  for (const message of failures) console.error(`  ${message}`);
  console.error("\nRaise the colour, or change the token's declared job in scripts/verify-colour-contrast.mjs -- and say why in the same change.");
  process.exit(1);
}

const worst = rows.reduce((low, row) => (row.ratio < low.ratio ? row : low), rows[0]);
console.log(
  `Colour contrast verified: ${rows.length} text and control pairs across both themes, `
  + `all at or above the level their job requires. Tightest is ${worst.job} in ${worst.theme} at ${worst.ratio.toFixed(2)}:1.`
);
assert.ok(true);
