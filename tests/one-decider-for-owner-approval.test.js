"use strict";

// Two classifiers with opposite defaults, and only one of them was right.
//
// `lib/sonara-agent-authority.cjs` classifies an action by pattern and sends
// anything it does not recognise to the owner. CLAUDE.md states why in as many
// words: "The default is deny, deliberately: a classifier that fails open fails
// open exactly when somebody adds a capability, which is the moment nobody is
// reading that file."
//
// `lib/sonara-event-driven-agent-contract.cjs` had a second classifier --
// `authorityForAction`, a frozen list of nine action names returning `low_risk`
// for everything else. An allowlist with the opposite default. Thirteen action
// names that the authority module gates under a named category came back
// `low_risk` from the event contract, and `canDispatch` lets a `low_risk` event
// through with no owner approval:
//
//   delete_customer_records, purge_audit_log, wipe_bookings, truncate_invoices,
//   issue_refund_batch, chargeback_reverse, rotate_api_key, grant_role_admin,
//   revoke_role, change_payout_bank_account, publish_terms_of_service,
//   send_bulk_sms, newsletter_blast
//
// Latent only because nothing in production called `canDispatch` yet. Wiring
// event consumers would have made it live.
//
// ## Why this file asserts the permissive direction too
//
// Because the obvious fix breaks the product. `classifyAction` takes a STRING
// and normalises with `String()`, so an object argument becomes the literal
// "[object Object]", lands in `unrecognised`, and returns
// `requiresOwnerApproval: true`. It fails safe -- which is what makes it
// invisible. The first fix written here passed an object and every action,
// including all seven that may run unattended, came back `owner_review`. It
// looked like a working gate and would have asked the owner for permission to
// write a draft.
//
// So both directions are asserted: never laxer than the authority module, and
// never stricter about the seven.

const assert = require("node:assert/strict");

const contract = require("../lib/sonara-event-driven-agent-contract.cjs");
const authority = require("../lib/sonara-agent-authority.cjs");
const { createRunEventPublisher } = require("../lib/sonara-event-outbox.cjs");

const { authorityForAction, canDispatch, createAgentEvent, EVENT_TOPICS, OWNER_REVIEW_ACTIONS } = contract;
const { classifyAction, SELF_SERVE_ACTIONS, SENSITIVE_CATEGORIES } = authority;

// Each name is asserted below to land in the category it is filed under, so a
// pattern that stops matching fails rather than leaving a probe that is gated
// only by the unrecognised default.
const GATED_BY_CATEGORY = Object.freeze({
  refunds: "issue_refund_batch",
  payout_changes: "change_payout_bank_account",
  legal_or_policy_publishing: "publish_terms_of_service",
  customer_campaigns: "send_bulk_sms",
  proof_or_review_publishing: "publish_testimonial",
  security_settings: "rotate_api_key",
  destructive_data_changes: "delete_customer_records"
});

function publisherFor(overrides = {}) {
  const captured = [];
  const publish = createRunEventPublisher({
    organizationId: "org_test",
    actorId: "user_test",
    repository: { enqueue: async (event) => { captured.push(event); return { ok: true, row: {} }; } },
    ...overrides
  });
  return { publish, captured };
}

