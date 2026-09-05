"use strict";

const assert = require("node:assert/strict");
const { readOpenSourceTools } = require("../lib/sonara-open-source-registry.cjs");
const {
  SOCIAL_REPOSITORY_INTAKE,
  NEW_REPOSITORY_SLUGS,
  EXISTING_REPOSITORY_SLUGS,
  getSocialRepositoryIntakeSummary
} = require("../lib/sonara-social-repository-intake.cjs");

describe("2026-09-01 social repository intake", () => {
  const registry = readOpenSourceTools();
  const bySlug = new Map(registry.map((record) => [record.slug, record]));

  it("preserves 50 unique source records without guessing unresolved repositories", () => {
    const summary = getSocialRepositoryIntakeSummary();
    assert.deepEqual(summary, {
      sourceCount: 50,
      verifiedRepositoryCount: 35,
      newRepositoryCount: 31,
      existingRepositoryCount: 4,
      unresolvedOrServiceSourceCount: 17
    });
    assert.equal(new Set(SOCIAL_REPOSITORY_INTAKE.map((item) => item.sourceUrl)).size, 50);
    for (const item of SOCIAL_REPOSITORY_INTAKE) {
      if (["unresolved", "service_only"].includes(item.evidenceStatus)) {
        assert.deepEqual(item.repositorySlugs, [], `${item.sourceId} guessed a repository despite incomplete evidence`);
      }
    }
  });

  it("maps every verified repository to exactly one governed registry record", () => {
    const submittedSlugs = [...NEW_REPOSITORY_SLUGS, ...EXISTING_REPOSITORY_SLUGS];
    assert.equal(new Set(submittedSlugs).size, 35);
    for (const slug of submittedSlugs) {
      assert.ok(bySlug.has(slug), `${slug} is missing from data/open-source-tools.ts`);
      assert.equal(registry.filter((record) => record.slug === slug).length, 1, `${slug} is duplicated`);
    }
  });

  it("keeps newly identified repositories out of automatic adoption states", () => {
    const forbiddenStatuses = new Set(["adapter_built", "optional_adapter_after_review"]);
    for (const slug of NEW_REPOSITORY_SLUGS) {
      const record = bySlug.get(slug);
      assert.equal(forbiddenStatuses.has(record.integrationStatus), false, `${slug} was advanced beyond registry review`);
      assert.ok(record.blockedUses.includes("automatic installation") || record.blockedUses.length > 0, `${slug} has no blocked-use boundary`);
    }
  });

  it("blocks non-commercial, unlicensed, biometric, voice-cloning, and offensive-security candidates", () => {
    const blocked = [
      "openvid-browser-product-demo-editor",
      "reverse-skill-restricted-security-router",
      "metabigor-restricted-osint-reference",
      "voicestudio-restricted-local-voice-reference",
      "fal-3d-anything-image-to-3d-blocked",
      "face-anything-biometric-research-blocked",
      "uniface-biometric-analysis-blocked"
    ];
    for (const slug of blocked) {
      const record = bySlug.get(slug);
      assert.equal(record.integrationStatus, "blocked", `${slug} is not blocked`);
      assert.equal(record.commercialUseStatus, "blocked_until_review", `${slug} does not fail closed commercially`);
    }
  });

  it("does not turn research intake into a new customer product lifecycle", () => {
    for (const item of SOCIAL_REPOSITORY_INTAKE) {
      assert.equal(Object.hasOwn(item, "lifecycleStatus"), false);
      assert.equal(Object.hasOwn(item, "customerRoute"), false);
    }
  });
});
