"use strict";

// Inviting somebody onto a workspace, and the four things that make the link
// safe to send.
//
// This lifecycle lived in server.js and nothing tested it. It is the piece that
// was extracted first, because a token in an email is a bearer credential and
// every one of these is a property somebody has to be able to check:
//
//   the owner never sets a password
//   the token is hashed, never stored
//   the email has to match the invite
//   an expired invite is refused, and says so distinctly
//
// Every dependency is injected, so none of this stands up Supabase, Supabase
// Auth, Resend or the audit log. Each one is a function that records what it
// was asked to do, which is also how the assertions about what was NOT sent are
// possible at all.

const assert = require("node:assert/strict");
const { createBusinessEmployeeInvites, EMPLOYEE_INVITE_MAX_AGE_DAYS, REQUIRED } = require("../lib/sonara-business-employee-invites.cjs");

const ORG = "a1a1a1a1-0000-4000-8000-00000000001a";
const WORKSPACE = "b2b2b2b2-0000-4000-8000-00000000002b";
const OWNER = "c3c3c3c3-0000-4000-8000-00000000003c";
const NEW_USER = "d4d4d4d4-0000-4000-8000-00000000004d";

function build({
  inviteRow = { id: "inv-1" },
  insertOk = true,
  lookupRows = null,
  lookupOk = true,
  authResult = { ok: true, userId: NEW_USER },
  membershipOk = true,
  emailEnabled = true
} = {}) {
  const calls = { fetches: [], audits: [], auth: [] };

  const fetchImpl = async (url, init) => {
    const href = String(url);
    const method = String(init?.method || "GET").toUpperCase();
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.fetches.push({ href, method, body, headers: init?.headers || {} });

    if (href.includes("api.resend.com")) return { ok: emailEnabled, status: emailEnabled ? 200 : 403, json: async () => ({}) };
    if (href.includes("business_employee_invites") && method === "POST") {
      return { ok: insertOk, status: insertOk ? 201 : 502, json: async () => (insertOk ? [inviteRow] : null) };
    }
    if (href.includes("business_employee_invites") && method === "GET") {
      return { ok: lookupOk, status: lookupOk ? 200 : 502, json: async () => (lookupRows || []) };
    }
    if (href.includes("business_memberships")) return { ok: membershipOk, status: membershipOk ? 201 : 502, json: async () => [] };
    return { ok: true, status: 200, json: async () => [] };
  };

  const saved = global.fetch;
  global.fetch = fetchImpl;

  const invites = createBusinessEmployeeInvites({
    getSupabaseAdminClient: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
    supabaseHeaders: (config, options = {}) => ({ apikey: "server-only", ...(options.prefer ? { Prefer: options.prefer } : {}) }),
    // A real hash, so "the raw token was never written" is a claim about the
    // value and not about a stub that returns something different.
    hashInviteToken: (token) => require("node:crypto").createHash("sha256").update(String(token)).digest("hex"),
    getPublicAppUrl: () => "https://sonara.example",
    recordAdminAuditEvent: async (req, action, metadata) => { calls.audits.push({ action, metadata }); },
    isSupabaseConfigured: () => true,
    createEmployeeAuthUser: async (email, password) => { calls.auth.push({ email, password }); return authResult; },
    splitList: (value) => String(value || "").split(",").map((part) => part.trim()).filter(Boolean),
    getReadiness: () => ({ services: { emailDelivery: emailEnabled ? "enabled" : "setup_required" } }),
    getEnv: (name) => (name === "RESEND_API_KEY" ? "re_test" : "invites@sonara.example"),
    // The real escape, not a passthrough. An id rendered into the page is the
    // only untrusted value the form prints, and a stub that returned its input
    // would make the escaping assertion below vacuous.
    escapeHtml: (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  });

  return { invites, calls, restore: () => { global.fetch = saved; } };
}

const goodBody = {
  workspaceId: WORKSPACE, organizationId: ORG,
  email: "New.Person@Example.com", name: "New Person", role: "employee", permissions: "bookings,invoices"
};
// Every request here carries a verified membership, because the only route
// that reaches this module sits behind `requireBusinessManager`, which sets one.
// The tenant ids come from that row and not from the body -- see the
// cross-tenant block at the end of this file for what happened when they did.
const req = (body) => ({
  body,
  sonaraUser: { id: OWNER },
  sonaraBusinessMembership: { organization_id: ORG, workspace_id: WORKSPACE }
});

describe("an employee invite is a credential", () => {
  it("declares every dependency it needs, and refuses to be built without one", () => {
    assert.ok(REQUIRED.length >= 8, "the dependency list is short enough to be missing something");
    for (const missing of REQUIRED) {
      const deps = Object.fromEntries(REQUIRED.filter((name) => name !== missing).map((name) => [name, () => {}]));
      assert.throws(() => createBusinessEmployeeInvites(deps), new RegExp(missing),
        `it can be built without ${missing}, so a missing dependency becomes a crash at request time`);
    }
  });

  describe("the owner never sets a password", () => {
    it("refuses a request carrying one, under any of its names", async () => {
      // An owner who can set an employee's password can sign in as them, and
      // every audit trail after that point is wrong about who did the work.
      for (const field of ["password", "employeePassword", "temporaryPassword"]) {
        const { invites, calls, restore } = build();
        try {
          const result = await invites.createBusinessEmployeeInvite(req({ ...goodBody, [field]: "hunter2hunter2" }));
          assert.equal(result.status, 400);
          assert.equal(result.body.code, "password_not_allowed");
          assert.equal(calls.fetches.length, 0, `${field} was refused only after the invite had been written`);
        } finally { restore(); }
      }
    });
  });

  describe("the token is never stored", () => {
    it("writes a hash, and the link carries the only copy of the token", async () => {
      const { invites, calls, restore } = build();
      try {
        await invites.createBusinessEmployeeInvite(req(goodBody));
        const insert = calls.fetches.find((call) => call.method === "POST" && call.href.includes("business_employee_invites"));
        assert.ok(insert, "no invite was written");
        assert.ok(insert.body.token_hash, "no hash was written");

        const email = calls.fetches.find((call) => call.href.includes("api.resend.com"));
        const link = /token=([A-Za-z0-9_-]+)/.exec(email.body.text);
        assert.ok(link, "the invite email carries no token");

        const raw = decodeURIComponent(link[1]);
        assert.notEqual(insert.body.token_hash, raw, "the raw token was written to the table");
        assert.equal(
          insert.body.token_hash,
          require("node:crypto").createHash("sha256").update(raw).digest("hex"),
          "the stored hash is not the hash of the token that went out, so no invite could ever be accepted"
        );
      } finally { restore(); }
    });

    it("does not repeat a token", async () => {
      const seen = new Set();
      for (let round = 0; round < 40; round += 1) {
        const { invites, calls, restore } = build();
        try {
          await invites.createBusinessEmployeeInvite(req(goodBody));
          const email = calls.fetches.find((call) => call.href.includes("api.resend.com"));
          seen.add(/token=([A-Za-z0-9_-]+)/.exec(email.body.text)[1]);
        } finally { restore(); }
      }
      assert.equal(seen.size, 40, "two invites collided, so this is not random");
    });
  });

  describe("accepting one", () => {
    const tokenFor = (raw) => require("node:crypto").createHash("sha256").update(raw).digest("hex");
    const pending = (overrides = {}) => ({
      id: "inv-1", organization_id: ORG, workspace_id: WORKSPACE, role: "employee",
      status: "pending", invited_email: "new.person@example.com",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      ...overrides
    });

    it("creates the account and the membership", async () => {
      const { invites, calls, restore } = build({ lookupRows: [pending()] });
      try {
        const result = await invites.acceptBusinessEmployeeInvite({ token: "a-token", email: "new.person@example.com", password: "longenough1" });
        assert.equal(result.status, 200);
        assert.equal(result.body.code, "invite_accepted");
        const membership = calls.fetches.find((call) => call.href.includes("business_memberships"));
        assert.equal(membership.body.organization_id, ORG);
        assert.equal(membership.body.workspace_id, WORKSPACE);
        assert.equal(membership.body.user_id, NEW_USER);
        assert.equal(membership.body.role, "employee", "the role was taken from somewhere other than the invite");
      } finally { restore(); }
    });

    it("looks the invite up by the hash and never by the token", async () => {
      const { invites, calls, restore } = build({ lookupRows: [pending()] });
      try {
        await invites.acceptBusinessEmployeeInvite({ token: "a-token", email: "new.person@example.com", password: "longenough1" });
        const lookup = calls.fetches.find((call) => call.method === "GET" && call.href.includes("business_employee_invites"));
        assert.ok(lookup.href.includes(tokenFor("a-token")), "the lookup does not use the hash");
        assert.ok(!lookup.href.includes("token_hash=eq.a-token"), "the raw token was sent to the database");
      } finally { restore(); }
    });

    it("refuses somebody whose email is not the one invited, and creates nothing", async () => {
      // A token is a bearer credential. Without this, anybody who saw the link
      // takes the seat, and the business has an employee it never invited.
      const { invites, calls, restore } = build({ lookupRows: [pending()] });
      try {
        const result = await invites.acceptBusinessEmployeeInvite({ token: "a-token", email: "someone.else@example.com", password: "longenough1" });
        assert.equal(result.status, 403);
        assert.equal(result.body.code, "invite_email_mismatch");
        assert.equal(calls.auth.length, 0, "an account was created for somebody who was not invited");
        assert.ok(!calls.fetches.some((call) => call.href.includes("business_memberships")), "a membership was written");
      } finally { restore(); }
    });

    it("refuses an expired invite with its own code, so the page can offer a new one", async () => {
      const { invites, calls, restore } = build({ lookupRows: [pending({ expires_at: new Date(Date.now() - 1000).toISOString() })] });
      try {
        const result = await invites.acceptBusinessEmployeeInvite({ token: "a-token", email: "new.person@example.com", password: "longenough1" });
        assert.equal(result.status, 410);
        assert.equal(result.body.code, "invite_expired");
        assert.equal(calls.auth.length, 0);
      } finally { restore(); }
    });

    it("expires an invite a week out, not on a number typed at the call site", () => {
      assert.equal(EMPLOYEE_INVITE_MAX_AGE_DAYS, 7);
    });

    it("sets the expiry from that constant when the invite is made", async () => {
      const { invites, calls, restore } = build();
      try {
        const before = Date.now();
        await invites.createBusinessEmployeeInvite(req(goodBody));
        const insert = calls.fetches.find((call) => call.method === "POST" && call.href.includes("business_employee_invites"));
        const expires = Date.parse(insert.body.expires_at) - before;
        const week = EMPLOYEE_INVITE_MAX_AGE_DAYS * 86400000;
        assert.ok(Math.abs(expires - week) < 60000, `expiry was ${expires}ms out, not the ${week}ms the constant says`);
      } finally { restore(); }
    });

    it("refuses a password too short to be one, before reaching the database", async () => {
      const { invites, calls, restore } = build({ lookupRows: [pending()] });
      try {
        const result = await invites.acceptBusinessEmployeeInvite({ token: "a-token", email: "new.person@example.com", password: "short" });
        assert.equal(result.status, 400);
        assert.equal(calls.fetches.length, 0);
      } finally { restore(); }
    });

    it("says the invite was not found rather than that it was already used", async () => {
      // The lookup filters on status=pending, so an accepted invite and one
      // that never existed answer the same way. Telling them apart tells
      // somebody guessing tokens when they have guessed a real one.
      const { invites, restore } = build({ lookupRows: [] });
      try {
        const result = await invites.acceptBusinessEmployeeInvite({ token: "a-token", email: "new.person@example.com", password: "longenough1" });
        assert.equal(result.status, 404);
        assert.equal(result.body.code, "invite_not_found");
      } finally { restore(); }
    });

    it("does not write a membership when the account could not be created", async () => {
      const { invites, calls, restore } = build({ lookupRows: [pending()], authResult: { ok: false, status: 502, code: "auth_not_completed" } });
      try {
        const result = await invites.acceptBusinessEmployeeInvite({ token: "a-token", email: "new.person@example.com", password: "longenough1" });
        assert.equal(result.status, 502);
        assert.ok(!calls.fetches.some((call) => call.href.includes("business_memberships")),
          "a workspace seat was given to an account that does not exist");
      } finally { restore(); }
    });
  });

  describe("what it says when the email cannot go out", () => {
    it("still records the invite, and says delivery needs setting up", async () => {
      // The invite is the row, not the email. Reporting failure here would
      // leave an owner re-inviting somebody who already has a seat waiting.
      const { invites, restore } = build({ emailEnabled: false });
      try {
        const result = await invites.createBusinessEmployeeInvite(req(goodBody));
        assert.equal(result.status, 200);
        assert.equal(result.body.delivery, "setup_required");
        assert.match(result.body.message, /Email delivery setup is required/);
      } finally { restore(); }
    });

    it("reports a failure to record the invite as a failure", async () => {
      const { invites, restore } = build({ insertOk: false });
      try {
        const result = await invites.createBusinessEmployeeInvite(req(goodBody));
        assert.equal(result.status, 502);
        assert.equal(result.body.code, "invite_not_recorded");
      } finally { restore(); }
    });
  });

  describe("what the audit log is told", () => {
    it("records the invite without recording the address", async () => {
      const { invites, calls, restore } = build();
      try {
        await invites.createBusinessEmployeeInvite(req(goodBody));
        assert.equal(calls.audits.length, 1);
        const entry = calls.audits[0];
        assert.equal(entry.action, "business.employee_invite.created");
        assert.equal(entry.metadata.email_domain, "example.com");
        assert.ok(!JSON.stringify(entry.metadata).includes("new.person"),
          "the audit log keeps a copy of every invited person's email address");
      } finally { restore(); }
    });
  });

  describe("what it refuses to invite", () => {
    it("treats a missing role as employee, which is the lesser of the two", async () => {
      // Not a hole. No role given means the least the invite can grant, and a
      // default of "manager" is what a hole here would look like.
      const { invites, calls, restore } = build();
      try {
        assert.equal((await invites.createBusinessEmployeeInvite(req({ ...goodBody, role: "" }))).status, 200);
        const insert = calls.fetches.find((call) => call.method === "POST" && call.href.includes("business_employee_invites"));
        assert.equal(insert.body.role, "employee");
      } finally { restore(); }
    });

    it("refuses a role that is not one it grants", async () => {
      // "Manager " is in the list to pin that the check is case-sensitive after
      // trimming, rather than a normalisation that would also admit "OWNER".
      for (const role of ["owner", "admin", "Manager ", "supervisor"]) {
        const { invites, calls, restore } = build();
        try {
          const result = await invites.createBusinessEmployeeInvite(req({ ...goodBody, role }));
          assert.equal(result.status, 400, `accepted the role ${JSON.stringify(role)}`);
          assert.equal(calls.fetches.length, 0);
        } finally { restore(); }
      }
    });

    it("accepts the two roles it does grant, or every refusal above is vacuous", async () => {
      for (const role of ["manager", "employee"]) {
        const { invites, restore } = build();
        try {
          assert.equal((await invites.createBusinessEmployeeInvite(req({ ...goodBody, role }))).status, 200, `refused ${role}`);
        } finally { restore(); }
      }
    });

    it("refuses an address that is not one, and a name too short to be one", async () => {
      for (const body of [{ ...goodBody, email: "not-an-email" }, { ...goodBody, name: "A" }]) {
        const { invites, calls, restore } = build();
        try {
          assert.equal((await invites.createBusinessEmployeeInvite(req(body))).status, 400);
          assert.equal(calls.fetches.length, 0);
        } finally { restore(); }
      }
    });

    it("refuses a caller with no verified membership, rather than trusting the body", async () => {
      // This used to assert 400 on a request with no membership, because the
      // ids were read from the body and an empty one failed validation. It is
      // now 403: a caller whose tenant nobody confirmed is refused before the
      // fields are even looked at, which is the point of the fix.
      const { invites, calls, restore } = build();
      try {
        const result = await invites.createBusinessEmployeeInvite({ body: goodBody });
        assert.equal(result.status, 403);
        assert.equal(result.body.code, "membership_unverified");
        assert.equal(calls.fetches.length, 0, "nothing may be written for a caller whose business is unconfirmed");
      } finally { restore(); }
    });

    it("still refuses a platform admin who names neither, rather than inviting into nothing", async () => {
      // The admin override is the one caller allowed to name a tenant, so for
      // them the original validation is still the thing that has to hold.
      for (const body of [{ ...goodBody, workspaceId: "" }, { ...goodBody, organizationId: "" }]) {
        const { invites, restore } = build();
        try {
          const result = await invites.createBusinessEmployeeInvite({ body, sonaraAdmin: { ok: true }, sonaraBusinessMembership: {} });
          assert.equal(result.status, 400);
          assert.equal(result.body.code, "validation_failed");
        } finally { restore(); }
      }
    });

    it("lower-cases the invited address, so accepting is not case-sensitive", async () => {
      const { invites, calls, restore } = build();
      try {
        await invites.createBusinessEmployeeInvite(req(goodBody));
        const insert = calls.fetches.find((call) => call.method === "POST" && call.href.includes("business_employee_invites"));
        assert.equal(insert.body.invited_email, "new.person@example.com");
      } finally { restore(); }
    });
  });
  // The invite named its own tenant, and the tenant is the security boundary.
  //
  // `organizationId` came from the request body with the verified membership as
  // a fallback. `requireBusinessManager` verifies the caller against
  // `workspace_id` ONLY -- `getBusinessWorkspaceId` never reads the
  // organization -- so a legitimate manager of their own workspace could name
  // somebody else's business and have it accepted.
  //
  // It does not stop at a stray row. `acceptBusinessEmployeeInvite` copies the
  // invite's `organization_id` into an **active** `business_memberships` row,
  // and `getCustomerPrimaryOrganization` returns that column straight back as
  // the organization a signed-in customer belongs to.
  //
  // Found by `pnpm run report:selected-columns`: `organization_id` was in the
  // membership query's select list and read by nothing, which is defect three
  // in `.claude/skills/checks-that-cannot-lie` -- **being selected is what made
  // it look checked**.
  describe("the business an invite joins is the one that was verified", () => {
    const OTHER_ORG = "e5e5e5e5-0000-4000-8000-00000000005e";
    const OTHER_WORKSPACE = "f6f6f6f6-0000-4000-8000-00000000006f";

    function inviteRowFrom(calls) {
      const insert = calls.fetches.find((call) => call.href.includes("business_employee_invites") && call.method === "POST");
      assert.ok(insert, "no invite was written, so there is no tenant to check");
      return insert.body;
    }

    it("writes the verified organization, not the one the body asked for", async () => {
      const { invites, calls, restore } = build();
      try {
        const result = await invites.createBusinessEmployeeInvite(req({ ...goodBody, organizationId: ORG }));
        assert.equal(result.status, 200);
        assert.equal(inviteRowFrom(calls).organization_id, ORG, "the matching case must still work, or the refusal below proves nothing");
      } finally { restore(); }
    });

    it("refuses an invite that names another business", async () => {
      const { invites, calls, restore } = build();
      try {
        const result = await invites.createBusinessEmployeeInvite(req({ ...goodBody, organizationId: OTHER_ORG }));
        assert.equal(result.status, 403, "a manager naming another organization must be refused");
        assert.equal(result.body.code, "tenant_mismatch");
        assert.equal(calls.fetches.length, 0, "and nothing may be written, not even an invite that is never accepted");
      } finally { restore(); }
    });

    it("refuses an invite that names another workspace", async () => {
      const { invites, calls, restore } = build();
      try {
        const result = await invites.createBusinessEmployeeInvite(req({ ...goodBody, workspaceId: OTHER_WORKSPACE }));
        assert.equal(result.status, 403);
        assert.equal(result.body.code, "tenant_mismatch");
        assert.equal(calls.fetches.length, 0);
      } finally { restore(); }
    });

    it("refuses the snake_case spelling too, since both are read", async () => {
      // The body is read as `organizationId || organization_id`. A check that
      // only covered one spelling would leave the other open, and the original
      // code accepted both.
      for (const body of [
        { ...goodBody, organizationId: undefined, organization_id: OTHER_ORG },
        { ...goodBody, workspaceId: undefined, workspace_id: OTHER_WORKSPACE }
      ]) {
        const { invites, restore } = build();
        try {
          const result = await invites.createBusinessEmployeeInvite(req(body));
          assert.equal(result.status, 403, `${JSON.stringify(body)} was accepted`);
          assert.equal(result.body.code, "tenant_mismatch");
        } finally { restore(); }
      }
    });

    it("takes the tenant from the membership when the body names none at all", async () => {
      // The legitimate form no longer submits either id, so this is now the
      // ordinary path rather than an edge case.
      const { invites, calls, restore } = build();
      try {
        const body = { ...goodBody };
        delete body.workspaceId;
        delete body.organizationId;
        const result = await invites.createBusinessEmployeeInvite(req(body));
        assert.equal(result.status, 200);
        const written = inviteRowFrom(calls);
        assert.equal(written.organization_id, ORG);
        assert.equal(written.workspace_id, WORKSPACE);
      } finally { restore(); }
    });

    it("lets a platform admin name a tenant, because they administer all of them", async () => {
      const { invites, calls, restore } = build();
      try {
        const result = await invites.createBusinessEmployeeInvite({
          body: { ...goodBody, organizationId: OTHER_ORG, workspaceId: OTHER_WORKSPACE },
          sonaraUser: { id: OWNER },
          sonaraAdmin: { ok: true },
          sonaraBusinessMembership: {}
        });
        assert.equal(result.status, 200, "the admin override must keep working, or this fix breaks the owner");
        const written = inviteRowFrom(calls);
        assert.equal(written.organization_id, OTHER_ORG);
        assert.equal(written.workspace_id, OTHER_WORKSPACE);
      } finally { restore(); }
    });

    it("does not accept a claim of being an admin from anywhere but the middleware", async () => {
      // `sonaraAdmin` is set by `requireBusinessManager` only after
      // `isSupabaseAdminUser` passes, and it is a request property rather than
      // body input -- but the check reads a truthy `ok`, so this pins that a
      // body field cannot supply it.
      const { invites, restore } = build();
      try {
        const result = await invites.createBusinessEmployeeInvite(req({
          ...goodBody,
          organizationId: OTHER_ORG,
          sonaraAdmin: { ok: true },
          admin: true
        }));
        assert.equal(result.status, 403, "an admin flag inside the body must not widen the tenant");
        assert.equal(result.body.code, "tenant_mismatch");
      } finally { restore(); }
    });

    it("carries the refused organization nowhere, including the audit event", async () => {
      // A refusal that still records the attempted tenant would put another
      // organization's id in this organization's audit trail.
      const { invites, calls, restore } = build();
      try {
        await invites.createBusinessEmployeeInvite(req({ ...goodBody, organizationId: OTHER_ORG }));
        assert.equal(calls.audits.length, 0, "nothing happened, so nothing is audited");
        assert.equal(JSON.stringify(calls.fetches).includes(OTHER_ORG), false);
      } finally { restore(); }
    });

    it("shows what an accepted invite would have granted, so the severity is on the record", async () => {
      // Not a test of the fix -- a test of what the fix prevented, run through
      // the accept path that copies the invite's organization into a membership.
      // If this stops being true the comment above is stale.
      const { invites, calls, restore } = build({
        lookupRows: [{
          id: "inv-2",
          organization_id: OTHER_ORG,
          workspace_id: WORKSPACE,
          role: "manager",
          status: "pending",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          invited_email: "new.person@example.com"
        }]
      });
      try {
        const result = await invites.acceptBusinessEmployeeInvite({
          token: "any-token", email: "new.person@example.com", password: "correct horse battery"
        });
        assert.equal(result.status, 200);
        const membership = calls.fetches.find((call) => call.href.includes("business_memberships") && call.method === "POST");
        assert.ok(membership, "accepting an invite must write a membership, or this reasoning is wrong");
        assert.equal(membership.body.organization_id, OTHER_ORG, "the invite's organization is copied verbatim into an active membership");
        assert.equal(membership.body.status, "active");
      } finally { restore(); }
    });
  });

  // The form used to ask a manager to type both ids into required free-text
  // boxes. Two faults in one control: a manager who does not know their own
  // business's UUID could not use the page, and one who typed somebody else's
  // had it accepted, because the module read the body before the membership.
  //
  // These assertions are possible at all because the fix pushed server.js past
  // its line ceiling, and the ratchet asking for a reason turned "raise the
  // number" into "move the function here".
  describe("the invite form does not ask a manager which business they run", () => {
    it("renders no tenant inputs for a verified membership", () => {
      const { invites, restore } = build();
      try {
        const html = invites.businessEmployeeInviteForm({ organization_id: ORG, workspace_id: WORKSPACE });
        assert.ok(!html.includes('name="organizationId"'), "the organization must not be typed in; it is known");
        assert.ok(!html.includes('name="workspaceId"'), "nor the workspace");
        assert.ok(html.includes(ORG), "and the page should say which business the invite joins");
        assert.ok(html.includes(WORKSPACE));
      } finally { restore(); }
    });

    it("still collects the rest of the invite, so the form is not simply broken", () => {
      const { invites, restore } = build();
      try {
        const html = invites.businessEmployeeInviteForm({ organization_id: ORG, workspace_id: WORKSPACE });
        for (const field of ['name="email"', 'name="name"', 'name="role"', 'name="permissions"']) {
          assert.ok(html.includes(field), `${field} is missing; the form no longer works`);
        }
        assert.ok(html.includes('action="/api/business-builder/employees/invite"'));
      } finally { restore(); }
    });

    it("offers the inputs to a caller with no membership, which is the admin override", () => {
      // `requireBusinessManager` hands a platform admin an empty membership, and
      // they legitimately administer every business -- so for them the fields
      // are the only way to say which one. Without this branch the fix would
      // have quietly removed the owner's ability to invite anybody.
      const { invites, restore } = build();
      try {
        const html = invites.businessEmployeeInviteForm({});
        assert.ok(html.includes('name="organizationId"'), "an admin has no membership to derive the tenant from");
        assert.ok(html.includes('name="workspaceId"'));
      } finally { restore(); }
    });

    it("treats a missing membership the same as an empty one", () => {
      const { invites, restore } = build();
      try {
        for (const membership of [undefined, null, {}, { workspace_id: WORKSPACE }]) {
          const html = invites.businessEmployeeInviteForm(membership);
          assert.ok(html.includes('name="organizationId"'), `${JSON.stringify(membership)} has no organization, so it must be asked for`);
        }
      } finally { restore(); }
    });

    it("escapes an id rather than printing it into the page", () => {
      // The ids come from the database, but they are printed into HTML and the
      // membership row is written by the invite flow -- so this is the one place
      // a stored value reaches a page unmediated.
      const { invites, restore } = build();
      try {
        const html = invites.businessEmployeeInviteForm({
          organization_id: '"><script>alert(1)</script>',
          workspace_id: WORKSPACE
        });
        assert.ok(!html.includes("<script>"), "an id must not be able to open a tag");
        assert.ok(html.includes("&lt;script&gt;"));
      } finally { restore(); }
    });
  });

});
