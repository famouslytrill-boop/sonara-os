"use strict";

// Seventh screenshot-led intake batch, 15 September 2026.
//
// Research/catalog state only. No third-party repository is installed,
// imported, executed, or enabled in production by this file.
//
// Two submitted items already carry verdicts and are NOT re-recorded here --
// ai-sdlc-framework/ai-sdlc and n8n-io/n8n are in data/open-source-tools.ts,
// reviewed 9 and 10 September 2026. A repository with two verdicts has none,
// so they appear in DEDUPLICATED_SCREENSHOT_REFERENCES_BATCH7 instead.
//
// The finding that shaped this batch is measured rather than described. Two of
// the submitted repositories are advertised as curated API and playbook
// directories and are affiliate placement lists: 78,216 of 78,913 links and
// 78,186 of 78,884 links carry an affiliate parameter -- 99.1% each -- and
// every one uses the single code ?fpr=p2hrc6. Measured 11 September 2026 and
// re-measured against the latest clones on 15 September 2026.
//
// That code also appears in cporter202/lead-gen-api-stack, already recorded in
// Batch 2, at 5 of its 7 links. It does NOT appear in
// cporter202/generative-ai-arbitrage, recorded in Batch 4, which carries 89
// links and no affiliate parameter at all -- so the pattern covers three of the
// four repositories from that account and is not a property of the account.
// Stating both halves is the point: the measurement is the finding, not the
// author.

const DEDUPLICATED_SCREENSHOT_REFERENCES_BATCH7 = Object.freeze([
  Object.freeze({
    key: "ai_sdlc_framework",
    repository: "ai-sdlc-framework/ai-sdlc",
    existingBatch: 0,
    note: "Already reviewed 9 September 2026 in data/open-source-tools.ts: Apache-2.0 core, a separately licensed enterprise plugin tier, and a recurring Anthropic/OpenAI bill on every change. Re-cloned 15 September 2026 and the licence and engines (node >=22, pnpm) still match; nothing new to add, so no second verdict is created."
  }),
  Object.freeze({
    key: "n8n",
    repository: "n8n-io/n8n",
    existingBatch: 0,
    note: "Already reviewed in data/open-source-tools.ts and enriched 10 September 2026: Sustainable Use License v1.0, licenceRisk critical, embedding into this paid hosted product forbidden by two independent clauses. Submitted again as a screenshot; the verdict is unchanged."
  })
]);

