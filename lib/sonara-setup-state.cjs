// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Customer-facing setup and failure language. Internal reason codes remain in
// JSON responses and records; this module is the boundary that keeps them out
// of HTML while still telling a customer what to do next.

const SETUP_STATES = Object.freeze({
  WORKSPACE_NOT_CREATED: {
    heading: "Finish workspace setup",
    body: "Your account is active, but this workspace has not been connected yet.",
    ownerAction: "Open workspace setup",
    ownerHref: "/account/setup",
    userAction: "Contact your workspace owner",
    userHref: "/contact",
    dataSafety: "Your account data is safe while setup is completed.",
    continuity: "You can return to the dashboard while this is being finished."
  },
  WORKSPACE_ACCESS_MISSING: {
    heading: "Workspace access needs attention",
    body: "We could not confirm your access to this workspace.",
    ownerAction: "Review workspace access",
    ownerHref: "/account/setup",
    userAction: "Contact your workspace owner",
    userHref: "/contact",
    dataSafety: "No workspace data was changed.",
    continuity: "Your account and other available areas remain safe to use."
  },
  SUPABASE_NOT_CONFIGURED: {
    heading: "Finish workspace setup",
    body: "Your account is active, but the workspace connection is not ready yet.",
    ownerAction: "Open workspace setup",
    ownerHref: "/account/setup",
    userAction: "Contact an owner or admin",
    userHref: "/contact",
    dataSafety: "Your saved work is not changed by this setup step.",
    continuity: "You can return to the dashboard while the connection is completed."
  },
  STRIPE_NOT_CONFIGURED: {
    heading: "Payment setup is not ready",
    body: "This payment action is unavailable until the account owner finishes the payment connection.",
    ownerAction: "Review payment setup",
    ownerHref: "/account/setup",
    userAction: "Return to pricing",
    userHref: "/pricing",
    dataSafety: "No payment was created or charged.",
    continuity: "The rest of your workspace remains available."
  },
  EMAIL_NOT_CONFIGURED: {
    heading: "Email setup needs attention",
    body: "This message cannot be sent until the account owner finishes email setup.",
    ownerAction: "Review account setup",
    ownerHref: "/account/setup",
    userAction: "Contact an owner or admin",
    userHref: "/contact",
    dataSafety: "Your request remains safe and was not sent incomplete.",
    continuity: "You can continue using the rest of the workspace."
  },
  PROVIDER_NOT_CONFIGURED: {
    heading: "This workflow is not ready to run",
    body: "The connection this workflow needs has not been finished yet.",
    ownerAction: "Review provider setup",
    ownerHref: "/creator-studio/launch-readiness",
    userAction: "Return to Creator Studio",
    userHref: "/creator-studio/generation",
    dataSafety: "Your request was not sent to a provider.",
    continuity: "Your saved Creator Studio work remains available."
  },
  OWNER_SETUP_REQUIRED: {
    heading: "An owner or admin needs to finish setup",
    body: "This area is ready for your workspace, but an owner or admin must complete one setup step first.",
    ownerAction: "Open workspace setup",
    ownerHref: "/account/setup",
    userAction: "Contact an owner or admin",
    userHref: "/contact",
    dataSafety: "No customer data was changed.",
    continuity: "You can return to the dashboard and keep using available areas."
  },
  FEATURE_NOT_AVAILABLE_ON_PLAN: {
    heading: "This feature is not included in your plan",
    body: "You can review the available plans before deciding whether to add this capability.",
    ownerAction: "Review plans",
    ownerHref: "/pricing",
    userAction: "Return to your workspace",
    userHref: "/dashboard",
    dataSafety: "No payment or subscription change was made.",
    continuity: "Your current plan and workspace remain unchanged."
  },
  FEATURE_DISABLED: {
    heading: "This feature is currently unavailable",
    body: "This capability is not enabled for this workspace right now.",
    ownerAction: "Review workspace setup",
    ownerHref: "/account/setup",
    userAction: "Return to your workspace",
    userHref: "/dashboard",
    dataSafety: "No data was changed.",
    continuity: "The rest of your workspace remains available."
  },
  TEMPORARY_PROVIDER_FAILURE: {
    heading: "The connection is temporarily unavailable",
    body: "We could not reach the service needed for this action. Your request was not completed.",
    ownerAction: "Try again",
    ownerHref: "/creator-studio/generation",
    userAction: "Try again",
    userHref: "/creator-studio/generation",
    dataSafety: "Nothing was published or charged by this failed attempt.",
    continuity: "Your saved work remains available."
  }
});

