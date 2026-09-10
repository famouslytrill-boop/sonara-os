"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { CAPABILITIES, quote, verifyMargins } = require("../lib/sonara-paid-capabilities.cjs");
const { MINIMUM_BILLABLE_GPU_SECONDS } = require("../lib/creator-generation-billing.cjs");
const { MINIMUM_BILLABLE_EMAILS } = require("../lib/growth-studio-sender.cjs");
const { DEFAULT_STARTING_ALLOWANCE_MINOR } = require("../lib/sonara-usage-meter.cjs");

// A capability's price or floor, written into prose. Three shapes, each anchored
// on a word that only appears when somebody is describing a price -- "floor", or
// "minor units", or a unit the price list actually bills by.
//
// Deliberately narrow. A broad number hunt across the runtime fires on every
// unrelated constant and gets switched off, which is worse than not having it:
// the first draft of this matched "Measured 19 August 2026 against a configured
// server" in lib/sonara-route-registry.cjs, which is a date and a preposition.
const QUOTED_FIGURE = new RegExp(
  [
    "\\bagainst a \\d+(?:\\.\\d+)?\\s+floor\\b",
    "\\b\\d+(?:\\.\\d+)?\\s+minor units?\\s+(?:per\\s+[a-z]+\\s+)?against\\b",
    "\\bfloors? of \\d+(?:\\.\\d+)?\\b",
    "\\b\\d+(?:\\.\\d+)?\\s+per (?:gpu second|viewer gigabyte|build minute|cpu minute|email|message|minute|device)s?\\b"
  ].join("|"),
  "i"
);

// Two conditions, both required, for a figure to be excused as history rather
// than counted as a copy.
//
// The first draft asked only the first: does the surrounding comment block
// explain a correction? It reads the whole contiguous block because the excusing
// phrase and the figure are usually on different lines -- but that made the
// exemption swallow anything ADDED to such a block. Appending
// "telephony charges 3 minor units against a 1.4 floor" to the end of the
// correction comment in lib/sonara-telephony.cjs went undetected, which is the
// exact bug this check exists to catch. The failure test below is that break.
//
// So the figure must also sit inside quotation marks, because that is what a
// correction actually looks like: `This comment used to say "..."`. Quoting a
// live figure next to a sentence explaining that figures are not quoted here is
// a much harder thing to do by accident than adding a line to a comment.
const EXPLAINS_A_CORRECTION = /used to (?:say|quote)|went stale|deliberately (?:not|NOT) repeated|not (?:repeated|copied) (?:here|into this file)|no figure is quoted/;

// The contiguous run of `//` lines containing `index`, as the comment bodies with
// their markers stripped, plus where each line's body starts in that text. The
// offsets are what let a match be located inside a quotation that opened on an
// earlier line, which both real corrections do.
function commentBlockAround(lines, index) {
  const isComment = (line) => line.trim().startsWith("//");
  if (!isComment(lines[index])) return null;
  let first = index;
  let last = index;
  while (first > 0 && isComment(lines[first - 1])) first -= 1;
  while (last < lines.length - 1 && isComment(lines[last + 1])) last += 1;

  const starts = [];
  let text = "";
  for (let line = first; line <= last; line += 1) {
    starts[line] = text.length;
    text += `${lines[line].trim().replace(/^\/\/ ?/, "")}\n`;
  }
  return { text, starts };
}

// Character ranges of double-quoted spans, which may run across lines.
function quotedSpans(text) {
  const spans = [];
  let open = null;
  for (let at = 0; at < text.length; at += 1) {
    if (text[at] !== '"') continue;
    if (open === null) open = at;
    else {
      spans.push([open, at]);
      open = null;
    }
  }
  return spans;
}

