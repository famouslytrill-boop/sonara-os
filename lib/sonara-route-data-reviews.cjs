// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Routes whose handler reads and writes no table, each with the reason.
//
// scripts/generate-capability-inventory.cjs traces every route's handler to
// the tables, SQL functions and provider endpoints it reaches. What is left
// after the trace is a review list, and on 6 October 2026 that list was 58
// routes long once twelve tracer defects were fixed (300 before them). These
// are those 58, read one at a time.
//
// The trace finding nothing is not the evidence here -- the trace finding
// nothing is what a blind spot looks like too. Three routes that looked like
// this on the way down turned out to read or write data the trace could not
// yet follow: /login/verify and the creator project API through store objects,
// /api/integrations/providers through a Map entry. So each entry is held three
// ways:
//
//   1. The generator refuses an entry whose route is not registered, whose
//      trace now finds a table, a SQL function, a provider endpoint or any
//      outbound request, whose trace was cut short, or that names a route the
//      generator would not have listed for review anyway. A reason cannot
//      outlive what it describes, and the list cannot grow into a place to
//      put routes nobody looked at.
//   2. tests/a-route-that-reads-nothing-reads-nothing.test.js calls each
//      route's own handler with every outbound request recorded, and fails on
//      the first one. `probe` is the request that test sends, so a computation
//      is checked on the path that succeeds rather than only on the refusal.
//   3. The kind says what the route does instead, in the words a reviewer
//      would check it against.
//
// What none of this claims: that the route's access gate reads nothing. A
// gate in front of a handler (`requireWorkspaceAccess`, `requireCustomer`)
// reads memberships and entitlements, and the inventory credits those to the
// route where it can trace them. The claim is about the handler.

const KINDS = Object.freeze({
  redirect: "Answers with a redirect and reads nothing. The page it sends you to holds the data contract.",
  in_repository_catalog: "Returns a catalogue held in this repository, not account data. Nothing is read from or written to the database.",
  rendered_page: "Renders text and forms held in this repository. The forms post to other routes, which hold the data contract.",
  computation: "Computes its answer from the request and returns it. Nothing is read or saved.",
  configuration_status: "Reports whether services are configured, from the server environment. No table is read.",
  session_cookie: "Changes a cookie in the browser and nothing else. No table is read or written.",
  method_not_allowed: "Answers 405 so callers use POST. Nothing is read."
});

const review = (route, kind, detail, probe = null) => Object.freeze({
  route,
  kind,
  reason: `${KINDS[kind]} ${detail}`.trim(),
  probe: probe ? Object.freeze(probe) : null
});

