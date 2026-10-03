// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Screenshot intake received 3 October 2026. The 54 screenshots are research
// evidence only. No repository, model, dataset, Space, workflow, skill, provider,
// credential, or third-party asset is installed or enabled by this record.

const REPOSITORIES = [
  {
    key: "tester_army_e2e",
    label: "TesterArmy e2e",
    repository: "tester-army/e2e",
    repoUrl: "https://github.com/tester-army/e2e",
    repositoryVerified: true,
    license: "Apache-2.0",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "agent_assisted_web_and_mobile_e2e_testing_framework",
    placement: "Internal Development / QA research only; SONARA already uses Playwright and does not add a second test runner from screenshot research",
    productFit: ["Internal Development", "Launch Readiness", "Mobile Verification"],
    integrationStatus: "reference_only_benchmark_candidate",
    capabilities: [
      "natural-language agent steps paired with locators and deterministic assertions",
      "web and mobile engines",
      "record-and-replay of verified agent actions"
    ],
    safety: [
      "Agent-driven steps remain untrusted until deterministic assertions and postconditions pass.",
      "Tests may reach billing, settings, authentication, or destructive controls; use synthetic accounts, isolated environments, bounded credentials, and explicit target allowlists.",
      "Upstream documents anonymous CLI telemetry with an opt-out; any evaluation must disable or review telemetry before SONARA test data is exposed.",
      "The project is pre-1.0 and its APIs can change."
    ],
    blockedUses: [
      "treating a model-generated test step as proof that a customer journey passed",
      "running agent tests against production customer accounts or payment methods",
      "replacing the existing Playwright release-evidence lane without a measured gap and architecture review"
    ],
    nextStep: "Benchmark one synthetic checkout or settings journey against the existing Playwright suite. Require identical deterministic assertions, capture run evidence, and adopt nothing unless it closes a measured maintenance or coverage gap.",
    sourceEvidence: [
      "https://github.com/tester-army/e2e",
      "https://github.com/tester-army/e2e/blob/main/README.md",
      "https://github.com/tester-army/e2e/blob/main/LICENSE"
    ]
  },
  {
    key: "mobile_next_mobile_mcp",
    label: "Mobile Next MCP",
    repository: "mobile-next/mobile-mcp",
    repoUrl: "https://github.com/mobile-next/mobile-mcp",
    repositoryVerified: true,
    license: "Apache-2.0",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "privileged_mobile_device_automation_mcp_server",
    placement: "Internal Development device-lab research only; no MCP server or cloud-device provider is configured",
    productFit: ["Internal Development", "Android Verification", "Mobile QA"],
    integrationStatus: "research_only_security_review_required",
    capabilities: [
      "structured accessibility-tree interaction for iOS and Android",
      "simulator, emulator, local-device and remote-device automation",
      "app lifecycle, screenshots, screen recording, clipboard, logs, crash reports, deep links and input"
    ],
    safety: [
      "Full device control is a privileged boundary: app installation, URLs, clipboard, location overrides, screen recording, logs, file paths and cloud-device sessions can expose secrets or personal data.",
      "Review the current upstream security advisory state and exact release before every trial; permissive licensing is not a security approval.",
      "Use only dedicated test devices or simulators with synthetic accounts, scoped credentials, isolated storage and explicit recording retention.",
      "Do not connect a mobile-control MCP server to customer devices or production accounts."
    ],
    blockedUses: [
      "customer-device control",
      "capturing personal notifications, credentials, photos, messages or other unrelated device data",
      "installing unreviewed application packages",
      "using cloud devices without provider, privacy, retention and credential review"
    ],
    nextStep: "If Android packaging/device proof needs a gap filled, run a disposable emulator-only benchmark on one synthetic SONARA flow after source, advisory, package-lock and network-egress review.",
    sourceEvidence: [
      "https://github.com/mobile-next/mobile-mcp",
      "https://github.com/mobile-next/mobile-mcp/blob/main/README.md",
      "https://github.com/mobile-next/mobile-mcp/blob/main/LICENSE",
      "https://github.com/mobile-next/mobile-mcp/security"
    ]
  },
  {
    key: "walkinglabs_learn_harness_engineering",
    label: "Learn Harness Engineering",
    repository: "walkinglabs/learn-harness-engineering",
    repoUrl: "https://github.com/walkinglabs/learn-harness-engineering",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "agent_harness_engineering_course_and_pattern_library",
    placement: "Internal Development reference only; SONARA keeps its own repository, authority, state, verification and release contracts",
    productFit: ["Internal Development", "Agent Control Plane", "Research Lab"],
    integrationStatus: "curated_reference",
    capabilities: [
      "project-based harness engineering curriculum",
      "instructions, tools, environment, state and feedback decomposition",
      "graph-engineering and frontier-harness design breakdowns"
    ],
    safety: [
      "Educational architecture is not production proof and does not grant tool, secret, tenant, repository or deployment authority.",
      "Do not copy product-specific prompts, undocumented behavior claims, or vendor internals as facts without independent verification.",
      "SONARA's current agent authority, exact-head CI, worktree isolation, approval, audit and release controls remain authoritative."
    ],
    blockedUses: [
      "replacing SONARA agent-control contracts with course examples",
      "granting coding agents broader repository or deployment access because a harness pattern describes it"
    ],
    nextStep: "Map only the reusable five-part harness checklist onto existing SONARA agent verification and release evidence; add no dependency.",
    sourceEvidence: [
      "https://github.com/walkinglabs/learn-harness-engineering",
      "https://github.com/walkinglabs/learn-harness-engineering/blob/main/README.md",
      "https://github.com/walkinglabs/learn-harness-engineering/blob/main/LICENSE"
    ]
  },
  {
    key: "sevenevesai_riso_windowseat",
    label: "Riso Windowseat",
    repository: "sevenevesai/riso-windowseat",
    repoUrl: "https://github.com/sevenevesai/riso-windowseat",
    repositoryVerified: true,
    license: "MIT for repository source; embedded audio, artwork, fonts or other media must be reviewed separately before reuse",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "browser_native_procedural_canvas_and_web_audio_media_reference",
    placement: "Creator Studio deterministic-media reference only; no upstream artwork or media is copied",
    productFit: ["Creator Studio", "Deterministic Media", "Internal Development"],
    integrationStatus: "curated_reference",
    capabilities: [
      "procedural Canvas 2D visuals",
      "Web Audio synchronization",
      "single-file browser film and print generation patterns"
    ],
    safety: [
      "Code licensing does not automatically grant rights to embedded sounds, images, typefaces, source footage or generated commercial assets.",
      "A deterministic renderer still needs seed/version capture, timing tests, accessibility fallback, export limits and provenance.",
      "Do not copy the project's visual identity or finished films into SONARA."
    ],
    blockedUses: [
      "redistributing third-party media without an itemized rights record",
      "claiming a generated animation is original or commercially cleared merely because the renderer source is MIT"
    ],
    nextStep: "Use the architecture lesson for a SONARA-authored seeded Canvas/WebAudio render harness with owned fixtures, deterministic snapshots and export provenance.",
    sourceEvidence: [
      "https://github.com/sevenevesai/riso-windowseat",
      "https://github.com/sevenevesai/riso-windowseat/blob/main/README.md",
      "https://github.com/sevenevesai/riso-windowseat/blob/main/LICENSE"
    ]
  },
  {
    key: "vectorize_io_hindsight",
    label: "Hindsight agent memory",
    repository: "vectorize-io/hindsight",
    repoUrl: "https://github.com/vectorize-io/hindsight",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "long_term_agent_memory_and_learning_system",
    placement: "Agent-memory research only; SONARA's own tenant-scoped memory, provenance and deletion contracts remain canonical",
    productFit: ["Agent Control Plane", "Research Lab", "Internal Development"],
    integrationStatus: "reference_only_memory_benchmark",
    capabilities: [
      "retain, recall and reflect style memory operations",
      "long-term agent context and learned memory",
      "memory retrieval and integration patterns"
    ],
    safety: [
      "Long-term memory can retain incorrect, sensitive, stale or unauthorized information; every stored fact needs tenant, source, owner, time, sensitivity, retention and deletion semantics.",
      "Model-generated reflections are derived context, not authoritative customer records.",
      "Memory must never expand agent permissions or survive a source deletion without a defined propagation path."
    ],
    blockedUses: [
      "cross-tenant memory",
      "silent retention of sensitive customer information",
      "using learned memories as authorization, billing, legal, identity or financial truth"
    ],
    nextStep: "Compare its memory lifecycle concepts with SONARA's existing provenance/correction/forgetting contract using synthetic facts only; do not run a second memory service until a measured gap is proven.",
    sourceEvidence: [
      "https://github.com/vectorize-io/hindsight",
      "https://github.com/vectorize-io/hindsight/blob/main/README.md",
      "https://github.com/vectorize-io/hindsight/blob/main/LICENSE"
    ]
  },
  {
    key: "copilotkit_opendots",
    label: "CopilotKit OpenDots",
    repository: "CopilotKit/OpenDots",
    repoUrl: "https://github.com/CopilotKit/OpenDots",
    repositoryVerified: true,
    license: "MIT for repository code; connected providers, channels, speech, browser services, generated content and dependencies retain separate terms",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "persistent_agent_workspace_with_chat_calls_slack_browser_and_background_work",
    placement: "Research reference only; SONARA does not import the template, its workspace model, provider wiring or privileged computer controls",
    productFit: ["SONARA One", "Creator Studio", "Internal Development", "Agent Control Plane"],
    integrationStatus: "reference_only_privileged_agent_workspace",
    capabilities: [
      "persistent spaces, pages and specialist agents",
      "text and realtime-call interaction",
      "background work, Slack channels, browser/computer actions and human approval patterns"
    ],
    safety: [
      "Upstream describes browser, file, shell and computer controls; those are privileged actions that require server-enforced permissions, isolation, audit and explicit approval.",
      "Provider credentials must remain server-side and customer data may not be sent to an unreviewed model, speech, channel or browser provider.",
      "The upstream README describes a single-owner starting point; it is not evidence of multi-tenant production isolation.",
      "SONARA's provider gateway, tenant boundaries, durable execution and approval system remain authoritative."
    ],
    blockedUses: [
      "copying the template into SONARA as a parallel agent operating system",
      "connecting customer Slack, browser, shell or files without provider-specific authorization and tenant isolation",
      "autonomously publishing, billing, deleting or changing customer records"
    ],
    nextStep: "Study the explicit approval card, separated browser service, call receipt and background-work status patterns; reproduce only clean-room interaction contracts that fit existing SONARA routes and authority.",
    sourceEvidence: [
      "https://github.com/CopilotKit/OpenDots",
      "https://github.com/CopilotKit/OpenDots/blob/main/README.md",
      "https://github.com/CopilotKit/OpenDots/blob/main/LICENSE"
    ]
  },
  {
    key: "ys_ll_uniterm",
    label: "uniTerm",
    repository: "ys-ll/uniterm",
    repoUrl: "https://github.com/ys-ll/uniterm",
    repositoryVerified: true,
    license: "Apache-2.0 for repository source; remote systems, credentials, database clients, cloud services and model providers remain separately governed",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "privileged_multi_protocol_terminal_remote_admin_and_agent_client",
    placement: "Founder/Internal Development remote-operations research only; no production hosts, databases, clusters or customer systems are connected",
    productFit: ["Internal Development", "Founder Operations", "Research Lab"],
    integrationStatus: "research_only_privileged_remote_operations",
    capabilities: [
      "SSH, remote desktop, file transfer, databases and container/Kubernetes management",
      "local and remote terminal sessions",
      "autonomous multi-turn shell-command agent with configurable confirmation modes"
    ],
    safety: [
      "The product can reach shells, files, databases, remote desktops, containers and clusters, so compromise or an incorrect command can have broad impact.",
      "An autonomous terminal mode is not appropriate for production/customer infrastructure without least privilege, command policy, previews, approvals, immutable audit and recovery.",
      "Never import production credentials into a research desktop tool or permit self-authored skills to widen command authority.",
      "Unsigned or prebuilt binaries require normal supply-chain verification; source licensing does not establish binary provenance."
    ],
    blockedUses: [
      "unattended production shell access",
      "customer credential storage",
      "direct database mutation outside SONARA application/RLS contracts",
      "cluster or container mutation without an approved runbook and rollback"
    ],
    nextStep: "Keep as a remote-operations UX reference. If a founder workstation comparison is later approved, use a disposable test host with no production secrets and confirmation-all mode.",
    sourceEvidence: [
      "https://github.com/ys-ll/uniterm",
      "https://github.com/ys-ll/uniterm/blob/main/README.md",
      "https://github.com/ys-ll/uniterm/blob/main/LICENSE"
    ]
  }
];