const SCREENSHOT_TOOL_RADAR_BATCH7 = Object.freeze([
  record({
    key: "dwarfstar_ds4_metal",
    label: "DwarfStar (ds4-metal)",
    repository: "ivanfioravanti/ds4-metal",
    license: "MIT (LICENSE names 'The ds4.c authors' and 'The ggml authors'); a full Apache-2.0 text is bundled at licenses/Apache-2.0.txt",
    licenseRisk: "low",
    runtimeClass: "local_gpu_inference_engine",
    integrationStatus: "research_only",
    integrationMode: "owner_hosted_worker_reference",
    role: "Narrow native inference engine for DeepSeek V4 Flash and GLM 5.x variants, self-contained and deliberately not a general GGUF runner, with Metal, CUDA and ROCm backends and its own GGUF/imatrix tooling",
    placement: "Creator Studio generation research only. It cannot run in the Vercel request process, which has no GPU, no persistent disk and a documented 300-second function lifetime; its only possible shape is an owner-hosted worker behind a URL variable under docs/architecture/EXTERNAL-SERVICES.md",
    productFit: ["Creator Studio", "Internal Development"],
    capabilities: ["local LLM inference", "Metal/CUDA/ROCm backends", "project-produced GGUF files", "KV state and HTTP server", "integration-tested coding agent"],
    safety: [
      "A serverless function has no GPU: nothing here can execute inside the served application, and a permissive licence does not change that.",
      "If it were ever adapted it obeys the four EXTERNAL-SERVICES rules -- off by default, never a dependency, never render its configuration, validate anything that becomes part of a request -- and a function still cannot reach the owner's laptop.",
      "Attribution covers two sets of authors, the ds4.c authors and the ggml authors, so a single copyright line would be wrong.",
      "The real cost is hardware, not tokens: its README names 96 GB Macs as the primary target and 128 GB for the larger models."
    ],
    blockedUses: ["running model inference inside the Vercel request process", "assuming server GPU availability", "describing it as a general GGUF runner, which its own README denies"],
    nextStep: "Do nothing until the answering-architecture and generation-cost decisions are settled; if local inference is ever wanted, price a 96 GB machine against the current per-token provider bill before writing an adapter."
  }),
  record({
    key: "ballast_rightsizing",
    label: "Ballast",
    repository: "tight-line/ballast",
    license: "MIT, Copyright (c) 2026 Tight Line LLC",
    licenseRisk: "low",
    runtimeClass: "kubernetes_rightsizing_operator",
    integrationStatus: "research_only",
    integrationMode: "infrastructure_observability_reference",
    role: "Kubernetes operator that right-sizes workload requests and limits from observed history, applying changes at admission time and to running pods via the in-place resize API rather than only recommending them",
    placement: "Infrastructure reference only. There is no Kubernetes in this project to install an operator into -- SONARA One is Express on Vercel serverless functions -- so the licence is not what rules it out",
    productFit: ["Internal Development"],
    capabilities: ["VPA-history-driven right-sizing", "admission-time mutation", "in-place pod resize on Kubernetes 1.35+", "cluster CPU reclamation"],
    safety: [
      "Advisory only, and doubly so here: an infrastructure recommendation never authorizes mutation, and there is no cluster for it to mutate.",
      "A permissive licence is not applicability. MIT says this may be used, not that there is anywhere to put it.",
      "Its own README documents a redeploy gap -- deleting a workload garbage-collects the VPA checkpoints its history lives in, so a GitOps teardown cold-starts the data."
    ],
    blockedUses: ["installing a Kubernetes operator in a serverless deployment", "treating a right-sizing recommendation as permission to change production compute"],
    nextStep: "Keep as a reference beside the Batch 2 kubeopt/kubeopt record; revisit only if SONARA ever runs real Kubernetes workloads, and then only behind a separately approved mutation policy."
  }),
  record({
    key: "clawflows",
    label: "ClawFlows",
    repository: "nikilster/clawflows",
    license: "AMBIGUOUS. The README has a 'License' section whose entire content is the word 'MIT'. There is NO LICENSE file anywhere in the repository, checked by name across the whole tree, so the MIT text is absent: no copyright holder is named and the permission grant and warranty disclaimer are both missing.",
    licenseRisk: "medium",
    runtimeClass: "agent_workflow_markdown_collection",
    integrationStatus: "research_only_license_gated",
    integrationMode: "reference_only_pending_license_file",
    role: "Collection of reusable agent workflow blueprints targeting the OpenClaw runtime, with community submissions, docs and bats shell tests",
    placement: "Reading material at most. It targets OpenClaw rather than this stack, and 141 of its 179 files are markdown, so there is little executable to adopt even with a clean licence",
    productFit: ["Internal Development"],
    capabilities: ["markdown workflow blueprints", "community submission process", "bats test harness"],
    safety: [
      "A README word is not a licence text. The grant, the named copyright holder and the disclaimer are what one complies with, and none of them is in the repository.",
      "Recorded as license-gated rather than blocked, because 'the author wrote MIT informally' and 'the author said nothing' are different positions and flattening them would overstate the finding.",
      "Any workflow ideas taken from it must still pass through lib/sonara-agent-authority.cjs: an external workflow collection grants no authority and unknown consequential actions still fail closed to owner review."
    ],
    blockedUses: ["copying workflow content into this repository before a LICENSE file exists", "treating a README licence word as a licence file", "importing agent workflows that bypass the SONARA authority gate"],
    nextStep: "If anything here is ever wanted, open an issue asking the author to add a LICENSE file naming the copyright holder -- a one-file request that resolves the whole question."
  }),
  record({
    key: "openclaw_api_list",
    label: "openclaw-api-list",
    repository: "cporter202/openclaw-api-list",
    license: "NONE DECLARED. No LICENSE file and no licence statement in the README. Under CLAUDE.md the absence of a licence is not permission: all rights reserved.",
    licenseRisk: "critical",
    runtimeClass: "affiliate_link_directory",
    integrationStatus: "blocked",
    integrationMode: "blocked_unlicensed_and_undisclosed_affiliate_content",
    role: "Advertised as a ready-to-use API toolbox for OpenClaw bots; measured as an affiliate placement list",
    placement: "Nowhere. Recorded so the measurement is on file and nobody curates from it by mistake",
    productFit: ["Internal Development"],
    capabilities: ["markdown link lists organised into nineteen category folders"],
    safety: [
      "Measured, not characterised: 78,216 of 78,913 links carry ?fpr=p2hrc6, a single affiliate code -- 99.1%.",
      "Do not read the folder names as measurements. automation-apis-4825, lead-generation-apis-3452 and ai-apis-1208 each contain exactly one file; the numbers count nothing.",
      "Passing an undisclosed affiliate link to a customer who trusts the product is a disclosure problem before it is a licence problem.",
      "No internal review can unblock this: there is no licence to review, and only the author can grant one."
    ],
    blockedUses: ["using it as a source for any API list, catalogue or integration directory in the product", "citing it as curated research in marketing copy or documentation", "copying any of its markdown, which is all rights reserved", "surfacing any of its links to a customer"],
    nextStep: "None. The record exists so this measurement is not repeated; revisit only if the author both declares a licence and discloses the affiliate relationship."
  }),
  record({
    key: "software_income_playbooks",
    label: "software-income-playbooks",
    repository: "cporter202/software-income-playbooks",
    license: "NONE DECLARED. No LICENSE file and no licence statement. All rights reserved.",
    licenseRisk: "critical",
    runtimeClass: "affiliate_link_directory",
    integrationStatus: "blocked",
    integrationMode: "blocked_unlicensed_and_undisclosed_affiliate_content",
    role: "Advertised as a practical library of software ideas, curated APIs and monetization paths; measured as an affiliate placement list sharing one code with openclaw-api-list",
    placement: "Nowhere. Recorded because it was submitted alongside its twin and the measurement should not have to be redone",
    productFit: ["Internal Development"],
    capabilities: ["markdown link lists across apis, playbooks, categories, resources and templates"],
    safety: [
      "78,186 of 78,884 links carry ?fpr=p2hrc6 -- 99.1% -- byte-for-byte the same code as openclaw-api-list, which is evidence of one arrangement rather than an inference about two.",
      "It was posted to a beginners' group as a launchpad for turning useful data into real products, which is the gap between the label and the measurement worth writing down.",
      "No internal review can unblock it; only the author can grant a licence."
    ],
    blockedUses: ["sourcing product ideas, API lists or monetisation copy from it", "citing it as curated research anywhere customer-facing", "copying any of its markdown, which is all rights reserved"],
    nextStep: "None. Treat it and openclaw-api-list as one artefact under two labels."
  }),
  record({
    key: "vulture_osint",
    label: "Vulture",
    repository: "vulture-osint-automation-tool/vulture",
    license: "NONE DECLARED. No LICENSE file. All rights reserved.",
    licenseRisk: "critical",
    runtimeClass: "osint_credential_exposure_tool",
    integrationStatus: "blocked",
    integrationMode: "blocked_on_license_and_on_conduct",
    role: "OSINT automation script: Dehashed breach lookups returning leaked emails and passwords for a target, plus a Google dorking module its own README describes as brute-force",
    placement: "Nowhere. Two independent refusals apply and either alone is sufficient",
    productFit: ["Internal Development"],
    capabilities: ["Dehashed breach-data queries", "Google dork enumeration", "user-agent rotation", "credential list generation"],
    safety: [
      "The licence refusal is mechanical: no LICENSE file, so no rights are granted and none can be inferred.",
      "The conduct refusal does not depend on it. This gathers leaked credentials about third parties, and its README states the dorking module 'is a brute-force style program that will eventually alert Google bot detection. If detection is alerted, you must wait for a lockout cooldown or change IP.'",
      "This is not a position on authorised security testing. It is that SONARA One sells operations software to small businesses and has no product surface for third-party reconnaissance.",
      "If credential-exposure checking is ever wanted as a customer feature, that is a consented, contracted provider integration and not this."
    ],
    blockedUses: ["any use, in any environment, under any configuration", "querying third-party breach data by or on behalf of this product", "scraping that an operator's own documentation describes as triggering bot detection", "citing it as a security capability of this product"],
    nextStep: "None. Recorded so the refusal is written once rather than re-argued."
  }),
  record({
    key: "opencontext",
    label: "OpenContext",
    repository: "0xranx/OpenContext",
    license: "AMBIGUOUS, and all three readings are permissive. LICENSE is the MIT text, 'Copyright (c) 2025 OpenContext'. The root package.json declares Apache-2.0. crates/opencontext-node/package.json declares ISC.",
    licenseRisk: "medium",
    runtimeClass: "developer_context_store",
    integrationStatus: "research_only_license_gated",
    integrationMode: "developer_tool_candidate",
    role: "Persistent context store for coding agents, published as @aicontextlab/cli, reusing an existing agent CLI and adding a desktop GUI plus built-in skills and tools",
    placement: "Development-time only. A context store for coding agents has no place in the served application or near customer data",
    productFit: ["Internal Development"],
    capabilities: ["project knowledge capture", "cross-repository context reuse", "desktop GUI", "bring-your-own agent CLI"],
    safety: [
      "Three licence declarations in one repository is the same defect this project already refuses in duplicate records: a repository with two verdicts has none. Reconcile before copying source.",
      "Recorded as medium rather than critical because all three are permissive -- the worst case is an attribution obligation somebody guessed at, not a prohibition.",
      "Trialling the published CLI is a different question from copying its source, and the first is fine on any of the three readings.",
      "Personal-agent memory grants no identity or authority: nothing it stores may widen what an agent here may do without owner approval."
    ],
    blockedUses: ["copying source before the three licence declarations are reconciled", "placing a context store in the served application or giving it customer data", "repeating the badge's 'MIT' as the licence answer when the manifests say otherwise", "treating stored context as permission to act"],
    nextStep: "Open an issue asking the author which licence governs; independently, a developer here may trial the published CLI locally without copying any source."
  })
]);

