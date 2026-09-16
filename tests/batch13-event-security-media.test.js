"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SCREENSHOT_TOOL_RADAR_BATCH13,
  NON_REPOSITORY_REFERENCES_BATCH13,
  getScreenshotToolReadinessBatch13
} = require("../lib/sonara-screenshot-tool-radar-batch13.cjs");
const {
  EVENT_TOPICS,
  DELIVERY_POLICY,
  createAgentEvent,
  validateAgentEvent,
  canDispatch,
  nextDeliveryDecision,
  telemetryView
} = require("../lib/sonara-event-driven-agent-contract.cjs");
const {
  createLlmObservation,
  validateLlmObservation,
  createGoldenDatasetCase,
  scoreGoldenDatasetRun,
  aggregateObservations
} = require("../lib/sonara-llm-observability-contract.cjs");

describe("Batch 13 governed external-tool intake", () => {
  it("keeps every external repository non-executing", () => {
    const readiness = getScreenshotToolReadinessBatch13();
    assert.equal(readiness.batch, 13);
    assert.equal(readiness.repositoryCount, 4);
    assert.equal(readiness.verifiedCount, 4);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.equal(readiness.nonRepositoryReferenceCount, 2);
    assert.ok(readiness.repositories.every((item) => item.enabledInProduction === false));
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
  });

  it("records the verified upstreams and the important license correction", () => {
    const byKey = Object.fromEntries(SCREENSHOT_TOOL_RADAR_BATCH13.map((item) => [item.key, item]));
    assert.equal(byKey.openosint.repository, "OpenOSINT/OpenOSINT");
    assert.equal(byKey.pinchtab.repository, "pinchtab/pinchtab");
    assert.match(byKey.pinchtab.license, /MIT.*screenshot showed Apache-2\.0/i);
    assert.equal(byKey.openshorts.repository, "mutonby/openshorts");
    assert.match(byKey.openshorts.license, /core.*MIT.*cloud.*Commercial License.*NOASSERTION/i);
    assert.equal(byKey.every_programmer_should_know.license, "CC-BY-4.0");
  });

  it("makes security, browser and media boundaries explicit", () => {
    const byKey = Object.fromEntries(SCREENSHOT_TOOL_RADAR_BATCH13.map((item) => [item.key, item]));
    assert.match(byKey.openosint.blockedUses.join(" "), /unauthorized reconnaissance|credential/i);
    assert.match(byKey.pinchtab.blockedUses.join(" "), /stealth|fingerprint|bot protections|access controls/i);
    assert.match(byKey.openshorts.blockedUses.join(" "), /unlicensed media|voice|likeness|social publishing|cloud/i);
    assert.equal(byKey.pinchtab.integrationStatus, "research_only");
    assert.equal(byKey.openshorts.integrationStatus, "research_only");
  });

  it("keeps the uploaded architecture sources as non-repository references", () => {
    assert.equal(NON_REPOSITORY_REFERENCES_BATCH13.length, 2);
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH13.every((item) => !Object.hasOwn(item, "repository")));
    assert.match(NON_REPOSITORY_REFERENCES_BATCH13.map((item) => item.observedTheme).join(" "), /event-driven.*observability/i);
  });

  it("adds a public research page without claiming production enablement", () => {
    const page = fs.readFileSync(path.join(__dirname, "../public/research-lab/batch13-event-security-media.html"), "utf8");
    assert.match(page, /Third-party repositories enabled by this research page:\s*<strong>0<\/strong>/i);
    assert.match(page, /Stealth, fingerprint evasion, CAPTCHA bypass/i);
    assert.match(page, /Raw prompts, raw responses, and secrets are excluded by default/i);
  });
});

