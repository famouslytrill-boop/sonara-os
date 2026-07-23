"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "migrations", "20260723080000_creator_generation_control_plane.sql"),
  "utf8"
).toLowerCase();

describe("Creator Studio generation RLS hardening", () => {
  it("keeps provider state, private assets, analyses, and events server-written", () => {
    const serverWrittenTables = [
      "creator_generation_jobs",
      "creator_generation_assets",
      "creator_reference_analyses",
      "creator_generation_events"
    ];
    for (const table of serverWrittenTables) {
      assert.match(migration, new RegExp(`revoke insert, update, delete on public\\.${table} from anon, authenticated`));
      assert.match(migration, new RegExp(`'${table}'`));
    }
    assert.match(migration, /create policy "service role manages %1\$s"/);
    assert.match(migration, /auth\.role\(\) = ''service_role''/);
  });

  it("limits voice-consent evidence to the subject or an organization owner/admin", () => {
    assert.match(migration, /drop policy if exists "creator members read creator_voice_consents"/);
    assert.match(migration, /auth\.uid\(\) = user_id or public\.is_org_owner_or_admin\(organization_id\)/);
    assert.match(migration, /revoke delete on public\.creator_voice_consents from anon, authenticated/);
  });

  it("preserves PostgREST schema visibility after the additive migration", () => {
    assert.match(migration, /notify pgrst, 'reload schema'/);
  });
});
