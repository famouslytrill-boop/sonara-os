# Frontend + Visual Operations Intelligence — 2026-09-20

## Purpose

This is the frontend-focused companion to SONARA's broader 2026 market and technology intelligence.

It translates current public evidence from high-traffic websites, leading app-store categories, platform design guidance, commerce/POS/fleet products, enterprise design systems, accessibility standards, web-performance guidance, and open-source UI/testing projects into **SONARA-owned frontend architecture**.

This is research and product-design input. It does **not** install a framework, enable a provider, widen agent authority, activate payments, create a biometric datastore, execute a model, or claim another company's scale.

## Executive decision

SONARA should not become one giant dashboard.

The stronger product architecture is:

1. one recognizable shell;
2. one canonical design-token system;
3. reusable semantic components and state vocabulary;
4. multiple task-specific surface archetypes;
5. adaptive layouts by device and work mode;
6. deterministic records/workflows beneath agent assistance;
7. explicit evidence, approval, offline, stale, failure, and synchronization states;
8. cinematic depth only where it improves presentation or information comprehension.

The frontend is a **control plane for human work**, not decoration around backend capability.

---

## Current market signals

### Global web attention

Similarweb's August 2026 worldwide traffic ranking places Google, YouTube, Facebook, Instagram, and ChatGPT among the five most-visited sites.

Source: https://www.similarweb.com/blog/research/market-research/most-visited-websites/

Frontend implication:

- search remains a primary interaction;
- video/media remains a primary content mode;
- social/distribution remains a primary discovery mode;
- conversational AI is now a mainstream entry point;
- SONARA should support these as connected modes, not force all four into the same screen.

### Current mobile application patterns

The September 2026 US Android chart is led by browser, messaging, search, and social applications, while the top-grossing list includes storage, social/video, AI, commerce, games, streaming, and music.

Source: https://www.similarweb.com/top-apps/google/

The current US iPhone Productivity chart includes several AI assistants next to Gmail, Drive, Docs, Outlook, authentication, spreadsheets, calendar, and office tools.

Source: https://apps.apple.com/us/iphone/charts/6007?chart=top-free

The current US iPhone Business chart includes jobs, professional networks, delivery-driver work, meetings, WhatsApp Business, shipping, HR, documents, POS, identity, Slack, and business publishing.

Source: https://apps.apple.com/us/iphone/charts/6000?chart=top-free

The current US Photo & Video chart includes editing, Instagram, YouTube, Snapchat, photo storage, Canva, creator publishing, live streaming, AI media, Lightroom, and creator studios.

Source: https://apps.apple.com/us/iphone/charts/6008?chart=top-free

Market interpretation:

- the strongest applications are **task networks**, not home-screen KPI collections;
- communication, identity, files, payments, search, and notification are horizontal primitives;
- AI is becoming an entry point, but deterministic records and specialist workflows remain essential;
- creator products increasingly combine asset creation, publishing, collaboration, storage, analytics, and monetization;
- field/business apps optimize for fast continuation of work rather than decorative discovery.

---

## Cross-industry frontend archetype matrix

