// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { AsyncLocalStorage } = require("node:async_hooks");
const management = new AsyncLocalStorage();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// The server authenticator supplies its verified active business membership.
// Carry that organization's authority through delegated async record reads.
// Per-request storage also isolates two simultaneous workspaces for one user.
function runWithBusinessManagementScope(user, membership, callback) {
  if (typeof callback !== "function") throw new TypeError("A management callback is required");
  const userId = String(user?.id || "").trim();
  const organizationId = String(membership?.organization_id || "").trim();
  if (!userId || !UUID.test(organizationId) || membership?.status !== "active"
    || !["owner", "manager"].includes(membership.role)) {
    return { ok: false, code: "business_scope_unverified", value: undefined };
  }
  const scope = Object.freeze({ userId, organizationId, role: membership.role });
  return { ok: true, code: null, value: management.run(scope, callback) };
}

// Null means this is an ordinary primary-workspace lookup. A mismatched actor
// inside a management request is a denial, never a lookup of another user.
function organizationInBusinessManagementScope(user) {
  const scope = management.getStore();
  if (!scope) return null;
  if (String(user?.id || "").trim() !== scope.userId) {
    return { ok: false, code: "business_scope_actor_mismatch" };
  }
  return { ok: true, organizationId: scope.organizationId, role: scope.role,
    source: "business_memberships" };
}

module.exports = { runWithBusinessManagementScope, organizationInBusinessManagementScope };
