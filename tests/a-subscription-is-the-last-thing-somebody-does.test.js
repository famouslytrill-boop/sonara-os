"use strict";

// "You subscribe, you use the service."
//
// The owner's instruction, three times over: "there are no rate limits once
// subscribed... Nothing else to buy nothing else to do"; "everything in that
// workspace becomes yours to do with and use as you please for that subscription
// length"; and "there are no provider quotes rate limits still stand but
// providing quotes and intake forms are out".
//
// That last clause is the one that is easy to lose and it changes what can be
// promised: an upstream provider's limit still applies, because it is not ours to
// waive. What is forbidden is ours -- a throttle on a subscriber's own work, a
// quote to request, a form to fill in before a feature opens.
//
// scripts/verify-subscription-completeness.mjs holds three properties and says in
// its own output that it holds three rather than the whole promise. This file
// checks the gate is wired, that it is the kind of check that can fail, and that
// the floor it enforces is a figure somebody chose rather than one that drifted.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const GATE = path.join(root, "scripts", "verify-subscription-completeness.mjs");

describe("a subscription is the last thing somebody does", () => {
  const gate = fs.readFileSync(GATE, "utf8");

  describe("the gate runs and is in the chain", () => {
    it("passes against the tree as it stands", () => {
      // Run rather than read. A gate nobody executes in the suite is a gate that
      // can rot between releases.
      const output = execFileSync(process.execPath, [GATE], { cwd: root, encoding: "utf8" });
      assert.match(output, /Subscription completeness verified/);
    });

    it("is a script and the release chain runs it", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
      assert.ok(pkg.scripts["verify:subscription-completeness"], "the gate is not a script");
      assert.ok(
        pkg.scripts["verify:gates"].includes("verify:subscription-completeness"),
        "the gate exists and the release chain does not run it"
      );
    });

    it("says what it does not check", () => {
      // A check that implied it had verified "nothing else to buy" whole would be
      // the defect this repository is about. Its output has to disclaim.
      assert.match(gate, /not the whole of/);
      assert.match(gate, /It does not check that a plan's contents match its price/);
    });
  });

  describe("every rate limiter is accounted for, both ways", () => {
    it("reports a population worth measuring", () => {
      const output = execFileSync(process.execPath, [GATE], { cwd: root, encoding: "utf8" });
      const count = Number(output.match(/(\d+) rate limiters/)?.[1]);
      assert.ok(count >= 15, `the gate found ${count} limiters; the application has carried at least fifteen`);
    });

    it("refuses a limiter nobody registered", () => {
      assert.match(gate, /this check does not know why it exists/);
    });

    it("refuses a registration for a limiter that no longer exists", () => {
      // The two-sided half. A reason describing nothing is what the next person
      // reads instead of checking.
      assert.match(gate, /records why \$\{name\} exists and no runtime file creates it/);
    });

    it("tests its parser on every call form before believing its own count", () => {
      // #417 built a limiter as `(deps.createRateLimiter || createRateLimiter)({...})`
      // and the first parser, which matched `createRateLimiter({`, never saw it --
      // so the gate went on printing "every one accounted for" over a limiter it
      // could not read. A form the parser misses does not fail as unregistered; it
      // vanishes. The fixtures are the only thing that makes the count mean "all".
      assert.match(gate, /const PARSER_FIXTURES = Object\.freeze\(\[/);
      for (const form of ["direct", "through deps", "either-or", "auth factory"]) {
        assert.ok(gate.includes(`form: "${form}"`), `the parser is no longer shown the ${form} form`);
      }
      assert.match(gate, /\(deps\.createRateLimiter \|\| createRateLimiter\)\(/, "the form that got through is not among the fixtures");
    });

    it("sees the generation limiter #417 added", () => {
      const output = execFileSync(process.execPath, [GATE], { cwd: root, encoding: "utf8" });
      const count = Number(output.match(/(\d+) rate limiters/)?.[1]);
      // 17 was the figure the blind parser printed. Below 18 means a form has
      // dropped out of view again.
      assert.ok(count >= 18, `the gate sees ${count} limiters; creator.generation.submit has dropped out of view`);
      assert.match(gate, /"creator\.generation\.submit": "abuse_ceiling"/);
    });

    it("refuses when nothing is left in the category the floor applies to", () => {
      // Without this, reclassifying every ceiling as an anonymous surface makes
      // the floor apply to nothing and the gate pass.
      assert.match(gate, /the floor below was applied to nothing/);
    });
  });

  describe("the floor is a figure somebody chose", () => {
    it("is stated once, as a named constant", () => {
      const occurrences = (gate.match(/MINIMUM_SUBSCRIBER_RATE/g) || []).length;
      assert.ok(occurrences >= 3, "the floor is not read from one place");
      assert.match(gate, /const MINIMUM_SUBSCRIBER_RATE = (\d+);/);
    });

    it("is high enough that a realistic throttle does not sit on it", () => {
      const floor = Number(gate.match(/const MINIMUM_SUBSCRIBER_RATE = (\d+);/)[1]);
      // The first draft was 300/hour, and throttling work orders from 45 a minute
      // to 5 lands on exactly 300 -- so the check passed on `<` while the limiter
      // had become a cap somebody meets in an afternoon. Five a minute must fail.
      assert.ok(floor > 300, `the floor is ${floor}/hour, which five writes a minute sits exactly on`);
    });

    it("records a figure and a reason for each limiter below it", () => {
      const block = gate.slice(gate.indexOf("const RATE_EXCEPTIONS"), gate.indexOf("// ---", gate.indexOf("const RATE_EXCEPTIONS")));
      const figures = (block.match(/perHour: \d+/g) || []).length;
      const reasons = (block.match(/reason:/g) || []).length;
      assert.ok(figures > 0, "no exception carries a figure; this check has gone blind");
      assert.equal(figures, reasons, "an exception carries a figure with no reason beside it");
    });

    it("refuses an exception for a limiter that is now above the floor", () => {
      assert.match(gate, /has an exception recorded for being below the/);
    });
  });

  describe("no page asks for a quote, a form, or a word with sales", () => {
    it("names the shapes the owner ruled out", () => {
      for (const phrase of ["request a quote", "contact sales", "intake form", "book a demo", "request access"]) {
        assert.ok(gate.includes(phrase), `the detector does not look for "${phrase}"`);
      }
    });

    it("reads strings rather than comments", () => {
      // This repository's own prose names every forbidden phrase, including in
      // AGENTS.md and in the gate itself. The stripper is the shared one.
      assert.match(gate, /from "\.\.\/lib\/sonara-comment-stripping\.cjs"/);
      assert.match(gate, /withoutComments\(/);
    });

    it("keeps the refusals the application really uses", () => {
      // A detector that refused "On a paid plan" would be a detector somebody
      // switches off. The gate's own fixtures assert this; so does this.
      assert.match(gate, /shouldMatch: false/);
      assert.match(gate, /On a paid plan/);
    });

    it("examines enough strings to be looking at the application", () => {
      const output = execFileSync(process.execPath, [GATE], { cwd: root, encoding: "utf8" });
      const examined = Number(output.match(/0 of (\d+) customer-facing strings/)?.[1]);
      assert.ok(examined > 5000, `only ${examined} strings examined; this check has gone blind`);
    });
  });

  describe("an upstream provider's limit is not ours to waive", () => {
    it("says so, because the instruction said so", () => {
      // "there are no provider quotes rate limits still stand" -- the owner drew
      // this line themselves, and a gate that promised to remove provider limits
      // would be promising something this application cannot deliver.
      assert.match(gate, /upstream \*\*provider's\*\* limit\s+\/\/ still applies|not ours to\s+\/\/ waive|not ours to waive/);
    });
  });
});
