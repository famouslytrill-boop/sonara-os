"use strict";

// The two ways to reach Supabase, and the rule for choosing between them.
//
// CRIT-3 item (2). A user-scoped client forwards the caller's own token so
// Postgres evaluates RLS with auth.uid() set to that user. It is the only
// boundary here the application cannot talk its way past -- the tenant guard
// checks that a query names *an* organization, and cannot tell whether it is
// the right one.
//
// Most of what follows is about the ways this goes wrong quietly: sending the
// service-role key where a caller token belongs, or switching a table over
// before it has a policy that returns rows.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  serviceRoleHeaders,
  userScopedHeaders,
  chooseClient,
  requireVerifiedUserScopedRead,
  isVerifiedUserScopedRead,
  SupabaseClientError
} = require("../lib/sonara-supabase-clients.cjs");

const CONFIG = {
  url: "https://project.supabase.co",
  serviceRoleKey: "service-role-key",
  anonKey: "anon-key"
};

describe("service-role headers", () => {
  it("carries the service-role key", () => {
    const headers = serviceRoleHeaders(CONFIG);
    assert.equal(headers.apikey, "service-role-key");
    assert.equal(headers.Authorization, "Bearer service-role-key");
  });

  it("refuses to build headers with no key rather than sending none", () => {
    assert.throws(() => serviceRoleHeaders({ url: CONFIG.url }), SupabaseClientError);
  });
});

describe("user-scoped headers", () => {
  it("sends the caller's token as the bearer and the publishable key as the apikey", () => {
    // If the service-role key went in apikey, PostgREST would have a reason to
    // ignore policies again and the whole point would be quietly undone.
    const headers = userScopedHeaders(CONFIG, "caller-access-token");
    assert.equal(headers.Authorization, "Bearer caller-access-token");
    assert.equal(headers.apikey, "anon-key");
    assert.notEqual(headers.apikey, CONFIG.serviceRoleKey);
  });

  it("never lets the service-role key stand in for a caller token", () => {
    // This is the mistake that would look like a user-scoped read in every log
    // and behave like an unrestricted one.
    assert.throws(
      () => userScopedHeaders(CONFIG, CONFIG.serviceRoleKey),
      (error) => error instanceof SupabaseClientError && /never be used as a caller access token/.test(error.message)
    );
  });

  it("refuses an empty or missing token instead of falling back", () => {
    for (const token of [undefined, null, "", "   "]) {
      assert.throws(() => userScopedHeaders(CONFIG, token), SupabaseClientError, `token ${JSON.stringify(token)} must be refused`);
    }
  });

  it("says which environment variable is missing when there is no publishable key", () => {
    assert.throws(
      () => userScopedHeaders({ url: CONFIG.url, serviceRoleKey: "k" }, "token"),
      (error) => /NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(error.message)
    );
  });
});

describe("choosing a client", () => {
  const ready = new Set(["service_requests", "launch_checklist_items"]);

  it("reads as the caller when the table is ready and there is a session", () => {
    const decision = chooseClient({ method: "GET", table: "service_requests", accessToken: "t", readyTables: ready });
    assert.equal(decision.client, "user");
  });

  it("keeps writes on service-role", () => {
    // A write's scope is established server-side from the session, not from
    // what the requester sent.
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const decision = chooseClient({ method, table: "service_requests", accessToken: "t", readyTables: ready });
      assert.equal(decision.client, "service_role", `${method} must not run as the caller`);
    }
  });

  it("stays on service-role for a table with no member-readable policy", () => {
    // The failure this prevents is a blank screen, not a leak: RLS would deny
    // every row and the page would look like the customer has no data.
    const decision = chooseClient({ method: "GET", table: "inventory_items", accessToken: "t", readyTables: ready });
    assert.equal(decision.client, "service_role");
    assert.match(decision.reason, /no member-readable policy yet/);
  });

  it("stays on service-role when nobody is signed in", () => {
    const decision = chooseClient({ method: "GET", table: "service_requests", accessToken: null, readyTables: ready });
    assert.equal(decision.client, "service_role");
  });

  it("stays on service-role when the ready list is missing entirely", () => {
    // Defaulting to "user" here would switch every table over at once the
    // first time somebody forgot to pass the list.
    const decision = chooseClient({ method: "GET", table: "service_requests", accessToken: "t" });
    assert.equal(decision.client, "service_role");
  });
});

