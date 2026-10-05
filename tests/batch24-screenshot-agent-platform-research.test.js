"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const batch = require("../lib/sonara-screenshot-tool-radar-batch24.cjs");
const { getUnifiedBatchConvergence } = require("../lib/sonara-batch-convergence-engine.cjs");

describe("Batch 24 screenshot research", () => {
  it("records all 34 screenshots without granting execution authority", () => {
    const readiness = batch.getScreenshotToolReadinessBatch24();
    assert.equal(readiness.batch, 24);
    assert.equal(readiness.screenshotCount, 34);
    assert.equal(readiness.repositoryCount, 12);
    assert.equal(readiness.verifiedCount, 12);
    assert.equal(readiness.reciprocalLicenseCount, 4);
    assert.equal(readiness.nonRepositoryReferenceCount, 12);
    assert.equal(readiness.confirmedExistingRecordCount, 10);
    assert.equal(readiness.deduplicatedReferenceCount, 2);
    assert.equal(readiness.architectureExtensionCount, 11);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(readiness.repositories.every((item) => item.repositoryVerified));
    assert.ok(readiness.repositories.every((item) => item.configurationStatus === "cataloged_disabled"));
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.enabledInProduction === false));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
    assert.ok(readiness.repositories.every((item) => item.humanReviewRequired === true));
  });

  it("records the twelve new source-verified repositories", () => {
    assert.deepEqual(
      batch.SCREENSHOT_TOOL_RADAR_BATCH24.map((item) => item.repository),
      [
        "colbymchenry/codegraph",
        "Alishahryar1/free-claude-code",
        "nexmoe/VidBee",
        "sqlmapproject/sqlmap",
        "we-promise/sure",
        "TNTcraftHIM/Piik",
        "microsoft/graphrag",
        "microsoft/Data-Science-For-Beginners",
        "morluto/rea",
        "overmind-core/overmind",
        "NVIDIA/Model-Optimizer",
        "cporter202/ai-agent-tools"
      ]
    );

    const codeGraph = batch.SCREENSHOT_TOOL_RADAR_BATCH24.find((item) => item.key === "colbymchenry_codegraph");
    assert.equal(codeGraph.license, "MIT");
    assert.match(codeGraph.blockedUses.join(" "), /skipping required tests/i);

    const freeClaude = batch.SCREENSHOT_TOOL_RADAR_BATCH24.find((item) => item.key === "alishahryar1_free_claude_code");
    assert.equal(freeClaude.license, "AGPL-3.0-only");
    assert.equal(freeClaude.reciprocalLicense, true);
    assert.match(freeClaude.blockedUses.join(" "), /evade provider billing|quotas|account rules/i);

    const sqlmap = batch.SCREENSHOT_TOOL_RADAR_BATCH24.find((item) => item.key === "sqlmapproject_sqlmap");
    assert.match(sqlmap.license, /GPL-2\.0-or-later/i);
    assert.match(sqlmap.integrationStatus, /authorized_staging_research_only/i);
    assert.match(sqlmap.blockedUses.join(" "), /scanning third-party targets without explicit authorization/i);
    assert.match(sqlmap.blockedUses.join(" "), /database takeover|credential extraction|file read\/write/i);

    const rea = batch.SCREENSHOT_TOOL_RADAR_BATCH24.find((item) => item.key === "morluto_rea");
    assert.match(rea.integrationStatus, /authorization_required/i);
    assert.match(rea.blockedUses.join(" "), /unauthorized analysis|circumventing DRM|extracting credentials/i);

    const overmind = batch.SCREENSHOT_TOOL_RADAR_BATCH24.find((item) => item.key === "overmind_core_overmind");
    assert.match(overmind.license, /MIT.*AGPL-3\.0/i);
    assert.match(overmind.blockedUses.join(" "), /arbitrary shell access/i);

    const agentTools = batch.SCREENSHOT_TOOL_RADAR_BATCH24.find((item) => item.key === "cporter202_ai_agent_tools");
    assert.match(agentTools.license, /NOASSERTION/i);
    assert.equal(agentTools.integrationStatus, "blocked");
  });

  it("reconciles existing resources and explicit duplicate images", () => {
    const confirmed = batch.CONFIRMED_EXISTING_RECORDS_BATCH24.map((item) => item.key);
    assert.deepEqual(confirmed, [
      "munder_difflin_existing_batch24",
      "tester_army_e2e_existing_batch24",
      "autogpt_existing_batch24",
      "openvid_existing_batch24",
      "anti_slop_existing_batch24",
      "context_mode_existing_batch24",
      "paddleocr_existing_batch24",
      "lead_gen_api_stack_existing_batch24",
      "public_apis_existing_batch24",
      "awesome_llm_apps_existing_batch24"
    ]);

    assert.deepEqual(
      batch.DEDUPLICATED_REFERENCES_BATCH24.map((item) => item.canonicalKey),
      ["we_promise_sure", "nvidia_free_endpoint_promotion_batch24"]
    );
  });

  it("records current-state corrections instead of copying social claims literally", () => {
    const refs = Object.fromEntries(batch.NON_REPOSITORY_REFERENCES_BATCH24.map((item) => [item.key, item]));

    assert.match(refs.tradingview_ai_chart_copilot_batch24.reason, /built into TradingView/i);
    assert.match(refs.tradingview_ai_chart_copilot_batch24.reason, /browser extension/i);
    assert.match(refs.nvidia_free_endpoint_promotion_batch24.reason, /can change/i);
    assert.match(refs.nvidia_free_endpoint_promotion_batch24.nextStep, /never hardcode 'free'/i);
    assert.match(refs.paddleocr_pipeline_visual_batch24.nextStep, /existing worker-only posture/i);
    assert.match(refs.multi_agent_workflow_visual_batch24.nextStep, /smallest topology/i);
  });

  it("preserves privacy, provenance and deterministic postconditions in the architecture extensions", () => {
    const byKey = Object.fromEntries(batch.ARCHITECTURE_EXTENSIONS_BATCH24.map((item) => [item.key, item]));

    assert.match(byKey.code_change_impact_graph_contract_batch24.implementation, /mandatory baseline plus targeted tests/i);
    assert.match(byKey.realtime_voice_turn_taking_contract_batch24.implementation, /barge-in cancellation/i);
    assert.match(byKey.document_ai_ingest_structure_export_contract_batch24.implementation, /source coordinates/i);
    assert.match(byKey.graph_rag_provenance_contract_batch24.implementation, /tenant-specific graph\/index/i);
    assert.match(byKey.agent_evaluation_promotion_loop_batch24.implementation, /human approval.*canary.*rollback/i);
    assert.match(byKey.screen_sharing_privacy_boundary_batch24.implementation, /explicit screen\/window\/tab picker/i);
    assert.match(byKey.defensive_api_security_baseline_batch24.implementation, /explicitly authorized owned targets/i);
    assert.match(byKey.bounded_multi_agent_topology_contract_batch24.implementation, /smallest agent topology|choose single agent/i);
  });

  it("publishes Batch 24 through Research Lab and convergence without widening authority", async () => {
    const catalog = await request(app).get("/api/ecosystem/requested-repositories");
    assert.equal(catalog.status, 200);
    assert.ok(catalog.body.repositories.some((item) => item.repository === "colbymchenry/codegraph"));
    assert.ok(catalog.body.repositories.some((item) => item.repository === "microsoft/graphrag"));
    assert.ok(catalog.body.repositories.some((item) => item.repository === "NVIDIA/Model-Optimizer"));
    assert.equal(catalog.body.repositories.filter((item) => item.enabledInProduction).length, 0);

    const latest = await request(app).get("/research-lab/latest-screenshot-intake");
    assert.equal(latest.status, 200);
    assert.match(latest.text, /through Batch 24/i);
    assert.match(latest.text, /0 latest-intake repositories are enabled/i);

    const convergence = getUnifiedBatchConvergence();
    assert.equal(convergence.latestBatch, 24);
    assert.match(convergence.mode, /batch_1_24/i);
    assert.ok(convergence.batchSummaries.some((item) => item.batch === 24 && item.repositoryRecords === 12));
    assert.ok(convergence.repositories.some((item) => item.repository.toLowerCase() === "microsoft/graphrag" && item.seenInBatches.includes(24)));
    assert.equal(convergence.counts.productionExecutionAdded, 0);
  });
});
