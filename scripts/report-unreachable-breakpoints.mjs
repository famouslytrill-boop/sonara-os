#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.

// A media declaration that can never take effect, whatever the viewport.
//
// This exists because of a defect it would have caught. `.sonara-desktop-nav`
// was set to `display: none` in three separate `max-width` blocks -- 1300px,
// 1120px and 920px. A `max-width` query applies at every width at or below its
// bound, so the 1300px rule already covered everything the other two covered,
// with the same value. Only one of the three ever did anything; the rest was
// dead text.
//
// That is worse than untidy, and the reason is what makes it worth a gate.
// Each of the three carried a comment explaining the width it chose, and all
// three said "eight nav items" -- a nav that by then rendered five. Someone
// lowering the 920px bound would have changed nothing and believed they had,
// because the file reads as though 920px is the decision. The measurement in a
// dead rule describes nothing, and it is indistinguishable from one that does.
//
// HOW THIS DECIDES, and why the obvious version of it is wrong.
//
// The first version of this file compared bounds alone: same selector, same
// property, same value, a wider bound, and no rule in between with a different
// value. That reads as sound and is not. It reported
// `.sonara-header-tools { gap: 6px }` at max-width 760px as dead because the
// base rule also says 6px -- and deleting it changed the rendered gap below
// 680px from 6px to 5px, because a 680px rule sets 5px and sits EARLIER in the
// file. Media queries add no specificity, so among equal selectors the last
// declaration in source order wins. The 760px rule was overriding the 680px
// one, which no comparison of bounds can see.
//
// So this simulates the cascade instead of reasoning about it. For one selector
// and one property, the winner at a given width is the last declaration in
// source order whose bound admits that width. A declaration is dead only when
// removing it leaves the winning value identical at every width where anything
// changes -- each bound, each bound minus one, and above the widest bound.
//
// That is exact rather than heuristic, and it is the difference between a check
// and a plausible-sounding one. The browser probe that caught the error is in
// docs/SPRINT_LOG.md; the lesson is that a check agreeing with your reasoning
// is not evidence, because it was built out of the same reasoning.
//
// WHAT IS DELIBERATELY NOT JUDGED. A selector and property is skipped whole
// when any of its declarations sits in a condition this cannot evaluate -- a
// min-width, a range, orientation, hover, print -- or carries `!important`,
// which beats source order. Those do not nest the way this model assumes, and a
// confident wrong answer is the thing being guarded against. The count of what
// was skipped is printed, so the gap is visible rather than implied.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.dirname(new URL(import.meta.url).pathname).replace(/\/scripts$/, "");
const STYLESHEETS = ["public/sonara-design-system.css", "public/sonara-application-ui.css"];

// Below these, the walk has gone blind rather than found a clean stylesheet.
//
// Per stylesheet, not just in total, and that distinction is not theoretical:
// the first version asserted totals only, and truncating the whole of
// sonara-design-system.css to twenty lines left it green -- because
// sonara-application-ui.css alone clears any total worth setting. A guard that
// cannot notice one of its two inputs disappearing is the defect it was
// written to prevent.
//
// Measured 28 September 2026, by this parser rather than by eye:
// sonara-design-system.css 67 rules / 170 declarations, and
// sonara-application-ui.css 701 rules / 2,199 declarations. The floors sit
// below the smaller of the two, not below their sum, which is the whole point.
const MINIMUM_PER_STYLESHEET = { rules: 40, declarations: 100 };
const MINIMUM_DECLARATIONS = 1500;
const MINIMUM_RULES = 500;
const MINIMUM_MEDIA_RULES = 80;

function stripComments(css) {
  // Replaced with spaces rather than removed, so byte offsets still map to
  // line numbers for the message.
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
}

// Only a condition that is exactly one max-width, and nothing else, gets a
// bound. Anything else returns null and is not compared against.
function maxWidthBound(condition) {
  const cleaned = condition.replace(/^@media\s*/, "").trim();
  const match = /^\(\s*max-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)$/.exec(cleaned);
  return match ? Number(match[1]) : null;
}