describe("the policies that make user-scoped reads possible", () => {
  // Read whichever migration the generator currently writes, rather than naming
  // one here. 20260728120000 is already applied in production and cannot be
  // edited -- supabase db push tracks migrations by filename -- so the generator
  // emits a new file when the table list grows. A hardcoded path here would keep
  // asserting against the old one and pass while the new policies went
  // unchecked.
  const generatorPath = path.join(__dirname, "..", "scripts", "generate-member-read-policies.cjs");
  const migrationName = /const migrationName = "([^"]+)"/.exec(fs.readFileSync(generatorPath, "utf8"))[1];
  const migration = path.join(__dirname, "..", "supabase", "migrations", migrationName);
  const sql = fs.readFileSync(migration, "utf8");
  const { ORGANIZATION_READ_TABLES, PERSONAL_READ_TABLES } = require("../scripts/generate-member-read-policies.cjs");

  it("covers every table it claims to", () => {
    for (const table of [...ORGANIZATION_READ_TABLES, ...PERSONAL_READ_TABLES]) {
      assert.ok(sql.includes(`public.${table}`), `${table} is listed but has no policy in the migration`);
    }
  });

  it("leaves legacy-shaped tables untouched when the required scope column is absent", () => {
    for (const table of ORGANIZATION_READ_TABLES) {
      const block = sql.slice(sql.indexOf(`to_regclass('public.${table}')`));
      const policy = block.indexOf(`create policy "${table}_select_member"`);
      const columnGuard = block.indexOf(`and column_name = 'organization_id'`);
      assert.ok(columnGuard >= 0 && columnGuard < policy, `${table} must verify organization_id before changing RLS`);
    }
    for (const table of PERSONAL_READ_TABLES) {
      const block = sql.slice(sql.indexOf(`to_regclass('public.${table}')`));
      const policy = block.indexOf(`create policy "${table}_select_own"`);
      const columnGuard = block.indexOf(`and column_name = 'user_id'`);
      assert.ok(columnGuard >= 0 && columnGuard < policy, `${table} must verify user_id before changing RLS`);
    }
  });

  it("scopes organization tables by membership", () => {
    for (const table of ORGANIZATION_READ_TABLES) {
      assert.match(
        sql,
        new RegExp(`create policy "${table}_select_member" on public\\.${table} for select to authenticated using \\(public\\.is_org_member\\(organization_id\\)\\)`),
        `${table} must be readable only by members of the owning organization`
      );
    }
  });

  it("scopes personal tables to the person, not the organization", () => {
    // These carry organization_id, so a membership predicate would compile and
    // let a colleague read somebody else's notifications.
    for (const table of PERSONAL_READ_TABLES) {
      assert.match(
        sql,
        new RegExp(`create policy "${table}_select_own" on public\\.${table} for select to authenticated using \\(auth\\.uid\\(\\) = user_id\\)`),
        `${table} holds one person's rows and must not be readable by the whole organization`
      );
    }
    for (const table of PERSONAL_READ_TABLES) {
      assert.ok(!sql.includes(`${table}_select_member`), `${table} must not also have a membership-wide policy`);
    }
  });

  it("grants only SELECT, and only to authenticated", () => {
    // Anything wider would be a change to how the application behaves today,
    // not a preparation for a later one.
    const created = [...sql.matchAll(/create policy "[^"]+" on public\.[a-z0-9_]+ for (\w+) to (\w+)/g)];
    assert.ok(created.length >= 33, `expected a policy per table, found ${created.length}`);
    for (const [, action, role] of created) {
      assert.equal(action, "select");
      assert.equal(role, "authenticated");
    }
  });

  it("drops nothing that already exists", () => {
    // Every drop must name a policy this migration is about to create. A drop
    // of anything else would remove protection rather than add it.
    for (const match of sql.matchAll(/drop policy if exists "([^"]+)"/g)) {
      assert.match(
        match[1],
        /_select_(member|own)$/,
        `${match[1]} is not one of this migration's own policies and must not be dropped`
      );
    }
  });

  it("refuses to run if the membership helper is missing", () => {
    // Without is_org_member every generated policy would evaluate to an error
    // or deny everything, which is worse than not creating them.
    assert.match(sql, /is_org_member\(\) is missing; member policies would deny every row/);
  });

  it("skips a table that is not there rather than failing the whole migration", () => {
    assert.match(sql, /to_regclass\('public\.[a-z0-9_]+'\) is null/);
    assert.match(sql, /raise notice 'skipping/);
  });
});


