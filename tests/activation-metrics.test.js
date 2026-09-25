// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { summarizeActivation } = require("../lib/sonara-activation-metrics.cjs");

describe("activation metrics", () => {
  it("computes time to first value from real declared milestones", () => {
    const summary = summarizeActivation([
      { event_type: "account.organization_created", created_at: "2026-09-23T10:00:00.000Z" },
      { event_type: "business_builder.intake_created", created_at: "2026-09-23T10:03:00.000Z" },
      { event_type: "creator_studio.output_downloaded", created_at: "2026-09-23T10:15:30.000Z" },
      { event_type: "billing.purchase_completed", created_at: "2026-09-23T10:20:00.000Z" }
    ]);
    assert.equal(summary.workspaceActivated, true);
    assert.equal(summary.firstValueReached, true);
    assert.equal(summary.firstValueEvent, "creator_studio.output_downloaded");
    assert.equal(summary.timeToFirstValueSeconds, 930);
    assert.equal(summary.paidConversionReached, true);
    assert.deepEqual(summary.activeProductAreas, ["business_builder", "creator_studio", "sonara_one"]);
  });

  it("does not treat engagement or unknown operational logs as first value", () => {
    const summary = summarizeActivation([
      { event_type: "account.organization_created", created_at: "2026-09-23T10:00:00.000Z" },
      { event_type: "business_builder.checklist_updated", created_at: "2026-09-23T10:01:00.000Z" },
      { event_type: "future.feature_used", created_at: "2026-09-23T10:02:00.000Z" }
    ]);
    assert.equal(summary.firstValueReached, false);
    assert.equal(summary.timeToFirstValueSeconds, null);
    assert.equal(summary.metricEventCount, 1);
  });

  it("sorts events before choosing first value and ignores invalid timestamps", () => {
    const summary = summarizeActivation([
      { event_type: "growth_studio.conversion_recorded", created_at: "2026-09-23T11:00:00.000Z" },
      { event_type: "account.organization_created", created_at: "2026-09-23T10:00:00.000Z" },
      { event_type: "creator_studio.output_downloaded", created_at: "not-a-date" }
    ]);
    assert.equal(summary.firstValueEvent, "growth_studio.conversion_recorded");
    assert.equal(summary.timeToFirstValueSeconds, 3600);
  });
});