const NON_REPOSITORY_REFERENCES = [
  {
    key: "hf_minimax_h3_family",
    label: "Hugging Face MiniMax H3 family and community video variants",
    status: "model_hub_reference_only",
    observedTheme: "Screenshots show MiniMaxAI/MiniMax-H3 plus H3 Turbo LoRA, keyframe, 360-orbit, realism and character-swap variants.",
    reason: "A Hub card or Space does not grant model, territory, output, LoRA, training-data or commercial rights. Batch 22 already records MiniMax H3 model-term restrictions and keeps the path non-executable.",
    nextStep: "Keep provider-neutral video schemas. Do not configure MiniMax H3 or a derivative until current model terms, territory eligibility, provenance, compute, moderation and commercial rights are independently approved."
  },
  {
    key: "hf_flux2_krea_and_image_generation_family",
    label: "FLUX.2, Krea 2 and other image-generation/editing model cards",
    status: "model_hub_reference_only",
    observedTheme: "Screenshots show FLUX.2 Klein/Dev variants, Krea 2 Turbo/Raw, Stable Diffusion, Z-Image, Ming Image, Qwen image/edit variants and community LoRAs.",
    reason: "Each code repository, model weight, quantization, LoRA and hosted inference path can have different terms. The screenshot's inference badge does not establish commercial permission, cost, safety or production availability.",
    nextStep: "Verify one exact model revision at a time. Record model-card license, weight format, gated access, commercial terms, moderation, GPU budget, provenance and output policy before any offline evaluation."
  },
  {
    key: "hf_speech_audio_stack",
    label: "Hugging Face speech, diarization, TTS and audio-generation stack",
    status: "model_hub_reference_only",
    observedTheme: "Screenshots include Whisper v3/v3 Turbo, pyannote diarization/segmentation, Nemotron ASR/diarization, Kokoro, Pocket TTS, Chatterbox, Stable Audio, Cohere Transcribe, Audio8 ASR and PersonaPlex.",
    reason: "Speech systems can capture voices, identities, private conversation and sensitive content; model terms, access gates, speaker-consent rules and retention differ by resource.",
    nextStep: "Prefer the existing governed Whisper/Kokoro records where applicable. Any new speech resource needs consent, retention/deletion, provenance, speaker/voice rights, offline quality tests and a separate provider/model license review."
  },
  {
    key: "hf_text_reasoning_and_decision_models",
    label: "Hugging Face text, reasoning, multimodal and decision-model candidates",
    status: "model_hub_reference_only",
    observedTheme: "Screenshots include Qwen 3.x/3.8 families, DeepSeek V4 variants, GLM 5.3/Flash, Gemma, Llama, GPT-OSS, Kimi, Bonsai/Jev/Laya-style decision models and other community fine-tunes.",
    reason: "Trending order, download count and inference availability are not SONARA quality, legal, safety or cost evidence. Fine-tunes may change behavior and licensing from the base model.",
    nextStep: "Add only source-verified candidates to the model control plane after exact-card, exact-revision, license, resource, structured-output and offline SONARA benchmark review. Provider Gateway remains authoritative."
  },
  {
    key: "hf_embeddings_vision_and_segmentation",
    label: "Hugging Face embedding, retrieval, vision and segmentation candidates",
    status: "model_hub_reference_only",
    observedTheme: "Screenshots include BGE-M3, EmbeddingGemma, MiniLM sentence similarity, SAM3, CLIP/JEV-like semantic fields and vision/classification models.",
    reason: "Similarity and segmentation outputs are probabilistic and do not prove identity, ownership, consent, eligibility or factual truth.",
    nextStep: "Evaluate only on tenant-authorized or synthetic data. Preserve retrieval provenance, measure false positives/negatives, and prohibit sensitive-trait or consequential-person decisions."
  },
  {
    key: "hf_datasets_batch23",
    label: "Hugging Face datasets visible in Batch 23",
    status: "dataset_reference_only",
    observedTheme: "Screenshots show Wikipedia, arXiv, YODAS3, doctor-patient conversation, audit-findings, typed-decisions, reasoning, embodied/imagined-world and reinforcement-learning datasets.",
    reason: "A dataset page does not establish training rights, redistribution rights, privacy, consent, medical-data fitness, provenance or suitability for customer data.",
    nextStep: "Do not ingest. For any future benchmark, verify the authoritative dataset card, license, source provenance, sensitive-data posture, subset size, attribution and separation from production customer records."
  },
  {
    key: "hf_uncensored_abliterated_nsfw_and_face_swap",
    label: "Uncensored, abliterated, NSFW, face-swap and safety-removal model variants",
    status: "blocked_from_runtime_research_only",
    observedTheme: "Several screenshots show community models or Spaces marketed as uncensored, abliterated, NSFW, face swap, head swap or safety-modified variants.",
    reason: "Those labels are a high-risk provenance and safety signal, not a capability target. They can introduce non-consensual likeness, explicit-content, impersonation, license and safety-control problems.",
    nextStep: "Do not route, download, fine-tune, host or promote these variants. Preserve only the defensive research lesson: model provenance, refusal integrity, consent and output policy must be independently tested."
  },
  {
    key: "hf_spaces_media_workflows",
    label: "Hugging Face Spaces for video/image workflows and LoRAs",
    status: "hosted_space_reference_only",
    observedTheme: "Screenshots include Omni Video Factory, KV Image to Clip, rapid Qwen edit LoRAs, Qwen Move, FLUX multi-LoRA, Semantic Image Field, Gate Arcade, RoboTok and other Spaces.",
    reason: "A Space combines code, models, adapters, assets and runtime infrastructure with potentially different licenses and data-handling behavior. Popularity and ZeroGPU/MCP/Agent badges are not an integration contract.",
    nextStep: "Treat each Space as a discovery lead only. If a workflow matters, decompose the capability into SONARA-owned inputs, deterministic validation, approved provider/model adapters, provenance, cost and bounded worker execution."
  },
  {
    key: "restaurant_ai_phone_and_reservation_ad",
    label: "Restaurant AI phone answering, reservations, orders and alert advertising",
    status: "competitive_pattern_reference",
    observedTheme: "A restaurant ad bundles 24/7 call answering, reservations, order/inquiry intake and instant alerts.",
    reason: "The ad proves neither accuracy, integration depth, pricing durability, consent handling nor restaurant-specific production reliability.",
    nextStep: "Use it as a Business Builder vertical workflow benchmark: caller consent/disclosure, hours/menu source of truth, reservation/order provider adapters, confirmation receipts, escalation, failure state and owner controls."
  },
  {
    key: "restaurant_pos_price_comparison_ad",
    label: "All-in-one restaurant POS pricing comparison ad",
    status: "competitive_claim_reference",
    observedTheme: "A POS advertisement compares hardware, setup, monthly and multi-year pricing across several vendors and offers a switching incentive.",
    reason: "Promotional pricing, competitor figures and bonuses are time-sensitive and may include qualifications not visible in the screenshot.",
    nextStep: "Do not copy price claims. Research POS only from current first-party terms and map any SONARA commerce/POS capability to real payment, device, order, tax, offline, reconciliation and support boundaries."
  },
  {
    key: "restaurant_menu_navigation_research",
    label: "Consumer menu-navigation research presentation",
    status: "design_research_reference",
    observedTheme: "The visual emphasizes clear included items, exact-item photos, popular/best-seller cues, ready-made combos and portion-size information.",
    reason: "The percentages are screenshot evidence from a third-party page, not a SONARA research result and should not be republished as our statistics without primary-source verification.",
    nextStep: "Use only the UX hypotheses: explicit inclusions/add-ons, accurate photos when owned, clear portion labels, optional popularity signals backed by real sales data, and accessible menu grouping."
  },
  {
    key: "law_firm_ai_marketing_orchestration",
    label: "Law-firm marketing orchestration and practical-guide diagrams",
    status: "vertical_workflow_reference",
    observedTheme: "The diagrams organize goals, systems of record, human input, knowledge, orchestration, lead generation, support, content, missed-call recovery, follow-up, reviews and documents.",
    reason: "A diagram does not establish legal-industry compliance, provider terms, client confidentiality, advertising rules, source accuracy or real automation success.",
    nextStep: "Convert only the generic architecture into reusable vertical templates: source-of-truth records, human-led policy, bounded automation, approvals, confidentiality, audit, retention and provider receipts. Avoid legal advice generation claims."
  },
  {
    key: "hero_landing_page_collection",
    label: "Modern hero and landing-page collection",
    status: "visual_reference_only",
    observedTheme: "Screenshots show editorial whitespace, strong serif/sans hierarchy, soft gradients, product mockups, prominent CTAs and focused navigation.",
    reason: "These are third-party design examples; copying layouts, branding, imagery or content would not create a unique SONARA product and may create rights issues.",
    nextStep: "Extract only abstract design tokens and hierarchy questions. Keep SONARA's current v3/Balanced Precision authority, accessibility, truthful states, owned copy and route-to-result rules."
  },
  {
    key: "automotive_landing_page_reference",
    label: "Automotive product landing-page mockup",
    status: "visual_reference_only",
    observedTheme: "The design mixes full-bleed product imagery, repeated benefit headlines, specification cards, testimonials, FAQ and a large branded footer.",
    reason: "The brand, vehicle imagery, metrics and testimonials are illustrative third-party content, not reusable SONARA assets or proof.",
    nextStep: "Use only the page-architecture lesson: evidence-backed hero, measurable specifications, feature storytelling, FAQ and strong conversion path with no fabricated proof."
  },
  {
    key: "attendance_mobile_app_reference",
    label: "Student attendance mobile UI",
    status: "visual_reference_only",
    observedTheme: "The screens cover onboarding, login, dashboard, QR check-in, attendance history, schedule, profile, notifications, settings and parent view.",
    reason: "The mockup is not an implemented SONARA workflow and attendance data can be sensitive.",
    nextStep: "Reuse only the task-flow pattern if a real vertical requires it: role scope, signed check-in, source correction, offline/stale state, accessibility, retention and no fabricated attendance records."
  },
  {
    key: "developer_portfolio_and_resume_layouts",
    label: "Developer portfolio and resume/CV layout references",
    status: "visual_reference_only",
    observedTheme: "Screenshots show dark developer portfolio sections and a dense one-page cybersecurity resume with clear headings, skills and experience.",
    reason: "Personal names, contact details, achievements, logos, photos and sample metrics are third-party example content.",
    nextStep: "Use only hierarchy and information-density patterns for Creator Studio portfolio/resume templates built from user-owned data and exportable, accessible layouts."
  },
  {
    key: "kubernetes_learning_roadmap_reference",
    label: "Kubernetes learning roadmap",
    status: "educational_reference_only",
    observedTheme: "The poster progresses from Linux/networking/containers through Kubernetes objects, networking/storage, advanced topics, CI/CD/observability/security and managed-cloud projects.",
    reason: "A roadmap is educational guidance, not proof SONARA should adopt Kubernetes; the current stack must not acquire cluster complexity without a measured operational need.",
    nextStep: "Keep as staff-learning reference only. Activate Kubernetes architecture work only when workload scale or isolation requirements exceed the current managed/serverless worker plan."
  },
  {
    key: "javascript_string_methods_cheatsheet",
    label: "JavaScript string-method cheat sheet",
    status: "educational_reference_only",
    observedTheme: "The graphic summarizes template literals, charCodeAt, fromCharCode, indexOf, includes, slice and case conversion.",
    reason: "A social-media cheat sheet can omit edge cases and is not an engineering authority.",
    nextStep: "Use current JavaScript/Node documentation and repository tests for implementation decisions; keep the graphic as a learning prompt only."
  },
  {
    key: "ccna_scenario_and_lab_practice",
    label: "Scenario-based network and hands-on lab practice",
    status: "educational_reference_only",
    observedTheme: "The screenshots emphasize decision practice, configuration, verification and troubleshooting rather than memorization.",
    reason: "The workbook content and answers are third-party educational material and are not copied into SONARA.",
    nextStep: "Adopt only the training pattern: scenario -> action -> verification evidence -> troubleshooting -> reflection. Use SONARA-authored infrastructure labs and owned fixtures."
  }
];

