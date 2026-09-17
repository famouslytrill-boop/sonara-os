const request = require("supertest");
const assert = require("assert");
const app = require("../server");
const { getManifest, getAllManifestTables } = require("../lib/sonara-ecosystem-manifest.cjs");
const { DATABASE_TABLES } = require("../lib/sonara-database-contract.cjs");
const { getMarketExpansionRegistry } = require("../lib/sonara-market-expansion-registry.cjs");
const { getMarketExpansionSchemaPlan } = require("../lib/sonara-market-expansion-schema-plan.cjs");
const { getIndustryAlgorithmExpansion } = require("../lib/sonara-industry-algorithm-expansion.cjs");
const { getThirdSearchConvergence } = require("../lib/sonara-third-search-convergence.cjs");
const { readOpenSourceTools } = require("../lib/sonara-open-source-registry.cjs");

describe("SONARA ecosystem manifest", () => {
  it("contains the parent company and three current companies", function() {
    const manifest = getManifest();
    assert.equal(manifest.parentCompany.name, "SONARA Industries");
    assert.equal(manifest.currentCompanies.length, 3);
    assert.ok(manifest.currentCompanies.some((company) => company.key === "business_builder"));
    assert.ok(manifest.currentCompanies.some((company) => company.key === "creator_studio"));
    assert.ok(manifest.currentCompanies.some((company) => company.key === "growth_studio"));
  });

  it("contains required database table references", function() {
    const tables = getAllManifestTables();
    assert.ok(tables.includes("profiles"));
    assert.ok(tables.includes("organizations"));
    assert.ok(tables.includes("billing_webhook_events"));
    assert.ok(tables.includes("sonara_formula_definitions"));
    assert.ok(tables.includes("sonara_platform_pages"));
    assert.ok(tables.includes("audio_transcription_segments"));
    for (const table of tables.filter((name) => !name.includes("."))) {
      assert.ok(DATABASE_TABLES.includes(table), `${table} must be part of the canonical database contract`);
    }
  });

  it("classifies September market expansion without granting execution authority", function() {
    const expansion = getMarketExpansionRegistry();
    assert.ok(expansion.counts.capabilities >= 20);
    assert.ok(expansion.counts.industryPacks >= 5);
    assert.ok(expansion.counts.standaloneSkus >= 5);
    assert.equal(expansion.authority, "planning_and_control_plane_only_unless_existing_is_explicitly_listed");
    assert.ok(expansion.capabilities.some((item) => item.key === "interactive-media-studio"));
    assert.ok(expansion.capabilities.some((item) => item.key === "local-ai-visibility"));
    assert.ok(expansion.capabilities.some((item) => item.key === "field-mode"));
    assert.ok(expansion.capabilities.some((item) => item.key === "extension-marketplace"));
    assert.ok(expansion.capabilities.some((item) => item.key === "agentic-commerce-distribution" && item.status === "research_only"));
    assert.ok(expansion.capabilities.some((item) => item.key === "payroll-tax-banking-rails" && item.status === "do_not_rebuild"));
  });

  it("uses a reuse-first schema plan before new market-expansion migrations", function() {
    const plan = getMarketExpansionSchemaPlan();
    assert.ok(plan.count >= 10);
    assert.equal(plan.mode, "reuse_first_non_executing_schema_plan");
    assert.ok(plan.contracts.some((item) => item.concept === "offline mutation queue" && item.decision === "planned_new_table"));
    assert.ok(plan.contracts.some((item) => item.concept === "unified conversation inbox" && item.decision === "projection_preferred"));
    assert.ok(plan.contracts.some((item) => item.concept === "industry pack installation" && item.decision === "no_new_table_initially"));
    assert.ok(plan.contracts.some((item) => item.concept === "private creator/community spaces and live review rooms" && item.decision === "extend_existing_first"));
  });

  it("converges the third search without turning research into runtime authority", function() {
    const convergence = getThirdSearchConvergence();
    assert.equal(convergence.authority, "research_and_source_convergence_only");
    assert.equal(convergence.inventory.governedRepositoryRecords, readOpenSourceTools().length);
    assert.equal(convergence.inventory.sharedAgentStrategies, 11);
    assert.equal(convergence.inventory.sourceEvidenceRecords, 14);
    assert.ok(convergence.inventory.deterministicFormulas >= 30);
    assert.equal(convergence.deliveryFoundation.sourceStatus, "implemented_in_source_pending_controlled_migration");
    assert.deepEqual(convergence.deliveryFoundation.tables, [
      "event_outbox",
      "event_delivery_attempts",
      "llm_observations",
      "agent_evaluation_runs"
    ]);
    assert.equal(convergence.deliveryFoundation.workerStatus, "not_enabled");
    assert.ok(convergence.creatorGrowthCommons.existing.includes("creator_follows"));
    assert.ok(convergence.creatorGrowthCommons.existing.includes("call_sessions"));
    assert.match(convergence.creatorGrowthCommons.federationDecision, /not enabled/i);
    assert.ok(convergence.explicitlyDeferred.some((item) => item.key === "biometric_database" && item.decision === "do_not_build"));
    assert.ok(convergence.explicitlyDeferred.some((item) => item.key === "wifi_credentials" && item.decision === "not_a_product_feature"));
    assert.ok(convergence.marketArchetypes.every((item) => item.claimType.startsWith("strategy_inference")));
    const sourceKeys = new Set(convergence.primarySources.map((item) => item.key));
    assert.ok(convergence.marketArchetypes.every((item) => item.evidenceKeys.every((key) => sourceKeys.has(key))));
    assert.ok(convergence.primarySources.every((item) => item.url.startsWith("https://")));
    assert.ok(convergence.primarySources.every((item) => item.readAt === "2026-09-17"));
  });

  it("maps broad industries, formulas, algorithms and open-source candidates without granting runtime authority", function() {
    const plan = getIndustryAlgorithmExpansion();
    assert.equal(plan.authority, "non_executing_strategy_and_formula_registry");
    assert.ok(plan.counts.industries >= 15);
    assert.ok(plan.counts.formulas >= 30);
    assert.ok(plan.counts.algorithms >= 15);
    assert.ok(plan.counts.openSourceCandidates >= 20);
    assert.ok(plan.industries.some((item) => item.key === "logistics_trucking_fleet"));
    assert.ok(plan.industries.some((item) => item.key === "manufacturing_supply_chain_iot"));
    assert.ok(plan.industries.some((item) => item.key === "construction_trades_field_service"));
    assert.ok(plan.industries.some((item) => item.key === "health_wellness_interoperability" && item.priority === "partner_only"));
    assert.ok(plan.industries.some((item) => item.key === "trading_investment_research" && item.priority === "research_only"));
    assert.ok(plan.formulas.some((item) => item.key === "oee"));
    assert.ok(plan.formulas.some((item) => item.key === "route_cost"));
    assert.ok(plan.algorithms.some((item) => item.key === "constraint_solver"));
    assert.ok(plan.algorithms.some((item) => item.key === "genetic" && item.reproducibility === "stochastic_reproducible_only_with_seed"));
    assert.ok(plan.openSourceCandidates.some((item) => item.key === "fleetbase" && item.licenseClass === "agpl_3_or_commercial_license"));
  });
});

