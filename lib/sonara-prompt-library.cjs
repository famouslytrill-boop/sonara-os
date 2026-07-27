"use strict";

const crypto = require("node:crypto");
const { PROMPTS_CHAT_REFERENCE, PROMPT_LIBRARY_TABLES } = require("../data/prompts-chat-reference.cjs");

const PRODUCT_WORKSPACES = Object.freeze({
  business_builder: "business_builder",
  creator_studio: "creator_studio",
  growth_studio: "growth_studio"
});

const PRODUCT_LABELS = Object.freeze({
  business_builder: "Business Builder",
  creator_studio: "Creator Studio",
  growth_studio: "Growth Studio"
});

const PROMPT_TYPES = Object.freeze(["text", "image", "video", "audio", "structured", "skill", "workflow"]);
const VISIBILITIES = Object.freeze(["private", "organization", "public"]);
const STATUSES = Object.freeze(["draft", "review_required", "published", "archived", "blocked"]);
const MAX_TEMPLATE_LENGTH = 24000;
const MAX_VALUE_LENGTH = 6000;
const MAX_RENDERED_LENGTH = 48000;

const BUILTIN_PROMPT_TEMPLATES = Object.freeze([
  template({
    slug: "business-launch-blueprint",
    title: "Business Launch Blueprint",
    productArea: "business_builder",
    category: "launch",
    description: "Turn a business idea into a practical launch sequence, offer, operations checklist, and first-month measurement plan.",
    content: `Act as a practical small-business launch strategist. Build an implementation-ready launch blueprint for {{business_name}}, a {{business_type}} serving {{target_customer}} in {{location}}.

Use these constraints:
- Starting budget: {{starting_budget}}
- Owner availability: {{owner_availability}}
- Primary offer: {{primary_offer}}
- Launch deadline: {{launch_deadline}}

Produce:
1. A clear value proposition.
2. A minimum viable offer with scope, price logic, proof points, and fulfillment steps.
3. A seven-stage launch checklist covering legal setup, payments, customer intake, operations, marketing, support, and measurement.
4. A realistic first-30-day operating calendar.
5. The five most important risks, each with prevention and recovery steps.
6. Weekly metrics that a non-technical owner can track.

Do not invent licenses, approvals, demand, revenue, partnerships, or completed setup. Mark every assumption clearly.`,
    requiredVariables: ["business_name", "business_type", "target_customer", "location", "starting_budget", "owner_availability", "primary_offer", "launch_deadline"],
    outputFormat: "markdown",
    tags: ["business", "launch", "operations", "offer"]
  }),
  template({
    slug: "restaurant-profitability-review",
    title: "Restaurant Profitability Review",
    productArea: "business_builder",
    category: "restaurant_operations",
    description: "Review a restaurant, bar, catering, or food-truck operation without pretending missing numbers are known.",
    content: `Act as a restaurant operations analyst. Review the following operation:

Business type: {{business_type}}
Average weekly sales: {{weekly_sales}}
Food and beverage cost: {{cost_of_goods}}
Weekly labor cost: {{labor_cost}}
Occupancy and fixed weekly costs: {{fixed_costs}}
Current menu or service concerns: {{operational_concerns}}

Calculate or explain:
- Prime cost and prime-cost percentage.
- Estimated contribution after listed costs.
- Break-even sales using only the supplied numbers.
- Three menu, labor, waste, purchasing, or scheduling improvements ranked by expected impact and implementation difficulty.
- A seven-day owner action plan.

Show formulas. Separate known values, calculated values, and assumptions. Never fabricate missing financial records.`,
    requiredVariables: ["business_type", "weekly_sales", "cost_of_goods", "labor_cost", "fixed_costs", "operational_concerns"],
    outputFormat: "markdown",
    tags: ["restaurant", "profit", "food-cost", "labor"]
  }),
  template({
    slug: "employee-onboarding-plan",
    title: "Employee Onboarding Plan",
    productArea: "business_builder",
    category: "staff",
    description: "Create a role-specific onboarding and training sequence with evidence checkpoints.",
    content: `Create a structured onboarding plan for a new {{role_name}} at {{business_name}}.

Context:
- Work environment: {{work_environment}}
- Shift pattern: {{shift_pattern}}
- Required responsibilities: {{responsibilities}}
- Safety or compliance topics: {{safety_topics}}
- Training duration: {{training_duration}}

Include a first-day agenda, first-week checklist, role standards, shadowing tasks, supervised practice, manager checkpoints, knowledge checks, and a final readiness decision. Distinguish legal requirements that need local professional verification from internal company procedures.`,
    requiredVariables: ["role_name", "business_name", "work_environment", "shift_pattern", "responsibilities", "safety_topics", "training_duration"],
    outputFormat: "markdown",
    tags: ["employees", "training", "onboarding", "operations"]
  }),
  template({
    slug: "original-song-blueprint",
    title: "Original Song Blueprint",
    productArea: "creator_studio",
    category: "music",
    description: "Build an original repeatable song plan using musical parameters rather than private artist imitation.",
    content: `Build an original {{genre}} song blueprint at {{bpm}} BPM in {{key_signature}}.

Required identity:
- Rhythmic feel: {{rhythmic_feel}}
- Harmonic identity: {{harmonic_identity}}
- Drum language: {{drum_language}}
- Vocal mode: {{vocal_mode}}
- Emotional theme: {{theme}}
- Hook concept: {{hook_concept}}

Provide an eight-section arrangement, chord or scale guidance, drum development, bass movement, melodic contour, vocal delivery notes, transition ideas, production checkpoints, and an originality checklist. Do not use living artist names as generation instructions or reproduce identifiable lyrics, melodies, recordings, or private reference material.`,
    requiredVariables: ["genre", "bpm", "key_signature", "rhythmic_feel", "harmonic_identity", "drum_language", "vocal_mode", "theme", "hook_concept"],
    outputFormat: "markdown",
    tags: ["music", "songwriting", "production", "originality"]
  }),
  template({
    slug: "creator-release-command-plan",
    title: "Creator Release Command Plan",
    productArea: "creator_studio",
    category: "release",
    description: "Coordinate assets, rights, distribution, content, audience communication, and release-day evidence.",
    content: `Create a release command plan for {{release_title}}, a {{release_type}} scheduled for {{release_date}}.

Available assets: {{available_assets}}
Missing assets: {{missing_assets}}
Distribution status: {{distribution_status}}
Rights status: {{rights_status}}
Target audience: {{target_audience}}
Primary channels: {{channels}}
Budget: {{budget}}

Produce a backward schedule, asset manifest, rights verification gate, channel-specific content plan, release-week runbook, contingency routes, measurement dashboard, and post-release review. Never claim distribution, clearance, playlist placement, press coverage, or sales that have not been verified.`,
    requiredVariables: ["release_title", "release_type", "release_date", "available_assets", "missing_assets", "distribution_status", "rights_status", "target_audience", "channels", "budget"],
    outputFormat: "markdown",
    tags: ["release", "creator", "rights", "distribution"]
  }),
  template({
    slug: "video-production-brief",
    title: "Video Production Brief",
    productArea: "creator_studio",
    category: "video",
    description: "Turn a concept into a shot-conscious production brief with rights and accessibility checks.",
    content: `Create a production brief for a {{video_type}} titled {{working_title}}.

Goal: {{goal}}
Audience: {{audience}}
Duration: {{duration}}
Format and destinations: {{formats}}
Visual direction: {{visual_direction}}
Available equipment and assets: {{available_resources}}
Budget and deadline: {{budget_deadline}}

Include the narrative spine, scene list, shot priorities, audio plan, lighting plan, graphics and caption plan, permissions and likeness checks, production schedule, backup plan, edit checklist, export matrix, and quality-control review.`,
    requiredVariables: ["video_type", "working_title", "goal", "audience", "duration", "formats", "visual_direction", "available_resources", "budget_deadline"],
    outputFormat: "markdown",
    tags: ["video", "production", "rights", "accessibility"]
  }),
  template({
    slug: "consent-safe-growth-campaign",
    title: "Consent-Safe Growth Campaign",
    productArea: "growth_studio",
    category: "campaign",
    description: "Build a campaign that connects offer, audience, content, follow-up, attribution, and consent.",
    content: `Design a consent-safe growth campaign for {{business_or_creator}} promoting {{offer}} to {{audience}}.

Campaign window: {{campaign_window}}
Channels: {{channels}}
Budget: {{budget}}
Available proof: {{proof}}
Primary conversion action: {{conversion_action}}
Consent and data constraints: {{consent_constraints}}

Produce the campaign hypothesis, audience segments, message angles, channel plan, content matrix, landing-page outline, compliant lead-capture fields, follow-up sequence, attribution plan, experiment design, stop conditions, and weekly review. Do not invent testimonials, scarcity, endorsements, results, audience consent, or platform approval.`,
    requiredVariables: ["business_or_creator", "offer", "audience", "campaign_window", "channels", "budget", "proof", "conversion_action", "consent_constraints"],
    outputFormat: "markdown",
    tags: ["growth", "campaign", "consent", "attribution"]
  }),
  template({
    slug: "lead-follow-up-sequence",
    title: "Lead Follow-Up Sequence",
    productArea: "growth_studio",
    category: "leads",
    description: "Create respectful follow-up based on lead source, consent state, needs, and timing.",
    content: `Create a follow-up sequence for a lead named {{lead_name}} who came from {{lead_source}} and expressed interest in {{interest}}.

Known context: {{known_context}}
Consent status: {{consent_status}}
Preferred channel: {{preferred_channel}}
Offer and next step: {{offer_next_step}}
Follow-up window: {{follow_up_window}}

Write a first response, one value-adding follow-up, one objection-handling response, and one respectful close-out message. Keep claims factual, preserve opt-out language, avoid pressure tactics, and do not infer sensitive personal information.`,
    requiredVariables: ["lead_name", "lead_source", "interest", "known_context", "consent_status", "preferred_channel", "offer_next_step", "follow_up_window"],
    outputFormat: "markdown",
    tags: ["leads", "follow-up", "consent", "sales"]
  }),
  template({
    slug: "offer-angle-experiment",
    title: "Offer Angle Experiment",
    productArea: "growth_studio",
    category: "experiments",
    description: "Generate testable offer angles without fake claims, dark patterns, or unmeasurable objectives.",
    content: `Create three distinct, testable offer angles for {{offer_name}}.

Audience: {{audience}}
Verified customer problem: {{customer_problem}}
Verified proof: {{verified_proof}}
Price or commitment: {{price_commitment}}
Channel: {{channel}}
Measurement window: {{measurement_window}}

For each angle provide the core promise, supporting proof, headline, short body copy, call to action, objection addressed, success metric, minimum sample requirement, and stop condition. Reject any angle that depends on fabricated urgency, unsupported outcomes, discriminatory targeting, or hidden terms.`,
    requiredVariables: ["offer_name", "audience", "customer_problem", "verified_proof", "price_commitment", "channel", "measurement_window"],
    outputFormat: "markdown",
    tags: ["offers", "experiments", "copy", "measurement"]
  })
]);