const CONFIRMED_EXISTING_RECORDS = [
  {
    key: "voicestudio_existing",
    label: "VoiceStudio",
    repository: "debpalash/voicestudio",
    source: "Maintained open-source/social repository registry",
    note: "The screenshot repeats an existing AGPL-3.0 voice-cloning reference. The existing blocked/security posture remains authoritative; no code, model or voice asset is adopted."
  },
  {
    key: "qwen_image_21_existing",
    label: "Qwen Image 2.1",
    resourceId: "Qwen/Qwen-Image-2.1",
    source: "Batch 19 Awesome Qwen Image review",
    note: "The current uploads repeat a resource already governed as research-only with separate model terms and item-specific community-asset licenses."
  },
  {
    key: "whisper_large_v3_turbo_existing",
    label: "Whisper Large v3 Turbo",
    resourceId: "openai/whisper-large-v3-turbo",
    source: "Governed Hugging Face resource catalog",
    note: "Existing pilot-ready metadata remains subject to recording consent, retention/deletion, tenant isolation and asynchronous worker boundaries."
  },
  {
    key: "kokoro_82m_existing",
    label: "Kokoro 82M",
    resourceId: "hexgrad/Kokoro-82M",
    source: "Governed Hugging Face resource catalog",
    note: "Existing review-required TTS record remains authoritative, including voice-consent/provenance and safe-weight loading requirements."
  },
  {
    key: "flux1_schnell_existing",
    label: "FLUX.1 Schnell",
    resourceId: "black-forest-labs/FLUX.1-schnell",
    source: "Governed Hugging Face resource catalog",
    note: "Existing review-required image-generation record remains authoritative; no model weights or hosted endpoint are activated by this intake."
  }
];

