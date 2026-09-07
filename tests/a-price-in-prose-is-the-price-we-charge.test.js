"use strict";

// A price written into a sentence, in a document nothing checks.
//
// Four of these drifted in two days, and the last one is the reason this exists:
//
//   1. tests/pricing.test.js pinned Pro under "the ~$77 competitor stack". $77
//      was corrected to $87 on 12 August and the test never moved with it.
//   2. docs/SHIP_READINESS.md said "No plan currently on the pricing page --
//      $19, $39 or $79 -- has ever been bought". Those were not the page's
//      plans, and the amounts later moved.
//   3. docs/MANUAL_DASHBOARD_SETUP_FINAL.md printed a Stripe price ID beside an
//      amount, which is the worst shape: follow it and the page says one number
//      while Stripe charges another. tests/dashboard-setup-doc.test.js now
//      compares that table against the plan table.
//   4. docs/pricing/2026-09-05-PRICING-STRATEGY.md carried
//      "All three SONARA workspaces cost **$39**" the day after the price
//      became $59 -- and `CLAUDE.md` names that document as the one to read
//      "before writing a comparison into marketing copy". A stale price there
//      does not stay there.
//
// So: a sentence that states a SONARA plan's price must state the price that
// plan actually charges. The register below is deliberately a short list of
// exact, distinctive sentences rather than a general hunt for dollar signs. A
// loose pattern over prose finds every competitor figure, every historical
// note and every worked example, and a check that cries wolf gets its register
// widened until it matches nothing.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { STRIPE_PLANS } = require("../lib/sonara-stripe-plans.cjs");

const root = path.join(__dirname, "..");
const docsRoot = path.join(root, "docs");

// Each entry: a sentence shape, and which plan each capture group is quoting.
const PRICE_SENTENCES = [
  {
    // The comparison CLAUDE.md warns about. This is the one that gets copied.
    pattern: /All three SONARA workspaces cost \*\*\$(\d[\d,]*)\*\*/g,
    plans: ["all_three_monthly"]
  },
  {
    // The ladder written out in prose.
    pattern: /Free \/ One workspace \$(\d[\d,]*) \/ All three \$(\d[\d,]*) \/ Team \$(\d[\d,]*)/g,
    plans: ["workspace_monthly", "all_three_monthly", "team_monthly"]
  }
];

// A line that dates itself as a record of what used to be true is not a claim
// about what is true. Without this, correcting a document honestly -- which
// means quoting the old figure -- is impossible.
const HISTORICAL = [
  // NOT `^\s*>`. A blockquote was on this list until the falsification run, and
  // it made the check useless for the one sentence it exists to protect: the
  // canonical comparison in 2026-09-05-PRICING-STRATEGY.md is *written as* a
  // blockquote, so excluding blockquotes excluded it. Reverting that sentence to
  // $39 left the check green -- shape 6, a check too weak to catch the bug it was
  // written for, found before it shipped rather than after.
  //
  // A line is historical because it says so, not because of how it is indented.
  /as written on/i,
  /written on \d/i,
  /as repriced on/i,
  /used to say/i,
  /corrected \d/i,
  /amended \d/i,
  /no longer true/i
];

function markdownFiles(directory) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...markdownFiles(full));
    else if (entry.name.endsWith(".md")) found.push(full);
  }
  return found;
}

function priceClaims() {
  const claims = [];
  for (const file of markdownFiles(docsRoot)) {
    const relative = path.relative(root, file);
    fs.readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      if (HISTORICAL.some((marker) => marker.test(line))) return;
      for (const { pattern, plans } of PRICE_SENTENCES) {
        for (const match of line.matchAll(pattern)) {
          plans.forEach((plan, position) => {
            claims.push({
              file: relative,
              line: index + 1,
              plan,
              stated: Number(String(match[position + 1]).replace(/,/g, "")),
              text: line.trim()
            });
          });
        }
      }
    });
  }
  return claims;
}

describe("a price written into prose is the price we charge", () => {
  const claims = priceClaims();

  it("found price sentences to check, so this does not pass on an empty sweep", () => {
    // The failure mode this guards is the register going stale: a document
    // rewritten so no pattern matches leaves the check green while checking
    // nothing. Every entry must also earn its place.
    assert.ok(claims.length >= 3, `only ${claims.length} price sentences found across docs/; this check has gone blind`);
    for (const { pattern, plans } of PRICE_SENTENCES) {
      assert.ok(plans.length >= 1, "a registered sentence names no plan");
      assert.ok(
        claims.some((claim) => plans.includes(claim.plan)),
        `no document matches ${pattern}; the sentence it describes has been rewritten and this entry now checks nothing`
      );
    }
  });

  it("states the amount each plan actually charges", () => {
    for (const claim of claims) {
      const plan = STRIPE_PLANS[claim.plan];
      assert.ok(plan, `${claim.file}:${claim.line} is registered against ${claim.plan}, which is not a plan`);
      assert.equal(
        claim.stated * 100,
        plan.amountCents,
        `${claim.file}:${claim.line} says ${claim.plan} costs $${claim.stated}, but it charges ` +
          `$${plan.amountCents / 100}.\n  ${claim.text}\n` +
          "A price in a sentence is what somebody quotes. Correct it, or mark the line as a dated record."
      );
    }
  });

  it("does not mistake a dated record of an old price for a current claim", () => {
    // Proven against the marker list rather than the tree, because the honest
    // correction of a price is a sentence that contains the old one.
    const historical = "*As written on 5 September this said All three SONARA workspaces cost **$39**.*";
    assert.ok(HISTORICAL.some((marker) => marker.test(historical)), "an honest dated correction is being read as a live claim");
  });

  it("does not let a blockquote hide a live price", () => {
    // This case asserted the opposite until the falsification run: that a line
    // beginning `>` was historical. The canonical comparison in
    // 2026-09-05-PRICING-STRATEGY.md is written as a blockquote, so that rule
    // made the check blind to the one sentence it exists to protect -- reverting
    // it to $39 left the suite green.
    const quotedLivePrice = "> at their cheapest plans. All three SONARA workspaces cost **$39**.";
    assert.ok(
      !HISTORICAL.some((marker) => marker.test(quotedLivePrice)),
      "a blockquote is being treated as historical again, which is what made this check useless the first time"
    );
    // And end to end: that same line, scanned, is reported.
    const scanned = quotedLivePrice.split("\n").filter((line) => !HISTORICAL.some((marker) => marker.test(line)));
    assert.equal(scanned.length, 1, "the line was filtered out before any pattern could see it");
    assert.match(scanned[0], PRICE_SENTENCES[0].pattern, "the comparison sentence no longer matches its own pattern");
  });
});