function record(input) {
  return Object.freeze({
    repositoryVerified: true,
    repoUrl: `https://github.com/${input.repository}`,
    launchImpact: "optional",
    enabledInProduction: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch7_2026_09_15",
    blockedUses: [],
    ...input
  });
}

function getPublicScreenshotToolCatalogBatch7() {
  return SCREENSHOT_TOOL_RADAR_BATCH7.map((item) => ({
    key: item.key,
    label: item.label,
    requestedRepository: item.repository,
    requestedRepoUrl: item.repoUrl,
    repository: item.repository,
    repoUrl: item.repoUrl,
    repositoryVerified: item.repositoryVerified,
    sourceCorrection: null,
    license: item.license,
    licenseRisk: item.licenseRisk,
    runtimeClass: item.runtimeClass,
    integrationStatus: item.integrationStatus,
    integrationMode: item.integrationMode,
    role: item.role,
    placement: item.placement,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    launchImpact: item.launchImpact,
    enabledInProduction: item.enabledInProduction,
    humanReviewRequired: item.humanReviewRequired,
    safety: [...item.safety],
    blockedUses: [...item.blockedUses],
    nextStep: item.nextStep,
    source: item.source
  }));
}

function getScreenshotToolReadinessBatch7() {
  const repositories = getPublicScreenshotToolCatalogBatch7().map((item) => ({
    ...item,
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    canExecute: false
  }));

  return {
    ok: true,
    mode: "static_governed_catalog",
    repositoryCount: repositories.length,
    productionExecutionCount: repositories.filter((item) => item.enabledInProduction).length,
    repositories
  };
}

function getDeduplicatedReferencesBatch7() {
  return DEDUPLICATED_SCREENSHOT_REFERENCES_BATCH7.map((item) => ({ ...item }));
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH7,
  getPublicScreenshotToolCatalogBatch7,
  getScreenshotToolReadinessBatch7,
  getDeduplicatedReferencesBatch7
};
