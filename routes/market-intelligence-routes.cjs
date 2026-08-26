"use strict";

const {
  getMarketIntelligenceFramework,
  scoreMarketOpportunity,
  recommendMarketAction
} = require("../lib/sonara-market-intelligence-registry.cjs");

const TABLES = Object.freeze({
  segments: "market_intelligence_segments",
  competitors: "market_intelligence_competitors",
  signals: "market_intelligence_signals",
  opportunities: "market_intelligence_opportunities",
  reviews: "market_intelligence_reviews",
  events: "market_intelligence_events"
});

const STUDIO_KEYS = new Set(["sonara_industries", "business_builder", "creator_studio", "growth_studio"]);
const SIGNAL_TYPES = new Set(["market_size", "customer_need", "pricing", "competitor", "technology", "regulation", "channel", "behavior", "risk"]);
const CONFIDENCE_LEVELS = new Set(["low", "medium", "high", "authoritative"]);
const OPPORTUNITY_STATES = new Set(["watch", "validate", "prioritized", "building", "launched", "hold", "rejected"]);
const REVIEW_DECISIONS = new Set(["prioritize", "validate", "watch", "hold", "reject"]);

const crawl4ai = require("../lib/sonara-crawl4ai-adapter.cjs");

module.exports = function registerMarketIntelligenceRoutes(app, deps = {}) {
  const requireCustomer = deps.requireCustomer || passthrough;
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => requireCustomer;
  const ui = buildUi(deps);

  app.get("/api/market-intelligence/framework", requireCustomer, (req, res) => {
    return res.status(200).json({ ok: true, framework: getMarketIntelligenceFramework() });
  });

  app.get("/api/market-intelligence/portfolio", requireCustomer, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const studio = validStudio(req.query.studio) ? String(req.query.studio) : null;
    const extra = studio ? `&studio_key=eq.${encodeURIComponent(studio)}` : "";
    const limit = clamp(req.query.limit, 1, 250, 100);
    const [segments, competitors, signals, opportunities, reviews] = await Promise.all([
      list(config, TABLES.segments, context, limit, extra),
      list(config, TABLES.competitors, context, limit, extra),
      list(config, TABLES.signals, context, limit, extra),
      list(config, TABLES.opportunities, context, limit, extra),
      list(config, TABLES.reviews, context, limit)
    ]);
    const failed = [segments, competitors, signals, opportunities, reviews].find((result) => !result.ok);
    if (failed) return res.status(502).json({ ok: false, code: failed.code || "market_portfolio_load_failed" });
    return res.status(200).json({
      ok: true,
      studio,
      framework: getMarketIntelligenceFramework(),
      segments: segments.rows,
      competitors: competitors.rows,
      signals: signals.rows,
      opportunities: opportunities.rows,
      reviews: reviews.rows,
      summary: summarizePortfolio({ segments: segments.rows, competitors: competitors.rows, signals: signals.rows, opportunities: opportunities.rows })
    });
  });

  app.get("/api/market-intelligence/segments", requireCustomer, listHandler(TABLES.segments, deps, "segments"));
  app.post("/api/market-intelligence/segments", requireCustomer, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const studioKey = normalizeStudio(req.body.studio_key || req.body.studioKey);
    const segmentKey = slug(req.body.segment_key || req.body.segmentKey, 120);
    const name = clean(req.body.name, 240);
    if (!studioKey || !segmentKey || !name) return res.status(400).json({ ok: false, code: "studio_segment_key_and_name_required" });
    const created = await insert(config, TABLES.segments, {
      organization_id: context.organizationId,
      user_id: context.userId,
      studio_key: studioKey,
      segment_key: segmentKey,
      name,
      description: nullable(req.body.description, 2000),
      customer_type: nullable(req.body.customer_type || req.body.customerType, 240),
      geography: nullable(req.body.geography, 240),
      jobs_to_be_done: parseArray(req.body.jobs_to_be_done || req.body.jobsToBeDone),
      pain_points: parseArray(req.body.pain_points || req.body.painPoints),
      buying_triggers: parseArray(req.body.buying_triggers || req.body.buyingTriggers),
      constraints: parseArray(req.body.constraints),
      status: oneOf(req.body.status, ["active", "watch", "archived"], "active")
    });
    if (created.ok) await recordEvent(config, context, "segment.created", { segment_id: created.rows[0]?.id, studio_key: studioKey, segment_key: segmentKey });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, segment: created.rows[0], code: created.code });
  });

  app.get("/api/market-intelligence/competitors", requireCustomer, listHandler(TABLES.competitors, deps, "competitors"));
  app.post("/api/market-intelligence/competitors", requireCustomer, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const studioKey = normalizeStudio(req.body.studio_key || req.body.studioKey);
    const name = clean(req.body.name, 240);
    const sourceUrl = safeHttpsUrl(req.body.source_url || req.body.sourceUrl);
    const verifiedAt = validDate(req.body.verified_at || req.body.verifiedAt);
    if (!studioKey || !name || !sourceUrl || !verifiedAt) return res.status(400).json({ ok: false, code: "studio_name_source_and_verified_at_required" });
    const created = await insert(config, TABLES.competitors, {
      organization_id: context.organizationId,
      user_id: context.userId,
      studio_key: studioKey,
      name,
      category: nullable(req.body.category, 240),
      source_url: sourceUrl,
      verified_at: verifiedAt,
      entry_price: nonNegativeNumber(req.body.entry_price || req.body.entryPrice),
      currency: clean(req.body.currency || "USD", 12).toUpperCase(),
      billing_period: oneOf(req.body.billing_period || req.body.billingPeriod, ["free", "monthly", "annual", "usage", "percentage", "custom", "mixed"], "custom"),
      pricing_model: nullable(req.body.pricing_model || req.body.pricingModel, 500),
      capabilities: parseArray(req.body.capabilities),
      strengths: parseArray(req.body.strengths),
      weaknesses: parseArray(req.body.weaknesses),
      notes: nullable(req.body.notes, 3000),
      status: oneOf(req.body.status, ["active", "watch", "archived"], "active")
    });
    if (created.ok) await recordEvent(config, context, "competitor.recorded", { competitor_id: created.rows[0]?.id, studio_key: studioKey, name, verified_at: verifiedAt });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, competitor: created.rows[0], code: created.code });
  });

  // Fetch a source page instead of copying and pasting it.
  //
  // The first thing in this product that calls one of the six service adapters
  // to do work rather than to report whether it is configured. Every market
  // intelligence surface depended on somebody having the page open in another
  // tab; this is the difference between "record what you found" and "go and
  // look".
  //
  // **It fetches and it stops.** The text comes back for the owner to read, and
  // nothing is written. It does not draft a summary, pick a signal type, or
  // guess a confidence level -- a signal is evidence somebody has judged, and a
  // summary this server invented would enter the record indistinguishable from
  // one an owner wrote. The manual path is untouched and remains the only way a
  // signal is created.
  //
  // Crawl4AI refuses loopback, link-local, cloud-metadata and private addresses
  // before this server makes the request, because a URL somebody supplies plus a
  // server that fetches it is a request forwarder otherwise.
  app.post("/api/market-intelligence/fetch-source", requireCustomer, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);

    const target = safeHttpsUrl(req.body.source_url || req.body.sourceUrl);
    if (!target) return res.status(400).json({ ok: false, code: "https_source_url_required" });

    // The permission gate, consulted before anything is fetched.
    //
    // research_sources has carried `permission_status` since the platform
    // redesign and nothing read it. A column named for a decision, defaulting to
    // 'needs_review', with no code anywhere consulting it, is a gate somebody
    // designed and nobody built -- and this endpoint was the thing it was for.
    const permission = await sourcePermission(getConfig(deps), context, target);
    if (permission.decision !== "approved") {
      return res.status(200).json({ ok: true, fetched: false, code: permission.code, detail: permission.detail });
    }

    const readiness = crawl4ai.getCrawl4aiReadiness();
    if (readiness.status !== "configured") {
      // Not an error. The page works without this and always did.
      return res.status(200).json({
        ok: true,
        fetched: false,
        code: readiness.status,
        detail: `${readiness.detail} Paste the text yourself and the signal form works exactly as before.`
      });
    }

    const page = await crawl4ai.fetchPage(target, { readiness });
    if (!page.ok) {
      return res.status(200).json({
        ok: true,
        fetched: false,
        code: page.code,
        detail: `${page.detail} Paste the text yourself instead.`
      });
    }

    // Bounded again here. The adapter caps at 200k for its own reasons; a
    // response a person is going to read through a form field is a different
    // limit, and the caller is told it was cut rather than left to wonder.
    const LIMIT = 20000;
    const text = page.text.length > LIMIT ? page.text.slice(0, LIMIT) : page.text;

    return res.status(200).json({
      ok: true,
      fetched: true,
      sourceUrl: page.url,
      truncated: page.text.length > LIMIT,
      characters: text.length,
      text,
      // Said in the response rather than only in a comment, because the next
      // caller reads this shape and not this file.
      note: "This is the page text, not a signal. Read it, decide what it shows, and write the summary yourself."
    });
  });

  app.get("/api/market-intelligence/signals", requireCustomer, listHandler(TABLES.signals, deps, "signals"));
  app.post("/api/market-intelligence/signals", requireCustomer, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const studioKey = normalizeStudio(req.body.studio_key || req.body.studioKey);
    const signalType = oneOf(req.body.signal_type || req.body.signalType, [...SIGNAL_TYPES], null);
    const title = clean(req.body.title, 300);
    const summary = clean(req.body.summary, 4000);
    const sourceName = clean(req.body.source_name || req.body.sourceName, 300);
    const sourceUrl = safeHttpsUrl(req.body.source_url || req.body.sourceUrl);
    const observedAt = validDate(req.body.observed_at || req.body.observedAt);
    const confidence = oneOf(req.body.confidence, [...CONFIDENCE_LEVELS], null);
    if (!studioKey || !signalType || !title || !summary || !sourceName || !sourceUrl || !observedAt || !confidence) {
      return res.status(400).json({ ok: false, code: "complete_evidence_backed_signal_required" });
    }
    const created = await insert(config, TABLES.signals, {
      organization_id: context.organizationId,
      user_id: context.userId,
      studio_key: studioKey,
      signal_type: signalType,
      title,
      summary,
      source_name: sourceName,
      source_url: sourceUrl,
      observed_at: observedAt,
      expires_at: validDate(req.body.expires_at || req.body.expiresAt),
      confidence,
      metric_name: nullable(req.body.metric_name || req.body.metricName, 240),
      metric_value: finiteNumberOrNull(req.body.metric_value || req.body.metricValue),
      metric_unit: nullable(req.body.metric_unit || req.body.metricUnit, 80),
      geography: nullable(req.body.geography, 240),
      segment_key: nullable(req.body.segment_key || req.body.segmentKey, 120),
      metadata: parseObject(req.body.metadata, {})
    });
    if (created.ok) await recordEvent(config, context, "signal.recorded", { signal_id: created.rows[0]?.id, studio_key: studioKey, signal_type: signalType, observed_at: observedAt });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, signal: created.rows[0], code: created.code });
  });

  app.get("/api/market-intelligence/opportunities", requireCustomer, listHandler(TABLES.opportunities, deps, "opportunities"));
  app.post("/api/market-intelligence/opportunities", requireCustomer, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const studioKey = normalizeStudio(req.body.studio_key || req.body.studioKey);
    const name = clean(req.body.name, 300);
    const problem = clean(req.body.problem, 4000);
    const targetSegment = clean(req.body.target_segment || req.body.targetSegment, 500);
    const proposedValue = clean(req.body.proposed_value || req.body.proposedValue, 4000);
    if (!studioKey || !name || !problem || !targetSegment || !proposedValue) return res.status(400).json({ ok: false, code: "complete_market_opportunity_required" });
    const scores = scoreFields(req.body);
    const marketScore = scoreMarketOpportunity(scores);
    const recommendation = recommendMarketAction(marketScore);
    const created = await insert(config, TABLES.opportunities, {
      organization_id: context.organizationId,
      user_id: context.userId,
      product_lifecycle_initiative_id: validUuid(req.body.product_lifecycle_initiative_id || req.body.productLifecycleInitiativeId) ? String(req.body.product_lifecycle_initiative_id || req.body.productLifecycleInitiativeId) : null,
      studio_key: studioKey,
      name,
      problem,
      target_segment: targetSegment,
      proposed_value: proposedValue,
      demand_evidence: scores.demandEvidence,
      willingness_to_pay: scores.willingnessToPay,
      strategic_fit: scores.strategicFit,
      underserved_need: scores.underservedNeed,
      differentiation: scores.differentiation,
      channel_access: scores.channelAccess,
      delivery_complexity: scores.deliveryComplexity,
      compliance_risk: scores.complianceRisk,
      market_score: marketScore,
      recommendation,
      state: OPPORTUNITY_STATES.has(String(req.body.state || "")) ? String(req.body.state) : recommendation === "prioritize" ? "prioritized" : recommendation,
      owner_name: nullable(req.body.owner_name || req.body.ownerName, 240),
      next_review_at: validDate(req.body.next_review_at || req.body.nextReviewAt),
      metadata: parseObject(req.body.metadata, {})
    });
    if (created.ok) await recordEvent(config, context, "opportunity.created", { opportunity_id: created.rows[0]?.id, studio_key: studioKey, market_score: marketScore, recommendation });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, opportunity: created.rows[0], code: created.code });
  });

  app.get("/api/market-intelligence/opportunities/:opportunityId", requireCustomer, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    if (!validUuid(req.params.opportunityId)) return res.status(400).json({ ok: false, code: "invalid_opportunity_id" });
    const config = getConfig(deps);
    const opportunity = await loadOne(config, TABLES.opportunities, context, req.params.opportunityId);
    if (!opportunity.ok) return res.status(opportunity.status).json(opportunity);
    const reviews = await rest(config, TABLES.reviews, `select=*&organization_id=eq.${encodeURIComponent(context.organizationId)}&opportunity_id=eq.${encodeURIComponent(req.params.opportunityId)}&order=created_at.desc&limit=100`);
    return res.status(reviews.ok ? 200 : 502).json({ ok: reviews.ok, opportunity: opportunity.row, reviews: reviews.rows, code: reviews.code });
  });

  app.patch("/api/market-intelligence/opportunities/:opportunityId", requireCustomer, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    if (!validUuid(req.params.opportunityId)) return res.status(400).json({ ok: false, code: "invalid_opportunity_id" });
    const config = getConfig(deps);
    const loaded = await loadOne(config, TABLES.opportunities, context, req.params.opportunityId);
    if (!loaded.ok) return res.status(loaded.status).json(loaded);
    const mergedScores = scoreFields({ ...loaded.row, ...req.body });
    const marketScore = scoreMarketOpportunity(mergedScores);
    const recommendation = recommendMarketAction(marketScore);
    const patch = compact({
      product_lifecycle_initiative_id: req.body.product_lifecycle_initiative_id === undefined && req.body.productLifecycleInitiativeId === undefined ? undefined : validUuid(req.body.product_lifecycle_initiative_id || req.body.productLifecycleInitiativeId) ? String(req.body.product_lifecycle_initiative_id || req.body.productLifecycleInitiativeId) : null,
      name: req.body.name === undefined ? undefined : clean(req.body.name, 300),
      problem: req.body.problem === undefined ? undefined : clean(req.body.problem, 4000),
      target_segment: req.body.target_segment === undefined && req.body.targetSegment === undefined ? undefined : clean(req.body.target_segment || req.body.targetSegment, 500),
      proposed_value: req.body.proposed_value === undefined && req.body.proposedValue === undefined ? undefined : clean(req.body.proposed_value || req.body.proposedValue, 4000),
      demand_evidence: mergedScores.demandEvidence,
      willingness_to_pay: mergedScores.willingnessToPay,
      strategic_fit: mergedScores.strategicFit,
      underserved_need: mergedScores.underservedNeed,
      differentiation: mergedScores.differentiation,
      channel_access: mergedScores.channelAccess,
      delivery_complexity: mergedScores.deliveryComplexity,
      compliance_risk: mergedScores.complianceRisk,
      market_score: marketScore,
      recommendation,
      state: req.body.state === undefined ? undefined : OPPORTUNITY_STATES.has(String(req.body.state)) ? String(req.body.state) : undefined,
      owner_name: req.body.owner_name === undefined && req.body.ownerName === undefined ? undefined : nullable(req.body.owner_name || req.body.ownerName, 240),
      next_review_at: req.body.next_review_at === undefined && req.body.nextReviewAt === undefined ? undefined : validDate(req.body.next_review_at || req.body.nextReviewAt),
      metadata: req.body.metadata === undefined ? undefined : parseObject(req.body.metadata, {}),
      updated_at: new Date().toISOString()
    });
    const updated = await patchRows(config, TABLES.opportunities, context, req.params.opportunityId, patch);
    if (updated.ok) await recordEvent(config, context, "opportunity.updated", { opportunity_id: req.params.opportunityId, market_score: marketScore, recommendation, fields: Object.keys(patch) });
    return res.status(updated.ok ? 200 : 502).json({ ok: updated.ok, opportunity: updated.rows[0], code: updated.code });
  });

  app.post("/api/market-intelligence/opportunities/:opportunityId/reviews", requireCustomer, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    if (!validUuid(req.params.opportunityId)) return res.status(400).json({ ok: false, code: "invalid_opportunity_id" });
    const decision = oneOf(req.body.decision, [...REVIEW_DECISIONS], null);
    const rationale = clean(req.body.rationale, 4000);
    if (!decision || !rationale) return res.status(400).json({ ok: false, code: "decision_and_rationale_required" });
    const config = getConfig(deps);
    const loaded = await loadOne(config, TABLES.opportunities, context, req.params.opportunityId);
    if (!loaded.ok) return res.status(loaded.status).json(loaded);
    const created = await insert(config, TABLES.reviews, {
      organization_id: context.organizationId,
      user_id: context.userId,
      opportunity_id: req.params.opportunityId,
      decision,
      rationale,
      market_score: loaded.row.market_score,
      evidence_snapshot: parseObject(req.body.evidence_snapshot || req.body.evidenceSnapshot, {
        source_count: Number(req.body.source_count || req.body.sourceCount || 0),
        customer_evidence_count: Number(req.body.customer_evidence_count || req.body.customerEvidenceCount || 0),
        pricing_evidence_count: Number(req.body.pricing_evidence_count || req.body.pricingEvidenceCount || 0)
      })
    });
    if (created.ok) {
      const nextState = decision === "prioritize" ? "prioritized" : decision === "reject" ? "rejected" : decision;
      await patchRows(config, TABLES.opportunities, context, req.params.opportunityId, { state: nextState, updated_at: new Date().toISOString() });
      await recordEvent(config, context, "opportunity.reviewed", { opportunity_id: req.params.opportunityId, review_id: created.rows[0]?.id, decision, market_score: loaded.row.market_score });
    }
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, review: created.rows[0], code: created.code });
  });

  registerWorkspacePage(app, "/market-intelligence", requireCustomer, "SONARA Industries", null, ui, deps);
  registerWorkspacePage(app, "/business-builder/market-intelligence", requireWorkspaceAccess("business_builder"), "Business Builder", "business_builder", ui, deps);
  registerWorkspacePage(app, "/creator-studio/market-intelligence", requireWorkspaceAccess("creator_studio"), "Creator Studio", "creator_studio", ui, deps);
  registerWorkspacePage(app, "/growth-studio/market-intelligence", requireWorkspaceAccess("growth_studio"), "Growth Studio", "growth_studio", ui, deps);
};