function template(input) {
  const variables = extractVariables(input.content);
  return Object.freeze({
    id: `builtin:${input.slug}`,
    slug: input.slug,
    title: input.title,
    productArea: input.productArea,
    productLabel: PRODUCT_LABELS[input.productArea],
    category: input.category,
    description: input.description,
    content: input.content,
    promptType: input.promptType || "text",
    visibility: "public",
    status: "published",
    requiredVariables: Object.freeze(input.requiredVariables || variables),
    optionalVariables: Object.freeze(input.optionalVariables || []),
    outputFormat: input.outputFormat || "markdown",
    modelCompatibility: Object.freeze(input.modelCompatibility || ["provider_neutral"]),
    mcpCompatibility: Object.freeze(input.mcpCompatibility || []),
    tags: Object.freeze(input.tags || []),
    sourceType: "sonara_original",
    sourceRepository: null,
    sourceCommit: null,
    license: "SONARA original; repository MIT license",
    currentVersion: 1,
    fingerprint: promptFingerprint({ slug: input.slug, content: input.content, version: 1 })
  });
}

function normalizeProductArea(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "business" || normalized === "businessbuilder") return "business_builder";
  if (normalized === "creator" || normalized === "creatorstudio") return "creator_studio";
  if (normalized === "growth" || normalized === "growthstudio") return "growth_studio";
  return PRODUCT_WORKSPACES[normalized] ? normalized : null;
}