| Domain | Primary frontend work | SONARA surface model |
| --- | --- | --- |
| Agentic AI / LLM / RAG | ask, plan, retrieve, cite, call tools, approve, inspect | conversation + plan + tool/evidence rail + approval state |
| Small business management | customers, jobs, money, schedule, staff, exceptions | command center + task queue + record detail |
| Enterprise management | role-scoped modules, dense records, audit, approvals | rail navigation + tables + list/detail + audit drawer |
| POS | product selection, cart, tender, receipt, fulfillment | high-touch catalog + persistent order + explicit payment state |
| Kiosk | browse, customize, cart, checkout, receipt, assistance | large-touch guided flow with no staff complexity |
| Restaurant | guest order, POS, handheld, kitchen, pickup, manager | one canonical order visualized by role |
| Retail / ecommerce | discover, compare, cart, checkout, track, return | storefront + fast checkout + order timeline |
| Trucking / fleet / delivery | map, status, route, exceptions, forms, alerts | map/list/detail + freshness + dispatch queue |
| HVAC / electrical / plumbing / carpentry / cleaning | schedule, job, checklist, photos, parts, signature, invoice | offline-first field task surface |
| Project management | tasks, stages, dependencies, documents, decisions | list/kanban/timeline/detail with non-drag alternatives |
| Waste / utilities / field infrastructure | routes, assets, inspections, incidents, work orders | geospatial operations + forms + exception queue |
| Payments / finance / banking | balances, transactions, transfer, approval, dispute | records first; confirmation and irreversible-state clarity |
| Investment / risk / insurance | portfolio, exposure, scenario, evidence, decision | analytical workspace with actual-vs-forecast distinction |
| Customer service | conversation, identity, history, case, knowledge, action | customer timeline + inbox + evidence + controlled tools |
| Scheduling / calendar / time | availability, resource, appointment, conflict | calendar + agenda + form-based alternative |
| HR / jobs | search, profile, applicant, schedule, documents, status | search/list/detail + workflow timeline |
| Social / campaigns / SEO | content, channel, calendar, audience, metrics, moderation | campaign workspace + channel adapters + review gates |
| Video / audio / music / podcasting | assets, timeline, waveform, transcript, render, publish | media workbench + version/history + render state |
| Books / artists / creative IP | projects, assets, metadata, rights, release, sales | project hub + rights/provenance + catalog |
| Streaming | library, playback, live state, chat, moderation, subscription | media-first viewer + minimal overlay controls |
| Manufacturing | work order, station, OEE, quality, maintenance, traceability | plant overview + station detail + exception workflow |
| Robotics / IoT | device state, telemetry, commands, safety boundary | fleet/device topology + real-time status + guarded action |
| CAD / architecture / 3D printing | model, layers, properties, measurements, review | 3D viewport + planar inspector + version state |
| Real estate / rentals | property, availability, applicant, lease, maintenance, payment | property list/map + lifecycle timeline |
| Government / public access | service discovery, eligibility, form, status, notice | plain-language guided task + accessibility-first status |
| Education / classroom / translation | lesson, content, progress, feedback, language | content + progress + assistive controls |
| Security / monitoring | events, risk, identity, response, evidence | prioritized incident queue + timeline + controlled response |
| Gaming | game state, inventory, settings, social, accessibility | controller-safe focus system + consistent navigation |
| AR / spatial | physical scene, 3D object, inspection, instruction | uncluttered viewport + anchored controls + 2D fallback |
| Database / infrastructure / DevOps | service state, logs, deploys, traces, config | topology + timeline + diagnostics + explicit environment |
| Analytics / statistics / forecasting | range, metric, dimension, actual, forecast, confidence | summary → trend → breakdown → evidence |
| Marketplace / buying / selling services | search, profile, offer, booking/order, payment, review | discovery + comparison + transaction lifecycle |

This matrix should drive route and component composition. Industry packs reuse the same primitives instead of inventing unrelated visual systems.

---

## Design principles for SONARA

### 1. Presentation and operations are different surfaces

Current SONARA guidance already says:

- public overview screens: polished, dark-first, readable, marketable;
- work screens: calm, clear, operational.

Keep that boundary.

**Public / cinematic:** stronger depth, controlled texture, immersive media, large typography, reveal motion.

**Operational:** restrained depth, clear panels, tables, timelines, forms, maps, lists, explicit state, persistent context.

Do not apply a cinematic startup aesthetic to payment forms, incident queues, dense tables, kitchen tickets, or field checklists.

### 2. Glass belongs around content, not under every piece of content

Apple's current Liquid Glass direction emphasizes navigation/control layers around content.

Source: https://developer.apple.com/documentation/technologyoverviews/liquid-glass

SONARA rule:

- permitted: header, floating control bar, inspector overlay, compact navigation, modal/sheet shell;
- avoid: data tables, long forms, receipts, invoices, kitchen tickets, evidence text, chart labels, code/log panels.

The goal is depth hierarchy, not maximum translucency.

### 3. Adaptive navigation, not stretched mobile navigation

Android Material guidance recommends changing navigation patterns with window size.

Source: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns

SONARA pattern:

- compact: bottom navigation or short top-level menu when appropriate;
- medium: navigation rail + focused content;
- wide: persistent rail/sidebar + list/detail or multi-pane workspaces;
- kiosk: no general app navigation during transaction flow;
- full-screen creator/spatial: tool rails and inspectors, not business sidebars.

### 4. Accessibility is structural

WCAG 2.2 adds requirements particularly relevant to SONARA's dense interfaces:

- focus must not be hidden by sticky content;
- drag functionality requires a non-drag pointer alternative unless essential;
- pointer targets have a minimum-size rule.

Source: https://www.w3.org/TR/WCAG22/

SONARA keeps its stronger existing default of **44 CSS px** for primary interactive controls and should target 48+ px for kiosk/high-touch modes.

Fluent's current accessibility guidance also emphasizes semantic hierarchy, managed focus, contrast, reflow, zoom, and plain language.

Source: https://fluent2.microsoft.design/accessibility

### 5. Performance is a visual design requirement

Current Core Web Vitals good-experience targets:

- LCP <= 2.5 seconds;
- INP <= 200 ms;
- CLS <= 0.1.

Source: https://web.dev/articles/vitals

This means:

- no heavyweight 3D framework for decorative chrome;
- avoid layout-moving late content;
- keep self-hosted fonts and local assets;
- reserve animation for composite-friendly properties;
- use real or indeterminate progress, never fictional percentages;
- progressively enhance expensive media/spatial tooling.

### 6. Tables, lists, timelines, maps, and media need different density systems

Do not force one card grid onto every data type.

Use:

- table for comparable records;
- list/detail for queues and conversations;
- timeline for chronological truth;
- kanban for stage flow;
- calendar for time/resource allocation;
- map + list for geospatial operations;
- canvas/timeline/inspector for creator work;
- large-choice grid for kiosks;
- command center for exceptions and next actions.

---

## Agentic and generative UI operating model

SAP's 2026 compositional-design direction describes interfaces assembled around intent and context.

Sources:
- https://www.sap.com/design/stories-resources/evolving-design-systems-for-ai-driven-ux
- https://www.sap.com/design-system/compositional-design-system-and-engagement-layer/compositional-design-system/get-started

SONARA should adopt the useful part without surrendering frontend authority.

### Allowed model

1. User states intent.
2. Agent resolves tenant, role, task, data scope, and authority.
3. Agent proposes a **semantic composition**.
4. Deterministic code validates component type, props, data scope, destinations, action authority, and size/depth limits.
5. SONARA renderer mounts approved components.
6. Sensitive actions remain explicit and approval-gated.
7. Render and action evidence is recorded where material.

### Not allowed

- raw model-authored JavaScript;
- raw privileged HTML;
- arbitrary event handlers;
- arbitrary external URLs;
- model-created payment authority;
- hidden destructive mutations;
- generated controls whose meaning/state is not deterministic;
- a model deciding it has permission because it rendered a button.

A useful current public research example is DesignLock, which treats generated UI as untrusted structured data and validates it against closed component contracts before rendering.

Reference: https://github.com/mtb24/design-lock

W3C community discussion in 2026 also identifies generative UI as a growing web interaction layer.

Reference: https://github.com/w3c/webevolve-series/blob/main/2026/01-generative-ui/report-en.md

These are research references only.

---

## Vertical findings

### Restaurant, POS, kiosk

Toast's current Mobile Order & Pay flow connects menu browsing, continuous tabs, POS/handheld additions, kitchen routing, payment, guest communication, and loyalty.

Source: https://support.toasttab.com/en/article/Mobile-Order-and-Pay-Overview

Square's kiosk guidance describes picture-based categories, large type/tap targets, upsell suggestions, and a persistent cart.

Source: https://squareup.com/help/us/en/article/8540-preview-diner-experience-on-square-kiosk

SONARA implementation direction:

- one canonical order state machine;
- separate renderers for guest mobile, kiosk, cashier/server, kitchen, pickup, and manager;
- 48+ px primary high-touch controls;
- persistent cart/order identity;
- clear modifiers;
- explicit payment state;
- offline/sync state;
- kitchen timers and status never rely on color only.

### Fleet, trucking, delivery

Samsara's current dashboard uses role/license-dependent modules for overview, safety, compliance, maintenance, routing, forms, and alerts.

Source: https://kb.samsara.com/hc/en-us/articles/48621492984589-Dashboard-Menus

SONARA direction:

- map + synchronized list + detail;
- location freshness visible;
- dispatch exceptions ranked;
- driver/asset/job state separated;
- route action authority explicit;
- mobile driver surface stays focused and safe;
- alert preferences user-controlled.

### Commerce and checkout

Shopify's current 2026 guidance emphasizes navigation, product hierarchy, mobile UX, speed, transparent costs, guest-friendly checkout, and fewer steps.

Source: https://www.shopify.com/blog/ecommerce-ux

SONARA direction:

- storefront is not the operator dashboard;
- persistent cart/order summary;
- transparent price/tax/fee/shipping information before commit;
- autofill and appropriate input modes;
- wallet/payment methods are adapters;
- refund/cancellation status comes from canonical transaction state.

### Creator, media, streaming, books, artists

Current creator ecosystems combine editing, storage, publishing, social distribution, analytics, collaboration, and AI media.

Canva's Visual Suite is one example of converging docs, data, visual creation, collaboration, and AI-assisted workflows.

Source: https://www.canva.com/visual-suite/

SONARA direction:

- project context at the center;
- asset rail;
- timeline/canvas depending on media type;
- inspector/properties panel;
- version/history;
- rights/provenance;
- real render state;
- separate Generate, Approve, Publish, and Monetize actions;
- media source remains immutable where practical.

