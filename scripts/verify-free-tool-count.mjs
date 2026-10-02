#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.

// How many tools are free, said in one place.
//
// ## The defect this is written against
//
// On 2 October 2026 five surfaces each held their own copy of the figure:
//
//   lib/sonara-stripe-plans.cjs        "the six free tools across the three studios"
//   routes/sonara-service-lifecycle-routes.cjs  "Six tools are free with no account" (twice)
//   routes/sonara-route-registry-routes.cjs     "Six tools are free ... two in each studio"
//   server.js                          "Those six are the free ones"
//
// Every one was correct when written. Every one became wrong the same afternoon,
// when the owner's decision took the free set from six to fifteen. Four of the
// five also named which tools were free, in prose -- and a page naming a tool as
// free that the gate then refuses is the advertise-then-refuse funnel that
// routes/sonara-service-lifecycle-routes.cjs has a long comment about, arriving
// by a different door.
//
// They are derived now. This exists so they stay derived: a number spelled out
// in a page is a number nobody re-checks, and the next person to change the free
// set will not read five files looking for the word "six".
//
// ## What it measures, and what it cannot
//
// It reads the runtime for a count stated **in words or digits next to the words
// "free" and "tool"**, and fails when one disagrees with FREE_TOOL_PATHS.length.
// It cannot catch a page that computes the figure and then describes it wrongly
// ("fifteen, two in each studio"), so the per-company breakdown is asserted
// separately: if the studios are not equal, the one sentence that says "N in
// each studio" must not be the one being used.
//
// Shape 1 guard: a scan that found no statement at all would pass while saying
// nothing, so it asserts it found the derived sentence being used in at least
// three files before reporting success.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const access = require(path.join(repoRoot, "lib", "sonara-tool-access.cjs"));
const { withoutComments } = require(path.join(repoRoot, "lib", "sonara-comment-stripping.cjs"));

const expected = access.FREE_TOOL_PATHS.length;
const counts = access.freeToolCountByCompany();

let failed = false;
function fail(message) {
  failed = true;
  console.error(`Free tool count verification failed: ${message}`);
}

// The number words this repository's copy actually uses. Digits are matched
// separately. "one" is left out on purpose: "one free tool" is not a count
// anybody writes here, and including it matches "one free tool directory".
const NUMBER_WORDS = Object.freeze({
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40
});

// Files whose job is to talk to customers. lib/sonara-tool-access.cjs is
// excluded: it is where the figure comes from, and its own comments describe the
// history, which is the one place a stale-looking number is the point.
const SOURCE_DIRECTORIES = ["routes", "lib"];
const EXCLUDED = new Set([
  path.join("lib", "sonara-tool-access.cjs"),
  path.join("scripts", "verify-free-tool-count.mjs")
]);

function runtimeFiles() {
  const files = [path.join(repoRoot, "server.js")];
  for (const directory of SOURCE_DIRECTORIES) {
    const base = path.join(repoRoot, directory);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      if (!name.endsWith(".cjs") && !name.endsWith(".js")) continue;
      if (EXCLUDED.has(path.join(directory, name))) continue;
      files.push(path.join(base, name));
    }
  }
  return files;
}

const files = runtimeFiles();
if (files.length < 50) {
  fail(`only ${files.length} runtime files were read; this check has gone blind`);
}

// Each of these is a shape this repository's copy has actually used, and each
// says which figure it is claiming -- because three different numbers get written
// into these sentences and comparing all of them to the total is how a check
// passes a sentence that is wrong about the thing it names.
//
// Ordered most specific first. A general pattern is not allowed to re-read a span
// a specific one already claimed: "four free tools per studio" states 4 per
// studio, and the "<count> free tools" pattern reading the same span would demand
// 15 and fail a correct sentence. OVERLAP below is what enforces that.
//
// `scope` picks the figure. "studio" is only meaningful while the three studios
// hold the same number, so an unequal split makes any such sentence wrong by
// construction and is failed before the comparison.
const CLAIMS = Object.freeze([
  { scope: "studio", pattern: /\b([A-Za-z]+|\d+)\s+(?:free\s+)?tools?\s+(?:in|per)\s+each\s+studio\b/gi },
  { scope: "studio", pattern: /\b([A-Za-z]+|\d+)\s+(?:more\s+)?free\s+tools?\s+per\s+studio\b/gi,  },
  { scope: "parent", pattern: /\b([A-Za-z]+|\d+)\s+SONARA\s+tools?\b/gi },
  { scope: "total", pattern: /\b([A-Za-z]+|\d+)\s+(?:more\s+)?free\s+tools?\b/gi },
  { scope: "total", pattern: /\b([A-Za-z]+|\d+)\s+tools?\s+(?:are|is)\s+free\b/gi },
  { scope: "total", pattern: /\b([A-Za-z]+|\d+)\s+tools?\s+across\s+(?:the\s+three\s+studios|SONARA)/gi }
]);

