"use strict";

// RAGFlow — asks a question against documents the owner has already loaded.
//
// ## The review this was waiting on, which was security rather than licence
//
// Apache-2.0, read from the repository on 12 August 2026, with no conditions
// beyond Apache's redistribution obligations — and nothing is redistributed
// here.
//
// The register held it at `needs_security_review`, and that was the right
// question: unlike a model or a crawler, this one is about the business's own
// documents. The answer is the same as for Ollama. It is the owner's own
// self-hosted RAGFlow, holding the owner's own files, on infrastructure they
// control. Nothing is sent to a third party by using it.
//
// What that leaves is a boundary rather than a risk: **this adapter retrieves,
// it does not upload.** Loading documents into RAGFlow is something the owner
// does in RAGFlow. A page here that pushed customer records into a search index
// would be making a copy of customer data with different retention, in a system
// with its own access rules, and that is a decision rather than a convenience.
// So there is no upload call in this file, deliberately.

const base = require("./sonara-service-adapter.cjs");

const LABEL = "RAGFlow";
const PREFIX = "SONARA_RAGFLOW";

const ENV_KEYS = base.envKeysFor(PREFIX, ["dataset", "key"]);

// Dataset ids go into the request body rather than a path, so they cannot
// redirect the request the way a Langflow flow id could. They are still checked,
// because a comma-separated list is how somebody would try to widen the search
// to datasets this configuration was not meant to reach.
const DATASET_ID = /^[A-Za-z0-9_-]{1,120}$/;

function getRagflowReadiness(options = {}) {
  return base.readinessFor({ label: LABEL, prefix: PREFIX, required: ["dataset"], secrets: ["key"], ...options });
}

/**
 * Ask a question against the configured dataset.
 *
 * Returns { ok: true, chunks, text } where `chunks` are the passages RAGFlow
 * matched and `text` is them joined. The passages are kept separate because a
 * caller that shows an answer should be able to show what it came from -- an
 * answer with no source is the thing this codebase keeps refusing to produce.
 */
async function ask(question, { readiness = getRagflowReadiness(), fetchImpl = fetch, limit = 8 } = {}) {
  const text = String(question == null ? "" : question).trim();
  if (!text) return { ok: false, code: "empty_question", detail: "Nothing was asked." };

  if (readiness.status === "configured" && !DATASET_ID.test(String(readiness.dataset || ""))) {
    return { ok: false, code: "invalid_dataset", detail: `${ENV_KEYS.dataset} must be a single plain id.` };
  }

  const called = await base.postJson(
    readiness,
    "/api/v1/retrieval",
    { question: text, dataset_ids: [readiness.dataset], top_k: Math.min(Math.max(Number(limit) || 8, 1), 30) },
    { fetchImpl, headers: readiness.key ? { Authorization: `Bearer ${readiness.key}` } : {} }
  );
  if (!called.ok) return called;

  const rows = called.data?.data?.chunks || called.data?.chunks || [];
  const chunks = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      text: String(row?.content || row?.content_with_weight || "").trim(),
      document: String(row?.document_keyword || row?.docnm_kwd || "").trim() || null
    }))
    .filter((chunk) => chunk.text);

  if (chunks.length === 0) {
    // Distinct from a failure: the search ran and matched nothing. Reporting
    // that as an error would send somebody to check a service that is working.
    return { ok: true, chunks: [], text: "", found: false };
  }

  return { ok: true, chunks, text: chunks.map((chunk) => chunk.text).join("\n\n"), found: true };
}

module.exports = { ENV_KEYS, DATASET_ID, getRagflowReadiness, ask };
