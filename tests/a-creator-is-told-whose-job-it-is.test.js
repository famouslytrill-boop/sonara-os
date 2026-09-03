"use strict";

// "setup required" on a screen with no setting on it.
//
// getProviderReadiness returns an engineering status, and both places that
// showed one to a creator ran it through a helper that replaced underscores
// with spaces and nothing else. The provider list and the provider dropdown
// read "setup required", "reference only" and "external mcp required".
//
// The words are internal, which is the smaller half. The larger half is that
// three of them tell a creator to go and do something, and **not one of these
// states is theirs to fix**: the account owner connects a service, and the rest
// are decisions this product has already made. A label that sends somebody
// looking for a setting that is not on their screen is a worse failure than an
// ugly one.
//
// tests/plain-language.test.js reads this page and said nothing, which is worth
// stating accurately because the first draft of this comment guessed at the
// reason and guessed wrong. Signed in, the page renders 200 and the words are
// in the visible text -- the crawl saw them. It has nothing to say because
// "setup required" and "reference only" are not in BANNED_ON_CUSTOMER_PAGES,
// and they are not there because "setup required" is on twenty-two other pages
// including the home page. That is a copy project, not a list entry.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const plainLanguage = require("../lib/sonara-plain-language.cjs");
const {
  CREATOR_GENERATION_PROVIDERS,
  getProviderReadiness
} = require("../lib/creator-generation-provider-registry.cjs");

const { withoutComments } = require("../lib/sonara-comment-stripping.cjs");

// Comments stripped, and not as tidiness. The first version of the assertion
// below matched `display(item.readiness.status)` anywhere in the file, and the
// comment recording what the line *used* to say made it fail against the fixed
// code. The same mistake in the other direction -- a check for a mention
// passing over a behaviour that is gone -- is the one this repository keeps
// finding, and one implementation of the stripping lives in lib/ because two
// scripts once had a copy each and both copies had the same bug.
const ROUTES = withoutComments(
  fs.readFileSync(path.join(__dirname, "..", "routes", "creator-generation-routes.cjs"), "utf8")
);

const {
  GENERATION_AVAILABILITY,
  GENERATION_AVAILABILITY_UNREACHABLE_TODAY,
  generationAvailability,
  generationAvailabilityLabel
} = plainLanguage;

// Every status the registry can hand a page, derived by running readiness over
// the real providers in the three environments that exist: nothing set, the
// enable flags set, and everything set.
function reachableStatuses() {
  const enabled = {};
  const configured = {};
  for (const provider of CREATOR_GENERATION_PROVIDERS) {
    if (provider.enabledEnv) {
      enabled[provider.enabledEnv] = "true";
      configured[provider.enabledEnv] = "true";
    }
    for (const key of provider.requiredEnv || []) configured[key] = "set-for-this-test";
  }
  const found = new Set();
  for (const env of [{}, enabled, configured]) {
    for (const provider of CREATOR_GENERATION_PROVIDERS) found.add(getProviderReadiness(provider, env).status);
  }
  return found;
}

describe("a creator is told whose job it is", () => {
  const reachable = reachableStatuses();

  it("has statuses to translate", () => {
    assert.ok(
      CREATOR_GENERATION_PROVIDERS.length >= 10,
      `the registry holds ${CREATOR_GENERATION_PROVIDERS.length} providers; this check has gone blind`
    );
    assert.ok(reachable.size >= 5, `only ${reachable.size} readiness statuses were reachable; this check has gone blind`);
  });

  it("translates every status a provider can actually be in", () => {
    const untranslated = [...reachable].filter((status) => !GENERATION_AVAILABILITY[status]).sort();
    assert.deepEqual(
      untranslated,
      [],
      `these readiness statuses reach a creator's screen with no plain wording: ${untranslated.join(", ")}`
    );
  });

  it("accounts for every entry, so a stale one cannot sit here unnoticed", () => {
    // The other direction. An entry for a status nothing can produce is a
    // reason nobody rechecks, which is what the next reader believes instead of
    // checking -- so it has to be recorded as unreachable, on purpose.
    for (const status of Object.keys(GENERATION_AVAILABILITY)) {
      const recorded = GENERATION_AVAILABILITY_UNREACHABLE_TODAY[status];
      if (reachable.has(status)) {
        assert.ok(
          !recorded,
          `${status} is recorded as unreachable -- "${recorded}" -- and the registry produces it. The reason has expired.`
        );
      } else {
        assert.ok(
          recorded,
          `${status} has wording but nothing can produce it, and no reason is recorded for keeping it.`
        );
        assert.ok(recorded.length > 30, `${status} is kept for a reason too short to be one`);
      }
    }
  });

  it("never sends a creator after a setting they do not have", () => {
    // The motivating defect. Every state here belongs to the account owner or
    // to a decision already made, so no label may read as an instruction to the
    // person looking at it.
    for (const status of reachable) {
      const { label, detail } = generationAvailability(status);
      assert.ok(label && detail, `${status} has no wording`);
      assert.doesNotMatch(label, /_/, `${status} still shows an internal slug: ${label}`);
      if (status !== "configured") {
        assert.doesNotMatch(
          label,
          /^(set up|configure|connect|finish|enable)\b/i,
          `${status} tells the creator to do something they cannot do: ${label}`
        );
      }
    }
  });

  it("says what a working service and a missing one are, without them reading the same", () => {
    assert.equal(generationAvailabilityLabel("configured"), "Ready to use");
    // Three states, not two: turned off, half-connected, and never offered are
    // different answers and a creator acts differently on each.
    const distinct = new Set(["disabled", "setup_required", "research_only"].map(generationAvailabilityLabel));
    assert.ok(distinct.size >= 2, "switched off and never offered read identically");
    assert.match(generationAvailability("setup_required").detail, /account owner/i, "nobody is named as responsible");
    assert.match(generationAvailability("disabled").detail, /account owner/i, "nobody is named as responsible");
  });

  it("answers an unknown status without inventing one", () => {
    for (const nonsense of ["", null, undefined, "not_a_status", 7]) {
      const answer = generationAvailability(nonsense);
      assert.ok(answer.label, `no label for ${JSON.stringify(nonsense)}`);
      assert.doesNotMatch(answer.label, /ready|available to use/i, `${JSON.stringify(nonsense)} was reported as usable`);
    }
  });

  it("uses none of the words banned on a customer page", () => {
    const copy = Object.values(GENERATION_AVAILABILITY).map(({ label, detail }) => `${label} ${detail}`).join(" ");
    for (const term of plainLanguage.BANNED_ON_CUSTOMER_PAGES) {
      assert.doesNotMatch(copy, new RegExp(`\\b${term}`, "i"), `the availability wording uses "${term}"`);
    }
  });

  describe("the pages use it", () => {
    it("no longer runs a readiness status through the underscore helper", () => {
      assert.doesNotMatch(
        ROUTES,
        /display\(item\.readiness\.status\)/,
        "a readiness status is being shown by replacing underscores again"
      );
      assert.match(ROUTES, /generationAvailabilityLabel\(item\.readiness\.status\)/, "the pages no longer use the plain label");
    });

    it("puts the wording on both surfaces, not just the list", () => {
      // The provider list and the provider dropdown. Fixing one and leaving the
      // other is how the two came to disagree in the first place.
      const uses = ROUTES.match(/generationAvailabilityLabel\(/g) || [];
      assert.ok(uses.length >= 2, `only ${uses.length} place(s) use the plain label; the dropdown or the list was missed`);
      assert.match(ROUTES, /generationAvailability\(item\.readiness\.status\)\.detail/, "the list shows a label with no explanation");
    });
  });
});