const ARCHITECTURE_EXTENSIONS = [
  {
    key: "agent_test_harness_contract",
    title: "Agent test harness with deterministic proof",
    product: "Internal Development",
    principle: "Natural-language test intent may choose actions, but a release passes only on deterministic assertions and captured postconditions.",
    implementation: "Scope target and synthetic identity -> agent proposes/executes bounded actions -> record normalized action trace -> assert DOM/API/state invariants -> replay stable steps without a model where possible -> retain screenshots/logs as evidence -> fail closed on ambiguity, unexpected navigation, destructive scope or stale environment."
  },
  {
    key: "mobile_device_automation_boundary",
    title: "Mobile device automation security boundary",
    product: "Internal Development",
    principle: "Device automation is privileged infrastructure, not a general customer-facing MCP permission.",
    implementation: "Use dedicated simulators/emulators or test devices; synthetic accounts; device allowlist; scoped app/bundle targets; file/path and deep-link validation; recording and clipboard policy; no production secrets; bounded sessions; explicit install/uninstall approval; action logs; wipe/reset after runs; exact-version security review before use."
  },
  {
    key: "deterministic_procedural_media_lane",
    title: "Deterministic procedural media lane",
    product: "Creator Studio",
    principle: "Browser-native media can be useful without a generative model when every frame, cue and export is reproducible from versioned inputs.",
    implementation: "Use SONARA-owned Canvas/WebAudio code, seeded state, explicit timeline/cue manifests, deterministic math, fixed export settings, source-asset rights records, golden-frame/audio tests and provenance receipts. Keep model generation as an optional separate provider lane."
  },
  {
    key: "agent_memory_lifecycle_contract_batch23",
    title: "Agent memory lifecycle and authority boundary",
    product: "Agent Control Plane",
    principle: "Memory can inform context; it cannot silently create permissions or overwrite authoritative business records.",
    implementation: "Separate source events, durable approved facts, derived summaries and procedural knowledge; store tenant/owner/source/time/sensitivity/retention/version; support inspect/correct/supersede/delete; propagate deletion to indexes; test cross-tenant denial and stale-memory conflicts; require current system-of-record reads for consequential actions."
  },
  {
    key: "privileged_remote_operations_contract",
    title: "Privileged remote operations contract",
    product: "Founder Operations",
    principle: "Terminal, SSH, database, remote-desktop and cluster control require stronger authorization than ordinary application tools.",
    implementation: "Use just-in-time scoped credentials, target allowlists, command classification, dry-run/preview when possible, confirmation for writes, immutable action/audit receipts, secret redaction, session expiry, break-glass policy, backup/rollback evidence and postcondition verification. Never make a local agent console an alternate production control plane."
  },
  {
    key: "voice_and_speech_consent_provenance_contract",
    title: "Voice and speech consent/provenance contract",
    product: "Creator Studio",
    principle: "Speech transcription, synthesis and cloning have separate consent, identity, retention and disclosure requirements.",
    implementation: "Record recording authority and voice/likeness permission; distinguish ASR from TTS/voice cloning; store model/provider revision and synthetic-output provenance; disclose generated speech where appropriate; enforce retention/delete; prevent unauthorized impersonation; isolate raw audio; require human approval before public publishing."
  },
  {
    key: "vertical_workflow_template_contract",
    title: "Vertical workflow template contract",
    product: "Business Builder",
    principle: "Industry diagrams become useful only after each claim maps to a real record, connector, permission, state transition and measurable result.",
    implementation: "Define restaurant/law/other vertical templates as route + actor + source of truth + typed input/output + connector + approval + retry/idempotency + receipt + escalation + metric definition. Keep regulated/professional advice outside template claims and preserve owner review."
  },
  {
    key: "model_hub_promotion_gate",
    title: "Model-hub research-to-runtime promotion gate",
    product: "Model Engine Control Plane",
    principle: "Trending or inference-available is discovery metadata, not execution authority.",
    implementation: "Observed resource -> exact upstream/model card -> immutable revision -> code/weight/dataset/output-license review -> serialization/custom-code scan -> territory/commercial terms -> compute budget -> privacy/moderation/rights policy -> offline benchmark -> provider/worker isolation -> tenant-safe canary -> explicit enable flag. Any failed or unknown gate remains non-executing."
  },
  {
    key: "design_reference_truth_contract_batch23",
    title: "Design-reference truth and originality contract",
    product: "All workspaces",
    principle: "A screenshot may inspire hierarchy and interaction questions, never copied branding, proof, prices, testimonials or product claims.",
    implementation: "Translate references into original SONARA tokens/components; connect every CTA to an owned route/result; use real or clearly marked synthetic data; preserve loading/empty/error/success states; validate contrast, keyboard, focus, zoom, touch targets and mobile reflow; cite only source-backed statistics in public copy."
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
    checkedOn: "2026-10-03",
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    enabledInProduction: false,
    canExecute: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch23_2026_10_03"
  });
}

