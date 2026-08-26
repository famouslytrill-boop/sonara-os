"use strict";

// The six website prompts, and the property that makes them worth shipping.
//
// The task list came from a batch of prompts submitted on 19 August 2026 -- build
// a premium website, nail the first impression, write a better homepage, a
// portfolio, a service page, an About page, fix mobile, write the whole site.
// The wording here is original, and it had to be: template() in
// lib/sonara-prompt-library.cjs stamps every builtin `sourceType:
// "sonara_original"`, so pasting somebody else's text in would make the record's
// own provenance false.
//
// **What the submitted versions did not have is the part being asserted below.**
// "Make it feel modern, high-end, and built to convert" is an open invitation to
// write testimonials, client counts, awards and guarantees that do not exist,
// and a small business that publishes those has a problem that is not a
// marketing problem. Every prompt here says so to the model, and this file fails
// if one stops.

const assert = require("node:assert/strict");
const {
  BUILTIN_PROMPT_TEMPLATES,
  extractVariables,
  renderPrompt,
  reviewPromptContent
} = require("../lib/sonara-prompt-library.cjs");

const WEBSITE_SLUGS = [
  "website-structure-and-copy-plan",
  "website-hero-section",
  "website-service-page",
  "website-about-page",
  "creator-portfolio-page",
  "website-mobile-review"
];

function builtin(slug) {
  return BUILTIN_PROMPT_TEMPLATES.find((entry) => entry.slug === slug);
}

describe("a prompt that refuses to invent proof", () => {
  it("has all six, so nothing below passes over a missing one", () => {
    for (const slug of WEBSITE_SLUGS) {
      assert.ok(builtin(slug), `${slug} is not in the builtin library`);
    }
    assert.ok(BUILTIN_PROMPT_TEMPLATES.length >= 15, `only ${BUILTIN_PROMPT_TEMPLATES.length} builtins; this check has gone blind`);
  });

  it("tells the model not to invent proof, in every one of them", () => {
    // The single property these were written for. A prompt that asks for
    // persuasive website copy and does not say this is a prompt that produces
    // invented testimonials, and the business publishes them.
    for (const slug of WEBSITE_SLUGS) {
      const content = builtin(slug).content;
      assert.match(
        content,
        /\bdo not (?:invent|describe|report|use)\b/i,
        `${slug} never tells the model to stop short of making something up`
      );
      assert.match(
        content,
        /testimonial|proof|credential|result|client|statistic|guarantee|evidence/i,
        `${slug} refuses in the abstract without naming what must not be invented`
      );
    }
  });

  it("names what must not be invented, rather than saying be accurate", () => {
    // Naming the specific things is what makes the instruction usable. "Be
    // accurate" is advice; "do not invent testimonials, client counts, awards,
    // years in business, guarantees, or credentials" is a rule.
    const named = {
      "website-structure-and-copy-plan": ["testimonial", "award", "guarantee", "credential"],
      "website-hero-section": ["statistic", "rating", "guarantee"],
      "website-service-page": ["testimonial", "case stud", "credential"],
      "website-about-page": ["history", "input"],
      "creator-portfolio-page": ["client", "result", "award"],
      "website-mobile-review": ["evidence"]
    };
    for (const [slug, words] of Object.entries(named)) {
      const content = builtin(slug).content.toLowerCase();
      for (const word of words) {
        assert.ok(content.includes(word), `${slug} does not name "${word}" among the things not to invent`);
      }
    }
  });

  it("asks for exactly the variables it uses", () => {
    // A prompt that declares a variable it never uses asks somebody for
    // something for no reason; one that uses a variable it never declares
    // renders with {{a_gap}} still in it. Checked across every builtin, not only
    // the new ones.
    for (const entry of BUILTIN_PROMPT_TEMPLATES) {
      const used = new Set(extractVariables(entry.content));
      const declared = new Set(entry.requiredVariables);
      const unusedButAsked = [...declared].filter((name) => !used.has(name));
      const usedButNotAsked = [...used].filter((name) => !declared.has(name) && !entry.optionalVariables.includes(name));
      assert.deepEqual(unusedButAsked, [], `${entry.slug} asks for variables it never uses: ${unusedButAsked.join(", ")}`);
      assert.deepEqual(usedButNotAsked, [], `${entry.slug} uses variables it never asks for: ${usedButNotAsked.join(", ")}`);
    }
  });

  it("renders with nothing left unfilled", () => {
    for (const slug of WEBSITE_SLUGS) {
      const entry = builtin(slug);
      const values = Object.fromEntries(entry.requiredVariables.map((name) => [name, `VALUE-${name}`]));
      const rendered = renderPrompt(entry, values);
      assert.equal(rendered.ok, true, `${slug} would not render: ${rendered.code || "unknown"}`);
      assert.doesNotMatch(rendered.renderedPrompt, /\{\{/, `${slug} rendered with a placeholder still in it`);
      for (const name of entry.requiredVariables) {
        assert.ok(rendered.renderedPrompt.includes(`VALUE-${name}`), `${slug} dropped ${name} when rendering`);
      }
    }
  });

  it("passes the library's own safety review", () => {
    for (const slug of WEBSITE_SLUGS) {
      const entry = builtin(slug);
      const review = reviewPromptContent(entry.content, { title: entry.title, description: entry.description });
      assert.equal(review.decision, "allowed", `${slug} was ${review.decision}: ${[...review.blockedReasons, ...review.reviewReasons].join("; ")}`);
    }
  });

  it("keeps the mobile prompt agreeing with what this product asks of itself", () => {
    // AGENTS.md: "Mobile layouts must avoid overflow and use large enough tap
    // targets." A prompt this product ships that reviewed mobile pages without
    // checking those two things would be advising customers to a lower standard
    // than the one it holds itself to.
    const content = builtin("website-mobile-review").content;
    assert.match(content, /overflow/i, "the mobile review does not check for overflow");
    assert.match(content, /tap target/i, "the mobile review does not check tap targets");
    assert.match(content, /44/, "the mobile review names no minimum tap-target size, so the check is a matter of taste");
  });

  it("claims to be original, and is written to be", () => {
    // template() stamps sourceType and license on every builtin. That claim is
    // only true if the text was actually written here, so this asserts the
    // stamp exists and that nothing carries a source repository -- a builtin
    // that had been adapted from somewhere would need one.
    for (const slug of WEBSITE_SLUGS) {
      const entry = builtin(slug);
      assert.equal(entry.sourceType, "sonara_original");
      assert.equal(entry.sourceRepository, null, `${slug} carries a source repository but is stamped original`);
      assert.match(entry.license, /SONARA original/);
    }
  });

  it("gives each product line the prompts it can use", () => {
    const byArea = {};
    for (const entry of BUILTIN_PROMPT_TEMPLATES) byArea[entry.productArea] = (byArea[entry.productArea] || 0) + 1;
    for (const area of ["business_builder", "creator_studio", "growth_studio"]) {
      assert.ok(byArea[area] >= 3, `${area} has ${byArea[area] || 0} builtin prompts`);
    }
    // The portfolio one belongs to the creator, not the business -- a portfolio
    // is Creator Studio's surface and filing it under Business Builder would put
    // it on a page its audience never opens.
    assert.equal(builtin("creator-portfolio-page").productArea, "creator_studio");
  });
});
