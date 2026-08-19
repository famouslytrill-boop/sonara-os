"use strict";

// What a customer may show somebody who is not in their workspace.
//
// Every saved tool result lives in module_outputs, which is organization-scoped,
// so until now a break-even a customer worked out here could reach a business
// partner only as a screenshot. That is the whole distribution loop this product
// has: none. A result with a link is the smallest honest one -- the customer
// decides, per result, and can take it back.
//
// This module holds the parts that are decidable without a database, which is
// most of them: what a token looks like, what a shared page is allowed to say,
// and what it must never say. routes/sonara-shared-result-routes.cjs does the
// reading and writing.

const crypto = require("node:crypto");

// 24 random bytes, base64url, so 32 characters of [A-Za-z0-9_-] and 192 bits.
// The link is the only credential -- there is no second check behind it, because
// the point is that somebody with no account can open it -- so it has to be
// unguessable rather than merely unlikely. A sequential id or a uuid derived
// from a timestamp would both fail that.
const SHARE_TOKEN_BYTES = 24;
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

function mintShareToken() {
  return crypto.randomBytes(SHARE_TOKEN_BYTES).toString("base64url");
}

// Checked before the token reaches a query. The length is fixed rather than
// bounded: a pattern that accepted any length would accept the empty string,
// and `share_token=eq.` matches every row whose token is empty -- the same shape
// of mistake as an organization filter with nothing after the `eq.`.
function isShareToken(value) {
  return typeof value === "string" && SHARE_TOKEN_PATTERN.test(value);
}

function sharePath(token) {
  return isShareToken(token) ? `/shared/${token}` : null;
}

function shareUrl(origin, token) {
  const path = sharePath(token);
  if (!path) return null;
  return `${String(origin || "").replace(/\/+$/, "")}${path}`;
}

// The columns a shared page may select. Written down as a list rather than
// spelled inline at the call site so the two facts below can be asserted by a
// test rather than reviewed by eye:
//
//   * organization_id is not here, and neither is anything that identifies a
//     person. A public page that knew which organization a result belonged to
//     would be one join away from saying so.
//   * input_payload is not here either. A customer sharing "your break-even is
//     420 covers a month" is not necessarily sharing the rent figure it was
//     worked out from, and the two are different decisions. Only the output
//     travels.
const SHARED_SELECT_COLUMNS = Object.freeze(["module_key", "product_key", "output_payload", "created_at", "shared_at"]);

const FORBIDDEN_SHARED_COLUMNS = Object.freeze([
  "organization_id", "user_id", "id", "input_payload", "share_token"
]);

// Which of a result's fields are worth putting in front of a stranger.
//
// output_payload is free-form per tool: some values are short summary sentences,
// some are numbers, some are nested structures the tool page renders itself. A
// shared page shows the flat, short ones and says nothing about the rest --
// printing `[object Object]` at somebody is worse than omitting a line.
const MAX_SHARED_LINES = 12;
const MAX_SHARED_VALUE_LENGTH = 400;

function presentableLines(outputPayload) {
  const entries = Object.entries(outputPayload && typeof outputPayload === "object" ? outputPayload : {});
  return entries
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .map(([key, value]) => ({ label: humanLabel(key), value: String(value).trim() }))
    .filter((line) => line.value && line.value.length <= MAX_SHARED_VALUE_LENGTH)
    .slice(0, MAX_SHARED_LINES);
}

function humanLabel(key) {
  return String(key)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

// The tool's own name, for the heading. module_key is a snake_case internal key
// and a stranger should not be reading one, so it is turned back into words. A
// title the tool supplied in its own output wins, because the tool knows what it
// made and this does not.
function sharedTitle(row) {
  const supplied = row?.output_payload?.title || row?.output_payload?.heading;
  if (typeof supplied === "string" && supplied.trim() && supplied.length <= 120) return supplied.trim();
  const key = String(row?.module_key || "").trim();
  return key ? humanLabel(key) : "A saved result";
}

const PRODUCT_LABELS = Object.freeze({
  business_builder: "Business Builder",
  creator_studio: "Creator Studio",
  growth_studio: "Growth Studio"
});

function productLabel(productKey) {
  return PRODUCT_LABELS[String(productKey || "")] || "SONARA One";
}

function formatDay(value) {
  const when = value ? new Date(value) : null;
  if (!when || Number.isNaN(when.getTime())) return null;
  return when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Everything a shared page renders, derived from one row and nothing else.
// Returned as data rather than HTML so a test can assert what is in it without
// parsing markup for the absence of a thing, which is the assertion that quietly
// stops working when the markup changes.
function sharedResultView(row) {
  if (!row || typeof row !== "object") return null;
  return {
    title: sharedTitle(row),
    product: productLabel(row.product_key),
    madeOn: formatDay(row.created_at),
    lines: presentableLines(row.output_payload)
  };
}

module.exports = {
  FORBIDDEN_SHARED_COLUMNS,
  MAX_SHARED_LINES,
  MAX_SHARED_VALUE_LENGTH,
  SHARED_SELECT_COLUMNS,
  SHARE_TOKEN_PATTERN,
  humanLabel,
  isShareToken,
  mintShareToken,
  presentableLines,
  productLabel,
  sharePath,
  shareUrl,
  sharedResultView,
  sharedTitle
};
