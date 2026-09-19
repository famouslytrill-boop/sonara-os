// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { mayApproveOwnerAction } = require("./sonara-agent-authority.cjs");

const APPROVAL_STATES = Object.freeze(["draft", "pending", "approved", "rejected", "cancelled"]);
const ACTIONS = Object.freeze(["submit", "approve", "reject", "revise", "cancel"]);
const MANAGER_ACTIONS = new Set(["submit", "revise", "cancel"]);
const TRANSITIONS = Object.freeze({
  draft: Object.freeze({ submit: "pending", cancel: "cancelled" }),
  pending: Object.freeze({ approve: "approved", reject: "rejected", cancel: "cancelled" }),
  approved: Object.freeze({ revise: "draft", cancel: "cancelled" }),
  rejected: Object.freeze({ revise: "draft", cancel: "cancelled" }),
  cancelled: Object.freeze({ revise: "draft" })
});

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function decideApprovalTransition({ currentState, action, actorRole, ownerOverride = false } = {}) {
  const state = String(currentState || "draft").trim().toLowerCase();
  const wanted = String(action || "").trim().toLowerCase();
  if (!APPROVAL_STATES.includes(state)) return { allowed: false, code: "unknown_approval_state" };
  if (!ACTIONS.includes(wanted)) return { allowed: false, code: "unsupported_procurement_action" };
  const nextState = TRANSITIONS[state]?.[wanted];
  if (!nextState) return { allowed: false, code: "invalid_procurement_transition", currentState: state, action: wanted };

  const role = ownerOverride ? "owner" : normalizeRole(actorRole);
  if (["approve", "reject"].includes(wanted)) {
    const approval = mayApproveOwnerAction(role);
    if (!approval.allowed) return { allowed: false, code: approval.code, reason: approval.reason };
  } else if (!MANAGER_ACTIONS.has(wanted) || !["owner", "admin", "business_owner", "manager"].includes(role)) {
    return { allowed: false, code: role ? "manager_role_required" : "role_unknown" };
  }

  return { allowed: true, code: "procurement_transition_allowed", currentState: state, nextState, action: wanted, actorRole: role };
}

function approvalPatch(decision, { actorUserId = null, notes = null, now = new Date().toISOString() } = {}) {
  if (!decision?.allowed) return null;
  const patch = {
    approval_status: decision.nextState,
    approval_notes: String(notes || "").trim().slice(0, 2000) || null,
    approval_version_increment: 1,
    updated_at: now
  };
  if (decision.action === "submit") {
    patch.approval_requested_by = actorUserId;
    patch.approval_requested_at = now;
    patch.approval_decided_by = null;
    patch.approval_decided_at = null;
  }
  if (["approve", "reject"].includes(decision.action)) {
    patch.approval_decided_by = actorUserId;
    patch.approval_decided_at = now;
  }
  if (decision.action === "revise") {
    patch.approval_decided_by = null;
    patch.approval_decided_at = null;
  }
  return patch;
}

function mayAdvanceOrderStatus(approvalStatus, orderStatus) {
  const target = String(orderStatus || "").toLowerCase();
  if (!["sent", "partially_received", "received"].includes(target)) return { allowed: true };
  if (approvalStatus === "approved") return { allowed: true };
  return {
    allowed: false,
    code: "procurement_approval_required",
    reason: "This purchase order must be approved by an account owner before it can be sent or received."
  };
}

module.exports = {
  ACTIONS,
  APPROVAL_STATES,
  TRANSITIONS,
  approvalPatch,
  decideApprovalTransition,
  mayAdvanceOrderStatus
};
