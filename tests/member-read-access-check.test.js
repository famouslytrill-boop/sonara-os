"use strict";

// The check that proves member reads work is only useful if it cannot be
// fooled, so this tests the ways it could be.
//
// The failure it exists to catch is quiet: if an RLS policy does not match, a
// user-scoped read returns zero rows and HTTP 200. Nothing errors, the
// workspace just renders empty, and it reads as "this customer has no data"
// rather than as a bug. That is why the script compares a member's row count
// against service_role's for the same organization instead of just checking the
// request succeeds.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const script = path.join(root, "scripts", "verify-member-read-access.mjs");
// The grading moved into its own module on 3 September so it could be tested --
// the script has top-level `await` and `process.exit` and cannot run without a
// database, so the one function in it that decided anything was never
// exercised, and it graded two unreadable counts as "ready".
//
// The assertions below are about properties of the check, not about which file
// holds them, so the ones that follow the decision read both. Narrowing them to
// the script would have quietly stopped checking the thing they were written
// for the moment the code moved.
const verdictModule = path.join(root, "scripts", "member-read-verdict.cjs");
const bothSources = () => fs.readFileSync(script, "utf8") + "\n" + fs.readFileSync(verdictModule, "utf8");

function run(env) {
  try {
    const stdout = execFileSync(process.execPath, [script], {
      env: { ...process.env, ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { code: 0, output: stdout };
  } catch (error) {
    return { code: error.status, output: `${error.stdout || ""}${error.stderr || ""}` };
  }
}

describe("the member read access check", () => {
  it("refuses to run without a real database to talk to", () => {
    // Passing vacuously when the environment is empty is how a check becomes
    // decoration. RLS exists nowhere but the real database.
    const result = run({
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_ANON_KEY: "",
      SONARA_VERIFY_USER_JWT: ""
    });
    assert.notEqual(result.code, 0, "an empty environment must not look like a pass");
    assert.match(result.output, /Missing required environment/);
  });

  it("refuses a service-role key handed in as the user token", () => {
    // This is the mistake that would make every table look ready, because
    // service_role bypasses RLS entirely. It is an easy mistake: both are long
    // opaque strings sitting next to each other in the same env file.
    const result = run({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "identical-secret",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SONARA_VERIFY_USER_JWT: "identical-secret"
    });
    assert.notEqual(result.code, 0);
    assert.match(result.output, /bypasses RLS and would report every table ready/);
  });

  it("takes its table list from the policy generator rather than a copy", () => {
    // A second list would drift from the migration and then agree with itself,
    // which is the failure mode that put policies on thirty-three tables the
    // application never reads.
    const source = fs.readFileSync(script, "utf8");
    assert.match(source, /require\("\.\/generate-member-read-policies\.cjs"\)/);
    assert.match(source, /ORGANIZATION_READ_TABLES/);
    assert.match(source, /PERSONAL_READ_TABLES/);
  });

  it("compares against service-role rather than just checking the read succeeded", () => {
    // A member read that returns 200 and zero rows is exactly what a broken
    // policy looks like. Only the comparison tells it apart from an empty table.
    const source = bothSources();
    assert.match(source, /asService/);
    assert.match(fs.readFileSync(script, "utf8"), /count=exact/, "row counts must be exact, not inferred from a page of results");
    assert.match(source, /the member sees 0 -- switching this read would blank the page/);
  });

  it("distinguishes an empty table from a blocked one", () => {
    // Treating "no rows anywhere" as failure would make the script cry wolf on
    // a fresh workspace, and a check people learn to ignore catches nothing.
    const source = bothSources();
    assert.match(source, /no-evidence/);
    assert.match(source, /proves nothing/);
  });

  it("only writes reads", () => {
    // It runs against production. Nothing here may modify a row.
    const source = bothSources();
    assert.doesNotMatch(source, /method:\s*["'](POST|PATCH|PUT|DELETE)["']/i);
  });

  it("prints no secret", () => {
    const source = bothSources();
    for (const secret of ["serviceRoleKey", "userJwt", "anonKey"]) {
      const logged = new RegExp(`console\\.(log|error)\\([^)]*\\b${secret}\\b`);
      assert.doesNotMatch(source, logged, `${secret} must never reach stdout`);
    }
  });
});
