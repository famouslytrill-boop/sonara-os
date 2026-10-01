// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Whether an organization has permitted the tool an action would use.
//
// ## What this adds to the seven categories, and what it may never do
//
// `lib/sonara-agent-authority.cjs` answers "does this KIND of action need the
// owner". This answers "has this organization permitted this tool at all", which
// is a different question with a different answer per tenant. Like the autonomy
// breaker and the volume cap, it may only ever ADD refusals: an action the
// authority module gates stays gated whatever a permission row says, because a
// tenant-editable row that could unlock a refund would make the seven categories
// advisory.
//
// ## Four kinds of absence, which must not collapse into one
//
// This is the shape this codebase keeps getting bitten by -- `null` is not `[]`
// is not `0` -- so the four are named and tested separately:
//
//   unwired        No reader was supplied, so the model is not installed at this
//                  call site. Reported loudly, classification untouched. This is
//                  the state the autonomy breaker was in, silently, from the day
//                  it was written until 1 October 2026: every test injected a
//                  reader and no call site passed one. Denying here instead would
//                  refuse every action at every caller that has not been wired,
//                  which is a worse way to find out.
//
//   unavailable    A reader was supplied and the read FAILED. This escalates to
//                  owner approval, and that is deliberately the opposite of what
//                  the breaker does with a failed history read. The breaker is a
//                  reliability heuristic, so absent evidence of failure must not
//                  penalise an agent. This is an authorization decision, so
//                  absent evidence of permission must not grant one. Degrading to
//                  "ask the owner" is not an outage; granting on an unreadable
//                  table is a hole.
//
//   unconfigured   The read SUCCEEDED and this organization has no rows at all.
//                  The model is not in force for them yet; the authority module
//                  continues to govern and this is reported rather than assumed.
//                  Treating no rows as deny-everything would make applying the
//                  migration an outage for every existing deployment; treating it
//                  as allow-everything would make the table decorative. Once an
//                  organization has any row, a tool with no row is denied -- so
//                  the model is opt-in per tenant and strict once opted in.
//
//   denied         The read succeeded, the organization has rows, and this tool
//                  is either absent from them or present and not allowed.
//
// `{ ok, rows }` is what makes the middle two distinguishable. A bare array
// cannot say whether the read happened, so it is treated as `unavailable`.

const TOOL_NAME_MAX = 120;

const PERMISSION_STATES = Object.freeze([
  "not_applicable",
  "unwired",
  "unavailable",
  "unconfigured",
  "allowed",
  "denied",
  "approval_required"
]);

// The categories this module can put on a classification. Each is distinct from
// the seven in the authority module, so an owner reading the queue can tell a
// tool that was never permitted from a refund that always needs them.
const PERMISSION_CATEGORIES = Object.freeze({
  denied: "tool_not_permitted",
  unavailable: "tool_permission_unreadable",
  approval_required: "tool_requires_owner_approval"
});

// Tool names are compared after the same normalisation the table's CHECK
// constraint enforces, so a row saved as "Draft_Reply " and a lookup for
// "draft_reply" are the same tool rather than two.
function normalizeToolName(value) {
  const raw = typeof value === "string" ? value : "";
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 && trimmed.length <= TOOL_NAME_MAX ? trimmed : "";
}

function readRows(permissions) {
  if (typeof permissions === "undefined" || permissions === null) return { ok: false, rows: [], reason: "no permission set was supplied" };
  if (Array.isArray(permissions)) {
    // A bare array carries no outcome. It cannot say whether the read happened,
    // and this codebase has shipped that confusion before.
    return { ok: false, rows: [], reason: "a bare array carries no read outcome" };
  }
  if (permissions.ok !== true) {
    return { ok: false, rows: [], reason: String(permissions.reason || "the permission read did not report success") };
  }
  return { ok: true, rows: Array.isArray(permissions.rows) ? permissions.rows : [], reason: null };
}

function findRow(rows, toolName) {
  for (const row of rows) {
    if (normalizeToolName(row && row.toolName) === toolName) return row;
  }
  return null;
}