const SCREENSHOT_TOOL_RADAR_BATCH23 = Object.freeze(REPOSITORIES.map(freezeRepository));
const NON_REPOSITORY_REFERENCES_BATCH23 = Object.freeze(NON_REPOSITORY_REFERENCES.map((item) => Object.freeze({
  ...item,
  source: "user_submitted_screenshot_research_batch23_2026_10_03"
})));
const CONFIRMED_EXISTING_RECORDS_BATCH23 = Object.freeze(CONFIRMED_EXISTING_RECORDS.map((item) => Object.freeze({ ...item })));
const ARCHITECTURE_EXTENSIONS_BATCH23 = Object.freeze(ARCHITECTURE_EXTENSIONS.map((item) => Object.freeze({ ...item })));

function getPublicScreenshotToolCatalogBatch23() {
  return SCREENSHOT_TOOL_RADAR_BATCH23.map((item) => ({
    ...item,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses],
    sourceEvidence: [...item.sourceEvidence]
  }));
}

function getNonRepositoryReferencesBatch23() {
  return NON_REPOSITORY_REFERENCES_BATCH23.map((item) => ({ ...item }));
}

function getConfirmedExistingRecordsBatch23() {
  return CONFIRMED_EXISTING_RECORDS_BATCH23.map((item) => ({ ...item }));
}