describe("fail-closed scoped evidence reads (new learning-adapter preflight)", () => {
  const org = "11111111-1111-4111-8111-111111111111";
  const user = "22222222-2222-4222-8222-222222222222";
  const liveProof = Object.freeze({
    status: "verified_live_user_rls",
    table: "sonara_learning_aggregates",
    organizationId: org,
    userId: user,
    grantVerified: true,
    sameTenantReadVerified: true,
    crossTenantDeniedVerified: true,
    measuredAt: "2026-10-09T12:00:00.000Z"
  });
  const valid = Object.freeze({
    config: CONFIG,
    accessToken: "verified-user-access-token",
    table: liveProof.table,
    organizationId: org,
    serverOrganizationId: org,
    userId: user,
    serverUserId: user,
    liveProof,
    trustedNow: "2026-10-09T13:00:00.000Z"
  });

  it("returns only a caller-scoped GET; never falls back to service role", () => {
    const answer = requireVerifiedUserScopedRead(valid);
    assert.equal(answer.client, "user");
    assert.equal(answer.mode, "rls_scoped_read_only");
    assert.equal(answer.serviceRoleFallbackAllowed, false);
    assert.equal(answer.method, "GET");
    assert.equal(answer.headers.apikey, CONFIG.anonKey);
    assert.equal(answer.headers.Authorization, "Bearer verified-user-access-token");
    assert.notEqual(answer.headers.apikey, CONFIG.serviceRoleKey);
  });

  it("brands real selector results and hides bearer credentials from serialization", () => {
    const selected = requireVerifiedUserScopedRead(valid);
    const scope = { table: valid.table, organizationId: org, userId: user };
    assert.equal(isVerifiedUserScopedRead(selected, scope), true);
    assert.equal(isVerifiedUserScopedRead(selected, { ...scope, organizationId: user }), false);
    assert.equal(Object.hasOwn(selected, "headers"), true);
    assert.equal(Object.keys(selected).includes("headers"), false);
    assert.equal(JSON.stringify(selected).includes(valid.accessToken), false);
    assert.equal(selected.headers.Authorization, "Bearer " + valid.accessToken);

    for (const clone of [
      { ...selected }, Object.assign({}, selected),
      JSON.parse(JSON.stringify(selected)), { ...selected, headers: selected.headers }
    ]) {
      assert.equal(isVerifiedUserScopedRead(clone, scope), false);
    }
  });

  it("rejects failed or forged scope, unauthorized credentials, and RLS proof failures", () => {
    for (const bad of [
      { accessToken: null }, { accessToken: CONFIG.serviceRoleKey },
      { accessToken: CONFIG.anonKey }, { config: { ...CONFIG, anonKey: CONFIG.serviceRoleKey } },
      { config: { ...CONFIG, anonKey: "" } },
      { table: "other_table" }, { table: "bad.table" },
      { organizationId: user }, { serverOrganizationId: user },
      { userId: org }, { serverUserId: org },
      { liveProof: null },
      { liveProof: { ...liveProof, status: "pending" } },
      { liveProof: { ...liveProof, grantVerified: false } },
      { liveProof: { ...liveProof, sameTenantReadVerified: false } },
      { liveProof: { ...liveProof, crossTenantDeniedVerified: false } },
      { liveProof: { ...liveProof, organizationId: user } },
      { liveProof: { ...liveProof, userId: org } },
      { liveProof: { ...liveProof, table: "another_table" } },
      { trustedNow: "bad" },
      { liveProof: { ...liveProof, measuredAt: "yesterday" } },
      { liveProof: { ...liveProof, measuredAt: "2026-10-09T13:30:00.000Z" } },
      { trustedNow: "2026-10-11T14:00:00.000Z" }
    ]) {
      assert.throws(
        () => requireVerifiedUserScopedRead({ ...valid, ...bad }),
        error => error instanceof SupabaseClientError
          && error.message === "verified user-scoped evidence read unavailable",
        JSON.stringify(bad)
      );
    }
  });

  it("does not change legacy chooseClient fallback behavior for existing routes", () => {
    assert.equal(chooseClient({
      method: "GET", table: "sonara_learning_aggregates",
      accessToken: "", readyTables: new Set([liveProof.table])
    }).client, "service_role");
    assert.throws(() => requireVerifiedUserScopedRead({ ...valid, accessToken: "" }),
      SupabaseClientError);
  });
});
