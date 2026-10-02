// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Which of the forty tools anybody can use, and which need a paid plan.
//
// ## What changed, and what the old reason was
//
// Until 1 October 2026 all forty computed for anybody, signed in or not. The
// reason is still worth reading, because it was a good one:
// routes/sonara-service-lifecycle-routes.cjs recorded that gating the
// *computation* does not drive a signup, it drives a bounce -- the funnel had
// previously advertised ten tools on a public page and answered every click with
// a redirect to /login. Gating the *saving* is what drives a signup.
//
// The owner's decision is to reduce the free set and put the rest behind the
// paywall. That is a pricing decision and it is theirs. What is not theirs to
// waive, and what this module exists to hold, is the funnel failure the old
// comment describes: a page that names a tool and then refuses it.
//
// So two things are true here at once. The thirty-four tools now need a plan,
// and **no page advertises one as free**. A locked tool still renders a page --
// its name, what it works out, what it costs to open, and a link to the plan --
// rather than a redirect or a 404, and the three directory pages label each
// entry. Refusing is fine; refusing after promising is not.
//
// ## Why these fifteen
//
// Four in each studio and three at the parent company. The counts are the
// owner's decision, taken on 2 October 2026; which tools fill them was settled
// by what shipped in #416, and the criterion the picks are held to is written
// here because "somebody picked these" is not a reason the next person can
// check:
//
//   1. It answers a question somebody has **before** they would sign up.
//   2. It computes from what is typed and from nothing else -- no saved record,
//      no connected account. A free tool that needs a workspace is not free.
//   3. It is not a near-duplicate of another free one, because four slots spent
//      on two questions is two questions answered.
//
// The parent-company three are listed last and are a different case: SONARA
// Industries had no public tool of its own, so a visitor who had not yet chosen
// a studio had nothing to open. They are also the only three that run entirely
// on the visitor's own device -- routes/sonara-parent-tool-routes.cjs serves the
// page and public/sonara-parent-tools.js does the work in the browser, so
// nothing typed into one is uploaded.
//
// **They belong in the list below even though nothing gates them.** No plan
// covers a /tools/ path, so productForTool returns null for one and the serving
// code would refuse it; they are served by their own routes and never ask. What
// putting them here buys is that the count is derivable -- leave them out and
// freeToolCountByCompany reports 0 at the parent company while three pages say
// three, which is the stale-count defect this file's last section is about.
//
// ## What is still a consequence rather than a choice
//
// The free set and the public home page have to agree.
// tests/a-locked-tool-is-never-advertised-as-free.test.js reads server.js, pulls
// out every tool path it links, and fails if that set and this one differ in
// either direction. Add a tool to the home page without adding it here and the
// page promises something the gate refuses; remove one from the home page and
// leave it here and this list is carrying a tool nothing advertises.
//
// To change the split, change this list and the home page together. The test
// will tell you if you did only one.
//
// ## Never write the count as a literal
//
// Five pages said "six" in prose on 2 October 2026 -- the free plan's
// description, two cards in the lifecycle routes, the marketing page, and this
// file's own heading. All five were correct and all five would have been wrong
// the moment this list changed, which is exactly what then happened. They read
// `FREE_TOOL_COUNT` and `freeToolCountByCompany()` now, and
// scripts/verify-free-tool-count.mjs fails the build on a public page that
// states a different number in words.

const FREE_TOOL_PATHS = Object.freeze([
  // Business Builder. Break-even and reorder point were the original two; offer
  // and pricing join them.
  "/business-builder/tools/break-even",
  "/business-builder/tools/reorder-point",
  "/business-builder/tools/offer",
  "/business-builder/tools/pricing",
  // Creator Studio. Rate card and split sheet were the original two; brief and
  // release-checklist join them.
  "/creator-studio/tools/rate-card",
  "/creator-studio/tools/split-sheet",
  "/creator-studio/tools/brief",
  "/creator-studio/tools/release-checklist",
  // Growth Studio. Budget split and referral were the original two; campaign
  // and kpi join them.
  "/growth-studio/tools/budget-split",
  "/growth-studio/tools/referral",
  "/growth-studio/tools/campaign",
  "/growth-studio/tools/kpi",
  // SONARA Industries. The parent company's own three, served by
  // routes/sonara-parent-tool-routes.cjs and computed in the visitor's browser.
  // Every one of these must stay in this list: they carry no productKey, so
  // there is no plan that could open one, and the count at the parent company
  // is read from here rather than written anywhere as a literal.
  "/tools/data-formatter",
  "/tools/text-fingerprint",
  "/tools/storage-budget"
]);

