"use strict";

// What an agent is allowed to do without the owner saying yes.
//
// The schema for agents has existed since migration 008 -- entity_agents,
// entity_proactive_actions, entity_action_runs, entity_action_approvals, and
// fifteen more. Nothing ran against it, and the release gate said so: "no
// runtime, autonomous execution remains disabled". That was true and it was
// also the reason none of these tables had to answer the hard question.
//
// The owner has now decided agents should run the day-to-day work of the
// business. The hard question arrives with that decision, and it is not "can we
// build agents" -- the tables are already there -- it is which actions an agent
// may take on a real business's money, customers and published words without a
// person in the loop.
//
// AGENTS.md already answers it, and the answer predates agents:
//
//   Do not automate refunds, payout changes, legal/policy publishing, customer
//   campaigns, proof/review publishing, security setting changes, or
//   destructive data changes without owner approval.
//   Unknown sensitive actions default to owner review.
//
// Seven named categories and a default. This module is that rule as code.
//
// The part worth being careful about is the default. A classifier that returns
// "not sensitive" for anything it does not recognise fails open, and it fails
// open exactly when a new action type is added -- which is the moment nobody is
// looking at this file. So an unrecognised action is treated as sensitive. The
// cost of that is an owner clicking approve on something harmless. The cost of
// the other choice is an agent issuing a refund because nobody had written the
// word "refund" into a list yet.

// The seven categories from AGENTS.md, each with the patterns an action_type is
// matched against. Patterns rather than exact names because action_type is free
// text written by whoever adds a capability, and "issue_refund", "refund_order"
// and "payment.refund" are the same act.
//
// Each entry says why in the owner's terms, because the reason is what gets
// shown on an approval screen and "policy category 3" is not a reason.
const SENSITIVE_CATEGORIES = Object.freeze([
  Object.freeze({
    category: "refunds",
    pattern: /refund|chargeback|reverse[_.-]?(payment|charge)|credit[_.-]?note/i,
    reason: "It moves money back out of the business.",
  }),
  Object.freeze({
    category: "payout_changes",
    pattern: /payout|bank[_.-]?(account|detail)|remittance|withdraw|transfer[_.-]?funds|payment[_.-]?method/i,
    reason: "It changes where the business's money goes.",
  }),
  Object.freeze({
    category: "legal_or_policy_publishing",
    pattern: /publish[_.-]?(policy|terms|legal|privacy)|terms[_.-]?of[_.-]?service|privacy[_.-]?policy|legal[_.-]?(doc|page|update)/i,
    reason: "It publishes wording the business is held to.",
  }),
  Object.freeze({
    category: "customer_campaigns",
    pattern: /campaign|broadcast|bulk[_.-]?(email|sms|message)|newsletter|mass[_.-]?(send|notify)|outreach[_.-]?blast/i,
    reason: "It sends something to customers that cannot be unsent.",
  }),
  Object.freeze({
    category: "proof_or_review_publishing",
    pattern: /publish[_.-]?(review|proof|testimonial|rating)|review[_.-]?publish|testimonial|social[_.-]?proof/i,
    reason: "It publishes something presented as a customer's own words.",
  }),
  Object.freeze({
    category: "security_settings",
    // Both word orders: a capability is as likely to be called grant_role as
    // role_grant, and the first draft here matched only one of them. It failed
    // safe -- an unmatched name still goes to the owner as unrecognised -- but
    // it went there with the wrong reason on the screen.
    pattern: /security[_.-]?setting|permission|role[_.-]?(grant|change|assign)|(grant|revoke|assign|change)[_.-]?role|api[_.-]?key|credential|secret|mfa|two[_.-]?factor|access[_.-]?control|rls/i,
    reason: "It changes who can reach what.",
  }),
  Object.freeze({
    category: "destructive_data_changes",
    pattern: /delete|destroy|drop|purge|truncate|wipe|erase|bulk[_.-]?update|overwrite|restore[_.-]?backup/i,
    reason: "It removes or overwrites records that may not come back.",
  }),
]);