const ROUTE_DATA_REVIEWS = Object.freeze([
  // Server-side status and method answers.
  review("GET /api/billing/status", "configuration_status", "Checkout and Stripe readiness come from getReadiness(); the paid status is reported as not verified here."),
  review("GET /api/support/status", "configuration_status", "Says whether the support queue and email delivery are configured; it does not count or read requests."),
  review("GET /api/checkout/session", "method_not_allowed", "POST /api/checkout/session is the route that creates a Stripe Checkout Session.", { status: 405 }),

  // Catalogues served from in-repository registries.
  review("GET /api/creator/generation/providers", "in_repository_catalog", "getCreatorGenerationCatalog() from lib/creator-generation-provider-registry.cjs."),
  review("GET /api/creator/studio/capabilities", "in_repository_catalog", "The Creator Studio platform decision and capability list."),
  review("GET /api/creator/workflows/templates", "in_repository_catalog", "Media workflow and automation templates, with the safeguards they carry."),
  review("GET /api/ecosystem/ai-integrations", "in_repository_catalog", "getPublicAIIntegrationCatalog()."),
  review("GET /api/ecosystem/huggingface", "in_repository_catalog", "getPublicHuggingFaceCatalog(); no call is made to Hugging Face."),
  review("GET /api/ecosystem/platform-patterns", "in_repository_catalog", "The recorded platform-pattern convergence."),
  review("GET /api/ecosystem/requested-repositories", "in_repository_catalog", "The combined repository research catalogue and its unverified leads."),
  review("GET /api/free-launch-stack", "in_repository_catalog", "The free launch stack research directory."),
  review("GET /api/growth/providers", "in_repository_catalog", "getGrowthProviderCatalog(); no provider is contacted."),
  review("GET /api/product-lifecycle/framework", "in_repository_catalog", "The lifecycle stages and gate controls. The initiative routes beside it hold the lifecycle tables."),
  review("GET /api/prompt-library/discovery", "in_repository_catalog", "Prompt library discovery metadata from getPromptLibrarySummary()."),
  review("GET /api/routes/public", "in_repository_catalog", "The public entries of the route registry in lib/sonara-route-registry.cjs."),

  // Redirects.
  review("GET /business-builder/businesses", "redirect", "To /business-builder/control-center.", { location: "/business-builder/control-center" }),
  review("GET /business-builder/inventory", "redirect", "To /business-builder/owner/inventory, which lists inventory_items.", { location: "/business-builder/owner/inventory" }),
  review("GET /business-builder/locations", "redirect", "To /business-builder/owner/locations.", { location: "/business-builder/owner/locations" }),
  review("GET /business-builder/vendors", "redirect", "To /business-builder/owner/vendors.", { location: "/business-builder/owner/vendors" }),
  review("GET /business-builder/tutorial", "redirect", "To /tutorials/business-builder.", { location: "/tutorials/business-builder" }),
  review("GET /creator-studio/tutorial", "redirect", "To /tutorials/creator-studio.", { location: "/tutorials/creator-studio" }),
  review("GET /growth-studio/tutorial", "redirect", "To /tutorials/growth-studio.", { location: "/tutorials/growth-studio" }),
  review("GET /creator-studio/generation/audio", "redirect", "To the generation studio with the sound-effects capability chosen.", { locationStartsWith: "/creator-studio/generation?capability=sound_effects" }),
  review("GET /creator-studio/generation/music", "redirect", "To the generation studio with the music capability chosen.", { locationStartsWith: "/creator-studio/generation?capability=text_to_music" }),
  review("GET /creator-studio/generation/reference-analysis", "redirect", "To the generation studio with reference analysis chosen.", { locationStartsWith: "/creator-studio/generation?capability=reference_analysis" }),
  review("GET /creator-studio/generation/video", "redirect", "To the generation studio with the video capability chosen.", { locationStartsWith: "/creator-studio/generation?capability=text_to_video" }),
  review("GET /creator-studio/generation/voice", "redirect", "To the generation studio with the voice capability chosen.", { locationStartsWith: "/creator-studio/generation?capability=text_to_speech" }),

  // Pages that render forms and directions.
  review("GET /login", "rendered_page", "The sign-in form posts to /auth/login, which signs in through Supabase Auth."),
  review("GET /signup", "rendered_page", "The form posts to /auth/signup, which creates the account through Supabase Auth."),
  review("GET /forgot-password", "rendered_page", "The form posts to /auth/forgot-password, which asks Supabase Auth to send the link."),
  review("GET /reset-password", "rendered_page", "The form posts to /auth/reset-password, which sets the password through Supabase Auth."),
  review("GET /business-builder/login", "rendered_page", "The email form posts to /auth/login and the Google link goes to /auth/google, which hold the sign-in itself."),
  review("GET /business-builder/invite/accept", "rendered_page", "The invite acceptance form posts to POST /business-builder/invite/accept, which reads business_employee_invites."),
  review("GET /business-builder/start", "rendered_page", "A getting-started checklist and links."),
  review("GET /creator-studio/start", "rendered_page", "A getting-started checklist and links."),
  review("GET /growth-studio/start", "rendered_page", "A getting-started checklist and links."),
  review("GET /business-builder/support", "rendered_page", "The support form posts to /support/request, which writes support_requests."),
  review("GET /creator-studio/support", "rendered_page", "The support form posts to /support/request, which writes support_requests."),
  review("GET /growth-studio/support", "rendered_page", "The support form posts to /support/request, which writes support_requests."),
  review("GET /business-builder/tools", "rendered_page", "The tool directory, from the product page definitions and the open-source register file."),
  review("GET /creator-studio/tools", "rendered_page", "The tool directory, from the product page definitions and the open-source register file."),
  review("GET /growth-studio/tools", "rendered_page", "The tool directory, from the product page definitions and the open-source register file."),
  review("GET /creator-studio/content", "rendered_page", "Links to the content tools and projects; each of those holds its own data."),
  review("GET /growth-studio/content", "rendered_page", "Links to the content tools; the paid content plan page holds its own data."),
  review("GET /creator-studio/music-system", "rendered_page", "The music system overview and its workflow templates."),
  review("GET /creator-studio/music-system/new", "rendered_page", "What a music system needs, before anything is saved."),
  review("GET /creator-studio/music-system/prompts", "rendered_page", "The instruction-pack safety rules."),
  review("GET /creator-studio/music-system/song", "rendered_page", "The fields a song blueprint requires."),
  review("GET /creator-studio/studio", "rendered_page", "The studio capability map, grouped by domain."),

  // Computations.
  review("POST /api/creator/automations/validate", "computation", "validateWorkflow() checks the steps and autonomy and returns the verdict.", {
    body: { name: "Low stock task", trigger: "inventory_low", autonomy: "safe_automatic", steps: [{ action: "create_task" }, { action: "notify_owner" }] },
    status: 200
  }),
  review("POST /api/creator/workflows/plan", "computation", "planMediaWorkflow() returns a plan and generation intents; no job is created.", {
    body: { name: "Social video pack", medium: "video", steps: ["transcode_video", "caption_video", "generate_thumbnails", "social_export_plan"] },
    status: 200
  }),
  review("POST /api/creator/media/score.wav", "computation", "Renders a WAV file from the notes given and sends it.", { body: { notes: "C4 E4 G4 - C5", bpm: 120 }, status: 200 }),
  review("POST /api/creator/media/captions.vtt", "computation", "Renders a WebVTT file from the text given and sends it.", { body: { text: "First line", durationSeconds: 3 }, status: 200 }),
  review("POST /api/prompt-library/render", "computation", "Fills a prompt template from the values given; no provider is called and no run is recorded.", {
    body: {
      slug: "offer-angle-experiment",
      values: { offer_name: "Tune-up", audience: "Cyclists", customer_problem: "Squeaky brakes", verified_proof: "None yet", price_commitment: "$40", channel: "Email", measurement_window: "Two weeks" }
    },
    status: 200
  }),
  review("POST /prompt-library/:slug/render", "computation", "The same render as a page; the page says no provider was called and nothing was saved.", {
    params: { slug: "offer-angle-experiment" },
    body: { offer_name: "Tune-up", audience: "Cyclists", customer_problem: "Squeaky brakes", verified_proof: "None yet", price_commitment: "$40", channel: "Email", measurement_window: "Two weeks" },
    status: 200
  }),

  // Cookies.
  review("POST /logout", "session_cookie", "Clears the session cookie and sends a browser to /login."),
  review("POST /auth/logout", "session_cookie", "Clears the session cookie and answers in JSON."),
  review("POST /business-builder/owner/security/lock", "session_cookie", "Clears the management unlock cookie and returns to the security page.")
]);

module.exports = { KINDS, ROUTE_DATA_REVIEWS };