// Commas inside `:is(...)`, `:where(...)`, `:not(...)` and friends are part of
// one selector, not separators between two. Splitting on every comma turned
// `.sonara-record-table :is(a, button, input, select)` into four selectors,
// one of them a bare `button` -- which then appeared to be a later rule
// overriding every button on the site, and produced a confident wrong verdict
// on `button { min-height: 48px }`. The browser probe caught it; nothing in
// the check could have.
function splitSelectors(prelude) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of prelude) {
    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function parse(css, file) {
  const source = stripComments(css);
  const rules = [];
  let declarations = 0;
  const stack = [];
  let buffer = "";
  let index = 0;

  const lineAt = (offset) => source.slice(0, offset).split("\n").length;

  while (index < source.length) {
    const char = source[index];
    if (char === "{") {
      const prelude = buffer.trim();
      buffer = "";
      stack.push({ prelude, start: index });
      index += 1;
      continue;
    }
    if (char === "}") {
      const frame = stack.pop();
      if (frame && !frame.prelude.startsWith("@")) {
        // A declaration block. Its media context is every @media on the stack.
        const media = stack.filter((f) => f.prelude.startsWith("@media")).map((f) => f.prelude);
        const inKeyframes = stack.some((f) => /^@(-\w+-)?keyframes/.test(f.prelude));
        if (!inKeyframes) {
          const body = buffer;
          const declarationList = [];
          for (const piece of body.split(";")) {
            const colon = piece.indexOf(":");
            if (colon < 0) continue;
            const property = piece.slice(0, colon).trim().toLowerCase();
            const value = piece.slice(colon + 1).trim();
            if (!property || !value || property.startsWith("--")) continue;
            declarationList.push({ property, value });
            declarations += 1;
          }
          if (declarationList.length) {
            rules.push({
              file,
              line: lineAt(frame.start),
              media,
              selectors: splitSelectors(frame.prelude),
              declarations: declarationList
            });
          }
        }
      }
      buffer = "";
      index += 1;
      continue;
    }
    buffer += char;
    index += 1;
  }

  return { rules, declarations };
}

const collected = [];
let totalDeclarations = 0;
for (const relative of STYLESHEETS) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) {
    console.error(`${relative} is missing, so this check cannot measure what it claims to.`);
    process.exit(1);
  }
  const { rules, declarations } = parse(fs.readFileSync(full, "utf8"), relative);
  if (rules.length < MINIMUM_PER_STYLESHEET.rules || declarations < MINIMUM_PER_STYLESHEET.declarations) {
    console.error(
      `${relative} yielded only ${rules.length} rules and ${declarations} declarations. Either the file has been ` +
        `emptied or the CSS walk no longer reads it -- and this check would then pass by looking at the other ` +
        `stylesheet alone.`
    );
    process.exit(1);
  }
  collected.push(...rules);
  totalDeclarations += declarations;
}

// Shape 1: every finding below is satisfied by an empty population, so the
// population is asserted first and the message says the walk broke.
const mediaRules = collected.filter((rule) => rule.media.length === 1 && maxWidthBound(rule.media[0]) !== null);
if (collected.length < MINIMUM_RULES || totalDeclarations < MINIMUM_DECLARATIONS) {
  console.error(
    `Only ${collected.length} rules and ${totalDeclarations} declarations were read from ` +
      `${STYLESHEETS.length} stylesheets. The CSS walk has gone blind rather than found a small stylesheet.`
  );
  process.exit(1);
}
if (mediaRules.length < MINIMUM_MEDIA_RULES) {
  console.error(
    `Only ${mediaRules.length} single max-width media rules were found. The condition parser has ` +
      `probably stopped matching, which would leave this check unable to find anything.`
  );
  process.exit(1);
}

// selector -> property -> declarations, in source order.
// `bound` is Infinity for a rule outside any media query, a number for a rule
// whose only condition is one max-width, and null for anything this model
// cannot evaluate -- which disqualifies the whole selector and property.
const declared = new Map();
collected.forEach((rule, order) => {
  const bound = rule.media.length === 0
    ? Number.POSITIVE_INFINITY
    : rule.media.length === 1
      ? maxWidthBound(rule.media[0])
      : null;
  for (const selector of rule.selectors) {
    if (!declared.has(selector)) declared.set(selector, new Map());
    const byProperty = declared.get(selector);
    for (const { property, value } of rule.declarations) {
      if (!byProperty.has(property)) byProperty.set(property, []);
      byProperty.get(property).push({ bound, value, file: rule.file, line: rule.line, order });
    }
  }
});

// The last declaration in source order whose bound admits this width. Media
// queries add no specificity, and every entry here shares one selector, so
// source order is the whole of the cascade for this group.
function winnerAt(entries, width) {
  let winner = null;
  for (const entry of entries) {
    if (entry.bound >= width) winner = entry;
  }
  return winner ? winner.value : null;
}

