"use strict";

// The row knew. The page did not say.
//
// routes/creator-generation-routes.cjs writes provenance onto every output the
// moment the file is stored -- which service made it, whether rights and
// consent were attested, and a SHA-256 of the bytes. The job page then selects
// `*`, so all of it arrives, and rendered four columns: File, Type, Size, Made.
//
// Being in the select is what made it look handled. That is the third shape in
// .claude/skills/checks-that-cannot-lie and the sharpest one, and AGENTS.md
// asks for provenance to be *enforced* -- which a record only the database can
// read does not do. A creator who cannot say what made a file, or prove the
// copy they hold is the copy we made, has no provenance however carefully the
// row was written.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const provenance = require("../lib/sonara-generation-provenance.cjs");
const { CREATOR_GENERATION_PROVIDERS } = require("../lib/creator-generation-provider-registry.cjs");
const { tableColumns } = require("../lib/sonara-migration-columns.cjs");

const ROUTES = fs.readFileSync(path.join(__dirname, "..", "routes", "creator-generation-routes.cjs"), "utf8");

const CHECKSUM = "a".repeat(32) + "b".repeat(32);

function assetRow(overrides = {}) {
  return {
    id: "asset-1",
    asset_role: "output",
    byte_size: 1024,
    checksum_sha256: CHECKSUM,
    provenance: { provider_key: "elevenlabs", generated: true, rights_attested: true, consent_attested: true },
    ...overrides
  };
}