function quotedFigures(candidates) {
  const offenders = [];
  for (const file of candidates) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      const found = line.match(QUOTED_FIGURE);
      if (!found) continue;

      const block = commentBlockAround(lines, index);
      if (block && EXPLAINS_A_CORRECTION.test(block.text)) {
        // Where this line's match lands in the block text. The line is trimmed
        // and its marker stripped in the block, so the match is re-found there
        // rather than offset arithmetic being trusted across two strings.
        const body = line.trim().replace(/^\/\/ ?/, "");
        const withinBody = body.indexOf(found[0]);
        if (withinBody >= 0) {
          const at = block.starts[index] + withinBody;
          const quoted = quotedSpans(block.text).some(([from, to]) => at > from && at < to);
          if (quoted) continue;
        }
      }

      offenders.push(`${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 110)}`);
    }
  }
  return offenders;
}

// A floor is a claim about what something costs US, and `verifyMargins()` uses
// it to prove we are not selling at a loss. That makes an unsourced floor worse
// than no floor: the check still passes, still prints a margin, and the margin
// is fiction.
//
// `telephony` had `floorMinor: 0.8` whose entire justification was "a carrier
// bills per message and per minute and there is no version of this that does
// not" -- an explanation of why a floor exists, not a source for 0.8. Checked
// against Twilio and Telnyx on 10 September 2026 it was below the real cost on
// every vendor and every direction, mainly because it ignored the mandatory US
// carrier surcharge. It is now 1.4.
//
// So these assertions are about two different things:
//
//   * **The number cannot drift back down** without somebody changing the
//     recorded worst case and saying why.
//   * **Every floor names where it came from.** Not a judgement about the
//     figure -- this file cannot check a price against the web -- but a
//     structural check that the source is written next to it, which is what
//     lets the next person recheck instead of trusting.

const SOURCE = path.join(__dirname, "..", "lib", "sonara-paid-capabilities.cjs");

// The worst per-unit cost found on 10 September 2026 for a unit this capability
// bills, in minor units, EXCLUDING toll-free inbound -- which is 2.20 and is
// deliberately outside the floor, per the comparison document.
//
// Twilio outbound voice, $0.0140/min, from twilio.com/en-us/voice/pricing/us.
const TELEPHONY_WORST_DOCUMENTED_COST = 1.4;