const SCOPE_LABEL = Object.freeze({
  total: "free in total",
  studio: "free in each studio",
  parent: "free at the parent company"
});

// The three studios have to agree before "in each studio" can mean anything.
// Checked here rather than inside the loop so an unequal split is reported once
// and by name instead of as a pile of per-sentence failures.
const studiosAgree = new Set([counts.business_builder, counts.creator_studio, counts.growth_studio]).size === 1;

function expectationFor(scope) {
  if (scope === "studio") return studiosAgree ? counts.business_builder : null;
  if (scope === "parent") return counts.sonara_industries;
  return expected;
}

// Every count a piece of text states, with the figure each one is claiming.
// Shared by the runtime scan and the detector self-test below, so the two cannot
// drift apart -- a self-test exercising different code from the scan proves
// nothing about the scan.
function readClaims(text) {
  const found = [];
  const taken = [];
  const overlaps = (start, end) => taken.some(([from, to]) => start < to && from < end);
  for (const claim of CLAIMS) {
    for (const match of text.matchAll(claim.pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (overlaps(start, end)) continue;
      const raw = String(match[1]);
      // A template placeholder is the correct answer, not a statement to check.
      if (/^\$?\{/.test(raw) || raw === "FREE_TOOL_COUNT") continue;
      const value = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw.toLowerCase()];
      if (value === undefined) continue;
      taken.push([start, end]);
      found.push({ value, scope: claim.scope, text: match[0].trim() });
    }
  }
  return found;
}

let statementsFound = 0;
let derivedUses = 0;

// Comments are not claims.
//
// The first run of this check failed on its own sibling comment, which quotes the
// stale sentence ("the six free tools") in order to explain why the figure is now
// derived. That is history and has to stay readable; what matters is what a page
// SAYS, which is what ends up in a string.
//
// The stripper is lib/sonara-comment-stripping.cjs, not a regular expression
// written here. The first draft did write its own, and
// tests/a-line-comment-cannot-open-a-block-comment.test.js refused it by name --
// "that is how the same bug shipped three times". The shared one is a
// left-to-right scanner that copies string and template contents through, which a
// regex cannot do, and the bug it was written for is a `//` inside a string
// opening a comment that swallows the rest of the file.
//
// This narrows the population, which is the shape-2 risk in reverse -- a scan
// measuring less than it claims -- so what remains is counted and reported, and
// the detector below is tested against input it must reject.

for (const file of files) {
  const source = withoutComments(fs.readFileSync(file, "utf8"));
  const relative = path.relative(repoRoot, file);
  if (source.includes("freeToolSentence(") || source.includes("FREE_TOOL_COUNT")) derivedUses += 1;

  for (const claim of readClaims(source)) {
    statementsFound += 1;
    const want = expectationFor(claim.scope);
    if (want === null) {
      fail(
        `${relative} states "${claim.text}" while the studios hold `
        + `${counts.business_builder}/${counts.creator_studio}/${counts.growth_studio}, `
        + "so no single number is true of each of them."
      );
      continue;
    }
    // A literal fails whether or not it is right, and that is the point.
    //
    // The first version of this check only failed a count that disagreed with the
    // list, which meant it reported a problem one change after the problem was
    // introduced -- the sentence is true when written and the build is green, and
    // it goes wrong later with nothing watching. Five surfaces did exactly that on
    // 2 October 2026, and then it happened again the same day when two branches
    // changed the split independently. A correct literal is the state immediately
    // before a wrong one.
    //
    // So the two cases differ only in what the message says. Neither passes.
    const hint =
      "  Read lib/sonara-tool-access.cjs instead of writing the figure: freeToolSentence() for the\n"
      + "  sentence, FREE_TOOL_COUNT for the number, freeToolCountByCompany() for the breakdown.";
    if (claim.value !== want) {
      fail(`${relative} states "${claim.text}" but ${want} are ${SCOPE_LABEL[claim.scope]}.\n${hint}`);
    } else {
      fail(
        `${relative} states "${claim.text}", which is right today and is still a figure written`
        + ` into a page. ${want} are ${SCOPE_LABEL[claim.scope]} as the list stands; the next change`
        + ` to it makes this sentence false with nothing watching.\n${hint}`
      );
    }
  }
}

// The breakdown sentence claims "N in each studio". That is only true while the
// three are equal, and freeToolSentence() branches on exactly that -- so this
// asserts the branch is right rather than trusting it.
const perStudio = [counts.business_builder, counts.creator_studio, counts.growth_studio];
const sentence = access.freeToolSentence();
const claimsEqual = /in each studio/.test(sentence);
if (claimsEqual && new Set(perStudio).size !== 1) {
  fail(`the free-tool sentence says "in each studio" while the studios hold ${perStudio.join("/")}`);
}
if (!claimsEqual && new Set(perStudio).size === 1) {
  fail("the studios hold the same number of free tools and the sentence spells all three out anyway");
}
if (!sentence.includes(String(expected))) {
  fail(`the free-tool sentence does not state the real count (${expected}): "${sentence}"`);
}
if (counts.business_builder + counts.creator_studio + counts.growth_studio + counts.sonara_industries !== expected) {
  fail("the per-company breakdown does not add up to the number of free tools");
}

// Every parent-company tool must be free. There is no "SONARA Industries" plan,
// so a locked one would answer "that is a fault on our side" to a customer.
const parentPaths = access.FREE_TOOL_PATHS.filter((toolPath) => access.isParentTool(toolPath));
if (parentPaths.length !== counts.sonara_industries) {
  fail("the parent-company free tools and the parent-company count disagree");
}
if (!parentPaths.length) {
  fail("no parent-company tool is free; every one of them must be, because no plan covers them");
}

// Shape 1, and the version of it this check actually needs.
//
// The first draft failed here, demanding at least one stated count -- and once
// every page was derived there were none to find, so the guard refused the very
// state the change was for. Zero findings is the goal, which means "I found
// nothing" and "I can no longer see" look identical, and that is the whole defect
// this repository is about.
//
// So the detector is tested on input it must reject. These three fixtures are the
// shapes the five stale sentences actually took; if a pattern stops matching its
// own fixture, this fails by name and the zero above stops meaning anything.
// The last two arrived on 2 October 2026 from the branch that merged first, and
// neither was caught: the check only knew the "<count> free tools" and "<count>
// tools are free" shapes, and both of these name a per-studio or parent figure in
// the middle of the sentence. Each was verified to get through before the shapes
// above were added -- a fixture nobody watched fail is a fixture that proves the
// detector matches something, not that it matches this.
const DETECTOR_FIXTURES = Object.freeze([
  { text: 'description: "the six free tools across the three studios"', scope: "total", shouldMatch: 6 },
  { text: 'body: "Six tools are free with no account and no card"', scope: "total", shouldMatch: 6 },
  { text: 'body: "Twelve tools across the three studios are free"', scope: "total", shouldMatch: 12 },
  { text: 'body: "Four tools in each studio are free, plus three SONARA tools."', scope: "studio", shouldMatch: 4 },
  { text: 'body: "Four tools in each studio are free, plus three SONARA tools."', scope: "parent", shouldMatch: 3 },
  { text: '"<p>Four free tools per studio and three SONARA tools; results need no signup.</p>"', scope: "studio", shouldMatch: 4 }
]);

for (const fixture of DETECTOR_FIXTURES) {
  const found = readClaims(fixture.text).filter((claim) => claim.scope === fixture.scope);
  if (!found.some((claim) => claim.value === fixture.shouldMatch)) {
    fail(
      `the detector no longer reads ${fixture.shouldMatch} ${SCOPE_LABEL[fixture.scope]} out of `
      + `${JSON.stringify(fixture.text)}. `
      + "Until that is fixed, finding no stale counts in the runtime means nothing."
    );
  }
}

// And it must not fire on the derived form, or every page would fail for being
// correct -- which is how a check gets weakened until it is switched off.
const DERIVED_FIXTURE = "body: `${freeToolSentence()} The rest open on a plan.`";
if (readClaims(DERIVED_FIXTURE).length) {
  fail(`the detector fires on the derived form ${JSON.stringify(DERIVED_FIXTURE)}, which is the form every page is supposed to use`);
}
if (derivedUses < 3) {
  fail(`only ${derivedUses} files read the derived count; the five that used to hold their own copy should now read it`);
}

if (failed) process.exit(1);
console.log(
  `Free tool count verified: ${expected} free across ${files.length} runtime files `
  + `(${counts.business_builder}/${counts.creator_studio}/${counts.growth_studio} per studio, `
  + `${counts.sonara_industries} at the parent). ${statementsFound} literal counts stated in customer-facing `
  + `strings; ${derivedUses} files read the figure rather than writing it. The detector was `
  + `tested against ${DETECTOR_FIXTURES.length} stale sentences it must catch and the derived form it must not, `
  + "so a zero above means none were found rather than that nothing was looked for."
);
