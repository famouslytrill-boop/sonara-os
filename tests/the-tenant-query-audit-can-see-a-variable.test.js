"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// `scripts/report-tenant-scoped-queries.mjs` proves the organization filter is
// present on every query against a tenant-scoped table, because the
// service-role key bypasses row-level security and that filter IS the tenant
// boundary.
//
// It had a hole, and the hole was in the worst possible place.
//
// A call whose TABLE resolved to a tenant-scoped one but whose QUERY was passed
// as a variable was counted as "query is not a literal" and then skipped. Not
// classified. And unlike the unresolved-TABLE bucket beside it, **that count was
// never gated** -- so the single call in it could have been reading every
// organization's rows and a clean run would have printed the number and passed.
//
// It was worse than the table bucket for a reason worth keeping in mind: there
// the table is unknown, so the tenancy is genuinely unknowable. Here the table
// is known to carry an organization and only the filter is out of view.
//
// The one call was `recordWithdrawal` in routes/growth-studio-control-routes.cjs
// against `growth_contact_consents` -- reached from the public unsubscribe
// endpoint, the only unauthenticated write in the product. It was correct.
// Nothing had ever confirmed that.
//
// These tests run the real script against synthetic files, so they assert what
// it does rather than what its comments say.

const ROOT = path.join(__dirname, "..");

// The script has its own blind-scan floor -- it refuses to report a clean run on
// fewer than 90 `rest()` calls, because a walk that found almost nothing and
// said "no problems" is the defect this repository is named for.
//
// So a handful of synthetic files cannot exercise it: the first draft of this
// file built a four-file fixture, every run failed on that floor, and the
// negative cases therefore "passed" for entirely the wrong reason. The floor is
// right and the fixture was wrong.
//
// A whole copy of the runtime it reads is made instead, and one file inside it
// is perturbed. That is slower and it tests the real thing.
let base = null;

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, target);
    else if (entry.isFile()) fs.copyFileSync(source, target);
  }
}

before(function () {
  this.timeout(60000);
  base = fs.mkdtempSync(path.join(os.tmpdir(), "tenant-audit-"));
  for (const dir of ["lib", "routes", "api", "scripts"]) {
    if (fs.existsSync(path.join(ROOT, dir))) copyTree(path.join(ROOT, dir), path.join(base, dir));
  }
  fs.copyFileSync(path.join(ROOT, "server.js"), path.join(base, "server.js"));
});

after(() => {
  if (base) fs.rmSync(base, { recursive: true, force: true });
});

// Run the audit over the copy, optionally with one file's contents replaced.
function runWith(relativePath, contents) {
  const target = relativePath ? path.join(base, relativePath) : null;
  const original = target ? fs.readFileSync(target, "utf8") : null;
  if (target) fs.writeFileSync(target, contents);
  try {
    const stdout = execFileSync("node", ["scripts/report-tenant-scoped-queries.mjs"], { cwd: base, encoding: "utf8" });
    return { code: 0, output: stdout };
  } catch (error) {
    return { code: error.status ?? 1, output: `${error.stdout || ""}${error.stderr || ""}` };
  } finally {
    if (target) fs.writeFileSync(target, original);
  }
}

const WITHDRAWAL_FILE = path.join("routes", "growth-studio-control-routes.cjs");

// The real declaration, and the same declaration with the tenant filter removed.
// Held as literals so a change to the runtime that reshapes them fails here
// rather than silently making these assertions test nothing.
const REAL_SCOPE = [
  "  const scope =",
  "    `organization_id=eq.${encodeURIComponent(organizationId)}` +",
  "    `&lead_id=eq.${encodeURIComponent(leadId)}` +"
].join("\n");

const STRIPPED_SCOPE = [
  "  const scope =",
  "    `&lead_id=eq.${encodeURIComponent(leadId)}` +"
].join("\n");

