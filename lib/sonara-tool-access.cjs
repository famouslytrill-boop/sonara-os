// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Four public tools per child company. Computation and results need no account;
// saving workspace history does. Keep the home page and directory in agreement.
// The three SONARA One tools live at /tools and process inputs on the device.

const FREE_TOOL_PATHS = Object.freeze([
  "/business-builder/tools/break-even",
  "/business-builder/tools/reorder-point",
  "/business-builder/tools/offer",
  "/business-builder/tools/pricing",
  "/creator-studio/tools/rate-card",
  "/creator-studio/tools/split-sheet",
  "/creator-studio/tools/brief",
  "/creator-studio/tools/release-checklist",
  "/growth-studio/tools/budget-split",
  "/growth-studio/tools/referral",
  "/growth-studio/tools/campaign",
  "/growth-studio/tools/kpi"
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
