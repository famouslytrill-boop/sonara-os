"use strict";

// Open WebUI — an OpenAI-compatible endpoint in front of local models.
//
// ## The licence review this was waiting on
//
// The register carried it as `needs_license_review`, and the review is done.
// Read from the repository's LICENSE on 12 August 2026 rather than recalled.
//
// It is a custom licence, BSD-3-Clause in structure, with one added condition:
// licensees are "strictly prohibited from altering, removing, obscuring, or
// replacing any 'Open WebUI' branding", except where a deployment serves no
// more than fifty end users in any rolling thirty days, or with written
// permission, or under an enterprise licence.
//
// **That condition binds redistribution and deployment with branding altered.
// It does not restrict calling the HTTP API from separate software**, which is
// all this file does. SONARA ships no Open WebUI code and displays no Open
// WebUI interface, so there is no branding here to alter.
//
// The condition does bind the owner if they deploy Open WebUI themselves and
// rebrand it. That is their deployment and their decision, and it is recorded
// in the register so it is not a surprise later.
//
// Unlike the other three this one takes a key, because Open WebUI authenticates
// its API. The key is read from the environment on the server and never leaves
// it -- not in readiness, not in an error, not onto a page.

const base = require("./sonara-service-adapter.cjs");

const LABEL = "Open WebUI";
const PREFIX = "SONARA_OPEN_WEBUI";

const ENV_KEYS = base.envKeysFor(PREFIX, ["model", "key"]);

function getOpenWebUiReadiness(options = {}) {
  const readiness = base.readinessFor({ label: LABEL, prefix: PREFIX, required: ["model", "key"], ...options });
  if (readiness.status !== "configured") return readiness;

  // The key satisfies the required check and is then removed from the object
  // callers can render. postJson receives it separately, as a header.
  const key = readiness.key;
  delete readiness.key;
  Object.defineProperty(readiness, "apiKey", { value: key, enumerable: false, writable: false });
  return readiness;
}

/**
 * Ask for a chat completion.
 *
 * Returns { ok: true, text } or { ok: false, code, detail }, never throws, and
 * is never the only path a caller has.
 */
async function complete(prompt, { readiness = getOpenWebUiReadiness(), fetchImpl = fetch } = {}) {
  const text = String(prompt == null ? "" : prompt).trim();
  if (!text) return { ok: false, code: "empty_prompt", detail: "Nothing was asked." };

  const called = await base.postJson(
    readiness,
    "/api/chat/completions",
    { model: readiness.model, messages: [{ role: "user", content: text }], stream: false },
    { fetchImpl, headers: readiness.apiKey ? { Authorization: `Bearer ${readiness.apiKey}` } : {} }
  );
  if (!called.ok) return called;

  const answer = String(called.data?.choices?.[0]?.message?.content || "").trim();
  if (!answer) return { ok: false, code: "empty_response", detail: "The model returned nothing." };
  return { ok: true, text: answer, model: readiness.model };
}

module.exports = { ENV_KEYS, getOpenWebUiReadiness, complete };
