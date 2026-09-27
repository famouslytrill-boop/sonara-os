// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Batch 19 screenshot intake, 27 September 2026.
//
// Screenshots are source leads, not adoption or execution authority. Every
// repository here was matched against its current upstream; license boundaries
// include material exceptions and per-skill/model/data terms where relevant.

const REPOSITORIES = [
  {
    key: "antigravity_manager",
    label: "Antigravity Manager",
    repository: "lbjlaq/Antigravity-Manager",
    repoUrl: "https://github.com/lbjlaq/Antigravity-Manager",
    repositoryVerified: true,
    license: "CC-BY-NC-SA-4.0; non-commercial and share-alike terms",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "desktop_provider_account_manager",
    placement: "External desktop-tool reference only; no provider account, token, proxy, or code integration",
    productFit: ["Internal Development", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["desktop account switching", "local provider-proxy and request-scheduling workflows"],
    safety: [
      "The current repository license is CC-BY-NC-SA-4.0 and is not a commercial-product reuse grant.",
      "Account tokens and local proxy endpoints are sensitive credentials; no provider credentials or customer traffic may be routed through an unreviewed desktop tool.",
      "Provider account switching, protocol conversion and promotional relay links do not establish provider authorization or service-term compliance."
    ],
    blockedUses: ["copying repository code into the commercial SONARA product without separate permission", "importing tokens, proxy settings or customer traffic into this app"],
    nextStep: "No product integration. If an owned provider-management need emerges, design it around SONARA's Provider Gateway, vault and provider terms rather than adapting this desktop application.",
    sourceEvidence: [
      "https://github.com/lbjlaq/Antigravity-Manager",
      "https://github.com/lbjlaq/Antigravity-Manager/blob/main/LICENSE",
      "https://github.com/lbjlaq/Antigravity-Manager/blob/main/README_EN.md"
    ]
  },
  {
    key: "reactive_resume",
    label: "Reactive Resume",
    repository: "reactive-resume/reactive-resume",
    repoUrl: "https://github.com/reactive-resume/reactive-resume",
    repositoryVerified: true,
    sourceCorrection: "The screenshot's older owner path moved; current upstream is reactive-resume/reactive-resume.",
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "personal_document_application_reference",
    placement: "Business Builder and website form/layout research only; no résumé data enters this catalog",
    productFit: ["Business Builder", "Public Website", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["privacy-oriented résumé creation and export", "self-hosted document workflow patterns"],
    safety: [
      "Résumés contain sensitive personal information; each organization and user must retain control of access, export and deletion.",
      "The repository MIT license covers its code, not user-uploaded fonts, templates, photographs or other third-party content."
    ],
    blockedUses: ["copying branded templates or user content without rights", "cross-tenant résumé storage or retrieval"],
    nextStep: "Compare its form, preview, export and deletion flows with SONARA's existing document contracts using synthetic records; keep current product storage and tenant controls authoritative.",
    sourceEvidence: [
      "https://github.com/reactive-resume/reactive-resume",
      "https://github.com/reactive-resume/reactive-resume/blob/main/package.json",
      "https://github.com/reactive-resume/reactive-resume/blob/main/README.md"
    ]
  },
  {
    key: "openwork",
    label: "OpenWork",
    repository: "different-ai/openwork",
    repoUrl: "https://github.com/different-ai/openwork",
    repositoryVerified: true,
    license: "Mixed: MIT outside ee/; OpenWork EE License (FSL-1.1-MIT) under ee/",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "desktop_agent_workspace",
    placement: "Agent Control Plane and local developer-workspace reference only",
    productFit: ["SONARA One", "Internal Development", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["desktop agent workspace patterns", "local coding and tool workflow"],
    safety: [
      "The repository has a mixed license; production use of ee/ features has separate subscription/source-available terms.",
      "A desktop agent may hold shell, filesystem, browser or provider access; those permissions do not transfer to SONARA agents.",
      "Provider credentials and customer data must not be routed into an unreviewed external workspace."
    ],
    blockedUses: ["copying ee/ code into SONARA", "giving an external desktop agent merge, deployment, billing or customer-account authority"],
    nextStep: "Use only a synthetic-data, disposable-worktree review to compare task visibility and review handoff; do not install or import code until a measured gap and license scope are approved.",
    sourceEvidence: [
      "https://github.com/different-ai/openwork/blob/dev/LICENSE",
      "https://github.com/different-ai/openwork/blob/dev/ee/LICENSE",
      "https://github.com/different-ai/openwork"
    ]
  },
  {
    key: "cap_screen_recording",
    label: "Cap",
    repository: "CapSoftware/Cap",
    repoUrl: "https://github.com/CapSoftware/Cap",
    repositoryVerified: true,
    license: "Mixed: AGPL-3.0 for other project content; MIT for cap-camera* and scap-* crate families",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "local_screen_recording_application",
    placement: "Creator Studio local-capture workflow reference; not the hosted SONARA request runtime",
    productFit: ["Creator Studio", "Internal Development", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["local screen recording", "editing and export workflow patterns", "user-controlled recording files"],
    safety: [
      "The main application is AGPL-3.0; the MIT exception is limited to named Rust crate families.",
      "Capture can record private screens, voices and customer information; obtain explicit user consent and use bounded retention.",
      "Recording, file processing, media export and network upload require a separate local or isolated-worker boundary."
    ],
    blockedUses: ["copying AGPL-covered application code into the hosted product without license review", "recording or uploading another person's screen/audio without authorization"],
    nextStep: "Review the local ownership, pause/stop, export and deletion interaction using synthetic content; do not add a capture dependency or send recordings to SONARA.",
    sourceEvidence: [
      "https://github.com/CapSoftware/Cap",
      "https://github.com/CapSoftware/Cap/blob/main/LICENSE",
      "https://github.com/CapSoftware/Cap/blob/main/licenses/LICENSE-MIT"
    ]
  },
  {
    key: "openmaic",
    label: "OpenMAIC",
    repository: "THU-MAIC/OpenMAIC",
    repoUrl: "https://github.com/THU-MAIC/OpenMAIC",
    repositoryVerified: true,
    license: "MIT project license; packages/mathml2omml is LGPL-3.0-or-later; inspect all bundled/model/content terms",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "multi_agent_learning_application",
    placement: "Learning-workflow and classroom interaction research; isolated review only",
    productFit: ["Business Builder", "Creator Studio", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["interactive project-based learning", "multi-agent classroom interaction", "stage-specific model routing"],
    safety: [
      "The repository has at least one separately licensed LGPL package; the root MIT license is not the license for every package.",
      "Model endpoints, weights, generated course materials and imported media require separate rights and privacy review.",
      "Classroom and learner data must remain tenant-scoped, minimally retained and access-controlled."
    ],
    blockedUses: ["using generated lessons as verified professional training without review", "moving student or customer data to external model providers without explicit approval"],
    nextStep: "Map one synthetic onboarding lesson against Business Builder's current workflow, measuring source traceability, learner data handling and manual review before proposing any feature.",
    sourceEvidence: [
      "https://github.com/THU-MAIC/OpenMAIC",
      "https://github.com/THU-MAIC/OpenMAIC/blob/main/LICENSE",
      "https://github.com/THU-MAIC/OpenMAIC/blob/main/README.md",
      "https://github.com/THU-MAIC/OpenMAIC/tree/main/packages/mathml2omml"
    ]
  },
  {
    key: "microduck_robotics",
    label: "Microduck",
    repository: "pollen-robotics/microduck",
    repoUrl: "https://github.com/pollen-robotics/microduck",
    repositoryVerified: true,
    license: "Apache-2.0 source; hardware, policy artifacts and training assets may have separate terms",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "robotics_simulation_and_reinforcement_learning_reference",
    placement: "Research only; no robot control, model training, or customer-data path in the web application",
    productFit: ["Research Lab", "Internal Development"],
    integrationStatus: "reference_only",
    capabilities: ["biped robot SDK and simulation", "reinforcement-learning policy training and deployment patterns"],
    safety: [
      "Physical-robot control can cause injury or equipment damage; no control commands or autonomy are wired into SONARA.",
      "The Apache source license does not automatically cover model weights, training datasets, hardware designs or third-party assets.",
      "Simulation and policy-training jobs require isolated compute, bounded resources and explicit hardware authorization."
    ],
    blockedUses: ["direct or unattended control of physical robots", "treating a simulation policy as validated real-world behavior"],
    nextStep: "Keep as engineering research. If robotics ever enters product scope, define an isolated simulator experiment with synthetic tasks before touching hardware or policies.",
    sourceEvidence: [
      "https://github.com/pollen-robotics/microduck",
      "https://github.com/pollen-robotics/microduck/blob/main/README.md",
      "https://github.com/pollen-robotics/microduck/blob/main/LICENSE",
      "https://pollen-robotics.com/microduck/"
    ]
  },
  {
    key: "qwen_image_resource_catalog",
    label: "Awesome Qwen Image",
    repository: "wildminder/awesome-qwen-image",
    repoUrl: "https://github.com/wildminder/awesome-qwen-image",
    repositoryVerified: true,
    license: "NONE DECLARED for the curated index; the Qwen-Image-2.1 model uses a separate Qwen Research License, and linked assets have item-specific terms",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "external_model_catalog_reference",
    placement: "Research Lab reference only; never treat community links as approved weights or Provider Gateway models",
    productFit: ["Creator Studio", "Research Lab", "Internal Development"],
    integrationStatus: "reference_only",
    capabilities: ["curated Qwen Image checkpoint and quantization index", "prompt-engine, LoRA, platform-port and inference-tool discovery"],
    safety: [
      "The repository root has no declared license; do not copy its curated content into product code without permission review.",
      "The Qwen-Image-2.1 model card specifies a separate Qwen Research License; linked checkpoints, conversions, LoRAs and datasets need item-specific rights review.",
      "The index lists abliterated/uncensored and NSFW materials; no weights or outputs are approved for SONARA by this catalog entry."
    ],
    blockedUses: ["treating community checkpoints as approved Provider Gateway models", "downloading or running linked weights without a separate license, safety, and resource review"],
    nextStep: "If image generation becomes a measured product need, evaluate one official model and hosting route against rights, content controls, latency, cost and output quality before adding an allowlisted Provider Gateway record.",
    sourceEvidence: [
      "https://github.com/wildminder/awesome-qwen-image",
      "https://github.com/wildminder/awesome-qwen-image/blob/main/README.md",
      "https://huggingface.co/Qwen/Qwen-Image-2.1"
    ]
  },
  {
    key: "algorithm_visualizer",
    label: "Algorithm Visualizer",
    repository: "algorithm-visualizer/algorithm-visualizer",
    repoUrl: "https://github.com/algorithm-visualizer/algorithm-visualizer",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "interactive_code_education_web_application",
    placement: "Developer education/website interaction reference; no untrusted code execution in SONARA",
    productFit: ["Public Website", "Business Builder", "Internal Development"],
    integrationStatus: "reference_only",
    capabilities: ["step-by-step algorithm visualization", "educational code interaction", "separate visualizer/server/algorithm repositories"],
    safety: [
      "The upstream platform has a server that compiles/runs code; that execution architecture is not suitable for direct reuse in the SONARA web process.",
      "Any future code playground needs a disposable sandbox, strict CPU/memory/time/network limits and explicit language allowlists.",
      "MIT code does not grant rights to third-party examples, course text, logos or user submissions."
    ],
    blockedUses: ["eval/compile user code in the Express request process", "treating a visualization as proof that production code passed tests"],
    nextStep: "Prototype one deterministic, pre-authored animation using SONARA-owned code and test keyboard, reduced-motion and small-screen behavior before considering an interactive code runner.",
    sourceEvidence: [
      "https://github.com/algorithm-visualizer/algorithm-visualizer",
      "https://github.com/algorithm-visualizer/algorithm-visualizer/blob/master/LICENSE",
      "https://github.com/algorithm-visualizer/algorithm-visualizer/blob/master/README.md"
    ]
  },
  {
    key: "roboflow_trackers",
    label: "Roboflow Trackers",
    repository: "roboflow/trackers",
    repoUrl: "https://github.com/roboflow/trackers",
    repositoryVerified: true,
    license: "Apache-2.0 code; individual tracking algorithms cite their own papers",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "offline_video_analytics_reference",
    placement: "Offline developer/research tool only; no live-video or serverless inference path",
    productFit: ["Research Lab", "Internal Development"],
    integrationStatus: "reference_only",
    capabilities: ["multi-object tracking algorithms", "video, webcam and RTSP pipeline examples", "detector-agnostic interface"],
    safety: [
      "Video and tracking trajectories can expose sensitive people, locations and behavior; do not use for individual surveillance or employee/customer monitoring.",
      "A tracker associates detections over frames; it does not establish identity, consent, or the correctness of a business decision.",
      "Video decoding and inference can consume unbounded CPU, memory and storage; any later use needs an isolated worker with explicit limits."
    ],
    blockedUses: ["tracking identifiable people without lawful basis and explicit review", "using model outputs for employment, eligibility, security or other consequential decisions"],
    nextStep: "No product integration. If a permitted visual-analytics need is later defined, test a synthetic video offline and document retention, consent, resource bounds and human review.",
    sourceEvidence: [
      "https://github.com/roboflow/trackers",
      "https://github.com/roboflow/trackers/blob/develop/README.md",
      "https://github.com/roboflow/trackers/blob/develop/LICENSE"
    ]
  },
  {
    key: "skillware",
    label: "Skillware",
    repository: "ARPAHLS/skillware",
    repoUrl: "https://github.com/ARPAHLS/skillware",
    repositoryVerified: true,
    license: "MIT repository; individual bundled skills, dependencies and provider credentials need separate review",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "agent_skill_registry_and_loader",
    placement: "Agent skill packaging and assurance reference only; SONARA-owned permissions and loaders remain authoritative",
    productFit: ["SONARA One", "Business Builder", "Internal Development", "Research Lab"],
    integrationStatus: "adapt_patterns_after_review",
    capabilities: ["typed skill contracts and I/O", "separated instructions and executable effects", "offline skill tests", "agent-host tool-schema adapters"],
    safety: [
      "A skill bundle may contain executable code, dependencies, network calls and secrets; registry membership does not make it safe.",
      "Each skill needs provenance, an exact license, input/output schema, permission list, resource limits, tests and an owner-reviewed rollback path.",
      "Host adapters may describe tools but cannot grant actions outside SONARA agent authority, tenant scope or approval checks."
    ],
    blockedUses: ["loading third-party skills into production without per-skill review", "letting skill metadata grant shell, provider, customer or deployment permissions"],
    nextStep: "Use the contract/effect/directive/assurance/interface shape as a checklist against one existing SONARA agent capability; document the gap without installing Skillware or importing a bundled skill.",
    sourceEvidence: [
      "https://github.com/ARPAHLS/skillware",
      "https://github.com/ARPAHLS/skillware/blob/main/LICENSE",
      "https://github.com/ARPAHLS/skillware/blob/main/README.md",
      "https://github.com/ARPAHLS/skillware/blob/main/SECURITY.md"
    ]
  },
  {
    key: "window_sweaters",
    label: "Window Sweaters",
    repository: "saragordic/window-sweaters",
    repoUrl: "https://github.com/saragordic/window-sweaters",
    repositoryVerified: true,
    license: "GPL-3.0",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "macos_window_decoration_application",
    placement: "Visual-design inspiration only; macOS-specific and GPL-covered",
    productFit: ["Public Website", "Internal Development", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["hand-crafted per-app border colors", "decorative window-chrome personalization"],
    safety: [
      "The repository is a macOS application released under GPL-3.0 and depends on separately attributed work.",
      "Its window-management/accessibility permissions are specific to local macOS use and do not map to hosted web-app permissions."
    ],
    blockedUses: ["copying GPL-covered code into SONARA", "requesting operating-system accessibility permissions for unrelated web personalization"],
    nextStep: "Take no code dependency; if the team wants a warmer website theme, create a SONARA-owned visual experiment within the current design system and run contrast/accessibility checks.",
    sourceEvidence: [
      "https://github.com/saragordic/window-sweaters",
      "https://github.com/saragordic/window-sweaters/blob/main/LICENSE",
      "https://github.com/saragordic/window-sweaters/blob/main/README.md"
    ]
  },
  {
    key: "ponytail_agent_skills",
    label: "Ponytail",
    repository: "DietrichGebert/ponytail",
    repoUrl: "https://github.com/DietrichGebert/ponytail",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "coding_agent_skill_and_hook_collection",
    placement: "Developer instruction reference only; no external hooks are enabled",
    productFit: ["Internal Development", "SONARA One", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["minimal-diff/YAGNI coding guidance", "multi-agent-client skill packaging", "lifecycle hook examples"],
    safety: [
      "Instruction files and hooks can change agent behavior or run commands; review their exact contents and triggering lifecycle before use.",
      "The repository's MIT license does not make its prompts, hooks or commands appropriate for SONARA's protected release workflow."
    ],
    blockedUses: ["installing agent hooks that bypass exact-head CI or human review", "treating a minimal diff as a reason to omit necessary tests"],
    nextStep: "Compare its concise implementation/review prompts with existing SONARA agent guidance and adopt wording only when it preserves test, security and release requirements.",
    sourceEvidence: [
      "https://github.com/DietrichGebert/ponytail",
      "https://github.com/DietrichGebert/ponytail/blob/main/LICENSE",
      "https://github.com/DietrichGebert/ponytail/blob/main/README.md"
    ]
  },
  {
    key: "rockyvoice_agent_skill",
    label: "RockyVoice",
    repository: "Lagunaswift/RockyVoice",
    repoUrl: "https://github.com/Lagunaswift/RockyVoice",
    repositoryVerified: true,
    license: "MIT source; character, voice-clone, and bundled audio rights are separate",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "voice_persona_agent_skill_reference",
    placement: "Read-only agent-skill and voice-workflow reference; do not import its persona or audio into SONARA",
    productFit: ["Internal Development", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["Claude Code and Hermes skill packaging", "local voice application and TTS-provider wrapper", "safety clarity and persona off-switch patterns"],
    safety: [
      "The README describes a fan persona based on a copyrighted fictional character and a custom voice clone; the MIT code license does not grant those character, performance or voice rights.",
      "The upstream explicitly excludes client work and real documents because stylistic phrasing may reduce precision.",
      "TTS provider use and stored voice samples need separate consent, retention and service-term review."
    ],
    blockedUses: ["copying the character voice/persona or bundled audio into a commercial product", "using playful style for legal, financial, safety-critical, client or customer-facing work"],
    nextStep: "Use only the generic pattern: make persona modes opt-in, easy to stop, and force exact plain language for safety-critical instructions; validate with synthetic prompts.",
    sourceEvidence: [
      "https://github.com/Lagunaswift/RockyVoice",
      "https://github.com/Lagunaswift/RockyVoice/blob/main/README.md",
      "https://github.com/Lagunaswift/RockyVoice/blob/main/LICENSE"
    ]
  },
  {
    key: "gods_eye_view",
    label: "God's Eye View",
    repository: "bilawalsidhu/gods-eye-view",
    repoUrl: "https://github.com/bilawalsidhu/gods-eye-view",
    repositoryVerified: true,
    license: "MIT code; third-party data sources, maps, models and media retain their own licenses and terms",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "public_data_geospatial_visualization",
    placement: "Architecture/privacy reference only; no live public-data ingestion or individual monitoring",
    productFit: ["SONARA One", "Business Builder", "Research Lab"],
    integrationStatus: "research_only_security_gated",
    capabilities: ["3D globe and multi-source public-data visualization", "source/provider separation and local-first map interface patterns"],
    safety: [
      "Public availability does not establish consent, accuracy, suitability or permission for a new purpose.",
      "The upstream security guidance says to respect privacy and provider terms and not present public-data inference as authoritative intelligence.",
      "Third-party media and data are explicitly outside the source-code MIT grant."
    ],
    blockedUses: ["tracking or profiling private individuals", "customer, employee or competitor surveillance", "automated business decisions from unverified public-data inference"],
    nextStep: "Use only as a source-provenance and map-layer design reference; if a legitimate organization map is proposed later, require consent, provider terms, source freshness, uncertainty and privacy review first.",
    sourceEvidence: [
      "https://github.com/bilawalsidhu/gods-eye-view",
      "https://github.com/bilawalsidhu/gods-eye-view/blob/main/LICENSE",
      "https://github.com/bilawalsidhu/gods-eye-view/blob/main/SECURITY.md",
      "https://github.com/bilawalsidhu/gods-eye-view/blob/main/DATA_SOURCES.md"
    ]
  },
  {
    key: "scientific_agent_skills",
    label: "Scientific Agent Skills",
    repository: "K-Dense-AI/scientific-agent-skills",
    repoUrl: "https://github.com/K-Dense-AI/scientific-agent-skills",
    repositoryVerified: true,
    sourceCorrection: "The screenshot uses the earlier Claude Scientific Skills name; current upstream is Scientific Agent Skills.",
    license: "MIT repository; individual skill licenses vary and may be proprietary",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "scientific_research_agent_skill_collection",
    placement: "Research Lab reference only; inspect each skill, dependency, source and network call separately",
    productFit: ["Research Lab", "SONARA One", "Internal Development"],
    integrationStatus: "research_only_security_gated",
    capabilities: ["agent-readable scientific workflows", "research database and analysis tool guidance", "skill-level metadata and licensing"],
    safety: [
      "The repository root license does not cover every bundled skill; the upstream directs users to each skill's license metadata.",
      "Some skills make external API calls and require credentials; do not execute or transmit data from this collection as a whole.",
      "Scientific, clinical and regulated conclusions require source verification and qualified human review."
    ],
    blockedUses: ["bulk copying or installing skills under the root MIT assumption", "using generated scientific or clinical conclusions without independently verified evidence and human review"],
    nextStep: "Select no more than one future research task, inspect that skill's exact license, code, network and data behavior, then compare it with SONARA's source-grounded research workflow before any proposal.",
    sourceEvidence: [
      "https://github.com/K-Dense-AI/scientific-agent-skills",
      "https://github.com/K-Dense-AI/scientific-agent-skills/blob/main/LICENSE.md",
      "https://github.com/K-Dense-AI/scientific-agent-skills/blob/main/AGENTS.md",
      "https://github.com/K-Dense-AI/scientific-agent-skills/blob/main/skills/xlsx/SKILL.md"
    ]
  },
  {
    key: "minimind",
    label: "MiniMind",
    repository: "jingyaogong/minimind",
    repoUrl: "https://github.com/jingyaogong/minimind",
    repositoryVerified: true,
    license: "Apache-2.0 source; model weights and datasets require separate license review",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "small_language_model_training_education",
    placement: "Developer learning reference; not a production model/provider",
    productFit: ["Internal Development", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["small-model training walkthrough", "educational implementation of model training and inference"],
    safety: [
      "Source code, training data and resulting model artifacts have separate rights and quality requirements.",
      "A small demonstration model is not evidence of production accuracy, safety, privacy or cost."
    ],
    blockedUses: ["claiming model quality from training-demo size", "replacing approved Provider Gateway models or review gates"],
    nextStep: "Use as internal educational material only; any model experiment must pin code/data/model provenance and run in a resource-limited offline environment.",
    sourceEvidence: [
      "https://github.com/jingyaogong/minimind",
      "https://github.com/jingyaogong/minimind/blob/master/LICENSE",
      "https://github.com/jingyaogong/minimind/blob/master/README_en.md"
    ]
  },
  {
    key: "career_ops",
    label: "Career Ops",
    repository: "career-ops-hq/career-ops",
    repoUrl: "https://github.com/career-ops-hq/career-ops",
    repositoryVerified: true,
    license: "MIT source; portal, job-board and provider terms remain separate",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "local_personal_job_search_agent",
    placement: "Personal user-controlled workflow reference only; not employer screening or hiring automation",
    productFit: ["Business Builder", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["local job-search workflow", "user-reviewed listing summaries and application tracking", "resume tailoring assistance"],
    safety: [
      "Job listings and application records contain personal data; keep processing user-directed and local or explicitly authorized.",
      "Listing evaluation scores are subjective suggestions, not objective measures of job quality or candidate merit.",
      "Public job pages still have provider terms, access limits and anti-automation rules."
    ],
    blockedUses: ["automated hiring, candidate ranking or employment decisions", "unsolicited outreach, credential submission or job-portal scraping that violates source terms"],
    nextStep: "Treat it as a personal workflow reference only; do not put it in Business Builder unless an explicit consumer career product is approved with privacy, source terms and fairness review.",
    sourceEvidence: [
      "https://github.com/career-ops-hq/career-ops",
      "https://github.com/career-ops-hq/career-ops/blob/main/LICENSE",
      "https://github.com/career-ops-hq/career-ops/blob/main/README.md",
      "https://github.com/career-ops-hq/career-ops/blob/main/TRADEMARK.md"
    ]
  }
];

const NON_REPOSITORY_REFERENCES = [
  {
    key: "agent_loop_diagrams",
    label: "Agent loop and orchestration diagrams",
    status: "educational_architecture_reference",
    observedTheme: "Turn-based, goal-based, scheduled and proactive loops show different stop conditions, triggers and human checkpoints.",
    reason: "The screenshot is an educational diagram, not proof that a particular orchestration runtime is safe or reliable.",
    nextStep: "Keep loop type, budget, trigger, allowed tools, completion evidence and escalation path explicit in SONARA-owned workflow contracts."
  },
  {
    key: "transformer_attention_diagram",
    label: "Transformer attention explainer",
    status: "educational_model_reference",
    observedTheme: "A word's query interacts with context keys and values; changing context can change attention and output.",
    reason: "The diagram is a simplified teaching aid and does not describe a production model's full implementation.",
    nextStep: "Use for learning material only; ground model behavior claims in current primary technical documentation."
  },
  {
    key: "llm_context_techniques_diagram",
    label: "LLM context techniques infographic",
    status: "educational_system_design_reference",
    observedTheme: "Prompt stuffing, RAG, embeddings, chunking, reranking, fine-tuning, tools, MCP, long context and prompt caching address different constraints.",
    reason: "The poster compresses tradeoffs and cost/latency claims that vary by provider, workload and current model behavior.",
    nextStep: "Choose from SONARA workload measurements and provider documentation; retain source citations, token/cost budgets and retrieval evaluations."
  },
  {
    key: "typed_decision_jev_diagram",
    label: "JEV versus LLM decision diagram",
    status: "educational_decision_architecture_reference",
    observedTheme: "Known-choice routing or scoring can use typed bounded outputs, while open-ended generation can use an LLM.",
    reason: "The screenshot does not provide a sufficiently verified library identity, calibrated score evidence or current pricing basis.",
    nextStep: "Prefer deterministic rules for calculable decisions; if a learned classifier is proposed, measure calibration and retain code-owned thresholds and approvals."
  },
  {
    key: "jenkins_cicd_diagram",
    label: "Jenkins CI/CD workflow explainer",
    status: "educational_devops_reference",
    observedTheme: "A commit can trigger build, test and deployment stages in sequence.",
    reason: "The screenshot describes a generic CI/CD pattern and does not establish a SONARA need to change its current release system.",
    nextStep: "Keep the existing pnpm, protected-branch and exact-head CI gates authoritative; do not add a second CI orchestrator from an infographic."
  },
  {
    key: "openmontage_existing_reference",
    label: "OpenMontage",
    status: "already_in_formal_open_source_registry",
    observedTheme: "The screenshot repeats an existing Creator Studio media-editing reference.",
    reason: "A maintained formal registry record already contains the authoritative license and product placement.",
    nextStep: "Use the formal registry entry; do not create another screenshot record."
  },
  {
    key: "oracle_always_free_promo",
    label: "Oracle Cloud Always Free promotion screenshot",
    status: "volatile_hosted_service_reference",
    observedTheme: "The screenshot advertises a free cloud account with trial/credit conditions.",
    reason: "Prices, account eligibility, regions, quotas, credits and service terms change; a social screenshot cannot establish current availability.",
    nextStep: "Use official current cloud pricing and account terms for any infrastructure decision; do not build production cost claims from the screenshot."
  },
  {
    key: "x_grok_bot_rewards_promo",
    label: "X Grok Bot creator rewards promotion",
    status: "volatile_platform_program_reference",
    observedTheme: "A social post claims template creators can receive rewards.",
    reason: "Eligibility, payment, platform terms and program availability are volatile and are not proven by a promotional screenshot.",
    nextStep: "Do not promise earnings or build payouts from this reference; verify current official X program rules and require owner/legal review before any commercial participation."
  },
  {
    key: "unresolved_openworkstyle_agent_workspace",
    label: "ENZO local agent workspace screenshot",
    status: "repository_unresolved",
    observedTheme: "The screenshot describes a multi-model coding workspace with a browser-side vault for provider keys.",
    reason: "The exact upstream path and complete security design are not established by the screenshot.",
    nextStep: "Keep unresolved; browser storage of provider credentials is not a SONARA secret-management pattern."
  },
  {
    key: "unresolved_omni_voice_studio_owner",
    label: "OmniVoice Studio screenshot",
    status: "repository_owner_mismatch",
    observedTheme: "The screenshot names OmniVoice Studio and an owner path that did not match the current upstream found during verification.",
    reason: "Multiple similarly named sources exist; the screenshot's exact repository and license cannot be safely inferred.",
    nextStep: "Keep unresolved until the source owner/path is confirmed; do not evaluate voice cloning code from a guessed match."
  },
  {
    key: "unresolved_orca_agent_workspace_owner",
    label: "Orca parallel-agent workspace screenshot",
    status: "repository_owner_mismatch",
    observedTheme: "The screenshot names a multi-agent coding workspace and an owner path that did not match the current repository candidates.",
    reason: "Several unrelated projects use Orca; current search results cannot establish which one the screenshot depicts.",
    nextStep: "Keep unresolved until exact repository identity is confirmed; any later review must inspect worktree isolation, shell permissions, network access and telemetry."
  },
  {
    key: "unresolved_deepseek_harness_source",
    label: "DeepSeek Harness screenshot",
    status: "repository_unresolved",
    observedTheme: "The screenshot advertises a harness for AI coding workflows.",
    reason: "The visible repository path is not sufficient to distinguish the exact project from similarly named DeepSeek/coding-agent sources.",
    nextStep: "Keep unresolved until an exact upstream is supplied or verified."
  },
  {
    key: "unresolved_anidoodle_source",
    label: "Anidoodle source-code animation screenshot",
    status: "repository_unresolved",
    observedTheme: "The screenshot describes deterministic code-generated illustrations and animation styles.",
    reason: "The repository identity and license are not legible in the supplied screenshot.",
    nextStep: "Keep as a design lead; any future Creator Studio experiment should be SONARA-owned and use licensed assets."
  },
  {
    key: "unresolved_wolfcut_source",
    label: "WolfCut video editor screenshot",
    status: "repository_unresolved",
    observedTheme: "A saved social screenshot shows a free desktop video editor described as an open-source CapCut alternative.",
    reason: "The screenshot does not identify a repository URL, license or exact product scope.",
    nextStep: "Keep unresolved; do not install, copy assets or rely on the social claim until an exact source and license are verified."
  },
  {
    key: "unresolved_agent_orchestration_ax",
    label: "AX agent orchestration screenshot",
    status: "repository_unresolved",
    observedTheme: "The screenshot describes a high-throughput agent orchestrator and explicitly warns that its core protocols are changing.",
    reason: "No exact upstream repository/version is established; the screenshot itself signals protocol instability.",
    nextStep: "Keep unresolved and re-check current protocol specifications and isolation model only if a measured SONARA scale problem appears."
  }
];

const CONFIRMED_EXISTING_RECORDS = [
  {
    key: "archify_existing_batch3",
    label: "Archify",
    repository: "tt-a1i/archify",
    source: "Batch 3 and formal open-source registry",
    note: "The project-list screenshot repeats the existing development-only, source-grounded architecture skill record."
  },
  {
    key: "excalidraw_existing_batch17",
    label: "Excalidraw",
    repository: "excalidraw/excalidraw",
    source: "Batch 17 and formal open-source registry",
    note: "The whiteboard screenshot repeats the existing MIT reference; its package/build/CSP review remains authoritative."
  },
  {
    key: "quickemu_existing_batch17",
    label: "Quickemu",
    repository: "quickemu-project/quickemu",
    source: "Batch 17",
    note: "The repository-list screenshot repeats the existing local VM compatibility research record."
  },
  {
    key: "openmontage_existing_registry",
    label: "OpenMontage",
    repository: "calesthio/OpenMontage",
    source: "data/open-source-tools.ts",
    note: "The screenshot repeats the maintained formal Creator Studio media reference."
  },
  {
    key: "qdrant_existing_research",
    label: "Qdrant",
    repository: "qdrant/qdrant",
    source: "Backend operations and Creator Studio market research",
    note: "The screenshot repeats existing retrieval infrastructure research; PostgreSQL/pgvector remains the default until a measured gap is established."
  },
  {
    key: "opencv_existing_research",
    label: "OpenCV",
    repository: "opencv/opencv",
    source: "Creator Studio market radar",
    note: "The screenshot repeats the bounded vision-worker candidate; the existing research decision remains authoritative."
  },
  {
    key: "threejs_existing_research",
    label: "Three.js",
    repository: "mrdoob/three.js",
    source: "3D/motion ADR and market research",
    note: "The screenshot repeats the already documented browser 3D reference; no new dependency is implied."
  },
  {
    key: "storybook_existing_research",
    label: "Storybook",
    repository: "storybookjs/storybook",
    source: "Frontend visual operations intelligence",
    note: "The collection screenshot repeats existing component-state documentation research."
  }
];

const ARCHITECTURE_EXTENSIONS = [
  {
    key: "skill_bundle_contract_assurance",
    title: "Agent skill contract and assurance",
    product: "Agent Control Plane",
    principle: "A reusable skill is a versioned software capability with an explicit contract, deterministic effect, host guidance, permission scope and tests; an instruction file alone is not an executable or authorization contract.",
    implementation: "manifest/input/output schema -> source and license provenance -> allowed effects/tools -> deterministic implementation -> human-readable instructions -> offline contract/security tests -> version pin -> reviewed activation -> rollback/removal. Skill metadata never widens agent authority."
  },
  {
    key: "agent_skill_supply_chain_boundary",
    title: "Agent skill supply-chain boundary",
    product: "SONARA One",
    principle: "Third-party skills are executable supply-chain inputs and must be reviewed per artifact, not accepted as a trusted bundle.",
    implementation: "Inspect source/commit, nested license, dependencies, prompts, hooks, shell/network/filesystem access and secrets; sandbox tests with synthetic data; pin provenance; require owner review for side effects; keep the skill disabled until a separate implementation decision."
  },
  {
    key: "known_choice_deterministic_decision_lane",
    title: "Known-choice deterministic decision lane",
    product: "Business Builder",
    principle: "When the output space is known and code can calculate the answer, use typed deterministic logic; use an LLM for open-ended content rather than as an unnecessary decision gate.",
    implementation: "Declare an enum/score schema -> validate and calculate in code -> define thresholds and tie handling -> return evidence/reason codes -> measure any learned classifier calibration separately -> keep authorization and high-impact actions in code and approval policy."
  },
  {
    key: "interactive_code_visualization_sandbox",
    title: "Interactive code visualization sandbox",
    product: "Public Website",
    principle: "Code animations can teach system behavior, but arbitrary user code must never run in the web request process.",
    implementation: "Prefer SONARA-authored deterministic traces and accessible precomputed animations; if user code execution is later justified, isolate it in a disposable worker with language allowlists, CPU/memory/time/network limits, output validation and abuse controls."
  },
  {
    key: "local_media_ownership_and_retention",
    title: "Local media ownership and retention",
    product: "Creator Studio",
    principle: "Screen recordings, transcripts and exported media remain user-owned data with explicit capture, storage, sharing and deletion controls.",
    implementation: "Show capture scope and consent -> store only in an approved user-controlled location -> apply size/time/egress limits -> keep share links private and revocable -> set retention/deletion behavior -> isolate editing/rendering from the web request runtime."
  },
  {
    key: "public_data_provenance_and_uncertainty",
    title: "Public-data provenance and uncertainty",
    product: "Business Builder",
    principle: "Publicly reachable data is not automatically consented, reliable, fit for a new purpose or authoritative.",
    implementation: "Record source, license/terms, timestamp, allowed purpose and confidence -> minimize personal data -> disclose inference uncertainty -> prohibit individual surveillance and high-impact decisions from unverified signals -> provide correction and removal paths."
  }
];

function freezeRepository(item) {
  return Object.freeze({
    ...item,
    productFit: Object.freeze([...item.productFit]),
    capabilities: Object.freeze([...item.capabilities]),
    safety: Object.freeze([...item.safety]),
    blockedUses: Object.freeze([...item.blockedUses]),
    sourceEvidence: Object.freeze([...item.sourceEvidence]),
    checkedOn: "2026-09-27",
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    enabledInProduction: false,
    canExecute: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch19_2026_09_27"
  });
}

const SCREENSHOT_TOOL_RADAR_BATCH19 = Object.freeze(REPOSITORIES.map(freezeRepository));
const NON_REPOSITORY_REFERENCES_BATCH19 = Object.freeze(
  NON_REPOSITORY_REFERENCES.map((item) => Object.freeze({
    ...item,
    source: "user_submitted_screenshot_research_batch19_2026_09_27"
  }))
);
const CONFIRMED_EXISTING_RECORDS_BATCH19 = Object.freeze(
  CONFIRMED_EXISTING_RECORDS.map((item) => Object.freeze({ ...item }))
);
const ARCHITECTURE_EXTENSIONS_BATCH19 = Object.freeze(
  ARCHITECTURE_EXTENSIONS.map((item) => Object.freeze({ ...item }))
);

function getPublicScreenshotToolCatalogBatch19() {
  return SCREENSHOT_TOOL_RADAR_BATCH19.map((item) => ({
    ...item,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses],
    sourceEvidence: [...item.sourceEvidence]
  }));
}

function getNonRepositoryReferencesBatch19() {
  return NON_REPOSITORY_REFERENCES_BATCH19.map((item) => ({ ...item }));
}

function getConfirmedExistingRecordsBatch19() {
  return CONFIRMED_EXISTING_RECORDS_BATCH19.map((item) => ({ ...item }));
}

function getArchitectureExtensionsBatch19() {
  return ARCHITECTURE_EXTENSIONS_BATCH19.map((item) => ({ ...item }));
}

function getScreenshotToolReadinessBatch19() {
  const repositories = getPublicScreenshotToolCatalogBatch19();
  return {
    ok: true,
    batch: 19,
    mode: "static_governed_screenshot_research_batch19",
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    reciprocalLicenseCount: repositories.filter((item) => item.reciprocalLicense).length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH19.length,
    confirmedExistingRecordCount: CONFIRMED_EXISTING_RECORDS_BATCH19.length,
    architectureExtensionCount: ARCHITECTURE_EXTENSIONS_BATCH19.length,
    productionExecutionCount: 0,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch19(),
    confirmedExistingRecords: getConfirmedExistingRecordsBatch19(),
    architectureExtensions: getArchitectureExtensionsBatch19()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH19,
  NON_REPOSITORY_REFERENCES_BATCH19,
  CONFIRMED_EXISTING_RECORDS_BATCH19,
  ARCHITECTURE_EXTENSIONS_BATCH19,
  getPublicScreenshotToolCatalogBatch19,
  getNonRepositoryReferencesBatch19,
  getConfirmedExistingRecordsBatch19,
  getArchitectureExtensionsBatch19,
  getScreenshotToolReadinessBatch19
};
