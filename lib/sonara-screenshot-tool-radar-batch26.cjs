// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Screenshot research intake from 80 user-supplied images; no third-party code,
// model, customer data, runtime capability, privileged scanner or production authority is installed.
// Original screenshots remain outside the public repository.

const SCREENSHOT_TOOL_RADAR_BATCH26 = Object.freeze([
  {
    "key": "free_llm_api_directory",
    "label": "Free LLM API directory",
    "repository": "golapkamal/awesome-free-llm-apis",
    "license": "MIT",
    "licenseRisk": "low",
    "reciprocalLicense": false,
    "runtimeClass": "provider_discovery_directory",
    "productFit": [
      "Research Lab",
      "Provider Gateway"
    ],
    "capabilities": [
      "model catalog",
      "free tier discovery"
    ],
    "safety": [
      "Free API claims and rate limits require verification at each provider; catalog data cannot supply model rights.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "promising zero-cost test fixtures",
      "granting model/API credentials from directory listings"
    ],
    "nextStep": "Compare five eligible providers against SONARA's audited live pricing/usage data before any provider adapter.",
    "repoUrl": "https://github.com/golapkamal/awesome-free-llm-apis",
    "sourceEvidence": [
      "https://github.com/golapkamal/awesome-free-llm-apis",
      "https://github.com/golapkamal/awesome-free-llm-apis/blob/main/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "glances_metrics",
    "label": "Glances",
    "repository": "nicolargo/glances",
    "license": "LGPL-3.0",
    "licenseRisk": "medium",
    "reciprocalLicense": true,
    "runtimeClass": "host_observability",
    "productFit": [
      "Internal Development",
      "Operations"
    ],
    "capabilities": [
      "CPU/RAM metrics",
      "host diagnostics"
    ],
    "safety": [
      "Running host telemetry and MCP/network endpoints must stay authenticated, redacted, bounded and outside Vercel request handlers.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "public Glances dashboard",
      "placing raw tenant or host identifiers in telemetry"
    ],
    "nextStep": "Benchmark read-only local Glances metrics against existing SONARA OpenTelemetry dashboards.",
    "repoUrl": "https://github.com/nicolargo/glances",
    "sourceEvidence": [
      "https://github.com/nicolargo/glances",
      "https://github.com/nicolargo/glances/blob/develop/COPYING"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "dbx_developer_database",
    "label": "DBX",
    "repository": "t8y2/dbx",
    "license": "Apache-2.0",
    "licenseRisk": "low",
    "reciprocalLicense": false,
    "runtimeClass": "local_database_developer_tool",
    "productFit": [
      "Internal Development",
      "Database"
    ],
    "capabilities": [
      "local database viewing",
      "multiple adapters"
    ],
    "safety": [
      "The desktop tool cannot replace Postgres migration authority or production credential governance.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "customer production database as a developer sandbox",
      "automatic SQL mutations"
    ],
    "nextStep": "Use disposable database fixtures to benchmark schema inspection, never live customer credentials.",
    "repoUrl": "https://github.com/t8y2/dbx",
    "sourceEvidence": [
      "https://github.com/t8y2/dbx",
      "https://github.com/t8y2/dbx/blob/main/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "osmantic_ods",
    "label": "Osmantic ODS",
    "repository": "Osmantic/ODS",
    "license": "Apache-2.0 core; Pixel has ODS-only restricted license",
    "licenseRisk": "high",
    "reciprocalLicense": false,
    "runtimeClass": "local_ai_stack_orchestration",
    "productFit": [
      "Internal Development",
      "Creator Studio"
    ],
    "capabilities": [
      "local inference setup",
      "local services dashboard"
    ],
    "safety": [
      "Bundled Pixel is not Apache-licensed for standalone reuse; model/service/assets need separate rights.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "repackaging Pixel in SONARA",
      "piping unverified remote installers into a production host"
    ],
    "nextStep": "Compare an isolated local install manifest with SONARA's existing Provider Gateway and ops stack.",
    "repoUrl": "https://github.com/Osmantic/ODS",
    "sourceEvidence": [
      "https://github.com/Osmantic/ODS",
      "https://github.com/Osmantic/ODS/blob/main/ods/LICENSING.md",
      "https://github.com/Osmantic/ODS/blob/main/vendor/pixel/LICENSE.md"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "edgeever_knowledge",
    "label": "EdgeEver",
    "repository": "tianma-if/edgeever",
    "license": "AGPL-3.0",
    "licenseRisk": "high",
    "reciprocalLicense": true,
    "runtimeClass": "self_hosted_knowledge_base",
    "productFit": [
      "Research Lab",
      "SONARA One"
    ],
    "capabilities": [
      "portable notes",
      "knowledge retrieval"
    ],
    "safety": [
      "AGPL network-service obligations need legal review before combining source with a hosted service.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "embedding AGPL source into proprietary hosted modules",
      "silently importing user notes"
    ],
    "nextStep": "Evaluate portable export, user-owned content and document versioning as clean-room features.",
    "repoUrl": "https://github.com/tianma-if/edgeever",
    "sourceEvidence": [
      "https://github.com/tianma-if/edgeever",
      "https://github.com/tianma-if/edgeever/blob/main/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "null_motion_license_pending",
    "label": "Null Motion",
    "repository": "blixvip/NullMotion",
    "license": "NO LICENSE FILE DECLARED for original code; GSAP and mp4-muxer have separate terms",
    "licenseRisk": "high",
    "reciprocalLicense": false,
    "runtimeClass": "media_render_review_tool",
    "productFit": [
      "Creator Studio"
    ],
    "capabilities": [
      "draft-to-final frame analysis",
      "WebCodecs previews"
    ],
    "safety": [
      "The project includes GSAP under separate conditions; a third-party notice is not permission to reuse its original source.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "copying unlicensed application source",
      "shipping bundled GSAP without terms review"
    ],
    "nextStep": "Model a clean-room render-diff receipt against SONARA-owned frame fixtures.",
    "repoUrl": "https://github.com/blixvip/NullMotion",
    "sourceEvidence": [
      "https://github.com/blixvip/NullMotion",
      "https://github.com/blixvip/NullMotion/blob/main/THIRD_PARTY_NOTICES.md"
    ],
    "repositoryVerified": true,
    "integrationStatus": "reference_only_no_license",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "rad_debugger",
    "label": "RAD Debugger",
    "repository": "EpicGames/raddebugger",
    "license": "MIT",
    "licenseRisk": "low",
    "reciprocalLicense": false,
    "runtimeClass": "native_local_debugger",
    "productFit": [
      "Internal Development"
    ],
    "capabilities": [
      "native debugging",
      "timeline inspection"
    ],
    "safety": [
      "A debugger is workstation-only; no access to live customer memory or application production credentials.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "shipping debugger inside SaaS",
      "reading customer processes without permission"
    ],
    "nextStep": "Assess a local native crash trace workflow on a disposable program.",
    "repoUrl": "https://github.com/EpicGames/raddebugger",
    "sourceEvidence": [
      "https://github.com/EpicGames/raddebugger",
      "https://github.com/EpicGames/raddebugger/blob/master/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "yolo_projects_lab",
    "label": "YOLO computer-vision examples",
    "repository": "Nawaf-Rayhan585/YOLO_Projects",
    "license": "MIT (repository scripts only)",
    "licenseRisk": "medium",
    "reciprocalLicense": false,
    "runtimeClass": "computer_vision_research_examples",
    "productFit": [
      "Business Builder",
      "Security Lab"
    ],
    "capabilities": [
      "object detection",
      "people count",
      "privacy masking"
    ],
    "safety": [
      "Model weights, example data, surveillance rights, biometric processing and individual consent require separate review.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "unconsented monitoring or face identification",
      "copying unlicensed model weights"
    ],
    "nextStep": "Benchmark synthetic footfall counts and face-masking errors using test footage with explicit rights.",
    "repoUrl": "https://github.com/Nawaf-Rayhan585/YOLO_Projects",
    "sourceEvidence": [
      "https://github.com/Nawaf-Rayhan585/YOLO_Projects",
      "https://github.com/Nawaf-Rayhan585/YOLO_Projects/blob/main/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "showtime_creator_worker",
    "label": "showtime local video studio",
    "repository": "FavioVazquez/showtime",
    "license": "MIT",
    "licenseRisk": "low",
    "reciprocalLicense": false,
    "runtimeClass": "local_media_worker_candidate",
    "productFit": [
      "Creator Studio",
      "Internal Development"
    ],
    "capabilities": [
      "code-directed video",
      "local compositing",
      "rendered output"
    ],
    "safety": [
      "Run only in isolated CPU/GPU workers with file and egress limits; generated assets require independent rights records.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "rendering in synchronous API request",
      "publishing without user rights and approval"
    ],
    "nextStep": "Render one 10-second test composition with repeatable job receipts and bounded CPU/time usage.",
    "repoUrl": "https://github.com/FavioVazquez/showtime",
    "sourceEvidence": [
      "https://github.com/FavioVazquez/showtime",
      "https://github.com/FavioVazquez/showtime/blob/main/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "gem_search_research",
    "label": "Gem Search",
    "repository": "h100envy/gem-search",
    "license": "MIT",
    "licenseRisk": "medium",
    "reciprocalLicense": false,
    "runtimeClass": "local_browser_research_companion",
    "productFit": [
      "Growth Studio",
      "Research Lab"
    ],
    "capabilities": [
      "evidence-linked browser research",
      "local discovery"
    ],
    "safety": [
      "Browser automation must respect permissions, site terms, personal data and user-approved network destinations.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "unrestricted scraping or logged-in account crawling",
      "unreviewed trading actions"
    ],
    "nextStep": "Compare source provenance, citation traceability and deletion controls with SONARA Research Lab.",
    "repoUrl": "https://github.com/h100envy/gem-search",
    "sourceEvidence": [
      "https://github.com/h100envy/gem-search",
      "https://github.com/h100envy/gem-search/blob/main/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "procedural_buildings_3d",
    "label": "ProceduralBuildingsThreeJS",
    "repository": "achrefelouafi/ProceduralBuildingsThreeJS",
    "license": "MIT",
    "licenseRisk": "low",
    "reciprocalLicense": false,
    "runtimeClass": "procedural_geometry_web_reference",
    "productFit": [
      "Creator Studio",
      "Business Builder"
    ],
    "capabilities": [
      "parametric buildings",
      "WebGL preview"
    ],
    "safety": [
      "Imported assets and architecture-plan accuracy require separate review; 3D previews are not engineering certification.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "certified building designs from synthetic geometry",
      "unlicensed model assets"
    ],
    "nextStep": "Prototype one editable low-poly building with mobile WebGL and reduced-motion fallback.",
    "repoUrl": "https://github.com/achrefelouafi/ProceduralBuildingsThreeJS",
    "sourceEvidence": [
      "https://github.com/achrefelouafi/ProceduralBuildingsThreeJS",
      "https://github.com/achrefelouafi/ProceduralBuildingsThreeJS/blob/main/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "huashu_art_motion",
    "label": "huashu-art-motion",
    "repository": "alchaincyf/huashu-art-motion",
    "license": "MIT (source; art rights separate)",
    "licenseRisk": "medium",
    "reciprocalLicense": false,
    "runtimeClass": "code_directed_animation_reference",
    "productFit": [
      "Creator Studio"
    ],
    "capabilities": [
      "animation style recipes",
      "timeline references"
    ],
    "safety": [
      "Animation examples and pictured characters may carry independent copyright/trademark rights.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "copying artwork or characters",
      "assuming example audio rights"
    ],
    "nextStep": "Build one original SONARA-owned animation style specification and verify frame timing.",
    "repoUrl": "https://github.com/alchaincyf/huashu-art-motion",
    "sourceEvidence": [
      "https://github.com/alchaincyf/huashu-art-motion",
      "https://github.com/alchaincyf/huashu-art-motion/blob/main/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "facet_photo_culling",
    "label": "Facet photo culling",
    "repository": "ncoevoet/facet",
    "license": "MIT (LICENSE read; metadata unresolved)",
    "licenseRisk": "low",
    "reciprocalLicense": false,
    "runtimeClass": "local_photo_selection_reference",
    "productFit": [
      "Creator Studio"
    ],
    "capabilities": [
      "quality scoring",
      "photo culling"
    ],
    "safety": [
      "Subject imagery, face analysis and retention require consent; quality scores are recommendations, not ground truth.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "automatic deletion of customer originals",
      "face identity inference"
    ],
    "nextStep": "Benchmark image-quality sorting on an opt-in synthetic photo set.",
    "repoUrl": "https://github.com/ncoevoet/facet",
    "sourceEvidence": [
      "https://github.com/ncoevoet/facet",
      "https://github.com/ncoevoet/facet/blob/master/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "anyps5_emulator",
    "label": "AnyPS5",
    "repository": "boykopovar/AnyPS5",
    "license": "GPL-2.0",
    "licenseRisk": "high",
    "reciprocalLicense": true,
    "runtimeClass": "console_emulation_research",
    "productFit": [
      "Research Lab",
      "Internal Development"
    ],
    "capabilities": [
      "input emulation",
      "shader research"
    ],
    "safety": [
      "Experimental emulator does not establish game compatibility or redistribution rights for firmware/game content.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "bundling copyrighted game assets",
      "advertising playable PS5 support"
    ],
    "nextStep": "Reference graphics validation techniques without adopting emulator runtime.",
    "repoUrl": "https://github.com/boykopovar/AnyPS5",
    "sourceEvidence": [
      "https://github.com/boykopovar/AnyPS5",
      "https://github.com/boykopovar/AnyPS5/blob/main/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "secret_knowledge_security",
    "label": "Book of Secret Knowledge",
    "repository": "trimstray/the-book-of-secret-knowledge",
    "license": "MIT",
    "licenseRisk": "medium",
    "reciprocalLicense": false,
    "runtimeClass": "security_research_directory",
    "productFit": [
      "Internal Development",
      "Security Lab"
    ],
    "capabilities": [
      "hardening resource index",
      "security education"
    ],
    "safety": [
      "External security commands require individual review and authorized scope; the index is not a compliance certification.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "automatic execution of listed commands",
      "third-party scans without permission"
    ],
    "nextStep": "Extract a source-grounded internal hardening checklist without executing external commands.",
    "repoUrl": "https://github.com/trimstray/the-book-of-secret-knowledge",
    "sourceEvidence": [
      "https://github.com/trimstray/the-book-of-secret-knowledge",
      "https://github.com/trimstray/the-book-of-secret-knowledge/blob/master/LICENSE.md"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "owasp_amass_inventory",
    "label": "OWASP Amass",
    "repository": "owasp-amass/amass",
    "license": "Apache-2.0 (LICENSE text; metadata unresolved)",
    "licenseRisk": "medium",
    "reciprocalLicense": false,
    "runtimeClass": "authorized_attack_surface_inventory",
    "productFit": [
      "Internal Development",
      "Security Lab"
    ],
    "capabilities": [
      "external asset discovery",
      "authorized perimeter inventory"
    ],
    "safety": [
      "Network scans and OSINT may be active; explicit approved domains/assets, rate budgets and audit are mandatory.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "scanning arbitrary customers or unrelated organizations",
      "unbounded internet reconnaissance"
    ],
    "nextStep": "Test only against an owned test domain or fully synthetic DNS fixtures with named authorization.",
    "repoUrl": "https://github.com/owasp-amass/amass",
    "sourceEvidence": [
      "https://github.com/owasp-amass/amass",
      "https://github.com/owasp-amass/amass/blob/main/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "macos_swift_catalog",
    "label": "Awesome Swift macOS Apps",
    "repository": "jaywcjlove/awesome-swift-macos-apps",
    "license": "CC0-1.0 (catalog content; linked apps independent)",
    "licenseRisk": "low",
    "reciprocalLicense": false,
    "runtimeClass": "desktop_reference_directory",
    "productFit": [
      "Internal Development",
      "Mobile Verification"
    ],
    "capabilities": [
      "native desktop patterns",
      "market scanning"
    ],
    "safety": [
      "The curated list grants no permission over each linked application or its assets.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "bulk installation of listed apps",
      "assuming linked apps are CC0"
    ],
    "nextStep": "Use a read-only desktop-UX feature taxonomy to plan SONARA device parity.",
    "repoUrl": "https://github.com/jaywcjlove/awesome-swift-macos-apps",
    "sourceEvidence": [
      "https://github.com/jaywcjlove/awesome-swift-macos-apps",
      "https://github.com/jaywcjlove/awesome-swift-macos-apps/blob/main/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "microsoft_autogen_reference",
    "label": "Microsoft AutoGen",
    "repository": "microsoft/autogen",
    "license": "MIT code LICENSE-CODE; CC-BY-4.0 documentation LICENSE",
    "licenseRisk": "medium",
    "reciprocalLicense": false,
    "runtimeClass": "multi_agent_framework_reference",
    "productFit": [
      "Internal Development",
      "Agent Control Plane"
    ],
    "capabilities": [
      "agent conversation patterns",
      "distributed orchestration reference"
    ],
    "safety": [
      "External framework actions must pass SONARA agent-authority, tenant permissions and Provider Gateway.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "installing as second unattended agent authority",
      "model tool calls with unrestricted credentials"
    ],
    "nextStep": "Compare typed handoffs and bounded agent state against SONARA's current action runner.",
    "repoUrl": "https://github.com/microsoft/autogen",
    "sourceEvidence": [
      "https://github.com/microsoft/autogen",
      "https://github.com/microsoft/autogen/blob/main/LICENSE-CODE",
      "https://github.com/microsoft/autogen/blob/main/LICENSE"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "sharpemu_emulation_research",
    "label": "SharpEmu",
    "repository": "sharpemu/sharpemu",
    "license": "GPL-2.0",
    "licenseRisk": "high",
    "reciprocalLicense": true,
    "runtimeClass": "experimental_console_emulator",
    "productFit": [
      "Research Lab",
      "Internal Development"
    ],
    "capabilities": [
      "graphics research",
      "emulator architecture"
    ],
    "safety": [
      "Pre-production compatibility and intellectual property risk; no PlayStation firmware or games bundled.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "marketed console compatibility",
      "shipping game/firmware assets"
    ],
    "nextStep": "Use only public emulation architecture concepts; do not integrate the runtime.",
    "repoUrl": "https://github.com/sharpemu/sharpemu",
    "sourceEvidence": [
      "https://github.com/sharpemu/sharpemu",
      "https://github.com/sharpemu/sharpemu/blob/main/LICENSE.txt"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "linux_server_hardening_guide",
    "label": "How To Secure A Linux Server",
    "repository": "imthenachoman/How-To-Secure-A-Linux-Server",
    "license": "CC-BY-SA-4.0 (documentation)",
    "licenseRisk": "medium",
    "reciprocalLicense": true,
    "runtimeClass": "server_hardening_guide",
    "productFit": [
      "Internal Development",
      "Security Lab"
    ],
    "capabilities": [
      "system hardening steps",
      "secure configuration reference"
    ],
    "safety": [
      "Guide commands are version-dependent and must be reviewed with a rollback and current OS benchmark.",
      "Research state grants no runtime permissions, secrets or customer-data access."
    ],
    "blockedUses": [
      "blind execution on production systems",
      "treating an old guide as audit proof"
    ],
    "nextStep": "Evaluate a check-only Linux baseline on a disposable VM; require owner approval for hardening changes.",
    "repoUrl": "https://github.com/imthenachoman/How-To-Secure-A-Linux-Server",
    "sourceEvidence": [
      "https://github.com/imthenachoman/How-To-Secure-A-Linux-Server",
      "https://github.com/imthenachoman/How-To-Secure-A-Linux-Server/blob/master/LICENSE.txt"
    ],
    "repositoryVerified": true,
    "integrationStatus": "research_only",
    "integrationMode": "non_executing_research",
    "placement": "Reference / isolated prototype only; no deployment or production credentials",
    "checkedOn": "2026-10-08",
    "configurationStatus": "cataloged_disabled",
    "runtimeStatus": "not_executed",
    "enabledInProduction": false,
    "canExecute": false,
    "humanReviewRequired": true,
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  }
].map((item) => Object.freeze({
  ...item,
  productFit: Object.freeze(item.productFit),
  capabilities: Object.freeze(item.capabilities),
  safety: Object.freeze(item.safety),
  blockedUses: Object.freeze(item.blockedUses),
  sourceEvidence: Object.freeze(item.sourceEvidence)
})));

const CONFIRMED_EXISTING_RECORDS_BATCH26 = Object.freeze([
  {
    "key": "existing_h3_batch22",
    "label": "OpenH3-IR",
    "repository": "ruashots/open-h3-ir",
    "source": "Existing SONARA screenshot radar",
    "note": "Already governed in Batch 22, including US model-territory restrictions; do not duplicate or call MiniMax H3."
  },
  {
    "key": "existing_e2e_batch23",
    "label": "TesterArmy e2e",
    "repository": "tester-army/e2e",
    "source": "Existing SONARA screenshot radar",
    "note": "Already governed in Batch 23; Playwright and exact-head deterministic assertions remain authoritative."
  },
  {
    "key": "existing_voxcpm2_batch14",
    "label": "VoxCPM2",
    "source": "Existing SONARA screenshot radar",
    "note": "Voice cloning/synthesis already has provenance, consent and licensing risks in Batch 14; no voice-clone activation."
  },
  {
    "key": "existing_n8n_workflows",
    "label": "n8n",
    "source": "Existing SONARA screenshot radar",
    "note": "Workflow integration already exists; screenshot does not authorize customer messaging or automatic posting."
  },
  {
    "key": "existing_trivy_scanner",
    "label": "Trivy",
    "source": "Existing SONARA screenshot radar",
    "note": "Security tooling already used in SONARA security pipeline; do not install a parallel scanner."
  },
  {
    "key": "existing_hyperframes_media",
    "label": "HyperFrames",
    "source": "Existing SONARA screenshot radar",
    "note": "Media worker candidate already catalogued; benchmark rather than duplicate render execution."
  },
  {
    "key": "existing_data_formulator",
    "label": "Data Formulator",
    "repository": "microsoft/data-formulator",
    "source": "Existing SONARA screenshot radar",
    "note": "Already source-verified in Batch 22; charting must stay tenant-scoped with source evidence."
  }
].map((item) => Object.freeze(item)));

const NON_REPOSITORY_REFERENCES_BATCH26 = Object.freeze([
  {
    "key": "artcraft_claim",
    "label": "ArtCraft seven-app social claim",
    "status": "unverified_marketing_claim",
    "observedTheme": "A website advertises Adobe-alternative creative apps; no demonstrated parity, licensing, binary provenance or current complete suite.",
    "nextStep": "Verify official upstream, per-app licenses and runnable releases independently; no marketing claims.",
    "reason": "Unverified or non-executable reference. No install or production enablement.",
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "framefields_uncertain",
    "label": "framefields/gifframes motion renderer",
    "status": "upstream_identity_unverified",
    "observedTheme": "Screenshot depicts code-first video, but the visible handle/owner cannot be resolved authoritatively; do not guess a repo.",
    "nextStep": "Recover upstream project URL and actual LICENSE before any adoption.",
    "reason": "Unverified or non-executable reference. No install or production enablement.",
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "mesh_avatar_uncertain",
    "label": "Mesh Avatar Studio",
    "status": "upstream_identity_unverified",
    "observedTheme": "Avatar rigging preview screenshot; attempted visible repo path did not resolve.",
    "nextStep": "Resolve upstream and check image, identity, voice and avatar rights.",
    "reason": "Unverified or non-executable reference. No install or production enablement.",
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "mg_styles_uncertain",
    "label": "15 Motion Design Styles",
    "status": "upstream_identity_unverified",
    "observedTheme": "Two repeat screenshots with animation examples and prompts; visible repository handle did not resolve.",
    "nextStep": "Verify original repo and rights for animations, sound, code and published prompts.",
    "reason": "Unverified or non-executable reference. No install or production enablement.",
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "dbngin_desktop",
    "label": "DBngin desktop database manager",
    "status": "vendor_service_reference",
    "observedTheme": "Vendor screenshot, not an open-source code grant; local database UX is a design reference.",
    "nextStep": "Compare local version management to pnpm/Supabase development contract; do not install server software.",
    "reason": "Unverified or non-executable reference. No install or production enablement.",
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "lotvulture_camera",
    "label": "Lot Vulture parking analytics",
    "status": "video_analytics_sensitive_reference",
    "observedTheme": "A social post shows real-time occupancy inference from camera feeds; source and licensing are not fully reviewed.",
    "nextStep": "Require explicit camera owner consent, storage deletion and false-positive testing before a prototype.",
    "reason": "Unverified or non-executable reference. No install or production enablement.",
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "adscan_directory",
    "label": "ADscan Active Directory pentesting",
    "status": "authorized_security_only",
    "observedTheme": "Screenshot advertises credential-oriented directory attack methods under BSL 1.1; no exact upstream/license file verified.",
    "nextStep": "Keep research-only; never grant scanning or credential-harvesting tools an unscoped target.",
    "reason": "Unverified or non-executable reference. No install or production enablement.",
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "rag_15_concepts",
    "label": "RAG retrieval infographic",
    "status": "architecture_reference_only",
    "observedTheme": "Retrieval quality requires tenant-filtered metadata, hybrid search, reranking, citations and end-to-end evaluation.",
    "nextStep": "Apply to existing SONARA RAG services without adding unknown dependencies.",
    "reason": "Unverified or non-executable reference. No install or production enablement.",
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "dns_security_checklist",
    "label": "DNS server hardening infographic",
    "status": "security_reference_only",
    "observedTheme": "Operational DNS server diagrams are training aids, not an approved production zone or security configuration.",
    "nextStep": "Validate current provider DNS, SPF, DKIM, DMARC and resilience with approved configuration evidence.",
    "reason": "Unverified or non-executable reference. No install or production enablement.",
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "agentic_factory_diagram",
    "label": "Agentic software factory diagram",
    "status": "engineering_reference_only",
    "observedTheme": "Agents can suggest changes, but the exact-head CI and protected merge/deploy approvals remain mandatory.",
    "nextStep": "Test adversarial proposed fixes in isolated CI, with rollback and owner oversight.",
    "reason": "Unverified or non-executable reference. No install or production enablement.",
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "social_marketing_workflows",
    "label": "Social marketing and prospect automation posters",
    "status": "marketing_workflow_reference_only",
    "observedTheme": "Unverified lead-generation and social automation proposals cannot authorize outbound contact or misleading ROI claims.",
    "nextStep": "Use consent, suppression, audit, provenance, channel policies and explicit publish approval.",
    "reason": "Unverified or non-executable reference. No install or production enablement.",
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  },
  {
    "key": "sensitive_plate_capture",
    "label": "License plate OCR and people counting examples",
    "status": "privacy_sensitive_reference",
    "observedTheme": "Observed camera/OCR diagrams do not establish consent, accuracy, data minimization or a lawful purpose.",
    "nextStep": "Synthetic fixtures only until a formal privacy and approved customer deployment review.",
    "reason": "Unverified or non-executable reference. No install or production enablement.",
    "source": "user_submitted_screenshot_research_batch26_2026_10_08"
  }
].map((item) => Object.freeze(item)));

const ARCHITECTURE_EXTENSIONS_BATCH26 = Object.freeze([
  {
    "key": "source_intake_governance",
    "title": "Source-bound research intake",
    "product": "Research Lab",
    "principle": "Research may be published only as disabled, provenance-verified metadata.",
    "implementation": "Separate verified repository identity, exact license component, expected runtime, product fit, unresolved questions and customer-impacting authority."
  },
  {
    "key": "media_worker_job_receipt",
    "title": "Deterministic media worker receipt",
    "product": "Creator Studio",
    "principle": "A video demonstration is not a repeatable production render.",
    "implementation": "Persist job inputs/sha, allowed assets and license proof, frame/time budget, isolation, rendering tool version, output checksum, failure class and cancellation receipt."
  },
  {
    "key": "tenant_safe_hybrid_retrieval",
    "title": "Tenant-safe hybrid retrieval",
    "product": "SONARA One / all studios",
    "principle": "A citation is valid only if the authorized user could retrieve the underlying document.",
    "implementation": "Filter tenant permission before vector/lexical retrieval and reranking; store document version, chunk provenance, source IDs, confidence and explicit partial-results markers."
  },
  {
    "key": "bounded_camera_analytics",
    "title": "Bounded camera analytics",
    "product": "Business Builder",
    "principle": "Video feeds are higher-risk personal data; never activate from a screenshot.",
    "implementation": "Require lawful-purpose record, asset/camera ownership, opt-in consent, privacy masking, no face identification, retention TTL, scoped storage and accuracy audits."
  },
  {
    "key": "read_only_database_workspace",
    "title": "Read-only local database workspace",
    "product": "Internal Development",
    "principle": "Database tools are diagnostics, not migration authority.",
    "implementation": "Use synthetic databases, read-only credentials, named development env, query timeouts, explicit no-write mode and separate approved migration authority."
  },
  {
    "key": "human_governed_agent_repair",
    "title": "Human-governed agent repair",
    "product": "SONARA One / Platform",
    "principle": "Self-repair cannot mean bypassing GitHub CI or customer-data authorization.",
    "implementation": "Constrain agent write surface, independent reviewer, exact-SHA checks, failure injection, idempotency and owner approval before merge/deploy/security modification."
  },
  {
    "key": "local_ai_split_license",
    "title": "Local AI split-license review",
    "product": "Internal Development / Creator Studio",
    "principle": "An Apache/MIT project does not automatically license bundled models, commercial GUIs or creative assets.",
    "implementation": "Before execution, inventory each included image/model/font/runtime/source license; isolate egress, set CPU/GPU budget and record uninstall/revoke steps."
  }
].map((item) => Object.freeze(item)));

function getPublicScreenshotToolCatalogBatch26() {
  return SCREENSHOT_TOOL_RADAR_BATCH26.map((item) => ({
    ...item,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses],
    sourceEvidence: [...item.sourceEvidence]
  }));
}
function getNonRepositoryReferencesBatch26() { return NON_REPOSITORY_REFERENCES_BATCH26.map((item) => ({...item})); }
function getConfirmedExistingRecordsBatch26() { return CONFIRMED_EXISTING_RECORDS_BATCH26.map((item) => ({...item})); }
function getArchitectureExtensionsBatch26() { return ARCHITECTURE_EXTENSIONS_BATCH26.map((item) => ({...item})); }
function getScreenshotToolReadinessBatch26() {
  const repositories = getPublicScreenshotToolCatalogBatch26();
  return {
    ok: true,
    batch: 26,
    mode: "static_governed_screenshot_research_batch26",
    screenshotCount: 80,
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    reciprocalLicenseCount: repositories.filter((item) => item.reciprocalLicense).length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH26.length,
    confirmedExistingRecordCount: CONFIRMED_EXISTING_RECORDS_BATCH26.length,
    architectureExtensionCount: ARCHITECTURE_EXTENSIONS_BATCH26.length,
    productionExecutionCount: 0,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch26(),
    confirmedExistingRecords: getConfirmedExistingRecordsBatch26(),
    architectureExtensions: getArchitectureExtensionsBatch26()
  };
}
module.exports = { SCREENSHOT_TOOL_RADAR_BATCH26, NON_REPOSITORY_REFERENCES_BATCH26, CONFIRMED_EXISTING_RECORDS_BATCH26, ARCHITECTURE_EXTENSIONS_BATCH26, getPublicScreenshotToolCatalogBatch26, getNonRepositoryReferencesBatch26, getConfirmedExistingRecordsBatch26, getArchitectureExtensionsBatch26, getScreenshotToolReadinessBatch26 };