// What the customer has actually recorded, alongside the guidance.
//
// This page said "The workspace starts empty until organization-scoped evidence
// is recorded", which tells somebody that recording evidence changes what they
// see. It did not: the handler was synchronous, read nothing, and rendered the
// same static framework cards whether the organization had one competitor
// recorded or four hundred. Four endpoints accept POSTs -- segments,
// competitors, signals, opportunities -- and no page displayed any of them, so a
// record written through the API was invisible from that moment on.
//
// Counts rather than rows: this is a summary page beside guidance, and the API
// already lists the rows themselves. What matters is that the number is real.
const RECORDED_EVIDENCE = Object.freeze([
  ["segments", "Customer segments"],
  ["competitors", "Competitors"],
  ["signals", "Market signals"],
  ["opportunities", "Opportunities"]
]);

async function recordedEvidence(config, organizationId) {
  return Promise.all(RECORDED_EVIDENCE.map(async ([key, label]) => {
    const table = TABLES[key];
    const listed = await rest(config, table, `select=id&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1000`).catch(() => undefined);
    // `listed.ok ? rows.length : 0` would report a failed read as "none
    // recorded", on a page whose whole subject is not turning estimates into
    // facts. null travels instead, and the card says which it is.
    return { label, count: listed?.ok && Array.isArray(listed.rows) ? listed.rows.length : null };
  }));
}

