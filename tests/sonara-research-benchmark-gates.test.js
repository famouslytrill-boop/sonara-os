"use strict";

const assert = require("node:assert/strict");
const { SOURCES, inspectRanking, auditEvidencePacket, planResearchFormulaEvaluation, scoreCapabilityIdeas } = require("../lib/sonara-research-benchmark-gates.cjs");

function row(rank, name = "Company " + rank, sourceId = "us_revenue_2026") {
  return { rank, name, sourceUrl: SOURCES[sourceId].url };
}
function inspect(overrides = {}) {
  return inspectRanking({
    sourceId: "us_revenue_2026",
    observedAt: "2026-10-09",
    checkedAt: "2026-10-09",
    records: [row(1, "Amazon"), row(2, "Walmart")],
    ...overrides
  });
}
function idea(overrides = {}) {
  return {
    id: "read-only-inventory-forecast",
    title: "Explainable inventory forecast",
    owner: "Product owner",
    costCeilingUsd: 400,
    customerCommitments: 1,
    evidenceUrls: ["https://www.nist.gov/"],
    riskTags: ["read_only"],
    customerValue: 4, sharedReuse: 5, sourceQuality: 4,
    deliveryFeasibility: 3, costControl: 4, safetyReadiness: 5,
    ...overrides
  };
}