describe("one decider for owner approval", () => {
  it("has a non-empty population on both sides, so it cannot pass by measuring nothing", () => {
    assert.ok(SENSITIVE_CATEGORIES.length >= 7, `only ${SENSITIVE_CATEGORIES.length} sensitive categories; AGENTS.md names seven`);
    assert.ok(SELF_SERVE_ACTIONS.length >= 7, `only ${SELF_SERVE_ACTIONS.length} unattended actions; CLAUDE.md names seven`);
    assert.ok(OWNER_REVIEW_ACTIONS.length >= 9, `only ${OWNER_REVIEW_ACTIONS.length} documented consequential actions`);
    assert.equal(
      Object.keys(GATED_BY_CATEGORY).length,
      SENSITIVE_CATEGORIES.length,
      "every sensitive category needs a probe here, or this file stops covering whatever was added"
    );
  });

  it("gates every sensitive category through the event contract, by the category the authority module names", () => {
    for (const [category, action] of Object.entries(GATED_BY_CATEGORY)) {
      const classification = classifyAction(action);
      assert.equal(
        classification.category,
        category,
        `${action} is filed under ${category} but classified as ${classification.category}; this probe no longer tests that category`
      );
      assert.equal(
        classification.requiresOwnerApproval,
        true,
        `${action} is meant to be the gated probe for ${category} and the authority module does not gate it`
      );
      assert.equal(
        authorityForAction(action),
        "owner_review",
        `${action} (${category}) is gated by the authority module and the event contract calls it low_risk -- canDispatch would let it through unattended`
      );
    }
  });

  it("keeps the seven unattended actions unattended", () => {
    for (const { action } of SELF_SERVE_ACTIONS) {
      assert.equal(classifyAction(action).requiresOwnerApproval, false, `${action} should be self-serve in the authority module`);
      assert.equal(
        authorityForAction(action),
        "low_risk",
        `${action} may run unattended and the event contract now sends it to the owner. The usual cause is passing an object to classifyAction, which stringifies to "[object Object]".`
      );
    }
  });

  it("fails closed on an action nothing recognises", () => {
    for (const name of ["an_action_nobody_has_classified", "frobnicate_widget", "zzz_capability_2026"]) {
      assert.equal(classifyAction(name).requiresOwnerApproval, true, `${name} should be unrecognised and gated`);
      assert.equal(authorityForAction(name), "owner_review", `${name} is unrecognised and the event contract did not fail closed`);
    }
  });

  it("still treats an action-less event as low risk, because there is nothing to gate", () => {
    assert.equal(authorityForAction(""), "low_risk");
    assert.equal(authorityForAction(null), "low_risk");
    // And the validator makes the alternative unrepresentable.
    const validation = contract.validateAgentEvent({
      version: 1, eventId: "e", occurredAt: "t", organizationId: "o", actorId: "a",
      producer: "p", topic: EVENT_TOPICS.RESULTS, kind: "agent.work.completed",
      correlationId: "c", idempotencyKey: "k", authority: "owner_review",
      action: null, payload: {}, attempt: 1
    });
    assert.equal(validation.ok, false);
    assert.ok(
      validation.errors.some((error) => /owner_review events require an action/.test(error)),
      "an owner_review event with no action must be rejected"
    );
  });

  it("refuses to dispatch a destructive action without approval, and accepts it with one", () => {
    const event = createAgentEvent({
      organizationId: "org_test",
      actorId: "user_test",
      producer: "test",
      topic: EVENT_TOPICS.RESULTS,
      kind: "agent.work.completed",
      action: "delete_customer_records",
      payload: {}
    });
    assert.equal(event.authority, "owner_review");

    const refused = canDispatch(event);
    assert.equal(refused.ok, false);
    assert.equal(refused.reason, "owner_approval_required");

    const allowed = canDispatch(event, {
      status: "approved",
      eventId: event.eventId,
      organizationId: event.organizationId,
      approvedBy: "owner_1"
    });
    assert.equal(allowed.ok, true, "a matching owner approval must still let it through");
  });

  // --- the outbox publisher's default ---------------------------------------

  it("does not stamp low_risk on a run whose classification is absent", async () => {
    const { publish, captured } = publisherFor();
    await publish({
      run: { status: "completed", actionType: "delete_customer_records" },
      action: { id: "a1", action_type: "delete_customer_records" }
    });
    assert.equal(captured.length, 1);
    assert.equal(
      captured[0].authority,
      "owner_review",
      "an absent classification must not become a dispatchable event; createAgentEvent takes any truthy authority verbatim, so stamping low_risk here shadows the derivation entirely"
    );
  });

  it("does not let a permissive classification override a gated action name", async () => {
    const { publish, captured } = publisherFor();
    await publish({
      run: { status: "completed", actionType: "purge_audit_log", classification: { requiresOwnerApproval: false } },
      action: { id: "a2", action_type: "purge_audit_log" }
    });
    assert.equal(captured[0].authority, "owner_review");
  });

  it("still escalates when the classification demands review and the name alone would not", async () => {
    const { publish, captured } = publisherFor();
    await publish({
      run: { status: "completed", actionType: "draft_content", classification: { requiresOwnerApproval: true } },
      action: { id: "a3", action_type: "draft_content" }
    });
    assert.equal(
      captured[0].authority,
      "owner_review",
      "the breaker demotes a self-serve action by setting requiresOwnerApproval; that escalation must survive"
    );
  });

  it("still publishes a genuinely self-serve run as low risk", async () => {
    const { publish, captured } = publisherFor();
    await publish({
      run: { status: "completed", actionType: "draft_content", classification: { requiresOwnerApproval: false } },
      action: { id: "a4", action_type: "draft_content" }
    });
    assert.equal(captured[0].authority, "low_risk");
  });

  // --- the structural claim -------------------------------------------------

  it("leaves the event contract with no authority list of its own", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "..", "lib", "sonara-event-driven-agent-contract.cjs"),
      "utf8"
    );
    assert.ok(
      /classifyAction/.test(source),
      "the event contract must ask lib/sonara-agent-authority.cjs rather than decide for itself"
    );
    const fn = source.slice(source.indexOf("function authorityForAction"), source.indexOf("function requiresOwnerReview"));
    assert.ok(
      !/OWNER_REVIEW_ACTIONS\s*\.\s*includes/.test(fn),
      "authorityForAction is deciding from its own list again; that list returns low_risk for every name nobody added to it"
    );
    assert.ok(
      /classifyAction\(\s*normalized\s*\)/.test(fn),
      "authorityForAction must pass a STRING to classifyAction; an object stringifies to \"[object Object]\" and gates everything"
    );
  });
});