describe("SONARA ecosystem routes", () => {
  it("GET /ecosystem returns the public ecosystem page", async function() {
    const res = await request(app).get("/ecosystem").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /SONARA Ecosystem/);
    assert.match(res.text, /Business Builder/);
    assert.match(res.text, /Creator Studio/);
    assert.match(res.text, /Growth Studio/);
    assert.match(res.text, /Market and product expansion/);
    assert.match(res.text, /Industry and deterministic engine expansion/);
    assert.match(res.text, /Third-search convergence/);
  });

  it("GET /api/ecosystem/manifest returns the manifest and expansion registries", async function() {
    const res = await request(app).get("/api/ecosystem/manifest").set("Accept", "application/json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.manifest.parentCompany.name, "SONARA Industries");
    assert.equal(res.body.manifest.currentCompanies.length, 3);
    assert.ok(res.body.manifest.marketExpansion.counts.capabilities >= 20);
    assert.ok(res.body.manifest.marketExpansion.capabilities.some((item) => item.key === "restaurant-operations-pack"));
    assert.ok(res.body.manifest.marketExpansionSchemaPlan.count >= 10);
    assert.ok(res.body.manifest.industryAlgorithmExpansion.counts.industries >= 15);
    assert.ok(res.body.manifest.industryAlgorithmExpansion.counts.formulas >= 30);
    assert.equal(res.body.manifest.thirdSearchConvergence.deliveryFoundation.tables.length, 4);
    assert.equal(res.body.manifest.thirdSearchConvergence.deliveryFoundation.workerStatus, "not_enabled");
  });

  it("GET /api/ecosystem/readiness returns table and expansion readiness", async function() {
    const res = await request(app).get("/api/ecosystem/readiness").set("Accept", "application/json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.tables));
    assert.ok(res.body.tables.some((item) => item.table === "profiles"));
    assert.ok(res.body.expansionCapabilityCount >= 20);
    assert.ok(res.body.expansionSchemaContractCount >= 10);
    assert.ok(res.body.industryExpansionCount >= 15);
    assert.ok(res.body.formulaExpansionCount >= 30);
    assert.ok(res.body.algorithmExpansionCount >= 15);
    assert.equal(res.body.durableEventFoundationTableCount, 4);
    assert.ok(res.body.thirdSearchPriorityCount >= 5);
  });
});