// The count, derived. Every page that says how many tools are free reads this.
const FREE_TOOL_COUNT = FREE_TOOL_PATHS.length;

const FREE_TOOL_SET = new Set(FREE_TOOL_PATHS);

// The product each tool belongs to, read from its own path. A tool under
// /creator-studio/ is gated against the Creator Studio entitlement and not
// against a product the customer did not buy.
const PRODUCT_BY_PREFIX = Object.freeze({
  "business-builder": "business_builder",
  "creator-studio": "creator_studio",
  "growth-studio": "growth_studio"
});

// The parent company's segment. Deliberately absent from PRODUCT_BY_PREFIX
// above: there is no "SONARA Industries" entitlement, so a tool under /tools/
// has no plan that covers it and productForTool returns null for one, which the
// caller treats as "do not serve this". That is the right answer and it is why
// every parent tool has to be free.
const PARENT_TOOL_PREFIX = "tools";

// Which company each free tool belongs to, worked out from its own path. Used by
// the pages that have to say "four in each studio and three at the parent"
// without any of them holding those numbers as literals.
function freeToolCountByCompany() {
  const counts = { business_builder: 0, creator_studio: 0, growth_studio: 0, sonara_industries: 0 };
  for (const toolPath of FREE_TOOL_PATHS) {
    const segment = String(toolPath).split("/")[1] || "";
    if (segment === PARENT_TOOL_PREFIX) counts.sonara_industries += 1;
    else if (PRODUCT_BY_PREFIX[segment]) counts[PRODUCT_BY_PREFIX[segment]] += 1;
  }
  return Object.freeze(counts);
}

/**
 * The one sentence every page uses to say what is free.
 *
 * Written here rather than on each page because five pages carried their own
 * copy of it on 2 October 2026, all saying "six", and all five would have been
 * wrong the moment this list changed -- which is what then happened. One
 * sentence, derived from the list, is a sentence that cannot go stale.
 *
 * Digits rather than words ("15", not "fifteen") so that
 * scripts/verify-free-tool-count.mjs can check a page against the real figure.
 * A number spelled out is a number a grep cannot verify.
 */
function freeToolSentence() {
  const counts = freeToolCountByCompany();
  const perStudio = [counts.business_builder, counts.creator_studio, counts.growth_studio];
  const sameEverywhere = perStudio.every((count) => count === perStudio[0]);
  const studioPart = sameEverywhere
    ? `${perStudio[0]} in each studio`
    : `${perStudio[0]} in Business Builder, ${perStudio[1]} in Creator Studio, ${perStudio[2]} in Growth Studio`;
  return `${FREE_TOOL_COUNT} tools are free with no account and no card: ${studioPart}`
    + `, and ${counts.sonara_industries} from SONARA Industries itself.`;
}

/**
 * Is this a parent-company tool rather than a studio's?
 *
 * Takes the path, like isFreeTool, so a caller cannot ask about a title.
 */
function isParentTool(toolPath) {
  return (String(toolPath || "").split("/")[1] || "") === PARENT_TOOL_PREFIX;
}

/**
 * Is this tool free to use without an account?
 *
 * Takes the path rather than a tool object so a caller cannot accidentally ask
 * about a tool's title.
 */
function isFreeTool(toolPath) {
  return FREE_TOOL_SET.has(String(toolPath || ""));
}

/**
 * The product key a locked tool is gated against, or null.
 *
 * null for a path that is not under one of the three products, and the caller
 * treats null as "do not serve this": a tool whose product cannot be worked out
 * is not a tool to open on a guess about which plan covers it.
 */
function productForTool(toolPath) {
  const segment = String(toolPath || "").split("/")[1] || "";
  return PRODUCT_BY_PREFIX[segment] || null;
}

/**
 * Split a list of tools into the free ones and the locked ones.
 *
 * Returns `{ free, locked }`. Both are needed by the directory pages, which
 * have to label every entry rather than hide the locked ones -- hiding them
 * would turn a paywall into a product that looks smaller than it is.
 */
function partitionTools(tools) {
  const free = [];
  const locked = [];
  for (const tool of Array.isArray(tools) ? tools : []) {
    (isFreeTool(tool?.path) ? free : locked).push(tool);
  }
  return { free, locked };
}

module.exports = {
  FREE_TOOL_PATHS,
  FREE_TOOL_SET,
  FREE_TOOL_COUNT,
  PARENT_TOOL_PREFIX,
  isFreeTool,
  isParentTool,
  productForTool,
  partitionTools,
  freeToolCountByCompany,
  freeToolSentence
};
