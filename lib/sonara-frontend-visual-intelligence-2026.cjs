// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { SONARA_BRAND_REGISTRY, getBrandProduct } = require("./sonara-brand-registry.cjs");

const FRONTEND_VISUAL_SNAPSHOT_DATE = "2026-09-30";
const FRONTEND_VISUAL_VERSION = "1.2.0";

const FRONTEND_MARKET_SIGNALS_2026 = Object.freeze([
  Object.freeze({
    key: "global_attention_is_search_video_social_and_ai",
    category: "market",
    asOf: "2026-08-31",
    source: "Similarweb",
    sourceUrl: "https://www.similarweb.com/blog/research/market-research/most-visited-websites/",
    evidence: "August 2026 global web traffic places Google, YouTube, Facebook, Instagram, and ChatGPT among the five most-visited sites.",
    sonaraDecision: "Keep global search, media, social, and conversational entry points as distinct navigation intents instead of collapsing them into one overloaded dashboard.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "mobile_ai_and_communication_are_primary_entry_points",
    category: "market",
    asOf: "2026-09-15",
    source: "Similarweb",
    sourceUrl: "https://www.similarweb.com/top-apps/google/",
    evidence: "Current US Android usage rankings are led by browser, messaging, search, and social applications while AI and commerce are prominent among top-grossing apps.",
    sonaraDecision: "Treat mobile search, messages, notifications, assistant access, and fast task continuation as first-class shell capabilities.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "productivity_charts_are_ai_first",
    category: "market",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Apple App Store",
    sourceUrl: "https://apps.apple.com/us/iphone/charts/6007?chart=top-free",
    evidence: "The current US iPhone Productivity chart includes multiple AI assistants alongside email, drive, office, authentication, and calendar tools.",
    sonaraDecision: "The assistant belongs inside the work shell, but records, files, identity, and scheduling remain explicit deterministic surfaces.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "business_mobile_is_workflow_not_dashboard_only",
    category: "market",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Apple App Store",
    sourceUrl: "https://apps.apple.com/us/iphone/charts/6000?chart=top-free",
    evidence: "Current US Business rankings emphasize jobs, professional networks, delivery work, meetings, documents, identity, HR, shipping, POS, and team communication.",
    sonaraDecision: "Design Business Builder around actionable task lanes: customers, jobs, delivery, documents, staff, payments, identity, and communication.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "creator_mobile_is_edit_publish_store_analyze",
    category: "market",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Apple App Store",
    sourceUrl: "https://apps.apple.com/us/iphone/charts/6008?chart=top-free",
    evidence: "Current Photo & Video rankings combine editing, publishing, storage, live streaming, creator studios, and AI media tools.",
    sonaraDecision: "Creator Studio should join asset management, editing states, publishing status, rights/provenance, and channel analytics without pretending one canvas replaces specialist editors.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "commerce_ux_is_mobile_performance_and_checkout",
    category: "commerce",
    asOf: "2026-07-28",
    source: "Shopify",
    sourceUrl: "https://www.shopify.com/blog/ecommerce-ux",
    evidence: "Shopify's 2026 guidance centers navigation, product discovery, mobile UX, page speed, cart clarity, and low-friction checkout.",
    sonaraDecision: "Storefront and checkout surfaces prioritize speed, guest-friendly progression, clear costs, persistent order context, and minimal form friction.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "performance_is_part_of_visual_quality",
    category: "performance",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "web.dev",
    sourceUrl: "https://web.dev/articles/vitals",
    evidence: "Core Web Vitals guidance targets LCP <= 2.5s, INP <= 200ms, and CLS <= 0.1 at the 75th percentile.",
    sonaraDecision: "Visual polish must stay inside measurable loading, interaction, and layout-stability budgets.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "wcag22_changes_operational_interactions",
    category: "accessibility",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "W3C",
    sourceUrl: "https://www.w3.org/TR/WCAG22/",
    evidence: "WCAG 2.2 adds focus-not-obscured, dragging alternatives, and minimum target-size requirements relevant to dense workspaces, kanban boards, maps, and editors.",
    sonaraDecision: "Every drag interaction needs a non-drag alternative; sticky controls cannot hide focus; SONARA retains its stronger 44px default target even though WCAG AA permits smaller targets under defined conditions.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "glass_is_a_control_layer_not_content",
    category: "visual_design",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Apple Human Interface Guidelines",
    sourceUrl: "https://developer.apple.com/documentation/technologyoverviews/liquid-glass",
    evidence: "Apple's current design direction emphasizes adaptable layouts, predictable navigation, restrained control color, and Liquid Glass as a navigation/control treatment around content.",
    sonaraDecision: "Reserve translucency and cinematic material effects for navigation, overlays, startup, and presentation; keep operational content surfaces opaque enough for fast scanning.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "adaptive_navigation_changes_with_screen_class",
    category: "responsive_design",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Android Developers",
    sourceUrl: "https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns",
    evidence: "Material guidance adapts navigation patterns to window size rather than stretching a single mobile pattern onto tablets and large screens.",
    sonaraDecision: "Use bottom navigation only where compact screens justify it; promote to rails or persistent side navigation on wider operational layouts.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "enterprise_accessibility_is_structural",
    category: "accessibility",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Microsoft Fluent 2",
    sourceUrl: "https://fluent2.microsoft.design/accessibility",
    evidence: "Fluent emphasizes predictable hierarchy, managed focus, contrast, responsive reflow, zoom support, semantic code, and plain language.",
    sonaraDecision: "Accessibility is a layout and state contract, not a final color-contrast pass.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "design_systems_scale_through_tokens_and_modes",
    category: "design_system",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Figma",
    sourceUrl: "https://www.figma.com/design-systems/",
    evidence: "Figma's design-system guidance emphasizes shared components, variables, modes, and tokenized design decisions across products and themes.",
    sonaraDecision: "Keep SONARA's existing CSS token families as authority and map any future design-tool variables to them rather than introducing parallel color/spacing vocabularies.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "creative_suites_merge_documents_data_and_media",
    category: "creator",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Canva",
    sourceUrl: "https://www.canva.com/visual-suite/",
    evidence: "Current visual-suite positioning combines docs, data visualization, media creation, collaboration, and AI-assisted production in one workspace family.",
    sonaraDecision: "Creator Studio should use shared project context and asset rails while preserving specialist media workspaces instead of forcing every task into one editor.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "restaurant_ui_is_continuous_order_fulfillment_payment",
    category: "restaurant",
    asOf: "2026-09-17",
    source: "Toast",
    sourceUrl: "https://support.toasttab.com/en/article/Mobile-Order-and-Pay-Overview",
    evidence: "Toast's current mobile flow connects menu browsing, continuous tabs, order routing, staff additions, split payment, fulfillment communication, loyalty, and guest data.",
    sonaraDecision: "Restaurant surfaces need one canonical order state visualized differently for guest, counter, handheld, kitchen, pickup, and manager contexts.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "kiosk_ui_requires_large_visual_choices_and_persistent_cart",
    category: "kiosk",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Square",
    sourceUrl: "https://squareup.com/help/us/en/article/8540-preview-diner-experience-on-square-kiosk",
    evidence: "Square describes kiosk UX with picture-based categories, large fonts and tap targets, recommendations, and a persistent cart.",
    sonaraDecision: "Kiosk mode gets its own large-touch density, persistent transaction context, visible escape/back actions, and no admin complexity.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "fleet_ui_is_role_and_status_driven",
    category: "fleet",
    asOf: "2026-09-02",
    source: "Samsara",
    sourceUrl: "https://kb.samsara.com/hc/en-us/articles/48621492984589-Dashboard-Menus",
    evidence: "Samsara's dashboard is organized around role- and license-dependent modules such as overview, safety, compliance, maintenance, routing, forms, and alerts.",
    sonaraDecision: "Fleet and field navigation should be entitlement-aware and center location, status, exceptions, work, and alerts rather than decorative KPI density.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "spatial_ui_needs_comfort_not_depth_everywhere",
    category: "spatial",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Apple Human Interface Guidelines",
    sourceUrl: "https://developer.apple.com/design/human-interface-guidelines/spatial-layout/",
    evidence: "Spatial guidance recommends centering important content, using depth to clarify hierarchy, avoiding depth on text, and limiting excess windows and motion.",
    sonaraDecision: "3D is reserved for CAD, product, facility, map, simulation, or media contexts where depth conveys information; ordinary business text stays planar.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "ai_native_ui_is_composed_from_design_knowledge",
    category: "agentic_ui",
    asOf: "2026-05-12",
    source: "SAP",
    sourceUrl: "https://www.sap.com/design/stories-resources/evolving-design-systems-for-ai-driven-ux",
    evidence: "SAP describes enterprise interfaces shifting toward intent- and context-composed experiences backed by design-system knowledge.",
    sonaraDecision: "SONARA can add intent-composed panels only through bounded semantic components and policy-validated composition; deterministic navigation remains available.",
    runtimeAuthority: "none"
  })
]);


