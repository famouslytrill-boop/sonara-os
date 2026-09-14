"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");
const {
  REQUESTED_REPOSITORIES,
  getPublicRequestedRepositoryCatalog,
  getRequestedRepositoryReadiness
} = require("../lib/sonara-requested-repository-registry.cjs");
const {
  SCREENSHOT_TOOL_RADAR,
  getPublicScreenshotToolCatalog,
  getScreenshotToolReadiness
} = require("../lib/sonara-screenshot-tool-radar.cjs");
const {
  SCREENSHOT_TOOL_RADAR_BATCH2,
  UNVERIFIED_SCREENSHOT_LEADS_BATCH2,
  getPublicScreenshotToolCatalogBatch2,
  getScreenshotToolReadinessBatch2
} = require("../lib/sonara-screenshot-tool-radar-batch2.cjs");
const {
  SCREENSHOT_TOOL_RADAR_BATCH3,
  NON_REPOSITORY_REFERENCES_BATCH3,
  getPublicScreenshotToolCatalogBatch3,
  getScreenshotToolReadinessBatch3
} = require("../lib/sonara-screenshot-tool-radar-batch3.cjs");

const EXPECTED_KEYS = [
  "openhands",
  "caveman",
  "agency_agents",
  "meetily",
  "officecli",
  "openwiki",
  "omniroute",
  "strix",
  "asi",
  "awesome_design_md"
];

const SCREENSHOT_KEYS = [
  "browser_use_pi",
  "quickliquid",
  "l0p4map",
  "hyperframes",
  "iris",
  "viberaven",
  "langchain",
  "deepwiki_rs",
  "offpack"
];

const SCREENSHOT_BATCH2_KEYS = [
  "image_pipes",
  "feynman",
  "kubeopt",
  "edgepilot",
  "phi_cookbook",
  "davinci_resolve_mcp",
  "sceneflow",
  "lead_gen_api_stack"
];

const UNVERIFIED_BATCH2_KEYS = [
  "coding_agent_merge_button_lead",
  "anatomy_3d_lead",
  "sceneai_service_reference"
];

const SCREENSHOT_BATCH3_KEYS = [
  "ocrmypdf",
  "archify",
  "three_ws",
  "openpost",
  "uiverse_galaxy",
  "openresearch",
  "nvidia_switchyard"
];

const NON_REPOSITORY_BATCH3_KEYS = [
  "breachlab_service_reference",
  "google_trends_service_reference",
  "hackproduct_learning_reference"
];

const CORRECTED_REPOSITORIES = {
  agency_agents: "msitarzewski/agency-agents",
  officecli: "iOfficeAI/OfficeCLI",
  openwiki: "langchain-ai/openwiki",
  strix: "usestrix/strix"
};