function listPromptTemplates(filters = {}) {
  const productArea = filters.productArea ? normalizeProductArea(filters.productArea) : null;
  const category = String(filters.category || "").trim().toLowerCase();
  const query = String(filters.query || "").trim().toLowerCase();
  const tags = Array.isArray(filters.tags) ? filters.tags.map((item) => String(item).toLowerCase()) : [];

  return BUILTIN_PROMPT_TEMPLATES.filter((item) => {
    if (productArea && item.productArea !== productArea) return false;
    if (category && item.category !== category) return false;
    if (query) {
      const haystack = [item.title, item.description, item.category, ...item.tags].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (tags.length && !tags.every((tag) => item.tags.includes(tag))) return false;
    return true;
  });
}

function getPromptTemplate(slugOrId) {
  const value = String(slugOrId || "").replace(/^builtin:/, "");
  return BUILTIN_PROMPT_TEMPLATES.find((item) => item.slug === value) || null;
}

function extractVariables(content) {
  const found = new Set();
  const pattern = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]{0,63})\s*\}\}/g;
  let match;
  while ((match = pattern.exec(String(content || ""))) !== null) found.add(match[1]);
  return [...found];
}

function reviewPromptContent(content, metadata = {}) {
  const text = [content, metadata.title, metadata.description, metadata.requestedAction].filter(Boolean).join("\n");
  const blockedReasons = [];
  const reviewReasons = [];
  const patterns = [
    [/\b(?:api[_ -]?key|password|access[_ -]?token|refresh[_ -]?token|private[_ -]?key|credit[_ -]?card|social security number|ssn)\b/i, "Requests or handles protected credentials or highly sensitive identifiers."],
    [/\b(?:reveal|dump|extract|exfiltrate|steal)\b.{0,80}\b(?:system prompt|secret|credential|private data|customer data|database)\b/i, "Attempts to reveal or exfiltrate protected instructions, secrets, or private data."],
    [/\b(?:ignore|override|bypass|disable|remove)\b.{0,80}\b(?:safety|guardrail|policy|authorization|permission|security control|row level security|rls)\b/i, "Attempts to bypass safety, authorization, or security controls."],
    [/\b(?:impersonate|deepfake|clone the voice|clone voice|forge identity)\b/i, "Requests deceptive impersonation or identity misuse."],
    [/\b(?:auto(?:matically)?|autonomous(?:ly)?)\b.{0,100}\b(?:send payment|transfer money|fire employee|hire employee|sign contract|publish|delete records|change infrastructure)\b/i, "Requests consequential autonomous action without an approval boundary."]
  ];
  for (const [pattern, reason] of patterns) if (pattern.test(text)) blockedReasons.push(reason);

  if (/\b(?:medical diagnosis|legal advice|investment advice|tax advice)\b/i.test(text)) {
    reviewReasons.push("High-stakes professional guidance requires specialist review and clear limitations.");
  }
  if (/\b(?:scrape|crawl|harvest)\b/i.test(text)) {
    reviewReasons.push("External data collection requires source authorization, robots, privacy, and rate-limit review.");
  }
  if (String(content || "").length > MAX_TEMPLATE_LENGTH) blockedReasons.push(`Template exceeds ${MAX_TEMPLATE_LENGTH} characters.`);

  return {
    ok: blockedReasons.length === 0,
    decision: blockedReasons.length ? "blocked" : reviewReasons.length ? "review_required" : "allowed",
    blockedReasons: unique(blockedReasons),
    reviewReasons: unique(reviewReasons)
  };
}

