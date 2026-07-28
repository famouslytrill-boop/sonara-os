// Brand promises, checked against the pages that actually deploy.
//
// This file used to read app/page.tsx, app/pricing/page.tsx,
// components/entities/EntityDashboardShell.tsx and five other .tsx files, and
// assert on the copy inside them. It passed. It had always passed. None of
// those files are deployed: Vercel serves api/index.js, which mounts
// server.js, and vercel.json bundles only public/, routes/ and lib/. The brand
// copy that reaches a customer lives in server.js and lib/sonara-brand-registry.cjs.
//
// So the suite was verifying that a string appeared in a file nobody runs,
// while the string on the live homepage went unchecked. That is the exact
// false-confidence pattern the 2026-07-27 audit was written about (MED-2), and
// deleting the test would have been the wrong fix -- the property was worth
// checking, it was just being checked in the wrong place.
//
// Everything below renders the real Express app.

import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const request = require("supertest");
const app = require("../server.js");

function visibleText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");
}

async function renderAllPages() {
  const routes = [];
  for (const layer of app._router.stack) {
    const route = layer.route;
    if (!route || !route.methods.get) continue;
    if (route.path.includes(":") || route.path.startsWith("/api")) continue;
    routes.push(route.path);
  }

  const pages = [];
  for (const route of routes) {
    const response = await request(app).get(route).set("accept", "text/html");
    if (response.status !== 200) continue;
    if (!/html/.test(response.headers["content-type"] || "")) continue;
    pages.push({ route, text: visibleText(response.text) });
  }
  return pages;
}

const pages = await renderAllPages();

// ---------------------------------------------------------------------------
// The scan reaches the app
// ---------------------------------------------------------------------------

assert.ok(pages.length >= 50, `only ${pages.length} pages rendered; the brand scan is not covering the app`);

// ---------------------------------------------------------------------------
// The brand promise is on the page a customer lands on
// ---------------------------------------------------------------------------

const homepage = pages.find((page) => page.route === "/");
assert.ok(homepage, "the homepage must render");

// AGENTS.md: the public message is "Build. Create. Grow."
assert.match(
  homepage.text,
  /Build,? create,? and grow|Build\. Create\. Grow\./i,
  "the homepage must carry the public brand message"
);

for (const product of ["Business Builder", "Creator Studio", "Growth Studio"]) {
  assert.match(homepage.text, new RegExp(product), `the homepage must name ${product}`);
}

// AGENTS.md: retired public names must not appear in active UI.
for (const retired of [/\bObliteratus\b/i]) {
  for (const page of pages) {
    assert.doesNotMatch(page.text, retired, `${page.route} uses a retired public name`);
  }
}

// ---------------------------------------------------------------------------
// The proof policy, enforced on every page rather than promised on one
// ---------------------------------------------------------------------------
//
// The homepage says: "SONARA does not publish fake testimonials, invented
// customer counts, fictional awards, guaranteed revenue, false scarcity, or
// unsupported compliance and security claims."
//
// These patterns are that sentence turned into checks. Each is written to
// match somebody *making* the claim.

const FORBIDDEN_CLAIMS = [
  [/official (?:government|federal|state) partner/i, "claims a government partnership"],
  [/guaranteed (?:success|revenue|results|income|profit|placement|ranking)/i, "guarantees an outcome"],
  [/(?:SOC ?2|ISO ?27001|HIPAA|PCI[- ]?DSS)\s*(?:certified|compliant)/i, "claims a compliance certification"],
  [/\b\d[\d,]*\+?\s*(?:happy\s+)?(?:customers|users|businesses|creators)\s+(?:trust|served|and counting)/i, "states a customer count"],
  [/award[- ]winning|#1\s+(?:rated|platform|choice)|industry[- ]leading/i, "claims an award or ranking"],
  [/only \d+ (?:spots|seats|places) left|offer ends (?:today|soon)|limited time only/i, "manufactures scarcity"],
  [/\b(?:bank[- ]grade|military[- ]grade|unhackable|100% secure)\b/i, "makes an unsupported security claim"]
];

// A sentence that denies a claim is not making it. The site's own honest copy
// says "Measure without guaranteed-placement claims" and "Prepare releases
// without fake clearance claims" -- a naive match fires on both.
//
// This is deliberately a sentence-level negation check, not sentiment
// analysis. It will let through a claim phrased with an unrelated "not"
// elsewhere in the same sentence. That trade is worth making: a check that
// flags the site's own disclaimers gets switched off, and a switched-off check
// finds nothing at all.
const NEGATION = /\b(?:no|not|never|without|cannot|does not|do not|doesn't|don't|neither|nor|instead of|rather than)\b/i;

function claimingSentences(text, pattern) {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => pattern.test(sentence) && !NEGATION.test(sentence));
}

const claims = [];
for (const page of pages) {
  for (const [pattern, description] of FORBIDDEN_CLAIMS) {
    for (const sentence of claimingSentences(page.text, pattern)) {
      claims.push(`${page.route}: ${description} -- "${sentence.trim().slice(0, 140)}"`);
    }
  }
}

assert.deepEqual(
  claims,
  [],
  `The proof policy on the homepage promises SONARA publishes none of these. These pages do:\n${claims.join("\n")}`
);

// The policy itself has to still be there, or the checks above are enforcing a
// promise the site no longer makes.
assert.match(homepage.text, /Proof policy/i, "the homepage must still publish the proof policy");
assert.match(
  homepage.text,
  /does not publish fake testimonials/i,
  "the proof policy wording these checks enforce must remain on the page"
);

// ---------------------------------------------------------------------------
// Sensitive actions are described as needing the owner
// ---------------------------------------------------------------------------
//
// AGENTS.md: refunds, payout changes, legal publishing, customer campaigns,
// proof publishing, security settings and destructive changes must not be
// automated without owner approval. The old test looked for "owner review"
// inside a React component. This checks the customer is actually told.

assert.match(
  homepage.text,
  /wait for your approval|under your control|your permission and approval/i,
  "the homepage must tell customers that sensitive actions wait for them"
);

const trustPage = pages.find((page) => page.route === "/trust");
if (trustPage) {
  assert.match(trustPage.text, /approval|review/i, "the trust page must describe the approval boundary");
}

// ---------------------------------------------------------------------------
// The brand marks the pages reference are actually served
// ---------------------------------------------------------------------------

const homepageHtml = (await request(app).get("/").set("accept", "text/html")).text;
const marks = [...new Set([...homepageHtml.matchAll(/src="(\/brand\/[^"]+)"/g)].map((match) => match[1]))];
assert.ok(marks.length >= 3, `the homepage should show the product marks; found ${marks.length}`);

for (const mark of marks) {
  const response = await request(app).get(mark);
  assert.equal(response.status, 200, `${mark} is referenced by the homepage but is not served`);
}

console.log(`Brand promises verified against ${pages.length} deployed pages and ${marks.length} brand marks.`);