function getArchitectureExtensionsBatch23() {
  return ARCHITECTURE_EXTENSIONS_BATCH23.map((item) => ({ ...item }));
}

function getScreenshotToolReadinessBatch23() {
  const repositories = getPublicScreenshotToolCatalogBatch23();
  return {
    ok: true,
    batch: 23,
    mode: "static_governed_screenshot_research_batch23",
    screenshotCount: 54,
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    reciprocalLicenseCount: repositories.filter((item) => item.reciprocalLicense).length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH23.length,
    confirmedExistingRecordCount: CONFIRMED_EXISTING_RECORDS_BATCH23.length,
    deduplicatedReferenceCount: 0,
    architectureExtensionCount: ARCHITECTURE_EXTENSIONS_BATCH23.length,
    productionExecutionCount: 0,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch23(),
    confirmedExistingRecords: getConfirmedExistingRecordsBatch23(),
    deduplicatedReferences: [],
    architectureExtensions: getArchitectureExtensionsBatch23()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH23,
  NON_REPOSITORY_REFERENCES_BATCH23,
  CONFIRMED_EXISTING_RECORDS_BATCH23,
  ARCHITECTURE_EXTENSIONS_BATCH23,
  getPublicScreenshotToolCatalogBatch23,
  getNonRepositoryReferencesBatch23,
  getConfirmedExistingRecordsBatch23,
  getArchitectureExtensionsBatch23,
  getScreenshotToolReadinessBatch23
};