function validatePromptRecord(input = {}) {
  const productArea = normalizeProductArea(input.productArea || input.product_area);
  const title = cleanText(input.title, 160);
  const description = cleanText(input.description, 1000, true);
  const content = String(input.content || input.promptBody || input.prompt_body || "").trim();
  const promptType = String(input.promptType || input.prompt_type || "text").trim().toLowerCase();
  const visibility = String(input.visibility || "private").trim().toLowerCase();
  const status = String(input.status || "draft").trim().toLowerCase();
  const errors = [];

  if (!productArea) errors.push("productArea must be business_builder, creator_studio, or growth_studio.");
  if (!title) errors.push("title is required.");
  if (!content) errors.push("content is required.");
  if (content.length > MAX_TEMPLATE_LENGTH) errors.push(`content must be ${MAX_TEMPLATE_LENGTH} characters or fewer.`);
  if (!PROMPT_TYPES.includes(promptType)) errors.push(`promptType must be one of: ${PROMPT_TYPES.join(", ")}.`);
  if (!VISIBILITIES.includes(visibility)) errors.push(`visibility must be one of: ${VISIBILITIES.join(", ")}.`);
  if (!STATUSES.includes(status)) errors.push(`status must be one of: ${STATUSES.join(", ")}.`);

  const safety = reviewPromptContent(content, { title, description });
  if (!safety.ok) errors.push(...safety.blockedReasons);

  const variables = extractVariables(content);
  const inputSchema = normalizeInputSchema(input.inputSchema || input.input_schema, variables);
  const slug = slugify(input.slug || title);
  if (!slug) errors.push("A valid slug could not be generated.");

  return {
    ok: errors.length === 0,
    errors: unique(errors),
    safety,
    record: {
      productArea,
      title,
      slug,
      description,
      content,
      promptType,
      visibility,
      status: safety.decision === "review_required" && status === "published" ? "review_required" : status,
      inputSchema,
      outputSchema: normalizeObject(input.outputSchema || input.output_schema),
      modelCompatibility: normalizeStringArray(input.modelCompatibility || input.model_compatibility, 12),
      mcpCompatibility: normalizeArray(input.mcpCompatibility || input.mcp_compatibility, 12),
      tags: normalizeStringArray(input.tags, 20),
      sourceType: cleanText(input.sourceType || input.source_type || "user_created", 80),
      sourceRepository: cleanText(input.sourceRepository || input.source_repository, 300, true),
      sourceCommit: cleanText(input.sourceCommit || input.source_commit, 80, true),
      licenseStatus: cleanText(input.licenseStatus || input.license_status || "original_or_authorized", 80),
      provenance: normalizeObject(input.provenance)
    }
  };
}