### Manufacturing, CAD, robotics, 3D, AR

Spatial guidance recommends using depth to communicate hierarchy and avoiding depth where it reduces legibility.

Sources:
- https://developer.apple.com/design/human-interface-guidelines/spatial-layout/
- https://developer.apple.com/design/human-interface-guidelines/augmented-reality

SONARA direction:

- use 3D when the domain is inherently spatial;
- keep labels, measurements, forms, warnings, and properties planar;
- provide 2D/list fallbacks;
- make camera motion user-controlled;
- keep system/device state and safety commands visually distinct from visualization.

### Gaming

Current Xbox accessibility guidance emphasizes consistent navigation, clear focus, multiple input methods, screen-readable UI context, and motion controls.

Sources:
- https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112
- https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/113
- https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107
- https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117

SONARA gaming/game-system experiments should treat controller focus, remapping, readable context, captions/narration, and motion settings as architecture requirements.

---

## Open-source frontend research

These are **references, not installed dependencies** in this pass.

| Repository | Verified license | SONARA use |
| --- | --- | --- |
| shadcn-ui/ui | MIT | component composition, command/data-table/sidebar/sheet patterns |
| radix-ui/primitives | MIT | accessible primitive behavior, focus and layering |
| microsoft/fluentui | MIT | enterprise accessibility and dense-workspace patterns |
| storybookjs/storybook | MIT | possible future isolated component/state documentation |
| microsoft/playwright | Apache-2.0 | possible future browser/keyboard/responsive regression |
| dequelabs/axe-core | MPL-2.0 | possible future automated accessibility signal |

Current repository sources:
- https://github.com/shadcn-ui/ui
- https://github.com/radix-ui/primitives
- https://github.com/microsoft/fluentui
- https://github.com/storybookjs/storybook
- https://github.com/microsoft/playwright
- https://github.com/dequelabs/axe-core

Adoption rule: reference first; install only after architecture, runtime fit, license, security, bundle, maintenance, and CI review.

SONARA's current Express/static-CSS architecture does not justify a React migration merely to use a popular design library.

---

## Design-system authority

The active production design authority is:

- `public/sonara-design-system.css`
- `public/sonara-application-ui.css`
- canonical sources under `ui/sonara/styles/99-*.css`
- `docs/BRAND_GUIDELINES.md`

The older hardcoded purple palette in `docs/DESIGN_INTELLIGENCE_ENGINE.md` is replaced by a pointer to the live token authority.

Do not create a third global token family.

---

## Frontend state vocabulary

Every substantial interactive surface should explicitly model the states it actually supports.

Baseline vocabulary:

`idle`, `loading`, `streaming`, `partial`, `empty`, `error`, `offline`, `syncing`, `blocked`, `approval_required`, `complete`.

Domain-specific states extend this vocabulary. They do not replace it with ambiguous animation.

Examples:

- payment: `pending`, `authorized`, `captured`, `failed`, `refunded`;
- agent: `planning`, `tool_running`, `approval_required`, `blocked`, `verified`;
- media: `draft`, `rendering`, `review`, `approved`, `published`;
- fleet: `live`, `stale_location`, `disconnected`, `historical`;
- field service: `assigned`, `en_route`, `onsite`, `complete`, `sync_conflict`.

---

## Deterministic prioritization formula

For a candidate frontend surface:

`
score =
  0.24 * task_frequency
+ 0.22 * operational_criticality
+ 0.20 * platform_reuse
+ 0.18 * mobile_importance
+ 0.16 * revenue_or_service_impact
- 0.10 * implementation_risk
- 0.10 * interaction_risk
`

Inputs are normalized to 0..1 and the final score is clamped to 0..1.

This is an internal sequencing heuristic, not a prediction of market success.

Prefer high-frequency, high-consequence, reusable flows before decorative or niche surfaces.

---

## Engineering sequence

1. Resolve design authority and remove stale palette guidance.
2. Standardize surface archetypes and frontend state vocabulary.
3. Add reusable operational shell/layout primitives without a framework migration.
4. Make agent/RAG/tool/approval state explicit.
5. Strengthen mobile, field, POS, kitchen, and kiosk density modes.
6. Ensure map and drag interactions have list/form/non-drag equivalents.
7. Make loading/offline/stale/sync/failure truth visible.
8. Measure Core Web Vitals and accessibility on representative routes.
9. Add browser-level keyboard/responsive/visual regression only after tooling review.
10. Add bounded compositional UI only after a component contract + deterministic policy gate exists.
11. Add spatial/3D surfaces only when they encode domain information.

