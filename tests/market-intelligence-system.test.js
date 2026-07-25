"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");
const {
  getMarketIntelligenceFramework,
  scoreMarketOpportunity,
  recommendMarketAction
} = require("../lib/sonara-market-intelligence-registry.cjs");

const root = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("SONARA market intelligence", () => {
  it("defines a differentiated strategy for all three companies", function() {
    const framework = getMarketIntelligenceFramework();
    assert.equal(framework.asOf, "2026-07-25");
    assert.deepEqual(Object.keys(framework.markets), ["business_builder", "creator_studio", "growth_studio"]);
    assert.match(framework.positioning, /affordable/i);
    assert.match(framework.portfolioThesis.join(" "), /first offer to first transaction/i);
    assert.match(framework.markets.business_builder.priorities.join(" "), /First-transaction workflow/i);
    assert.match(framework.markets.creator_studio.priorities.join(" "), /Rights, consent, provenance/i);
    assert.match(framework.markets.growth_studio.priorities.join(" "), /consent ledger/i);
    assert.deepEqual(framework.pricingPosition.currentPlans, ["Free $0", "Starter $7/month", "Core $19/month", "Pro $39/month", "Business Builder one-time setup"]);
    assert.ok(framework.sources.length >= 10);
    for (const source of framework.sources) {
      assert.match(source.url, /^https:\/\//);
      assert.match(source.observedAt, /^202[5-6]-\d{2}-\d{2}$/);
    }
  });

  it("scores opportunities transparently and applies risk penalties", function() {
    const priorityScore = scoreMarketOpportunity({
      demandEvidence: 25,
      willingnessToPay: 20,
      strategicFit: 20,
      underservedNeed: 15,
      differentiation: 10,
      channelAccess: 10,
      deliveryComplexity: 5,
      complianceRisk: 5
    });
    assert.equal(priorityScore, 90);
    assert.equal(recommendMarketAction(priorityScore), "prioritize");

    const validationScore = scoreMarketOpportunity({
      demand_evidence: 15,
      willingness_to_pay: 12,
      strategic_fit: 14,
      underserved_need: 10,
      differentiation: 7,
      channel_access: 7,
      delivery_complexity: 5,
      compliance_risk: 3
    });
    assert.equal(validationScore, 57);
    assert.equal(recommendMarketAction(validationScore), "validate");
    assert.equal(scoreMarketOpportunity({ demandEvidence: 999, complianceRisk: 999 }), 10);
    assert.equal(recommendMarketAction(-5), "hold");
  });

  it("keeps every market workspace and API behind customer access", async function() {
    for (const route of [
      "/api/market-intelligence/framework",
      "/api/market-intelligence/portfolio",
      "/api/market-intelligence/segments",
      "/api/market-intelligence/competitors",
      "/api/market-intelligence/signals",
      "/api/market-intelligence/opportunities"
    ]) {
      const response = await request(app).get(route).set("Accept", "application/json");
      assert.ok([401, 503].includes(response.status), `${route} must require customer authentication or report protected setup-required state`);
    }

    for (const route of [
      "/market-intelligence",
      "/business-builder/market-intelligence",
      "/creator-studio/market-intelligence",
      "/growth-studio/market-intelligence"
    ]) {
      const response = await request(app).get(route).set("Accept", "text/html");
      assert.ok([302, 303, 401, 402, 403, 503].includes(response.status), `${route} must remain protected`);
    }
  });

  it("requires source-dated evidence and organization-scoped server writes", function() {
    const migration = read("supabase/migrations/20260725120000_market_intelligence_system.sql");
    for (const table of [
      "market_intelligence_segments",
      "market_intelligence_competitors",
      "market_intelligence_signals",
      "market_intelligence_opportunities",
      "market_intelligence_reviews",
      "market_intelligence_events"
    ]) {
      assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
      assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.match(migration, new RegExp(`revoke insert, update, delete on public\\.${table} from anon, authenticated`));
    }
    assert.match(migration, /public\.sonara_is_org_member\(organization_id\)/);
    assert.match(migration, /auth\.role\(\) = ''service_role''/);
    assert.match(migration, /source_url text not null check \(source_url ~ '\^https:\/\/'\)/);
    assert.match(migration, /product_lifecycle_initiative_id uuid references public\.product_lifecycle_initiatives/);
    assert.match(migration, /market_opportunity_id uuid references public\.market_intelligence_opportunities/);
  });

  it("does not enable provider execution, autonomous messaging, publishing, or advertising", function() {
    const source = read("routes/market-intelligence-routes.cjs");
    assert.doesNotMatch(source, /STRIPE_SECRET_KEY|RESEND_API_KEY|HUBSPOT_ACCESS_TOKEN|KLAVIYO_PRIVATE_API_KEY|POSTHOG_PROJECT_API_KEY|GA4_ACCESS_TOKEN/);
    assert.doesNotMatch(source, /campaign_send|direct_post|content_publish|budget_change|ad_mutation|enqueue_email/);
    assert.match(source, /safeHttpsUrl/);
    assert.match(source, /source_name/);
    assert.match(source, /observed_at/);
    assert.match(source, /confidence/);
  });
});
