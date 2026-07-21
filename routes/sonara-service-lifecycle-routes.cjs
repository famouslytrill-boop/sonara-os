// SONARA Software-in-a-Service lifecycle routes.
// Adds onboarding, service catalog, service requests, deliverables, support,
// free tool workspaces with real POST actions, and admin/operator views.
// Injected helpers come from server.js so auth, layout, and Supabase access
// stay consistent with the rest of the app. No secrets are ever rendered.

const { randomUUID } = require("node:crypto");
const { getOptionalAiGatewayReadiness, AI_GATEWAY_ENV_KEYS } = require("../lib/optional-ai-gateway.cjs");

const PRODUCTS = [
  { slug: "business-builder", productKey: "business_builder", name: "Business Builder" },
  { slug: "creator-studio", productKey: "creator_studio", name: "Creator Studio" },
  { slug: "growth-studio", productKey: "growth_studio", name: "Growth Studio" }
];

const SERVICE_LIFECYCLE_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "needs_customer_info",
  "approved",
  "in_progress",
  "delivered",
  "complete",
  "blocked",
  "setup_required"
];
const SERVICE_REQUEST_STATUSES = SERVICE_LIFECYCLE_STATUSES;
const DELIVERABLE_STATUSES = SERVICE_LIFECYCLE_STATUSES;

const DEFAULT_SERVICE_CATALOG = [
  { slug: "launch-offer-builder", productKey: "business_builder", name: "Launch Offer Builder", summary: "Operator-built launch offer: positioning, package structure, and pricing from your real inputs.", tier: "paid", inputs: "Service type, audience, price idea, proof points", turnaround: "3-5 business days", deliverableType: "Offer document and workspace records", priceNote: "Scoped after intake review." },
  { slug: "customer-intake-setup", productKey: "business_builder", name: "Customer Intake Setup", summary: "Working customer intake path with request records, confirmation email, and review queue.", tier: "paid", inputs: "Business profile, services offered, contact address", turnaround: "3-5 business days", deliverableType: "Configured intake workflow", priceNote: "Requires account database setup." },
  { slug: "payment-readiness-review", productKey: "business_builder", name: "Payment Readiness Review", summary: "Checkout, webhook, and plan configuration reviewed end to end with an action list.", tier: "paid", inputs: "Stripe account state, plan structure", turnaround: "2-3 business days", deliverableType: "Readiness report with fixes", priceNote: "Scoped after intake review." },
  { slug: "creator-offer-builder", productKey: "creator_studio", name: "Creator Offer Builder", summary: "Creator product offer: package, pricing posture, and rights-safe positioning.", tier: "paid", inputs: "Offer type, audience, deliverables, price idea", turnaround: "3-5 business days", deliverableType: "Offer document and catalog records", priceNote: "Scoped after intake review." },
  { slug: "release-readiness-checklist", productKey: "creator_studio", name: "Release Readiness Checklist", summary: "Release-specific checklist with dates, platform specs, and completion tracking.", tier: "free", inputs: "Release title, type, date, platforms", turnaround: "Immediate output; review in 2 days", deliverableType: "Tracked release checklist", priceNote: "Free tool; operator review is paid." },
  { slug: "music-system-blueprint", productKey: "creator_studio", name: "Music System Blueprint", summary: "Song planning blueprint: structure, production notes, prompts, and quality checks.", tier: "free", inputs: "Working title, genre, mood, references", turnaround: "Immediate output; setup in 3 days", deliverableType: "Blueprint plus music-system records", priceNote: "Free tool; system setup is paid." },
  { slug: "campaign-setup", productKey: "growth_studio", name: "Campaign Setup", summary: "Consent-safe campaign configured with plan, angles, follow-up scripts, and tracking sheet.", tier: "paid", inputs: "Goal, audience, offer, channel, timeline, consent posture", turnaround: "3-5 business days", deliverableType: "Campaign package", priceNote: "Scoped after intake review." },
  { slug: "lead-followup-plan", productKey: "growth_studio", name: "Lead Follow-Up Plan", summary: "Three-touch follow-up system with consent rules and lead records.", tier: "paid", inputs: "Lead list state, service, consent status", turnaround: "2-4 business days", deliverableType: "Follow-up scripts and lead records", priceNote: "Requires account database setup." },
  { slug: "consent-safe-outreach-checklist", productKey: "growth_studio", name: "Consent-Safe Outreach Checklist", summary: "Outreach reviewed against consent, sender truthfulness, and opt-out requirements.", tier: "free", inputs: "Audience source, message drafts", turnaround: "Immediate output; review in 2 days", deliverableType: "Reviewed checklist", priceNote: "Free tool; operator review is paid." }
];

function catalogCardBody(item) {
  const parts = [item.summary];
  if (item.inputs) parts.push(`Inputs: ${item.inputs}.`);
  if (item.turnaround) parts.push(`Turnaround: ${item.turnaround}.`);
  if (item.deliverableType) parts.push(`Deliverable: ${item.deliverableType}.`);
  parts.push(`Access: ${item.tier === "free" ? "Free tool" : "Paid service"}. Pricing: ${item.priceNote}`);
  return parts.join(" ");
}

