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

function statusLabel(value) {
  return STATUS_LABELS[normalizeStatus(value)];
}

function statusTone(value) {
  const status = normalizeStatus(value);
  if (["configured", "enabled", "owner_approved"].includes(status)) return "ready";
  if (["deferred", "review_required", "not_attorney_reviewed"].includes(status)) return "review";
  return "blocked";
}

function statusItem(label, value, detail) {
  const status = normalizeStatus(value);
  return `<li class="sonara-cohesive-status is-${statusTone(status)}"><span aria-hidden="true"></span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail || statusLabel(status))}</small></div></li>`;
}

function productTab(product, index) {
  return `<button type="button" role="tab" id="sonara-product-tab-${index}" aria-selected="${index === 0 ? "true" : "false"}" aria-controls="sonara-product-panel" data-sonara-product="${escapeHtml(product.slug)}">
    <img src="${escapeHtml(product.logo)}" width="52" height="52" alt="">
    <span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.action)}</small></span>
  </button>`;
}

function productPanel(product) {
  return `<div class="sonara-cohesive-product-copy">
      <span>01 / ${escapeHtml(product.name.toUpperCase())}</span>
      <h3>${escapeHtml(product.description)}</h3>
      <p>Use one account, one trusted organization boundary, and one visible path from setup to real saved work.</p>
      <div class="sonara-cohesive-product-actions"><a class="action" href="${escapeHtml(product.route)}">Explore product</a><a class="action" href="${escapeHtml(product.primaryRoute)}">Open first workflow</a></div>
    </div>
    <div class="sonara-cohesive-product-preview" aria-label="${escapeHtml(product.name)} workflow preview">
      <div class="sonara-cohesive-preview-bar"><span>${escapeHtml(product.name)}</span><b>Connected workspace</b></div>
      <div class="sonara-cohesive-preview-focus"><img src="${escapeHtml(product.logo)}" width="76" height="76" alt=""><div><small>NEXT RESPONSIBLE ACTION</small><strong>${escapeHtml(product.action)}</strong><p>${escapeHtml(product.description)}</p></div></div>
      <ol>${(product.milestones || ["Prepare", "Create", "Review", "Operate"]).slice(0, 4).map((milestone, index) => `<li><span>0${index + 1}</span><strong>${escapeHtml(milestone)}</strong><small>${index === 0 ? "Ready to begin" : "Opens with context"}</small></li>`).join("")}</ol>
    </div>`;
}