describe("the tenant query audit can see a filter held in a variable", function () {
  this.timeout(60000);

  it("agrees the table involved really is tenant-scoped", () => {
    // Otherwise every assertion below passes by testing a table the script has
    // no opinion about, which is the check-measuring-nothing shape.
    const { TENANT_SCOPED_TABLES } = require("../lib/sonara-tenant-scoped-tables.cjs");
    assert.ok(
      TENANT_SCOPED_TABLES.has("growth_contact_consents"),
      "growth_contact_consents is not registered as tenant-scoped, so these assertions prove nothing"
    );
  });

  it("still finds the declaration it is supposed to be reading", () => {
    // If the runtime is reshaped so this text no longer appears, the two tests
    // below would perturb nothing and pass regardless. That is the failure mode
    // this guards.
    const source = fs.readFileSync(path.join(ROOT, WITHDRAWAL_FILE), "utf8");
    assert.ok(
      source.includes(REAL_SCOPE),
      `${WITHDRAWAL_FILE} no longer contains the declaration these tests perturb; update REAL_SCOPE`
    );
  });

  it("passes on the runtime as it stands, and says it resolved a variable", () => {
    const result = runWith(null, null);
    assert.equal(result.code, 0, `the audit failed on the unmodified runtime:\n${result.output}`);
    assert.match(
      result.output,
      /Query variables resolved from their nearest preceding declaration: [1-9]/,
      "no query variable was resolved, so the assertion below cannot mean what it says"
    );
  });

  it("FAILS when the unsubscribe write loses its organization filter", () => {
    // The falsification, and the whole reason this file exists.
    //
    // Before the resolver, this exact edit left the script reporting
    // "0 tenant-scoped and NOT filtered" and exiting 0 -- a green light over a
    // cross-tenant write on the only unauthenticated endpoint in the product.
    const source = fs.readFileSync(path.join(ROOT, WITHDRAWAL_FILE), "utf8");
    const result = runWith(WITHDRAWAL_FILE, source.replace(REAL_SCOPE, STRIPPED_SCOPE));
    assert.notEqual(result.code, 0, `the audit passed a tenant-scoped write with no organization filter:\n${result.output}`);
    assert.match(result.output, /growth_contact_consents/, "the failure must name the table");
    assert.match(result.output, /organization_id=/, "and say what is missing");
  });

  it("refuses a query it cannot follow at all, rather than counting it quietly", () => {
    // The bucket is ratcheted at zero now. A query the resolver cannot read, on
    // a table known to be tenant-scoped, has to fail -- incrementing a number
    // nobody gates is exactly what it used to do.
    //
    // A function call is the shape that genuinely cannot be followed. Note that
    // an assembled STRING can be: resolution is textual, so
    // `[...].join("&")` is still read, which is why the first version of this
    // test failed -- the perturbation was resolvable and the resolver was right.
    const source = fs.readFileSync(path.join(ROOT, WITHDRAWAL_FILE), "utf8");
    const unreadable = source.replace(REAL_SCOPE, "  const unusedScope =\n    `&lead_id=eq.${encodeURIComponent(leadId)}` +")
      .replace(
        'const updated = await rest(config, TABLES.consents, scope, {',
        'const updated = await rest(config, TABLES.consents, buildScope(organizationId, leadId), {'
      );
    assert.notEqual(unreadable, source, "the perturbation did not apply, so this test measures nothing");
    const result = runWith(WITHDRAWAL_FILE, unreadable);
    assert.notEqual(result.code, 0, `a query the reader cannot follow was waved past:\n${result.output}`);
    assert.match(result.output, /cannot resolve/i, "the failure must say it could not read the query");
  });

  it("refuses a filter that sits inside a conditional, because that is not always sent", () => {
    // `flag ? organization_id=... : ""` contains the filter and emits it only
    // sometimes. Reading the text as filtered would report a guarantee that
    // holds on one branch, which is this repository's whole recurring defect.
    //
    // No declaration in the runtime looks like this today, so the rule costs
    // nothing now and fails closed later.
    const source = fs.readFileSync(path.join(ROOT, WITHDRAWAL_FILE), "utf8");
    const conditional = source.replace(
      REAL_SCOPE,
      "  const scope =\n    (leadId ? `organization_id=eq.${encodeURIComponent(organizationId)}` : \"\") +\n    `&lead_id=eq.${encodeURIComponent(leadId)}` +"
    );
    assert.notEqual(conditional, source, "the perturbation did not apply, so this test measures nothing");
    const result = runWith(WITHDRAWAL_FILE, conditional);
    assert.notEqual(result.code, 0, `a conditional filter was accepted as a filter:\n${result.output}`);
    assert.match(result.output, /conditional/i, "the failure must say the filter is conditional");
  });
});
