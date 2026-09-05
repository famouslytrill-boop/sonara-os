"use strict";

// Deterministic evidence manifest for the Facebook research batch submitted on
// 2026-09-01. A social caption is not a repository identity, so unresolved
// sources stay unresolved. The open-source register remains the authority for
// licence, commercial-use, product-fit, and integration decisions.

const SOURCE_BASE = "https://www.facebook.com/share";

function source(type, id, evidenceStatus, repositorySlugs, evidenceNote) {
  return Object.freeze({
    sourceId: id,
    sourceUrl: `${SOURCE_BASE}/${type}/${id}/`,
    evidenceStatus,
    repositorySlugs: Object.freeze(repositorySlugs),
    evidenceNote
  });
}

const SOCIAL_REPOSITORY_INTAKE = Object.freeze([
  source("v", "1DPaxo2T9y", "verified_repository", ["gitmcp-public-repository-context", "gitingest-public-repository-extract", "gitdiagram-public-architecture-reference"], "The reel visibly identified three GitHub URL-swap tools."),
  source("r", "17p9cBgmmy", "verified_repository", ["openvid-browser-product-demo-editor"], "The repository identity matched the visible OpenVid project."),
  source("r", "19FghXBn7Q", "partially_verified", ["huggingface-transformers-model-framework"], "One repository in the roundup was identifiable; the other entries were not guessed."),
  source("r", "1EzoaEnecz", "unresolved", [], "The roundup did not expose stable repository identities."),
  source("r", "1FfFNLMCpu", "verified_repository", ["archify-verifiable-architecture-skill"], "The project name and upstream repository matched Archify."),
  source("r", "1Eyq384unv", "unresolved", [], "The post used a direct-message gate and did not expose a repository."),
  source("r", "1MuPyaPKns", "verified_repository", ["yt-short-clipper-creator-video-reference"], "The repository name was visible in the submitted media."),
  source("r", "1K2oakAbX1", "verified_repository", ["reverse-skill-restricted-security-router"], "The repository identity matched reverse-skill."),
  source("r", "1Bqgq9jTJs", "verified_repository", ["x-cmd-command-toolkit-reference"], "The repository identity matched x-cmd."),
  source("r", "19GFVNabKo", "service_only", [], "An AI-skills website was visible, but no repository identity was provided."),
  source("r", "1DL8vSJSZ5", "verified_repository", ["metabigor-restricted-osint-reference"], "The repository identity matched Metabigor."),
  source("r", "1BKz7WEVxK", "verified_repository", ["paperless-ngx-document-management-reference"], "The repository identity matched Paperless-ngx."),
  source("r", "1cnvVFdjNw", "unresolved", [], "The generic roundup did not expose a stable repository identity."),
  source("r", "19UAV4yLf7", "verified_repository", ["mattpocock-engineering-skills-reference"], "The repository identity matched the engineering skills collection."),
  source("r", "1XzmTQqDUT", "service_only", [], "The content showed a hosted video workflow, not a verifiable repository."),
  source("r", "14nsKtqCAhW", "unresolved", [], "The generic roundup did not expose a stable repository identity."),
  source("r", "1BmRJnzfnk", "unresolved", [], "The generic roundup did not expose a stable repository identity."),
  source("r", "14qPEBmfc3i", "verified_repository", ["plane-project-management-reference"], "The repository identity matched Plane."),
  source("r", "1HADLJhQ8u", "verified_repository", ["unsloth"], "The repository identity matched the existing Unsloth registry record."),
  source("r", "1CLxRtNDnD", "verified_repository", ["ragflow-governed-retrieval-stack"], "The repository identity matched the existing RAGFlow registry record."),
  source("r", "1VNGZWpbAx", "verified_repository", ["public-apis"], "The repository identity matched Public APIs."),
  source("r", "184RFngucs", "verified_repository", ["openviking-agent-context-database-reference"], "The repository identity matched OpenViking."),
  source("r", "1NBjY9UJZc", "unresolved", [], "The generic roundup did not expose a stable repository identity."),
  source("r", "1ZoAFRidaM", "unresolved", [], "The generic roundup did not expose a stable repository identity."),
  source("r", "19UuU8RWv2", "unresolved", [], "The generic roundup did not expose a stable repository identity."),
  source("r", "1FQnRfHEaQ", "unresolved", [], "The generic roundup did not expose a stable repository identity."),
  source("r", "1K4xBGQYYj", "unresolved", [], "The generic roundup did not expose a stable repository identity."),
  source("r", "1AYjVDsV8r", "verified_repository", ["freetoken-local-moe-runtime-research"], "The repository identity matched FreeToken."),
  source("r", "1EMaaXEVon", "unresolved", [], "The post named a comment-agent concept but no repository."),
  source("r", "1RXDd9r1AY", "unresolved", [], "The generic roundup did not expose a stable repository identity."),
  source("r", "1cMoLbmDzk", "verified_repository", ["doop-multiplayer-ai-design-canvas-reference"], "The repository identity matched Doop."),
  source("r", "1D9F1EZ9M7", "verified_repository", ["codegraff-self-evolving-agent-harness-reference"], "The repository identity matched Codegraff."),
  source("r", "1DkHZ8dDUD", "verified_repository", ["voicestudio-restricted-local-voice-reference"], "The repository identity matched VoiceStudio."),
  source("r", "1ZYcDFvGTN", "verified_repository", ["openhuman-personal-memory-agent-reference"], "The repository identity matched OpenHuman."),
  source("r", "1DhdrRX32t", "verified_repository", ["flint-local-knowledge-graph-reference"], "The duplicate source occurrence was deduplicated and matched Flint."),
  source("v", "1LyiihCQZF", "service_only", [], "The content described the commercial OpenArt service, not a source repository."),
  source("r", "1G9KdvosF9", "verified_repository", ["fal-3d-anything-image-to-3d-blocked"], "The exact description matched fal-3d-anything; the project remains blocked because no licence file exists."),
  source("r", "1C7VGngudM", "verified_repository", ["face-anything-biometric-research-blocked"], "The repository identity matched Face Anything."),
  source("r", "18Ey9ezVYD", "verified_repository", ["opencompany-autonomous-business-agent-reference"], "The repository identity matched OpenCompany."),
  source("r", "1EfYGic2SQ", "unresolved", [], "The post named a local-comment concept but no repository."),
  source("r", "1GZN3eSprZ", "unresolved", [], "The voice guide did not expose a stable repository identity."),
  source("r", "19ZUj5mYZo", "verified_repository", ["nodegraphqt-visual-workflow-reference"], "The repository identity matched NodeGraphQt."),
  source("r", "1QLzKSrmGc", "verified_repository", ["uniface-biometric-analysis-blocked"], "The repository identity matched UniFace."),
  source("r", "19oCNY9KgQ", "verified_repository", ["donkey-cut-video-editor-reference"], "The repository identity matched Donkey Cut."),
  source("r", "19eJpffRxd", "verified_repository", ["anycreature-3d-generation-reference"], "The repository identity matched AnyCreature."),
  source("r", "199DUw5qPN", "verified_repository", ["bolt-slides-interactive-presentation-reference"], "The repository identity matched Bolt Slides."),
  source("r", "19HvSPfsaL", "verified_repository", ["google-sam-agent-mesh-research"], "The repository identity matched Google's SAM project."),
  source("v", "19Kj9PnLCY", "verified_repository", ["gortex-local-code-graph-reference"], "The repository identity matched Gortex."),
  source("p", "18W3zqQY2V", "verified_repository", ["geo-seo-claude-growth-skill-reference"], "The shared post exposed the GEO SEO Claude repository."),
  source("p", "1982u6c8cg", "verified_repository", ["stratum-authenticator-app"], "The malformed combined link explicitly included the existing Stratum Auth repository URL."),
]);

