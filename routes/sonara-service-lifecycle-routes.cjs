// SONARA Software-in-a-Service lifecycle routes.
// Adds onboarding, service catalog, service requests, deliverables, support,
// free tool workspaces with real POST actions, and admin/operator views.
// Injected helpers come from server.js so auth, layout, and Supabase access
// stay consistent with the rest of the app. No secrets are ever rendered.

const { redactError } = require("../lib/sonara-redaction.cjs");
const { PLANNER_TOOLS } = require("../lib/sonara-planner-tools.cjs");
const { applyPreset, describe: describePreset } = require("../lib/sonara-tool-presets.cjs");
const { MARKET_TOOLS } = require("../lib/sonara-market-tools.cjs");
const { STORYBOARD_TOOL } = require("../lib/sonara-storyboard-tool.cjs");

const { getOptionalAiGatewayReadiness, AI_GATEWAY_ENV_KEYS } = require("../lib/optional-ai-gateway.cjs");
const { getRecommendedProductCatalog } = require("../lib/sonara-recommended-product-catalog.cjs");
const plainLanguage = require("../lib/sonara-plain-language.cjs");
const registerSharedResultRoutes = require("./sonara-shared-result-routes.cjs");

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

const LEGACY_DEFAULT_SERVICE_CATALOG = [
  { slug: "launch-offer-builder", productKey: "business_builder", name: "Launch Offer, Built For You", summary: "We write your launch offer for you: how you are positioned, what is in the package, and what to charge, all from your real numbers.", tier: "paid", inputs: "Service type, audience, price idea, proof points", turnaround: "3-5 business days", deliverableType: "A written offer, saved into your workspace", priceNote: "We quote you after we have read your brief." },
  { slug: "customer-intake-setup", productKey: "business_builder", name: "Customer Enquiry Setup", summary: "A working way for customers to reach you: the enquiry form, saved records, a confirmation email, and a list for you to work through.", tier: "paid", inputs: "Business profile, services offered, contact address", turnaround: "3-5 business days", deliverableType: "A working enquiry form, set up for you", priceNote: "Your records need to be set up first." },
  { slug: "payment-readiness-review", productKey: "business_builder", name: "Payment Setup Review", summary: "We check your whole payment path end to end, from checkout to the confirmation coming back, and hand you a list of what to fix.", tier: "paid", inputs: "Stripe account state, plan structure", turnaround: "2-3 business days", deliverableType: "A written review with a fix list", priceNote: "We quote you after we have read your brief." },
  { slug: "creator-offer-builder", productKey: "creator_studio", name: "Creator Offer, Built For You", summary: "Your creator offer: what is in it, what to charge, and how to describe it without overclaiming rights you do not have.", tier: "paid", inputs: "Offer type, audience, deliverables, price idea", turnaround: "3-5 business days", deliverableType: "A written offer, saved into your catalog", priceNote: "We quote you after we have read your brief." },
  { slug: "release-readiness-checklist", productKey: "creator_studio", name: "Release Checklist", summary: "A checklist for your specific release, with dates, what each platform needs, and what is still outstanding.", tier: "free", inputs: "Release title, type, date, platforms", turnaround: "Immediate output; review in 2 days", deliverableType: "A release checklist you can tick off", priceNote: "Free to use. Having our team review it is paid." },
  { slug: "music-system-blueprint", productKey: "creator_studio", name: "Song Plan", summary: "A plan for the song: how it is structured, production notes, ideas to work from, and what to check before you call it finished.", tier: "free", inputs: "Working title, genre, mood, references", turnaround: "Immediate output; setup in 3 days", deliverableType: "A song plan, saved to your workspace", priceNote: "Free to use. Having us set the rest up is paid." },
  { slug: "campaign-setup", productKey: "growth_studio", name: "Campaign Setup", summary: "A campaign you are allowed to send, with the plan, the angles to try, the follow-up wording, and a sheet to track how it goes.", tier: "paid", inputs: "Goal, audience, offer, channel, timeline, consent posture", turnaround: "3-5 business days", deliverableType: "A complete campaign, ready to run", priceNote: "We quote you after we have read your brief." },
  { slug: "lead-followup-plan", productKey: "growth_studio", name: "Lead Follow-Up Plan", summary: "A three-step follow-up you can repeat, with clear rules about who you are allowed to contact, and a record of every lead.", tier: "paid", inputs: "Lead list state, service, consent status", turnaround: "2-4 business days", deliverableType: "Follow-up wording plus your lead list", priceNote: "Your records need to be set up first." },
  { slug: "consent-safe-outreach-checklist", productKey: "growth_studio", name: "Safe Outreach Checklist", summary: "Your outreach checked against the rules: do you have permission, is the sender honest, and can people opt out easily.", tier: "free", inputs: "Audience source, message drafts", turnaround: "Immediate output; review in 2 days", deliverableType: "A checked-over outreach list", priceNote: "Free to use. Having our team review it is paid." }
];

const DEFAULT_SERVICE_CATALOG = [...getRecommendedProductCatalog(), ...LEGACY_DEFAULT_SERVICE_CATALOG];

// Why a catalog entry is or is not open to this customer. Both the card body
// and the card buttons used to work this out separately from the same four
// fields, and drifted apart; they now share one answer.
function catalogAccessReason(item) {
  if (!item.serviceKey) return "open";
  if (["planned", "validation_required", "setup_required"].includes(String(item.lifecycleStatus || ""))) return "awaiting_review";
  if (item.planFloor !== "free" && item.entitlementIntegrationVerified !== true) return "awaiting_paid_access";
  if (item.executionEnabled !== true) return "awaiting_setup";
  return "open";
}

// What the button offers to do about it. This was written inline inside
// catalogActions, where nothing could reach it without booting the router and
// finding a closed product on the rendered page -- and once every product in
// the catalog was open, there was no closed product to find, so the only check
// on this wording went vacuous. It is a pure function of the reason, so it can
// live here and be asked directly.
function catalogRequestLabel(reason) {
  if (reason === "awaiting_review") return "Ask about this one";
  if (reason === "awaiting_paid_access") return "Ask us to open access";
  return "Request this service";
}