const FRONTEND_MARKET_SIGNALS_PASS2_2026 = Object.freeze([
  Object.freeze({
    key: "distinct_brand_expression_can_share_accessible_system_contracts",
    category: "brand_architecture",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Apple Human Interface Guidelines; Shopify Polaris; Walmart Brand Center",
    sourceUrl: "https://developer.apple.com/design/human-interface-guidelines/design-principles/",
    supportingSourceUrls: Object.freeze([
      "https://shopify.dev/docs/api/polaris",
      "https://brandcenter.walmart.com/brand/brand-identity/color"
    ]),
    evidence: "First-party design guidance emphasizes clear purpose, simplicity, accessibility, user agency, and consistent systems; Polaris describes a unified platform UI framework while Walmart documents its own distinct identity and color use.",
    sonaraDecision: "Keep one shared interaction, accessibility, data, and authorization contract, then apply independent original landing-page art direction, accent tokens, content, and work-surface patterns to SONARA Industries, SONARA One, Business Builder, Creator Studio, and Growth Studio.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "external_publishing_requires_user_preview_and_provider_compliance",
    category: "integrations_and_trust",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "TikTok for Developers",
    sourceUrl: "https://developers.tiktok.com/doc/content-sharing-guidelines",
    evidence: "TikTok's content-sharing guidance requires clear user awareness and control, preview of the material to be posted, and compliance with API audit and disclosure requirements.",
    sonaraDecision: "Treat external publishing as a provider-scoped, user-initiated action with a content preview, explicit account/visibility state, consent and disclosure checks, idempotent execution, receipt, and recovery path; never imply that a research reference provides API access.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "gaming_console_patterns_require_accessibility_across_input_and_output",
    category: "accessibility_and_input",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Xbox Accessibility Guidelines; PlayStation Accessibility; Nintendo Switch 2 Support",
    sourceUrl: "https://learn.microsoft.com/en-us/xbox/accessibility/guidelines",
    supportingSourceUrls: Object.freeze([
      "https://www.playstation.com/en-us/accessibility/",
      "https://en-americas-support.nintendo.com/app/answers/detail/a_id/68395"
    ]),
    evidence: "First-party console guidance documents configurable accessibility features across input, display, audio, text, captions, and game discovery; Nintendo documents button mapping, text-to-speech, and text-size controls.",
    sonaraDecision: "Apply controller-grade focus visibility, complete keyboard paths, configurable density and text, captions/transcripts for media, and non-color-only status to dashboard, kiosk, living-room, and media surfaces. A pointer-only or hover-only interaction is incomplete.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "operational_quality_depends_on_explicit_payment_and_order_states",
    category: "commerce_and_operations",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Stripe API Reference; McDonald's Mobile Order & Pay; Honda Digital UX",
    sourceUrl: "https://docs.stripe.com/api/idempotent_requests",
    supportingSourceUrls: Object.freeze([
      "https://www.mcdonalds.com/us/en-us/mobile-order-and-pay.html",
      "https://global.honda/content/dam/site/global-en/newsroom-new/cq_img/news/2024/10/c241009eng/c241009eng.pdf"
    ]),
    evidence: "Stripe documents replay-safe idempotent requests; McDonald's documents location-aware mobile ordering and item availability; Honda describes simplifying in-vehicle operation and voice support.",
    sonaraDecision: "Represent payment, inventory/availability, order acceptance, dispatch, and fulfillment with server-owned canonical states, timestamps, idempotency keys, and explicit retry/recovery outcomes; interfaces explain status and next action rather than guessing from a spinner.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "media_discovery_needs_browse_search_resume_and_accessible_metadata",
    category: "media_and_discovery",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Netflix; Spotify for Developers; Reddit Accessibility Guides",
    sourceUrl: "https://about.netflix.com/en/news/introducing-exciting-new-ways-to-find-and-enjoy-your-next-favorite-on-mobile",
    supportingSourceUrls: Object.freeze([
      "https://developer.spotify.com/documentation/design",
      "https://support.reddithelp.com/hc/en-us/articles/38715789036948-Accessibility-Guides-An-Overview"
    ]),
    evidence: "Netflix describes distinct browse and discovery experiences across TV and mobile; Spotify publishes third-party design and branding rules; Reddit publishes screen-reader, text-to-speech, and display accessibility guidance.",
    sonaraDecision: "Keep Creator Studio's project library, creation, media review, publishing, and analytics as linked but separate task surfaces. Preserve resumable project context, source/rights metadata, captions, keyboard navigation, and user-controlled publishing.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "ai_is_becoming_a_cross_category_commercial_layer",
    category: "market",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Sensor Tower",
    sourceUrl: "https://sensortower.com/blog/state-of-ai-2026",
    evidence: "Sensor Tower reports AI usage, shopping referrals, advertising, and AI-labelled app adoption expanding across major digital verticals in 2026.",
    sonaraDecision: "Treat AI as a contextual capability inside commerce, finance, education, productivity, service, media, and operations surfaces rather than forcing every workflow into a chatbot.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "mobile_growth_is_monetization_and_retention_led",
    category: "market",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Sensor Tower",
    sourceUrl: "https://sensortower.com/blog/state-of-mobile-2026",
    evidence: "Sensor Tower reports nearly 150 billion mobile downloads and $167 billion in 2025 in-app purchase revenue, with non-game app monetization accelerating into 2026.",
    sonaraDecision: "Optimize mobile surfaces for repeat task completion, subscription value, retention, and low-friction return paths rather than raw feature density.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "agent_ui_requires_approval_durability_and_visible_tool_state",
    category: "agentic_ui",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Vercel",
    sourceUrl: "https://vercel.com/blog/ai-sdk-7",
    evidence: "AI SDK 7 exposes tool approval policies, durable resumable agent execution, and hardened approval replay for longer-running agents.",
    sonaraDecision: "Agent interfaces must render pending tools, approval requests, resumable state, failure, completion, and policy outcome as first-class UI states.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "design_system_context_improves_agent_implementation_efficiency",
    category: "design_systems",
    asOf: "2026-09-02",
    source: "Figma",
    sourceUrl: "https://www.figma.com/blog/how-coinbase-used-code-connect-to-shrink-token-costs/",
    evidence: "Figma reports Coinbase tests in which design-system context improved adherence while reducing average implementation cost and time for coding-agent tasks.",
    sonaraDecision: "Make SONARA design tokens, semantic components, state contracts, and deprecated-pattern rules machine-readable so coding agents start from governed context instead of guessing.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "design_code_motion_and_shader_workflows_are_converging",
    category: "visual_design",
    asOf: "2026-06-24",
    source: "Figma",
    sourceUrl: "https://www.figma.com/blog/config-2026-recap/",
    evidence: "Config 2026 introduced code layers, timeline-based motion, shaders, generative plugins, and agent-connected design workflows on the same canvas.",
    sonaraDecision: "Store motion and visual-system intent as inspectable design tokens and component contracts; do not make cinematic effects separate one-off implementation art.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "component_responsiveness_should_be_container_aware",
    category: "responsive_design",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Shopify",
    sourceUrl: "https://shopify.dev/docs/api/polaris/using-polaris-web-components",
    evidence: "Current Polaris guidance demonstrates mobile-first fallback behavior and container-query responsive component values.",
    sonaraDecision: "Prefer component-level responsive behavior over page-wide breakpoint assumptions so the same work primitive can live safely in drawers, panels, dashboards, and full pages.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "view_transitions_are_progressive_enhancement_not_workflow_state",
    category: "motion",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "MDN",
    sourceUrl: "https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API",
    evidence: "The View Transition API is broadly available on current browsers, while support still varies across older clients and optional subfeatures.",
    sonaraDecision: "Use view transitions to preserve spatial context when supported, but keep navigation, focus, state, and success semantics independent of animation.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "webgpu_requires_progressive_fallback",
    category: "spatial_3d",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "MDN",
    sourceUrl: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
    evidence: "WebGPU offers modern high-performance graphics and compute capabilities but remains limited availability rather than universal baseline support.",
    sonaraDecision: "Any WebGPU-enabled CAD, media, simulation, robotics, data-center, or spatial view requires a useful 2D or compatible fallback and cannot be the only path to complete the task.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "global_and_product_navigation_have_distinct_jobs",
    category: "navigation",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Atlassian Design System",
    sourceUrl: "https://atlassian.design/components/navigation-system/migration-guide",
    evidence: "Atlassian separates global cross-product actions in top navigation from app-specific primary navigation in a side navigation system.",
    sonaraDecision: "Keep SONARA-wide search, notifications, account, product switcher, and create actions global while product modules and records live in product-specific navigation.",
    runtimeAuthority: "none"
  })
]);