// Actions an agent may take on its own. This list is deliberately short and
// deliberately explicit: it is an allowlist, so adding a capability means
// deciding here rather than discovering later that the default let it through.
//
// Everything on it is reversible, private to the business, and produces
// something a person reads before anything happens to a customer.
const SELF_SERVE_ACTIONS = Object.freeze([
  Object.freeze({ action: "draft_content", reason: "It writes a draft nobody has published." }),
  Object.freeze({ action: "summarise_records", reason: "It reads records the business already owns and writes a summary." }),
  Object.freeze({ action: "suggest_next_step", reason: "It proposes; the proposal is not the act." }),
  Object.freeze({ action: "categorise_record", reason: "It files an existing record, and filing is reversible." }),
  Object.freeze({ action: "prepare_report", reason: "It assembles figures the business can already see." }),
  Object.freeze({ action: "check_data_quality", reason: "It reads and reports; it changes nothing." }),
  Object.freeze({ action: "draft_reply", reason: "It writes a reply a person still has to send." }),
]);

const SELF_SERVE_BY_ACTION = new Map(SELF_SERVE_ACTIONS.map((entry) => [entry.action, entry]));

function normalise(actionType) {
  return String(actionType == null ? "" : actionType).trim();
}

// Why an action is or is not gated. Returned rather than thrown so a caller can
// render it: an approval screen that says "needs your approval" without saying
// why is asking the owner to rubber-stamp.
function classifyAction(actionType) {
  const name = normalise(actionType);

  if (!name) {
    return {
      actionType: "",
      requiresOwnerApproval: true,
      category: "unnamed",
      reason: "An action with no name cannot be checked against the rules, so it needs a person to look at it.",
    };
  }

  // Sensitive is checked before the allowlist on purpose. "delete_draft_content"
  // matches both, and if the allowlist won, a name could be chosen to get past
  // this. The stricter answer wins whenever both apply.
  for (const entry of SENSITIVE_CATEGORIES) {
    if (entry.pattern.test(name)) {
      return {
        actionType: name,
        requiresOwnerApproval: true,
        category: entry.category,
        reason: entry.reason,
      };
    }
  }

  const selfServe = SELF_SERVE_BY_ACTION.get(name);
  if (selfServe) {
    return {
      actionType: name,
      requiresOwnerApproval: false,
      category: "self_serve",
      reason: selfServe.reason,
    };
  }

  return {
    actionType: name,
    requiresOwnerApproval: true,
    category: "unrecognised",
    reason: "This is not an action the rules recognise, so it goes to you rather than being guessed at.",
  };
}

// Whether a specific proposed action may execute right now.
//
// `action` is a row from entity_proactive_actions. `approval` is a row from
// entity_action_approvals, or null.
//
// The row's own requires_approval column is not consulted. It is a default in
// the schema and it is writable, and a safety property that the thing it
// constrains can edit is not a safety property. Classification comes from the
// action type every time.
function decideExecution({ action, approval } = {}) {
  const actionType = normalise(action?.action_type);
  const classification = classifyAction(actionType);

  if (!classification.requiresOwnerApproval) {
    return { allowed: true, classification, reason: classification.reason };
  }

  if (!approval) {
    return {
      allowed: false,
      classification,
      reason: `${classification.reason} Nobody has approved it yet.`,
    };
  }

  // An approval for a different action is not an approval for this one. Without
  // this, one approved action would unlock every pending action on the entity.
  if (action?.id && approval.proactive_action_id && approval.proactive_action_id !== action.id) {
    return {
      allowed: false,
      classification,
      reason: "The approval on file was given for a different action.",
    };
  }

  if (approval.status !== "approved") {
    return {
      allowed: false,
      classification,
      reason: approval.status === "rejected"
        ? "This was declined."
        : "This is still waiting on a decision.",
    };
  }

  // A row can say "approved" without anyone having approved it -- a default, a
  // migration, a bug in whatever wrote it. The person is the point, so the
  // person has to be named.
  if (!approval.approved_by) {
    return {
      allowed: false,
      classification,
      reason: "The approval does not say who gave it.",
    };
  }

  // An agent approving its own proposal is the whole gate defeating itself.
  // proposed_by is null when an agent proposed it and a user id when a person
  // did; either way the approver has to be a person, and a person who is not
  // the proposing agent.
  if (approval.approved_by === approval.requested_by && !action?.proposed_by) {
    return {
      allowed: false,
      classification,
      reason: "The same party requested and approved this, so no second person has seen it.",
    };
  }

  return { allowed: true, classification, reason: "Approved." };
}

