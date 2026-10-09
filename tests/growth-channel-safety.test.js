// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  blockState, visibleDirectory, moderationInput, MAX_BLOCKED, ACTIONS
} = require("../lib/sonara-growth-channel-safety.cjs");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const OWNER = "33333333-3333-4333-8333-333333333333";
const ORG = "44444444-4444-4444-8444-444444444444";

describe("authenticated block and moderation decisions", () => {
  it("uses viewer-specific blocks and suppresses blocked channels", () => {
    assert.deepEqual(blockState([{ channel_id: A }], A), { ok: true, blocked: true });
    assert.deepEqual(blockState([{ channel_id: A }], B), { ok: true, blocked: false });
    const rows = [
      { channel_id: A, handle: "one" },
      { channel_id: B, handle: "two" }
    ];
    assert.deepEqual(visibleDirectory(rows, [{ channel_id: A }]).rows, [rows[1]]);
    assert.deepEqual(visibleDirectory(rows, []).rows, rows);
  });

  it("cannot silently discard a failed or truncated saved block read", () => {
    for (const invalid of [null, undefined, "none", [{ channel_id: "bad" }],
      Array.from({ length: MAX_BLOCKED + 1 }, () => ({ channel_id: A }))]) {
      assert.equal(blockState(invalid, A).ok, false);
      assert.equal(visibleDirectory([{ channel_id: A }], invalid).ok, false);
      assert.deepEqual(visibleDirectory([{ channel_id: A }], invalid).rows, []);
    }
  });

  it("requires an exact tenant, post and actor for every moderation action", () => {
    for (const action of ACTIONS) {
      const safe = moderationInput({
        action, postId: A, ownedPostId: A,
        actorId: OWNER, organizationId: ORG, ownedOrganizationId: ORG
      });
      assert.equal(safe.ok, true);
      assert.equal(safe.operation, action);
    }
    const args = { action: "remove", postId: A, ownedPostId: A,
      actorId: OWNER, organizationId: ORG, ownedOrganizationId: ORG };
    assert.equal(moderationInput({ ...args, ownedPostId: B }).ok, false);
    assert.equal(moderationInput({ ...args, ownedOrganizationId: B }).ok, false);
    assert.equal(moderationInput({ ...args, actorId: "fake" }).ok, false);
    assert.equal(moderationInput({ ...args, action: "destroy" }).ok, false);
  });

  it("documents the database-grant and reviewer requirement, without claiming migration applied", () => {
    const sql = fs.readFileSync(path.join(__dirname, "..", "docs/sql-proposals",
      "2026-10-09-growth-channel-blocking-moderation.sql"), "utf8");
    assert.match(sql, /security invoker/i);
    assert.match(sql, /organization_memberships/);
    assert.match(sql, /m\.role in \('owner', 'admin'\)/);
    assert.match(sql, /for update/);
    assert.match(sql, /grant execute on function.*to service_role/i);
    assert.match(sql, /revoke all on public\.growth_channel_blocks from public, anon, authenticated/i);
    assert.match(sql, /insert into public\.growth_channel_moderation_events/i);
    assert.doesNotMatch(sql, /security definer/i);
  });

  it("does not expose anonymous reporter identity through added report columns", () => {
    const sql = fs.readFileSync(path.join(__dirname, "..", "docs/sql-proposals",
      "2026-10-09-growth-channel-blocking-moderation.sql"), "utf8");
    assert.doesNotMatch(sql, /alter table public\.growth_post_reports\s+add column.*(email|ip|reporter)/i);
  });
});

describe("Supabase tenant firewall: blocked channel actor-scope enforcement", () => {
  const { inspect } = require("../lib/sonara-tenant-guard.cjs");
  const root = "https://database.example.invalid/rest/v1/growth_channel_blocks";
  const allowed = root + "?select=channel_id&viewer_user_id=eq." + OWNER + "&limit=501";

  it("admits only the exact per-user block read and exact writes", () => {
    assert.equal(inspect("GET", allowed).allowed, true);
    assert.equal(inspect("DELETE", root + "?viewer_user_id=eq." + OWNER + "&channel_id=eq." + A).allowed, true);
    const payload = JSON.stringify({ viewer_user_id: OWNER, channel_id: A });
    assert.equal(inspect("POST", root + "?on_conflict=viewer_user_id,channel_id", payload).allowed, true);
  });
  it("refuses account enumeration, wildcard reads, unrestricted deletes and injected writes", () => {
    for (const url of [
      root + "?select=*",
      root + "?select=channel_id&limit=501",
      root + "?select=viewer_user_id&viewer_user_id=eq." + OWNER + "&limit=501",
      root + "?select=channel_id&viewer_user_id=neq." + OWNER + "&limit=501",
      root + "?viewer_user_id=eq." + OWNER
    ]) assert.equal(inspect("GET", url).allowed, false, url);
    assert.equal(inspect("DELETE", root + "?viewer_user_id=eq." + OWNER).allowed, false);
    assert.equal(inspect("POST", root + "?on_conflict=viewer_user_id,channel_id",
      JSON.stringify({ viewer_user_id: OWNER, channel_id: A, is_admin: true })).allowed, false);
  });
});