describe("requested repository integration registry", () => {
  it("catalogs every requested source and blocks unverifiable links", () => {
    assert.deepEqual(REQUESTED_REPOSITORIES.map((item) => item.key), EXPECTED_KEYS);
    assert.equal(REQUESTED_REPOSITORIES.filter((item) => item.repositoryVerified).length, 8);
    assert.deepEqual(
      REQUESTED_REPOSITORIES.filter((item) => item.integrationStatus === "blocked").map((item) => item.key),
      ["omniroute", "awesome_design_md"]
    );
  });

  it("records authoritative corrections for misattributed social-post links", () => {
    for (const [key, repository] of Object.entries(CORRECTED_REPOSITORIES)) {
      const item = REQUESTED_REPOSITORIES.find((candidate) => candidate.key === key);
      assert.equal(item.repository, repository);
      assert.equal(item.repositoryVerified, true);
      assert.ok(item.sourceCorrection);
    }
  });

  it("keeps all third-party execution disabled in production", () => {
    const readiness = getRequestedRepositoryReadiness();
    assert.equal(readiness.repositoryCount, 10);
    assert.equal(readiness.verifiedCount, 8);
    assert.equal(readiness.blockedCount, 2);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
    assert.ok(readiness.repositories.every((item) => item.humanReviewRequired));
  });

  it("publishes a non-secret catalog with explicit safety boundaries", () => {
    const catalog = getPublicRequestedRepositoryCatalog();
    const serialized = JSON.stringify(catalog);
    assert.equal(catalog.length, 10);
    assert.doesNotMatch(serialized, /API_KEY|TOKEN=|SECRET=|password/i);
    assert.ok(catalog.every((item) => item.safety.length > 0));
    assert.ok(catalog.every((item) => item.nextStep));
    assert.ok(catalog.every((item) => item.enabledInProduction === false));
  });

  it("installs route and OpenAPI registration idempotently through the runtime applicator", () => {
    const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
    const openapi = fs.readFileSync(path.join(__dirname, "../openapi/sonara.yaml"), "utf8");
    assert.equal((server.match(/registerSonaraRequestedRepositoryRoutes = require/g) || []).length, 1);
    assert.equal((server.match(/registerSonaraRequestedRepositoryRoutes\(app/g) || []).length, 1);
    assert.equal((openapi.match(/\/api\/ecosystem\/requested-repositories:/g) || []).length, 1);
    assert.equal((openapi.match(/\/api\/admin\/requested-repositories\/readiness:/g) || []).length, 1);
    assert.match(openapi, /operationId: getRequestedRepositoryCatalog/);
    assert.match(openapi, /operationId: getAdminRequestedRepositoryReadiness/);
  });
});

describe("screenshot tool research radar", () => {
  it("records every verified screenshot source as non-executing research", () => {
    assert.deepEqual(SCREENSHOT_TOOL_RADAR.map((item) => item.key), SCREENSHOT_KEYS);
    assert.ok(SCREENSHOT_TOOL_RADAR.every((item) => item.repositoryVerified));
    assert.ok(SCREENSHOT_TOOL_RADAR.every((item) => item.enabledInProduction === false));
    assert.ok(SCREENSHOT_TOOL_RADAR.every((item) => item.humanReviewRequired));
    assert.ok(SCREENSHOT_TOOL_RADAR.every((item) => item.safety.length > 0));
    assert.ok(SCREENSHOT_TOOL_RADAR.every((item) => item.nextStep));
  });

  it("keeps the security scanner restricted to authorized staging use", () => {
    const item = SCREENSHOT_TOOL_RADAR.find((candidate) => candidate.key === "l0p4map");
    assert.equal(item.license, "GPL-3.0");
    assert.equal(item.integrationStatus, "staging_only");
    assert.match(item.blockedUses.join(" "), /third-party scanning/i);
  });

  it("keeps OFFPack from replacing the repository's pnpm contract", () => {
    const item = SCREENSHOT_TOOL_RADAR.find((candidate) => candidate.key === "offpack");
    assert.equal(item.integrationStatus, "research_only");
    assert.match(item.blockedUses.join(" "), /replacing pnpm/i);
  });

  it("publishes no executable screenshot tool state", () => {
    const catalog = getPublicScreenshotToolCatalog();
    const readiness = getScreenshotToolReadiness();
    assert.equal(catalog.length, 9);
    assert.equal(readiness.repositoryCount, 9);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
  });
});

describe("second screenshot tool research batch", () => {
  it("records only repositories whose upstream identity and adoption posture were verified", () => {
    assert.deepEqual(SCREENSHOT_TOOL_RADAR_BATCH2.map((item) => item.key), SCREENSHOT_BATCH2_KEYS);
    assert.deepEqual(
      SCREENSHOT_TOOL_RADAR_BATCH2.map((item) => item.repository),
      [
        "mrajaeim/image-pipes",
        "advaitpaliwal/feynman",
        "kubeopt/kubeopt",
        "pricootz/edgepilot",
        "microsoft/PhiCookBook",
        "samuelgursky/davinci-resolve-mcp",
        "taruma/SceneFlow",
        "cporter202/lead-gen-api-stack"
      ]
    );
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH2.every((item) => item.repositoryVerified));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH2.every((item) => item.enabledInProduction === false));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH2.every((item) => item.humanReviewRequired));
  });

  it("preserves ambiguous or non-repository screenshots without inventing repositories", () => {
    assert.deepEqual(UNVERIFIED_SCREENSHOT_LEADS_BATCH2.map((item) => item.key), UNVERIFIED_BATCH2_KEYS);
    assert.ok(UNVERIFIED_SCREENSHOT_LEADS_BATCH2.every((item) => !Object.hasOwn(item, "repository")));
    assert.ok(UNVERIFIED_SCREENSHOT_LEADS_BATCH2.every((item) => !Object.hasOwn(item, "license")));
    const sceneAi = UNVERIFIED_SCREENSHOT_LEADS_BATCH2.find((item) => item.key === "sceneai_service_reference");
    assert.equal(sceneAi.status, "verified_hosted_service_reference");
    assert.match(sceneAi.reason, /no authoritative public source repository/i);
  });

  it("keeps KubeOpt advisory and unable to mutate production from research state", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH2.find((candidate) => candidate.key === "kubeopt");
    assert.equal(item.integrationStatus, "research_only");
    assert.match(item.blockedUses.join(" "), /automatic production cluster mutation/i);
    assert.match(item.nextStep, /only if SONARA begins operating Kubernetes workloads/i);
  });

  it("uses Feynman as a research-method pattern rather than an executable agent", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH2.find((candidate) => candidate.key === "feynman");
    assert.equal(item.integrationMode, "source_grounded_research_pattern");
    assert.match(item.blockedUses.join(" "), /remote install scripts/i);
    assert.match(item.nextStep, /source-grounded research skill/i);
  });

  it("keeps Image Pipes bounded to reviewed media processing", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH2.find((candidate) => candidate.key === "image_pipes");
    assert.equal(item.integrationStatus, "optional_adapter_after_review");
    assert.match(item.blockedUses.join(" "), /arbitrary plugin loading/i);
    assert.match(item.placement, /Creator Studio/i);
  });

  it("uses EdgePilot as a local desktop interaction reference without telemetry creep", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH2.find((candidate) => candidate.key === "edgepilot");
    assert.equal(item.integrationStatus, "curated_reference");
    assert.match(item.blockedUses.join(" "), /silent workstation telemetry upload/i);
    assert.match(item.placement, /Founder desktop/i);
  });

  it("keeps Phi cookbook code and model licensing as separate decisions", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH2.find((candidate) => candidate.key === "phi_cookbook");
    assert.equal(item.license, "MIT");
    assert.match(item.blockedUses.join(" "), /assuming all Phi model weights share the cookbook license/i);
    assert.match(item.safety.join(" "), /Provider Gateway/i);
  });

  it("blocks DaVinci control adoption behind the current security review", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH2.find((candidate) => candidate.key === "davinci_resolve_mcp");
    assert.equal(item.integrationStatus, "research_only");
    assert.equal(item.licenseRisk, "high");
    assert.match(item.blockedUses.join(" "), /project deletion without explicit confirmation/i);
    assert.match(item.safety.join(" "), /September 2026 security advisories/i);
  });

  it("keeps SceneFlow as evidence-oriented Creator Studio research", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH2.find((candidate) => candidate.key === "sceneflow");
    assert.equal(item.integrationStatus, "curated_reference");
    assert.match(item.capabilities.join(" "), /prompt-adherence review/i);
    assert.match(item.blockedUses.join(" "), /automatic quality verdicts/i);
  });

  it("does not treat the unlicensed lead-gen directory as adoptable source code", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH2.find((candidate) => candidate.key === "lead_gen_api_stack");
    assert.equal(item.license, "NONE DECLARED");
    assert.equal(item.integrationStatus, "reference_only_no_license");
    assert.match(item.blockedUses.join(" "), /automated unsolicited bulk outreach/i);
    assert.match(item.safety.join(" "), /affiliate/i);
  });

  it("publishes no executable second-batch state", () => {
    const catalog = getPublicScreenshotToolCatalogBatch2();
    const readiness = getScreenshotToolReadinessBatch2();
    assert.equal(catalog.length, 8);
    assert.equal(readiness.repositoryCount, 8);
    assert.equal(readiness.unresolvedVisualLeadCount, 3);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
  });
});

