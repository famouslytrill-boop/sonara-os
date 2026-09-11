"use strict";

// Inviting somebody onto a Business Builder workspace, and their accepting it.
//
// Moved out of server.js unchanged in behaviour. The ceiling on that file had
// taken six exceptions in a week without one reduction between them, which
// meant it had stopped measuring what it was for and started measuring how
// often a page gets added. This is the reduction it was asking for, and this
// piece was chosen because it is the one with a security story: a token, a
// hash, an expiry, and an email address that has to match.
//
// ## What the invite flow actually guarantees
//
// **The owner never sets a password.** The three password fields a form might
// carry are refused outright rather than ignored, because an owner who can set
// an employee's password can sign in as them, and every audit trail after that
// point is wrong about who did the work.
//
// **The token is never stored.** `business_employee_invites.token_hash` holds a
// hash; the raw token exists only in the link that goes out. A leaked table is
// not a set of working invites.
//
// **The email has to match the invite.** A token is a bearer credential, so
// without this check anybody who saw the link could take the seat, and the
// business would have an employee it never invited under a name it never chose.
//
// **An expired invite is refused with a distinct code**, so the page can offer
// a new one rather than saying the token was wrong.
//
// ## Why everything is injected
//
// The same reason as the other modules extracted from server.js: this reaches
// Supabase, Supabase Auth, Resend and the audit log, and a test that had to
// stand all four up would be a test nobody writes. Handed in, each one can be a
// function that records what it was asked to do.

const crypto = require("node:crypto");

// A week. Long enough that an invite survives somebody's holiday, short enough
// that a link found in an old inbox has stopped working.
const EMPLOYEE_INVITE_MAX_AGE_DAYS = 7;

const REQUIRED = [
  "getSupabaseAdminClient", "supabaseHeaders", "hashInviteToken",
  "getPublicAppUrl", "recordAdminAuditEvent", "isSupabaseConfigured",
  "createEmployeeAuthUser", "splitList", "getReadiness", "getEnv",
  // The form moved here from server.js when the tenant fix pushed that file
  // past its ceiling. Extracting rather than raising the number is what the
  // ratchet is for, and it made the form directly testable -- which is how
  // "the two id fields are gone for a manager" became an assertion instead of
  // a claim.
  "escapeHtml"
];

