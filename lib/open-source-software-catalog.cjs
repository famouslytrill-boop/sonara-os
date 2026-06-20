"use strict";

const OPEN_SOURCE_SOFTWARE_CATEGORIES = [
  "backend",
  "database",
  "database_ai",
  "database_geo",
  "identity",
  "security",
  "infrastructure",
  "hosting",
  "network",
  "database_cache",
  "storage",
  "search",
  "vector_database",
  "analytics",
  "observability",
  "audio_ai",
  "music_theory",
  "music_notation",
  "audio_fingerprint",
  "audio_metadata",
  "media",
  "speech",
  "ocr",
  "documents",
  "automation_ai",
  "automation",
  "ai_compute",
  "ai_ops",
  "local_ai",
  "ai_inference",
  "ai_ml",
  "optimization",
  "data_tools",
  "data_ingest",
  "business_ops",
  "commerce",
  "music_library",
  "realtime_media",
  "video_platform",
  "streaming",
  "maps",
  "transit",
  "civic",
  "barcode",
  "ai_video",
  "iot"
];

const OPEN_SOURCE_PRODUCT_AREAS = [
  "all",
  "business_builder",
  "creator_studio",
  "growth_studio"
];

const OPEN_SOURCE_INTEGRATION_MODES = [
  "dependency",
  "service",
  "adapter_candidate",
  "manual_export",
  "self_hosted",
  "external_api",
  "research_only",
  "disabled"
];

const OPEN_SOURCE_REVIEW_RULES = [
  "Do not install catalog tools as runtime dependencies until product fit, license, security, and cost are reviewed.",
  "Prefer isolated worker services for heavy AI, OCR, audio, and video workloads.",
  "Keep the Express app lean; do not turn it into a junk drawer with a port number.",
  "Any tool that processes user files must have storage, privacy, and deletion behavior documented.",
  "Any scraping, civic, media, or AI provider workflow must pass legal and terms review first.",
  "Self-hosted infrastructure must have monitoring, backups, and owner access controls before production use."
];

const OPEN_SOURCE_ROUTE_PLAN = {
  catalogPage: "/admin/open-source-software",
  catalogApi: "/api/open-source-software",
  capabilityApi: "/api/open-source-software/capabilities",
  adapterRunsApi: "/api/open-source-software/adapter-runs",
  readinessApi: "/api/open-source-software/readiness"
};

module.exports = {
  OPEN_SOURCE_SOFTWARE_CATEGORIES,
  OPEN_SOURCE_PRODUCT_AREAS,
  OPEN_SOURCE_INTEGRATION_MODES,
  OPEN_SOURCE_REVIEW_RULES,
  OPEN_SOURCE_ROUTE_PLAN
};