const repeatedFindings = [];
const overriddenFindings = [];
let skipped = 0;
let judged = 0;
for (const [selector, byProperty] of declared) {
  for (const [property, entries] of byProperty) {
    if (entries.length < 2) continue;
    // An unevaluable condition or an !important anywhere in the group means
    // this model does not apply, so no verdict is offered for it at all.
    if (entries.some((entry) => entry.bound === null || /!\s*important/i.test(entry.value))) {
      skipped += 1;
      continue;
    }
    judged += 1;

    // Every width at which any winner can change, plus one above them all.
    const widths = new Set([1]);
    for (const entry of entries) {
      if (Number.isFinite(entry.bound)) {
        widths.add(entry.bound);
        widths.add(entry.bound - 1);
        widths.add(entry.bound + 1);
      }
    }
    widths.add(Math.max(...entries.filter((e) => Number.isFinite(e.bound)).map((e) => e.bound), 0) + 1000);
    const probes = [...widths].filter((width) => width > 0);

    const baseline = probes.map((width) => winnerAt(entries, width));
    for (const candidate of entries) {
      // A declaration outside any media query is not what this checks; the
      // subject is a media rule that a wider one has already settled.
      if (!Number.isFinite(candidate.bound)) continue;
      const without = entries.filter((entry) => entry !== candidate);
      const after = probes.map((width) => winnerAt(without, width));
      if (after.some((value, i) => value !== baseline[i])) continue;
      // Two very different situations, and they need different answers.
      //
      // Repeated: some other rule already says the same thing, so the file is
      // merely saying it twice and nothing is lost by saying it once.
      //
      // Overridden: every rule that beats this one says something ELSE. The
      // value here has never once reached a screen, so a deliberate choice --
      // a narrower page on a phone, a tighter card -- is being expressed and
      // silently discarded. Deleting it keeps today's appearance and stops the
      // file claiming otherwise; honouring it instead changes what customers
      // see, which is a decision rather than a cleanup.
      const winners = probes
        .map((width) => entries.filter((entry) => entry.bound >= width).pop())
        .filter(Boolean);
      const repeated = winners.some((winner) => winner !== candidate && winner.value === candidate.value);
      const by = [...new Set(winners.filter((w) => w !== candidate).map((w) => `${w.file}:${w.line}`))].join(", ");
      (repeated ? repeatedFindings : overriddenFindings).push(
        `${candidate.file}:${candidate.line}  ${selector} { ${property}: ${candidate.value} }  at max-width ` +
          `${candidate.bound}px -- ${repeated ? "the same value is already decided by" : "always overridden by"} ` +
          `${by || "another rule"}`
      );
    }
  }
}

const mode = process.argv.includes("--check") ? "check" : "report";
const repeatedUnique = [...new Set(repeatedFindings)];
const overriddenUnique = [...new Set(overriddenFindings)];

if (repeatedUnique.length || overriddenUnique.length) {
  console.error(
    `${repeatedUnique.length + overriddenUnique.length} media declaration(s) can never take effect. Removing any ` +
      `of them changes nothing at any viewport width, so whatever width or reason is written beside them ` +
      `describes nothing.\n`
  );
  if (repeatedUnique.length) {
    console.error(`Saying the same thing twice -- deleting these keeps the rendering identical:\n`);
    for (const finding of repeatedUnique) console.error(`  ${finding}`);
    console.error("");
  }
  if (overriddenUnique.length) {
    console.error(
      `Expressing an intent that never happens -- every rule that beats these says something else, so this value ` +
        `has never reached a screen. Deleting keeps today's appearance; honouring it changes what customers see ` +
        `and is a decision, not a cleanup:\n`
    );
    for (const finding of overriddenUnique) console.error(`  ${finding}`);
    console.error("");
  }
  if (mode === "check") process.exit(1);
  process.exit(0);
}

console.log(
  `Breakpoint reachability verified: ${collected.length} rules and ${totalDeclarations} declarations across ` +
    `${STYLESHEETS.length} stylesheets, ${mediaRules.length} of them in a single max-width query. ` +
    `${judged} selector-and-property groups simulated through the cascade, ${skipped} left unjudged for carrying ` +
    `a condition or an !important this model cannot evaluate. Every media declaration it can judge changes ` +
    `the outcome at some width.`
);