describe("third screenshot tool research batch", () => {
  it("records the newly verified repositories without enabling execution", () => {
    assert.deepEqual(SCREENSHOT_TOOL_RADAR_BATCH3.map((item) => item.key), SCREENSHOT_BATCH3_KEYS);
    assert.deepEqual(
      SCREENSHOT_TOOL_RADAR_BATCH3.map((item) => item.repository),
      [
        "ocrmypdf/OCRmyPDF",
        "tt-a1i/archify",
        "nirholas/three.ws",
        "getopenpost/openpost",
        "uiverse-io/galaxy",
        "alphaXiv/OpenResearch",
        "NVIDIA-NeMo/Switchyard"
      ]
    );
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH3.every((item) => item.repositoryVerified));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH3.every((item) => item.enabledInProduction === false));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH3.every((item) => item.humanReviewRequired));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH3.every((item) => item.safety.length > 0));
  });

  it("keeps non-repository references outside the executable catalog", () => {
    assert.deepEqual(NON_REPOSITORY_REFERENCES_BATCH3.map((item) => item.key), NON_REPOSITORY_BATCH3_KEYS);
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH3.every((item) => !Object.hasOwn(item, "repository")));
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH3.every((item) => !Object.hasOwn(item, "license")));
  });

  it("keeps OCRmyPDF in an isolated document worker with MPL review", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH3.find((candidate) => candidate.key === "ocrmypdf");
    assert.equal(item.license, "MPL-2.0");
    assert.equal(item.integrationMode, "isolated_document_worker");
    assert.match(item.blockedUses.join(" "), /synchronous OCR inside the Vercel request process/i);
    assert.match(item.safety.join(" "), /Tesseract and Ghostscript/i);
  });

  it("keeps OpenPost as a high-risk license-gated workflow reference", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH3.find((candidate) => candidate.key === "openpost");
    assert.equal(item.license, "AGPL-3.0");
    assert.equal(item.licenseRisk, "high");
    assert.equal(item.integrationStatus, "research_only_license_gated");
    assert.match(item.blockedUses.join(" "), /automatic publishing without user approval/i);
  });

  it("keeps Switchyard behind Provider Gateway and pre-1.0 evaluation boundaries", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH3.find((candidate) => candidate.key === "nvidia_switchyard");
    assert.equal(item.license, "Apache-2.0");
    assert.equal(item.integrationStatus, "research_only_pre1");
    assert.match(item.blockedUses.join(" "), /replacing Provider Gateway without an ADR/i);
    assert.match(item.safety.join(" "), /pre-1.0/i);
  });

  it("keeps three.ws generation rights and on-chain features separate from repository licensing", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH3.find((candidate) => candidate.key === "three_ws");
    assert.equal(item.license, "Apache-2.0");
    assert.match(item.blockedUses.join(" "), /unreviewed on-chain registration/i);
    assert.match(item.safety.join(" "), /generated assets/i);
  });

  it("treats Uiverse as selective design research rather than a bulk dependency", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH3.find((candidate) => candidate.key === "uiverse_galaxy");
    assert.equal(item.license, "MIT");
    assert.match(item.blockedUses.join(" "), /bulk importing the archive/i);
    assert.match(item.nextStep, /at most three interaction patterns/i);
  });

  it("keeps OpenResearch local and evidence-governed", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH3.find((candidate) => candidate.key === "openresearch");
    assert.equal(item.license, "MIT");
    assert.match(item.blockedUses.join(" "), /publicly exposing an unauthenticated local research service/i);
    assert.match(item.safety.join(" "), /source-grounded evidence standards/i);
  });

  it("publishes no executable third-batch state", () => {
    const catalog = getPublicScreenshotToolCatalogBatch3();
    const readiness = getScreenshotToolReadinessBatch3();
    assert.equal(catalog.length, 7);
    assert.equal(readiness.repositoryCount, 7);
    assert.equal(readiness.nonRepositoryReferenceCount, 3);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
  });
});