module.exports = function registerServiceLifecycleRoutes(app, deps) {
  const {
    layout,
    brandCard,
    actionCard,
    linkAction,
    responsePage,
    checklistCard,
    escapeHtml,
    requireCustomer,
    requireWorkspaceAccess,
    requireAdmin,
    wantsJson,
    requireFields,
    sendValidationFailure,
    saveModuleOutput,
    getCustomerPrimaryOrganization,
    getSupabaseServerConfig,
    supabaseHeaders,
    insertActivityEvent,
    safeListTable,
    getReadiness,
    readinessCards,
    displayStatus,
    adminActions,
    adminRowsPage,
    normalizeSupportRequest,
    saveSupportRequest,
    logoutAction,
    accessCard,
    recordAdminAuditEvent,
    getProductPageDefinitions,
    legalPages,
    buildBusinessOffer,
    buildCampaignPlan,
    isUuid,
    splitList
  } = deps;

  function productByKey(productKey) {
    return PRODUCTS.find((product) => product.productKey === productKey);
  }

  function renderOutputValue(value) {
    if (Array.isArray(value)) {
      return `<ul>${value.map((item) => `<li>${escapeHtml(String(item))}</li>`).join("")}</ul>`;
    }
    return `<p>${escapeHtml(String(value))}</p>`;
  }

  function toolOutputCard(output) {
    const rows = Object.entries(output || {})
      .map(([key, value]) => `<h3>${escapeHtml(formatFieldLabel(key))}</h3>${renderOutputValue(value)}`)
      .join("");
    return `<article class="card"><h2>Your output</h2>${rows}</article>`;
  }

  function formatFieldLabel(key) {
    return String(key)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/^./, (char) => char.toUpperCase());
  }

  function sendToolResult(req, res, result, tool) {
    if (wantsJson(req)) return res.status(200).json(result);
    const sections = [toolOutputCard(result.output)];
    if (result.saved) {
      sections.push(brandCard("Record saved", `Saved for your organization. Reference ID: ${escapeHtml(String(result.referenceId))}.`));
    } else {
      sections.push(brandCard("Save requires account database setup.", `Your output was generated and is shown above. Saving needs ${escapeHtml(displayStatus(result.service || result.code || "account database"))} to be ready. Reference ID: ${escapeHtml(String(result.referenceId))}.`));
    }
    return res.status(200).type("html").send(
      layout({
        title: tool.title,
        eyebrow: "Free tool result",
        heading: `${tool.title} result`,
        body: result.saved
          ? "Your output was generated and saved as an organization record."
          : "Your output was generated. Save requires account database setup.",
        sections,
        actions: [
          linkAction(tool.path, "Run again"),
          linkAction(`/${tool.slug}/tools`, "All tools"),
          linkAction(`/${tool.slug}/dashboard`, "Product dashboard"),
          linkAction("/dashboard", "Dashboard")
        ]
      })
    );
  }

  function toolFormCard(tool) {
    const fields = tool.fields
      .map((field) => {
        if (field.type === "select") {
          const options = field.options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("");
          return `<label>${escapeHtml(field.label)}<select name="${escapeHtml(field.name)}"${field.required ? " required" : ""}>${options}</select></label>`;
        }
        if (field.type === "textarea") {
          return `<label>${escapeHtml(field.label)}<textarea name="${escapeHtml(field.name)}" rows="${field.rows || 4}"${field.required ? " required" : ""}></textarea></label>`;
        }
        return `<label>${escapeHtml(field.label)}<input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || "text")}"${field.required ? " required" : ""}></label>`;
      })
      .join("");
    return `<article class="card">
    <h2>${escapeHtml(tool.title)}</h2>
    <form method="post" action="${escapeHtml(tool.path)}">
      ${fields}
      <button type="submit">${escapeHtml(tool.submitLabel)}</button>
    </form>
  </article>`;
  }

  function yesNoField(name, label) {
    return {
      name,
      label,
      type: "select",
      required: true,
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "Not yet" }
      ]
    };
  }

  function scoreReadiness(body, checks) {
    const met = checks.filter((check) => String(body[check.name] || "").trim().toLowerCase() === "yes");
    const gaps = checks.filter((check) => !met.includes(check));
    const score = Math.round((met.length / checks.length) * 100);
    return {
      score: `${score} / 100`,
      level: score >= 80 ? "Launch ready" : score >= 50 ? "Getting close" : "Foundation stage",
      confirmed: met.length ? met.map((check) => check.label) : ["None yet"],
      gaps: gaps.length ? gaps.map((check) => `${check.label}: ${check.gapAction}`) : ["No gaps. Review pricing and payment readiness next."],
      nextAction: gaps.length ? gaps[0].gapAction : "Open the service catalog and request launch support when needed."
    };
  }

  function parsePositiveNumber(value) {
    const parsed = Number(String(value || "").replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  const BUSINESS_READINESS_CHECKS = [
    { name: "businessProfile", label: "Business profile is complete", gapAction: "Write the business profile with services, audience, and contact details." },
    { name: "offerReady", label: "Core offer is defined", gapAction: "Use the offer outline tool to draft the core offer." },
    { name: "pricingReady", label: "Pricing is set", gapAction: "Use the pricing calculator to set a defensible price." },
    { name: "paymentReady", label: "Payment collection is configured", gapAction: "Connect payment processing before selling." },
    { name: "supportReady", label: "Support intake is ready", gapAction: "Confirm the support intake path and response expectations." },
    { name: "legalReady", label: "Legal pages are published", gapAction: "Review terms, privacy, and refund policy pages." }
  ];

  const GROWTH_READINESS_CHECKS = [
    { name: "consentReady", label: "Audience consent is documented", gapAction: "Complete the consent checklist before outreach." },
    { name: "audienceReady", label: "Audience source is defined", gapAction: "Document where the audience comes from and how consent was gathered." },
    { name: "offerReady", label: "Offer is validated", gapAction: "Use the offer angle generator to sharpen the offer." },
    { name: "trackingReady", label: "Outcome tracking is in place", gapAction: "Use the KPI calculator and decide which numbers to track." },
    { name: "followupReady", label: "Follow-up script is prepared", gapAction: "Generate a lead follow-up script." },
    { name: "budgetReady", label: "Budget is allocated", gapAction: "Set a campaign budget before launch." }
  ];

  const TOOLS = [
    {
      slug: "business-builder",
      productKey: "business_builder",
      path: "/business-builder/tools/offer",
      title: "Offer Outline Generator",
      module: "offer_builder",
      description: "Draft a launch offer from your service type, audience, price idea, and deliverables.",
      submitLabel: "Generate offer outline",
      fields: [
        { name: "serviceType", label: "Service type", required: true },
        { name: "audience", label: "Audience", required: true },
        { name: "priceIdea", label: "Price idea", required: true },
        { name: "deliverables", label: "Deliverables (comma separated)", type: "textarea", required: true },
        { name: "proofPoints", label: "Proof points (comma separated)", type: "textarea" }
      ],
      requiredFields: ["serviceType", "audience", "priceIdea", "deliverables"],
      build: (body) => buildBusinessOffer(body)
    },
    {
      slug: "business-builder",
      productKey: "business_builder",
      path: "/business-builder/tools/pricing",
      title: "Pricing Calculator",
      module: "pricing_calculator",
      description: "Turn cost, time, and margin inputs into floor, target, and stretch price points.",
      submitLabel: "Calculate pricing",
      fields: [
        { name: "costBasis", label: "Direct cost per delivery (materials, software, fees)", required: true },
        { name: "hoursPerUnit", label: "Hours per delivery", required: true },
        { name: "hourlyRate", label: "Target hourly rate", required: true },
        { name: "targetMargin", label: "Target profit margin percent (for example 30)", required: true }
      ],
      requiredFields: ["costBasis", "hoursPerUnit", "hourlyRate", "targetMargin"],
      validate: (body) => {
        const numbers = ["costBasis", "hoursPerUnit", "hourlyRate", "targetMargin"].map((field) => parsePositiveNumber(body[field]));
        if (numbers.some((value) => value === null)) return { ok: false, code: "validation_failed", message: "Enter numeric values for cost, hours, rate, and margin." };
        return { ok: true };
      },
      build: (body) => {
        const cost = parsePositiveNumber(body.costBasis);
        const hours = parsePositiveNumber(body.hoursPerUnit);
        const rate = parsePositiveNumber(body.hourlyRate);
        const margin = Math.min(parsePositiveNumber(body.targetMargin), 90);
        const baseCost = cost + hours * rate;
        const floor = baseCost;
        const target = margin >= 100 ? baseCost : baseCost / (1 - margin / 100);
        const stretch = target * 1.25;
        const round = (value) => `$${value.toFixed(2)}`;
        return {
          baseCost: `${round(baseCost)} (direct cost plus ${hours} hours at $${rate.toFixed(2)}/hour)`,
          floorPrice: `${round(floor)} - never price below this without a written reason.`,
          targetPrice: `${round(target)} - covers cost with a ${margin}% margin.`,
          stretchPrice: `${round(stretch)} - use with stronger proof, guarantees, or faster delivery.`,
          nextAction: "Validate the target price against three comparable offers before publishing."
        };
      }
    },
    {
      slug: "business-builder",
      productKey: "business_builder",
      path: "/business-builder/tools/readiness",
      title: "Business Readiness Score",
      module: "business_readiness_score",
      description: "Score launch readiness across profile, offer, pricing, payment, support, and legal foundations.",
      submitLabel: "Score readiness",
      fields: BUSINESS_READINESS_CHECKS.map((check) => yesNoField(check.name, check.label)),
      requiredFields: BUSINESS_READINESS_CHECKS.map((check) => check.name),
      build: (body) => scoreReadiness(body, BUSINESS_READINESS_CHECKS)
    },
    {
      slug: "business-builder",
      productKey: "business_builder",
      path: "/business-builder/tools/package",
      title: "Service Package Builder",
      module: "service_package_builder",
      description: "Assemble a simple service package from core services, add-ons, price idea, and turnaround.",
      submitLabel: "Build package",
      fields: [
        { name: "packageName", label: "Package name", required: true },
        { name: "coreServices", label: "Core services (comma separated)", type: "textarea", required: true },
        { name: "addOns", label: "Optional add-ons (comma separated)", type: "textarea" },
        { name: "priceIdea", label: "Price idea", required: true },
        { name: "turnaround", label: "Turnaround time", required: true }
      ],
      requiredFields: ["packageName", "coreServices", "priceIdea", "turnaround"],
      build: (body) => ({
        packageName: String(body.packageName),
        coreServices: splitList(body.coreServices),
        addOns: splitList(body.addOns || ""),
        pricePosition: String(body.priceIdea),
        turnaround: String(body.turnaround),
        buyerNextAction: "Submit an intake request to scope this package for a real customer.",
        caution: "Confirm capacity and refund terms before selling this package."
      })
    },
    {
      slug: "business-builder",
      productKey: "business_builder",
      path: "/business-builder/tools/customer-record",
      title: "Customer Record Starter",
      module: "customer_record_starter",
      description: "Capture a starter customer record with contact details and service interest.",
      submitLabel: "Create customer record",
      fields: [
        { name: "customerName", label: "Customer name", required: true },
        { name: "email", label: "Customer email", type: "email", required: true },
        { name: "serviceInterest", label: "Service interest", required: true },
        { name: "notes", label: "Notes", type: "textarea" }
      ],
      requiredFields: ["customerName", "email", "serviceInterest"],
      build: (body) => ({
        customerName: String(body.customerName),
        email: String(body.email),
        serviceInterest: String(body.serviceInterest),
        notes: String(body.notes || "No notes yet."),
        status: "prospect",
        nextAction: "Follow up within two business days and record the outcome."
      })
    },
    {
      slug: "creator-studio",
      productKey: "creator_studio",
      path: "/creator-studio/tools/profile",
      title: "Creator Profile Outline",
      module: "creator_profile_outline",
      description: "Outline a creator profile from niche, platforms, and content strengths.",
      submitLabel: "Outline profile",
      fields: [
        { name: "creatorName", label: "Creator or project name", required: true },
        { name: "niche", label: "Niche or focus", required: true },
        { name: "platforms", label: "Platforms (comma separated)", required: true },
        { name: "contentTypes", label: "Content types (comma separated)", required: true }
      ],
      requiredFields: ["creatorName", "niche", "platforms", "contentTypes"],
      build: (body) => ({
        creatorName: String(body.creatorName),
        positioning: `${body.creatorName} covers ${body.niche} for audiences on ${splitList(body.platforms).join(", ")}.`,
        platforms: splitList(body.platforms),
        contentTypes: splitList(body.contentTypes),
        monetizationPaths: ["Digital products or templates", "Sponsored placements after audience proof", "Services or commissions", "Memberships once cadence is stable"],
        nextAction: "Pick one platform and one content type for the next 30 days before expanding."
      })
    },
    {
      slug: "creator-studio",
      productKey: "creator_studio",
      path: "/creator-studio/tools/brief",
      title: "Prompt and Brief Builder",
      module: "brief_builder",
      description: "Build a structured creative brief from project type, audience, message, and tone.",
      submitLabel: "Build brief",
      fields: [
        { name: "projectType", label: "Project type", required: true },
        { name: "audience", label: "Audience", required: true },
        { name: "message", label: "Core message", type: "textarea", required: true },
        { name: "tone", label: "Tone", required: true }
      ],
      requiredFields: ["projectType", "audience", "message", "tone"],
      build: (body) => ({
        projectType: String(body.projectType),
        audience: String(body.audience),
        coreMessage: String(body.message),
        tone: String(body.tone),
        briefStructure: [
          `Objective: communicate "${String(body.message).slice(0, 120)}" to ${body.audience}.`,
          `Format: ${body.projectType} in a ${body.tone} tone.`,
          "Constraints: original work only, rights-cleared references, truthful claims.",
          "Deliverable: one draft plus one revision pass.",
          "Review: owner approval before publishing."
        ],
        nextAction: "Attach reference links and deadline, then save this brief with your project records."
      })
    },
    {
      slug: "creator-studio",
      productKey: "creator_studio",
      path: "/creator-studio/tools/release-checklist",
      title: "Release Checklist Builder",
      module: "release_checklist",
      description: "Generate a release checklist for a specific title, type, date, and platform set.",
      submitLabel: "Build release checklist",
      fields: [
        { name: "releaseTitle", label: "Release title", required: true },
        { name: "releaseType", label: "Release type (single, EP, video, product)", required: true },
        { name: "releaseDate", label: "Target release date", required: true },
        { name: "platforms", label: "Platforms (comma separated)", required: true }
      ],
      requiredFields: ["releaseTitle", "releaseType", "releaseDate", "platforms"],
      build: (body) => ({
        releaseTitle: String(body.releaseTitle),
        releaseType: String(body.releaseType),
        targetDate: String(body.releaseDate),
        platforms: splitList(body.platforms),
        checklist: [
          "Confirm ownership and rights for every asset in the release.",
          "Finalize master files and artwork at platform specifications.",
          `Prepare metadata, credits, and descriptions for: ${splitList(body.platforms).join(", ")}.`,
          "Schedule distribution with enough lead time for platform review.",
          "Prepare announcement content for owned channels.",
          "Verify payment and payout details before the release date.",
          "Plan a post-release check on plays, sales, and feedback."
        ],
        nextAction: "Work the checklist top to bottom and record completion dates."
      })
    },
    {
      slug: "creator-studio",
      productKey: "creator_studio",
      path: "/creator-studio/tools/music-blueprint",
      title: "Music System Blueprint",
      module: "music_blueprint",
      description: "Create a song blueprint with structure, production notes, and quality checks.",
      submitLabel: "Create blueprint",
      fields: [
        { name: "workingTitle", label: "Working title", required: true },
        { name: "genre", label: "Genre", required: true },
        { name: "mood", label: "Mood or feel", required: true },
        { name: "referenceNotes", label: "Reference notes (no copied lyrics or melodies)", type: "textarea" }
      ],
      requiredFields: ["workingTitle", "genre", "mood"],
      build: (body) => ({
        workingTitle: String(body.workingTitle),
        genre: String(body.genre),
        mood: String(body.mood),
        structure: ["Intro (4-8 bars)", "Verse 1", "Pre-chorus", "Chorus", "Verse 2", "Chorus", "Bridge", "Final chorus", "Outro"],
        productionNotes: [
          `Anchor the ${body.genre} arrangement around one signature sound.`,
          `Keep the ${body.mood} mood consistent across sections.`,
          "Write original melodies and lyrics only. References are for direction, not copying."
        ],
        qualityChecks: ["Originality check against references", "Mix headroom check", "Lyric clarity pass", "Rights confirmation for any samples or stems"],
        nextAction: "Open the music system pages to plan sections and prompts from this blueprint."
      })
    },
    {
      slug: "creator-studio",
      productKey: "creator_studio",
      path: "/creator-studio/tools/content-plan",
      title: "Basic Content Plan",
      module: "content_plan",
      description: "Plan two weeks of content from your niche, cadence, platforms, and content pillars.",
      submitLabel: "Build content plan",
      fields: [
        { name: "niche", label: "Niche or focus", required: true },
        { name: "cadence", label: "Posts per week", required: true },
        { name: "platforms", label: "Platforms (comma separated)", required: true },
        { name: "pillars", label: "Content pillars (comma separated)", required: true }
      ],
      requiredFields: ["niche", "cadence", "platforms", "pillars"],
      build: (body) => {
        const pillars = splitList(body.pillars);
        const cadence = Math.max(1, Math.min(14, Math.round(parsePositiveNumber(body.cadence) || 3)));
        const slots = [];
        for (let index = 0; index < cadence * 2; index += 1) {
          const pillar = pillars[index % pillars.length] || "Core topic";
          slots.push(`Post ${index + 1}: ${pillar} - one concrete tip, example, or story for ${body.niche}.`);
        }
        return {
          niche: String(body.niche),
          platforms: splitList(body.platforms),
          pillars,
          twoWeekPlan: slots,
          nextAction: "Draft the first three posts now and schedule the rest."
        };
      }
    },
    {
      slug: "growth-studio",
      productKey: "growth_studio",
      path: "/growth-studio/tools/campaign",
      title: "Campaign Outline",
      module: "campaign_workspace",
      description: "Outline a consent-safe campaign from goal, audience, offer, channel, and timeline.",
      submitLabel: "Outline campaign",
      fields: [
        { name: "goal", label: "Goal", required: true },
        { name: "audience", label: "Audience", required: true },
        { name: "offer", label: "Offer", required: true },
        { name: "channel", label: "Channel", required: true },
        { name: "timeline", label: "Timeline", required: true }
      ],
      requiredFields: ["goal", "audience", "offer", "channel", "timeline"],
      build: (body) => buildCampaignPlan(body)
    },
    {
      slug: "growth-studio",
      productKey: "growth_studio",
      path: "/growth-studio/tools/lead-followup",
      title: "Lead Follow-Up Script",
      module: "lead_followup_script",
      description: "Generate a three-step, consent-safe follow-up script for a specific lead.",
      submitLabel: "Generate script",
      fields: [
        { name: "leadName", label: "Lead name", required: true },
        { name: "service", label: "Service or offer discussed", required: true },
        { name: "lastTouch", label: "Last contact (for example: called Tuesday, met at event)", required: true },
        { name: "consentStatus", label: "Consent status", required: true }
      ],
      requiredFields: ["leadName", "service", "lastTouch", "consentStatus"],
      build: (body) => ({
        leadName: String(body.leadName),
        consentStatus: String(body.consentStatus),
        touchOne: `Day 1: "Hi ${body.leadName}, following up after ${body.lastTouch}. Happy to answer any questions about ${body.service}. If now is not the right time, just say so and I will close the loop."`,
        touchTwo: `Day 4: "Hi ${body.leadName}, one useful detail about ${body.service}: share a concrete proof point or example here. Want me to send a short summary?"`,
        touchThree: `Day 10: "Hi ${body.leadName}, last note from me on ${body.service}. If it is not a fit, no problem - I will not follow up again unless you reach out."`,
        consentRules: [
          "Only contact leads whose consent status allows it.",
          "Use truthful sender details and subject lines.",
          "Include an opt-out path in every commercial message.",
          "Stop immediately on any opt-out."
        ],
        nextAction: "Review the consent checklist before sending the first touch."
      })
    },
    {
      slug: "growth-studio",
      productKey: "growth_studio",
      path: "/growth-studio/tools/offer-angles",
      title: "Offer Angle Generator",
      module: "offer_angle_generator",
      description: "Generate five truthful offer angles from your offer, audience, and pain point.",
      submitLabel: "Generate angles",
      fields: [
        { name: "offer", label: "Offer", required: true },
        { name: "audience", label: "Audience", required: true },
        { name: "painPoint", label: "Main pain point it solves", required: true },
        { name: "proof", label: "Strongest proof point", required: true }
      ],
      requiredFields: ["offer", "audience", "painPoint", "proof"],
      build: (body) => ({
        offer: String(body.offer),
        audience: String(body.audience),
        angles: [
          `Problem-first: "Still dealing with ${body.painPoint}? ${body.offer} was built for ${body.audience}."`,
          `Outcome-first: "What changes after ${body.offer}: less ${body.painPoint}, more time on real work."`,
          `Proof-first: "${body.proof} - that is why ${body.audience} choose ${body.offer}."`,
          `Process-first: "How ${body.offer} works, step by step, with no surprises."`,
          `Objection-first: "Not sure ${body.offer} fits? Here is exactly who it is not for."`
        ],
        rules: ["Every claim must be true and provable.", "Do not invent numbers or testimonials.", "Match the angle to where the audience actually is."],
        nextAction: "Pick two angles and test them against each other with the same audience."
      })
    },
    {
      slug: "growth-studio",
      productKey: "growth_studio",
      path: "/growth-studio/tools/kpi",
      title: "Simple KPI Calculator",
      module: "kpi_calculator",
      description: "Calculate conversion rates, revenue per visitor, and acquisition cost from real numbers.",
      submitLabel: "Calculate KPIs",
      fields: [
        { name: "visitors", label: "Visitors or reach", required: true },
        { name: "leads", label: "Leads captured", required: true },
        { name: "customers", label: "Customers won", required: true },
        { name: "revenue", label: "Revenue (total)", required: true },
        { name: "adSpend", label: "Spend (optional)" }
      ],
      requiredFields: ["visitors", "leads", "customers", "revenue"],
      validate: (body) => {
        const numbers = ["visitors", "leads", "customers", "revenue"].map((field) => parsePositiveNumber(body[field]));
        if (numbers.some((value) => value === null)) return { ok: false, code: "validation_failed", message: "Enter numeric values for visitors, leads, customers, and revenue." };
        return { ok: true };
      },
      build: (body) => {
        const visitors = parsePositiveNumber(body.visitors);
        const leads = parsePositiveNumber(body.leads);
        const customers = parsePositiveNumber(body.customers);
        const revenue = parsePositiveNumber(body.revenue);
        const spend = parsePositiveNumber(body.adSpend);
        const percent = (part, whole) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "not calculable (division by zero)");
        const money = (value) => `$${value.toFixed(2)}`;
        const output = {
          visitorToLead: `Visitor to lead: ${percent(leads, visitors)}`,
          leadToCustomer: `Lead to customer: ${percent(customers, leads)}`,
          visitorToCustomer: `Visitor to customer: ${percent(customers, visitors)}`,
          revenuePerVisitor: visitors > 0 ? `Revenue per visitor: ${money(revenue / visitors)}` : "Revenue per visitor: not calculable",
          averageOrderValue: customers > 0 ? `Average revenue per customer: ${money(revenue / customers)}` : "Average revenue per customer: not calculable"
        };
        if (spend !== null && spend > 0) {
          output.acquisitionCost = customers > 0 ? `Cost per customer: ${money(spend / customers)}` : "Cost per customer: not calculable";
          output.returnOnSpend = `Return on spend: ${(revenue / spend).toFixed(2)}x`;
        }
        output.nextAction = "Track these same numbers weekly and compare before changing the campaign.";
        return output;
      }
    },
    {
      slug: "growth-studio",
      productKey: "growth_studio",
      path: "/growth-studio/tools/readiness",
      title: "Growth Readiness Score",
      module: "growth_readiness_score",
      description: "Score growth readiness across consent, audience, offer, tracking, follow-up, and budget.",
      submitLabel: "Score readiness",
      fields: GROWTH_READINESS_CHECKS.map((check) => yesNoField(check.name, check.label)),
      requiredFields: GROWTH_READINESS_CHECKS.map((check) => check.name),
      build: (body) => scoreReadiness(body, GROWTH_READINESS_CHECKS)
    }
  ];

  // ---------------------------------------------------------------------------
  // Free tool pages and POST actions
  // ---------------------------------------------------------------------------

  for (const tool of TOOLS) {
    app.get(tool.path, requireWorkspaceAccess(tool.productKey), (req, res) => {
      res.status(200).type("html").send(
        layout({
          title: tool.title,
          eyebrow: "Free tool",
          heading: tool.title,
          body: `${tool.description} Free tools are available to logged-in users. Saving records depends on account database setup.`,
          sections: [accessCard(req.sonaraAccess), toolFormCard(tool)],
          actions: [
            linkAction(`/${tool.slug}/tools`, "All tools"),
            linkAction(`/${tool.slug}/dashboard`, "Product dashboard"),
            linkAction("/dashboard", "Dashboard"),
            logoutAction()
          ]
        })
      );
    });

    app.post(tool.path, async (req, res) => {
      const validation = requireFields(req.body, tool.requiredFields);
      if (!validation.ok) return sendValidationFailure(req, res, validation, tool.path);
      if (tool.validate) {
        const extra = tool.validate(req.body);
        if (!extra.ok) {
          if (wantsJson(req)) return res.status(400).json(extra);
          return res.status(400).type("html").send(responsePage("Check your inputs", extra.message, [linkAction(tool.path, "Return to tool")]));
        }
      }
      return requireWorkspaceAccess(tool.productKey)(req, res, async () => {
        const output = tool.build(req.body);
        const result = await saveModuleOutput(req, tool.productKey, tool.module, req.body, output);
        return sendToolResult(req, res, result, tool);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Public onboarding, catalog, readiness, and legal index pages
  // ---------------------------------------------------------------------------

  app.get("/start", (req, res) => {
    res.status(200).type("html").send(
      layout({
        title: "Start",
        eyebrow: "Software-in-a-Service",
        heading: "Start with SONARA",
        body: "SONARA is a Software-in-a-Service platform: use the software yourself with free tools, and request done-for-you services when you want operator help.",
        sections: [
          checklistCard("Your path", [
            "Create a free account",
            "Pick a product workspace",
            "Create or attach your organization",
            "Use the free tools",
            "Request services from the catalog",
            "Upgrade when paid records are needed"
          ]),
          actionCard("1. Create your account", "Free accounts unlock the free planning tools in every product workspace.", [linkAction("/signup", "Create account"), linkAction("/login", "Login")]),
          actionCard("2. Pick a product", "Business Builder for service businesses, Creator Studio for creators, Growth Studio for campaigns.", [linkAction("/business-builder/start", "Business Builder"), linkAction("/creator-studio/start", "Creator Studio"), linkAction("/growth-studio/start", "Growth Studio")]),
          actionCard("3. Set up your workspace", "Create or attach an organization so records can be saved when the account database is configured.", [linkAction("/account/setup", "Account setup")]),
          actionCard("4. Request services", "Browse the service catalog and submit a request. Every accepted request gets a reference ID and status tracking.", [linkAction("/service-catalog", "Service catalog"), linkAction("/requests", "My requests")]),
          actionCard("5. Track everything", "Requests, deliverables, billing, and support all have their own tracking pages.", [linkAction("/deliverables", "Deliverables"), linkAction("/support", "Support"), linkAction("/pricing", "Pricing")])
        ],
        actions: [linkAction("/signup", "Start Free"), linkAction("/service-catalog", "Service catalog"), linkAction("/dashboard", "Dashboard")]
      })
    );
  });

  app.get("/service-catalog", async (req, res) => {
    const rows = await safeListTable("service_catalog_items", "?select=id,product_key,name,summary,price_note,status&status=eq.active&order=name.asc&limit=50");
    const usingDatabase = rows.ok && rows.rows.length > 0;
    const items = usingDatabase
      ? rows.rows.map((row) => ({ productKey: row.product_key, name: row.name, summary: row.summary, tier: "paid", priceNote: row.price_note || "Scoped after intake review." }))
      : DEFAULT_SERVICE_CATALOG;
    const sections = items.map((item) => {
      const product = productByKey(item.productKey);
      return actionCard(item.name, catalogCardBody(item), [
        linkAction("/requests", "Request this service"),
        product ? linkAction(`/${product.slug}`, product.name) : linkAction("/start", "Start")
      ]);
    });
    if (!usingDatabase) {
      sections.push(
        rows.ok
          ? brandCard("Catalog records", "No catalog records are published in the account database yet, so the standard catalog is shown.")
          : brandCard("Catalog database status", "Setup required: the service_catalog_items table is not available yet, so the standard catalog is shown. Requests still work and always return a reference ID.")
      );
    }
    res.status(200).type("html").send(
      layout({
        title: "Service catalog",
        eyebrow: "Software-in-a-Service",
        heading: "Service catalog",
        body: "Done-for-you services across Business Builder, Creator Studio, and Growth Studio. Submit a request and track it from your dashboard.",
        sections,
        actions: [linkAction("/requests", "My requests"), linkAction("/start", "How it works"), linkAction("/pricing", "Pricing"), linkAction("/contact", "Contact")]
      })
    );
  });

  app.get("/readiness", (req, res) => {
    res.status(200).type("html").send(
      layout({
        title: "Platform readiness",
        eyebrow: "Live status",
        heading: "Platform readiness",
        body: "Live service setup state without exposing secret values. Missing services stay setup required instead of pretending to work.",
        sections: readinessCards(getReadiness()),
        actions: [linkAction("/api/readiness", "Readiness JSON"), linkAction("/start", "Start"), linkAction("/", "Home")]
      })
    );
  });

  app.get("/legal", (req, res) => {
    res.status(200).type("html").send(
      layout({
        title: "Legal",
        eyebrow: "Legal center",
        heading: "Legal center",
        body: "All SONARA Industries legal drafts in one place. These drafts need qualified legal review and are not legal advice.",
        sections: legalPages().map((page) => actionCard(page.title, "Read the current draft. This draft needs qualified legal review and is not legal advice.", [linkAction(page.href, "Read")])),
        actions: [linkAction("/", "Home"), linkAction("/contact", "Contact")]
      })
    );
  });

  // ---------------------------------------------------------------------------
  // Service requests and deliverables (customer views + POST /service-requests)
  // ---------------------------------------------------------------------------

  function serviceRequestForm() {
    const options = [
      ...PRODUCTS.map((product) => `<option value="${escapeHtml(product.productKey)}">${escapeHtml(product.name)}</option>`),
      `<option value="general">General / not sure</option>`
    ].join("");
    return `<article class="card">
    <h2>New service request</h2>
    <form method="post" action="/service-requests">
      <label>Product area<select name="productKey" required>${options}</select></label>
      <label>Service name<input name="serviceName" type="text" required></label>
      <label>Summary<input name="summary" type="text" minlength="3" required></label>
      <label>Details<textarea name="details" rows="6" minlength="10" required></textarea></label>
      <button type="submit">Submit service request</button>
    </form>
  </article>`;
  }

  const VALID_REQUEST_PRODUCT_KEYS = [...PRODUCTS.map((product) => product.productKey), "general"];

  app.post("/service-requests", requireCustomer, async (req, res) => {
    const validation = requireFields(req.body, ["productKey", "serviceName", "summary", "details"]);
    if (!validation.ok) return sendValidationFailure(req, res, validation, "/requests");
    const productKey = String(req.body.productKey || "").trim();
    if (!VALID_REQUEST_PRODUCT_KEYS.includes(productKey)) {
      const payload = { ok: false, code: "validation_failed", message: "Choose a valid product area." };
      if (wantsJson(req)) return res.status(400).json(payload);
      return res.status(400).type("html").send(responsePage("Check your inputs", payload.message, [linkAction("/requests", "Return to requests")]));
    }

    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization.ok) {
      const payload = {
        ok: false,
        code: "setup_required",
        service: "customer_organization",
        message: "Create or attach an organization before submitting service requests.",
        nextPath: "/account/setup"
      };
      if (wantsJson(req)) return res.status(503).json(payload);
      return res.status(503).type("html").send(responsePage("Workspace setup required", payload.message, [linkAction("/account/setup", "Account setup"), linkAction("/requests", "Requests")]));
    }

    const config = getSupabaseServerConfig();
    if (!config.ok) {
      const referenceId = randomUUID();
      const payload = { ok: true, saved: false, code: "setup_required", service: "supabase", referenceId, message: `Setup required: the account database is not configured. Reference ID: ${referenceId}.` };
      if (wantsJson(req)) return res.status(200).json(payload);
      return res.status(200).type("html").send(responsePage("Setup required", payload.message, [linkAction("/requests", "Requests"), linkAction("/contact", "Contact")]));
    }

    const record = {
      organization_id: organization.organizationId,
      user_id: req.sonaraUser?.id || null,
      product_key: productKey,
      service_name: String(req.body.serviceName).trim().slice(0, 160),
      summary: String(req.body.summary).trim().slice(0, 280),
      details: String(req.body.details).trim().slice(0, 4000),
      status: "submitted"
    };
    const response = await fetch(`${config.url}/rest/v1/service_requests`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "return=representation" }),
      body: JSON.stringify(record)
    }).catch(() => undefined);

    if (!response?.ok) {
      const referenceId = randomUUID();
      const payload = { ok: true, saved: false, code: "setup_required", service: "service_requests", referenceId, message: `Setup required: the service_requests table is not available yet. Reference ID: ${referenceId}.` };
      if (wantsJson(req)) return res.status(200).json(payload);
      return res.status(200).type("html").send(responsePage("Setup required", payload.message, [linkAction("/requests", "Requests"), linkAction("/contact", "Contact")]));
    }

    const rows = await response.json().catch(() => []);
    const requestId = rows[0]?.id || randomUUID();
    await fetch(`${config.url}/rest/v1/service_request_events`, {
      method: "POST",
      headers: supabaseHeaders(config),
      body: JSON.stringify({
        service_request_id: rows[0]?.id || null,
        organization_id: organization.organizationId,
        user_id: req.sonaraUser?.id || null,
        event_type: "submitted",
        notes: record.summary
      })
    }).catch(() => undefined);
    await insertActivityEvent(organization.organizationId, req.sonaraUser?.id, "service_request.submitted", { service_request_id: requestId, product_key: productKey });

    const payload = { ok: true, saved: true, code: "saved", referenceId: requestId, status: "submitted", message: `Service request recorded. Reference ID: ${requestId}.` };
    if (wantsJson(req)) return res.status(200).json(payload);
    return res.status(200).type("html").send(
      responsePage("Service request recorded", payload.message, [linkAction("/requests", "My requests"), linkAction("/deliverables", "Deliverables"), linkAction("/dashboard", "Dashboard")])
    );
  });

  app.get("/requests", requireCustomer, async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    const sections = [];
    if (!organization.ok) {
      sections.push(actionCard("Workspace setup required", "Create or attach an organization to submit and track service requests.", [linkAction("/account/setup", "Account setup")]));
    } else {
      const rows = await safeListTable("service_requests", `?select=id,service_name,product_key,status,created_at&organization_id=eq.${encodeURIComponent(organization.organizationId)}&order=created_at.desc&limit=20`);
      if (!rows.ok) {
        sections.push(brandCard("Setup required", "The service_requests table is not available yet. Submitted requests will use the safe fallback path with a reference ID until the account database is migrated."));
      } else if (!rows.rows.length) {
        sections.push(brandCard("No requests yet", "Submit your first service request below or browse the service catalog."));
      } else {
        sections.push(...rows.rows.map((row) => brandCard(
          `${row.service_name || "Service request"} - ${displayStatus(row.status || "submitted")}`,
          `Product: ${displayStatus(row.product_key || "general")}. Submitted: ${row.created_at || "not returned"}. Reference ID: ${row.id}.`
        )));
      }
    }
    sections.push(serviceRequestForm());
    sections.push(brandCard("Request lifecycle", `Statuses move through: ${SERVICE_REQUEST_STATUSES.map((status) => displayStatus(status)).join(", ")}.`));
    res.status(200).type("html").send(
      layout({
        title: "Service requests",
        eyebrow: "Software-in-a-Service",
        heading: "Service requests",
        body: "Submit and track done-for-you service requests. Every accepted request returns a reference ID.",
        sections,
        actions: [linkAction("/service-catalog", "Service catalog"), linkAction("/deliverables", "Deliverables"), linkAction("/dashboard", "Dashboard"), logoutAction()]
      })
    );
  });

  async function deliverableSections(organization, productKey) {
    if (!organization.ok) {
      return [actionCard("Workspace setup required", "Create or attach an organization to track deliverables.", [linkAction("/account/setup", "Account setup")])];
    }
    const filter = productKey ? `&product_key=eq.${encodeURIComponent(productKey)}` : "";
    const rows = await safeListTable("service_deliverables", `?select=id,title,product_key,status,updated_at&organization_id=eq.${encodeURIComponent(organization.organizationId)}${filter}&order=updated_at.desc&limit=20`);
    if (!rows.ok) {
      return [brandCard("Setup required", "The service_deliverables table is not available yet. Deliverables appear here after the account database is migrated and an operator publishes work.")];
    }
    if (!rows.rows.length) {
      return [brandCard("No deliverables yet", "Deliverables appear here when an operator publishes work for your requests.")];
    }
    return rows.rows.map((row) => brandCard(
      `${row.title || "Deliverable"} - ${displayStatus(row.status || "preparing")}`,
      `Product: ${displayStatus(row.product_key || "general")}. Updated: ${row.updated_at || "not returned"}. Reference ID: ${row.id}.`
    ));
  }

  app.get("/deliverables", requireCustomer, async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    const sections = await deliverableSections(organization);
    sections.push(brandCard("Deliverable lifecycle", `Statuses move through: ${DELIVERABLE_STATUSES.map((status) => displayStatus(status)).join(", ")}.`));
    res.status(200).type("html").send(
      layout({
        title: "Deliverables",
        eyebrow: "Software-in-a-Service",
        heading: "Deliverables",
        body: "Track work delivered against your service requests. Deliverables are real records, never fabricated placeholders.",
        sections,
        actions: [linkAction("/requests", "Service requests"), linkAction("/dashboard", "Dashboard"), logoutAction()]
      })
    );
  });

  // ---------------------------------------------------------------------------
  // Support center
  // ---------------------------------------------------------------------------

  function supportForm(defaultCategory) {
    return `<article class="card">
    <h2>Support request</h2>
    <form method="post" action="/support/request">
      <label>Name<input name="name" type="text" required></label>
      <label>Email<input name="email" type="email" required></label>
      <label>Subject<input name="subject" type="text" required></label>
      <select name="category" required>
        <option value="support"${defaultCategory === "support" ? " selected" : ""}>Support</option>
        <option value="billing">Billing</option>
        <option value="contact">Contact</option>
        <option value="feedback">Feedback</option>
      </select>
      <label>What do you need help with?<textarea name="message" rows="6" required></textarea></label>
      <label class="fine"><input name="consent" type="checkbox" value="yes" required> Consent to process this request</label>
      <button type="submit">Submit support request</button>
    </form>
  </article>`;
  }

  app.get("/support", (req, res) => {
    const readiness = getReadiness();
    res.status(200).type("html").send(
      layout({
        title: "Support",
        eyebrow: "Support center",
        heading: "Support",
        body: "Submit a support request and get a reference ID. Requests are stored in the account database when configured, and always use a safe fallback queue otherwise.",
        sections: [
          supportForm("support"),
          brandCard("Support queue status", readiness.services.supabase === "configured" ? "Support requests are recorded in the account database." : "Setup required: support requests use the safe fallback queue with a reference ID until the account database is configured."),
          actionCard("Other paths", "Billing questions, account access, and general contact all route through the same tracked intake.", [linkAction("/contact", "Contact form"), linkAction("/api/support/status", "Support status JSON")])
        ],
        actions: [linkAction("/", "Home"), linkAction("/dashboard", "Dashboard"), linkAction("/help", "Help")]
      })
    );
  });

  app.post("/support/request", async (req, res) => {
    const request = normalizeSupportRequest(req.body);
    if (!request.ok) {
      const payload = { ok: false, code: "validation_failed", message: request.message };
      if (wantsJson(req)) return res.status(400).json(payload);
      return res.status(400).type("html").send(responsePage("Request not accepted", request.message, [linkAction("/support", "Try again")]));
    }
    const result = await saveSupportRequest(request.value);
    if (wantsJson(req)) return res.status(200).json(result);
    return res.status(200).type("html").send(
      responsePage(result.ok ? "Support request received" : "Support request queued", result.message, [linkAction("/support", "Support"), linkAction("/dashboard", "Dashboard"), linkAction("/", "Home")])
    );
  });

  // ---------------------------------------------------------------------------
  // Product workspace pages: start, tools, catalog, deliverables, support
  // ---------------------------------------------------------------------------

  for (const product of PRODUCTS) {
    const productTools = TOOLS.filter((tool) => tool.slug === product.slug);

    app.get(`/${product.slug}/start`, (req, res) => {
      res.status(200).type("html").send(
        layout({
          title: `${product.name} Start`,
          eyebrow: "Software-in-a-Service",
          heading: `Start with ${product.name}`,
          body: `Use the ${product.name} free tools yourself, then request done-for-you services when you want operator help.`,
          sections: [
            checklistCard("Getting started", [
              "Create a free account",
              "Create or attach your organization",
              "Open the free tools",
              "Save outputs when the account database is ready",
              "Request services from the catalog",
              "Upgrade for paid records and tracking"
            ]),
            actionCard("Free tools", `Start with: ${productTools.map((tool) => tool.title).join(", ")}.`, [linkAction(`/${product.slug}/tools`, "Open tools")]),
            actionCard("Workspace", "Your organization scopes every saved record. Free accounts can create one in account setup.", [linkAction("/account/setup", "Account setup"), linkAction(`/${product.slug}/dashboard`, "Dashboard")]),
            actionCard("Services", "Request done-for-you work with tracked statuses and deliverables.", [linkAction("/service-catalog", "Service catalog"), linkAction("/requests", "My requests")])
          ],
          actions: [linkAction("/signup", "Start Free"), linkAction(`/${product.slug}/tools`, "Free tools"), linkAction(`/${product.slug}`, product.name), linkAction("/pricing", "Pricing")]
        })
      );
    });

    app.get(`/${product.slug}/tools`, (req, res) => {
      const definitions = getProductPageDefinitions(product.slug);
      const existingFree = definitions.free.filter((page) => !page.path.includes("/records/") && page.module !== "help");
      const sections = [
        ...productTools.map((tool) => actionCard(tool.title, tool.description, [linkAction(tool.path, "Open tool")])),
        ...existingFree.map((page) => actionCard(page.title, page.body, [linkAction(page.path, "Open")])),
        actionCard("Paid tools", `Paid ${product.name} tools unlock with a confirmed plan or owner/admin access: ${definitions.paid.map((page) => page.label).join(", ")}.`, [linkAction("/pricing", "View pricing"), linkAction(`/${product.slug}/dashboard`, "Dashboard")])
      ];
      res.status(200).type("html").send(
        layout({
          title: `${product.name} Tools`,
          eyebrow: "Tool directory",
          heading: `${product.name} tools`,
          body: "Free tools are available to logged-in users and render useful output even before the account database is configured.",
          sections,
          actions: [linkAction(`/${product.slug}/start`, "Start guide"), linkAction(`/${product.slug}`, product.name), linkAction("/login", "Login"), linkAction("/signup", "Create account")]
        })
      );
    });

    if (product.slug !== "creator-studio") {
      app.get(`/${product.slug}/catalog`, async (req, res) => {
        const rows = await safeListTable("service_catalog_items", `?select=id,product_key,name,summary,price_note,status&status=eq.active&product_key=eq.${encodeURIComponent(product.productKey)}&order=name.asc&limit=50`);
        const usingDatabase = rows.ok && rows.rows.length > 0;
        const items = usingDatabase
          ? rows.rows.map((row) => ({ name: row.name, summary: row.summary, tier: "paid", priceNote: row.price_note || "Scoped after intake review." }))
          : DEFAULT_SERVICE_CATALOG.filter((item) => item.productKey === product.productKey);
        const sections = items.map((item) => actionCard(item.name, catalogCardBody(item), [linkAction("/requests", "Request this service")]));
        if (!usingDatabase) {
          sections.push(brandCard("Catalog records", rows.ok ? "No catalog records are published in the account database yet, so the standard catalog is shown." : "Setup required: the service_catalog_items table is not available yet, so the standard catalog is shown."));
        }
        res.status(200).type("html").send(
          layout({
            title: `${product.name} Catalog`,
            eyebrow: "Service catalog",
            heading: `${product.name} catalog`,
            body: `Done-for-you ${product.name} services. Submit a request and track it with a reference ID.`,
            sections,
            actions: [linkAction("/service-catalog", "Full catalog"), linkAction("/requests", "My requests"), linkAction(`/${product.slug}`, product.name)]
          })
        );
      });
    }

    app.get(`/${product.slug}/deliverables`, requireWorkspaceAccess(product.productKey), async (req, res) => {
      const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
      const sections = [accessCard(req.sonaraAccess), ...(await deliverableSections(organization, product.productKey))];
      res.status(200).type("html").send(
        layout({
          title: `${product.name} Deliverables`,
          eyebrow: "Workspace",
          heading: `${product.name} deliverables`,
          body: "Work delivered against your service requests in this product area.",
          sections,
          actions: [linkAction("/requests", "Service requests"), linkAction(`/${product.slug}/dashboard`, "Product dashboard"), linkAction("/dashboard", "Dashboard"), logoutAction()]
        })
      );
    });

    app.get(`/${product.slug}/support`, (req, res) => {
      res.status(200).type("html").send(
        layout({
          title: `${product.name} Support`,
          eyebrow: "Support center",
          heading: `${product.name} support`,
          body: `Support intake for ${product.name} questions. Every accepted request returns a reference ID.`,
          sections: [
            supportForm("support"),
            actionCard("More help", "General support, contact, and help resources.", [linkAction("/support", "Support center"), linkAction("/contact", "Contact"), linkAction("/help", "Help")])
          ],
          actions: [linkAction(`/${product.slug}`, product.name), linkAction(`/${product.slug}/dashboard`, "Product dashboard"), linkAction("/", "Home")]
        })
      );
    });

    app.get(`/${product.slug}/requests`, requireWorkspaceAccess(product.productKey), async (req, res) => {
      const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
      const sections = [accessCard(req.sonaraAccess)];
      if (!organization.ok) {
        sections.push(actionCard("Create your workspace", "Your workspace has not been created yet. Create or attach an organization to submit and track service requests.", [linkAction("/account/setup", "Create workspace"), linkAction(`/${product.slug}/tools`, "Continue with free tools")]));
      } else {
        const rows = await safeListTable("service_requests", `?select=id,service_name,status,created_at&organization_id=eq.${encodeURIComponent(organization.organizationId)}&product_key=eq.${encodeURIComponent(product.productKey)}&order=created_at.desc&limit=20`);
        if (!rows.ok) {
          sections.push(brandCard("Setup required", "Request tracking is temporarily unavailable because the service_requests table is not ready in the account database. Submitted requests still return a reference ID."));
        } else if (!rows.rows.length) {
          sections.push(brandCard("No requests yet", `No ${product.name} service requests yet. Browse the catalog and submit the first one.`));
        } else {
          sections.push(...rows.rows.map((row) => brandCard(
            `${row.service_name || "Service request"} - ${displayStatus(row.status || "submitted")}`,
            `Submitted: ${row.created_at || "not returned"}. Reference ID: ${row.id}.`
          )));
        }
      }
      sections.push(actionCard("Submit a request", "New requests go through the shared request center so every request gets a reference ID and tracked status.", [linkAction("/requests", "New service request"), linkAction("/service-catalog", "Service catalog")]));
      res.status(200).type("html").send(
        layout({
          title: `${product.name} Requests`,
          eyebrow: "Workspace",
          heading: `${product.name} requests`,
          body: "Service requests scoped to this product area.",
          sections,
          actions: [linkAction(`/${product.slug}/deliverables`, "Deliverables"), linkAction(`/${product.slug}/dashboard`, "Product dashboard"), linkAction("/dashboard", "Dashboard"), logoutAction()]
        })
      );
    });

    if (product.slug !== "business-builder") {
      const contentCards = product.slug === "creator-studio"
        ? [
            actionCard("Basic Content Plan", "Two weeks of content planned from your niche, cadence, platforms, and pillars.", [linkAction("/creator-studio/tools/content-plan", "Open tool")]),
            actionCard("Prompt and Brief Builder", "Structured creative briefs for every piece of content.", [linkAction("/creator-studio/tools/brief", "Open tool")]),
            actionCard("Releases", "Release checklists and packaging for launches.", [linkAction("/creator-studio/releases", "Open releases"), linkAction("/creator-studio/tools/release-checklist", "Checklist builder")])
          ]
        : [
            actionCard("Campaign Outline", "Consent-safe campaign plans from real goal, audience, offer, and channel inputs.", [linkAction("/growth-studio/tools/campaign", "Open tool")]),
            actionCard("Offer Angle Generator", "Five truthful angles to test against the same audience.", [linkAction("/growth-studio/tools/offer-angles", "Open tool")]),
            actionCard("Paid content planning", "The full content plan workspace unlocks with a confirmed plan or owner access.", [linkAction("/growth-studio/content-plan", "Content plan"), linkAction("/pricing", "View pricing")])
          ];
      app.get(`/${product.slug}/content`, (req, res) => {
        res.status(200).type("html").send(
          layout({
            title: `${product.name} Content`,
            eyebrow: "Content planning",
            heading: `${product.name} content`,
            body: "Plan content with free tools now; paid plans add saved calendars and operator review.",
            sections: contentCards,
            actions: [linkAction(`/${product.slug}/tools`, "All tools"), linkAction(`/${product.slug}/dashboard`, "Product dashboard"), linkAction("/pricing", "Pricing")]
          })
        );
      });
    }
  }

  const BUSINESS_OPERATIONS_PAGES = [
    { path: "/business-builder/inventory", title: "Inventory", table: "inventory_items", ownerPath: "/business-builder/owner/inventory", body: "Track stock items, counts, and reorder notes for your business workspace." },
    { path: "/business-builder/vendors", title: "Vendors", table: "vendor_accounts", ownerPath: "/business-builder/owner/vendors", body: "Track vendor accounts, terms, and invoices for your business workspace." },
    { path: "/business-builder/locations", title: "Locations", table: "business_locations", ownerPath: "/business-builder/owner/locations", body: "Track business locations used for scheduling, staffing, and operations." }
  ];
  for (const operationsPage of BUSINESS_OPERATIONS_PAGES) {
    app.get(operationsPage.path, requireWorkspaceAccess("business_builder"), (req, res) => {
      res.status(200).type("html").send(
        layout({
          title: `Business ${operationsPage.title}`,
          eyebrow: "Business operations",
          heading: `Business ${operationsPage.title.toLowerCase()}`,
          body: operationsPage.body,
          sections: [
            accessCard(req.sonaraAccess),
            brandCard(`${operationsPage.title} records`, `Records are stored in the ${operationsPage.table} table, scoped to your organization, and managed through the owner operations area. If the table is not migrated yet, pages show setup-required instead of fake data.`),
            actionCard(`Manage ${operationsPage.title.toLowerCase()}`, "Owner and manager accounts manage these records in the operations area. Employees see only what their role allows.", [linkAction(operationsPage.ownerPath, "Open operations area"), linkAction("/business-builder/employees", "Team access")])
          ],
          actions: [linkAction("/business-builder/dashboard", "Product dashboard"), linkAction("/business-builder/tools", "All tools"), linkAction("/dashboard", "Dashboard"), logoutAction()]
        })
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Admin/operator views
  // ---------------------------------------------------------------------------

  app.get("/admin/requests", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.service_requests.view", { path: req.path });
    return res.status(200).type("html").send(await adminRowsPage({
      title: "Service requests",
      heading: "Service requests",
      body: "Customer service requests across all organizations. Update work through deliverables.",
      table: "service_requests",
      query: "?select=id,organization_id,product_key,service_name,status,created_at&order=created_at.desc&limit=25",
      emptyText: "No service request rows returned.",
      rowTitle: (row) => `${row.service_name || "Service request"} - ${row.status || "submitted"}`,
      rowBody: (row) => `Organization: ${row.organization_id || "not returned"} / Product: ${row.product_key || "general"} / Created: ${row.created_at || "not returned"} / ID: ${row.id}`,
      extraSections: [brandCard("Intake queue", "Business Builder intake requests are tracked separately under product operations.")],
      actions: [linkAction("/admin/deliverables", "Deliverables"), ...adminActions()]
    }));
  });

  function adminDeliverableForm() {
    const statusOptions = DELIVERABLE_STATUSES.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(displayStatus(status))}</option>`).join("");
    const productOptions = [
      ...PRODUCTS.map((product) => `<option value="${escapeHtml(product.productKey)}">${escapeHtml(product.name)}</option>`),
      `<option value="general">General</option>`
    ].join("");
    return `<article class="card">
    <h2>Publish deliverable</h2>
    <form method="post" action="/admin/deliverables">
      <label>Organization ID<input name="organizationId" type="text" required></label>
      <label>Service request ID (optional)<input name="serviceRequestId" type="text"></label>
      <label>Title<input name="title" type="text" required></label>
      <label>Product area<select name="productKey" required>${productOptions}</select></label>
      <label>Status<select name="status" required>${statusOptions}</select></label>
      <label>Notes<textarea name="notes" rows="4"></textarea></label>
      <button type="submit">Publish deliverable</button>
    </form>
  </article>`;
  }

  app.get("/admin/deliverables", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.service_deliverables.view", { path: req.path });
    return res.status(200).type("html").send(await adminRowsPage({
      title: "Deliverables",
      heading: "Deliverables",
      body: "Operator-published deliverables across all organizations. Publishing requires the service_deliverables table.",
      table: "service_deliverables",
      query: "?select=id,organization_id,product_key,title,status,updated_at&order=updated_at.desc&limit=25",
      emptyText: "No deliverable rows returned.",
      rowTitle: (row) => `${row.title || "Deliverable"} - ${row.status || "preparing"}`,
      rowBody: (row) => `Organization: ${row.organization_id || "not returned"} / Product: ${row.product_key || "general"} / Updated: ${row.updated_at || "not returned"} / ID: ${row.id}`,
      extraSections: [adminDeliverableForm()],
      actions: [linkAction("/admin/requests", "Service requests"), ...adminActions()]
    }));
  });

  app.post("/admin/deliverables", requireAdmin, async (req, res) => {
    const validation = requireFields(req.body, ["organizationId", "title", "productKey", "status"]);
    if (!validation.ok) return sendValidationFailure(req, res, validation, "/admin/deliverables");
    const organizationId = String(req.body.organizationId).trim();
    const serviceRequestId = String(req.body.serviceRequestId || "").trim();
    const status = String(req.body.status).trim();
    if (!isUuid(organizationId)) {
      const payload = { ok: false, code: "validation_failed", message: "Enter a valid organization ID." };
      if (wantsJson(req)) return res.status(400).json(payload);
      return res.status(400).type("html").send(responsePage("Check your inputs", payload.message, [linkAction("/admin/deliverables", "Return")]));
    }
    if (!DELIVERABLE_STATUSES.includes(status)) {
      const payload = { ok: false, code: "validation_failed", message: "Choose a valid deliverable status." };
      if (wantsJson(req)) return res.status(400).json(payload);
      return res.status(400).type("html").send(responsePage("Check your inputs", payload.message, [linkAction("/admin/deliverables", "Return")]));
    }
    if (!VALID_REQUEST_PRODUCT_KEYS.includes(String(req.body.productKey).trim())) {
      const payload = { ok: false, code: "validation_failed", message: "Choose a valid product area." };
      if (wantsJson(req)) return res.status(400).json(payload);
      return res.status(400).type("html").send(responsePage("Check your inputs", payload.message, [linkAction("/admin/deliverables", "Return")]));
    }
    const config = getSupabaseServerConfig();
    if (!config.ok) {
      const payload = { ok: false, code: "setup_required", service: "supabase", message: "Setup required: the account database is not configured." };
      if (wantsJson(req)) return res.status(503).json(payload);
      return res.status(503).type("html").send(responsePage("Setup required", payload.message, [linkAction("/admin/deliverables", "Return")]));
    }
    const record = {
      organization_id: organizationId,
      service_request_id: isUuid(serviceRequestId) ? serviceRequestId : null,
      product_key: String(req.body.productKey).trim(),
      title: String(req.body.title).trim().slice(0, 160),
      notes: String(req.body.notes || "").trim().slice(0, 2000) || null,
      status,
      created_by_user_id: req.sonaraAdmin?.user?.id || null
    };
    const response = await fetch(`${config.url}/rest/v1/service_deliverables`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "return=representation" }),
      body: JSON.stringify(record)
    }).catch(() => undefined);
    if (!response?.ok) {
      const payload = { ok: false, code: "setup_required", service: "service_deliverables", message: "Setup required: the service_deliverables table is not available yet." };
      if (wantsJson(req)) return res.status(503).json(payload);
      return res.status(503).type("html").send(responsePage("Setup required", payload.message, [linkAction("/admin/deliverables", "Return")]));
    }
    const rows = await response.json().catch(() => []);
    const deliverableId = rows[0]?.id;
    if (record.service_request_id) {
      await fetch(`${config.url}/rest/v1/service_request_events`, {
        method: "POST",
        headers: supabaseHeaders(config),
        body: JSON.stringify({ service_request_id: record.service_request_id, organization_id: organizationId, event_type: "deliverable_published", notes: record.title })
      }).catch(() => undefined);
    }
    await recordAdminAuditEvent(req, "admin.service_deliverable.published", { target_type: "service_deliverable", target_id: deliverableId || "unknown" });
    const payload = { ok: true, saved: true, code: "saved", referenceId: deliverableId, message: `Deliverable published. Reference ID: ${deliverableId || "not returned"}.` };
    if (wantsJson(req)) return res.status(200).json(payload);
    return res.status(200).type("html").send(responsePage("Deliverable published", payload.message, [linkAction("/admin/deliverables", "Deliverables"), linkAction("/admin/requests", "Service requests")]));
  });

  app.get("/admin/workspaces", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.workspaces.view", { path: req.path });
    return res.status(200).type("html").send(await adminRowsPage({
      title: "Workspaces",
      heading: "Customer workspaces",
      body: "Organizations are the customer workspace unit. Memberships control who can access each workspace.",
      table: "organizations",
      query: "?select=id,name,created_at&order=created_at.desc&limit=25",
      emptyText: "No organization rows returned.",
      rowTitle: (row) => row.name || "Organization",
      rowBody: (row) => `Created: ${row.created_at || "not returned"} / ID: ${row.id}`,
      extraSections: [brandCard("Memberships", "Workspace access is stored in organization_memberships with role and status columns.")],
      actions: [linkAction("/admin/users", "Users"), linkAction("/admin/roles", "Roles"), ...adminActions()]
    }));
  });

  app.get("/admin/integrations", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.integrations.view", { path: req.path });
    const services = getReadiness().services || {};
    const gateway = getOptionalAiGatewayReadiness();
    const serviceState = (key) => displayStatus(services[key] || "unknown");
    return res.status(200).type("html").send(
      layout({
        title: "Integrations",
        eyebrow: "Founder operations",
        heading: "Integration status",
        body: "Live state of every external integration. Secret values are never displayed.",
        sections: [
          actionCard("Payments (Stripe)", `Checkout: ${serviceState("checkout")}. Secret key: ${serviceState("stripe")}. Payment updates are recorded only from verified webhook events.`, [linkAction("/admin/billing", "Billing"), linkAction("/admin/webhooks", "Payment updates")]),
          actionCard("Account database (Supabase)", `Database access: ${serviceState("supabase")}. Tables and storage buckets are checked live.`, [linkAction("/admin/database", "Database"), linkAction("/admin/storage", "Storage")]),
          actionCard("Email delivery (Resend)", `Email delivery: ${serviceState("emailDelivery")}. Notifications degrade to safe queued states when unconfigured.`, [linkAction("/admin/support", "Support queue")]),
          actionCard("Google sign-in", `Status: ${serviceState("googleSignIn")}. Email and password login works independently.`, [linkAction("/admin/env-readiness", "Environment")]),
          actionCard("Optional AI gateway", `Status: ${displayStatus(gateway.status)}. Operator/development use only; never customer-facing.`, [linkAction("/admin/ai-gateway", "AI gateway")]),
          actionCard("Governed AI integrations", "Twelve tools are classified by runtime, license, risk, and product fit. Eight opt-in service adapters provide read-only readiness probes.", [linkAction("/admin/ai-integrations", "AI integrations")]),
          actionCard("System map", "Formula library, ecosystem manifest, and infrastructure manifest are part of the operational surface.", [linkAction("/admin/formulas", "Formulas"), linkAction("/admin/ecosystem", "Ecosystem"), linkAction("/admin/infrastructure", "Infrastructure")])
        ],
        actions: adminActions()
      })
    );
  });

  app.get("/admin/ai-gateway", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.ai_gateway.view", { path: req.path });
    const readiness = getOptionalAiGatewayReadiness();
    return res.status(200).type("html").send(
      layout({
        title: "AI gateway",
        eyebrow: "Founder operations",
        heading: "Optional AI gateway",
        body: "OmniRoute is an optional, operator-only local AI gateway for development workflows. The public site never depends on it and no key values are ever displayed.",
        sections: [
          brandCard("Status", displayStatus(readiness.status)),
          brandCard("Base URL", readiness.enabled ? `Configured host: ${readiness.baseUrlHost}` : "Not configured. The platform runs fully without it."),
          brandCard("API key", readiness.keyConfigured ? "Configured (value never displayed)." : "Not configured. Optional for local gateways."),
          brandCard("Model", `Requested model: ${escapeHtml(readiness.model || "auto")}. Model routing happens inside the gateway only.`),
          brandCard("Environment names", `Enabled flag: ${AI_GATEWAY_ENV_KEYS.enabled.join(" or ")}. Base URL: ${AI_GATEWAY_ENV_KEYS.baseUrl.join(" or ")}. API key: ${AI_GATEWAY_ENV_KEYS.apiKey.join(" or ")}. Model: ${AI_GATEWAY_ENV_KEYS.model.join(" or ")}.`),
          brandCard("Safety rules", "Never route customer data through a local AI gateway. Never expose gateway keys to the browser. Keep the gateway off in production unless owner-approved."),
          actionCard("Documentation", "Setup, environment names, and safety rules are documented in the repository.", [linkAction("/docs", "Docs"), linkAction("/admin/system", "System")])
        ],
        actions: adminActions()
      })
    );
  });
};
