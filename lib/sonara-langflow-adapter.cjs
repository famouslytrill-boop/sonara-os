"use strict";

// Langflow — visual agent flows, run from this server.
//
// MIT, verified from the repository. An owner builds a flow in Langflow's own
// interface and this calls it by id, which is the division of labour that makes
// it worth adapting: the flow is theirs to change without a deploy here.
//
// Readiness, timeouts and the loopback-on-serverless check come from
// lib/sonara-service-adapter.cjs. This file owns the call shape and one rule of
// its own, below.

const base = require("./sonara-service-adapter.cjs");

const LABEL = "Langflow";
const PREFIX = "SONARA_LANGFLOW";

const ENV_KEYS = base.envKeysFor(PREFIX, ["flow"]);

function getLangflowReadiness(options = {}) {
  return base.readinessFor({ label: LABEL, prefix: PREFIX, required: ["flow"], ...options });
}

// A flow id goes into the request path, so it is checked rather than
// interpolated. A value containing a slash or a dot-dot would address a
// different endpoint on the same host, which is a request this server would be
// making on the owner's behalf with the owner's credentials.
const FLOW_ID = /^[A-Za-z0-9_-]{1,120}$/;

/**
 * Run a flow with one input.
 *
 * Returns { ok: true, text } or { ok: false, code, detail }. Never throws, and
 * a caller must have a deterministic path for the false case.
 */
async function runFlow(input, { readiness = getLangflowReadiness(), fetchImpl = fetch } = {}) {
  const text = String(input == null ? "" : input).trim();
  if (!text) return { ok: false, code: "empty_input", detail: "Nothing was sent to the flow." };

  if (readiness.status === "configured" && !FLOW_ID.test(String(readiness.flow || ""))) {
    return { ok: false, code: "invalid_flow_id", detail: `${ENV_KEYS.flow} must be a plain id — letters, numbers, dashes and underscores.` };
  }

  const called = await base.postJson(
    readiness,
    `/api/v1/run/${readiness.flow}?stream=false`,
    { input_value: text, output_type: "chat", input_type: "chat" },
    { fetchImpl }
  );
  if (!called.ok) return called;

  // Langflow nests its answer several levels down and the shape varies by
  // output type. Each step is optional-chained rather than assumed, because a
  // shape change should read as "no answer" and not throw on a page.
  const answer = String(
    called.data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text ||
    called.data?.outputs?.[0]?.outputs?.[0]?.results?.message?.data?.text ||
    ""
  ).trim();

  if (!answer) return { ok: false, code: "empty_response", detail: "The flow ran and returned no text." };
  return { ok: true, text: answer, flow: readiness.flow };
}

module.exports = { ENV_KEYS, FLOW_ID, getLangflowReadiness, runFlow };
