"use strict";

// Whether revoking EXECUTE on an authorization function can lock a customer out.
//
// docs/owner/OWNER-STEPS.md item 4 carries the Supabase advisor's request to
// revoke EXECUTE from `authenticated` on twelve SECURITY DEFINER functions, and
// the warning against doing it: a policy evaluates as the calling role, so
// removing the grant can turn a working policy into a denial -- customers locked
// out of their own records, silently. `is_org_member` alone is called by 202
// policies across 64 tables.
//
// **That warning describes a mechanism this application does not currently use.**
// Measured on 19 August 2026: every table read in the running product goes
// through `supabaseHeaders()`, which sends the service-role key as both `apikey`
// and `Authorization`. The service role bypasses row level security entirely, so
// no policy is evaluated on any live read, so no policy's calls to a SECURITY
// DEFINER function are on any live path.
//
// lib/sonara-supabase-clients.cjs exists and is the machinery for changing that
// -- CRIT-3 item (2), forwarding the caller's JWT so RLS becomes a real second
// line of defence. It is required by exactly one file: its own test.
//
// So today, revoking that grant cannot break this product. **The day
// lib/sonara-supabase-clients.cjs is wired into a read path, it can.**
//
// That is the whole reason this file exists. The reasoning in item 4 is true
// when written and would go stale silently, and somebody reading it in six
// months has no way to tell which. This fails the moment it stops being true,
// and says so in the failure message.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const USER_SCOPED_MODULE = "sonara-supabase-clients";

// The files that make up the running product.
function runtimeFiles() {
  const files = [path.join(root, "server.js")];
  for (const directory of ["lib", "routes", "api"]) {
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(c?js|mjs)$/.test(entry.name)) files.push(full);
      }
    };
    const directoryPath = path.join(root, directory);
    if (fs.existsSync(directoryPath)) walk(directoryPath);
  }
  return files;
}

const STALE_REASONING = [
  "",
  "docs/owner/OWNER-STEPS.md item 4 says revoking EXECUTE from `authenticated` cannot",
  "break this product, because no read is made as `authenticated` -- every table read",
  "uses the service-role key, which bypasses row level security.",
  "",
  "That is no longer true. A user-scoped read means policies are evaluated on a live",
  "path, which means the functions those policies call are on a live path too, which",
  "is exactly the lockout item 4 warns about.",
  "",
  "Re-read and rewrite item 4 before anybody revokes anything."
].join("\n  ");

describe("the reasoning behind the revoke test is still true", () => {
  const files = runtimeFiles();

  it("has runtime files to read", () => {
    // Without this every assertion below passes over an empty list, which is
    // the failure mode most of the checks in this repository exist to prevent.
    assert.ok(files.length > 50, `only ${files.length} runtime files found; this check has gone blind`);
    assert.ok(
      files.some((file) => file.endsWith("server.js")),
      "server.js was not read, so this check is not looking at the running product"
    );
  });

  it("still reads every table with the service-role key", () => {
    const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
    // The one helper 75 call sites go through. If this stops sending the
    // service-role key, reads start being evaluated against policies.
    const helper = server.match(/function supabaseHeaders\([\s\S]{0,400}?\n}/);
    assert.ok(helper, "supabaseHeaders is gone from server.js; find what replaced it before trusting item 4");
    assert.match(
      helper[0],
      /apikey:\s*config\.serviceRoleKey/,
      `supabaseHeaders no longer sends the service-role key as apikey.${STALE_REASONING}`
    );
    assert.match(
      helper[0],
      /Authorization:\s*`Bearer \$\{config\.serviceRoleKey\}`/,
      `supabaseHeaders no longer authorizes as the service role.${STALE_REASONING}`
    );
  });

  it("has not wired the user-scoped client into the running product", () => {
    // The module is deliberately allowed to exist -- it is CRIT-3 (2)'s
    // machinery, built and waiting. What matters is whether anything runs it.
    const wired = files
      .filter((file) => !file.endsWith(`${USER_SCOPED_MODULE}.cjs`))
      .filter((file) => fs.readFileSync(file, "utf8").includes(USER_SCOPED_MODULE))
      .map((file) => path.relative(root, file));

    assert.deepEqual(
      wired,
      [],
      `these runtime files now use the user-scoped Supabase client: ${wired.join(", ")}.${STALE_REASONING}`
    );
  });

  it("calls neither user-scoped helper from the running product", () => {
    // Belt and braces, and not redundant: somebody could inline the same
    // headers without importing the module, and the import check above would
    // pass while reads went out as `authenticated`.
    const offenders = files
      .filter((file) => !file.endsWith(`${USER_SCOPED_MODULE}.cjs`))
      .filter((file) => /userScopedHeaders|chooseClient/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(root, file));

    assert.deepEqual(offenders, [], `user-scoped reads appear in: ${offenders.join(", ")}.${STALE_REASONING}`);
  });

  it("still has the module it is watching for", () => {
    // If lib/sonara-supabase-clients.cjs were deleted, the two checks above
    // would pass by having nothing to find -- and would go on passing after
    // user-scoped reads were reintroduced under another name.
    assert.ok(
      fs.existsSync(path.join(root, "lib", `${USER_SCOPED_MODULE}.cjs`)),
      `lib/${USER_SCOPED_MODULE}.cjs is gone. This check watched for it being wired in, so its absence `
        + "means this file is now watching for nothing. Point it at whatever replaced it."
    );
  });
});
