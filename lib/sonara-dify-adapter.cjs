"use strict";

// Dify — runs a workflow the owner built, from this server.
//
// ## The licence review this was waiting on
//
// Read from the repository's LICENSE on 12 August 2026 rather than recalled.
// A modified Apache 2.0 with two added conditions:
//
//   Multi-tenant. "You may not use the Dify source code to operate a
//   multi-tenant environment" without written authorization and a commercial
//   licence.
//
//   Branding. "You may not remove or modify the LOGO or copyright information
//   in the Dify console or applications", which does not apply to non-frontend
//   uses.
//
// Calling the HTTP API of a Dify the owner self-hosts, without redistributing
// it and without touching its console, is permitted. No Dify code ships here
// and no Dify interface is displayed, so there is no branding here to alter.
//
// **The boundary that matters for this product, and it is not obvious.** SONARA
// is itself multi-tenant. That is fine while each owner points this adapter at
// their own Dify: SONARA is the multi-tenant thing, Dify is not. It stops being
// fine if SONARA ever runs one shared Dify and serves its customers from it --
// that is operating a multi-tenant Dify environment, which is the condition.
// Recorded in the register as a blocked use so it is not discovered later by
// somebody adding a convenience.

const base = require("./sonara-service-adapter.cjs");

const LABEL = "Dify";
const PREFIX = "SONARA_DIFY";

const ENV_KEYS = base.envKeysFor(PREFIX, ["key"]);

function getDifyReadiness(options = {}) {
  return base.readinessFor({ label: LABEL, prefix: PREFIX, secrets: ["key"], ...options });
}

/**
 * Run the workflow the API key belongs to.
 *
 * In Dify a key identifies an app, so there is no id to interpolate into a path
 * and no equivalent of Langflow's flow-id validation to do here.
 *
 * `inputs` is an object of the workflow's own input names. It is passed as
 * given and never merged with anything from this server.
 */
async function runWorkflow(inputs, { readiness = getDifyReadiness(), fetchImpl = fetch, user = "sonara" } = {}) {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
    return { ok: false, code: "invalid_inputs", detail: "A workflow needs an object of named inputs." };
  }

  const called = await base.postJson(
    readiness,
    "/v1/workflows/run",
    { inputs, response_mode: "blocking", user: String(user).slice(0, 64) },
    { fetchImpl, headers: readiness.key ? { Authorization: `Bearer ${readiness.key}` } : {} }
  );
  if (!called.ok) return called;

  // Dify reports a failed run inside a successful HTTP response, so the status
  // is read rather than assumed from the 200.
  const data = called.data?.data || called.data;
  const status = String(data?.status || "").toLowerCase();
  if (status && status !== "succeeded") {
    return { ok: false, code: "workflow_failed", detail: `The workflow finished as "${status}".` };
  }

  const outputs = data?.outputs;
  if (!outputs || typeof outputs !== "object") {
    return { ok: false, code: "empty_response", detail: "The workflow ran and returned no outputs." };
  }

  return { ok: true, outputs };
}

module.exports = { ENV_KEYS, getDifyReadiness, runWorkflow };