const FRONTEND_COMPANY_PATTERN_GROUPS_2026 = Object.freeze([
  Object.freeze({
    key: "platforms_and_design_systems",
    companies: Object.freeze(["Apple", "Google", "Meta", "Airbnb", "Shopify", "Stripe", "Duolingo"]),
    observedPatterns: Object.freeze(["clear information hierarchy", "consistent reusable components", "direct manipulation with visible feedback", "accessible defaults", "search and filters that preserve task context"]),
    sonaraUse: "One shared semantic component and interaction contract with separate original brand skins; keep account, tenant, permissions, and billing behavior consistent.",
    sources: Object.freeze(["https://developer.apple.com/design/human-interface-guidelines/design-principles/", "https://m3.material.io/", "https://shopify.dev/docs/api/polaris", "https://docs.stripe.com/api", "https://news.airbnb.com/designing-the-future-of-airbnb"]),
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "social_community_and_creator_distribution",
    companies: Object.freeze(["TikTok", "Instagram", "Facebook", "WhatsApp", "Reddit", "YouTube", "Spotify", "Suno"]),
    observedPatterns: Object.freeze(["media-first discovery", "creator-owned identity and library", "community context", "clear visibility and audience controls", "publish preview and status"]),
    sonaraUse: "Creator Studio links source projects to channel-specific export and review steps; distribution is an optional governed connector, never a simulated feed or assumed permission.",
    sources: Object.freeze(["https://developers.tiktok.com/doc/content-sharing-guidelines", "https://developer.spotify.com/documentation/design", "https://support.reddithelp.com/hc/en-us/articles/38715789036948-Accessibility-Guides-An-Overview"]),
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "games_interactive_media_and_consoles",
    companies: Object.freeze(["Marvel", "DC", "Rockstar Games", "Epic Games / Fortnite", "Activision / Call of Duty", "Nintendo", "PlayStation", "Xbox", "Sony", "3D and cinematic media companies"]),
    observedPatterns: Object.freeze(["world-building and emotionally legible storytelling", "immediate input feedback", "configurable controls and HUD", "multimodal accessibility", "device-specific navigation"]),
    sonaraUse: "Use cinematic pacing only on public storytelling and original media workbenches. Operational screens retain short transitions, direct task controls, reduced-motion behavior, keyboard/controller parity, and 2D fallbacks.",
    sources: Object.freeze(["https://learn.microsoft.com/en-us/xbox/accessibility/guidelines", "https://www.playstation.com/en-us/accessibility/", "https://en-americas-support.nintendo.com/app/answers/detail/a_id/68395", "https://www.epicgames.com/help/c-34254770/c-33726977/a22698511"]),
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "commerce_food_service_and_retail",
    companies: Object.freeze(["Amazon", "Walmart", "Shopify", "McDonald's", "Wendy's", "Chick-fil-A", "quick-service restaurants"]),
    observedPatterns: Object.freeze(["strong search and category paths", "menu/catalog clarity", "visible availability and total cost", "cart/order continuity", "loyalty and support near the task"]),
    sonaraUse: "Business Builder models order, item, payment, booking, and fulfillment records as explicit server-backed states and gives guests and operators different focused views of the same records.",
    sources: Object.freeze(["https://brandcenter.walmart.com/brand/brand-identity/color", "https://www.mcdonalds.com/us/en-us/mobile-order-and-pay.html", "https://docs.stripe.com/api/idempotent_requests"]),
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "transport_automotive_and_mobility",
    companies: Object.freeze(["Honda", "Ford", "Chevrolet", "Tesla", "SpaceX", "Uber", "Lyft", "public transportation providers"]),
    observedPatterns: Object.freeze(["status and next action in a time-sensitive context", "clear readiness and availability", "reduced cognitive load", "role-appropriate controls", "safety-aware and connected-device boundaries"]),
    sonaraUse: "Business Builder field and dispatch surfaces prioritize next job, exception, route and schedule status, offline/sync state, and role permissions; no live location or vehicle-control claim without an authorized, verified integration.",
    sources: Object.freeze(["https://global.honda/content/dam/site/global-en/newsroom-new/cq_img/news/2024/10/c241009eng/c241009eng.pdf", "https://corporate.ford.com/articles/research-and-innovation/digital-experience/", "https://www.uber.com/us/en/ride/how-it-works/", "https://www.lyft.com/ride-with-lyft"]),
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "streaming_devices_and_connectivity",
    companies: Object.freeze(["Netflix", "Vizio", "TCL", "Spotify", "YouTube", "YouTube Music", "cable and communications companies"]),
    observedPatterns: Object.freeze(["remote-friendly focus states", "large readable controls", "resume and playback context", "captions and language access", "network and device capability awareness"]),
    sonaraUse: "Creator Studio media review and export remain usable on narrow screens and keyboard/remote-like inputs, disclose codec/provider/readiness requirements, and never make 3D or streaming a prerequisite for core work.",
    sources: Object.freeze(["https://about.netflix.com/en/news/introducing-exciting-new-ways-to-find-and-enjoy-your-next-favorite-on-mobile", "https://developer.spotify.com/documentation/design", "https://learn.microsoft.com/en-us/xbox/accessibility/guidelines"]),
    runtimeAuthority: "none"
  })
]);