// An agent that keeps getting it wrong should not keep the unattended list.
//
// Everything above is static: an action type is self-serve or it is not, and it
// stays that way however badly the agent performs it. agent_action_logs records
// every outcome, and until now nothing read it back into a decision -- it was
// written for /owner/agent-activity to display and for nothing else. So an agent
// whose draft_reply runs had failed twenty times running kept draft_reply.
//
// The idea is borrowed, and the source is recorded: AI-SDLC Framework
// (ai-sdlc-framework/ai-sdlc, Apache 2.0, reviewed 9 September 2026 and
// registered reference_only) models autonomy as ordered levels with
// `promotionCriteria` and `demotionTriggers`. Their levels are not adopted --
// AGENTS.md is binary, and a graduated ladder would blur a rule whose value is
// that it is not negotiable. Their demotion half is the part we lacked. No code
// was taken; this was written against our own module.
//
// THE ONE PROPERTY THIS MUST HAVE: it can escalate and never relax. It is
// incapable of turning an action that needs approval into one that does not, so
// it cannot weaken the seven categories no matter what a log row says. That is
// enforced by returning the classification untouched whenever it already
// requires approval, and asserted by test.

// Deliberately small and countable, because this number appears on an owner's
// screen. "3 of the last 10 failed" is a sentence somebody can check; a decayed
// error rate over a rolling window is not.
const BREAKER_WINDOW = 10;
const BREAKER_FAILURES = 3;

// Statuses lib/sonara-agent-runner.cjs writes. "unimplemented" is deliberately
// NOT a failure: it means the gate approved something nothing implements, which
// is a gap in the catalogue rather than the agent behaving badly, and counting
// it would demote an agent for a missing feature.
const BREAKER_FAILURE_STATUSES = Object.freeze(["failed"]);

// `history` carries its own outcome rather than being a bare array: {ok, rows}.
// A failed read and an agent with a clean record are different facts, and an
// empty array cannot be allowed to stand for both -- that is the shape this
// codebase has been bitten by repeatedly, most expensively when a failed read
// rendered as "you have no records".
function evaluateAutonomyBreaker(classification, history) {
  // Already gated. Nothing to add, and nothing here may subtract.
  if (classification.requiresOwnerApproval) {
    return { ...classification, breaker: "not_applicable" };
  }

  if (!history || history.ok !== true || !Array.isArray(history.rows)) {
    // Cannot tell. Say so rather than treating an unreadable history as a clean
    // one. The base classification stands: it is a deliberate decision in its
    // own right, and blocking every agent on a transient read failure is the
    // worse outage -- the same trade lib/sonara-rate-limit.cjs makes, and for
    // the same reason. The caller is expected to report a degraded breaker.
    return { ...classification, breaker: "unavailable" };
  }

  const considered = history.rows.slice(0, BREAKER_WINDOW);
  const failures = considered.filter((row) => BREAKER_FAILURE_STATUSES.includes(String(row?.status || ""))).length;

  // Too little evidence is not evidence of reliability. An agent with two runs
  // has not earned anything; it simply has not been measured, and saying
  // "healthy" here would be a check reporting success from an almost-empty list.
  if (considered.length < BREAKER_WINDOW) {
    return { ...classification, breaker: "insufficient_history", breakerRuns: considered.length, breakerFailures: failures };
  }

  if (failures >= BREAKER_FAILURES) {
    return {
      actionType: classification.actionType,
      requiresOwnerApproval: true,
      category: "demoted_after_failures",
      reason:
        `${failures} of this agent's last ${considered.length} unattended runs failed, so it needs you to look ` +
        "before it runs on its own again.",
      breaker: "tripped",
      breakerRuns: considered.length,
      breakerFailures: failures,
    };
  }

  return { ...classification, breaker: "healthy", breakerRuns: considered.length, breakerFailures: failures };
}

