"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { REQUIRED } = require("../lib/sonara-environment-classification.cjs");

const root = path.join(__dirname, "..");
const GUIDE = path.join(root, "docs", "owner", "INSTALL-ALL-KEYS.md");

// docs/owner/INSTALL-ALL-KEYS.md is what the owner follows to make the product
// able to serve a paying customer. Its "ten required variables" section said ten,
// and listed nine -- three of which were not required at all, while four that
// were required went unmentioned.
//
// The count was right, which is what made it survive. `verify-doc-counts` checks
// countable claims, and "ten" matched the classification's ten. Nothing compared
// the *names*, so the section could name an entirely different set and still
// read as verified.
//
// Someone following it would have set nine variables, missed
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, RESEND_FROM_EMAIL and
// NEXT_PUBLIC_SITE_URL, and had no reason to suspect it: the guide ends with a
// "prove it" step, and none of the commands there name a missing variable that
// the guide itself never asked for.
describe("the key guide names every required variable", () => {
  const guide = fs.readFileSync(GUIDE, "utf8");
  const required = [...REQUIRED];

  it("has a required list to check against, or this test proves nothing", () => {
    assert.ok(required.length >= 5, `only ${required.length} required variables; this check has gone blind`);
    assert.ok(guide.length > 2000, "the guide is too short to be the whole document");
  });

  it("names each one somewhere the owner will actually read", () => {
    const missing = required.filter((name) => !guide.includes(name));
    assert.deepEqual(
      missing,
      [],
      `INSTALL-ALL-KEYS.md never mentions ${missing.join(", ")}, so an owner following it would not set them`
    );
  });

  it("does not present an optional variable as required", () => {
    // The other direction, and the one that actually happened: the three monthly
    // price variables sat under "The ten required variables" while the
    // classification has them optional. Scoped to that section rather than the
    // whole file, because naming an optional variable elsewhere is the guide
    // doing its job.
    const start = guide.indexOf("## Step 1");
    const end = guide.indexOf("## Step 2", start);
    assert.ok(start >= 0 && end > start, "the required-variables section is not where this test expects it");
    const section = guide.slice(start, end);

    const claimed = [...section.matchAll(/^([A-Z][A-Z0-9_]{2,})\s*=/gm)].map((m) => m[1]);
    assert.ok(claimed.length > 0, "no variables parsed out of the required section; the matcher has stopped matching");

    const notRequired = claimed.filter((name) => !REQUIRED.has(name));
    assert.deepEqual(
      notRequired,
      [],
      `the required section presents ${notRequired.join(", ")} as required, but the classification does not`
    );
  });

  it("states the same count the classification does", () => {
    assert.match(
      guide,
      new RegExp(`## Step 1 [^\\n]*\\b${["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][required.length] || required.length}\\b`, "i"),
      `the heading's count no longer matches the ${required.length} required variables`
    );
  });
});
