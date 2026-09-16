"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const {
  AGENT_PATTERNS,
  BUSINESS_AI_SKILLS,
  VERIFIED_MODEL_PROFILES,
  SKILL_STRATEGIES,
  getAgentSkillStrategyCatalog
} = require("../lib/sonara-agent-skill-strategies.cjs");

describe("agent execution patterns and business AI control plane", () => {
  it("publishes five bounded execution patterns without granting runtime authority", () => {
    assert.deepEqual(AGENT_PATTERNS.map((item) => item.key), [
      "single_shot",
      "iterative_react",
      "planner_executor",
      "reflexive",
      "verifier_gated"
    ]);
    assert.ok(AGENT_PATTERNS.every((item) => item.canExecuteFromRecord === false));
    assert.ok(AGENT_PATTERNS.every((item) => item.humanReviewRequired === true));
    assert.equal(AGENT_PATTERNS.find((item) => item.key === "verifier_gated").independentVerificationRequired, true);
    assert.equal(AGENT_PATTERNS.find((item) => item.key === "single_shot").toolLoopAllowed, false);
  });

  it("maps all ten business AI capability groups across SONARA products", () => {
    assert.equal(BUSINESS_AI_SKILLS.length, 10);
    assert.ok(BUSINESS_AI_SKILLS.every((item) => item.canExecuteFromRecord === false));
    assert.ok(BUSINESS_AI_SKILLS.some((item) => item.key === "context_engineering"));
    assert.ok(BUSINESS_AI_SKILLS.some((item) => item.key === "rag_business_knowledge"));
    assert.ok(BUSINESS_AI_SKILLS.some((item) => item.key === "ai_evaluation"));
    assert.ok(BUSINESS_AI_SKILLS.some((item) => item.key === "multimodal_ai"));
    assert.ok(BUSINESS_AI_SKILLS.some((item) => item.products.includes("Business Builder")));
    assert.ok(BUSINESS_AI_SKILLS.some((item) => item.products.includes("Creator Studio")));
    assert.ok(BUSINESS_AI_SKILLS.some((item) => item.products.includes("Growth Studio")));
  });

  it("records GPT-6 Astra only as verified configuration metadata", () => {
    const astra = VERIFIED_MODEL_PROFILES.find((item) => item.key === "openai_gpt_6_astra");
    assert.ok(astra);
    assert.equal(astra.provider, "openai");
    assert.equal(astra.model, "gpt-6-astra");
    assert.equal(astra.apiSurface, "Responses API");
    assert.deepEqual(astra.reasoningEffort, ["low", "medium", "high", "xhigh", "max"]);
    assert.equal(astra.integrationState, "configuration_profile_only");
    assert.equal(astra.enabledByRecord, false);
    assert.equal(astra.canExecuteFromRecord, false);
    assert.doesNotMatch(JSON.stringify(astra), /OPENAI_API_KEY|Bearer\s+[A-Za-z0-9_-]+/);
  });

  it("extends the existing strategy catalog without weakening its authorization boundary", () => {
    const catalog = getAgentSkillStrategyCatalog();
    assert.equal(catalog.agentArchitecture.patternCount, 5);
    assert.equal(catalog.businessAI.skillCount, 10);
    assert.equal(catalog.verifiedModelProfiles.length, 1);
    assert.equal(catalog.strategyCount, SKILL_STRATEGIES.length);
    assert.ok(SKILL_STRATEGIES.some((item) => item.key === "agent_execution_pattern_routing"));
    assert.ok(SKILL_STRATEGIES.some((item) => item.key === "business_ai_capability_delivery"));
    assert.match(catalog.businessAI.publicClaimPolicy, /must not be marketed as live/i);
    assert.ok(catalog.boundaries.some((item) => /tenant isolation/i.test(item)));
  });

  it("exposes the new metadata through the existing public non-secret ecosystem endpoint", async () => {
    const response = await request(app)
      .get("/api/ecosystem/agent-skill-strategies")
      .set("Accept", "application/json");

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.agentArchitecture.patternCount, 5);
    assert.equal(response.body.businessAI.skillCount, 10);
    assert.equal(response.body.verifiedModelProfiles[0].model, "gpt-6-astra");
    assert.doesNotMatch(response.text, /OPENAI_API_KEY|service-role|Bearer\s+[A-Za-z0-9_-]+/i);
  });
});
