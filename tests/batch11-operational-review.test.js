"use strict";

const assert = require("node:assert/strict");
const {
  BATCH11_OPERATIONAL_REVIEW,
  BATCH11_REPOSITORY_REVIEW,
  BATCH11_UNRESOLVED_LEADS,
  getBatch11OperationalReview
} = require("../lib/sonara-batch11-operational-review.cjs");
const { getUnifiedBatchConvergence } = require("../lib/sonara-batch-convergence-engine.cjs");
const { SOURCE_EVIDENCE, getSourceEvidenceRegister } = require("../lib/sonara-source-evidence-register.cjs");

const VERIFIED_REPOSITORIES = [
  "revfactory/harness",
  "mattpocock/skills",
  "zhaoxuya520/reverse-skill",
  "nextlevelbuilder/ui-ux-pro-max-skill",
  "msitarzewski/agency-agents",
  "Zackriya-Solutions/meetily",
  "iOfficeAI/OfficeCLI",
  "langchain-ai/openwiki",
  "usestrix/strix",
  "trycompai/crm",
  "oso95/scroll-world",
  "YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill"
];

describe("Batch 11 verification-first intake", () => {
  it("records operational requirements without granting execution", () => {
    const review = getBatch11OperationalReview();
    assert.equal(review.batch, 11);
    assert.equal(review.productionExecutionAdded, 0);
    assert.equal(review.recordCount, BATCH11_OPERATIONAL_REVIEW.length);
    assert.equal(review.repositoryCount, BATCH11_REPOSITORY_REVIEW.length);
    assert.equal(review.unresolvedLeadCount, BATCH11_UNRESOLVED_LEADS.length);
    assert.ok(review.records.length >= 8);
    assert.ok(review.records.every((item) => item.canExecuteFromThisRecord === false));
    assert.ok(review.records.every((item) => item.humanReviewRequired === true));
  });

  it("keeps every verified repository research-only and non-executing", () => {
    const review = getBatch11OperationalReview();
    for (const repository of VERIFIED_REPOSITORIES) {
      const record = review.repositories.find((item) => item.repository.toLowerCase() === repository.toLowerCase());
      assert.ok(record, `${repository} must be recorded in Batch 11`);
      assert.equal(record.enabledInProduction, false);
      assert.equal(record.canExecute, false);
      assert.equal(record.humanReviewRequired, true);
    }
    const noLicense = review.repositories.find((item) => item.key === "nano_banana_prompt_recommender");
    assert.equal(noLicense.license, "NOASSERTION");
    assert.match(noLicense.licenseStatus, /blocked_no_declared_license/);
  });

  it("keeps unresolved repository identities unresolved rather than guessing", () => {
    const keys = new Set(BATCH11_UNRESOLVED_LEADS.map((item) => item.key));
    assert.ok(keys.has("omniroute"));
    assert.ok(keys.has("awesome_design_md"));
  });

  it("merges Batch 11 provenance without widening runtime authority", () => {
    const convergence = getUnifiedBatchConvergence();
    assert.equal(convergence.latestBatch, 11);
    assert.equal(convergence.counts.batches, 11);
    assert.match(convergence.mode, /batch_1_11/);
    assert.ok(convergence.operationalRequirements.some((item) => item.batch === 11));
    assert.ok(convergence.repositories.every((item) => item.convergenceExecutionAllowed === false));

    const office = convergence.repositories.find((item) => item.repository.toLowerCase() === "iofficeai/officecli");
    assert.ok(office);
    assert.ok(office.seenInBatches.includes(11));
    assert.ok(office.sourceRecords.some((item) => item.sourceId === 11));
  });

  it("adds Batch 11 source evidence while preserving evidence-only authority", () => {
    const register = getSourceEvidenceRegister();
    const record = SOURCE_EVIDENCE.find((item) => item.key === "batch11_visual_intake");
    assert.ok(record);
    assert.deepEqual(record.batches, [11]);
    assert.equal(record.executable, false);
    assert.equal(record.productionAuthority, false);
    assert.equal(record.humanReviewRequired, true);
    assert.equal(register.sourceCount, SOURCE_EVIDENCE.length);
  });
});
