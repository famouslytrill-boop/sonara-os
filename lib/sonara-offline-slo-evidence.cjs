// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { SUITES, evaluateSuiteSloBurn } = require("./sonara-per-suite-slo-diagnostics.cjs");
const { classifyHttpJourney } = require("./sonara-cross-suite-reliability.cjs");

const MAX_OBSERVATIONS = 50000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const METHODS = new Set(["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]);

// Files of JSONL logs are NOT authenticated collectors. A perfectly parsed
// file can still omit requests or be forged. This offline tool must never page,
// authorize retries, or assert that the live platform is healthy.
function createOfflineSuiteSloAccumulator({ nowMs = Date.now() } = {}) {
  if (!Number.isSafeInteger(nowMs) || nowMs <= 0) throw TypeError("invalid_clock");
  const observations = [];
  const seen = new Set();
  const counts = { ignored: 0, invalid: 0, duplicates: 0,
    unmapped: 0, historical: 0, overflow: 0 };
  function invalid() { counts.invalid++; return false; }
  function add(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return invalid();
    if (record.event !== "http.request") { counts.ignored++; return true; }
    const d = record.detail;
    if (!d || typeof d !== "object" || Array.isArray(d) ||
        typeof record.ts !== "string" || !UTC_ISO.test(record.ts) ||
        !UUID.test(record.correlation || "") ||
        !Number.isInteger(d.status) || d.status < 100 || d.status > 599 ||
        typeof d.duration_ms !== "number" || !Number.isFinite(d.duration_ms) ||
        d.duration_ms < 0 || d.duration_ms > 600000 ||
        !METHODS.has(d.method) || typeof d.route !== "string" ||
        typeof d.product !== "string" || typeof d.journey !== "string" ||
        d.recovery_posture !== "diagnostics_only") return invalid();
    const timestampMs = Date.parse(record.ts);
    if (!Number.isSafeInteger(timestampMs) ||
        new Date(timestampMs).toISOString() !== record.ts ||
        timestampMs > nowMs + 5000) return invalid();
    const expectedOutcome = d.status >= 500 ? "failed" : d.status >= 400 ? "refused" : "ok";
    const expectedClass = d.status >= 500 ? "5xx" : d.status >= 400 ? "4xx" :
      d.status >= 300 ? "3xx" : "2xx";
    if (record.outcome !== expectedOutcome || record.reason !== expectedClass) return invalid();
    const declared = classifyHttpJourney(d.route, d.method);
    if (declared.suite !== d.product || declared.journey !== d.journey) return invalid();
    if (!SUITES.includes(declared.suite)) {
      counts.unmapped++;
      return false;
    }
    if (timestampMs <= nowMs - SIX_HOURS_MS) {
      counts.historical++;
      return true;
    }
    if (timestampMs > nowMs) return invalid();
    // Duplicate capture/transport should not falsely increase error counts.
    if (seen.has(record.correlation)) { counts.duplicates++; return false; }
    seen.add(record.correlation);
    if (observations.length >= MAX_OBSERVATIONS) { counts.overflow++; return false; }
    observations.push({ suite: declared.suite, ok: d.status < 500, timestampMs });
    return true;
  }
  function rejectMalformedLine() { counts.invalid++; }
  function report() {
    const result = evaluateSuiteSloBurn(observations, { nowMs });
    const completeParsing = counts.invalid === 0 && counts.duplicates === 0 &&
      counts.unmapped === 0 && counts.overflow === 0 &&
      result.status === "measured";
    return Object.freeze({
      schemaVersion: 1,
      source: "offline_unverified_server_log_copy",
      status: completeParsing ? "parsed_not_authenticated" : "incomplete_evidence",
      completeParsing,
      authoritativeCollectorContinuity: false,
      permittedAction: "diagnostics_only",
      operationalAlert: false,
      evaluatedAt: new Date(nowMs).toISOString(),
      relevantSamples: observations.length,
      counts: Object.freeze({ ...counts }),
      products: Object.freeze((result.products || []).map((r) => Object.freeze({
        suite: r.suite, status: r.status, reason: r.reason,
        sampleCount: r.sampleCount,
        candidateAlertFromUnverifiedEvidence: r.alert === true
      })))
    });
  }
  return Object.freeze({ add, rejectMalformedLine, report });
}
module.exports = { createOfflineSuiteSloAccumulator, MAX_OBSERVATIONS };