function renderPrompt(templateOrContent, values = {}, options = {}) {
  const source = typeof templateOrContent === "string"
    ? { content: templateOrContent, requiredVariables: extractVariables(templateOrContent), slug: options.slug || "custom" }
    : templateOrContent || {};
  const content = String(source.content || "");
  const variables = extractVariables(content);
  const protectedVariable = variables.find(isProtectedVariableName);
  if (protectedVariable) return { ok: false, code: "protected_variable_name", variable: protectedVariable };
  const safety = reviewPromptContent(content, source);
  if (!safety.ok) return { ok: false, code: "prompt_blocked", safety };
  if (content.length > MAX_TEMPLATE_LENGTH) return { ok: false, code: "template_too_large" };
  const required = new Set(Array.isArray(source.requiredVariables) ? source.requiredVariables : variables);
  const missing = [];
  const normalizedValues = {};

  for (const variable of variables) {
    if (isProtectedVariableName(variable)) {
      return { ok: false, code: "protected_variable_name", variable };
    }
    const raw = values?.[variable];
    if ((raw === undefined || raw === null || String(raw).trim() === "") && required.has(variable)) {
      missing.push(variable);
      continue;
    }
    const value = raw === undefined || raw === null ? "" : String(raw).trim();
    if (value.length > MAX_VALUE_LENGTH) return { ok: false, code: "value_too_large", variable, maxLength: MAX_VALUE_LENGTH };
    normalizedValues[variable] = value;
  }

  if (missing.length) return { ok: false, code: "missing_variables", missing };
  let rendered = content.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]{0,63})\s*\}\}/g, (_, variable) => normalizedValues[variable] || "");
  if (rendered.length > MAX_RENDERED_LENGTH) return { ok: false, code: "rendered_prompt_too_large", maxLength: MAX_RENDERED_LENGTH };

  const fingerprint = promptFingerprint({
    slug: source.slug || options.slug || "custom",
    content,
    values: normalizedValues,
    version: source.currentVersion || source.current_version || 1
  });

  return {
    ok: true,
    code: "rendered",
    renderedPrompt: rendered,
    values: normalizedValues,
    variables,
    fingerprint,
    safety,
    characterCount: rendered.length
  };
}

function validateConnection(input = {}) {
  const sourceId = cleanText(input.sourceId || input.source_id, 120);
  const targetId = cleanText(input.targetId || input.target_id, 120);
  const label = cleanText(input.label || "next", 80);
  const errors = [];
  if (!sourceId || !targetId) errors.push("sourceId and targetId are required.");
  if (sourceId && sourceId === targetId) errors.push("A prompt cannot connect to itself.");
  return { ok: errors.length === 0, errors, record: { sourceId, targetId, label, order: normalizeInteger(input.order, 0, 999, 0) } };
}

