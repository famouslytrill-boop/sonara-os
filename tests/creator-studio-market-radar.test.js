"use strict";

const assert = require("assert");
const { STATUS, getCreatorStudioMarketRadar2026 } = require("../lib/creator-studio-market-radar-2026.cjs");

describe("Creator Studio 2026 market radar", () => {
  it("is research and product planning only", () => {
    const radar = getCreatorStudioMarketRadar2026();
    assert.equal(radar.asOf, "2026-09-22");
    assert.equal(radar.authority, "research_and_product_planning_only");
    assert.equal(radar.executionAuthority, "none");
    assert.ok(radar.guardrails.some((item) => /no automatic repository or model-weight installation/i.test(item)));
    assert.ok(radar.guardrails.some((item) => /no hidden publishing/i.test(item)));
  });

  it("keeps Creator Studio separate from vertical business operations", () => {
    const radar = getCreatorStudioMarketRadar2026();
    assert.ok(radar.creatorOwnership.creatorStudio.includes("creator projects and asset library"));
    assert.ok(radar.creatorOwnership.sharedNexus.includes("billing payments usage credits and provider cost reconciliation"));
    assert.ok(radar.creatorOwnership.businessBuilder.includes("restaurant POS kiosk and inventory operations"));
    assert.ok(radar.creatorOwnership.partnerOnly.includes("banking rails and money transmission"));
  });

  it("prioritizes project state, deterministic workflows, RAG, commerce and observability", () => {
    const radar = getCreatorStudioMarketRadar2026();
    for (const key of [
      "creator-project-graph",
      "deterministic-workflow-runtime",
      "creator-rag",
      "creator-commerce",
      "observability-and-cost"
    ]) {
      assert.ok(radar.architecture.some((item) => item.key === key), key);
    }
    assert.ok(radar.marketPatterns.some((item) => item.key === "native-os" && item.status === STATUS.DO_NOT_REBUILD));
  });

  it("keeps competitor evidence as market references rather than integrations", () => {
    const radar = getCreatorStudioMarketRadar2026();
    assert.ok(radar.benchmarks.length >= 10);
    for (const item of radar.benchmarks) {
      assert.equal(item.relationship, "market_reference_not_integration");
      assert.ok(item.sourceUrl.startsWith("https://"));
      assert.equal(item.checkedAt, "2026-09-22");
    }
  });

  it("keeps repository candidates non-executing and review-gated", () => {
    const radar = getCreatorStudioMarketRadar2026();
    assert.ok(radar.openSourceCandidates.length >= 15);
    for (const item of radar.openSourceCandidates) {
      assert.equal(item.runtimeAuthority, "none");
      assert.equal(item.humanReviewRequired, true);
      assert.ok(item.repoUrl.startsWith("https://github.com/"));
      assert.ok(item.licenseDecision);
      assert.ok(item.integrationBoundary);
    }

    const obs = radar.openSourceCandidates.find((item) => item.name === "OBS Studio");
    assert.equal(obs.integrationBoundary, "external_companion_only");

    const demucs = radar.openSourceCandidates.find((item) => item.name === "Demucs");
    assert.equal(demucs.integrationBoundary, "research_only_archived");
  });

  it("records retiring APIs so new hard dependencies are not introduced", () => {
    const radar = getCreatorStudioMarketRadar2026();
    const sora = radar.deprecations.find((item) => item.key === "openai-sora-videos-api");
    assert.ok(sora);
    assert.equal(sora.status, "do_not_start_new_dependency");
    assert.match(sora.reason, /2026-09-24/);
    assert.ok(sora.sourceUrl.startsWith("https://"));
  });

  it("has a staged roadmap instead of activating everything at once", () => {
    const radar = getCreatorStudioMarketRadar2026();
    assert.ok(radar.roadmap.days0to30.length >= 5);
    assert.ok(radar.roadmap.days30to90.length >= 5);
    assert.ok(radar.roadmap.days90to180.length >= 5);
    assert.ok(radar.roadmap.days0to30.some((item) => /Creator Project Graph/i.test(item)));
    assert.ok(radar.roadmap.days30to90.some((item) => /exactly one minimal-scope distribution adapter/i.test(item)));
  });
});