const FRONTEND_BRAND_KITS_2026 = Object.freeze({
  parent: Object.freeze({
    name: SONARA_BRAND_REGISTRY.parent.name,
    route: "/",
    tone: "confident, human, useful",
    visualDirection: "dark-first editorial canvas, original Prism Wave mark, restrained cyan/teal/amber signals, generous space",
    accentTokens: Object.freeze(["--sonara-accent", "--sonara-accent-2", "--sonara-warm"]),
    pagePurpose: "Explain the parent promise and route visitors to the correct product without blending child product experiences.",
    interactionMode: "public_marketing"
  }),
  platform: Object.freeze({
    name: SONARA_BRAND_REGISTRY.parent.platform,
    route: SONARA_BRAND_REGISTRY.publicRoutes.products,
    tone: "clear, dependable, connected",
    visualDirection: "shared shell, explicit product switching, visible tenant and account context, calm operational hierarchy",
    accentTokens: Object.freeze(["--sonara-accent", "--sonara-accent-2"]),
    pagePurpose: "Connect the three products through one account, shared navigation rules, policy, billing, and portable records.",
    interactionMode: "shared_platform"
  }),
  products: Object.freeze([
    Object.freeze({ key: "business_builder", accentToken: "--sonara-build", tone: "practical, steady, decisive", visualDirection: "warm operational green with neutral surfaces; job/order/appointment states, checklists, timelines, and focused record tables", landingPurpose: "Show the business lifecycle and route to launch readiness.", primaryLoop: "capture customer need → scope work or offer → schedule/dispatch → record payment state → fulfill → reconcile", distinctFrom: "It is an operations workspace, not a consumer storefront or media editor." }),
    Object.freeze({ key: "creator_studio", accentToken: "--sonara-create", tone: "expressive, focused, protective", visualDirection: "original magenta/violet accents on calm neutral surfaces; project library, asset/timeline workspace, evidence rail, versions, and release packaging", landingPurpose: "Show how an idea becomes a rights-aware, organized, export-ready release project.", primaryLoop: "idea → project → source assets → edit/review → rights and metadata → approve → export or publish", distinctFrom: "It is a creator project and media operations workspace, not a streaming service or unrestricted DAW replacement." }),
    Object.freeze({ key: "growth_studio", accentToken: "--sonara-grow", tone: "optimistic, measurable, respectful", visualDirection: "warm amber/coral signal accents on neutral surfaces; audience, consent, campaign draft, preview, delivery result, and experiment views", landingPurpose: "Show the customer-growth loop and provider/setup requirements before activation.", primaryLoop: "audience → consent and eligibility → campaign draft → preview/approval → provider dispatch → outcome review", distinctFrom: "It plans and tracks growth; delivery depends on configured providers and customer approval." })
  ]),
  sharedContracts: Object.freeze(["One identity and account model", "Tenant-scoped server authorization and data access", "Shared billing and entitlement truth", "Stable route and error conventions", "Keyboard, screen-reader, touch, responsive, and reduced-motion behavior", "Preview and explicit approval for sensitive or external writes", "No fake data, false readiness, or fictional provider connections"]),
  sourceUse: "Public product references are research-only. Do not copy logos, trademarks, characters, exact screen compositions, proprietary source, music, illustrations, or trade dress."
});

