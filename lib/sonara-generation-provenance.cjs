"use strict";

// Where a generated file came from, said to the person who owns it.
//
// routes/creator-generation-routes.cjs writes this onto every output row at the
// moment the file is stored:
//
//     provenance: { provider_key: providerKey, generated: true,
//                   rights_attested: job.rights_attested,
//                   consent_attested: job.consent_attested }
//
// alongside a SHA-256 of the bytes. The job page then selects `*` -- so all of
// it is loaded -- and renders four columns: File, Type, Size, Made. The
// provenance and the checksum were fetched into the page and dropped.
//
// That is the third shape in .claude/skills/checks-that-cannot-lie, and the
// sharpest one: being in the select is what made it look handled. AGENTS.md is
// explicit -- "Enforce provenance, consent, and anti-clone safety" -- and a
// record nobody can see enforces nothing. A creator who cannot say what made a
// file, or prove the file they hold is the file we made, has no provenance
// however carefully the row was written.
//
// Three states, never two. `rights_attested` and `consent_attested` are
// nullable: a job that never asked is not a job that was answered no. The job
// page already collapsed them -- `job.rights_attested ? "Yes" : "No"` -- which
// tells a creator their rights were not confirmed when the truthful answer is
// that nobody was asked.

const { CREATOR_GENERATION_PROVIDERS } = require("./creator-generation-provider-registry.cjs");

const PROVIDER_LABELS = Object.freeze(
  Object.fromEntries(CREATOR_GENERATION_PROVIDERS.map((provider) => [provider.key, provider.label]))
);

// yes / no / not recorded. The third is the one a boolean cannot carry, and it
// is the honest answer far more often than either of the others.
const ATTESTED = Object.freeze({
  yes: "Yes",
  no: "No",
  unknown: "Not recorded"
});

function attestation(value) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}

function attestationLabel(value) {
  return ATTESTED[attestation(value)];
}

// The provider's own name where the registry knows it. A raw key like
// `gpt_sovits` on a customer page is an internal identifier leaking out; a key
// the registry has never heard of is reported as unrecognised rather than
// tidied into something readable, because a made-up label is worse than an
// admission.
function providerLabel(key) {
  const raw = typeof key === "string" ? key.trim() : "";
  if (!raw) return null;
  return PROVIDER_LABELS[raw] || null;
}

function shortChecksum(checksum) {
  const raw = typeof checksum === "string" ? checksum.trim().toLowerCase() : "";
  if (!/^[0-9a-f]{64}$/.test(raw)) return null;
  // First and last twelve. A creator comparing a file against this is matching
  // by eye; sixty-four characters in a table cell is not something anybody
  // checks, and the full value stays available in `checksum`.
  return `${raw.slice(0, 12)}…${raw.slice(-12)}`;
}

// What to show for one output row. Returns a record rather than a string so the
// route decides the markup and this decides the truth.
//
// `null` for a fact means the row does not carry it. That is different from
// "no": a file stored before provenance was written has no provider recorded,
// and saying "made by nobody" would be an invention.
function describeAsset(asset) {
  const row = asset && typeof asset === "object" ? asset : {};
  const provenance = row.provenance && typeof row.provenance === "object" ? row.provenance : {};
  const key = typeof provenance.provider_key === "string" ? provenance.provider_key : "";
  const label = providerLabel(key);
  const checksum = typeof row.checksum_sha256 === "string" ? row.checksum_sha256.trim().toLowerCase() : "";

  return {
    // Deliberately not "AI". AGENTS.md: avoid overusing "AI" in public copy, and
    // the fact a creator needs is which service made the file, not the category
    // it belongs to.
    madeBy: label || (key ? `An unrecognised service (${key})` : null),
    providerKey: key || null,
    providerRecognised: Boolean(label),
    generated: provenance.generated === true,
    rights: attestation(provenance.rights_attested),
    rightsLabel: attestationLabel(provenance.rights_attested),
    consent: attestation(provenance.consent_attested),
    consentLabel: attestationLabel(provenance.consent_attested),
    checksum: /^[0-9a-f]{64}$/.test(checksum) ? checksum : null,
    checksumShort: shortChecksum(checksum),
    // True when the row carries nothing at all, so a page can say so once
    // rather than printing four blanks.
    empty: !key && provenance.generated !== true && !/^[0-9a-f]{64}$/.test(checksum)
  };
}

// One sentence for a page that has room for a sentence and not a table.
function sentence(described) {
  if (!described || described.empty) {
    return "No record of what made this file was kept. It was stored before this was tracked.";
  }
  const parts = [];
  parts.push(described.madeBy ? `Made by ${described.madeBy}.` : "The service that made this was not recorded.");
  parts.push(`Rights confirmed: ${described.rightsLabel}.`);
  parts.push(`Consent confirmed: ${described.consentLabel}.`);
  if (described.checksumShort) parts.push(`Fingerprint ${described.checksumShort}.`);
  return parts.join(" ");
}

// The columns a download should be recorded with, so the audit trail says what
// was collected rather than only that something was. Kept here beside the
// describe function because the route's select list and this record are the
// same set of facts, and two lists is how they came to differ in the first
// place.
const PROVENANCE_COLUMNS = Object.freeze(["bucket_id", "object_path", "provenance", "checksum_sha256"]);

function downloadEventDetails(assetId, described) {
  return {
    asset_id: assetId,
    provider_key: described.providerKey,
    rights_attested: described.rights,
    consent_attested: described.consent,
    checksum_sha256: described.checksum
  };
}

module.exports = {
  ATTESTED,
  PROVIDER_LABELS,
  PROVENANCE_COLUMNS,
  attestation,
  attestationLabel,
  providerLabel,
  shortChecksum,
  describeAsset,
  sentence,
  downloadEventDetails
};