function reviewImportBatch(input = {}) {
  const sourceRepository = cleanText(input.sourceRepository || input.source_repository, 300);
  const sourceCommit = cleanText(input.sourceCommit || input.source_commit, 80);
  const declaredLicense = cleanText(input.declaredLicense || input.declared_license, 80).toUpperCase();
  const recordCount = normalizeInteger(input.recordCount || input.record_count, 0, 100000, 0);
  const sampleRecords = normalizeArray(input.sampleRecords || input.sample_records, 25);
  const errors = [];
  if (!sourceRepository) errors.push("sourceRepository is required.");
  if (!sourceCommit) errors.push("sourceCommit is required.");
  if (!declaredLicense) errors.push("declaredLicense is required.");
  if (!/^(CC0(?:-1\.0)?|MIT)$/.test(declaredLicense)) errors.push("Only reviewed CC0 prompt data or MIT site-authored material may enter this import path.");
  if (recordCount > 10000) errors.push("A single reviewed import batch may not exceed 10,000 records.");

  const sampleFindings = sampleRecords.map((record, index) => ({
    index,
    title: cleanText(record?.title, 160, true),
    review: reviewPromptContent(record?.content || record?.prompt || "", record || {})
  }));
  if (sampleFindings.some((item) => !item.review.ok)) errors.push("One or more sampled records failed safety review.");

  return {
    ok: errors.length === 0,
    decision: errors.length ? "blocked" : "review_required",
    errors: unique(errors),
    recordCount,
    sampleFindings,
    requirements: [
      "founder/admin approval",
      "license evidence",
      "pinned commit",
      "content moderation",
      "deduplication",
      "provenance on every imported template",
      "tenant-safe destination",
      "rollback manifest"
    ]
  };
}

function getPromptLibrarySummary() {
  const byProduct = Object.fromEntries(Object.keys(PRODUCT_LABELS).map((key) => [key, listPromptTemplates({ productArea: key }).length]));
  const categories = [...new Set(BUILTIN_PROMPT_TEMPLATES.map((item) => item.category))].sort();
  return {
    status: "operational_with_database_setup",
    source: PROMPTS_CHAT_REFERENCE,
    tableCount: PROMPT_LIBRARY_TABLES.length,
    tables: PROMPT_LIBRARY_TABLES,
    builtinTemplateCount: BUILTIN_PROMPT_TEMPLATES.length,
    templatesByProduct: byProduct,
    categories,
    productLabels: PRODUCT_LABELS,
    promptTypes: PROMPT_TYPES,
    visibilities: VISIBILITIES,
    statuses: STATUSES,
    limits: {
      maxTemplateLength: MAX_TEMPLATE_LENGTH,
      maxValueLength: MAX_VALUE_LENGTH,
      maxRenderedLength: MAX_RENDERED_LENGTH
    }
  };
}

function normalizeInputSchema(input, variables) {
  const supplied = normalizeObject(input);
  const properties = normalizeObject(supplied.properties);
  for (const variable of variables) {
    if (!properties[variable]) properties[variable] = { type: "string", maxLength: MAX_VALUE_LENGTH };
  }
  return {
    type: "object",
    properties,
    required: Array.isArray(supplied.required) ? supplied.required.filter((item) => variables.includes(item)) : variables
  };
}

function promptFingerprint(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function cleanText(value, maxLength, optional = false) {
  const cleaned = String(value || "").trim();
  if (!cleaned && optional) return null;
  return cleaned.slice(0, maxLength);
}

function normalizeStringArray(value, maxItems) {
  return unique(normalizeArray(value, maxItems).map((item) => String(item || "").trim().slice(0, 160)).filter(Boolean));
}

function normalizeArray(value, maxItems) {
  if (Array.isArray(value)) return value.slice(0, maxItems);
  if (value === undefined || value === null || value === "") return [];
  return [value].slice(0, maxItems);
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function normalizeInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isProtectedVariableName(value) {
  return /(?:password|secret|api_?key|access_?token|refresh_?token|private_?key|card_?number|ssn)/i.test(String(value || ""));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

module.exports = {
  BUILTIN_PROMPT_TEMPLATES,
  MAX_RENDERED_LENGTH,
  MAX_TEMPLATE_LENGTH,
  MAX_VALUE_LENGTH,
  PRODUCT_LABELS,
  PRODUCT_WORKSPACES,
  PROMPT_TYPES,
  STATUSES,
  VISIBILITIES,
  extractVariables,
  getPromptLibrarySummary,
  getPromptTemplate,
  listPromptTemplates,
  normalizeProductArea,
  promptFingerprint,
  renderPrompt,
  reviewImportBatch,
  reviewPromptContent,
  validateConnection,
  validatePromptRecord
};
