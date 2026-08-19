// The brand records, checked against the registry that actually ships.
//
// This file used to import lib/brand/brand-system.ts and lib/brand/logo-registry.ts
// and assert that every entity had a display name, a tagline, three hex colours
// and a logo entry. It passed, and had always passed.
//
// **Neither file was ever deployed.** They belonged to the Next.js application
// under app/ -- 231 pages and 12 API routes that could not build, because
// `next`, `react` and `typescript` were not dependencies, there was no
// TypeScript build step, and vercel.json bundles only public/, routes/ and
// lib/*.cjs into api/index.js. That application was deleted on 19 August 2026.
//
// The brand records a customer actually sees come from
// lib/sonara-brand-registry.cjs, which had none of these assertions. So the
// suite was proving that a record was complete in a file nobody runs, while the
// record on the live pages went unchecked -- the same false-confidence shape
// tests/brand-routes.test.mjs was rewritten to fix.
//
// Same questions, asked of the shipped registry.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { SONARA_BRAND_REGISTRY, getBrandProduct } = require("../lib/sonara-brand-registry.cjs");

const { parent, products } = SONARA_BRAND_REGISTRY;
const applicationCss = readFileSync(new URL("../public/sonara-application-ui.css", import.meta.url), "utf8");
assert.ok(applicationCss.length > 1000, "public/sonara-application-ui.css is empty or missing; the accent check below would pass over anything");

// Guards the check itself. Every loop below passes over an empty list, so
// without this the file reports success on a registry that lost its products.
assert.ok(Array.isArray(products) && products.length >= 3, `expected at least three products, found ${products?.length}`);

const slugs = products.map((product) => product.slug);
assert.equal(new Set(slugs).size, slugs.length, "brand slugs must be unique");
const keys = products.map((product) => product.key);
assert.equal(new Set(keys).size, keys.length, "brand keys must be unique");

// AGENTS.md names these three and no others as the public products.
for (const expected of ["business-builder", "creator-studio", "growth-studio"]) {
  assert.ok(slugs.includes(expected), `${expected} is missing from the brand registry`);
}

for (const product of products) {
  for (const field of ["key", "slug", "name", "action", "description", "route", "dashboardRoute"]) {
    assert.ok(product[field], `${product.slug || product.key} needs a ${field}`);
  }
  assert.match(product.route, /^\//, `${product.slug} route must be a path`);
  assert.match(product.dashboardRoute, /^\//, `${product.slug} dashboardRoute must be a path`);

  // A logo path that resolves to nothing renders as a broken image on a page
  // whose whole job is looking finished. The old test asserted a registry entry
  // existed; this asserts the file does.
  for (const field of ["logo", "horizontalLogo"]) {
    assert.ok(product[field], `${product.slug} needs a ${field}`);
    assert.ok(
      existsSync(new URL(`../public${product[field]}`, import.meta.url)),
      `${product.slug} ${field} points at public${product[field]}, which does not exist`
    );
  }

  // The accent is a CSS modifier token, not a colour: the registry says
  // "forge" and public/sonara-application-ui.css defines
  // `.sonara-product--forge { --product-accent: ... }`. Renaming one without
  // the other loses the product's colour on the page and nothing would say so,
  // because both halves stay individually valid.
  assert.ok(product.accent, `${product.slug} needs an accent token`);
  assert.ok(
    applicationCss.includes(`.sonara-product--${product.accent}`),
    `${product.slug} has accent "${product.accent}" and public/sonara-application-ui.css defines no .sonara-product--${product.accent} rule`
  );
}

for (const field of ["name", "platform", "message", "promise", "audience"]) {
  assert.ok(parent[field], `the parent brand needs a ${field}`);
}
assert.equal(parent.name, "SONARA Industries");
assert.equal(parent.platform, "SONARA One");

for (const field of ["logo", "horizontalLogo", "darkLogo", "monochromeLogo"]) {
  assert.ok(parent[field], `the parent brand needs a ${field}`);
  assert.ok(
    existsSync(new URL(`../public${parent[field]}`, import.meta.url)),
    `the parent ${field} points at public${parent[field]}, which does not exist`
  );
}

// The lookup every page uses. An unknown key must not return undefined and take
// a page down with it.
assert.ok(getBrandProduct("business_builder"), "getBrandProduct does not resolve a real key");
assert.ok(!getBrandProduct("no_such_product"), "an unknown key should resolve to nothing, not to a wrong product");

console.log("Brand registry test passed.");