function catalogCardBody(item) {
  const parts = [item.summary];
  if (item.customerOutcome) parts.push(`What you get: ${item.customerOutcome}`);
  if (item.inputs) parts.push(`What we need from you: ${item.inputs}.`);
  if (item.turnaround) parts.push(`Turnaround: ${item.turnaround}.`);
  if (item.deliverableType) parts.push(`You receive: ${item.deliverableType}.`);
  if (item.lifecycleStatus) parts.push(`Availability: ${plainLanguage.availabilityLabel(item.lifecycleStatus)}.`);
  if (item.planFloor) parts.push(plainLanguage.includedFrom(item.planFloor));
  else parts.push(`Access: ${item.tier === "free" ? "Free tool" : "Paid service"}.`);
  if (item.serviceKey) parts.push(plainLanguage.accessNote(catalogAccessReason(item)));
  // Only when it adds something. For a governed product the two lines above
  // already give the plan and the reason it is not open, and printing the price
  // note as well made every card say it twice. The done-for-you services have no
  // planFloor and their note is the only place the pricing is stated.
  if (item.priceNote && !item.planFloor) parts.push(item.priceNote);
  return parts.join(" ");
}

module.exports = function registerServiceLifecycleRoutes(app, deps) {
  const {
    resolveCustomerSession,
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

  function catalogActions(item, product) {
    const reason = catalogAccessReason(item);
    const canOpen = reason === "open";
    const actions = [linkAction("/requests", catalogRequestLabel(reason))];
    if (canOpen) {
      const detailPath = item.route || (product ? `/${product.slug}` : "/start");
      actions.push(linkAction(detailPath, item.serviceKey && item.planFloor !== "free" ? "Open paid product" : product ? product.name : "Open product"));
    } else {
      actions.push(linkAction("/service-catalog", "See what is ready now"));
    }
    return actions;
  }

  function catalogDirectorySections(items, resolveProduct) {
    const groups = new Map();
    for (const item of items) {
      let product = null;
      try {
        product = resolveProduct(item) || null;
      } catch {
        product = null;
      }
      const groupName = product?.name || (item?.productKey === "sonara_industries" ? "SONARA Industries" : displayStatus(item?.productKey || "Services"));
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName).push({ item: item || {}, product });
    }
    return [...groups.entries()].map(([groupName, entries]) => {
      const rows = entries.map(({ item, product }) => {
        try {
          const actions = catalogActions(item, product).join("");
          return `<article class="catalog-row"><div class="catalog-row-copy"><h3>${escapeHtml(item.name || "Catalog item")}</h3><p>${escapeHtml(catalogCardBody(item))}</p></div><div class="actions">${actions}</div></article>`;
        } catch {
          const fallbackName = escapeHtml(item?.name || "Catalog item");
          const fallbackSummary = escapeHtml(item?.summary || "This catalog entry needs review before it can be opened.");
          return `<article class="catalog-row"><div class="catalog-row-copy"><h3>${fallbackName}</h3><p>${fallbackSummary}</p></div><div class="actions">${linkAction("/requests", "Request catalog review")}</div></article>`;
        }
      }).join("");
      return `<section class="card catalog-directory"><div class="catalog-directory-heading"><h2>${escapeHtml(groupName)}</h2><p>${entries.length} published product${entries.length === 1 ? "" : "s"}</p></div><div class="catalog-list">${rows}</div></section>`;
    });
  }

  function registerCatalogRoute(route, handler) {
    app.get(route, (req, res, next) => {
      Promise.resolve(handler(req, res, next)).catch((error) => {
        if (process.env.NODE_ENV === "test") {
          // Through the boundary rather than raw. A Supabase failure carries the
          // URL it tried, and that URL carries an apikey query parameter.
          console.error("SONARA catalog route failure", route, redactError(error));
        }
        if (res.headersSent) return next(error);
        return res.status(503).type("html").send(
          layout({
            title: "Catalog temporarily unavailable",
            eyebrow: "Catalog boundary",
            heading: "Catalog temporarily unavailable",
            body: "The catalog could not be rendered safely. No purchase or access state was changed.",
            sections: [brandCard("Setup required", "Use the request center while catalog rendering is restored.")],
            actions: [linkAction("/requests", "Request assistance"), linkAction("/", "Home")]
          })
        );
      });
    });
  }


  // The public face of a saved result.
  //
  // Registered from here rather than from server.js because this module is what
  // makes the results: the tools above compute them, saveModuleOutput stores
  // them, and a shared link is one of those rows with an address. It also needs
  // exactly ten helpers, and this module was already handed all ten -- adding a
  // second call site in server.js would have meant threading the same ten
  // through a second time to reach the same table.
  registerSharedResultRoutes(app, {
    layout, brandCard, linkAction, escapeHtml, responsePage,
    requireCustomer, wantsJson, getSupabaseServerConfig, supabaseHeaders,
    getCustomerPrimaryOrganization
  });

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
    // 503 with ok: false when nothing was saved, matching the two sibling write
    // endpoints. This answered 200 with ok: true for a write that stored
    // nothing, so one product gave two answers to one kind of failure.
    // 503 says "our side broke", and for a visitor with no account nothing broke
    // -- the tool ran and answered. The 503 below is still right for a write
    // that was attempted and failed; this separates the two rather than
    // reporting a working tool as an outage.
    const nothingWentWrong = result.saved || String(result.code) === "not_signed_in";
    if (wantsJson(req)) return res.status(nothingWentWrong ? 200 : 503).json({ ...result, ok: result.saved === true });

    // Whether "setup" is the reason. It is when the workspace is genuinely
    // unconfigured, and it is not when a read or a write failed underneath a
    // workspace that is already finished -- workspace_unreadable and
    // records_unavailable both arrive here, and both used to send the customer
    // to a setup page with nothing on it to do.
    const notSignedIn = String(result.code) === "not_signed_in";
    const setupIsTheReason = !notSignedIn
      && ["setup_required", "customer_organization", "supabase"].includes(String(result.service || result.code));
    const sections = [toolOutputCard(result.output)];
    if (result.saved) {
      sections.push(brandCard("Record saved", `Saved for your organization. Reference ID: ${escapeHtml(String(result.referenceId))}.`));
    } else if (notSignedIn) {
      // Said rather than left to be noticed. A result page that looks the same
      // whether or not it was kept is how somebody closes the tab and loses it.
      sections.push(brandCard(
        "This answer is not saved",
        "The figures above are yours to copy or print. Create a free account and the next one is saved to your workspace, so you can come back to it and see it change."
      ));
    } else if (setupIsTheReason) {
      // No reference number. referenceId is null for unsaved work -- it used to
      // be a randomUUID() identifying no row -- and this printed it through
      // String(), so the customer read the literal word "null".
      sections.push(brandCard("Not saved yet", `Your output was generated and is shown above. ${escapeHtml(plainLanguage.setupRequiredSentence(result.service || result.code))} Saving it needs that finished first.`));
    } else {
      sections.push(brandCard("Your result could not be saved", "Your output was generated and is shown above. We could not save it to your workspace just now, and that is on our side rather than anything you need to set up. Run it again shortly if you want it kept."));
    }
    return res.status(nothingWentWrong ? 200 : 503).type("html").send(
      layout({
        title: tool.title,
        eyebrow: "Free tool result",
        heading: `${tool.title} result`,
        body: result.saved
          ? "Your output was generated and saved as an organization record."
          : "Your output was generated. It could not be saved to your workspace.",
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

  // `values` prefills the form from a saved result. Empty by default, so a
  // tool opened without one renders exactly as it always did.
  //
  // A field with no value is left blank rather than defaulted -- see
  // lib/sonara-tool-presets.cjs for why a silent zero here is worse than an
  // empty box.
  function toolFormCard(tool, values = {}) {
    const has = (name) => Object.prototype.hasOwnProperty.call(values, name);
    const fields = tool.fields
      .map((field) => {
        if (field.type === "select") {
          const options = field.options.map((option) =>
            `<option value="${escapeHtml(option.value)}"${has(field.name) && String(values[field.name]) === String(option.value) ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
          return `<label>${escapeHtml(field.label)}<select name="${escapeHtml(field.name)}"${field.required ? " required" : ""}>${options}</select></label>`;
        }
        if (field.type === "textarea") {
          return `<label>${escapeHtml(field.label)}<textarea name="${escapeHtml(field.name)}" rows="${field.rows || 4}"${field.required ? " required" : ""}>${has(field.name) ? escapeHtml(String(values[field.name])) : ""}</textarea></label>`;
        }
        return `<label>${escapeHtml(field.label)}<input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || "text")}"${has(field.name) ? ` value="${escapeHtml(String(values[field.name]))}"` : ""}${field.required ? " required" : ""}></label>`;
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

  // One saved result's inputs, scoped twice.
  //
  // Both filters matter and for different reasons. organization_id is the
  // tenant boundary -- the service key bypasses row level security, so without
  // it an id from another business would fetch that business's numbers.
  // module_key stops a saved break-even filling in the reorder-point form,
  // which would look like the tool working and produce an answer from figures
  // that mean something else.
  async function readSavedInput(req, tool, id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) {
      return { ok: false, payload: null, reason: "That is not a saved result." };
    }
    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : { ok: false };
    if (!config?.ok) return { ok: false, payload: null, reason: "We could not reach your saved results just now, so nothing has been filled in." };

    const org = typeof getCustomerPrimaryOrganization === "function"
      ? await getCustomerPrimaryOrganization(req.sonaraUser || null, { autoBootstrap: false }).catch(() => null)
      : null;
    if (!org?.ok || !org.organizationId) return { ok: false, payload: null, reason: "We could not work out whose saved results to look in, so nothing has been filled in." };

    const path = `/rest/v1/module_outputs?id=eq.${encodeURIComponent(id)}`
      + `&organization_id=eq.${encodeURIComponent(org.organizationId)}`
      + `&module_key=eq.${encodeURIComponent(tool.module)}`
      + `&select=input_payload&limit=1`;
    const response = await fetch(`${config.url}${path}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
    if (!response?.ok) return { ok: false, payload: null, reason: "We could not read that saved result, so nothing has been filled in." };
    const rows = await response.json().catch(() => null);
    // PostgREST answers 200 with an empty array when the filter matched nothing,
    // which is what another business's id looks like. Not an error, and not a
    // reason to say anything about whose it might be.
    if (!Array.isArray(rows) || !rows.length) return { ok: false, payload: null, reason: "That saved result is not one of yours for this tool." };
    return { ok: true, payload: rows[0]?.input_payload ?? null, reason: null };
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
      title: "Business Setup Score",
      module: "business_readiness_score",
      description: "See how ready you are to launch across your profile, offer, pricing, payments, support, and legal basics.",
      submitLabel: "Score my setup",
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
      title: "Song Plan",
      module: "music_blueprint",
      description: "Plan a song: how it is structured, production notes, and what to check before you call it finished.",
      submitLabel: "Create song plan",
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
      title: "Growth Setup Score",
      module: "growth_readiness_score",
      description: "See how ready you are to grow across permissions, audience, offer, tracking, follow-up, and budget.",
      submitLabel: "Score my setup",
      fields: GROWTH_READINESS_CHECKS.map((check) => yesNoField(check.name, check.label)),
      requiredFields: GROWTH_READINESS_CHECKS.map((check) => check.name),
      build: (body) => scoreReadiness(body, GROWTH_READINESS_CHECKS)
    },
    // Nine planning tools, three per product line. See lib/sonara-planner-tools.cjs
    // for why they are calculators rather than generators.
    ...PLANNER_TOOLS,
    // Nine more, built against documented market complaints rather than from a
    // blank page. Sources in docs/market/2026-08-18-PRODUCT-GAP-RESEARCH.md.
    ...MARKET_TOOLS,
    STORYBOARD_TOOL
  ];

  // Exposed so a test can post to every free tool rather than to the one
  // somebody remembered. Each carries its own required fields, which is what
  // makes a generated submission possible: "Reference ID: null" reached a
  // customer on one of these result pages and was found by hand, because the
  // page crawl only ever issued GETs.
  app.locals.sonaraFreeTools = TOOLS.map((tool) => ({
    path: tool.path,
    title: tool.title,
    // The module key a saved result carries. Exposed so the saved-results list
    // can link a result back to the tool that made it -- a module_key does not
    // contain its own URL, and a path constructed from one would 404 the day a
    // tool moves. Derived from this table, which is the table that registers
    // the routes.
    module: tool.module,
    requiredFields: [...(tool.requiredFields || [])],
    fields: (tool.fields || []).map((field) => field.name)
  }));

  // ---------------------------------------------------------------------------
  // Free tool pages and POST actions
  // ---------------------------------------------------------------------------

  // The free tools compute for anybody, and save for a customer.
  //
  // Until 19 August 2026 both halves were behind a login. The effect was a
  // funnel that advertised and then refused: /business-builder/tools is a public
  // page listing ten tools by name and description, and every one of them
  // answered a visitor who clicked it with a redirect to /login.
  //
  // These are the most differentiated thing in the product and the cheapest to
  // give away -- pure arithmetic, no model call, no provider, no per-use cost,
  // and nothing read from the database to produce the answer. Gating the
  // *computation* does not drive a signup, it drives a bounce; gating the
  // *saving* is what drives a signup, and that is unchanged.
  //
  // **Nothing moved from paid to free.** The free plan already included these
  // tools; they moved from free-after-signup to free-before-signup, which is a
  // funnel change rather than a pricing change.
  for (const tool of TOOLS) {
    app.get(tool.path, async (req, res) => {
      // Resolved, not required. The gate that used to sit here did two jobs and
      // only one of them was gating -- it also worked out who was asking, which
      // is what decides the framing below and, on POST, whether there is anyone
      // to save the result for.
      const session = typeof resolveCustomerSession === "function"
        ? await resolveCustomerSession(req, res).catch(() => ({ ok: false }))
        : { ok: false };
      if (session.ok && session.user) req.sonaraUser = session.user;
      const signedIn = Boolean(req.sonaraAccess || req.sonaraUser);

      // Filling the form in from a result this customer saved earlier.
      //
      // module_outputs has always stored input_payload beside output_payload
      // and nothing ever read it back, so this is a column being used rather
      // than a feature being stored. The read is scoped to the caller's own
      // organization AND to this tool's module_key: a saved result from another
      // business, or from a different tool, finds nothing rather than filling
      // somebody's numbers into the wrong form.
      let preset = null;
      const reuse = String(req.query?.reuse || "");
      if (reuse && signedIn) {
        const saved = await readSavedInput(req, tool, reuse);
        preset = saved.ok
          ? applyPreset({ fields: tool.fields, payload: saved.payload })
          // A failed read must not render an empty form as though no preset was
          // asked for -- somebody would type it all again believing it had not
          // been saved.
          : { ok: false, values: {}, filled: [], missing: [], ignored: [], complete: false, reason: saved.reason };
      }

      const presetCards = [];
      if (preset) {
        presetCards.push(brandCard(preset.ok && preset.filled.length ? "Your numbers from last time" : "Not filled in", describePreset(preset)));
        if (preset.ok && preset.ignored.length) {
          presetCards.push(brandCard(
            "Some of what you saved is not on this tool any more",
            `${preset.ignored.join(", ")}. Nothing was filled in from ${preset.ignored.length === 1 ? "it" : "them"}. This tool has changed since you saved that result.`
          ));
        }
      }

      res.status(200).type("html").send(
        layout({
          title: tool.title,
          eyebrow: "Free tool",
          heading: tool.title,
          body: `${tool.description} It runs on what you type and nothing else -- no account needed to get the answer.`,
          sections: [
            signedIn
              ? accessCard(req.sonaraAccess)
              : brandCard("No account needed", "Fill this in and you get the answer. Creating a free account is what saves it, so you can come back to it and track it."),
            ...presetCards,
            toolFormCard(tool, preset?.values || {})
          ],
          actions: signedIn
            ? [
                linkAction(`/${tool.slug}/tools`, "All tools"),
                linkAction(`/${tool.slug}/dashboard`, "Product dashboard"),
                linkAction("/dashboard", "Dashboard"),
                logoutAction()
              ]
            : [
                linkAction(`/${tool.slug}/tools`, "All tools"),
                linkAction("/signup", "Create a free account"),
                linkAction("/pricing", "Pricing")
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
      // Computed first, saved second, and the answer is shown either way.
      // saveModuleOutput already reports { saved: false } with a reason rather
      // than throwing, and reports "not_signed_in" separately from
      // "setup_required" -- a stranger is not an unfinished workspace, and
      // telling them to finish setting up an account they do not have would be
      // the wrong instruction.
      // Resolve who is asking before saving. Dropping the gate dropped this too,
      // and a signed-in customer's result silently stopped being saved --
      // caught by an existing test asserting that it does. The gate was doing
      // two jobs; only one of them is being removed.
      const session = typeof resolveCustomerSession === "function"
        ? await resolveCustomerSession(req, res).catch(() => ({ ok: false }))
        : { ok: false };
      if (session.ok && session.user) req.sonaraUser = session.user;

      const output = tool.build(req.body);
      const result = await saveModuleOutput(req, tool.productKey, tool.module, req.body, output);
      return sendToolResult(req, res, result, tool);
    });
  }

  // ---------------------------------------------------------------------------
  // Public onboarding, catalog, readiness, and legal index pages
  // ---------------------------------------------------------------------------

  app.get("/start", (req, res) => {
    res.status(200).type("html").send(
      layout({
        surface: "marketing",
        title: "Start",
        eyebrow: "Get started",
        heading: "Start with SONARA",
        body: "Use the tools yourself for free, and request done-for-you help whenever you want a hand. Here is the path from account to first result.",
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
          actionCard("3. Set up your workspace", "Create or attach your organization so your records have a home as you work.", [linkAction("/account/setup", "Account setup")]),
          actionCard("4. Request services", "Browse the service catalog and submit a request. Every accepted request gets a reference ID and status tracking.", [linkAction("/service-catalog", "Service catalog"), linkAction("/requests", "My requests")]),
          actionCard("5. Track everything", "Requests, deliverables, billing, and support all have their own tracking pages.", [linkAction("/deliverables", "Deliverables"), linkAction("/support", "Support"), linkAction("/pricing", "Pricing")])
        ],
        actions: [linkAction("/signup", "Start Free"), linkAction("/service-catalog", "Service catalog"), linkAction("/dashboard", "Dashboard")]
      })
    );
  });

  registerCatalogRoute("/service-catalog", async (req, res) => {
    const rows = await safeListTable("service_catalog_items", "?select=id,service_key,product_key,name,summary,price_note,status,sort_order,product_type,plan_floor,lifecycle_status,route_path,entitlement_integration_verified,execution_enabled,metadata&status=eq.active&order=sort_order.asc,name.asc&limit=100");
    const usingDatabase = rows.ok && rows.rows.length > 0;
    const databaseItems = usingDatabase
      ? rows.rows.map((row) => {
          const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
          return {
            serviceKey: row.service_key,
            productKey: row.product_key,
            productType: row.product_type,
            name: row.name,
            summary: row.summary,
            customerOutcome: metadata.customerOutcome,
            dependencies: Array.isArray(metadata.dependencies) ? metadata.dependencies : [],
            safetyBoundary: metadata.safetyBoundary,
            tier: row.plan_floor === "free" ? "free" : "paid",
            planFloor: row.plan_floor,
            lifecycleStatus: row.lifecycle_status,
            route: row.route_path,
            entitlementIntegrationVerified: row.entitlement_integration_verified === true,
            executionEnabled: row.execution_enabled === true,
            deliverableType: row.product_type === "software_product" ? "A tool you use yourself, with clear steps built in" : "Work our team does for you",
            priceNote: row.price_note || "Scoped after intake review.",
            sortOrder: Number(row.sort_order || 100)
          };
        })
      : [];
    const mergedCatalog = new Map();
    for (const item of DEFAULT_SERVICE_CATALOG) {
      mergedCatalog.set(`${item.productKey}:${String(item.serviceKey || item.name).toLowerCase()}`, item);
    }
    for (const item of databaseItems) {
      const key = `${item.productKey}:${String(item.serviceKey || item.name).toLowerCase()}`;
      mergedCatalog.set(key, { ...(mergedCatalog.get(key) || {}), ...item });
    }
    const items = [...mergedCatalog.values()].sort((left, right) => Number(left.sortOrder || 100) - Number(right.sortOrder || 100) || left.name.localeCompare(right.name));
    const sections = catalogDirectorySections(items, (item) => productByKey(item.productKey));
    if (!usingDatabase) {
      sections.push(
        rows.ok
          ? brandCard("What you are seeing", "This is the standard SONARA catalog. Nothing custom has been published for your account yet.")
          : brandCard("What you are seeing", "This is the standard SONARA catalog — your account's own catalog isn't connected yet. You can still send a request, and you will get a reference number back either way.")
      );
    }
    res.status(200).type("html").send(
      layout({
        surface: "marketing",
        title: "Product and service catalog",
        eyebrow: "Software-in-a-Service",
        heading: "Product and service catalog",
        body: "Everything SONARA offers across Business Builder, Creator Studio, and Growth Studio — the things you can use yourself, and the work our team can do for you. Each card says plainly whether it is ready to use today, needs a little setup first, or is still on the way.",
        sections,
        actions: [linkAction("/requests", "My requests"), linkAction("/start", "How it works"), linkAction("/pricing", "Pricing"), linkAction("/contact", "Contact")]
      })
    );
  });

  app.get("/readiness", (req, res) => {
    res.status(200).type("html").send(
      layout({
        // "What's working right now" promised more than this page delivers.
        // It reports configuration -- which credentials are present and
        // well-formed -- not liveness. A configured payment key and a working
        // payment connection are different claims, and the body already said
        // "set up" while the heading said "working".
        title: "What's set up right now",
        eyebrow: "Live status",
        heading: "What's set up right now",
        body: "A live, honest view of what is set up and what still needs attention. Nothing here is a secret, and anything that isn't working says so instead of pretending.",
        sections: readinessCards(getReadiness()),
        actions: [linkAction("/start", "Start"), linkAction("/support", "Get help"), linkAction("/", "Home")]
      })
    );
  });

  app.get("/legal", (req, res) => {
    res.status(200).type("html").send(
      layout({
        title: "Legal",
        eyebrow: "Legal center",
        heading: "Legal center",
        body: "All SONARA Industries legal terms in one place. These terms are not legal advice.",
        sections: legalPages().map((page) => actionCard(page.title, "Read the current terms. These terms are not legal advice.", [linkAction(page.href, "Read")])),
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
      // No reference ID. It used to mint one with randomUUID() for a request
      // that was never written, which is a number identifying nothing -- and it
      // is the artefact that makes somebody believe they have a case open.
      const payload = { ok: false, saved: false, code: "setup_required", service: "supabase", referenceId: null, message: "Your request was not recorded, because the account database is not connected. Nothing was saved, so please try again shortly rather than waiting to hear back." };
      if (wantsJson(req)) return res.status(503).json(payload);
      return res.status(503).type("html").send(responsePage("Your request was not recorded", payload.message, [linkAction("/requests", "Requests"), linkAction("/contact", "Contact")]));
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
      const payload = { ok: false, saved: false, code: "not_recorded", service: "service_requests", referenceId: null, message: "Your request was not recorded. Nothing was saved, so please try again shortly rather than waiting to hear back." };
      if (wantsJson(req)) return res.status(503).json(payload);
      return res.status(503).type("html").send(responsePage("Your request was not recorded", payload.message, [linkAction("/requests", "Requests"), linkAction("/contact", "Contact")]));
    }

    // The write succeeded, so this id exists. It used to fall back to
    // randomUUID(), which handed out a reference to a row nobody could find on
    // the one path where the insert worked and the representation did not come
    // back -- the hardest version of this to notice, because everything else
    // about the request was fine.
    const rows = await response.json().catch(() => null);
    const requestId = Array.isArray(rows) ? rows[0]?.id : undefined;
    if (!requestId) {
      const payload = { ok: false, saved: true, code: "reference_unavailable", service: "service_requests", referenceId: null, message: "Your request was saved, but we could not read back its reference number. It is recorded -- check your requests list rather than submitting it again." };
      if (wantsJson(req)) return res.status(200).json(payload);
      return res.status(200).type("html").send(responsePage("Saved, without a reference number", payload.message, [linkAction("/requests", "My requests"), linkAction("/dashboard", "Dashboard")]));
    }
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
        sections.push(brandCard("Setup required", "The service_requests table is not available yet, so a request submitted now cannot be recorded and will be refused rather than accepted quietly."));
      } else if (!rows.rows.length) {
        sections.push(brandCard("No requests yet", "Submit your first service request below or browse the service catalog."));
      } else {
        // Linked, not just listed. Every request was rendered as a card with a
        // reference id on it and no way to open it, so a customer could see
        // that they had asked for something and never see the answer -- and
        // service_comments, which holds the replies, was read by nothing at
        // runtime at all.
        sections.push(...rows.rows.map((row) => actionCard(
          `${row.service_name || "Service request"} - ${displayStatus(row.status || "submitted")}`,
          `${displayStatus(row.product_key || "general")}. Submitted ${row.created_at || "at a date we could not read"}.`,
          [linkAction(`/requests/${encodeURIComponent(row.id)}`, "Open this request")]
        )));
        sections.push(await replyTimeCard(organization.organizationId, rows.rows));
      }
    }
    sections.push(serviceRequestForm());
    sections.push(brandCard("How a request moves along", `Every request goes through these stages: ${SERVICE_REQUEST_STATUSES.map((status) => displayStatus(status)).join(", ")}.`));
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

  // How long this business is taking to answer, from its own records.
  //
  // /growth-studio/tools/response-time asks a customer to type their average in.
  // This is the same figure measured instead -- service_requests carries when a
  // request arrived and service_comments carries the replies, so it is a
  // subtraction rather than a memory.
  async function replyTimeCard(organizationId, requests) {
    const science = require("../lib/sonara-service-response.cjs");
    const ids = requests.map((row) => row.id).filter(Boolean);
    if (!ids.length) return "";
    const list = ids.map((id) => `"${id}"`).join(",");
    const comments = await safeListTable(
      "service_comments",
      `?select=service_request_id,created_at&organization_id=eq.${encodeURIComponent(organizationId)}`
        + `&service_request_id=in.(${encodeURIComponent(list)})&order=created_at.asc&limit=500`
    );
    // A read that failed is not a business that never replies. Saying nothing is
    // better than reporting a perfect score because the replies would not load.
    if (!comments.ok) {
      return brandCard("How quickly you reply", "We could not read the replies just now, so there is no figure to show. Nothing has changed.");
    }
    const measured = science.firstReplyTimes(requests, comments.rows, {});
    if (!measured.ok) return "";
    const lines = [];
    if (measured.answered) {
      lines.push(`Half of your answered requests got a first reply within ${science.humanDuration(measured.medianMinutes)}.`);
      if (measured.withinADay !== null) {
        lines.push(`${Math.round(measured.withinADay * 100)}% were answered within a day, ${Math.round(measured.withinAnHour * 100)}% within an hour.`);
      }
    } else {
      lines.push("Nothing has been replied to yet, so there is no reply time to measure.");
    }
    if (measured.longestWaiting) {
      lines.push(`Still waiting the longest: ${measured.longestWaiting.name}, ${science.humanDuration(measured.longestWaiting.waitingMinutes)} so far.`);
    }
    lines.push(measured.basis);
    return brandCard("How quickly you reply", lines.join(" "));
  }

  // One request, and the conversation on it.
  app.get("/requests/:requestId", requireCustomer, async (req, res) => {
    const requestId = String(req.params.requestId || "");
    const back = [linkAction("/requests", "All your requests"), linkAction("/dashboard", "Dashboard")];
    const notFound = () => layout({
      title: "Service request",
      eyebrow: "Software-in-a-Service",
      heading: "We could not find that request",
      body: "It may belong to a different workspace, or the reference may be wrong.",
      sections: [],
      actions: back
    });
    if (!isUuid(requestId)) return res.status(404).type("html").send(notFound());

    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization.ok) {
      return res.status(200).type("html").send(layout({
        title: "Service request",
        eyebrow: "Software-in-a-Service",
        heading: "Service request",
        body: "Create or attach an organization to open a request.",
        sections: [actionCard("Workspace setup required", "Your requests live in a workspace.", [linkAction("/account/setup", "Account setup")])],
        actions: back
      }));
    }

    // Scoped by organization as well as by id. The service key bypasses row
    // level security, so without the organization filter a guessed reference
    // from another business would open.
    const found = await safeListTable(
      "service_requests",
      `?select=id,service_name,product_key,status,summary,details,created_at&id=eq.${encodeURIComponent(requestId)}`
        + `&organization_id=eq.${encodeURIComponent(organization.organizationId)}&limit=1`
    );
    // A read that failed and a request that is not there are different things,
    // and answering "not found" to both tells a customer their record is gone
    // during an outage.
    if (!found.ok) {
      return res.status(503).type("html").send(layout({
        title: "Service request",
        eyebrow: "Software-in-a-Service",
        heading: "We could not open that request",
        body: "This is on our side, and nothing has changed. Try again shortly.",
        sections: [],
        actions: back
      }));
    }
    const request = found.rows[0];
    if (!request) return res.status(404).type("html").send(notFound());

    const thread = await safeListTable(
      "service_comments",
      `?select=id,body,created_at,user_id&service_request_id=eq.${encodeURIComponent(requestId)}`
        + `&organization_id=eq.${encodeURIComponent(organization.organizationId)}&order=created_at.asc&limit=200`
    );

    const sections = [
      brandCard(
        request.service_name || "Service request",
        `${displayStatus(request.status || "submitted")}. ${displayStatus(request.product_key || "general")}. `
          + `Submitted ${request.created_at || "at a date we could not read"}. Reference ${request.id}.`
      )
    ];
    if (request.summary) sections.push(brandCard("What you asked for", request.summary));
    if (request.details) sections.push(brandCard("The detail you gave", request.details));

    if (!thread.ok) {
      // Never "no replies yet" for a read that failed. That sentence is a claim
      // about the customer's records and it would be false.
      sections.push(brandCard("Messages", "We could not load the messages on this request just now. Nothing has been lost -- try again shortly."));
    } else if (!thread.rows.length) {
      sections.push(brandCard("Messages", "There are no messages on this request yet. Anything you add below is kept with it."));
    } else {
      sections.push(...thread.rows.map((row) => brandCard(
        row.user_id && row.user_id === req.sonaraUser?.id ? `You, ${row.created_at || "at an unknown time"}` : `Reply, ${row.created_at || "at an unknown time"}`,
        String(row.body || "")
      )));
    }
    sections.push(`<article class="card"><h2>Add a message</h2>
      <p>Anything you add here stays with this request, so whoever picks it up can see it.</p>
      <form method="post" action="${escapeHtml(`/api/service-requests/${encodeURIComponent(requestId)}/comments`)}">
        <label>Message<textarea name="body" rows="4" maxlength="4000" required></textarea></label>
        <button type="submit">Add this message</button>
      </form>
    </article>`);

    return res.status(200).type("html").send(layout({
      title: request.service_name || "Service request",
      eyebrow: "Software-in-a-Service",
      heading: request.service_name || "Service request",
      body: "Everything said about this request, in one place.",
      sections,
      actions: back
    }));
  });

  const MAX_COMMENT_LENGTH = 4000;

  app.post("/api/service-requests/:requestId/comments", requireCustomer, async (req, res) => {
    const requestId = String(req.params.requestId || "");
    const back = isUuid(requestId) ? `/requests/${encodeURIComponent(requestId)}` : "/requests";
    const respond = (status, payload) => {
      if (wantsJson(req)) return res.status(status).json(payload);
      if (payload.ok) return res.redirect(303, back);
      return res.status(status).type("html").send(responsePage(
        "That message was not added",
        payload.message || "Nothing was saved. Try again shortly.",
        [linkAction(back, "Back to the request"), linkAction("/support", "Get help")]
      ));
    };

    if (!isUuid(requestId)) return respond(404, { ok: false, code: "unknown_request" });
    const body = String(req.body?.body || "").trim();
    if (!body) return respond(400, { ok: false, code: "message_required", message: "Write something before adding it." });
    if (body.length > MAX_COMMENT_LENGTH) {
      return respond(400, { ok: false, code: "message_too_long", message: `A message can be at most ${MAX_COMMENT_LENGTH} characters.` });
    }

    const config = getSupabaseServerConfig();
    if (!config.ok) return respond(503, { ok: false, code: "setup_required" });
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization.ok) return respond(409, { ok: false, code: "workspace_setup_required" });

    // The request is confirmed to be in the caller's organization before a
    // comment is written against it. Writing first and checking after would
    // leave a message attached to somebody else's request if the check failed.
    const owns = await safeListTable(
      "service_requests",
      `?select=id&id=eq.${encodeURIComponent(requestId)}&organization_id=eq.${encodeURIComponent(organization.organizationId)}&limit=1`
    );
    if (!owns.ok) return respond(503, { ok: false, code: "workspace_unreadable" });
    if (!owns.rows.length) return respond(404, { ok: false, code: "unknown_request" });

    const written = await fetch(`${config.url}/rest/v1/service_comments`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "return=representation" }),
      body: JSON.stringify({
        organization_id: organization.organizationId,
        service_request_id: requestId,
        user_id: req.sonaraUser?.id || null,
        body
      })
    }).catch(() => undefined);
    if (!written?.ok) return respond(503, { ok: false, code: "not_recorded", message: "Your message was not saved. Nothing has been recorded, so add it again rather than assuming it arrived." });
    return respond(200, { ok: true, code: "added" });
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
    sections.push(brandCard("How a deliverable moves along", `Statuses move through: ${DELIVERABLE_STATUSES.map((status) => displayStatus(status)).join(", ")}.`));
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


  // The customer's own support requests.
  //
  // Somebody who submits a request gets a reference number and then had nowhere
  // to look it up again -- support_requests was read only by /admin/support,
  // which is an operator surface listing every tenant. "I asked for help, what
  // happened?" had no answer in the product.
  //
  // Organization-scoped, like every other customer read. Returns "" when there
  // is no session, no workspace, or no database, because /support is a public
  // page and must still render for a signed-out visitor.
  async function customerSupportRequestCards(req, res) {
    // /support carries no auth middleware, so nothing has resolved a session by
    // the time this runs. Resolve one without requiring it: a visitor simply
    // gets no list.
    let user = req.sonaraUser || req.sonaraAccess?.user;
    if (!user && typeof resolveCustomerSession === "function") {
      const session = await resolveCustomerSession(req, res).catch(() => ({ ok: false }));
      if (session.ok) user = session.user;
    }
    if (!user) return "";
    const config = getSupabaseServerConfig();
    if (!config.ok) return "";
    const organization = await getCustomerPrimaryOrganization(user).catch(() => ({ ok: false }));
    if (!organization.ok || !organization.organizationId) return "";

    const url = `${config.url}/rest/v1/support_requests?select=reference_id,subject,status,created_at&organization_id=eq.${encodeURIComponent(organization.organizationId)}&order=created_at.desc&limit=10`;
    const response = await fetch(url, { headers: supabaseHeaders(config) }).catch(() => undefined);
    if (!response?.ok) return "";
    const requests = await response.json().catch(() => []);
    if (!requests.length) return "";

    const rows = requests.map((entry) => {
      const when = entry.created_at ? new Date(entry.created_at) : null;
      const raised = when && !Number.isNaN(when.getTime())
        ? when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "recently";
      const status = String(entry.status || "open").replace(/_/g, " ");
      const reference = String(entry.reference_id || "").slice(0, 8);
      return `<p><strong>${escapeHtml(String(entry.subject || "Support request"))}</strong><br>
        Reference ${escapeHtml(reference)} &middot; ${escapeHtml(status)} &middot; raised ${escapeHtml(raised)}</p>`;
    }).join("");

    return `<article class="card"><h2>Your support requests</h2><p>The ten most recent from your workspace, newest first.</p>${rows}</article>`;
  }

  app.get("/support", async (req, res) => {
    const readiness = getReadiness();
    const yourRequests = await customerSupportRequestCards(req, res);
    res.status(200).type("html").send(
      layout({
        title: "Support",
        eyebrow: "Support center",
        heading: "Support",
        body: "Submit a support request and get a reference ID right away. Every request is tracked, so you always have that ID to follow up.",
        sections: [
          supportForm("support"),
          // Only shown when there is something to show; a signed-out visitor
          // sees the page exactly as before.
          ...(yourRequests ? [yourRequests] : []),
          brandCard("What happens to your request", readiness.services.supabase === "configured" ? "Your request is saved and tracked, and you get a reference number." : "Your request is saved safely with a reference number, so nothing gets lost while setup finishes."),
          actionCard("Other paths", "Billing questions, account access, and general contact all route through the same tracked intake.", [linkAction("/contact", "Contact form"), linkAction("/readiness", "Check what is working")])
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
    // 503 when the request was stored nowhere and sent nowhere. The heading came
    // from `result.ok ? ... : "Support request queued"`, and there is no queue --
    // so the one path where nothing happened had the most reassuring page.
    const status = result.ok ? 200 : 503;
    if (wantsJson(req)) return res.status(status).json(result);
    return res.status(status).type("html").send(
      responsePage(result.heading, result.message, [linkAction("/support", "Support"), linkAction("/dashboard", "Dashboard"), linkAction("/", "Home")])
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
          eyebrow: "Get started",
          heading: `Start with ${product.name}`,
          body: `Use the ${product.name} free tools yourself, then request done-for-you help whenever you want a hand.`,
          sections: [
            checklistCard("Getting started", [
              "Create a free account",
              "Create or attach your organization",
              "Open the free tools",
              "Save your outputs once your workspace is set up",
              "Request services from the catalog",
              "Upgrade for saved records and tracking"
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
          body: "Free tools are available once you're signed in, and give you a real result even before your workspace is fully set up.",
          sections,
          actions: [linkAction(`/${product.slug}/start`, "Start guide"), linkAction(`/${product.slug}`, product.name), linkAction("/login", "Login"), linkAction("/signup", "Create account")]
        })
      );
    });

    if (product.slug !== "creator-studio") {
      registerCatalogRoute(`/${product.slug}/catalog`, async (req, res) => {
        const rows = await safeListTable("service_catalog_items", `?select=id,service_key,product_key,name,summary,price_note,status,sort_order,product_type,plan_floor,lifecycle_status,route_path,entitlement_integration_verified,execution_enabled,metadata&status=eq.active&product_key=eq.${encodeURIComponent(product.productKey)}&order=sort_order.asc,name.asc&limit=100`);
        const usingDatabase = rows.ok && rows.rows.length > 0;
        const productCatalogItems = new Map();
        for (const item of DEFAULT_SERVICE_CATALOG.filter((entry) => entry.productKey === product.productKey)) {
          productCatalogItems.set(String(item.serviceKey || item.name).toLowerCase(), item);
        }
        if (usingDatabase) {
          for (const row of rows.rows) {
            const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
            const item = {
              serviceKey: row.service_key,
              productKey: row.product_key,
              productType: row.product_type,
              name: row.name,
              summary: row.summary,
              customerOutcome: metadata.customerOutcome,
              tier: row.plan_floor === "free" ? "free" : "paid",
              planFloor: row.plan_floor,
              lifecycleStatus: row.lifecycle_status,
              route: row.route_path,
              entitlementIntegrationVerified: row.entitlement_integration_verified === true,
              executionEnabled: row.execution_enabled === true,
              deliverableType: row.product_type === "software_product" ? "A tool you use yourself, with clear steps built in" : "Work our team does for you",
              priceNote: row.price_note || "Scoped after intake review.",
              sortOrder: Number(row.sort_order || 100)
            };
            const key = String(item.serviceKey || item.name).toLowerCase();
            productCatalogItems.set(key, { ...(productCatalogItems.get(key) || {}), ...item });
          }
        }
        const items = [...productCatalogItems.values()].sort((left, right) => Number(left.sortOrder || 100) - Number(right.sortOrder || 100) || left.name.localeCompare(right.name));
        const sections = catalogDirectorySections(items, () => product);
        if (!usingDatabase) {
          sections.push(brandCard("Catalog records", rows.ok ? "No catalog records are published in the account database yet, so the standard catalog is shown." : "Setup required: the service_catalog_items table is not available yet, so the standard catalog is shown."));
        }
        res.status(200).type("html").send(
          layout({
            title: `${product.name} Catalog`,
            eyebrow: "Service catalog",
            heading: `${product.name} catalog`,
            body: `Everything ${product.name} offers. Each card says whether it is ready to use today, needs setup first, or is still on the way.`, 
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

  // Three signposts to the owner pages, from when those pages had nothing to
  // show. They rendered no records themselves and explained that "records are
  // stored in the inventory_items table" -- a table name read out to a customer
  // -- before pointing at the operations area.
  //
  // The owner pages list the real records now, so a customer who asks for
  // locations should get locations rather than a page about where locations
  // live. /business-builder/vehicles was the same shape and went the same way.
  const BUSINESS_OPERATIONS_PAGES = [
    ["/business-builder/inventory", "/business-builder/owner/inventory"],
    ["/business-builder/vendors", "/business-builder/owner/vendors"],
    ["/business-builder/locations", "/business-builder/owner/locations"]
  ];
  for (const [path, ownerPath] of BUSINESS_OPERATIONS_PAGES) {
    app.get(path, requireWorkspaceAccess("business_builder"), (req, res) => res.redirect(302, ownerPath));
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

// Exposed for tests. Both decide what a customer is told about a product that
// is not open to them, and neither is reachable through the rendered page when
// every product happens to be open.
module.exports.catalogAccessReason = catalogAccessReason;
module.exports.catalogRequestLabel = catalogRequestLabel;
