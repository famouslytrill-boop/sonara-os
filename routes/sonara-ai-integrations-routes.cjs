// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  getPublicAIIntegrationCatalog
} = require("../lib/sonara-ai-integration-registry.cjs");
const { getModelEngineControlPlane } = require("../lib/sonara-model-engine-control-plane.cjs");
const { getAgentSkillStrategyCatalog } = require("../lib/sonara-agent-skill-strategies.cjs");
const { getUnifiedBatchConvergence } = require("../lib/sonara-batch-convergence-engine.cjs");
const { getSourceEvidenceRegister } = require("../lib/sonara-source-evidence-register.cjs");
const { getLearningMemoryControlPlane } = require("../lib/sonara-learning-memory-control-plane.cjs");
const { createRunner } = require("../lib/sonara-agent-runner.cjs");
const hostedModels = require("../lib/sonara-model-provider-router.cjs");

const BUSINESS_DRAFT_MAX_CHARS = 8000;
const BUSINESS_DRAFT_MAX_OUTPUT_TOKENS = 900;

module.exports = function registerSonaraAIIntegrationRoutes(app, deps = {}) {
  const modelProviders = deps.modelProviders || hostedModels;

  // The drafting handler still goes through SONARA's authority runner. The
  // action is `draft_content`, which is deliberately on the self-serve list:
  // this endpoint returns text for a person to review and does not send,
  // publish, bill, alter a record, or act on a customer account.
  const draftingRunner = createRunner();
  draftingRunner.register("draft_content", async ({ provider, prompt }) => modelProviders.generate({
    provider,
    maxTokens: BUSINESS_DRAFT_MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: "system",
        content:
          "You draft internal business material for SONARA Industries. Produce a draft only. " +
          "Do not claim that anything was sent, published, purchased, approved, filed, or changed. " +
          "Use only facts present in the user's prompt; label assumptions instead of inventing facts. " +
          "Do not request or reproduce passwords, API keys, card data, private keys, or access tokens."
      },
      { role: "user", content: prompt }
    ]
  }));

  app.get("/api/ecosystem/ai-integrations", (req, res) => {
    const integrations = getPublicAIIntegrationCatalog();
    res.status(200).json({
      ok: true,
      status: "cataloged",
      integrationCount: integrations.length,
      integrations
    });
  });

  app.get("/api/ecosystem/model-engines", (req, res) => {
    res.status(200).json(getModelEngineControlPlane());
  });

  app.get("/api/ecosystem/agent-skill-strategies", (req, res) => {
    res.status(200).json(getAgentSkillStrategyCatalog());
  });

  app.get("/api/ecosystem/batch-convergence", (req, res) => {
    res.status(200).json(getUnifiedBatchConvergence());
  });

  app.get("/api/ecosystem/source-evidence", (req, res) => {
    res.status(200).json(getSourceEvidenceRegister());
  });

  app.get("/api/ecosystem/learning-memory", (req, res) => {
    res.status(200).json(getLearningMemoryControlPlane());
  });

        };

module.exports.BUSINESS_DRAFT_MAX_CHARS = BUSINESS_DRAFT_MAX_CHARS;
module.exports.BUSINESS_DRAFT_MAX_OUTPUT_TOKENS = BUSINESS_DRAFT_MAX_OUTPUT_TOKENS;
