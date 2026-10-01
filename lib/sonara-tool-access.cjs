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
// ## Why these six
//
// They are not a judgement about which tools matter most. They are the six that
// the public home page in server.js names under the heading
// "Free, and no account needed", with the sentence "no account, no card".
//
// That makes the free set a consequence of what SONARA already says in public
// rather than a list somebody picked, and it is checkable:
// tests/a-locked-tool-is-never-advertised-as-free.test.js reads server.js, pulls
// out every tool path it links, and fails if that set and this one differ in
// either direction. Add a tool to the home page without adding it here and the
// page promises something the gate refuses; remove one from the home page and
// leave it here and this list is carrying a tool nothing advertises.
//
// To change the split, change this list and the home page together. The test
// will tell you if you did only one.

const FREE_TOOL_PATHS = Object.freeze([
  "/business-builder/tools/break-even",
  "/business-builder/tools/reorder-point",
  "/creator-studio/tools/rate-card",
  "/creator-studio/tools/split-sheet",
  "/growth-studio/tools/budget-split",
  "/growth-studio/tools/referral"
]);

const FREE_TOOL_SET = new Set(FREE_TOOL_PATHS);

// The product each tool belongs to, read from its own path. A tool under
// /creator-studio/ is gated against the Creator Studio entitlement and not
// against a product the customer did not buy.
const PRODUCT_BY_PREFIX = Object.freeze({
  "business-builder": "business_builder",
  "creator-studio": "creator_studio",
  "growth-studio": "growth_studio"
});

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

module.exports = { FREE_TOOL_PATHS, FREE_TOOL_SET, isFreeTool, productForTool, partitionTools };
