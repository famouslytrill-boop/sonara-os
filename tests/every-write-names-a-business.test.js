"use strict";

// Every handler that writes has to know whose data it is writing.
//
// /api/business/time-entries/stop did not. It took an id from the request body
// and patched employee_time_entries with the service key, which bypasses row
// level security, so any signed-in customer could close any time entry in any
// business -- and 2,025 tests passed over it.
//
// It was found by listing the writing handlers and asking one question of each,
// which is a question worth asking on every build rather than once. The service
// key is the reason: PostgREST enforces nothing for it, so the organization
// filter in the query is the entire tenant boundary.
//
// What this can and cannot see: it reads the handler's own body for any sign
// that an organization was established. It cannot tell a correct scope from an
// incorrect one -- a handler that resolves an organization and then forgets to
// filter by it passes here. It catches the absence, which is the shape that
// shipped.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

// Handlers that write and legitimately have no organization to resolve. One
// entry, and it is the shape that proves the rule: a password reset happens
// before anybody is signed in, so there is no organization in scope and nothing
// tenant-owned is written -- it posts to Supabase auth and is rate limited.
const NO_ORGANIZATION = Object.freeze({
  "POST /auth/forgot-password":
    "Pre-authentication. The caller is not signed in, so no organization exists yet, and it writes to Supabase auth rather than to any tenant table.",
  // A follow is an edge between a person and somebody else's published profile,
  // and it crosses the tenant boundary by design -- that is the whole point of a
  // follow graph. There is no organization it belongs to: the follower's is
  // irrelevant and the artist's is already reachable through artist_profile_id.
  // creator_follows has no organization_id column for the same reason, and the
  // migration that creates it says so at length.
  //
  // What replaces the organization filter is asserted in
  // tests/a-public-profile-publishes-three-things.test.js rather than assumed
  // here: a follow is refused unless the profile is published, and an unfollow
  // filters on follower_user_id as well as the profile, so one signed-in person
  // cannot delete another's follow by guessing a uuid.
  "POST /api/creator-profiles/:id/follow":
    "A follow crosses organizations by design. Scoped by the signed-in follower and by the profile being published, both of which are asserted in tests/a-public-profile-publishes-three-things.test.js.",
  "POST /api/creator-profiles/:id/unfollow":
    "Deletes the caller's own follow. Filtered on follower_user_id as well as artist_profile_id, so it can only ever remove a row the caller created."
});

function sourceFiles() {
  const files = [path.join(root, "server.js")];
  for (const name of fs.readdirSync(path.join(root, "routes"))) {
    if (name.endsWith(".cjs")) files.push(path.join(root, "routes", name));
  }
  return files;
}

function writingHandlers() {
  const found = [];
  for (const file of sourceFiles()) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/app\.(post|patch|put|delete)\(\s*"([^"]+)"\s*,\s*([A-Za-z_$][\w$]*)?/g)) {
      const start = match.index;
      const end = source.indexOf("\n  });", start);
      const body = end === -1 ? source.slice(start, start + 3000) : source.slice(start, end);
      // Only handlers that actually write. A POST that reads and renders is not
      // this check's business.
      if (!/supabaseInsert|supabasePatch|supabaseDelete|method:\s*"(POST|PATCH|DELETE)"/.test(body)) continue;
      found.push({
        key: `${match[1].toUpperCase()} ${match[2]}`,
        file: path.relative(root, file),
        // Any of the three ways this codebase establishes whose data it is.
        knowsTheBusiness: /resolveOrganization|getCustomerPrimaryOrganization|organizationId/.test(body)
      });
    }
  }
  return found;
}

describe("every write names a business", () => {
  it("resolves an organization in every writing handler, or records why it cannot", () => {
    const handlers = writingHandlers();

    // Without this the check passes the day the regex stops matching, which is
    // the failure mode it exists to prevent in the code it inspects.
    assert.ok(handlers.length >= 30, `only ${handlers.length} writing handlers found; this check has gone blind`);

    const unscoped = handlers
      .filter((handler) => !handler.knowsTheBusiness)
      .filter((handler) => !NO_ORGANIZATION[handler.key]);

    assert.deepEqual(
      unscoped.map((handler) => `${handler.key} [${handler.file}]`),
      [],
      "these write with the service key and never establish whose data it is:\n  " +
        unscoped.map((handler) => `${handler.key} [${handler.file}]`).join("\n  ")
    );
  });

  // A reason that has outlived what it excuses is what the next person reads
  // instead of checking -- the failure already found twice in this repository,
  // in form reachability and in the retirement contract.
  it("keeps no excuse for a handler that now scopes itself, or no longer exists", () => {
    const handlers = writingHandlers();
    const byKey = new Map(handlers.map((handler) => [handler.key, handler]));
    const stale = [];
    for (const key of Object.keys(NO_ORGANIZATION)) {
      const handler = byKey.get(key);
      if (!handler) stale.push(`${key} is excused and no longer exists`);
      else if (handler.knowsTheBusiness) stale.push(`${key} resolves an organization now, so the excuse is spent`);
    }
    assert.deepEqual(stale, [], stale.join("\n  "));
  });
});