const FRONTEND_REPOSITORY_REFERENCES = Object.freeze([
  Object.freeze({
    repository: "shadcn-ui/ui",
    license: "MIT",
    role: "component_composition_reference",
    adoption: "research_only",
    reason: "Study open-code composition, command palettes, data tables, sheets, sidebars, charts, forms, and AI-oriented component structure without introducing React into the current Express/static runtime."
  }),
  Object.freeze({
    repository: "radix-ui/primitives",
    license: "MIT",
    role: "accessible_interaction_reference",
    adoption: "research_only",
    reason: "Use accessibility, keyboard, focus, layering, and primitive-composition patterns as references for SONARA-owned components."
  }),
  Object.freeze({
    repository: "microsoft/fluentui",
    license: "MIT",
    role: "enterprise_accessibility_reference",
    adoption: "research_only",
    reason: "Study enterprise hierarchy, dense-workspace behavior, accessibility, localization, and responsive component conventions."
  }),
  Object.freeze({
    repository: "storybookjs/storybook",
    license: "MIT",
    role: "component_evidence_reference",
    adoption: "review_before_install",
    reason: "Candidate future isolated component documentation and visual-state evidence tool if SONARA later introduces a compatible frontend build layer."
  }),
  Object.freeze({
    repository: "microsoft/playwright",
    license: "Apache-2.0",
    role: "browser_regression_reference",
    adoption: "review_before_install",
    reason: "Candidate future browser-level accessibility, responsive-state, keyboard, route, and screenshot regression harness; not installed by this research pass."
  }),
  Object.freeze({
    repository: "dequelabs/axe-core",
    license: "MPL-2.0",
    role: "accessibility_automation_reference",
    adoption: "license_and_tooling_review",
    reason: "Candidate automated accessibility signal to complement manual testing; automated checks must never be treated as complete accessibility proof."
  })
]);


const FRONTEND_REPOSITORY_REFERENCES_PASS2 = Object.freeze([
  Object.freeze({ repository: "adobe/react-spectrum", license: "Apache-2.0", role: "adaptive_accessible_component_reference", adoption: "research_only", reason: "Study adaptive behavior, accessibility contracts, focus management, internationalization, and robust interaction semantics." }),
  Object.freeze({ repository: "TanStack/table", license: "MIT", role: "headless_data_grid_reference", adoption: "research_only", reason: "Study headless sorting, filtering, pagination, column state, and virtualization boundaries for dense operational records." }),
  Object.freeze({ repository: "xyflow/xyflow", license: "MIT", role: "node_graph_workflow_reference", adoption: "research_only", reason: "Study visual workflow, topology, agent graph, integration-map, and infrastructure graph interaction patterns with deterministic non-canvas alternatives." }),
  Object.freeze({ repository: "pmndrs/react-three-fiber", license: "MIT", role: "spatial_rendering_reference", adoption: "research_only", reason: "Study declarative Three.js composition for information-bearing 3D while preserving progressive enhancement and 2D task completion." }),
  Object.freeze({ repository: "ueberdosis/tiptap", license: "MIT", role: "structured_editor_reference", adoption: "research_only", reason: "Study headless rich-text editing, extensions, collaboration boundaries, and structured content workflows for notes, documents, scripts, and publishing." }),
  Object.freeze({ repository: "excalidraw/excalidraw", license: "MIT", role: "diagram_whiteboard_reference", adoption: "research_only", reason: "Study collaborative diagramming, sketch workflows, scene persistence, export, and visual planning without granting diagrams execution authority." }),
  Object.freeze({ repository: "recharts/recharts", license: "MIT", role: "charting_reference", adoption: "research_only", reason: "Study composable analytical chart patterns; every chart still needs readable labels, tabular access, and actual-versus-forecast semantics." }),
  Object.freeze({ repository: "motiondivision/motion", license: "MIT", role: "motion_reference", adoption: "research_only", reason: "Study reusable motion primitives and reduced-motion behavior; task state must never depend on animation." })
]);

