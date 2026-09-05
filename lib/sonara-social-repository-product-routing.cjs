"use strict";

const {
  NEW_REPOSITORY_SLUGS,
  EXISTING_REPOSITORY_SLUGS
} = require("./sonara-social-repository-intake.cjs");
const {
  SURFACES,
  primarySurfaceFor,
  customerAvailability
} = require("./sonara-repository-product-routing.cjs");

const BATCH_SLUGS = Object.freeze([...NEW_REPOSITORY_SLUGS, ...EXISTING_REPOSITORY_SLUGS]);

function surfaceFor(record) {
  return primarySurfaceFor(record);
}

function getSocialRepositoryProductPlacements(records) {
  const bySlug = new Map((Array.isArray(records) ? records : []).map((record) => [record.slug, record]));
  return BATCH_SLUGS.map((slug) => {
    const record = bySlug.get(slug) || null;
    const surface = surfaceFor(record);
    return Object.freeze({ slug, record, surface });
  });
}

function getPlacementCounts(records) {
  return getSocialRepositoryProductPlacements(records).reduce((counts, placement) => {
    counts[placement.surface.key] = (counts[placement.surface.key] || 0) + 1;
    return counts;
  }, {});
}

module.exports = {
  BATCH_SLUGS,
  SURFACES,
  surfaceFor,
  getSocialRepositoryProductPlacements,
  getPlacementCounts,
  customerAvailability
};