function registerWorkspacePage(app, path, access, label, studioKey, ui, deps = {}) {
  app.get(path, access, async (req, res) => {
    const framework = getMarketIntelligenceFramework();
    const market = studioKey ? framework.markets[studioKey] : null;
    const sections = market
      ? [
          ui.card("Market", `${market.name}. ${market.primaryAudience}`),
          ui.card("What to prioritize", market.priorities.join(" ")),
          ui.card("What to avoid", market.avoid.join(" ")),
          ui.card("Evidence rules", framework.evidenceRules.join(" "))
        ]
      : [
          ui.card("Portfolio thesis", framework.portfolioThesis.join(" ")),
          ui.card("Pricing position", framework.pricingPosition.conclusion),
          ui.card("Evidence-led decisions", "Score demand, willingness to pay, strategic fit, underserved need, differentiation, channel access, delivery complexity, and compliance risk before work advances."),
          ui.card("No invented market data", "Everything below the guidance is your own recorded evidence, and nothing else. Static research guidance is labeled by source and date.")
        ];

    // The customer's own evidence, appended to whichever set of guidance cards
    // was chosen above.
    const config = getConfig(deps);
    const context = await resolveContext(req, deps).catch(() => ({ ok: false }));
    if (!config.ok || !context.ok) {
      sections.push(ui.card(
        "Your recorded evidence",
        "We could not read your workspace just now, so this does not say how much evidence you have recorded. Nothing has changed."
      ));
    } else {
      const counted = await recordedEvidence(config, context.organizationId);
      const unreadable = counted.filter((entry) => entry.count === null).map((entry) => entry.label);
      const readable = counted.filter((entry) => entry.count !== null);
      sections.push(ui.card(
        "Your recorded evidence",
        readable.length
          ? readable.map((entry) => `${entry.label}: ${entry.count}`).join(". ") + "."
          : "Nothing could be read just now."
      ));
      // Named rather than folded into a zero. A record type that could not be
      // read is not a record type with nothing in it.
      if (unreadable.length) {
        sections.push(ui.card(
          "Not counted just now",
          `${unreadable.join(", ")} could not be read, so they are left out of the figures above rather than counted as none.`
        ));
      }
    }

    return res.status(200).type("html").send(ui.layout({
      title: `${label} Market Intelligence`,
      eyebrow: "Evidence-led market strategy",
      heading: `${label} market intelligence`,
      body: "Track customer segments, competitor evidence, pricing, market signals, scored opportunities, and portfolio decisions without turning estimates into facts.",
      sections,
      actions: [
        ui.link("/product-lifecycle", "Roadmap"),
        ui.link("/service-catalog", "Service catalog"),
        ui.link(studioKey ? `/${studioKey.replaceAll("_", "-")}/dashboard` : "/", studioKey ? `${label} dashboard` : "SONARA home")
      ]
    }));
  });
}

