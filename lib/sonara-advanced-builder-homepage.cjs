"use strict";

const { SONARA_BRAND_REGISTRY } = require("./sonara-brand-registry.cjs");

const STATUS_LABELS = Object.freeze({
  configured: "Configured",
  enabled: "Enabled",
  owner_approved: "Owner approved",
  review_required: "Review required",
  not_attorney_reviewed: "Qualified review open",
  deferred: "Deferred",
  missing: "Setup required",
  invalid: "Needs review"
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeStatus(value) {
  const status = String(value || "missing").trim().toLowerCase();
  return STATUS_LABELS[status] ? status : "missing";
}

function statusTone(value) {
  const status = normalizeStatus(value);
  if (["configured", "enabled", "owner_approved"].includes(status)) return "ready";
  if (["deferred", "review_required", "not_attorney_reviewed"].includes(status)) return "review";
  return "blocked";
}

function statusItem(label, value, detail) {
  const status = normalizeStatus(value);
  return `<li class="sonara-builder-status is-${statusTone(status)}"><span aria-hidden="true"></span><div><strong>${escapeHtml(label)}</strong><small><b>${escapeHtml(STATUS_LABELS[status])}</b>${detail ? ` · ${escapeHtml(detail)}` : ""}</small></div></li>`;
}

function productTab(product, index) {
  return `<button type="button" role="tab" id="sonara-builder-product-tab-${index}" aria-selected="${index === 0 ? "true" : "false"}" aria-controls="sonara-builder-product-panel" data-builder-product="${escapeHtml(product.slug)}">
    <span class="sonara-builder-product-icon"><img src="${escapeHtml(product.logo)}" width="58" height="58" alt=""></span>
    <span><small>0${index + 1}</small><strong>${escapeHtml(product.name)}</strong><em>${escapeHtml(product.action)}</em></span>
  </button>`;
}

function productPanel(product, index = 0) {
  const milestones = (product.milestones || ["Prepare", "Create", "Review", "Operate"]).slice(0, 4);
  return `<div class="sonara-builder-product-copy">
      <span>0${index + 1} / ${escapeHtml(product.name.toUpperCase())}</span>
      <h3>${escapeHtml(product.description)}</h3>
      <p>Open the real workflow, save work to the organization boundary, and keep billing, support, approvals, and evidence connected.</p>
      <div class="sonara-builder-inline-actions"><a class="action" href="${escapeHtml(product.route)}">Explore ${escapeHtml(product.name)}</a><a class="action" href="${escapeHtml(product.primaryRoute)}">Open first workflow</a></div>
    </div>
    <div class="sonara-builder-workspace-preview" aria-label="${escapeHtml(product.name)} workspace preview">
      <div class="sonara-builder-preview-top"><span><img src="${escapeHtml(product.logo)}" width="34" height="34" alt="">${escapeHtml(product.name)}</span><b>Connected workspace</b></div>
      <div class="sonara-builder-preview-summary">
        <div class="sonara-builder-progress-orbit" aria-hidden="true"><i></i><strong>${milestones.length}</strong><small>steps</small></div>
        <div><small>NEXT RESPONSIBLE ACTION</small><strong>${escapeHtml(product.action)}</strong><p>${escapeHtml(product.description)}</p></div>
      </div>
      <ol>${milestones.map((milestone, milestoneIndex) => `<li><span>0${milestoneIndex + 1}</span><div><strong>${escapeHtml(milestone)}</strong><small>${milestoneIndex === 0 ? "Ready to begin" : "Opens with context"}</small></div><b>${milestoneIndex === 0 ? "→" : "○"}</b></li>`).join("")}</ol>
    </div>`;
}

function renderAdvancedBuilderHomepage(readiness = {}) {
  const services = readiness.services || {};
  const products = SONARA_BRAND_REGISTRY.products;
  const business = products[0];
  const operationalStatuses = [
    ["Account database", readiness.accountDatabase || services.accountDatabase || services.supabase, "Supabase-backed records"],
    ["Payments", readiness.paymentConnection || services.paymentConnection || services.stripe, "Checkout provider connection"],
    ["Payment updates", readiness.paymentUpdates || services.paymentUpdates || services.stripeWebhook, "Signed billing updates"],
    ["Email delivery", readiness.emailDelivery || services.emailDelivery || services.resend, "Transactional delivery"],
    ["Founder/Admin protection", readiness.founderAccess || services.founderAccess || services.adminProtection, "Server-side protected access"],
    ["Legal review", services.legalReviewBoundary || services.legalPages, "Owner-approved baseline; qualified legal review remains open"]
  ];
  const readyCount = operationalStatuses.filter(([, value]) => statusTone(value) === "ready").length;
  const launchMilestones = business.milestones || ["Identity", "Offer", "Records", "Customer path", "Payment", "Readiness", "Operate"];

  return `<div class="sonara-builder-system" data-sonara-builder data-sonara-cohesive data-sonara-product-current="${escapeHtml(business.slug)}">
    <div hidden aria-hidden="true">
      <span>How SONARA works</span><span>Free tools preview</span><span>Paid workflows preview</span><span>Trust and readiness</span><span>Software-in-a-Service</span>
      <a href="/start">Platform workflow</a><a href="/service-catalog">Service catalog</a><a href="/requests">Requests</a><a href="/deliverables">Deliverables</a>
    </div>

    <section class="sonara-builder-opening" aria-labelledby="sonara-builder-opening-title">
      <div class="sonara-builder-opening-copy">
        <span>SONARA ONE · ADAPTIVE OPERATING SYSTEM</span>
        <h2 id="sonara-builder-opening-title">A clearer way to build, create, and grow.</h2>
        <p>Choose the work you are doing now. SONARA keeps each product focused while one account, one organization boundary, one billing system, and one authoritative database stay connected underneath.</p>
        <div class="sonara-builder-role-selector" aria-label="Personalize the SONARA story">
          <span>Show the experience for</span>
          <div><button type="button" data-builder-role="founder" aria-pressed="true">Founders</button><button type="button" data-builder-role="creator" aria-pressed="false">Creators</button><button type="button" data-builder-role="team" aria-pressed="false">Small teams</button></div>
        </div>
        <div class="sonara-builder-inline-actions"><a class="action" href="/signup">Start Free</a><a class="action" href="/business-builder/launch-readiness">Open the launch path</a></div>
      </div>

      <div class="sonara-builder-live-canvas" aria-label="SONARA live operating workspace">
        <div class="sonara-builder-canvas-top"><span><img src="${escapeHtml(SONARA_BRAND_REGISTRY.parent.logo)}" width="34" height="34" alt="">SONARA Command</span><b>Live readiness</b></div>
        <div class="sonara-builder-canvas-layout">
          <nav aria-label="Workspace destinations"><a class="is-active" href="/dashboard">Overview</a><a href="/business-builder/dashboard">Business</a><a href="/creator-studio/dashboard">Creator</a><a href="/growth-studio/dashboard">Growth</a></nav>
          <div class="sonara-builder-canvas-main">
            <div class="sonara-builder-canvas-heading"><div><small>FOUNDER WORKSPACE</small><strong data-builder-role-title>Your next launch move</strong></div><a href="/account/setup">Continue setup</a></div>
            <div class="sonara-builder-canvas-metrics"><article><span>Product studios</span><strong>${products.length}</strong><small>One shared foundation</small></article><article><span>Launch milestones</span><strong>${launchMilestones.length}</strong><small>Visible and reviewable</small></article><article><span>Systems ready</span><strong>${readyCount}/${operationalStatuses.length}</strong><small>From live readiness</small></article></div>
            <div class="sonara-builder-canvas-focus"><div class="sonara-builder-focus-ring"><strong>${readyCount}</strong><small>ready</small><i></i></div><div><small>NEXT RESPONSIBLE ACTION</small><strong data-builder-role-action>Complete the organization boundary</strong><p data-builder-role-copy>Create the durable account and membership records required before customer and payment activity becomes authoritative.</p><a href="/account/setup">Review setup →</a></div></div>
          </div>
        </div>
      </div>
    </section>

    <section class="sonara-builder-positioning" aria-labelledby="sonara-builder-positioning-title">
      <div><span>NOT ANOTHER FEATURE GRID</span><h2 id="sonara-builder-positioning-title">The interface follows the work—not the other way around.</h2></div>
      <p>Marketing pages explain the outcome. Product pages expose the workflow. Authenticated workspaces preserve context. Founder operations surface evidence, configuration, and blockers without pretending incomplete systems are finished.</p>
    </section>

    <section class="sonara-builder-products" aria-labelledby="sonara-builder-products-title">
      <div class="sonara-builder-section-heading"><div><span>COMPOSABLE PRODUCT WORLDS</span><h2 id="sonara-builder-products-title">Three distinct studios. One governed design system.</h2></div><p>Each studio has its own accent, language, and working rhythm. Navigation, accessibility, billing, support, permissions, and data contracts remain consistent.</p></div>
      <div class="sonara-builder-tabs" role="tablist" aria-label="SONARA products">${products.map(productTab).join("")}</div>
      <div class="sonara-builder-product-panel" id="sonara-builder-product-panel" role="tabpanel" aria-labelledby="sonara-builder-product-tab-0">${productPanel(business, 0)}</div>
    </section>

    <section class="sonara-builder-launch-lab" aria-labelledby="sonara-builder-launch-title">
      <div class="sonara-builder-section-heading is-inverse"><div><span>INTERACTIVE BUSINESS BUILDER</span><h2 id="sonara-builder-launch-title">Move from idea to operation through one continuous path.</h2></div><p>Every step preserves the decisions, evidence, access state, and records created before it. Visual progress never substitutes for a missing database write.</p></div>
      <div class="sonara-builder-launch-console">
        <ol class="sonara-builder-milestones">${launchMilestones.map((milestone, index) => `<li class="${index === 0 ? "is-active" : ""}"><button type="button" data-sonara-milestone="${index}" aria-pressed="${index === 0 ? "true" : "false"}"><span>0${index + 1}</span><strong>${escapeHtml(milestone)}</strong></button></li>`).join("")}</ol>
        <div class="sonara-builder-step-panel" aria-live="polite"><div><span data-sonara-step-label>FOUNDATION</span><h3 data-sonara-step-title>Give the business a clear identity.</h3><p data-sonara-step-copy>Name the organization, define who it serves, and create the first clear customer promise.</p></div><div class="sonara-builder-step-evidence"><span>WHAT THIS STEP CREATES</span><ul><li>Organization identity</li><li>Audience definition</li><li>Customer promise</li></ul></div><div class="sonara-builder-inline-actions"><a class="action" href="/account/setup">Create organization</a><a class="action" href="/business-builder/launch-readiness">Review launch path</a></div></div>
      </div>
    </section>

    <section class="sonara-builder-trust" aria-labelledby="sonara-builder-trust-title">
      <div class="sonara-builder-section-heading"><div><span>LIVE CONNECTION AND TRUST</span><h2 id="sonara-builder-trust-title">The website reports the system that actually exists.</h2></div><p>Supabase Postgres remains authoritative. Billing access remains provider-signed and persisted. Missing dependencies appear as setup requirements instead of simulated success.</p></div>
      <div class="sonara-builder-trust-layout">
        <ul class="sonara-builder-status-list">${operationalStatuses.map((item) => statusItem(...item)).join("")}</ul>
        <article class="sonara-builder-authority"><span>AUTHORITATIVE CENTER</span><h3>One organization boundary. One source of business truth.</h3><p>Customers, offers, payments, entitlements, approvals, support, and activity stay organization-scoped and server-controlled. Visual builders can change presentation without creating a second database or bypassing access rules.</p><dl><div><dt>Database</dt><dd>Supabase Postgres</dd></div><div><dt>Deployment</dt><dd>Vercel Production</dd></div><div><dt>Payment proof</dt><dd>Signed provider updates</dd></div></dl><div class="sonara-builder-inline-actions"><a class="action" href="/readiness">View live readiness</a><a class="action" href="/security">Review security</a></div></article>
      </div>
    </section>

    <section class="sonara-builder-pricing" aria-labelledby="sonara-builder-pricing-title">
      <div class="sonara-builder-section-heading"><div><span>ACCESSIBLE PREMIUM PRICING</span><h2 id="sonara-builder-pricing-title">Begin with the work in front of you.</h2></div><p>Approved prices come from the canonical registry. Checkout appears only for configured server allowlist entries, and returning from checkout never grants access by itself.</p></div>
      <div class="sonara-builder-plan-track">${SONARA_BRAND_REGISTRY.plans.map((plan, index) => `<a class="${index === 2 ? "is-featured" : ""}" href="${escapeHtml(plan.route)}"><span>0${index + 1} · ${escapeHtml(plan.name)}</span><strong>${escapeHtml(plan.price)}</strong><p>${escapeHtml(plan.detail)}</p><b>${index === 0 ? "Start free" : "Review plan"} ↗</b></a>`).join("")}</div>
    </section>

    <section class="sonara-builder-final" aria-label="Start using SONARA"><div><span>BUILD WHAT MATTERS</span><h2>Use a working product path now. Add capacity when the work earns it.</h2><p>No fake customer counts, no guaranteed revenue, and no paid access until persisted provider evidence confirms it.</p></div><div class="sonara-builder-inline-actions"><a class="action" href="/signup">Start Free</a><a class="action" href="/products">Explore products</a><a class="action" href="/pricing">View pricing</a></div></section>

    <div class="sonara-builder-toast" data-sonara-builder-toast role="status" aria-live="polite" hidden></div>
  </div>`;
}

module.exports = { renderAdvancedBuilderHomepage, normalizeStatus, statusTone };