describe("event-driven agent contract", () => {
  function base(overrides = {}) {
    return {
      organizationId: "org_test",
      actorId: "user_test",
      producer: "test-worker",
      topic: EVENT_TOPICS.COMMANDS,
      kind: "agent.command.requested",
      action: "summarize_document",
      payload: { documentId: "doc_123" },
      provenance: { sourceType: "upload", sourceId: "doc_123", userProvided: true, licensedOrOwned: true },
      ...overrides
    };
  }

  it("requires tenant-scoped, idempotent, replayable event metadata", () => {
    const event = createAgentEvent(base());
    assert.equal(validateAgentEvent(event).ok, true);
    assert.equal(event.organizationId, "org_test");
    assert.match(event.idempotencyKey, /^evt_[a-f0-9]{32}$/);
    assert.equal(DELIVERY_POLICY.idempotencyRequired, true);
    assert.equal(DELIVERY_POLICY.replaySupported, true);
    assert.equal(DELIVERY_POLICY.deadLetterAfterMaxAttempts, true);
  });

  it("blocks consequential actions until matching owner approval exists", () => {
    const event = createAgentEvent(base({ action: "launch_customer_campaign" }));
    assert.equal(event.authority, "owner_review");
    assert.equal(canDispatch(event).ok, false);
    assert.equal(canDispatch(event).reason, "owner_approval_required");
    assert.equal(canDispatch(event, {
      status: "approved",
      eventId: event.eventId,
      organizationId: event.organizationId,
      approvedBy: "owner_1"
    }).ok, true);
  });

  it("rejects secret-bearing payload fields", () => {
    assert.throws(() => createAgentEvent(base({ payload: { nested: { api_key: "should-not-be-here" } } })), /forbidden secret fields/i);
  });

  it("removes payload content from telemetry", () => {
    const event = createAgentEvent(base());
    const telemetry = telemetryView(event);
    assert.equal(telemetry.payloadIncluded, false);
    assert.equal(Object.hasOwn(telemetry, "payload"), false);
  });

  it("dead-letters after the retry budget", () => {
    const event = createAgentEvent(base({ attempt: DELIVERY_POLICY.maxDeliveryAttempts }));
    const decision = nextDeliveryDecision(event, Object.assign(new Error("boom"), { code: "WORKER_FAILED" }));
    assert.equal(decision.action, "dead_letter");
    assert.equal(decision.topic, EVENT_TOPICS.DEAD_LETTER);
    assert.equal(decision.replayable, true);
  });
});

describe("provider-neutral LLM observability contract", () => {
  function observation(overrides = {}) {
    return createLlmObservation({
      traceId: "trace_1",
      spanId: "span_1",
      organizationId: "org_test",
      operation: "provider_gateway.generate",
      provider: "reviewed-provider",
      model: "reviewed-model",
      outcome: "ok",
      durationMs: 240,
      inputTokens: 100,
      outputTokens: 40,
      costMicros: 2500,
      providerCalled: true,
      promptTemplateId: "support_summary_v1",
      sourceRefs: ["source_1"],
      evaluations: { relevanceScore: 0.9, groundednessScore: 0.8, hallucinationRiskScore: 0.1 },
      tags: { surface: "business_builder" },
      ...overrides
    });
  }

  it("captures cost, latency and evaluation metadata without raw content", () => {
    const record = observation();
    assert.equal(validateLlmObservation(record).ok, true);
    assert.equal(record.rawPromptStored, false);
    assert.equal(record.rawResponseStored, false);
    assert.equal(record.secretMaterialStored, false);
    assert.equal(record.costMicros, 2500);
    assert.equal(record.evaluations.relevanceScore, 0.9);
  });

  it("supports golden-dataset regression checks", () => {
    const testCase = createGoldenDatasetCase({
      caseId: "case_1",
      promptTemplateId: "support_summary_v1",
      expectedBehavior: "Summarize the supplied source without inventing facts.",
      policyExpectation: "No secret disclosure.",
      edgeCase: true,
      referenceSourceIds: ["source_1"]
    });
    assert.equal(testCase.productionInput, false);
    const passing = scoreGoldenDatasetRun(testCase, { behaviorMatched: true, policyMatched: true, grounded: true, noSecretLeak: true });
    assert.equal(passing.passed, true);
    const failing = scoreGoldenDatasetRun(testCase, { behaviorMatched: true, policyMatched: true, grounded: false, noSecretLeak: true });
    assert.equal(failing.passed, false);
  });

  it("aggregates operational metrics without conversation content", () => {
    const summary = aggregateObservations([
      observation(),
      observation({ spanId: "span_2", outcome: "error", durationMs: 360, costMicros: 1000 })
    ]);
    assert.equal(summary.calls, 2);
    assert.equal(summary.averageDurationMs, 300);
    assert.equal(summary.totalCostMicros, 3500);
    assert.equal(summary.errorRate, 0.5);
  });
});