function listHandler(table, deps, key) {
  return async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const studio = validStudio(req.query.studio) ? String(req.query.studio) : null;
    const extra = studio ? `&studio_key=eq.${encodeURIComponent(studio)}` : "";
    const result = await list(config, table, context, clamp(req.query.limit, 1, 500, 100), extra);
    return res.status(result.ok ? 200 : 502).json({ ok: result.ok, [key]: result.rows, code: result.code });
  };
}

async function resolveContext(req, deps) {
  const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || null;
  if (!user?.id) return { ok: false, status: 401, code: "market_intelligence_auth_required" };
  if (typeof deps.getCustomerPrimaryOrganization !== "function") return { ok: false, status: 503, code: "organization_resolver_unavailable" };
  const organization = await deps.getCustomerPrimaryOrganization(user);
  if (!organization?.ok) return { ok: false, status: 409, code: organization?.code || "organization_setup_required" };
  return { ok: true, organizationId: organization.organizationId, userId: user.id };
}

function getConfig(deps) {
  if (typeof deps.getSupabaseServerConfig === "function") return deps.getSupabaseServerConfig();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { ok: true, url: String(url).replace(/\/$/, ""), serviceRoleKey } : { ok: false };
}

async function rest(config, table, query = "", options = {}) {
  if (!config?.ok && (!config?.url || !config?.serviceRoleKey)) return { ok: false, status: 503, code: "supabase_setup_required", rows: [] };
  const response = await fetch(`${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method: options.method || "GET",
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json", ...(options.prefer ? { Prefer: options.prefer } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  }).catch(() => undefined);
  if (!response) return { ok: false, status: 503, code: "database_unreachable", rows: [] };
  const rows = response.status === 204 ? [] : await response.json().catch(() => []);
  return { ok: response.ok, status: response.status, code: response.ok ? "ok" : "database_operation_failed", rows: Array.isArray(rows) ? rows : [] };
}

function insert(config, table, body) { return rest(config, table, "", { method: "POST", prefer: "return=representation", body }); }
function list(config, table, context, limit = 100, extra = "") { return rest(config, table, `select=*&organization_id=eq.${encodeURIComponent(context.organizationId)}${extra}&order=created_at.desc&limit=${limit}`); }
function patchRows(config, table, context, id, body) { return rest(config, table, `id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(context.organizationId)}`, { method: "PATCH", prefer: "return=representation", body }); }
async function loadOne(config, table, context, id) {
  const result = await rest(config, table, `select=*&id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(context.organizationId)}&limit=1`);
  if (!result.ok) return { ok: false, status: 502, code: result.code };
  if (!result.rows[0]) return { ok: false, status: 404, code: "resource_not_found" };
  return { ok: true, row: result.rows[0] };
}
async function recordEvent(config, context, eventType, details) {
  return insert(config, TABLES.events, { organization_id: context.organizationId, user_id: context.userId, event_type: eventType, details: parseObject(details, {}) });
}

// Whether this business has established it may research the host of a URL.
//
// Three outcomes, and collapsing any two of them would be the defect this
// codebase keeps producing -- a signal that reports success without being true:
//
//   approved     A research_sources row for this organization names this host
//                and its permission_status is 'approved'.
//   not_approved The read succeeded and no such row exists. Something the
//                customer fixes on a page, by recording the source and marking
//                it approved.
//   unreadable   Nobody knows. Supabase is not configured, the read failed, or
//                the answer could have been past the row limit. It refuses like
//                the other two -- fetching on an unknown answer is the same as
//                having no gate -- but it says the check failed rather than
//                telling somebody to approve a source they already approved.
//
// Host, not URL. An approved row covers the whole site, because a customer who
// has established they may look at a competitor's pricing page has established
// the same about its features page, and asking them to record every path would
// mean nobody uses this. Exact host though: blog.example.com is not
// example.com, and github.io and vercel.app hand subdomains out per user, so
// treating a parent domain as covering its children would approve strangers.
const APPROVED_SOURCE_LIMIT = 1000;

async function sourcePermission(config, context, target) {
  const host = hostOf(target);
  if (!host) return { decision: "unreadable", code: "source_host_unreadable", detail: "We could not read a site address out of that URL, so nothing was fetched." };
  if (!config?.ok) {
    return {
      decision: "unreadable",
      code: "source_permission_unreadable",
      detail: `Your account database is not connected, so we could not check whether ${host} is a source you have approved. Nothing was fetched. Paste the text yourself instead.`
    };
  }

  // Narrowed to approved rows in the query and asserted again below. The filter
  // is how few rows travel; the comparison is the rule, and it lives here where
  // a test can hand this function a 'needs_review' row and watch it refuse.
  const listed = await rest(config, "research_sources", `select=source_url,permission_status&organization_id=eq.${encodeURIComponent(context.organizationId)}&permission_status=eq.approved&limit=${APPROVED_SOURCE_LIMIT}`);
  if (!listed.ok) {
    return {
      decision: "unreadable",
      code: "source_permission_unreadable",
      detail: `We could not check whether ${host} is a source you have approved, so nothing was fetched. This does not mean you have not approved it. Try again, or paste the text yourself instead.`
    };
  }

  if (listed.rows.some((row) => String(row?.permission_status || "") === "approved" && hostOf(row?.source_url) === host)) {
    return { decision: "approved", code: "source_approved", detail: `${host} is a source you have approved.` };
  }

  // A full page of approved rows means the match could have been on the next
  // one. "Not approved" would be a guess, and the whole point of this function
  // is that it does not guess.
  if (listed.rows.length >= APPROVED_SOURCE_LIMIT) {
    return {
      decision: "unreadable",
      code: "source_permission_list_truncated",
      detail: `You have more approved sources than we read in one go, so we could not tell whether ${host} is among them. Nothing was fetched.`
    };
  }

  return {
    decision: "not_approved",
    code: "source_not_approved",
    detail: `You have not approved ${host} as a source you may research, so nothing was fetched. Record it under "Sources you may research" and mark it approved once you have established you may look at it. Until then, paste the text yourself instead.`
  };
}

// Accepts http as well as https, because a stored row identifies a site rather
// than naming the request this server will make -- the URL being fetched is
// already https, checked by safeHttpsUrl before this is called.
function hostOf(value) {
  const text = clean(value, 2000);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return host || null;
  } catch {
    return null;
  }
}

function scoreFields(input = {}) {
  return {
    demandEvidence: boundedInteger(read(input, "demandEvidence", "demand_evidence"), 0, 25),
    willingnessToPay: boundedInteger(read(input, "willingnessToPay", "willingness_to_pay"), 0, 20),
    strategicFit: boundedInteger(read(input, "strategicFit", "strategic_fit"), 0, 20),
    underservedNeed: boundedInteger(read(input, "underservedNeed", "underserved_need"), 0, 15),
    differentiation: boundedInteger(read(input, "differentiation"), 0, 10),
    channelAccess: boundedInteger(read(input, "channelAccess", "channel_access"), 0, 10),
    deliveryComplexity: boundedInteger(read(input, "deliveryComplexity", "delivery_complexity"), 0, 15),
    complianceRisk: boundedInteger(read(input, "complianceRisk", "compliance_risk"), 0, 15)
  };
}

function summarizePortfolio(data) {
  const currentSignals = data.signals.filter((signal) => !signal.expires_at || Date.parse(signal.expires_at) > Date.now()).length;
  const prioritized = data.opportunities.filter((opportunity) => opportunity.state === "prioritized").length;
  const validating = data.opportunities.filter((opportunity) => opportunity.state === "validate").length;
  return { segmentCount: data.segments.length, competitorCount: data.competitors.length, signalCount: data.signals.length, currentSignalCount: currentSignals, opportunityCount: data.opportunities.length, prioritizedCount: prioritized, validatingCount: validating };
}

function buildUi(deps) {
  return { layout: deps.layout || basicLayout, card: deps.brandCard || card, link: deps.linkAction || link, escape: deps.escapeHtml || escapeHtml };
}
function basicLayout(data) { return `<!doctype html><html><head><title>${escapeHtml(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${escapeHtml(data.eyebrow)}</p><h1>${escapeHtml(data.heading)}</h1><p>${escapeHtml(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
function card(title, body) { return `<article class="card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`; }
function escapeHtml(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function passthrough(req, res, next) { next(); }
function clean(value, max = 500) { return String(value || "").trim().slice(0, max); }
function nullable(value, max = 500) { const text = clean(value, max); return text || null; }
function slug(value, max = 120) { return clean(value, max).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function validStudio(value) { return STUDIO_KEYS.has(String(value || "")); }
function normalizeStudio(value) { const key = String(value || ""); return validStudio(key) ? key : null; }
function oneOf(value, allowed, fallback) { const text = String(value || ""); return allowed.includes(text) ? text : fallback; }
function parseArray(value) { if (Array.isArray(value)) return value.slice(0, 100).map((item) => clean(item, 1000)).filter(Boolean); if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parseArray(parsed) : value.split("\n").map((item) => clean(item, 1000)).filter(Boolean); } catch { return value.split("\n").map((item) => clean(item, 1000)).filter(Boolean); } } return []; }
function parseObject(value, fallback = {}) { if (value && typeof value === "object" && !Array.isArray(value)) return value; if (typeof value === "string") { try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } } return fallback; }
function safeHttpsUrl(value) { const text = clean(value, 2000); if (!text) return null; try { const url = new URL(text); return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null; } catch { return null; } }
function validDate(value) { if (!value) return null; const timestamp = Date.parse(String(value)); return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null; }
function validUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }
function nonNegativeNumber(value) { const numeric = Number(value); return Number.isFinite(numeric) && numeric >= 0 ? numeric : null; }
function finiteNumberOrNull(value) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : null; }
function boundedInteger(value, min, max) { const numeric = Number(value); if (!Number.isFinite(numeric)) return min; return Math.max(min, Math.min(max, Math.round(numeric))); }
function read(input, camel, snake) { if (input[camel] !== undefined) return input[camel]; if (snake && input[snake] !== undefined) return input[snake]; return 0; }
function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)); }
function clamp(value, min, max, fallback) { const numeric = Number(value); return Number.isFinite(numeric) ? Math.max(min, Math.min(max, Math.round(numeric))) : fallback; }

// Exported so the permission rule can be tested directly rather than only
// through the endpoint. Testing it only through the endpoint would mean the
// only reachable branch in a test run without Supabase is "not configured",
// and the distinction between needs_review, declined and a failed read -- the
// entire reason this function exists -- would go unchecked.
module.exports.sourcePermission = sourcePermission;
module.exports.hostOf = hostOf;
