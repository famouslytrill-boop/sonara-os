"use strict";

// Which organization a signed-in customer belongs to.
//
// This is the tenant boundary. The service-role key bypasses row level
// security, so the `organization_id` this returns is the only thing separating
// one business's records from another's, and it is read on 95 call sites.
//
// Extracted from server.js on 17 August 2026 to fix two things that were hard
// to see while it sat among the route handlers.
//
// **A failed read used to be able to create a workspace.** The order is:
// look in `organization_memberships`, then in `business_memberships`, then, if
// neither found anything, call `sonara_bootstrap_customer_workspace` to make
// one. Both lookups treated "the request failed" and "there is no row" as the
// same outcome -- they were guarded by `if (response?.ok)` with no else -- so a
// 500 or a dropped connection fell through to the third step.
//
// The bootstrap RPC is idempotent against `organization_memberships`: it looks
// for an existing active membership before creating anything, so a failed read
// of *that* table was covered by accident. It does not look at
// `business_memberships`. A customer whose only membership lives there, whose
// second read failed, got a brand-new empty organization -- while their real
// one still existed, with all of their records in it, now invisible to them.
//
// So: no bootstrap unless both reads actually answered. Creating a workspace is
// a write, and doing it because a read failed is doing it because we do not
// know, which is the direction that loses somebody's data behind a new tenant.
//
// **And "no workspace" and "could not check" were the same answer.** Both came
// back as `workspace_not_ready`, which reads as a fact about the customer. A
// customer mid-outage was told they had no workspace and offered a button to
// create one. `workspace_unreadable` is now separate, and callers that only
// test `.ok` are unaffected.

function createCustomerPrimaryOrganizationResolver({ getSupabaseServerConfig, supabaseHeaders }) {
  if (typeof getSupabaseServerConfig !== "function") throw new TypeError("getSupabaseServerConfig is required");
  if (typeof supabaseHeaders !== "function") throw new TypeError("supabaseHeaders is required");

  // Returns the rows, or null when the read did not answer. Null is not an
  // empty list and the caller must not treat it as one -- that collapse is the
  // whole defect this file was written for.
  async function readMemberships(config, table, userId) {
    const filters = `&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&order=created_at.asc.nullslast,organization_id.asc&limit=1`;

    // Takes the whole query rather than just the select, so each call site
    // spells its columns out as a literal. That is not style: with
    // `select=${select}` the column list was computed at run time, and
    // scripts/report-unused-selected-columns.mjs cannot read a computed list --
    // so both of these reads became invisible to the check that hunts a column
    // fetched into a decision and never used. Its ratchet caught the rise. The
    // filters stay in one shared const, which is what
    // tests/database-query-contract.test.js requires so the two tables cannot
    // drift apart on ordering.
    async function ask(query) {
      const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
        headers: supabaseHeaders(config)
      }).catch(() => undefined);
      if (!response?.ok) return null;
      const rows = await response.json().catch(() => null);
      return Array.isArray(rows) ? rows : null;
    }

    // `role` is selected because the campaign send needs to know whether this
    // person may approve on the business's behalf --
    // `mayApproveOwnerAction` in lib/sonara-agent-authority.cjs decides, and it
    // cannot decide without this. See the note there: the two membership tables
    // have different defaults, and an invited employee reached the workspace
    // with the owner's authority until this was read.
    const withRole = await ask(`select=organization_id,role${filters}`);
    if (withRole) return withRole;

    // Falling back to the old select, and it is not belt-and-braces. Eleven
    // routes call this resolver; if `role` were ever absent from a deployment's
    // schema PostgREST answers 400 and adding the column to this select would
    // take all eleven down rather than degrade one gate. So a failure retries
    // without it, and the row comes back with no role -- which
    // `mayApproveOwnerAction` reports as "could not confirm your role" rather
    // than as the wrong role or as permission.
    const withoutRole = await ask(`select=organization_id${filters}`);
    if (!withoutRole) return null;
    return withoutRole.map((row) => ({ ...row, role: null }));
  }

  return async function getCustomerPrimaryOrganization(user, options = {}) {
    const config = getSupabaseServerConfig();
    const userId = String(user?.id || "").trim();
    if (!config.ok) return { ok: false, code: "workspace_unavailable" };
    if (!userId) return { ok: false, code: "customer_auth_required" };

    const organizationRows = await readMemberships(config, "organization_memberships", userId);
    if (organizationRows?.[0]?.organization_id) {
      return {
        ok: true,
        organizationId: organizationRows[0].organization_id,
        // Carried rather than derived. A caller that had to guess the role from
        // the source table would be guessing: both tables have a role column
        // and they do not agree on its default.
        role: organizationRows[0].role ?? null,
        source: "organization_memberships"
      };
    }

    const businessRows = await readMemberships(config, "business_memberships", userId);
    if (businessRows?.[0]?.organization_id) {
      // business_memberships defaults its role to `employee`, so this branch is
      // where a member of staff arrives. That is exactly who must not be able
      // to approve a customer campaign.
      return {
        ok: true,
        organizationId: businessRows[0].organization_id,
        role: businessRows[0].role ?? null,
        source: "business_memberships"
      };
    }

    // Both reads had to answer to conclude there is nothing to find. If either
    // came back null we know less than we would need to know to justify a write.
    if (organizationRows === null || businessRows === null) {
      return { ok: false, code: "workspace_unreadable" };
    }

    if (options.autoBootstrap !== false) {
      const response = await fetch(`${config.url}/rest/v1/rpc/sonara_bootstrap_customer_workspace`, {
        method: "POST",
        headers: supabaseHeaders(config, { "content-type": "application/json" }),
        body: JSON.stringify({
          p_user_id: userId,
          p_email: user?.email || null,
          p_organization_name: null,
          p_product_path: "dashboard"
        })
      }).catch(() => undefined);
      if (response?.ok) {
        const payload = await response.json().catch(() => ({}));
        const value = Array.isArray(payload) ? payload[0] : payload;
        const organizationId = value?.organization_id || value?.organizationId;
        // The bootstrap function inserts `'owner'` -- read from
        // supabase/migrations/20260726093000_customer_workspace_bootstrap.sql,
        // which does `values (v_organization_id, p_user_id, 'owner', 'active')`
        // and the same on conflict. So this is the role it just created rather
        // than an optimistic default; a self-serve customer owns their own
        // workspace and this gate does not lock them out of it.
        if (organizationId) return { ok: true, organizationId, role: "owner", source: "automatic_workspace_bootstrap" };
      }
      // The bootstrap itself failing is also not evidence the customer has no
      // workspace; it is evidence we could not finish looking.
      return { ok: false, code: "workspace_unreadable" };
    }

    return { ok: false, code: "workspace_not_ready" };
  };
}

module.exports = { createCustomerPrimaryOrganizationResolver };