const SERVICE_STATE = Object.freeze({
  supabase: "SUPABASE_NOT_CONFIGURED",
  account_database: "SUPABASE_NOT_CONFIGURED",
  profiles: "WORKSPACE_ACCESS_MISSING",
  organizations: "WORKSPACE_NOT_CREATED",
  organization_memberships: "WORKSPACE_ACCESS_MISSING",
  stripe: "STRIPE_NOT_CONFIGURED",
  checkout: "STRIPE_NOT_CONFIGURED",
  email: "EMAIL_NOT_CONFIGURED",
  emailDelivery: "EMAIL_NOT_CONFIGURED",
  provider: "PROVIDER_NOT_CONFIGURED",
  provider_connection: "PROVIDER_NOT_CONFIGURED"
});

const CODE_STATE = Object.freeze({
  setup_required: "OWNER_SETUP_REQUIRED",
  supabase_setup_required: "SUPABASE_NOT_CONFIGURED",
  workspace_setup_required: "WORKSPACE_NOT_CREATED",
  workspace_unavailable: "WORKSPACE_ACCESS_MISSING",
  upgrade_required: "FEATURE_NOT_AVAILABLE_ON_PLAN",
  provider_not_connected: "PROVIDER_NOT_CONFIGURED",
  provider_not_found: "PROVIDER_NOT_CONFIGURED",
  provider_unreachable: "TEMPORARY_PROVIDER_FAILURE",
  provider_dispatch_failed: "TEMPORARY_PROVIDER_FAILURE",
  provider_refresh_failed: "TEMPORARY_PROVIDER_FAILURE"
});

function stateKeyFor({ code, service } = {}) {
  const normalizedCode = String(code || "").trim();
  const normalizedService = String(service || "").trim();
  return CODE_STATE[normalizedCode] || SERVICE_STATE[normalizedService] || null;
}

function setupStateFor({ code, service, owner = false } = {}) {
  const key = stateKeyFor({ code, service });
  if (!key || !SETUP_STATES[key]) return null;
  const state = SETUP_STATES[key];
  return {
    key,
    heading: state.heading,
    body: state.body,
    primaryLabel: owner ? state.ownerAction : state.userAction,
    primaryHref: owner ? state.ownerHref : state.userHref,
    dataSafety: state.dataSafety,
    continuity: state.continuity
  };
}

function escape(value) {
  return String(value).replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}

function renderSetupStateCard(state, escapeHtml = escape) {
  if (!state) return "";
  return `<article class="card sonara-setup-state" role="status">
    <h2>What happens next</h2>
    <p>${escapeHtml(state.body)}</p>
    <ul class="sonara-checklist">
      <li><span class="sonara-checklist__content"><strong>Next step:</strong> ${escapeHtml(state.primaryLabel)}.</span></li>
      <li><span class="sonara-checklist__content"><strong>Your data:</strong> ${escapeHtml(state.dataSafety)}</span></li>
      <li><span class="sonara-checklist__content"><strong>While you wait:</strong> ${escapeHtml(state.continuity)}</span></li>
    </ul>
  </article>`;
}

function renderFailureCard({ message, referenceId, retryable = false }, escapeHtml = escape) {
  const retryText = retryable
    ? "You can try the action again from the previous page."
    : "If this keeps happening, contact support with the reference below.";
  return `<article class="card sonara-failure-state" role="alert">
    <h2>What happened</h2>
    <p>${escapeHtml(message)}</p>
    <p>${escapeHtml(retryText)}</p>
    <p class="fine"><strong>Reference:</strong> ${escapeHtml(referenceId)}</p>
  </article>`;
}

function renderSetupPage({ service, owner = false, layout, link, escapeHtml = escape }) {
  const state = setupStateFor({ service, owner }) || setupStateFor({ code: "setup_required", owner });
  return layout({
    title: state.heading,
    eyebrow: "Workspace setup",
    heading: state.heading,
    body: state.body,
    sections: [renderSetupStateCard(state, escapeHtml)],
    authenticated: true,
    actions: [
      link(state.primaryHref, state.primaryLabel),
      link("/dashboard", "Return to dashboard"),
      link("/contact", "Contact support")
    ]
  });
}

module.exports = {
  CODE_STATE,
  SERVICE_STATE,
  SETUP_STATES,
  renderFailureCard,
  renderSetupPage,
  renderSetupStateCard,
  setupStateFor,
  stateKeyFor
};