const FRONTEND_SURFACE_ARCHETYPES = Object.freeze([
  Object.freeze({
    key: "public_marketing",
    density: "spacious",
    primaryUsers: Object.freeze(["prospect", "customer", "partner"]),
    primaryPattern: "editorial_sections_with_clear_conversion_paths",
    requiredStates: Object.freeze(["default", "loading", "error", "reduced_motion"]),
    rules: Object.freeze(["cinematic_brand_moments_allowed", "content_remains_readable_without_motion", "no_fake_metrics_or_progress", "performance_budget_applies"])
  }),
  Object.freeze({
    key: "business_command_center",
    density: "comfortable",
    primaryUsers: Object.freeze(["owner", "manager"]),
    primaryPattern: "exceptions_tasks_status_and_recent_activity",
    requiredStates: Object.freeze(["default", "loading", "empty", "error", "offline", "permission_limited"]),
    rules: Object.freeze(["show_next_actions_before_vanity_metrics", "support_keyboard_and_touch", "drill_down_not_dashboard_sprawl"])
  }),
  Object.freeze({
    key: "agent_workspace",
    density: "comfortable",
    primaryUsers: Object.freeze(["owner", "operator", "creator"]),
    primaryPattern: "conversation_plus_plan_tools_evidence_and_approval",
    requiredStates: Object.freeze(["idle", "streaming", "tool_running", "approval_required", "blocked", "failed", "complete"]),
    rules: Object.freeze(["never_hide_tool_or_action_state", "sensitive_actions_require_explicit_approval", "show_cost_latency_or_budget_when_material", "preserve_deterministic_manual_path"])
  }),
  Object.freeze({
    key: "rag_evidence_workspace",
    density: "compact",
    primaryUsers: Object.freeze(["operator", "analyst", "admin"]),
    primaryPattern: "answer_source_evidence_and_filters",
    requiredStates: Object.freeze(["retrieving", "partial", "cited", "insufficient_evidence", "failed"]),
    rules: Object.freeze(["source_scope_visible", "citations_open_in_context", "unknown_is_not_success", "tenant_filter_state_visible"])
  }),
  Object.freeze({
    key: "records_and_data_table",
    density: "compact",
    primaryUsers: Object.freeze(["operator", "manager", "admin"]),
    primaryPattern: "table_filter_sort_select_bulk_action_detail",
    requiredStates: Object.freeze(["default", "loading", "empty", "filtered_empty", "error", "partial"]),
    rules: Object.freeze(["sticky_headers_must_not_obscure_focus", "bulk_actions_show_selection_count", "mobile_collapses_to_priority_fields", "exports_reflect_active_filters"])
  }),
  Object.freeze({
    key: "crm_customer_timeline",
    density: "comfortable",
    primaryUsers: Object.freeze(["sales", "service", "owner"]),
    primaryPattern: "identity_summary_timeline_tasks_conversation",
    requiredStates: Object.freeze(["active", "new", "at_risk", "consent_limited", "closed"]),
    rules: Object.freeze(["separate_facts_from_model_summaries", "communication_consent_visible", "timeline_is_chronological_source_of_truth"])
  }),
  Object.freeze({
    key: "pipeline_kanban",
    density: "comfortable",
    primaryUsers: Object.freeze(["sales", "project_manager", "operator"]),
    primaryPattern: "stage_columns_cards_and_detail",
    requiredStates: Object.freeze(["default", "dragging", "keyboard_move", "blocked", "empty_stage"]),
    rules: Object.freeze(["drag_has_single_pointer_and_keyboard_alternative", "stage_transition_can_require_validation", "do_not_encode_status_by_color_only"])
  }),
  Object.freeze({
    key: "calendar_scheduler",
    density: "comfortable",
    primaryUsers: Object.freeze(["customer", "staff", "dispatcher"]),
    primaryPattern: "availability_time_resource_booking",
    requiredStates: Object.freeze(["available", "held", "confirmed", "rescheduled", "cancelled", "conflict"]),
    rules: Object.freeze(["timezone_visible_when_ambiguous", "conflicts_explained", "mobile_uses_agenda_fallback", "calendar_drag_has_form_alternative"])
  }),
  Object.freeze({
    key: "pos_counter",
    density: "high_touch",
    primaryUsers: Object.freeze(["cashier", "server"]),
    primaryPattern: "catalog_cart_payment_and_fulfillment",
    requiredStates: Object.freeze(["open_order", "held", "payment_pending", "paid", "partial_payment", "offline", "syncing", "failed"]),
    rules: Object.freeze(["primary_controls_48px_or_larger", "cart_always_visible_or_one_action_away", "payment_state_never_inferred_from_spinner", "offline_mode_distinguishable"])
  }),
  Object.freeze({
    key: "kiosk_self_service",
    density: "kiosk",
    primaryUsers: Object.freeze(["guest", "customer"]),
    primaryPattern: "large_category_choices_persistent_cart_guided_checkout",
    requiredStates: Object.freeze(["welcome", "browsing", "customizing", "review", "payment", "receipt", "assistance"]),
    rules: Object.freeze(["large_text_and_targets", "persistent_cart", "obvious_back_and_cancel", "no_staff_only_controls", "timeout_preserves_privacy"])
  }),
  Object.freeze({
    key: "restaurant_kitchen_fulfillment",
    density: "glanceable",
    primaryUsers: Object.freeze(["kitchen", "expeditor", "manager"]),
    primaryPattern: "order_queue_elapsed_time_station_and_exception",
    requiredStates: Object.freeze(["new", "accepted", "in_progress", "ready", "held", "voided", "late"]),
    rules: Object.freeze(["status_not_color_only", "large_distance_legibility", "touch_or_bump_bar_safe", "timestamps_use_one_canonical_clock"])
  }),
  Object.freeze({
    key: "field_service_mobile",
    density: "focused",
    primaryUsers: Object.freeze(["technician", "driver", "inspector"]),
    primaryPattern: "today_job_detail_checklist_media_signature_and_sync",
    requiredStates: Object.freeze(["assigned", "en_route", "onsite", "paused", "complete", "offline", "sync_conflict"]),
    rules: Object.freeze(["offline_first_state_is_visible", "one_primary_action_per_step", "camera_gps_and_signature_permissions_are_contextual", "sync_conflicts_are_never_silent"])
  }),
  Object.freeze({
    key: "fleet_map_dispatch",
    density: "compact",
    primaryUsers: Object.freeze(["dispatcher", "fleet_manager"]),
    primaryPattern: "map_list_detail_alerts_and_route_state",
    requiredStates: Object.freeze(["live", "delayed", "stale_location", "alert", "disconnected", "historical"]),
    rules: Object.freeze(["map_has_list_equivalent", "location_freshness_visible", "alerts_are_prioritized", "role_and_entitlement_shape_navigation"])
  }),
  Object.freeze({
    key: "commerce_storefront_checkout",
    density: "focused",
    primaryUsers: Object.freeze(["shopper", "customer"]),
    primaryPattern: "discover_compare_cart_checkout_track",
    requiredStates: Object.freeze(["browsing", "cart", "checkout", "payment_pending", "paid", "failed", "refunded"]),
    rules: Object.freeze(["transparent_costs_before_commit", "guest_path_supported_when_product_allows", "mobile_wallets_are_adapters_not_ui_assumptions", "order_summary_stays_visible"])
  }),
  Object.freeze({
    key: "creator_media_workbench",
    density: "compact",
    primaryUsers: Object.freeze(["creator", "editor", "producer"]),
    primaryPattern: "asset_bin_canvas_or_timeline_inspector_history_export",
    requiredStates: Object.freeze(["draft", "rendering", "render_failed", "review", "approved", "published"]),
    rules: Object.freeze(["media_provenance_visible", "timeline_has_keyboard_operations", "render_progress_real_or_indeterminate", "publish_is_separate_from_generate"])
  }),
  Object.freeze({
    key: "analytics_observability",
    density: "compact",
    primaryUsers: Object.freeze(["owner", "analyst", "engineer"]),
    primaryPattern: "summary_trend_breakdown_exception_evidence",
    requiredStates: Object.freeze(["healthy", "degraded", "partial_data", "stale", "incident"]),
    rules: Object.freeze(["time_range_always_visible", "chart_has_table_or_text_equivalent", "forecast_separated_from_actual", "data_freshness_visible"])
  }),
  Object.freeze({
    key: "spatial_3d_viewer",
    density: "immersive",
    primaryUsers: Object.freeze(["designer", "customer", "technician"]),
    primaryPattern: "viewport_selection_properties_measurement_and_reset",
    requiredStates: Object.freeze(["loading_asset", "interactive", "selection", "measurement", "unsupported_device", "reduced_motion"]),
    rules: Object.freeze(["depth_must_convey_information", "text_remains_planar", "2d_fallback_exists", "camera_motion_is_user_controlled"])
  })
]);


