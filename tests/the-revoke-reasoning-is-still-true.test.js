"use strict";

// RLS privilege-revoke safety ratchet (October 2026).
// Historical service-role requests remain, but a guarded user-scoped read
// capability is now imported by the offline learning-evidence adapter.
// An import is not a live route; its presence must not be misrepresented as
// absence. These static tests guard unexpected wiring and unsafe runbook
// assurances. They do NOT replace live preview tenant/RLS verification.

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
  "Legacy Supabase server header contract changed. Re-audit all user-scoped",
  "and service-role runtime consumers, connected database policies and",
  "EXECUTE grants before changing an owner authorization setting.",
  "docs/owner/OWNER-STEPS.md item 4 requires preview tenant and rollback proof."
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

  it("confirms the legacy server header remains service-role based", () => {
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

  it("identifies exactly the known guarded user-scoped adapter import", () => {
    const imports = files
      .filter((file) => !file.endsWith(`${USER_SCOPED_MODULE}.cjs`))
      .filter((file) => fs.readFileSync(file, "utf8").includes(USER_SCOPED_MODULE))
      .map((file) => path.relative(root, file))
      .sort();
    assert.deepEqual(imports, ["lib/sonara-adaptive-learning-policy.cjs"],
      "Unexpected user-scoped Supabase consumer: re-audit the actual JWT/RLS route and owner runbook");
    const source = fs.readFileSync(path.join(root, imports[0]), "utf8");
    assert.match(source,
      /const\s+\{\s*isVerifiedUserScopedRead\s*\}\s*=\s*require\("\.\/sonara-supabase-clients\.cjs"\)/,
      "The known learning adapter import changed; re-audit its authorization boundary");
    assert.match(source, /if\s*\(!isVerifiedUserScopedRead\(access,\s*\{/,
      "Guarded learning evidence must check the verified user-scoped read capability");
    assert.match(source, /return fail\("verified_user_scoped_evidence_read_required"\)/,
      "Unverified learning evidence must fail closed, not fall back to service role");
  });

  it("rejects direct user-scoped HTTP selectors outside the approved client module", () => {
    const offenders = files
      .filter((file) => !file.endsWith(`${USER_SCOPED_MODULE}.cjs`))
      .filter((file) => {
        // The old gate matched two function names inside explanatory comments
        // and called this live RLS usage. Only executable call shapes count.
        const code = fs.readFileSync(file, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        return /\b(?:userScopedHeaders|chooseClient)\s*\(/.test(code);
      })
      .map((file) => path.relative(root, file));
    assert.deepEqual(offenders, [],
      "Direct JWT/RLS selector wired into runtime: require preview tenant proof before revoking EXECUTE");
  });

  it("requires the owner runbook to prohibit production revoke without preview RLS proof", () => {
    const docs = fs.readFileSync(path.join(root, "docs", "owner", "OWNER-STEPS.md"), "utf8");
    const start = docs.indexOf("## 4 —");
    const end = docs.indexOf("\n## 5", start);
    assert.ok(start >= 0 && end > start, "Owner runbook RLS revoke decision section is missing");
    const section = docs.slice(start, end);
    assert.match(section, /Do not revoke `EXECUTE` in production/i);
    assert.match(section, /cross-tenant deny/);
    assert.match(section, /function-specific/);
    assert.match(section, /explicit owner authorization/);
    assert.doesNotMatch(section, /cannot lock a customer out of anything/i,
      "Old unconditional RLS safety assurance has returned");
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
