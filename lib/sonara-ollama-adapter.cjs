"use strict";

// A server-side adapter that actually calls a model.
//
// Until this, nothing in this product called one. `lib/optional-ai-gateway.cjs`
// says so in its own first line -- "This is a readiness DETECTOR only. It never
// makes network calls." Every "AI" surface here was arithmetic over the owner's
// own rows, which was honest and is why the chase drafts and the record checks
// can be trusted. It was also the reason the register had 66 reviewed
// repositories and no way to say any of them was in use.
//
// Ollama is the right first one. MIT, so nothing is owed but attribution. It
// runs on hardware somebody already owns, so a call costs nothing per token --
// which is the requirement, not a preference. And it needs no key, so there is
// no secret to leak.
//
// AGENTS.md: "Use Provider Gateway or approved server-side provider adapters
// for AI calls." This is the second kind. It is server-only; nothing about it
// reaches the browser.
//
// Readiness, timeouts, placeholder detection and the loopback check now live in
// lib/sonara-service-adapter.cjs, because Langflow, Open WebUI and Crawl4AI all
// need exactly the same ones. This file owns only Ollama's call shape.
//
// ## The constraint that actually breaks this, stated first
//
// This application is deployed to Vercel as serverless functions. An Ollama
// running on the owner's laptop is **not reachable from there** -- not behind a
// firewall, not on localhost, not on a home network. `http://localhost:11434`
// configured in production resolves to the serverless container itself, where
// nothing is listening.
//
// So this is genuinely useful in two situations and misleading in a third:
//
//   * a self-hosted deployment where the server and Ollama share a network
//   * a reachable host the owner runs deliberately, with its own protection
//   * NOT an owner's laptop while the app runs on Vercel -- and the readiness
//     check says so by name rather than letting somebody discover it as a
//     timeout in production
//
// ## What it will not do
//
// It does not enable itself. Absent configuration it reports setup-required and
// every caller falls back to the deterministic path it already had. A model
// being unavailable must never be the difference between a page working and a
// page failing.
//
// It does not send anything to a third party. A local runtime is the point; if
// the configured host is not local that is the owner's deliberate choice, and
// the readiness report names the host so the choice is visible.
//
// It has no default timeout of "however long the model takes". A generation
// that hangs holds a serverless invocation open until the platform kills it,
// which reads to a customer as the page being broken.

const base = require("./sonara-service-adapter.cjs");

const LABEL = "Local model calls";
const PREFIX = "SONARA_OLLAMA";

const ENV_KEYS = base.envKeysFor(PREFIX, ["model"]);
const DEFAULT_TIMEOUT_MS = base.DEFAULT_TIMEOUT_MS;
const MAX_TIMEOUT_MS = base.MAX_TIMEOUT_MS;
const LOOPBACK_HOSTS = base.LOOPBACK_HOSTS;

function getOllamaReadiness(options = {}) {
  return base.readinessFor({ label: LABEL, prefix: PREFIX, required: ["model"], ...options });
}

/**
 * Ask the model for text.
 *
 * A caller that already has a deterministic answer must prefer it when this
 * returns ok: false -- the point is added range, never a dependency.
 */
async function generate(prompt, { readiness = getOllamaReadiness(), fetchImpl = fetch } = {}) {
  const text = String(prompt == null ? "" : prompt).trim();
  if (!text) return { ok: false, code: "empty_prompt", detail: "Nothing was asked." };

  const called = await base.postJson(readiness, "/api/generate", { model: readiness.model, prompt: text, stream: false }, { fetchImpl });
  if (!called.ok) return called;

  const answer = String(called.data?.response || "").trim();
  if (!answer) return { ok: false, code: "empty_response", detail: "The model returned nothing." };
  return { ok: true, text: answer, model: readiness.model };
}

module.exports = { ENV_KEYS, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, LOOPBACK_HOSTS, getOllamaReadiness, generate };