// `classification` is whatever the authority module, breaker and volume cap have
// already decided. `permissions` is {ok, rows} or the absence of one.
function evaluateToolPermission(classification, permissions, { toolName, hasReader = true } = {}) {
  const base = classification && typeof classification === "object" ? classification : {};

  // Already gated. There is nothing to add and no reason to make a sensitive
  // action depend on another table being reachable -- the same argument the
  // breaker makes for not consulting history on a refund.
  if (base.requiresOwnerApproval) {
    return { ...base, permission: "not_applicable" };
  }

  const tool = normalizeToolName(toolName);
  if (!tool) {
    // An unreadable tool name is not a permitted tool. This is the unknown-input
    // case AGENTS.md sends to owner review.
    return {
      ...base,
      requiresOwnerApproval: true,
      category: PERMISSION_CATEGORIES.denied,
      permission: "denied",
      permissionTool: null,
      reason: "This action does not name a tool that could be checked against the organization's permissions, so it needs an owner."
    };
  }

  if (!hasReader) {
    return {
      ...base,
      permission: "unwired",
      permissionTool: tool,
      permissionReason: "no_permission_reader"
    };
  }

  const read = readRows(permissions);
  if (!read.ok) {
    return {
      ...base,
      requiresOwnerApproval: true,
      category: PERMISSION_CATEGORIES.unavailable,
      permission: "unavailable",
      permissionTool: tool,
      permissionReason: "permissions_unreadable",
      reason: `The organization's tool permissions could not be read (${read.reason}), so whether ${tool} is permitted is unknown and it needs an owner.`
    };
  }

  if (read.rows.length === 0) {
    return {
      ...base,
      permission: "unconfigured",
      permissionTool: tool,
      permissionReason: "no_permissions_configured"
    };
  }

  const row = findRow(read.rows, tool);
  if (!row) {
    return {
      ...base,
      requiresOwnerApproval: true,
      category: PERMISSION_CATEGORIES.denied,
      permission: "denied",
      permissionTool: tool,
      reason: `This organization has configured tool permissions and ${tool} is not among them, so it needs an owner.`
    };
  }

  if (row.allowed !== true) {
    return {
      ...base,
      requiresOwnerApproval: true,
      category: PERMISSION_CATEGORIES.denied,
      permission: "denied",
      permissionTool: tool,
      reason: `${tool} is recorded as not permitted for this organization, so it needs an owner.`
    };
  }

  if (row.requiresApproval !== false) {
    // Permitted, but the row says every use is still the owner's call. Absent is
    // treated as requiring approval, matching the column default: a row read
    // back without the field must not become unattended.
    return {
      ...base,
      requiresOwnerApproval: true,
      category: PERMISSION_CATEGORIES.approval_required,
      permission: "approval_required",
      permissionTool: tool,
      reason: `${tool} is permitted for this organization but every use needs an owner's approval.`
    };
  }

  return { ...base, permission: "allowed", permissionTool: tool };
}

// Rows as the runner's reader should hand them over: the outcome carried, and
// the two booleans read strictly so a missing column is never a grant.
function normalizePermissionRows(body) {
  if (!Array.isArray(body)) return { ok: false, rows: [], reason: "the permission read did not return a list" };
  return {
    ok: true,
    rows: body.map((row) => ({
      toolName: normalizeToolName(row && row.tool_name),
      allowed: row && row.allowed === true,
      requiresApproval: !(row && row.requires_approval === false)
    })).filter((row) => row.toolName)
  };
}

// The table, and the read that fills the rows above.
//
// Kept in this module beside the decision it feeds, the way
// lib/sonara-agent-action-log.cjs keeps its history reader beside the recorder.
const PERMISSIONS_TABLE = "agent_tool_permissions";

// Read one past the cap, so a truncated page is detectable rather than looking
// like a short list. This matters more here than in most places that use the
// trick: a tool absent from a PARTIAL page would be reported as "not among this
// organization's permissions" and refused, which is a refusal with a false
// reason attached. Truncation is reported as an unreadable permission set
// instead -- still safe, because unreadable escalates, but it says the true
// thing.
const PERMISSION_READ_CAP = 500;

function createToolPermissionReader({ organizationId, getSupabaseServerConfig, cap = PERMISSION_READ_CAP }) {
  return async function readToolPermissions() {
    if (!organizationId) return { ok: false, rows: [], reason: "no organization scope" };

    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : { ok: false };
    if (!config?.ok) return { ok: false, rows: [], reason: "supabase not configured" };

    const limit = Math.max(1, Number(cap) || PERMISSION_READ_CAP);
    const query =
      `select=tool_name,allowed,requires_approval` +
      `&organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&order=tool_name.asc&limit=${limit + 1}`;

    const response = await fetch(`${config.url}/rest/v1/${PERMISSIONS_TABLE}?${query}`, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        Accept: "application/json"
      }
    }).catch(() => undefined);

    if (!response?.ok) return { ok: false, rows: [], reason: `read failed (${response?.status || 0})` };

    const body = await response.json().catch(() => null);
    if (!Array.isArray(body)) return { ok: false, rows: [], reason: "unreadable response" };

    if (body.length > limit) {
      return { ok: false, rows: [], reason: `more than ${limit} permission rows, so this read cannot say whether a tool is absent` };
    }

    return normalizePermissionRows(body);
  };
}

module.exports = {
  TOOL_NAME_MAX,
  PERMISSIONS_TABLE,
  PERMISSION_READ_CAP,
  createToolPermissionReader,
  PERMISSION_STATES,
  PERMISSION_CATEGORIES,
  normalizeToolName,
  normalizePermissionRows,
  evaluateToolPermission
};
