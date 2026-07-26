"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchToolRegistry();
patchRepositoryRegistry();

console.log("OBLITERATUS governed open-source registry entries applied");

function patchToolRegistry() {
  const filePath = path.join(__dirname, "..", "data", "open-source-tools.ts");
  let source = fs.readFileSync(filePath, "utf8");

  if (!source.includes('slug: "obliteratus-quarantined-safety-reference"')) {
    const marker = `  {
    name: "CrewAI",`;
    if (!source.includes(marker)) throw new Error("OBLITERATUS open-source registry marker not found");

    const record = `  {
    name: "OBLITERATUS",
    slug: "obliteratus-quarantined-safety-reference",
    category: ["model safety research", "mechanistic interpretability", "refusal robustness", "high-risk model modification"],
    useCase: [
      "defensive refusal-integrity test design",
      "alignment-regression review",
      "model artifact provenance and license review",
      "telemetry and data-egress risk review",
      "human-reviewed AI safety governance"
    ],
    productFit: ["Research Lab", "Admin Command Center", "AI Safety Review", "System Design Intelligence"],
    license: "AGPL-3.0 upstream with a stated commercial-license option; legal review required before any code use.",
    licenseRisk: "critical",
    commercialUseStatus: "blocked_until_review",
    integrationStatus: "blocked",
    recommendedAction: [
      "reference-only safety research",
      "do not install or execute upstream code",
      "do not modify or export model weights",
      "do not enable telemetry or Hugging Face uploads",
      "use SONARA's local defensive policy engine only"
    ],
    officialUrl: "https://github.com/elder-plinius/OBLITERATUS",
    repoUrl: "https://github.com/elder-plinius/OBLITERATUS",
    notes: "Pinned as a quarantined reference at a5a1ffa5849b442cf188b3c03fd4de71ddf5bdcc. SONARA does not copy, install, run, host, or expose its refusal-removal pipeline. The integration is an original local policy layer for defensive safety review only.",
    safetyBoundaries: [
      "admin-only visibility",
      "no customer prompts or outputs",
      "no production secrets or credentials",
      "no model weight changes",
      "no model exports or publishing",
      "no telemetry",
      "no autonomous GPU or shell jobs",
      "legal and AI-safety review required"
    ],
    blockedUses: [
      "refusal removal",
      "guardrail weakening",
      "uncensored customer models",
      "abliteration or obliteration execution",
      "modified-model hosting",
      "Hugging Face push or export",
      "production runtime integration",
      "customer-facing access"
    ],
    humanReviewRequired: true,
  },
${marker}`;
    source = source.replace(marker, record);
  }

  fs.writeFileSync(filePath, source);
}

function patchRepositoryRegistry() {
  const filePath = path.join(__dirname, "..", "docs", "SONARA_EXTERNAL_REPOSITORY_REGISTRY.md");
  if (!fs.existsSync(filePath)) {
    console.log("OBLITERATUS documentation registry skipped because docs are not present in this runtime image");
    return;
  }

  let source = fs.readFileSync(filePath, "utf8");

  if (!source.includes("elder-plinius/OBLITERATUS")) {
    const marker = "| CrewAI | `github.com/crewAIInc/crewAI` | `adapter_available` | Reviewed background worker only |";
    if (!source.includes(marker)) throw new Error("OBLITERATUS external repository registry marker not found");
    const row = "| OBLITERATUS | `github.com/elder-plinius/OBLITERATUS` | `blocked_runtime_reference_only` | Defensive model-safety and refusal-integrity reference only; no installation, model modification, telemetry, export, hosting, or customer execution |";
    source = source.replace(marker, `${marker}\n${row}`);
  }

  if (!source.includes("### OBLITERATUS safety boundary")) {
    const marker = "## Agent and orchestration";
    if (!source.includes(marker)) throw new Error("OBLITERATUS safety boundary documentation marker not found");
    const block = `### OBLITERATUS safety boundary

The repository states that it analyzes and removes model refusal behavior. SONARA therefore treats it as a high-risk, quarantined research reference—not as a production dependency or an approved model-modification tool.

- Pinned reviewed source: \`elder-plinius/OBLITERATUS@a5a1ffa5849b442cf188b3c03fd4de71ddf5bdcc\`.
- Upstream license: AGPL-3.0 with an upstream commercial-license option; legal review is mandatory before any code use.
- Upstream code is not copied, installed, imported, cloned, fetched, hosted, or executed by SONARA.
- Refusal removal, safety weakening, model-weight modification, modified-model export, Hugging Face publishing, and customer-facing uncensored models are prohibited.
- Telemetry, prompts, outputs, credentials, customer data, production secrets, and model artifacts may not be transmitted upstream.
- SONARA's integration is an original deterministic policy engine that reviews defensive model-safety proposals and fails closed on safety-weakening intent.
- Any future isolated research requires a separate founder-approved pull request with legal, AI-safety, privacy, security, provenance, network-egress, incident-response, and rollback evidence.

`;
    source = source.replace(marker, `${block}${marker}`);
  }

  fs.writeFileSync(filePath, source);
}
