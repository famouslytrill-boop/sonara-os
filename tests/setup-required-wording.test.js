"use strict";

// Two defects a customer photographed on the live site, both of the same kind:
// markup or prose that a template produced without anything checking whether
// the result read as English.
//
// 1. The setup-required sentence was built by gluing two humanised codes into
//    a template:
//
//      `Setup required: ${displayStatus(service)} is ${displayStatus(reason)}.`
//
//    displayStatus turns a code into a readable PHRASE, not a noun, so
//    /account/billing rendered
//
//      "Setup required: Customer organization is Workspace not ready."
//
//    and the lifecycle save page rendered
//
//      "Saving needs Workspace not ready to be ready."
//
//    Both shipped. The template could not fail -- a string was always
//    produced -- so no gate noticed.
//
// 2. checklistCard joined its steps with " / " inside one <p>, producing a
//    run-on that wrapped mid-sequence and read as one sentence.
//
// These checks hold the fixes in place. The sentence check is the load-bearing
// one: it walks the call sites, collects the service names that actually reach
// setupRequiredSentence, and fails when one of them has no sentence written for
// it. Adding a new sendSetupRequired call with an unlisted service is exactly
// how the old bug would come back, so that is what it watches for.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const plainLanguage = require("../lib/sonara-plain-language.cjs");
const { checklistCard } = require("../lib/sonara-shell.cjs");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

// Files that call setupRequiredSentence, directly or through sendSetupRequired.
const CALL_SITE_FILES = ["server.js", "routes/sonara-service-lifecycle-routes.cjs"];

// Service names reaching the sentence function. Two shapes appear:
//   sendSetupRequired(req, res, 503, "stripe_customer", ...)
//   setupRequiredSentence(summary.service || summary.code || "account_database")
// Only string literals can be collected; a name computed at runtime is covered
// by the fallback, which the last check pins separately.
function referencedServices() {
  const services = new Set();
  for (const file of CALL_SITE_FILES) {
    const source = read(file);
    for (const match of source.matchAll(/sendSetupRequired\(\s*req,\s*res,\s*\d+,\s*"([a-z_]+)"/g)) {
      services.add(match[1]);
    }
    for (const match of source.matchAll(/setupRequiredSentence\(([^)]*)\)/g)) {
      for (const literal of match[1].matchAll(/"([a-z_]+)"/g)) services.add(literal[1]);
    }
  }
  return [...services];
}

describe("setup-required wording", () => {
  it("finds the call sites it claims to be checking", () => {
    // Without this the next check passes vacuously the day someone renames
    // sendSetupRequired, which is the failure mode of every grep-based test.
    const services = referencedServices();
    assert.ok(services.length >= 4, `only ${services.length} services found at the call sites; this check has gone blind`);
    assert.ok(services.includes("customer_organization"), "customer_organization -- the service in the screenshot -- was not found");
  });

  it("has a written sentence for every service that reaches a customer", () => {
    const missing = referencedServices().filter((service) => !plainLanguage.SETUP_REQUIRED_SENTENCES[service]);
    assert.deepEqual(missing, [], `these services fall back to the generic sentence: ${missing.join(", ")}. Write one for each in lib/sonara-plain-language.cjs.`);
  });

  it("says every one of them as a whole sentence", () => {
    for (const [service, sentence] of Object.entries(plainLanguage.SETUP_REQUIRED_SENTENCES)) {
      assert.match(sentence, /^[A-Z]/, `${service}: does not start a sentence`);
      assert.match(sentence, /\.$/, `${service}: does not end a sentence`);
      assert.ok(!sentence.includes("_"), `${service}: carries a raw code -- "${sentence}"`);
      // The old bug's signature: a humanised code dropped into a noun slot
      // leaves a second verb behind ("Customer organization is Workspace not
      // ready", "needs Workspace not ready to be ready").
      assert.ok(!/\bis not ready yet\b.*\bis\b/.test(sentence), `${service}: reads as two glued clauses -- "${sentence}"`);
      assert.ok(sentence.split(" ").length >= 4, `${service}: too short to be a sentence -- "${sentence}"`);
    }
  });

  it("no longer glues a humanised code into the prose", () => {
    for (const file of CALL_SITE_FILES) {
      const source = read(file);
      assert.ok(
        !/Setup required: \$\{(?:escapeHtml\()?displayStatus\(/.test(source),
        `${file} still builds a setup sentence out of displayStatus()`
      );
      assert.ok(
        !/needs \$\{escapeHtml\(displayStatus\(/.test(source),
        `${file} still builds "Saving needs <phrase> to be ready" out of displayStatus()`
      );
    }
  });

  it("keeps a sentence for a service nobody wrote one for", () => {
    // Fails open on purpose: an unknown service must still produce prose, not
    // a blank card and not a raw code.
    const fallback = plainLanguage.setupRequiredSentence("something_nobody_listed");
    assert.equal(fallback, "Part of this is not set up yet.");
    assert.equal(plainLanguage.setupRequiredSentence(""), fallback);
    assert.equal(plainLanguage.setupRequiredSentence(undefined), fallback);
    assert.equal(plainLanguage.setupRequiredSentence(null), fallback);
  });
});

describe("the getting-started checklist", () => {
  const items = ["Create a free account", "Pick a product workspace", "Use the free tools"];
  const html = checklistCard("Getting started", items);

  it("renders a list, not a paragraph of slash-separated steps", () => {
    assert.ok(html.includes('<ol class="sonara-checklist">'), "the steps are not in an ordered list");
    assert.equal((html.match(/<li>/g) || []).length, items.length, "one <li> per step");
    assert.ok(!html.includes(" / "), "the steps are still joined with a slash separator");
    for (const item of items) assert.ok(html.includes(`<li>${item}</li>`), `missing step: ${item}`);
  });

  it("escapes the steps", () => {
    assert.ok(checklistCard("T", ["<script>x</script>"]).includes("&lt;script&gt;"), "step text is not escaped");
  });

  it("is styled by a stylesheet the pages actually load", () => {
    // .sonara-skip was styled only in ui/sonara/styles/00-foundation.css, which
    // no page links, so the skip link sat visible in the corner of every screen.
    // A class rendered by a helper has to be styled in a served file.
    const served = read("public/sonara-design-system.css");
    assert.ok(served.includes(".sonara-checklist"), ".sonara-checklist is not styled in public/sonara-design-system.css");
    assert.ok(served.includes(".sonara-skip"), ".sonara-skip is not styled in public/sonara-design-system.css");
  });
});