describe("SONARA source-grounded top-50 benchmark gates", () => {
  it("keeps source, edition, region, and metric independently identifiable", () => {
    assert.equal(Object.keys(SOURCES).length, 4);
    assert.equal(SOURCES.us_revenue_2026.region, "US");
    assert.equal(SOURCES.europe_revenue_2026.region, "Europe");
    assert.equal(SOURCES.global_revenue_2026.region, "Global");
    assert.equal(SOURCES.billionaires_realtime.metric, "estimated_net_worth");
    for (const source of Object.values(SOURCES)) {
      assert.equal(source.automatedIngestionAllowed, false);
      assert.equal(source.republicationRightsCleared, false);
    }
  });

  it("reports missing ranks without manufacturing the other 48", () => {
    const result = inspect();
    assert.equal(result.status, "incomplete_transcription");
    assert.equal(result.count, 2);
    assert.equal(result.missingRanks.length, 48);
    assert.equal(result.missingRanks[0], 3);
    assert.equal(result.canPublishAsOfficialTop50, false);
    assert.equal(result.republicationRightsCleared, false);
    assert.equal(result.automatedIngestionAllowed, false);
  });

  it("never converts a complete transcription into independent verification", () => {
    const result = inspect({ records: Array.from({length: 50}, (_, i) => row(i + 1)) });
    assert.equal(result.missingRanks.length, 0);
    assert.equal(result.status, "source_transcription_needs_audit");
    assert.equal(result.independentlyVerified, false);
    assert.equal(result.canPublishAsOfficialTop50, false);
  });

  it("rejects forged publisher URLs, repeated ranks, and duplicate organizations", () => {
    const result = inspect({ records: [
      row(1, "Amazon"),
      row(1, "Another"),
      row(2, "amazon"),
      { rank: 3, name: "False source", sourceUrl: "https://example.net/" },
      row(4, "Valid")
    ] });
    assert.deepEqual(result.entries.map(x => x.rank), [1, 4]);
    assert.equal(result.rejected.length, 3);
  });

  it("keeps realtime net-worth rankings freshness-limited", () => {
    const result = inspectRanking({
      sourceId: "billionaires_realtime",
      observedAt: "2026-10-01",
      checkedAt: "2026-10-09",
      records: [row(1, "Subject", "billionaires_realtime")]
    });
    assert.equal(result.status, "stale_source");
    assert.equal(result.canPublishAsOfficialTop50, false);
  });

  it("does not let staleness hide poisoned ranking rows", () => {
    const result = inspect({
      records: [
        row(1, "Valid"),
        { rank: 2, name: "=BAD()", sourceUrl: SOURCES.us_revenue_2026.url }
      ],
      observedAt: "2024-01-01",
      checkedAt: "2026-10-09"
    });
    assert.ok(result.ageDays > SOURCES.us_revenue_2026.maxSourceAgeDays);
    assert.equal(result.rejected.length, 1);
    assert.equal(result.status, "invalid_transcription");
    assert.equal(result.canPublishAsOfficialTop50, false);
  });

  it("rejects invalid dates, a future observation and invalid list sizes", () => {
    assert.throws(() => inspect({ observedAt: "2026-02-30" }), /real calendar/);
    assert.throws(() => inspect({ observedAt: "2026-10-10" }), /future/);
    assert.throws(() => inspect({ targetSize: 51 }), /targetSize/);
    assert.throws(() => inspect({ sourceId: "__proto__" }), /Unknown ranked source/);
  });

  it("scores research ideas but never authorizes production", () => {
    const results = scoreCapabilityIdeas([idea()]);
    assert.equal(results.length, 1);
    assert.equal(results[0].status, "independent_validation_required");
    assert.equal(results[0].evidenceIndependentlyVerified, false);
    assert.deepEqual(results[0].unrecognizedRiskTags, []);
    assert.ok(results[0].score100 > 0 && results[0].score100 <= 100);
    assert.equal(results[0].ownerApprovalRequired, true);
    assert.equal(results[0].productionAuthorized, false);
  });

  it("fails closed without verifiable sources, customers, owner and budget", () => {
    const result = scoreCapabilityIdeas([idea({
      owner: "", customerCommitments: 0, costCeilingUsd: -1,
      evidenceUrls: ["http://not-https.example/"]
    })])[0];
    assert.equal(result.status, "evidence_required");
    assert.deepEqual(result.missing, [
      "accountable_owner", "cost_ceiling", "customer_commitment", "traceable_evidence"
    ]);
  });

  it("sends risky high-scoring ideas to specialist review", () => {
    const result = scoreCapabilityIdeas([idea({
      riskTags: ["securities_advice"], customerValue: 5, sharedReuse: 5,
      sourceQuality: 5, deliveryFeasibility: 5, costControl: 5, safetyReadiness: 5
    })])[0];
    assert.equal(result.score100, 100);
    assert.equal(result.status, "specialist_and_owner_review");
    assert.equal(result.productionAuthorized, false);
  });

  it("rejects invalid rows even when ranks 1–50 are otherwise present", () => {
    const records = Array.from({ length: 50 }, (_, index) => row(index + 1));
    records.push({ rank: 51, name: "Injected", sourceUrl: "https://fake.invalid/" });
    const result = inspect({ records });
    assert.equal(result.missingRanks.length, 0);
    assert.equal(result.status, "invalid_transcription");
    assert.equal(result.rejected.length, 1);
    assert.equal(result.canPublishAsOfficialTop50, false);
  });

  it("unknown or mismatched financial risk tags cannot be classified as safe", () => {
    for (const tag of ["securitiesAdvice", "unknown_high_impact"]) {
      const result = scoreCapabilityIdeas([idea({ riskTags: [tag] })])[0];
      assert.equal(result.status, "specialist_and_owner_review");
      assert.deepEqual(result.unrecognizedRiskTags, [tag]);
      assert.equal(result.productionAuthorized, false);
    }
    const known = scoreCapabilityIdeas([idea({ riskTags: ["money_movement"] })])[0];
    assert.equal(known.status, "specialist_and_owner_review");
    assert.deepEqual(known.unrecognizedRiskTags, []);
  });

  it("supports low-impact research categories without treating links as verified evidence", () => {
    const result = scoreCapabilityIdeas([idea({ riskTags: ["read_only", "simulation_only"] })])[0];
    assert.equal(result.status, "independent_validation_required");
    assert.equal(result.evidenceIndependentlyVerified, false);
    assert.equal(result.productionAuthorized, false);
  });

  it("refuses malformed, duplicate and oversized risk classifications", () => {
    for (const riskTags of [null, [], ["read_only", "read_only"], Array(17).fill("read_only")]) {
      const result = scoreCapabilityIdeas([idea({ riskTags })])[0];
      assert.equal(result.status, "specialist_and_owner_review");
      assert.ok(result.missing.includes("risk_classification"));
      assert.equal(result.ownerApprovalRequired, true);
    }
  });


  it("rejects formula-like, invisible and bidirectional spoofing in ranking identities", () => {
    const result = inspect({ records: [
      row(1, "=HYPERLINK(\"https://bad.test\")"),
      row(2, " +CMD"),
      row(3, "\\u200bAmazon".replace("\\u200b", "\u200b")),
      row(4, "Acme\\u202e".replace("\\u202e", "\u202e")),
      row(5, "3M")
    ] });
    assert.deepEqual(result.entries.map((item) => item.name), ["3M"]);
    assert.equal(result.rejected.length, 4);
    assert.equal(result.status, "invalid_transcription");
  });

  it("returns an auditable claim graph without treating hyperlinks as verified", () => {
    const packet = auditEvidencePacket({
      reviewedAt: "2026-10-09",
      observations: [
        { claimId: "restaurant_demand", stance: "supports", observedAt: "2026-10-08", sourceUrl: "https://official.example/evidence" },
        { claimId: "restaurant_demand", stance: "supports", observedAt: "2026-10-09", sourceUrl: "https://standards.example/report" }
      ]
    });
    assert.equal(packet.overallStatus, "human_source_review_required");
    assert.equal(packet.claimCount, 1);
    assert.equal(packet.acceptedEvidenceCount, 2);
    assert.equal(packet.claims[0].supports, 2);
    assert.equal(packet.claims[0].sourceHostCount, 2);
    assert.equal(packet.claims[0].multipleObservationsFromOneHost, false);
    assert.equal(packet.claims[0].independentlyVerified, false);
    assert.equal(packet.claims[0].authorizedForPublication, false);
    assert.equal(packet.claims[0].authorizedForProduction, false);
    assert.equal(packet.authorizedForPublication, false);
    assert.equal(packet.authorizedForProduction, false);
  });

  it("flags same-host evidence concentration without inventing independent publishers", () => {
    const packet = auditEvidencePacket({
      reviewedAt: "2026-10-09",
      observations: [
        { claimId: "company_sales", stance: "supports",
          observedAt: "2026-10-08", sourceUrl: "https://www.publisher.example/a" },
        { claimId: "company_sales", stance: "supports",
          observedAt: "2026-10-09", sourceUrl: "https://publisher.example/b" }
      ]
    });
    assert.equal(packet.claimCount, 1);
    assert.equal(packet.claims[0].evidenceCount, 2);
    assert.equal(packet.claims[0].sourceHostCount, 1);
    assert.equal(packet.claims[0].multipleObservationsFromOneHost, true);
    assert.equal(packet.claims[0].independentlyVerified, false);
    assert.equal(packet.authorizedForPublication, false);
    assert.equal(packet.authorizedForProduction, false);
    assert.equal(Object.prototype.hasOwnProperty.call(packet.claims[0], "sourceHosts"), false);
  });

  it("isolates contradictions without concealing disagreement", () => {
    const packet = auditEvidencePacket({
      reviewedAt: "2026-10-09",
      observations: [
        { claimId: "demand", stance: "supports", observedAt: "2026-10-08", sourceUrl: "https://example.org/a" },
        { claimId: "demand", stance: "contradicts", observedAt: "2026-10-08", sourceUrl: "https://example.org/b" }
      ]
    });
    assert.equal(packet.overallStatus, "contradictions_found");
    assert.equal(packet.claims[0].status, "contradiction_review");
    assert.equal(packet.claims[0].contradicts, 1);
  });

  it("detects stale research and a claim with only contradictory evidence", () => {
    const packet = auditEvidencePacket({
      reviewedAt: "2026-10-09", maxAgeDays: 7,
      observations: [
        { claimId: "a_stale", stance: "supports", observedAt: "2026-08-01", sourceUrl: "https://example.org/a" },
        { claimId: "b_unsupported", stance: "contradicts", observedAt: "2026-10-09", sourceUrl: "https://example.org/b" }
      ]
    });
    assert.equal(packet.overallStatus, "unsupported_claims");
    assert.deepEqual(packet.claims.map((item) => item.status), ["stale_evidence", "unsupported_claim"]);
  });

  it("rejects hidden or customer-identifying fields in source receipts", () => {
    const packet = auditEvidencePacket({
      reviewedAt: "2026-10-09",
      observations: [
        { claimId: "service_cost", stance: "supports",
          sourceUrl: "https://example.org/a", observedAt: "2026-10-09",
          customerEmail: "someone@example.org" },
        { claimId: "service_cost", stance: "supports",
          sourceUrl: "https://example.org/b", observedAt: "2026-10-09" }
      ]
    });
    assert.equal(packet.overallStatus, "invalid_intake");
    assert.equal(packet.acceptedEvidenceCount, 1);
    assert.equal(packet.rejected.length, 1);
    assert.equal(JSON.stringify(packet).includes("someone@example.org"), false);
    assert.equal(packet.authorizedForProduction, false);
  });

  it("rejects duplicated, future-dated and malformed provenance receipts", () => {
    const valid = { claimId: "source_a", stance: "supports", observedAt: "2026-10-08", sourceUrl: "https://example.org/a" };
    const packet = auditEvidencePacket({
      reviewedAt: "2026-10-09",
      observations: [
        valid,
        { ...valid, stance: "contradicts" },
        { ...valid, claimId: "source_b", observedAt: "2026-10-10" },
        { ...valid, claimId: "source_c", sourceUrl: "http://example.org/c" },
        { ...valid, claimId: "__proto__", sourceUrl: "https://example.org/d" }
      ]
    });
    assert.equal(packet.overallStatus, "invalid_intake");
    assert.equal(packet.acceptedEvidenceCount, 1);
    assert.equal(packet.rejected.length, 4);
    assert.equal(packet.claimCount, 1);
  });

  it("rejects local, credentialed, oversized and malformed evidence URLs", () => {
    const unsafeUrls = [
      "https://localhost/private",
      "https://127.0.0.1/internal",
      "https://10.2.3.4/internal",
      "https://[::1]/internal",
      "https://internal.local/private",
      "https://user:secret@example.org/",
      "https://example.org\\\\@evil.com/path",
      "https://example.org/" + "a".repeat(2100),
      "https://example.org/\nmalicious"
    ];
    const packet = auditEvidencePacket({
      reviewedAt: "2026-10-09",
      observations: unsafeUrls.map((sourceUrl, index) => ({
        claimId: "unsafe_" + index, stance: "supports",
        observedAt: "2026-10-09", sourceUrl
      }))
    });
    assert.equal(packet.acceptedEvidenceCount, 0);
    assert.equal(packet.rejected.length, unsafeUrls.length);
    assert.equal(packet.overallStatus, "invalid_intake");
    assert.equal(packet.authorizedForProduction, false);
  });

  it("never treats an empty packet as independently verified", () => {
    const packet = auditEvidencePacket({ reviewedAt: "2026-10-09", observations: [] });
    assert.equal(packet.claimCount, 0);
    assert.equal(packet.overallStatus, "no_evidence");
    assert.equal(packet.independentlyVerified, false);
    assert.throws(() => auditEvidencePacket({ reviewedAt: "2026-10-09", maxAgeDays: 500, observations: [] }), /maxAgeDays/);
  });

  it("links a restaurant formula to canonical metadata without executing it", () => {
    const plan = planResearchFormulaEvaluation({
      formulaKey: "recipe_cost", claimId: "restaurant_menu_cost",
      reviewedAt: "2026-10-09",
      observations: [
        { claimId: "restaurant_menu_cost", stance: "supports",
          observedAt: "2026-10-09", sourceUrl: "https://example.org/restaurant-spec" }
      ]
    });
    assert.equal(plan.formula.key, "recipe_cost");
    assert.equal(plan.formula.domain, "restaurant");
    assert.equal(plan.formula.engineVersion.length > 0, true);
    assert.equal(plan.product, "business_builder");
    assert.equal(plan.evidenceStatus, "human_source_review_required");
    assert.equal(plan.evidenceCount, 1);
    assert.equal(plan.formulaEvaluated, false);
    assert.equal(plan.inputsVerified, false);
    assert.equal(plan.canUseForCustomerDecisions, false);
    assert.equal(plan.productionAuthorized, false);
    assert.equal(plan.publicationAuthorized, false);
    assert.equal(Object.prototype.hasOwnProperty.call(plan, "value"), false);
  });

  it("maps creator media formulas without duplicating runtime handlers", () => {
    const plan = planResearchFormulaEvaluation({
      formulaKey: "video_pacing", claimId: "edited_video_pacing",
      reviewedAt: "2026-10-09", observations: []
    });
    assert.equal(plan.product, "creator_studio");
    assert.equal(plan.formula.domain, "media");
    assert.equal(plan.claimStatus, "no_evidence");
    assert.equal(plan.evidenceStatus, "no_evidence");
    assert.equal(plan.evidenceCount, 0);
    assert.equal(plan.productionAuthorized, false);
  });

  it("blocks registered but non-research formulas, unknown keys and missing claim IDs", () => {
    const request = { formulaKey: "eoq", claimId: "inventory_quantity",
      reviewedAt: "2026-10-09", observations: [] };
    assert.throws(() => planResearchFormulaEvaluation({
      ...request, formulaKey: "security_risk"
    }), /allowlist/);
    assert.throws(() => planResearchFormulaEvaluation({
      ...request, formulaKey: "__proto__"
    }), /allowlist/);
    assert.throws(() => planResearchFormulaEvaluation({
      ...request, claimId: "Bad Claim!"
    }), /claimId/);
  });

  it("refuses mixed-claim research and unrequested customer input payloads", () => {
    const request = { formulaKey: "eoq", claimId: "inventory_quantity",
      reviewedAt: "2026-10-09",
      observations: [{ claimId: "another_claim", stance: "supports",
        observedAt: "2026-10-09", sourceUrl: "https://example.org/a" }]
    };
    assert.throws(() => planResearchFormulaEvaluation(request), /requested claimId/);
    assert.throws(() => planResearchFormulaEvaluation({
      ...request, observations: [], inputs: { customerName: "Sensitive" }
    }), /refuses formula inputs/);
    assert.throws(() => planResearchFormulaEvaluation({
      ...request, observations: Array(101).fill(0)
    }), /at most 100/);
    assert.throws(() => planResearchFormulaEvaluation(null), /request object/);
  });

  it("propagates contradictory evidence into an unapproved formula plan", () => {
    const plan = planResearchFormulaEvaluation({
      formulaKey: "little_law", claimId: "queue_size",
      reviewedAt: "2026-10-09",
      observations: [
        { claimId: "queue_size", stance: "supports",
          observedAt: "2026-10-08", sourceUrl: "https://example.org/a" },
        { claimId: "queue_size", stance: "contradicts",
          observedAt: "2026-10-09", sourceUrl: "https://different.example/b" }
      ]
    });
    assert.equal(plan.evidenceStatus, "contradictions_found");
    assert.equal(plan.claimStatus, "contradiction_review");
    assert.equal(plan.canUseForCustomerDecisions, false);
  });

  it("rejects malformed, stale and inaccessible provenance as calculation evidence", () => {
    const base = { formulaKey: "eoq", claimId: "inventory_quantity",
      reviewedAt: "2026-10-09", maxAgeDays: 7 };
    const stale = planResearchFormulaEvaluation({
      ...base, observations: [{ claimId: "inventory_quantity", stance: "supports",
        observedAt: "2026-09-01", sourceUrl: "https://example.org/old" }]
    });
    assert.equal(stale.evidenceStatus, "stale_evidence");
    const invalid = planResearchFormulaEvaluation({
      ...base, observations: [{ claimId: "inventory_quantity", stance: "supports",
        observedAt: "2026-10-09", sourceUrl: "http://localhost/admin" }]
    });
    assert.equal(invalid.evidenceStatus, "invalid_intake");
    assert.equal(invalid.evidenceCount, 0);
    assert.equal(invalid.productionAuthorized, false);
  });

  it("reports invalid ranking rows, age and missing ranks at the same time", () => {
    const result = inspect({
      observedAt: "2024-01-01", checkedAt: "2026-10-09",
      records: [
        row(1, "Valid One"),
        { rank: 2, name: "Valid Two", sourceUrl: SOURCES.us_revenue_2026.url,
          customerEmail: "do-not-collect@example.org" }
      ]
    });
    assert.equal(result.status, "invalid_transcription");
    assert.deepEqual(result.issueCodes, [
      "invalid_transcription", "stale_source", "incomplete_transcription"
    ]);
    assert.equal(result.rejected.length, 1);
    assert.equal(result.entries.length, 1);
    assert.equal(JSON.stringify(result).includes("do-not-collect@example.org"), false);
    assert.equal(result.timestampProvenance, "caller_supplied_unverified");
    assert.equal(result.canPublishAsOfficialTop50, false);
  });

  it("keeps all contradictory, stale, invalid and unsupported evidence blockers", () => {
    const packet = auditEvidencePacket({
      reviewedAt: "2026-10-09", maxAgeDays: 7,
      observations: [
        { claimId: "alpha", stance: "supports", observedAt: "2026-09-01",
          sourceUrl: "https://example.org/a" },
        { claimId: "alpha", stance: "contradicts", observedAt: "2026-10-09",
          sourceUrl: "https://another.example.org/b" },
        { claimId: "beta", stance: "contradicts", observedAt: "2026-10-09",
          sourceUrl: "https://third.example.org/c" },
        { claimId: "gamma", stance: "supports", observedAt: "2026-10-09",
          sourceUrl: "http://localhost/private" }
      ]
    });
    assert.equal(packet.overallStatus, "invalid_intake");
    assert.deepEqual(packet.issueCodes, [
      "invalid_intake", "contradictions_found", "unsupported_claims", "stale_evidence"
    ]);
    assert.equal(packet.timestampProvenance, "caller_supplied_unverified");
    assert.equal(packet.authorizedForPublication, false);
    assert.equal(packet.authorizedForProduction, false);
  });

  it("carries every issue to the formula plan without granting authority", () => {
    const plan = planResearchFormulaEvaluation({
      formulaKey: "eoq", claimId: "reorder_evidence",
      reviewedAt: "2026-10-09", maxAgeDays: 7,
      observations: [
        { claimId: "reorder_evidence", stance: "supports",
          observedAt: "2026-08-01", sourceUrl: "https://example.org/one" },
        { claimId: "reorder_evidence", stance: "contradicts",
          observedAt: "2026-10-09", sourceUrl: "https://example.net/two" }
      ]
    });
    assert.equal(plan.evidenceStatus, "contradictions_found");
    assert.ok(plan.blockingReasons.includes("contradictions_found"));
    assert.ok(plan.blockingReasons.includes("stale_evidence"));
    assert.ok(plan.blockingReasons.includes("formula_inputs_and_units_unverified"));
    assert.equal(plan.timestampProvenance, "caller_supplied_unverified");
    assert.equal(plan.formulaEvaluated, false);
    assert.equal(plan.productionAuthorized, false);
  });

  it("requires independent human audit even for an otherwise complete clean ranking", () => {
    const result = inspect({
      targetSize: 2,
      records: [row(1, "Company A"), row(2, "Company B")]
    });
    assert.deepEqual(result.issueCodes, []);
    assert.equal(result.status, "source_transcription_needs_audit");
    assert.equal(result.independentlyVerified, false);
    assert.equal(result.canPublishAsOfficialTop50, false);
  });

  it("prevents invalid numeric inputs and duplicated project ids", () => {
    assert.throws(() => scoreCapabilityIdeas([idea({ safetyReadiness: NaN })]), /safetyReadiness/);
    assert.throws(() => scoreCapabilityIdeas([idea(), idea()]), /unique id/);
    assert.throws(() => scoreCapabilityIdeas([idea({ customerValue: 6 })]), /customerValue/);
  });
});
