import assert from "node:assert/strict";

const brand = await import("../lib/brand/brand-system.ts");
const logoRegistry = await import("../lib/brand/logo-registry.ts");

const slugs = brand.BRAND_ENTITIES.map((entity) => entity.slug);
assert.equal(new Set(slugs).size, slugs.length, "brand slugs must be unique");
assert.ok(slugs.includes("parent-company"), "parent brand must exist");

for (const entity of brand.BRAND_ENTITIES) {
  assert.ok(entity.displayName, `${entity.slug} needs a display name`);
  assert.ok(entity.tagline, `${entity.slug} needs a tagline`);
  assert.ok(entity.description, `${entity.slug} needs a description`);
  assert.match(entity.primaryColor, /^#[0-9A-F]{6}$/i, `${entity.slug} needs a hex primary color`);
  assert.match(entity.secondaryColor, /^#[0-9A-F]{6}$/i, `${entity.slug} needs a hex secondary color`);
  assert.match(entity.accentColor, /^#[0-9A-F]{6}$/i, `${entity.slug} needs a hex accent color`);
  assert.ok(entity.legalNameWarning.includes("legally reviewed"), `${entity.slug} needs legal warning copy`);
  assert.ok(logoRegistry.LOGO_REGISTRY[entity.slug], `${entity.slug} needs logo registry entry`);
}

assert.equal(brand.getEntityBrand("missing").slug, "parent-company");
assert.equal(brand.DEFAULT_PARENT_BRAND.displayName, "Umbrella Technologies");

console.log("Brand registry test passed.");