function createBusinessEmployeeInvites(deps = {}) {
  for (const name of REQUIRED) {
    if (typeof deps[name] !== "function") throw new TypeError(`createBusinessEmployeeInvites requires ${name}`);
  }
  const {
    getSupabaseAdminClient, supabaseHeaders, hashInviteToken,
    getPublicAppUrl, recordAdminAuditEvent, isSupabaseConfigured,
    createEmployeeAuthUser, splitList, getReadiness, getEnv, escapeHtml
  } = deps;

  async function createBusinessEmployeeInvite(req) {
    const body = req.body || {};
    if (body.password || body.employeePassword || body.temporaryPassword) {
      return { status: 400, body: { ok: false, code: "password_not_allowed", message: "Owners cannot create or submit employee passwords." } };
    }
  
    // The tenant is the verified one, never the one the request names.
    //
    // This read `body.organizationId` first, with the verified membership as a
    // FALLBACK. `organization_id` is the tenant key: the service-role key
    // bypasses row-level security, so `organization_id=eq.` is the whole
    // boundary, and `getCustomerPrimaryOrganization` in
    // `lib/sonara-customer-organization.cjs` returns
    // `business_memberships.organization_id` straight back as the organization a
    // signed-in customer belongs to.
    //
    // What that allowed: `requireBusinessManager` verifies the caller against
    // `workspace_id` ONLY -- `getBusinessWorkspaceId` never looks at the
    // organization at all. So a legitimate manager of their own workspace could
    // post `organizationId` naming somebody else's business, the invite row
    // carried it, `acceptBusinessEmployeeInvite` copied it into an **active**
    // `business_memberships` row, and an account with no
    // `organization_memberships` row -- a fresh invited address, which the
    // manager chooses -- then resolved into that organization on sign-in,
    // across the eleven routes sharing that resolver.
    //
    // `organization_id` was in that membership query's own select list the whole
    // time. **Being selected is what made it look checked**, which is defect
    // three in `.claude/skills/checks-that-cannot-lie`, found by
    // `pnpm run report:selected-columns` listing it as fetched and unread.
    //
    // A platform admin is the one caller who may name a tenant, because they
    // administer all of them: `requireBusinessManager` gives them
    // `sonaraBusinessMembership = {}` and sets `sonaraAdmin` only after
    // `isSupabaseAdminUser` has passed. Everybody else takes both ids off their
    // own verified row.
    //
    // A request that names a DIFFERENT tenant is refused rather than quietly
    // corrected. A client that believes it invited into one business and
    // silently invited into another has been told something false, and that is
    // the failure this whole file is about.
    const verified = req.sonaraBusinessMembership || {};
    const verifiedWorkspaceId = String(verified.workspace_id || "").trim();
    const verifiedOrganizationId = String(verified.organization_id || "").trim();
    const platformAdmin = req.sonaraAdmin?.ok === true;

    if (!verifiedOrganizationId && !platformAdmin) {
      // Neither a verified membership nor an admin. Refused rather than falling
      // back to the body, which is exactly what was wrong before.
      return { status: 403, body: { ok: false, code: "membership_unverified", message: "We could not confirm which business this invite belongs to. Sign in again and retry." } };
    }

    const requestedWorkspaceId = String(body.workspaceId || body.workspace_id || "").trim();
    const requestedOrganizationId = String(body.organizationId || body.organization_id || "").trim();

    if (!platformAdmin && (
      (requestedWorkspaceId && requestedWorkspaceId !== verifiedWorkspaceId) ||
      (requestedOrganizationId && requestedOrganizationId !== verifiedOrganizationId)
    )) {
      return { status: 403, body: { ok: false, code: "tenant_mismatch", message: "This invite names a workspace or business you do not manage." } };
    }

    const workspaceId = platformAdmin ? requestedWorkspaceId : verifiedWorkspaceId;
    const organizationId = platformAdmin ? requestedOrganizationId : verifiedOrganizationId;
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || body.invitedName || "").trim();
    const role = String(body.role || "employee").trim();
    const permissions = splitList(body.permissions || "");
  
    if (!workspaceId || !organizationId) return { status: 400, body: { ok: false, code: "validation_failed", message: "Workspace ID and organization ID are required." } };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, body: { ok: false, code: "validation_failed", message: "Enter a valid employee email." } };
    if (name.length < 2) return { status: 400, body: { ok: false, code: "validation_failed", message: "Enter the employee name." } };
    if (!["manager", "employee"].includes(role)) return { status: 400, body: { ok: false, code: "validation_failed", message: "Choose manager or employee." } };
  
    const config = getSupabaseAdminClient();
    if (!config.ok) return { status: 503, body: { ok: false, code: "setup_required", service: "supabase" } };
  
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashInviteToken(rawToken);
    const expiresAt = new Date(Date.now() + EMPLOYEE_INVITE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const response = await fetch(`${config.url}/rest/v1/business_employee_invites`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "return=representation" }),
      body: JSON.stringify({
        organization_id: organizationId,
        workspace_id: workspaceId,
        invited_email: email,
        invited_name: name,
        role,
        permissions,
        status: "pending",
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_by_user_id: req.sonaraUser?.id || null
      })
    }).catch(() => undefined);
  
    if (!response?.ok) return { status: 502, body: { ok: false, code: "invite_not_recorded", message: "Employee invite could not be recorded." } };
    const rows = await response.json().catch(() => []);
    const invite = rows[0] || {};
    const inviteUrl = `${getPublicAppUrl(req)}/business-builder/invite/accept?token=${encodeURIComponent(rawToken)}`;
    const emailResult = await sendBusinessInviteEmail({ email, name, role, inviteUrl });
    await recordAdminAuditEvent(req, "business.employee_invite.created", { target_type: "business_employee_invite", target_id: invite.id || "pending", workspace_id: workspaceId, email_domain: email.split("@")[1] || "unknown", email_delivery: emailResult.ok ? "sent" : "setup_required" });
  
    return {
      status: 200,
      body: {
        ok: true,
        code: "invite_recorded",
        inviteId: invite.id,
        delivery: emailResult.ok ? "email_sent" : "setup_required",
        message: emailResult.ok
          ? "Employee invite recorded and email delivery was requested."
          : "Employee invite recorded. Email delivery setup is required before invite email delivery is available."
      }
    };
  }
  
  async function acceptBusinessEmployeeInvite(body) {
    const token = String(body.token || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!token || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      return { status: 400, body: { ok: false, code: "validation_failed", message: "Invite token, valid email, and an 8+ character password are required." } };
    }
    if (!isSupabaseConfigured()) return { status: 503, body: { ok: false, code: "setup_required", service: "supabase_auth" } };
  
    const config = getSupabaseAdminClient();
    const inviteResponse = await fetch(`${config.url}/rest/v1/business_employee_invites?select=id,organization_id,workspace_id,role,status,expires_at,invited_email&token_hash=eq.${encodeURIComponent(hashInviteToken(token))}&status=eq.pending&limit=1`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    if (!inviteResponse?.ok) return { status: 502, body: { ok: false, code: "invite_lookup_failed" } };
    const invites = await inviteResponse.json().catch(() => []);
    const invite = invites[0];
    if (!invite) return { status: 404, body: { ok: false, code: "invite_not_found" } };
    if (String(invite.invited_email || "").toLowerCase() !== email) return { status: 403, body: { ok: false, code: "invite_email_mismatch" } };
    if (new Date(invite.expires_at).getTime() <= Date.now()) return { status: 410, body: { ok: false, code: "invite_expired" } };
  
    const auth = await createEmployeeAuthUser(email, password);
    if (!auth.ok || !auth.userId) return { status: auth.status || 502, body: { ok: false, code: auth.code || "auth_not_completed" } };
  
    const membership = await fetch(`${config.url}/rest/v1/business_memberships?on_conflict=workspace_id,user_id`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        organization_id: invite.organization_id,
        workspace_id: invite.workspace_id,
        user_id: auth.userId,
        role: invite.role,
        status: "active"
      })
    }).catch(() => undefined);
    if (!membership?.ok) return { status: 502, body: { ok: false, code: "membership_not_recorded" } };
  
    await fetch(`${config.url}/rest/v1/business_employee_invites?id=eq.${encodeURIComponent(invite.id)}`, {
      method: "PATCH",
      headers: supabaseHeaders(config),
      body: JSON.stringify({ status: "accepted", accepted_by_user_id: auth.userId, accepted_at: new Date().toISOString() })
    }).catch(() => undefined);
  
    return { status: 200, body: { ok: true, code: "invite_accepted", message: "Invite accepted. Use Business Builder login with your email and password." } };
  }
  
  
  async function sendBusinessInviteEmail({ email, name, role, inviteUrl }) {
    if (getReadiness().services.emailDelivery !== "enabled") return { ok: false, error: "resend_not_configured" };
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${getEnv("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: getEnv("RESEND_FROM_EMAIL"),
        to: [email],
        subject: "Business Builder employee invite",
        text: [`Hello ${name},`, "", `You were invited as a Business Builder ${role}.`, "Set your own password using this secure invite link:", inviteUrl, "", "If you did not expect this invite, ignore this email."].join("\n")
      })
    }).catch(() => undefined);
    return response?.ok ? { ok: true } : { ok: false, error: `resend_${response?.status || "unavailable"}` };
  }
  // The two id fields are shown only to a caller who has no verified membership
  // to take them from, which is the platform admin override in
  // `requireBusinessManager`.
  //
  // A manager used to type their own Workspace ID and Organization ID into
  // required free-text boxes. That was two faults in one control: a manager who
  // does not know their business's UUID could not use the page at all, and one
  // who typed somebody ELSE's organization id had it accepted --
  // `lib/sonara-business-employee-invites.cjs` read the body before the verified
  // membership. The ids are known from the membership, so the fields are gone and
  // the page says which business the invite lands on instead.
  function businessEmployeeInviteForm(membership = {}) {
    const workspaceId = String(membership?.workspace_id || "").trim();
    const organizationId = String(membership?.organization_id || "").trim();
    const tenant = organizationId
      ? `<p class="fine">This invite joins the workspace you manage. Business ${escapeHtml(organizationId)}, workspace ${escapeHtml(workspaceId || "not set")}.</p>`
      : `<label>Workspace ID<input name="workspaceId" type="text" required></label>
        <label>Organization ID<input name="organizationId" type="text" required></label>`;
    return `<article class="card">
      <h2>Create employee invite</h2>
      <form method="post" action="/api/business-builder/employees/invite">
        ${tenant}
        <label>Employee name<input name="name" type="text" required></label>
        <label>Employee email<input name="email" type="email" required></label>
        <label>Role<select name="role" required><option value="employee">Employee</option><option value="manager">Manager</option></select></label>
        <label>Permissions<input name="permissions" type="text" aria-label="Permissions such as intake, records, readiness"></label>
        <p class="fine">Do not enter an employee password. Employees set their own password through the invite flow.</p>
        <button type="submit">Create invite</button>
      </form>
    </article>`;
  }

  return { createBusinessEmployeeInvite, acceptBusinessEmployeeInvite, sendBusinessInviteEmail, businessEmployeeInviteForm };
}

module.exports = { createBusinessEmployeeInvites, EMPLOYEE_INVITE_MAX_AGE_DAYS, REQUIRED };
