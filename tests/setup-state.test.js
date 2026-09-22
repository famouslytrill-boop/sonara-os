"use strict";

const assert = require("node:assert/strict");
const {
  renderFailureCard,
  renderSetupStateCard,
  setupStateFor,
  stateKeyFor
} = require("../lib/sonara-setup-state.cjs");

describe("customer-facing setup states", () => {
  it("keeps internal service reasons out of the customer model", () => {
    const state = setupStateFor({ service: "supabase", owner: false });
    assert.equal(stateKeyFor({ service: "supabase" }), "SUPABASE_NOT_CONFIGURED");
    assert.equal(state.heading, "Finish workspace setup");
    assert.match(state.body, /workspace connection/i);
    assert.equal(state.primaryHref, "/contact");
    assert.doesNotMatch(JSON.stringify({
      heading: state.heading,
      body: state.body,
      primaryLabel: state.primaryLabel,
      primaryHref: state.primaryHref,
      dataSafety: state.dataSafety,
      continuity: state.continuity
    }), /SUPABASE|SERVICE_ROLE|SUPABASE_URL/i);
  });

  it("gives owners a setup action and ordinary users a safe support action", () => {
    const owner = setupStateFor({ code: "supabase_setup_required", owner: true });
    const member = setupStateFor({ code: "supabase_setup_required", owner: false });
    assert.equal(owner.primaryHref, "/account/setup");
    assert.equal(member.primaryHref, "/contact");
    assert.equal(owner.dataSafety, member.dataSafety);
  });

  it("distinguishes workspace access, plan access, and provider failure", () => {
    assert.equal(stateKeyFor({ code: "workspace_unavailable" }), "WORKSPACE_ACCESS_MISSING");
    assert.equal(stateKeyFor({ code: "upgrade_required" }), "FEATURE_NOT_AVAILABLE_ON_PLAN");
    assert.equal(stateKeyFor({ code: "provider_unreachable" }), "TEMPORARY_PROVIDER_FAILURE");
    assert.equal(setupStateFor({ code: "unknown_internal_code" }), null);
  });

  it("renders actionable setup copy without raw reason codes", () => {
    const state = setupStateFor({ code: "supabase_setup_required", owner: false });
    const html = renderSetupStateCard(state);
    assert.match(html, /What happens next/);
    assert.match(html, /Contact an owner or admin/);
    assert.match(html, /saved work is not changed/i);
    assert.doesNotMatch(html, /supabase_setup_required|SUPABASE_NOT_CONFIGURED|SERVICE_ROLE/i);
  });

  it("renders a safe reference for a failure page", () => {
    const html = renderFailureCard({
      message: "The connection is temporarily unavailable.",
      referenceId: "<unsafe-reference>",
      retryable: true
    });
    assert.match(html, /role="alert"/);
    assert.match(html, /try the action again/i);
    assert.match(html, /&lt;unsafe-reference&gt;/);
    assert.doesNotMatch(html, /provider_unreachable/);
  });
});
