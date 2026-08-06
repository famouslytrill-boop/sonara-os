"use strict";

// The agent approval gate, checked against the rule it implements.
//
// AGENTS.md names seven categories that must not be automated without owner
// approval and adds that unknown sensitive actions default to owner review.
// lib/sonara-agent-authority.cjs is that rule as code, so these checks are
// written from the rule's wording rather than from the module's.
//
// The cases that matter are the ones where something plausible-looking would
// have got through: a name that is on the allowlist and also destructive, an
// approval belonging to a different action, a row that says "approved" with
// nobody named on it, and an action type nobody has classified yet.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SENSITIVE_CATEGORY_NAMES,
  SELF_SERVE_ACTIONS,
  classifyAction,
  decideExecution,
} = require("../lib/sonara-agent-authority.cjs");

function approvedBy(user, overrides = {}) {
  return { status: "approved", approved_by: user, requested_by: "requester-1", ...overrides };
}

describe("agent authority", () => {
  describe("the seven categories AGENTS.md names", () => {
    // Written as the words the rule uses, mapped to action types a capability
    // would plausibly be named. If a rename breaks one of these, the rule has
    // stopped being enforced under that name and somebody should notice.
    const cases = [
      ["refunds", "issue_refund"],
      ["refunds", "payment.chargeback"],
      ["payout_changes", "update_payout_account"],
      ["payout_changes", "change_bank_details"],
      ["legal_or_policy_publishing", "publish_privacy_policy"],
      ["legal_or_policy_publishing", "update_terms_of_service"],
      ["customer_campaigns", "send_campaign"],
      ["customer_campaigns", "bulk_email_customers"],
      ["proof_or_review_publishing", "publish_review"],
      ["proof_or_review_publishing", "post_testimonial"],
      ["security_settings", "rotate_api_key"],
      ["security_settings", "grant_role"],
      ["destructive_data_changes", "delete_customer_records"],
      ["destructive_data_changes", "purge_old_invoices"],
    ];

    for (const [category, actionType] of cases) {
      it(`gates ${actionType} as ${category}`, () => {
        const classification = classifyAction(actionType);
        assert.equal(classification.requiresOwnerApproval, true, `${actionType} must need owner approval`);
        assert.equal(classification.category, category);
        assert.ok(classification.reason.length > 10, "the reason is shown on an approval screen and has to say something");
      });
    }

    it("covers every category the rule names", () => {
      assert.deepEqual([...SENSITIVE_CATEGORY_NAMES].sort(), [
        "customer_campaigns",
        "destructive_data_changes",
        "legal_or_policy_publishing",
        "payout_changes",
        "proof_or_review_publishing",
        "refunds",
        "security_settings",
      ]);
    });

    it("still matches AGENTS.md, which is where the list actually lives", () => {
      // The point of this one: if somebody edits the rule in AGENTS.md, the
      // seven names above stop describing it and this fails rather than the
      // code quietly enforcing a superseded policy.
      const rules = fs.readFileSync(path.join(__dirname, "..", "AGENTS.md"), "utf8").toLowerCase();
      for (const phrase of [
        "refunds",
        "payout changes",
        "legal/policy publishing",
        "customer campaigns",
        "proof/review publishing",
        "security setting changes",
        "destructive data changes",
        "unknown sensitive actions default to owner review",
      ]) {
        assert.ok(rules.includes(phrase), `AGENTS.md no longer says "${phrase}"; the seven categories here may be stale`);
      }
    });
  });

  describe("the default", () => {
    it("sends an unrecognised action to the owner rather than allowing it", () => {
      const classification = classifyAction("reconcile_ledger_with_bank_feed");
      assert.equal(classification.requiresOwnerApproval, true);
      assert.equal(classification.category, "unrecognised");
    });

    it("sends an unnamed action to the owner", () => {
      for (const value of ["", "   ", null, undefined]) {
        assert.equal(classifyAction(value).requiresOwnerApproval, true, `${JSON.stringify(value)} must not be allowed through`);
      }
    });

    it("lets the short allowlist through", () => {
      for (const entry of SELF_SERVE_ACTIONS) {
        const classification = classifyAction(entry.action);
        assert.equal(classification.requiresOwnerApproval, false, `${entry.action} is on the allowlist and should run`);
      }
    });

    it("prefers the stricter answer when a name is on the allowlist and also destructive", () => {
      // "delete_draft_content" contains an allowlisted action name. If the
      // allowlist were checked first, naming a capability carefully would be
      // enough to get past the gate.
      const classification = classifyAction("delete_draft_content");
      assert.equal(classification.requiresOwnerApproval, true);
      assert.equal(classification.category, "destructive_data_changes");
    });
  });

  describe("deciding whether a proposed action may run", () => {
    const sensitive = { id: "action-1", action_type: "issue_refund", proposed_by: null };

    it("refuses a sensitive action with no approval", () => {
      const decision = decideExecution({ action: sensitive, approval: null });
      assert.equal(decision.allowed, false);
      assert.match(decision.reason, /Nobody has approved it yet/);
    });

    it("allows a sensitive action once a person has approved it", () => {
      const decision = decideExecution({
        action: sensitive,
        approval: approvedBy("owner-1", { proactive_action_id: "action-1" }),
      });
      assert.equal(decision.allowed, true);
    });

    it("refuses an approval given for a different action", () => {
      const decision = decideExecution({
        action: sensitive,
        approval: approvedBy("owner-1", { proactive_action_id: "action-2" }),
      });
      assert.equal(decision.allowed, false);
      assert.match(decision.reason, /different action/);
    });

    it("refuses a pending or rejected approval", () => {
      for (const status of ["pending", "rejected", "withdrawn"]) {
        const decision = decideExecution({
          action: sensitive,
          approval: { status, approved_by: "owner-1", proactive_action_id: "action-1" },
        });
        assert.equal(decision.allowed, false, `status ${status} must not permit execution`);
      }
    });

    it("refuses an approved row that names nobody", () => {
      const decision = decideExecution({
        action: sensitive,
        approval: { status: "approved", approved_by: null, proactive_action_id: "action-1" },
      });
      assert.equal(decision.allowed, false);
      assert.match(decision.reason, /who gave it/);
    });

    it("refuses an agent approving its own proposal", () => {
      const decision = decideExecution({
        action: sensitive,
        approval: { status: "approved", approved_by: "agent-1", requested_by: "agent-1", proactive_action_id: "action-1" },
      });
      assert.equal(decision.allowed, false);
      assert.match(decision.reason, /no second person/);
    });

    it("ignores requires_approval on the row itself", () => {
      // The column exists and is writable. If it were consulted, an agent that
      // can write its own proposal could clear its own gate.
      const decision = decideExecution({
        action: { ...sensitive, requires_approval: false, approval_status: "approved" },
        approval: null,
      });
      assert.equal(decision.allowed, false);
      assert.equal(decision.classification.category, "refunds");
    });

    it("runs an allowlisted action without an approval", () => {
      const decision = decideExecution({
        action: { id: "action-3", action_type: "prepare_report" },
        approval: null,
      });
      assert.equal(decision.allowed, true);
    });

    it("refuses an action with no type at all", () => {
      assert.equal(decideExecution({ action: {}, approval: null }).allowed, false);
      assert.equal(decideExecution({}).allowed, false);
      assert.equal(decideExecution().allowed, false);
    });
  });
});