describe("a cost floor is a figure somebody checked", () => {
  it("has capabilities to check, so none of this passes on an empty list", () => {
    const names = Object.keys(CAPABILITIES);
    assert.ok(names.length >= 6, `only ${names.length} capabilities found; this check has gone blind`);
    assert.ok(CAPABILITIES.telephony, "telephony is not priced");
  });

  describe("the telephony floor, which was wrong", () => {
    it("is at least the worst cost actually found on a vendor's price page", () => {
      // The ratchet. Lowering this needs the recorded worst case lowered too,
      // which needs a real price page saying so.
      assert.ok(
        CAPABILITIES.telephony.floorMinor >= TELEPHONY_WORST_DOCUMENTED_COST,
        `the telephony floor is ${CAPABILITIES.telephony.floorMinor} against a documented worst cost of ` +
        `${TELEPHONY_WORST_DOCUMENTED_COST}; a floor below the real cost reports a margin that does not exist`
      );
    });

    it("is no longer the unsourced 0.8", () => {
      // Named explicitly rather than only bounded, because 0.8 is the specific
      // figure that was carried for weeks with a comment that read like a
      // source and was not one.
      assert.notEqual(CAPABILITIES.telephony.floorMinor, 0.8, "0.8 was below the real cost on every vendor checked");
    });

    it("still leaves a margin, and one worth having", () => {
      const priced = quote("telephony", 1000);
      assert.ok(priced.marginMinor > 0, "a corrected floor that wipes out the margin is a pricing decision, not a fix");
      // 40% of the price, which the Twilio-worst case (53%) clears and the
      // toll-free case (27%) would not -- which is why toll-free is excluded
      // from the floor and called out in the comparison document instead.
      assert.ok(
        priced.marginMinor / priced.chargeMinor >= 0.4,
        `margin is ${Math.round((priced.marginMinor / priced.chargeMinor) * 100)}% of price; below 40% the price needs revisiting rather than the floor`
      );
    });

    it("does not claim the margin it used to", () => {
      // The old floor made this read as 3.75x. Asserting the multiple is lower
      // now is what stops the corrected figure being quietly reverted while the
      // marketing number stays.
      const multiple = CAPABILITIES.telephony.priceMinor / CAPABILITIES.telephony.floorMinor;
      assert.ok(multiple < 3.75, `the telephony price is ${multiple.toFixed(2)}x its floor; 3.75x was the figure the unsourced floor produced`);
      assert.ok(multiple > 1, "and it must still be above 1, or the capability sells at a loss");
    });
  });

  describe("every metered floor says where it came from", () => {
    // Structural, not numerical. This file cannot check a price against a
    // vendor's page -- a test that tried would be a test that fails when a
    // network blips. What it can check is that the source is written down, which
    // is the thing whose absence let 0.8 stand.
    const source = fs.readFileSync(SOURCE, "utf8");

    it("read the module, so the assertions below are not measuring an empty string", () => {
      assert.ok(source.length > 4000, `only ${source.length} bytes read; this check has gone blind`);
    });

    it("carries a date beside the telephony figures", () => {
      // A price with no date is a price nobody can tell is stale, which is the
      // same rule docs/market and docs/pricing already hold.
      const block = source.slice(source.indexOf("telephony: Object.freeze"), source.indexOf("campaign_email: Object.freeze"));
      assert.ok(block.length > 500, "the telephony block was not found; this check has gone blind");
      assert.match(block, /\b\d{1,2} September 2026\b/, "the telephony floor must say when its figures were read");
      assert.match(block, /twilio\.com/, "and name the page they were read from");
      assert.match(block, /telnyx\.com/, "including the vendor that was compared against, or 'worst case' means nothing");
    });

    it("names the carrier surcharge, which is the thing the old floor missed", () => {
      const block = source.slice(source.indexOf("telephony: Object.freeze"), source.indexOf("campaign_email: Object.freeze"));
      assert.match(
        block,
        /surcharge|passthrough|pass-through/i,
        "the US carrier surcharge is a mandatory pass-through and is the specific reason 0.8 was wrong; a comment that omits it invites the same mistake"
      );
    });

    it("says out loud what the floor does not cover", () => {
      const block = source.slice(source.indexOf("telephony: Object.freeze"), source.indexOf("campaign_email: Object.freeze"));
      // Toll-free inbound costs more than the floor. Averaging it in would hide
      // it; leaving it out silently would be worse.
      assert.match(block, /toll-free/i, "toll-free inbound costs more than this floor and must be named rather than averaged away");
      assert.match(block, /monthly|month/i, "a number's fixed monthly rent has no place in a per-unit model and must be recorded as a gap");
    });
  });


  // The pattern that caused this, and the one most likely to cause it again.
  //
  // `floorMinor: 0.8` was copied into TWO other files as prose -- "priced at 3
  // minor units against a 0.8 floor" in lib/sonara-telephony.cjs and
  // lib/sonara-usage-meter.cjs. Correcting the module left both saying the old
  // number, in files nobody would think to check when changing a price.
  //
  // Writing this check found two more that nobody had looked for:
  // lib/creator-generation-billing.cjs quoted media generation's price and floor
  // twice, and lib/growth-studio-sender.cjs quoted campaign_email's. Four copies
  // across three files, which is why the rule is absolute rather than a habit.
  //
  // A copied figure is a figure that will disagree with its source eventually.
  // So no runtime file outside the pricing module may quote a floor or price
  // figure for a capability at all.
  describe("no other file quotes a price figure", () => {
    const RUNTIME_DIRS = ["lib", "routes"];
    const files = [];
    for (const dir of RUNTIME_DIRS) {
      const base = path.join(__dirname, "..", dir);
      for (const name of fs.readdirSync(base)) {
        if (!name.endsWith(".cjs") && !name.endsWith(".js")) continue;
        if (name === "sonara-paid-capabilities.cjs") continue;
        files.push(path.join(base, name));
      }
    }

    it("has files to scan, so this does not pass by reading nothing", () => {
      assert.ok(files.length >= 40, `only ${files.length} runtime files found; this check has gone blind`);
    });

    it("finds no floor or price figure repeated outside the pricing module", () => {
      const offenders = quotedFigures(files);

      assert.deepEqual(
        offenders,
        [],
        "a price or floor figure is quoted outside lib/sonara-paid-capabilities.cjs:\n  " +
        offenders.join("\n  ") +
        "\nPoint at the module instead. A copied figure goes stale the first time the real one changes."
      );
    });

    it("would notice every comment that actually went stale, and each one that was found by hand", () => {
      // The failure test. Reproducing the motivating bug and confirming the
      // check catches THAT is what the checks-that-cannot-lie skill calls
      // non-optional, because a pattern that matches nothing looks identical to
      // clean code.
      //
      // All four real copies, verbatim as they stood before this file existed.
      const wasStale = [
        "// The unit is `message_or_minute`, priced at 3 minor units against a 0.8 floor.",
        "// 3 minor units against a 0.8 floor.",
        "// campaign_email charges 0.15 minor units per email against a 0.07 floor, and",
        "// against a dated floor of 0.0747 minor units. `lib/sonara-usage-meter.cjs`",
        "// minor units per GPU second against a floor of 0.0747, and `quote()` rounds",
        "// 500 minor units is $5.00, which at media generation's 0.25 per GPU second is"
      ];
      const missed = wasStale.filter((line) => !QUOTED_FIGURE.test(line));
      assert.deepEqual(missed, [], `the pattern does not catch lines that really did go stale:\n  ${missed.join("\n  ")}`);
    });

    it("does not fire on prose that merely has a number near the word 'against'", () => {
      // The other half. A check that cries wolf gets switched off, which is
      // worse than not having it. The first version of this pattern matched
      // "Measured 19 August 2026 against a configured server" in
      // lib/sonara-route-registry.cjs -- a date, a preposition, and nothing to
      // do with pricing.
      const innocent = [
        "// on purpose, because they are the funnel. Measured 19 August 2026 against a",
        "// configured server, and the server was right about every one of them.",
        "//   * It exhausts. Draws accumulate against it exactly as they would against a",
        "// Retried 3 times against a live endpoint before giving up."
      ];
      const wrongly = innocent.filter((line) => QUOTED_FIGURE.test(line));
      assert.deepEqual(wrongly, [], `the pattern fires on prose that quotes no price:\n  ${wrongly.join("\n  ")}`);
    });

    it("does not excuse a fresh copy appended to a comment that corrects an old one", () => {
      // The break that got through the first version of this check, kept as a
      // test because it is the most likely way somebody reintroduces the bug:
      // the file that already carries a "this used to say X" correction is
      // exactly the file where a new figure gets added, and reading the whole
      // block for the excusing phrase excused the new line too.
      //
      // Both blocks below explain a correction. The second also quotes a live
      // figure with no quotation marks around it, and must be caught.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "floor-append-"));
      const file = path.join(dir, "pretend-runtime.cjs");
      fs.writeFileSync(
        file,
        [
          "// The price and the floor are deliberately NOT repeated here. This comment",
          '// used to say "priced at 3 minor units against a 0.8 floor", which went stale.',
          "const A = 1;",
          "",
          "// The price and the floor are deliberately NOT repeated here. This comment",
          '// used to say "priced at 3 minor units against a 0.8 floor", which went stale.',
          "// telephony charges 3 minor units against a 1.4 floor.",
          "const B = 2;"
        ].join("\n")
      );
      const caught = quotedFigures([file]);
      fs.rmSync(dir, { recursive: true, force: true });
      assert.equal(
        caught.length,
        1,
        `expected the appended unquoted copy and only that: ${JSON.stringify(caught)}`
      );
      assert.match(caught[0], /:7:/, "the line caught must be the appended copy, not the correction above it");
    });

    it("does not excuse a fresh copy just because its comment block mentions a date", () => {
      // The exclusion is block-aware, so a correction comment spanning several
      // lines is not flagged for the figure it is correcting. That is exactly
      // the kind of loophole this repository keeps finding: an exemption wide
      // enough to swallow the thing it was meant to allow through once.
      //
      // Proved on a synthetic file rather than argued: a block that names a date
      // AND quotes a live figure must still be caught.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "floor-check-"));
      const file = path.join(dir, "pretend-runtime.cjs");
      fs.writeFileSync(
        file,
        [
          "// Corrected on 10 September 2026 after the floor moved.",
          "// telephony now charges 3 minor units against a 1.4 floor, which is the",
          "// figure to use.",
          "const X = 1;"
        ].join("\n")
      );
      const caught = quotedFigures([file]);
      fs.rmSync(dir, { recursive: true, force: true });
      assert.equal(caught.length, 1, `a dated block that still quotes a live figure was not caught: ${JSON.stringify(caught)}`);
    });
  });

  // Three files' comments explain a billing minimum by the arithmetic of the
  // price list. Removing the copied figures from them means the explanation now
  // points here, so the claims have to actually be checked.
  //
  // This is not decoration. lib/creator-generation-billing.cjs said eight GPU
  // seconds was "the smallest quantity where the two separate"; the real answer
  // on the current price list is five. The sentence read exactly like a computed
  // one and was not.
  describe("a billing minimum is past the point where charge and cost separate", () => {
    // The smallest quantity of a capability's unit at which `quote()` returns a
    // positive margin. Derived, never written down -- writing it down is the
    // defect this whole file is about.
    function separationPoint(capability) {
      for (let amount = 1; amount <= 100000; amount += 1) {
        if (quote(capability, amount).marginMinor > 0) return amount;
      }
      return null;
    }

    it("found a separation point for both metered-by-fraction capabilities", () => {
      for (const capability of ["media_generation", "campaign_email"]) {
        const point = separationPoint(capability);
        assert.ok(point !== null, `${capability} never turns a margin at any quantity; that is a pricing bug, not a rounding one`);
        assert.ok(point > 1, `${capability} separates at 1, so this check is measuring nothing`);
      }
    });

    it("bills a generation job for enough GPU seconds to earn something", () => {
      const point = separationPoint("media_generation");
      assert.ok(
        MINIMUM_BILLABLE_GPU_SECONDS >= point,
        `the minimum billable job is ${MINIMUM_BILLABLE_GPU_SECONDS} GPU seconds but charge and cost only separate at ${point}; ` +
        "every job at or below the minimum would run at exactly zero margin"
      );
      assert.ok(quote("media_generation", MINIMUM_BILLABLE_GPU_SECONDS).marginMinor > 0, "the minimum itself must earn something");
    });

    it("bills a campaign for enough emails to earn something", () => {
      const point = separationPoint("campaign_email");
      assert.ok(
        MINIMUM_BILLABLE_EMAILS >= point,
        `the minimum billable campaign is ${MINIMUM_BILLABLE_EMAILS} emails but charge and cost only separate at ${point}; ` +
        "a send at the minimum would earn nothing"
      );
      assert.ok(quote("campaign_email", MINIMUM_BILLABLE_EMAILS).marginMinor > 0, "the minimum itself must earn something");
    });

    it("keeps the free allowance worth roughly the two thousand GPU seconds it is described as", () => {
      // lib/sonara-usage-meter.cjs says $5.00 "buys about two thousand GPU
      // seconds -- roughly twenty eight-second videos". That sentence is only
      // true at a particular price, and the price lives elsewhere, so this is
      // what stops it going stale silently.
      const seconds = DEFAULT_STARTING_ALLOWANCE_MINOR / CAPABILITIES.media_generation.priceMinor;
      assert.ok(
        seconds >= 1500 && seconds <= 2500,
        `the starting allowance now buys ${Math.round(seconds)} GPU seconds, not "about two thousand"; ` +
        "update the sentence in lib/sonara-usage-meter.cjs rather than leaving a stale one"
      );
    });
  });

  it("keeps the release-chain margin check passing on the corrected figure", () => {
    // The check that would have caught a floor above the price. It could never
    // have caught a floor below the real cost, which is what this file is for.
    const result = verifyMargins();
    assert.equal(result.ok, true, `verifyMargins failed: ${JSON.stringify(result)}`);
  });
});