const NEW_REPOSITORY_SLUGS = Object.freeze([
  "gitmcp-public-repository-context",
  "gitingest-public-repository-extract",
  "gitdiagram-public-architecture-reference",
  "openvid-browser-product-demo-editor",
  "huggingface-transformers-model-framework",
  "archify-verifiable-architecture-skill",
  "yt-short-clipper-creator-video-reference",
  "reverse-skill-restricted-security-router",
  "x-cmd-command-toolkit-reference",
  "metabigor-restricted-osint-reference",
  "paperless-ngx-document-management-reference",
  "mattpocock-engineering-skills-reference",
  "plane-project-management-reference",
  "openviking-agent-context-database-reference",
  "freetoken-local-moe-runtime-research",
  "doop-multiplayer-ai-design-canvas-reference",
  "codegraff-self-evolving-agent-harness-reference",
  "voicestudio-restricted-local-voice-reference",
  "openhuman-personal-memory-agent-reference",
  "flint-local-knowledge-graph-reference",
  "fal-3d-anything-image-to-3d-blocked",
  "face-anything-biometric-research-blocked",
  "opencompany-autonomous-business-agent-reference",
  "nodegraphqt-visual-workflow-reference",
  "uniface-biometric-analysis-blocked",
  "donkey-cut-video-editor-reference",
  "anycreature-3d-generation-reference",
  "bolt-slides-interactive-presentation-reference",
  "google-sam-agent-mesh-research",
  "gortex-local-code-graph-reference",
  "geo-seo-claude-growth-skill-reference"
]);

const EXISTING_REPOSITORY_SLUGS = Object.freeze([
  "public-apis",
  "ragflow-governed-retrieval-stack",
  "stratum-authenticator-app",
  "unsloth"
]);

function getSocialRepositoryIntakeSummary() {
  const repositorySlugs = new Set(SOCIAL_REPOSITORY_INTAKE.flatMap((item) => item.repositorySlugs));
  const unresolvedSources = SOCIAL_REPOSITORY_INTAKE.filter((item) => item.repositorySlugs.length === 0);
  return Object.freeze({
    sourceCount: SOCIAL_REPOSITORY_INTAKE.length,
    verifiedRepositoryCount: repositorySlugs.size,
    newRepositoryCount: NEW_REPOSITORY_SLUGS.length,
    existingRepositoryCount: EXISTING_REPOSITORY_SLUGS.length,
    unresolvedOrServiceSourceCount: unresolvedSources.length
  });
}

module.exports = {
  SOCIAL_REPOSITORY_INTAKE,
  NEW_REPOSITORY_SLUGS,
  EXISTING_REPOSITORY_SLUGS,
  getSocialRepositoryIntakeSummary
};
