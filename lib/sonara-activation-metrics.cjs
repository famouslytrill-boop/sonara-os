// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { activityEventDefinition } = require("./sonara-activity-taxonomy.cjs");

function validDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function summarizeActivation(rows = []) {
  const events = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      type: String(row?.event_type || "").trim().toLowerCase(),
      at: validDate(row?.created_at)
    }))
    .filter((event) => event.type && event.at)
    .sort((a, b) => a.at - b.at);

  const firstByType = new Map();
  for (const event of events) {
    if (!firstByType.has(event.type)) firstByType.set(event.type, event.at);
  }

  const workspaceAt = firstByType.get("account.organization_created") || null;
  const paidAt = firstByType.get("billing.purchase_completed") || null;
  const firstValueCandidates = events.filter((event) => activityEventDefinition(event.type)?.firstValue === true);
  const firstValueAt = firstValueCandidates[0]?.at || null;
  const firstValueEvent = firstValueCandidates[0]?.type || null;

  const productAreas = new Set();
  let metricEventCount = 0;
  for (const event of events) {
    const definition = activityEventDefinition(event.type);
    if (!definition?.metricEligible) continue;
    metricEventCount += 1;
    productAreas.add(definition.productArea);
  }

  const timeToFirstValueSeconds = workspaceAt && firstValueAt && firstValueAt >= workspaceAt
    ? Math.round((firstValueAt - workspaceAt) / 1000)
    : null;

  return Object.freeze({
    eventCount: events.length,
    metricEventCount,
    workspaceActivated: Boolean(workspaceAt),
    workspaceActivatedAt: workspaceAt?.toISOString() || null,
    firstValueReached: Boolean(firstValueAt),
    firstValueEvent,
    firstValueAt: firstValueAt?.toISOString() || null,
    timeToFirstValueSeconds,
    paidConversionReached: Boolean(paidAt),
    paidConversionAt: paidAt?.toISOString() || null,
    activeProductAreas: Object.freeze([...productAreas].sort())
  });
}

module.exports = { summarizeActivation };
