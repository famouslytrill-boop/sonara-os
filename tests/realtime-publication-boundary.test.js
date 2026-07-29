"use strict";

// If a table is ever published to realtime, it must be one RLS can defend.
//
// Nothing is published today and nothing subscribes -- lib/sonara-ecosystem-manifest.cjs
// declares channel names, and supabase/migrations creates
// sonara_realtime_channel_registry, but neither is wired to a live subscription.
// So this is preventive rather than a fix.
//
// The trap it guards is specific. Supabase Realtime broadcasts row changes to
// every subscriber, and it applies Row Level Security only when RLS is enabled
// on the table. Adding a tenant table to the supabase_realtime publication
// without RLS therefore streams every organization's rows to every listener --
// a cross-tenant leak that no query-string filter can prevent, because the
// application never issues the query. It would not show up in any of the
// tenant-guard tests, which inspect outbound PostgREST calls.
//
// The check is cheap and the failure is severe, which is the whole argument for
// writing it before the feature exists rather than after.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function migrations() {
  const dir = path.join(root, "supabase", "migrations");
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(dir, name), "utf8") }));
}

// `alter publication supabase_realtime add table public.foo, public.bar;`
function publishedTables() {
  const published = new Map();
  for (const migration of migrations()) {
    const pattern = /alter\s+publication\s+supabase_realtime\s+add\s+table\s+([^;]+);/gi;
    for (const match of migration.sql.matchAll(pattern)) {
      for (const raw of match[1].split(",")) {
        const table = raw.trim().replace(/^public\./, "").replace(/["`]/g, "");
        if (table) published.set(table, migration.name);
      }
    }
  }
  return published;
}

describe("the realtime publication cannot leak across tenants", () => {
  it("publishes nothing that row level security is not enabled on", () => {
    // Realtime enforces RLS only where RLS is on. Without it the publication is
    // a firehose of every organization's rows.
    const sql = migrations().map((migration) => migration.sql).join("\n");
    const offenders = [];

    for (const [table, migration] of publishedTables()) {
      const rlsOn = new RegExp(`alter table (?:if exists )?public\\.${table} enable row level security`, "i").test(sql);
      if (!rlsOn) offenders.push(`${table} (published in ${migration})`);
    }

    assert.deepEqual(
      offenders,
      [],
      `These tables are published to supabase_realtime with RLS off, so every subscriber receives every organization's rows:\n  ${offenders.join("\n  ")}\n\n` +
        "Enable RLS and give the table a policy before publishing it, or do not publish it."
    );
  });

  it("publishes nothing a signed-in member has no policy for", () => {
    // RLS enabled with no SELECT policy is the other half: subscribers get
    // nothing, which is safe but silently broken. Either is worth knowing.
    const sql = migrations().map((migration) => migration.sql).join("\n");
    const unreadable = [];

    for (const [table] of publishedTables()) {
      const hasSelectPolicy = new RegExp(
        `create policy "[^"]*" on public\\.${table} for select to authenticated`,
        "i"
      ).test(sql);
      if (!hasSelectPolicy) unreadable.push(table);
    }

    assert.deepEqual(
      unreadable,
      [],
      `These tables are published to realtime but no signed-in member has a SELECT policy for them, so subscriptions will deliver nothing:\n  ${unreadable.join("\n  ")}`
    );
  });

  it("still describes the realtime surface as declared rather than built", () => {
    // The manifest lists channel names. If something starts subscribing, the
    // two tests above stop being hypothetical and this one should be revisited
    // deliberately rather than left as a stale reassurance.
    const manifest = fs.readFileSync(path.join(root, "lib", "sonara-ecosystem-manifest.cjs"), "utf8");
    assert.match(manifest, /realtimeChannels/, "the manifest is where the channel names live");

    const runtimeFiles = [path.join(root, "server.js")];
    for (const dir of ["lib", "routes", "public"]) {
      const base = path.join(root, dir);
      if (!fs.existsSync(base)) continue;
      const walk = (current) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.(cjs|js|mjs)$/.test(entry.name)) runtimeFiles.push(full);
        }
      };
      walk(base);
    }

    const subscribing = runtimeFiles.filter((file) => /\.channel\(|removeChannel\(|supabase\.realtime/.test(fs.readFileSync(file, "utf8")));
    assert.deepEqual(
      subscribing.map((file) => path.relative(root, file)),
      [],
      "Something now subscribes to realtime. That is fine, but the two checks above are no longer hypothetical -- confirm the published tables carry RLS and a member policy, and update this test to match."
    );
  });
});