// The seven category names, for anything that needs to show or check the list
// rather than re-typing it.
// Which workspace roles count as "the owner" for AGENTS.md's approval rule.
//
// The rule says an action in a sensitive category needs "owner approval", and
// until now nothing in this codebase could tell an owner from anybody else in
// the workspace. `decideExecution` above checks that an approval NAMES a person;
// this answers the separate question of whether that person was entitled to give
// it.
//
// ## The hole this closes, which is not hypothetical
//
// Two tables put somebody in a workspace, and they have different defaults:
//
//   * `organization_memberships.role` -- every path that creates one sets
//     `owner`. `sonara_bootstrap_customer_workspace` inserts `'owner'` and
//     `insertSetupMembership` in server.js does the same, so a self-serve
//     customer IS the owner and this gate does not lock them out of their own
//     product. That was checked before the gate was written, because a role
//     check that refused every customer would be worse than none.
//   * `business_memberships.role` -- **defaults to `employee`**, and
//     lib/sonara-business-employee-invites.cjs invites staff as `manager` or
//     `employee`. `getCustomerPrimaryOrganization` falls back to that table, so
//     an invited employee reached the workspace with the same authority as the
//     owner. **A Business Builder employee could approve a campaign to the whole
//     customer list.**
//
// ## Why an allow-list rather than a deny-list
//
// The role column is not a closed set. Migration 010 declares
// `check (role in ('owner','admin','developer','support','business_owner',
// 'creator','agency','member','viewer'))`, and two later migrations
// (20260528071400, 20260603090000) declare the same column as
// `role text not null default 'member'` with **no check constraint at all**. So
// which values are possible depends on which definition took effect, and a
// deny-list would silently admit anything nobody thought of.
//
// Default deny, the same reasoning as `classifyAction`: a classifier that fails
// open fails open exactly when somebody adds a role, which is the moment nobody
// is reading this file.
//
// `manager` is deliberately NOT on the list. A manager is staff; AGENTS.md says
// owner. That is a product decision as much as a security one and it is stated
// here rather than left to the shape of the list, so it can be argued with.
const OWNER_APPROVAL_ROLES = Object.freeze(["owner", "admin", "business_owner"]);

// May somebody holding this role approve an action that needs the owner?
//
// Returns a reason either way, because the refusal is shown to a person who
// needs to know what to do about it -- "ask the account owner" is actionable and
// "forbidden" is not.
//
// Three states, not two. A role nobody could read is not a role that fails the
// check for being the wrong one: the first says ask again, the second says ask
// somebody else, and telling a customer the wrong one of those sends them to
// the wrong place.
function mayApproveOwnerAction(role) {
  if (role === null || role === undefined || String(role).trim() === "") {
    return {
      allowed: false,
      code: "role_unknown",
      reason: "We could not confirm your role in this workspace, so this was not approved. Try again shortly.",
    };
  }

  const name = String(role).trim().toLowerCase();
  if (!OWNER_APPROVAL_ROLES.includes(name)) {
    return {
      allowed: false,
      code: "owner_role_required",
      reason: `A ${name.replaceAll("_", " ")} cannot approve this on the business's behalf. Ask the account owner to approve it.`,
    };
  }

  return { allowed: true, code: "owner_role", reason: `Approved by ${name.replaceAll("_", " ")}.` };
}

const SENSITIVE_CATEGORY_NAMES = Object.freeze(SENSITIVE_CATEGORIES.map((entry) => entry.category));

module.exports = {
  SENSITIVE_CATEGORIES,
  SENSITIVE_CATEGORY_NAMES,
  SELF_SERVE_ACTIONS,
  BREAKER_WINDOW,
  BREAKER_FAILURES,
  BREAKER_FAILURE_STATUSES,
  OWNER_APPROVAL_ROLES,
  mayApproveOwnerAction,
  classifyAction,
  decideExecution,
  evaluateAutonomyBreaker,
};
