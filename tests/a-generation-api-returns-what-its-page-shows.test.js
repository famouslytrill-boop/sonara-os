"use strict";

// `routes/creator-generation-routes.cjs` is the file AGENTS.md governs most
// directly: "Enforce provenance, consent, and anti-clone safety." Its HTML
// pages were narrowed to named columns on 2 September, for a reason recorded in
// the file itself -- a `select=*` was what hid the provenance defect, because
// the row carried the provider, the attestations and the checksum, the page
// loaded all three and printed none, and nothing could see the query to say so.
//
// **Its JSON endpoints were not narrowed at the same time.** So the pages and
// the API over the same records disagreed about what may be returned, and two
// of the four gave something away for nothing:
//
//   - the asset list returned `bucket_id` and `object_path` -- a file's
//     location inside a private bucket. No caller used them (checked across
//     public/, tests/ and docs/), and the download route reads them itself in
//     its own scoped query before signing a 300-second URL.
//   - the job reads returned `provider_response`, the raw body an external
//     provider sent back, which nothing reads either.
//
// This file holds the four lists that replaced them. Two properties, and the
// second is the one that would otherwise rot:
//
//   1. Nothing is returned that the page over the same records leaves out.
//   2. **Every field this file reads off a job is in the job select.** That is
//      derived from the source, not restated, because a restated list agrees
//      with itself -- and because getting it wrong here is silent. `jobTitle()`
//      falls back to a generic capability label when `title` is absent, so a
//      select missing `title` renames every job page to "Text to speech
//      request" and nothing errors, nothing logs, and no test that checks for a
//      200 notices.
//
//      That is not hypothetical. The first pass at the list was derived by
//      grepping for `job.` and missed `title`, which `jobTitle()` reaches
//      through `job?.title`. The optional chaining is why.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROUTES = path.join(__dirname, "..", "routes", "creator-generation-routes.cjs");
const source = fs.readFileSync(ROUTES, "utf8").replace(/\r\n/g, "\n");

/** The file with comments removed, so prose cannot be read as code. */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .split("\n")
  .map((line) => line.replace(/\/\/.*$/, ""))
  .join("\n");

/** Every `<name>.<field>` and `<name>?.<field>` the code reads. */
function fieldsReadOff(name) {
  const found = new Set();
  const pattern = new RegExp(`(?<![-\\w.])${name}\\??\\.([a-z][a-z0-9_]*)\\b`, "g");
  for (const match of code.matchAll(pattern)) found.add(match[1]);
  return found;
}

/** Every `select=<list>` written literally in the file, as arrays of columns. */
function literalSelects() {
  return [...code.matchAll(/select=([a-z0-9_]+(?:,[a-z0-9_]+)+)/g)]
    .map((match) => match[1].split(","));
}

function selectContaining(...required) {
  const found = literalSelects().filter((columns) => required.every((name) => columns.includes(name)));
  assert.ok(found.length, `no literal select found containing ${required.join(" + ")}; this check has gone blind`);
  return found;
}

describe("a generation API returns what its page shows", () => {
  describe("nothing here asks for every column", () => {
    it("has no select=* left in the code", () => {
      assert.doesNotMatch(
        code,
        /select=\*/,
        "a `select=*` is back in the generation routes -- the read that hid the provenance defect was one of these"
      );
      // The comments explaining why still mention it, and should.
      assert.match(source, /Named rather than `select=\*`/, "the reasons were removed along with the queries");
    });

    it("found the selects at all", () => {
      // Shape 1. If the pattern stops matching, every assertion below passes by
      // measuring nothing.
      const selects = literalSelects();
      assert.ok(selects.length >= 6, `only ${selects.length} literal selects found; this check has gone blind`);
    });
  });

  describe("the job select", () => {
    it("carries every field this file reads off a job", () => {
      const needed = fieldsReadOff("job");
      needed.delete("ok");
      needed.delete("job");   // `job.job` -- the loadJob wrapper, not a column
      needed.delete("id");    // present in every select; asserted separately below
      assert.ok(needed.size >= 12, `only ${needed.size} job fields found; this check has gone blind`);

      for (const select of selectContaining("capability", "policy_status")) {
        for (const field of [...needed].sort()) {
          assert.ok(
            select.includes(field),
            `this file reads job.${field} and a job select does not ask for it. Nothing would error -- the field ` +
              "arrives undefined and the page renders a default"
          );
        }
        assert.ok(select.includes("id"), "a job select omits id");
      }
    });

    it("asks for the title, which is the one whose absence is silent", () => {
      // Called out on its own. jobTitle() falls back to a generic capability
      // label, so a missing title is not an error anywhere -- it is every job
      // page quietly renamed.
      assert.match(code, /jobTitle\s*\([^)]*\)\s*\{\s*return clean\(job\?\.title/, "jobTitle no longer reads job?.title; this test is checking the wrong field");
      for (const select of selectContaining("capability", "policy_status")) {
        assert.ok(select.includes("title"), "a job select omits title; every job page would fall back to its capability label");
      }
    });

    it("does not return the provider's raw reply", () => {
      // Nothing reads it, and an endpoint that returns a provider's whole
      // response publishes whatever that provider decides to put in it.
      assert.ok(!fieldsReadOff("job").has("provider_response"), "something now reads job.provider_response; this ruling needs revisiting");
      for (const select of selectContaining("capability", "policy_status")) {
        assert.ok(!select.includes("provider_response"), "a job select asks for provider_response, which nothing reads");
      }
    });
  });

  describe("the asset select", () => {
    it("never hands a private storage path to a caller", () => {
      // bucket_id and object_path locate the file inside a private bucket. The
      // download route reads them in its own scoped query and signs a
      // short-lived URL; no response body needs them.
      for (const select of selectContaining("asset_role", "media_type")) {
        for (const column of ["bucket_id", "object_path"]) {
          assert.ok(
            !select.includes(column),
            `an asset select returns ${column}. The download route reads it itself before signing a URL; a ` +
              "response body carrying it is exposure that buys nothing"
          );
        }
      }
    });

    it("still carries the provenance the page exists to show", () => {
      for (const select of selectContaining("asset_role", "media_type")) {
        assert.ok(select.includes("provenance"), "an asset select dropped provenance, which is the defect this page was built to fix");
        assert.ok(select.includes("checksum_sha256"), "an asset select dropped the checksum");
      }
    });
  });

  describe("the consent select", () => {
    it("returns no more than the consent page renders", () => {
      // evidence_reference points at where a signed release lives; metadata is
      // free-form. The page decided against both, and an endpoint over the same
      // records should not quietly return more than the page that was designed.
      for (const select of selectContaining("consent_scope", "subject_type")) {
        for (const column of ["evidence_reference", "metadata"]) {
          assert.ok(!select.includes(column), `a consent select returns ${column}, which the consent page leaves out`);
        }
      }
    });

    it("carries what a consent decision is made of", () => {
      for (const select of selectContaining("consent_scope", "subject_type")) {
        for (const column of ["consent_scope", "revoked_at", "expires_at"]) {
          assert.ok(select.includes(column), `a consent select omits ${column}; a consent that cannot be dated or revoked is not a consent`);
        }
      }
    });
  });
});
