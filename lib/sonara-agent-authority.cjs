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

// The seven category names, for anything that needs to show or check the list
// rather than re-typing it.
const SENSITIVE_CATEGORY_NAMES = Object.freeze(SENSITIVE_CATEGORIES.map((entry) => entry.category));

module.exports = {
  SENSITIVE_CATEGORIES,
  SENSITIVE_CATEGORY_NAMES,
  SELF_SERVE_ACTIONS,
  classifyAction,
  decideExecution,
};
