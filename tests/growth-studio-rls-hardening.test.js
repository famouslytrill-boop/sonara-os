"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "migrations", "20260723120000_growth_studio_control_plane.sql"),
  "utf8"
).toLowerCase();

const tables = [
  "growth_provider_connections",
  "growth_audience_segments",
  "growth_contact_consents",
  "growth_touchpoints",
  "growth_conversions",
  "growth_content_queue",
  "growth_provider_jobs",
  "growth_metric_snapshots",
  "growth_experiment_variants",
  "growth_control_events"
];

describe("Growth Studio RLS and evidence hardening", () => {
  it("creates every reviewed extension table and enables RLS", () => {
    for (const table of tables) {
      assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
      assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.match(migration, new RegExp(`'${table}'`));
    }
    assert.match(migration, /public\.sonara_is_org_member\(organization_id\)/);
    assert.match(migration, /auth\.role\(\) = ''service_role''/);
  });

  it("keeps Growth Studio control-plane writes server-only", () => {
    for (const table of tables) {
      assert.match(migration, new RegExp(`revoke insert, update, delete on public\\.${table} from anon, authenticated`));
    }
  });

  it("stores only an opaque credential reference and hides it from Data API members", () => {
    assert.match(migration, /credential_reference text/);
    assert.match(migration, /revoke select \(credential_reference\) on public\.growth_provider_connections from anon, authenticated/);
    assert.doesNotMatch(migration, /api_key\s+text|secret_key\s+text|access_token\s+text|refresh_token\s+text/i);
  });

  it("preserves consent, attribution confidence, approval, sampling, and audit evidence", () => {
    assert.match(migration, /purpose- and channel-specific consent evidence/);
    assert.match(migration, /attribution_model text not null/);
    assert.match(migration, /attribution_confidence text not null/);
    assert.match(migration, /approval_required boolean not null default false/);
    assert.match(migration, /sampled boolean not null default false/);
    assert.match(migration, /append-only growth studio operational/);
    assert.match(migration, /notify pgrst, 'reload schema'/);
  });
});