const FRONTEND_VISUAL_PRIMITIVES_PASS2 = Object.freeze([
  Object.freeze({ key: "global_app_shell", purpose: "product_switching_search_notifications_identity_create", density: "adaptive" }),
  Object.freeze({ key: "product_side_navigation", purpose: "module_record_and_workflow_navigation", density: "adaptive" }),
  Object.freeze({ key: "command_palette", purpose: "keyboard_first_search_navigation_and_scoped_actions", density: "compact" }),
  Object.freeze({ key: "work_queue", purpose: "prioritized_tasks_exceptions_and_next_actions", density: "compact" }),
  Object.freeze({ key: "record_list_detail", purpose: "scan_filter_select_and_inspect_business_records", density: "adaptive" }),
  Object.freeze({ key: "agent_tool_card", purpose: "show_tool_input_state_policy_result_error_and_retry", density: "comfortable" }),
  Object.freeze({ key: "approval_drawer", purpose: "preview_sensitive_action_scope_effect_and_confirmation", density: "focused" }),
  Object.freeze({ key: "evidence_rail", purpose: "sources_citations_provenance_freshness_and_confidence", density: "compact" }),
  Object.freeze({ key: "timeline_audit_log", purpose: "chronological_state_change_and_actor_evidence", density: "compact" }),
  Object.freeze({ key: "multi_view_collection", purpose: "table_list_board_calendar_timeline_or_map_over_one_record_model", density: "adaptive" }),
  Object.freeze({ key: "payment_state_panel", purpose: "amount_method_provider_state_canonical_state_and_next_action", density: "focused" }),
  Object.freeze({ key: "notification_center", purpose: "actionable_alerts_delivery_state_preferences_and_history", density: "compact" }),
  Object.freeze({ key: "media_workbench", purpose: "assets_timeline_transcript_versions_render_and_publish_state", density: "dense" }),
  Object.freeze({ key: "spatial_viewport", purpose: "cad_robotics_facility_device_or_scene_inspection_with_2d_fallback", density: "canvas" }),
  Object.freeze({ key: "analytics_stack", purpose: "summary_trend_breakdown_evidence_and_underlying_records", density: "adaptive" })
]);

const FRONTEND_STATE_VOCABULARY = Object.freeze([
  "idle",
  "loading",
  "streaming",
  "partial",
  "empty",
  "error",
  "offline",
  "syncing",
  "blocked",
  "approval_required",
  "complete"
]);

const FRONTEND_IMPLEMENTATION_SEQUENCE = Object.freeze([
  "resolve_design_authority_and_remove_stale_palette_guidance",
  "standardize_surface_archetypes_and_state_vocabulary",
  "adopt_operational_shell_primitives_without_framework_migration",
  "make_agent_rag_tool_and_approval_state_visually_explicit",
  "strengthen_mobile_field_pos_and_kiosk_density_modes",
  "add_map_list_and_drag_non_drag_equivalent_interactions",
  "enforce_real_loading_offline_stale_and_sync_states",
  "measure_core_web_vitals_and_accessibility_on_representative_routes",
  "add_browser_level_visual_keyboard_and_responsive_regression_when_tooling_review_allows",
  "introduce_bounded_compositional_ui_only_after_component_contract_and_policy_gate_exist",
  "promote_3d_ar_or_spatial_views_only_for_information_bearing_domain_tasks"
]);

function assertUnit(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new RangeError(`${field} must be a finite number between 0 and 1`);
  }
  return number;
}

function round(value, digits = 4) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function frontendPriorityScore(input = {}) {
  const taskFrequency = assertUnit(input.taskFrequency, "taskFrequency");
  const operationalCriticality = assertUnit(input.operationalCriticality, "operationalCriticality");
  const platformReuse = assertUnit(input.platformReuse, "platformReuse");
  const mobileImportance = assertUnit(input.mobileImportance, "mobileImportance");
  const revenueOrServiceImpact = assertUnit(input.revenueOrServiceImpact, "revenueOrServiceImpact");
  const implementationRisk = assertUnit(input.implementationRisk, "implementationRisk");
  const interactionRisk = assertUnit(input.interactionRisk, "interactionRisk");

  const raw =
    taskFrequency * 0.24 +
    operationalCriticality * 0.22 +
    platformReuse * 0.20 +
    mobileImportance * 0.18 +
    revenueOrServiceImpact * 0.16 -
    implementationRisk * 0.10 -
    interactionRisk * 0.10;

  return round(Math.max(0, Math.min(1, raw)));
}

function getFrontendSurface(key) {
  const found = FRONTEND_SURFACE_ARCHETYPES.find((item) => item.key === key);
  return found ? {
    ...found,
    primaryUsers: [...found.primaryUsers],
    requiredStates: [...found.requiredStates],
    rules: [...found.rules]
  } : null;
}


function assertNonNegativeInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new RangeError(`${field} must be a non-negative integer`);
  }
  return number;
}

function assertPositiveFinite(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new RangeError(`${field} must be a positive finite number`);
  }
  return number;
}

function frontendInteractionPresentation(input = {}) {
  const risk = assertUnit(input.risk ?? 0, "risk");
  const externalWrite = Boolean(input.externalWrite);
  const destructive = Boolean(input.destructive);
  const moneyMovement = Boolean(input.moneyMovement);
  const authorityChange = Boolean(input.authorityChange);
  const reversible = input.reversible !== false;

  if (destructive || moneyMovement || authorityChange) {
    return Object.freeze({ mode: "explicit_human_approval", previewRequired: true, auditRequired: true, undoExpected: false });
  }
  if (externalWrite || !reversible || risk >= 0.65) {
    return Object.freeze({ mode: "confirm_before_execute", previewRequired: true, auditRequired: true, undoExpected: reversible });
  }
  if (risk >= 0.3) {
    return Object.freeze({ mode: "preview_then_apply", previewRequired: true, auditRequired: false, undoExpected: reversible });
  }
  return Object.freeze({ mode: "direct_reversible_action", previewRequired: false, auditRequired: false, undoExpected: true });
}

function operationalCollectionPolicy(input = {}) {
  const rowCount = assertNonNegativeInteger(input.rowCount ?? 0, "rowCount");
  const columnCount = assertNonNegativeInteger(input.columnCount ?? 0, "columnCount");
  const containerWidthPx = assertPositiveFinite(input.containerWidthPx, "containerWidthPx");
  const layout = containerWidthPx < 720 ? "priority_list" : "table";
  const dataStrategy = rowCount > 5000 ? "server_paginated" : rowCount > 500 ? "virtualized" : "eager";
  const detailStrategy = columnCount > (layout === "table" ? 12 : 5) ? "progressive_disclosure" : "inline";
  return Object.freeze({ layout, dataStrategy, detailStrategy });
}