---

## What this pass intentionally does not do

- no third-party frontend package installation;
- no React/Vue/Svelte migration;
- no copy of competitor trade dress;
- no production generative-UI execution;
- no payment activation;
- no biometric storage;
- no autonomous refund/payout/security mutation;
- no fake customer metrics;
- no unsupported claim that SONARA matches the scale or reliability history of the referenced companies.

The research becomes useful only when it improves SONARA's own deterministic components, states, accessibility, responsive behavior, testing, and customer workflows.


---

## Frontend research pass #2 — current 2026 convergence

This second pass adds the following market and implementation conclusions to the original frontend study.

### AI is now a horizontal product layer

Sensor Tower's 2026 AI research shows AI expanding through shopping, advertising, finance, education, utilities, productivity, media, and other app categories. The product implication is **not** "turn every SONARA screen into chat." The stronger model is contextual AI inside deterministic task surfaces:

- ask or generate where language is the fastest input;
- show records, files, money, identity, schedules, devices, inventory, customers, and orders as inspectable application state;
- expose tools and side effects as visible typed actions;
- require confirmation where the action crosses an external, irreversible, financial, destructive, or authority boundary;
- return the user to the canonical workflow after the assistant has helped.

Sources:
- https://sensortower.com/blog/state-of-ai-2026
- https://sensortower.com/blog/state-of-mobile-2026

### Agent UX is becoming an operations surface

Vercel's current AI SDK direction makes approval, resumability, tool execution state, and durable workflows explicit. SONARA should therefore standardize an agent action vocabulary:

`idle → planning → tool input → policy/approval → running → partial → output → verified/failed → complete`

Sensitive tools need a preview and approval surface that names the tenant, target, scope, expected side effect, reversibility, and audit consequence before execution.

Source: https://vercel.com/blog/ai-sdk-7

### Design systems must serve humans and coding agents

Figma's September 2026 Coinbase case study reports improved design-system adherence and lower agent implementation cost/time when code agents receive component context directly. SONARA should treat its design system as machine-readable engineering infrastructure:

- semantic tokens instead of copied raw values;
- canonical component names and states;
- examples and counterexamples;
- deprecated-pattern rules;
- accessible interaction contracts;
- responsive behavior and density modes;
- generated-code acceptance tests.

Source: https://www.figma.com/blog/how-coinbase-used-code-connect-to-shrink-token-costs/

### Motion and cinematic design become reusable system assets

Figma Config 2026's code layers, motion timeline, shaders, and agent-connected design direction reinforces a useful boundary for SONARA: motion belongs in the design system when it carries continuity, hierarchy, feedback, or brand expression. It does not replace state.

Use View Transitions where supported to maintain spatial continuity, but preserve navigation, focus, errors, completion, and reduced-motion behavior without them.

Sources:
- https://www.figma.com/blog/config-2026-recap/
- https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API

### 3D must earn its cost

WebGPU is powerful but not universally Baseline. SONARA can use 3D for CAD, robotics, facilities, manufacturing, architecture, data-center topology, media scenes, vehicles, digital twins, and spatial training when the third dimension carries information. Every critical workflow still needs a compatible 2D or lower-capability path.

Source: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API

### Reusable primitive set added by this pass

The platform should converge on these shared primitives before building more one-off pages:

1. global app shell;
2. product side navigation;
3. command palette;
4. prioritized work queue;
5. record list/detail;
6. agent tool card;
7. approval drawer;
8. evidence rail;
9. timeline/audit log;
10. multi-view collection over one canonical record model;
11. payment state panel;
12. notification center;
13. media workbench;
14. spatial viewport with 2D fallback;
15. analytics summary → trend → breakdown → evidence stack.

### Open-source reference expansion

The second pass adds research-only references for React Spectrum, TanStack Table, xyflow, React Three Fiber, Tiptap, Excalidraw, Recharts, and Motion. They remain **uninstalled**. Their purpose is to inform interaction contracts and architecture decisions while SONARA keeps its current dependency and release boundary intact.

### Market positioning implication

SONARA's frontend advantage should not be "more screens." It should be **cross-industry continuity**:

- the same customer can flow from lead → quote → schedule → order → payment → fulfillment → support;
- the same work item can appear in table, list, board, calendar, timeline, map, or agent context without becoming separate data;
- AI can propose and explain while deterministic state owns the transaction;
- desktop, mobile, kiosk, POS, field, creator, and administrative experiences share one semantic state system while using different density and input modes.

That creates a coherent operating system for work without pretending one visual surface is optimal for every job.