describe("requested repository runtime surfaces", () => {
  it("publishes the governed public repository catalog", async () => {
    const response = await request(app)
      .get("/api/ecosystem/requested-repositories")
      .set("Accept", "application/json");

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.repositoryCount, 34);
    assert.equal(response.body.verifiedCount, 32);
    assert.equal(response.body.blockedCount, 2);
    assert.equal(response.body.screenshotResearchCount, 24);
    assert.equal(response.body.unresolvedVisualLeadCount, 3);
    assert.equal(response.body.nonRepositoryReferenceCount, 3);
    assert.deepEqual(
      response.body.repositories.map((item) => item.key),
      [...EXPECTED_KEYS, ...SCREENSHOT_KEYS, ...SCREENSHOT_BATCH2_KEYS, ...SCREENSHOT_BATCH3_KEYS]
    );
    assert.deepEqual(response.body.unresolvedVisualLeads.map((item) => item.key), UNVERIFIED_BATCH2_KEYS);
    assert.deepEqual(response.body.nonRepositoryReferences.map((item) => item.key), NON_REPOSITORY_BATCH3_KEYS);
  });

  it("renders a public research page without executing external tools", async () => {
    const response = await request(app).get("/research-lab/requested-repositories");
    assert.equal(response.status, 200);
    assert.match(response.text, /Governed external repository intake/);
    assert.match(response.text, /24 additional developer, design, media, security, research, infrastructure, document, social, 3D, and agent tools/);
    assert.match(response.text, /3 screenshot items were verified as hosted services or learning references/);
    assert.match(response.text, /3 screenshot concepts remain intentionally unlinked/);
    assert.match(response.text, /No third-party repository is cloned, installed, executed, or enabled/);
  });

  it("protects repository readiness behind founder/admin authentication", async () => {
    const response = await request(app)
      .get("/api/admin/requested-repositories/readiness")
      .set("Accept", "application/json");

    assert.notEqual(response.status, 200);
    assert.ok([401, 503].includes(response.status));
    assert.ok(["admin_auth_required", "setup_required"].includes(response.body.code));
  });
});