function spatialPresentationPolicy(input = {}) {
  const informationBearing = Boolean(input.informationBearing);
  const webGpuAvailable = Boolean(input.webGpuAvailable);
  const reducedMotion = Boolean(input.reducedMotion);
  const compactDevice = Boolean(input.compactDevice);

  if (!informationBearing) return Object.freeze({ mode: "avoid_decorative_3d", fallbackRequired: true });
  if (compactDevice) return Object.freeze({ mode: "two_dimensional_primary_spatial_on_demand", fallbackRequired: true });
  if (reducedMotion) return Object.freeze({ mode: "static_or_user_controlled_spatial", fallbackRequired: true });
  if (!webGpuAvailable) return Object.freeze({ mode: "compatible_graphics_or_2d_fallback", fallbackRequired: true });
  return Object.freeze({ mode: "progressive_information_bearing_3d", fallbackRequired: true });
}

function getFrontendVisualIntelligence() {
  return {
    ok: true,
    version: FRONTEND_VISUAL_VERSION,
    snapshotDate: FRONTEND_VISUAL_SNAPSHOT_DATE,
    researchOnly: true,
    productionExecutionCount: 0,
    marketSignalCount: FRONTEND_MARKET_SIGNALS_2026.length + FRONTEND_MARKET_SIGNALS_PASS2_2026.length,
    companyPatternGroupCount: FRONTEND_COMPANY_PATTERN_GROUPS_2026.length,
    brandKitCount: 2 + FRONTEND_BRAND_KITS_2026.products.length,
    repositoryReferenceCount: FRONTEND_REPOSITORY_REFERENCES.length + FRONTEND_REPOSITORY_REFERENCES_PASS2.length,
    surfaceArchetypeCount: FRONTEND_SURFACE_ARCHETYPES.length,
    visualPrimitiveCount: FRONTEND_VISUAL_PRIMITIVES_PASS2.length,
    marketSignals: [...FRONTEND_MARKET_SIGNALS_2026, ...FRONTEND_MARKET_SIGNALS_PASS2_2026].map((item) => ({ ...item })),
    companyPatternGroups: FRONTEND_COMPANY_PATTERN_GROUPS_2026.map((item) => ({ ...item, companies: [...item.companies], observedPatterns: [...item.observedPatterns], sources: [...item.sources] })),
    brandKits: {
      parent: { ...FRONTEND_BRAND_KITS_2026.parent, accentTokens: [...FRONTEND_BRAND_KITS_2026.parent.accentTokens] },
      platform: { ...FRONTEND_BRAND_KITS_2026.platform, accentTokens: [...FRONTEND_BRAND_KITS_2026.platform.accentTokens] },
      products: FRONTEND_BRAND_KITS_2026.products.map((item) => {
        const product = getBrandProduct(item.key);
        return product ? {
          ...item,
          name: product.name,
          route: product.route,
          dashboardRoute: product.dashboardRoute,
          primaryRoute: product.primaryRoute,
          logo: product.logo,
          horizontalLogo: product.horizontalLogo
        } : { ...item, registryStatus: "missing" };
      }),
      sharedContracts: [...FRONTEND_BRAND_KITS_2026.sharedContracts],
      sourceUse: FRONTEND_BRAND_KITS_2026.sourceUse
    },
    repositoryReferences: [...FRONTEND_REPOSITORY_REFERENCES, ...FRONTEND_REPOSITORY_REFERENCES_PASS2].map((item) => ({ ...item })),
    visualPrimitives: FRONTEND_VISUAL_PRIMITIVES_PASS2.map((item) => ({ ...item })),
    surfaceArchetypes: FRONTEND_SURFACE_ARCHETYPES.map((item) => ({
      ...item,
      primaryUsers: [...item.primaryUsers],
      requiredStates: [...item.requiredStates],
      rules: [...item.rules]
    })),
    stateVocabulary: [...FRONTEND_STATE_VOCABULARY],
    implementationSequence: [...FRONTEND_IMPLEMENTATION_SEQUENCE],
    formulas: {
      frontendPriorityScore: "0.24*task_frequency + 0.22*operational_criticality + 0.20*platform_reuse + 0.18*mobile_importance + 0.16*revenue_or_service_impact - 0.10*implementation_risk - 0.10*interaction_risk",
      coreWebVitalsTargets: Object.freeze({ lcpSeconds: 2.5, inpMilliseconds: 200, cls: 0.1 }),
      sonaraDefaultTapTargetCssPx: 44,
      operationalCollectionPolicy: "layout_by_container_width + data_strategy_by_row_count + progressive_disclosure_by_column_count",
      frontendInteractionPresentation: "risk + reversibility + external_write + destructive_or_money_or_authority flags",
      spatialPresentationPolicy: "information_bearing + device + reduced_motion + webgpu_availability"
    },
    guardrails: [
      "Research and repository references grant no runtime or dependency authority.",
      "Public and startup presentation may be cinematic; work surfaces remain calm and operational.",
      "Generated UI may select only application-owned semantic components after deterministic validation; arbitrary model-authored HTML, JavaScript, event handlers, or privileged URLs are not accepted.",
      "Agent actions, payments, publishing, refunds, security changes, destructive operations, and other sensitive mutations retain existing owner-approval and server-side authority rules.",
      "Accessibility automation complements but never replaces keyboard, screen-reader, zoom, touch, low-motion, and human usability review.",
      "External design systems are pattern references unless a separate architecture and license review explicitly approves adoption."
    ]
  };
}

module.exports = {
  FRONTEND_VISUAL_SNAPSHOT_DATE,
  FRONTEND_VISUAL_VERSION,
  FRONTEND_MARKET_SIGNALS_2026,
  FRONTEND_MARKET_SIGNALS_PASS2_2026,
  FRONTEND_COMPANY_PATTERN_GROUPS_2026,
  FRONTEND_BRAND_KITS_2026,
  FRONTEND_REPOSITORY_REFERENCES,
  FRONTEND_REPOSITORY_REFERENCES_PASS2,
  FRONTEND_VISUAL_PRIMITIVES_PASS2,
  FRONTEND_SURFACE_ARCHETYPES,
  FRONTEND_STATE_VOCABULARY,
  FRONTEND_IMPLEMENTATION_SEQUENCE,
  frontendPriorityScore,
  frontendInteractionPresentation,
  operationalCollectionPolicy,
  spatialPresentationPolicy,
  getFrontendSurface,
  getFrontendVisualIntelligence
};