function renderCohesiveHomepage(readiness = {}) {
  const services = readiness.services || {};
  const business = SONARA_BRAND_REGISTRY.products[0];
  const operationalStatuses = [
    ["Account database", readiness.accountDatabase || services.accountDatabase || services.supabase, "Supabase-backed records"],
    ["Payments", readiness.paymentConnection || services.paymentConnection || services.stripe, "Checkout provider connection"],
    ["Payment updates", readiness.paymentUpdates || services.paymentUpdates || services.stripeWebhook, "Signed billing updates"],
    ["Email delivery", readiness.emailDelivery || services.emailDelivery || services.resend, "Transactional delivery"],
    ["Founder/Admin protection", readiness.founderAccess || services.founderAccess || services.adminProtection, "Server-side protected access"],
    ["Legal review", services.legalReviewBoundary || services.legalPages, "Owner-approved baseline; qualified legal review remains open"]
  ];
  const configuredCount = operationalStatuses.filter(([, value]) => ["configured", "enabled", "owner_approved"].includes(normalizeStatus(value))).length;

  return `<div class="sonara-cohesive-shell" data-sonara-cohesive data-sonara-product-current="${escapeHtml(business.slug)}">
    <section class="sonara-cohesive-intro" aria-labelledby="sonara-cohesive-intro-title">
      <div>
        <span>SONARA ONE</span>
        <h2 id="sonara-cohesive-intro-title">One connected system for the work behind the ambition.</h2>
        <p>Business Builder, Creator Studio, and Growth Studio keep their own workflows while account access, billing, support, security, and the authoritative database remain connected.</p>
      </div>
      <dl>
        <div><dt>${SONARA_BRAND_REGISTRY.products.length}</dt><dd>focused product studios</dd></div>
        <div><dt>${business.milestones.length}</dt><dd>guided founder milestones</dd></div>
        <div><dt>${configuredCount}/${operationalStatuses.length}</dt><dd>current launch systems ready</dd></div>
      </dl>
    </section>

    <section class="sonara-cohesive-identity" aria-labelledby="sonara-identity-title">
      <div class="sonara-cohesive-section-heading"><div><span>IDENTITY WITH A PURPOSE</span><h2 id="sonara-identity-title">Build. Create. Grow. Connected by one trusted center.</h2></div><p>The SONARA Trinity Loop represents three product paths moving through one human-controlled operating system. The product marks inherit the same geometry without becoming interchangeable.</p></div>
      <div class="sonara-cohesive-identity-layout">
        <article class="sonara-cohesive-parent-mark"><div class="sonara-cohesive-orbit" aria-hidden="true"><i></i><i></i><i></i><img src="${escapeHtml(SONARA_BRAND_REGISTRY.parent.logo)}" width="260" height="260" alt=""></div><div><span>SONARA INDUSTRIES</span><h3>Trinity Loop</h3><p>Structure, expression, and evidence organized around one authoritative source of truth.</p></div></article>
        <div class="sonara-cohesive-mark-list">${SONARA_BRAND_REGISTRY.products.map((product) => `<a href="${escapeHtml(product.route)}"><img src="${escapeHtml(product.logo)}" width="72" height="72" alt=""><span><small>${escapeHtml(product.name)}</small><strong>${escapeHtml(product.action)}</strong></span><b>↗</b></a>`).join("")}</div>
      </div>
    </section>

    <section class="sonara-cohesive-products" aria-labelledby="sonara-products-title">
      <div class="sonara-cohesive-section-heading"><div><span>THREE PRODUCT WORLDS</span><h2 id="sonara-products-title">Different work. One operating language.</h2></div><p>Select a product to see how the narrative, workflow, and primary action change while the shared trust and data contracts stay consistent.</p></div>
      <div class="sonara-cohesive-tabs" role="tablist" aria-label="SONARA products">${SONARA_BRAND_REGISTRY.products.map(productTab).join("")}</div>
      <div class="sonara-cohesive-product-panel" id="sonara-product-panel" role="tabpanel" aria-labelledby="sonara-product-tab-0">${productPanel(business)}</div>
    </section>

    <section class="sonara-cohesive-launch" aria-labelledby="sonara-launch-title">
      <div class="sonara-cohesive-section-heading is-inverse"><div><span>BUSINESS BUILDER LAUNCH PATH</span><h2 id="sonara-launch-title">Move from idea to operation without losing context.</h2></div><p>Each milestone inherits the decisions, records, evidence, and access state created before it. The interface never replaces a missing database write with visual completion.</p></div>
      <div class="sonara-cohesive-launch-console">
        <ol class="sonara-cohesive-milestones">${business.milestones.map((milestone, index) => `<li class="${index === 0 ? "is-active" : ""}"><button type="button" data-sonara-milestone="${index}" aria-pressed="${index === 0 ? "true" : "false"}"><span>0${index + 1}</span><strong>${escapeHtml(milestone)}</strong></button></li>`).join("")}</ol>
        <div class="sonara-cohesive-milestone-panel" aria-live="polite"><div><span data-sonara-step-label>FOUNDATION</span><h3 data-sonara-step-title>Give the business a clear identity.</h3><p data-sonara-step-copy>Name the organization, define who it serves, and create the first clear customer promise.</p></div><div class="sonara-cohesive-step-actions"><a class="action" href="/account/setup">Create organization</a><a class="action" href="/business-builder/launch-readiness">Review launch path</a></div></div>
      </div>
    </section>

    <section class="sonara-cohesive-proof" aria-labelledby="sonara-proof-title">
      <div class="sonara-cohesive-section-heading"><div><span>CONNECTED DATABASE AND DEPLOYMENT</span><h2 id="sonara-proof-title">The public interface reports real configuration—not simulated success.</h2></div><p>Supabase Postgres remains the authoritative database. Payment access remains provider-signed and persisted. Missing or deferred services stay visible and recoverable.</p></div>
      <div class="sonara-cohesive-proof-layout">
        <ul class="sonara-cohesive-status-list">${operationalStatuses.map((item) => statusItem(...item)).join("")}</ul>
        <article class="sonara-cohesive-trust-card"><span>AUTHORITATIVE CORE</span><h3>Supabase-backed, organization-scoped, and fail-closed.</h3><p>The production database connection is present. Organization setup uses the hosted-compatible record shape and canonical organization membership. Customer access is still verified server-side and through RLS.</p><div><a class="action" href="/account/setup">Finish account setup</a><a class="action" href="/readiness">View live readiness</a></div></article>
      </div>
    </section>

    <section class="sonara-cohesive-pricing" aria-labelledby="sonara-pricing-title">
      <div class="sonara-cohesive-section-heading"><div><span>ACCESSIBLE PREMIUM PRICING</span><h2 id="sonara-pricing-title">Begin small. Keep the system when the work grows.</h2></div><p>Plan prices come from the approved runtime registry. Checkout is available only for configured server allowlist entries, and a redirect never grants paid access.</p></div>
      <div class="sonara-cohesive-plan-rail">${SONARA_BRAND_REGISTRY.plans.map((plan, index) => `<a class="${index === 2 ? "is-featured" : ""}" href="${escapeHtml(plan.route)}"><span>${escapeHtml(plan.name)}</span><strong>${escapeHtml(plan.price)}</strong><p>${escapeHtml(plan.detail)}</p><b>${index === 0 ? "Start free" : "View plan"} ↗</b></a>`).join("")}</div>
    </section>

    <section class="sonara-cohesive-final" aria-label="Start using SONARA"><div><span>BUILD WHAT MATTERS</span><h2>Use a real workflow now. Upgrade when saved work and support matter.</h2><p>No fake customer counts, no guaranteed revenue, and no paid access until persisted provider evidence confirms it.</p></div><div><a class="action" href="/signup">Start Free</a><a class="action" href="/products">Explore products</a><a class="action" href="/pricing">View pricing</a></div></section>

    <div class="sonara-cohesive-toast" data-sonara-cohesive-toast role="status" aria-live="polite" hidden></div>
  </div>`;
}

module.exports = { renderCohesiveHomepage, normalizeStatus, statusLabel };