describe("a generated file says what made it", () => {
  it("has providers to name", () => {
    // Every label assertion below is satisfied by an empty registry.
    assert.ok(
      CREATOR_GENERATION_PROVIDERS.length >= 10,
      `the generation registry holds ${CREATOR_GENERATION_PROVIDERS.length} providers; this check has gone blind`
    );
    assert.ok(Object.keys(provenance.PROVIDER_LABELS).length === CREATOR_GENERATION_PROVIDERS.length);
  });

  describe("yes, no, and not recorded", () => {
    it("keeps the three apart", () => {
      assert.equal(provenance.attestation(true), "yes");
      assert.equal(provenance.attestation(false), "no");
      assert.equal(provenance.attestation(null), "unknown");
      assert.equal(provenance.attestation(undefined), "unknown");
    });

    it("does not read an absent answer as a refusal", () => {
      // The job page did exactly this: `job.rights_attested ? "Yes" : "No"`,
      // which tells a creator their rights were not confirmed when the truthful
      // answer is that nobody was asked.
      assert.equal(provenance.attestationLabel(null), "Not recorded");
      assert.notEqual(provenance.attestationLabel(null), provenance.attestationLabel(false));
    });

    it("does not read a truthy string as a yes", () => {
      // PostgREST hands back what the column holds. A "false" string is truthy.
      assert.equal(provenance.attestation("false"), "unknown");
      assert.equal(provenance.attestation(1), "unknown");
    });
  });

  describe("naming the service", () => {
    it("uses the provider's own name", () => {
      assert.equal(provenance.providerLabel("elevenlabs"), "ElevenLabs");
      assert.equal(provenance.providerLabel("gpt_sovits"), "GPT-SoVITS");
    });

    it("admits an unrecognised key rather than tidying it into a label", () => {
      assert.equal(provenance.providerLabel("not_a_provider"), null);
      const described = provenance.describeAsset(assetRow({ provenance: { provider_key: "not_a_provider" } }));
      assert.equal(described.providerRecognised, false);
      assert.match(described.madeBy, /unrecognised/i, "an unknown key was rendered as though it were a known service");
      assert.match(described.madeBy, /not_a_provider/, "the unknown key was hidden rather than reported");
    });

    it("says nothing rather than something when no key was recorded", () => {
      const described = provenance.describeAsset(assetRow({ provenance: {} }));
      assert.equal(described.madeBy, null, "a file with no recorded service was attributed to one");
    });

    it("never puts a raw registry key on the page for a provider it knows", () => {
      for (const provider of CREATOR_GENERATION_PROVIDERS) {
        const described = provenance.describeAsset(assetRow({ provenance: { provider_key: provider.key } }));
        assert.equal(described.madeBy, provider.label);
        if (provider.label !== provider.key) {
          assert.doesNotMatch(described.madeBy, new RegExp(`\\b${provider.key}\\b`), `${provider.key} leaked as its own label`);
        }
      }
    });
  });

  describe("the fingerprint", () => {
    it("shortens a real digest and keeps the whole one", () => {
      const described = provenance.describeAsset(assetRow());
      assert.equal(described.checksum, CHECKSUM);
      assert.equal(described.checksumShort, `${CHECKSUM.slice(0, 12)}…${CHECKSUM.slice(-12)}`);
    });

    it("refuses anything that is not a SHA-256", () => {
      // A truncated or malformed digest shown as a fingerprint is worse than
      // none: somebody comparing files against it gets a mismatch and concludes
      // the file was altered.
      for (const bad of ["", "not-a-digest", "abc", CHECKSUM.slice(0, 63), `${CHECKSUM}ff`, CHECKSUM.toUpperCase().replace("A", "Z")]) {
        const described = provenance.describeAsset(assetRow({ checksum_sha256: bad }));
        assert.equal(described.checksum, null, `${JSON.stringify(bad.slice(0, 20))} was accepted as a digest`);
        assert.equal(described.checksumShort, null);
      }
    });

    it("accepts an upper-case digest, because a column is not a format", () => {
      const described = provenance.describeAsset(assetRow({ checksum_sha256: CHECKSUM.toUpperCase() }));
      assert.equal(described.checksum, CHECKSUM);
    });
  });

  describe("a row that carries nothing", () => {
    it("says so once instead of printing four blanks", () => {
      const described = provenance.describeAsset({ id: "old" });
      assert.equal(described.empty, true);
      assert.match(provenance.sentence(described), /No record of what made this file/i);
    });

    it("is not empty when any one fact is present", () => {
      assert.equal(provenance.describeAsset(assetRow({ provenance: { generated: true }, checksum_sha256: "" })).empty, false);
      assert.equal(provenance.describeAsset(assetRow({ provenance: {}, checksum_sha256: CHECKSUM })).empty, false);
    });

    it("survives a row that is not an object at all", () => {
      for (const bad of [null, undefined, "", 7, []]) {
        assert.doesNotThrow(() => provenance.describeAsset(bad), `describeAsset threw on ${JSON.stringify(bad)}`);
      }
    });
  });

  describe("what the download is recorded with", () => {
    it("names the columns it needs, and they all exist", () => {
      const columns = tableColumns("creator_generation_assets");
      assert.ok(columns, "creator_generation_assets is created by no migration");
      assert.ok(provenance.PROVENANCE_COLUMNS.length >= 4, "too few columns to carry provenance");
      for (const column of provenance.PROVENANCE_COLUMNS) {
        assert.ok(columns.has(column), `the download selects ${column}, which the table does not have`);
      }
      // The two the signing needs. Without these the download breaks rather
      // than merely losing its provenance, which is a different severity.
      for (const column of ["bucket_id", "object_path"]) {
        assert.ok(provenance.PROVENANCE_COLUMNS.includes(column), `the download would no longer be able to sign a URL without ${column}`);
      }
    });

    it("records what was collected, not only that something was", () => {
      const details = provenance.downloadEventDetails("asset-1", provenance.describeAsset(assetRow()));
      assert.equal(details.asset_id, "asset-1");
      assert.equal(details.provider_key, "elevenlabs");
      assert.equal(details.rights_attested, "yes");
      assert.equal(details.checksum_sha256, CHECKSUM);
    });

    it("records an unanswered attestation as unknown rather than dropping it", () => {
      const details = provenance.downloadEventDetails("a", provenance.describeAsset(assetRow({ provenance: { provider_key: "suno" } })));
      assert.equal(details.rights_attested, "unknown");
      assert.equal(details.consent_attested, "unknown");
      assert.ok("rights_attested" in details, "an unanswered attestation vanished from the audit record");
    });
  });

  describe("the page actually renders it", () => {
    // Reading the route source rather than the rendered HTML: the job page
    // needs a session and a database. What is being guarded is that the module
    // is called at all -- the defect was a value loaded and dropped, and a
    // module nobody calls is the same defect one file further along.
    it("calls the provenance module from the outputs table", () => {
      assert.match(
        ROUTES,
        /require\(["'`]\.\.\/lib\/sonara-generation-provenance\.cjs["'`]\)/,
        "the route no longer reads the provenance module"
      );
      assert.match(ROUTES, /describeAsset\(asset\)/, "the outputs table no longer describes each asset");
    });

    it("gives the table a header for each provenance column", () => {
      for (const heading of ["Made by", "Rights confirmed", "Consent confirmed", "Fingerprint"]) {
        assert.ok(ROUTES.includes(`<th>${heading}</th>`), `the outputs table has no ${heading} column`);
      }
    });

    it("wraps the widened table so it cannot overflow the page", () => {
      // AGENTS.md: mobile layouts must not overflow. Eight columns do, and the
      // stylesheet's own table scroller only applies below 680px.
      assert.match(ROUTES, /class="table-scroll"/, "the widened outputs table has no scroll container");
      const css = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-application-ui.css"), "utf8");
      assert.match(css, /\.table-scroll\s*\{[^}]*overflow-x:\s*auto/, "table-scroll is used but styles nothing");
    });

    it("selects the provenance in the download route rather than only two columns", () => {
      assert.doesNotMatch(
        ROUTES,
        /select=bucket_id,object_path&id=eq\./,
        "the download route is back to selecting two columns, so the event cannot say what was collected"
      );
      assert.match(ROUTES, /PROVENANCE_COLUMNS\.join/, "the download route no longer takes its columns from the module");
    });

    it("stops collapsing an unanswered attestation into No on the request card", () => {
      assert.doesNotMatch(
        ROUTES,
        /job\.rights_attested \? "Yes" : "No"/,
        "the request card reads an unanswered rights question as a refusal again"
      );
      assert.match(ROUTES, /attestationLabel\(job\.rights_attested\)/, "the request card no longer uses the three-state label");
    });
  });
});
