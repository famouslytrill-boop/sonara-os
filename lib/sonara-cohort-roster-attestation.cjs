// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createHash, createPublicKey, verify } = require("node:crypto");

const PURPOSE = "sonara.cohort.snapshot.v1";
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const KEY_ID_RE = /^[a-zA-Z0-9_-]{3,80}$/;
const MAX_PAYLOAD_BYTES = 500_000;
const MAX_MANIFEST_BYTES = 600_000;
const POPULATION_SCOPE = "eligible-organization-creation-cohort-v1";
const MANIFEST_KEYS = [
  "asOf", "audience", "complete", "exportedAt", "from", "organizationIds",
  "reportingRole", "scope", "sourceQuerySha256", "to", "totalOrganizations"
];
const MAX_AGE_MS = 86_400_000;
const KEYS = [
  "asOf", "audience", "evidenceSha256", "expiresAt", "from", "issuedAt",
  "organizationIds", "reportingRole", "to"
];

function invalid() {
  return Object.freeze({ ok: false, code: "roster_attestation_invalid" });
}

function decodeBase64Url(value, maximum) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]+$/.test(value) ||
      value.length > Math.ceil(maximum * 4 / 3) + 4) return null;
  const buffer = Buffer.from(value, "base64url");
  return buffer.length <= maximum && buffer.toString("base64url") === value ? buffer : null;
}

// Validate time strings strictly: JSON/date coercion and local-zone timestamps
// cannot silently change the signed time window or expiry.
function timestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

// The trustedKeys map MUST be supplied by a trusted server control plane, not
// by the requester or the signed envelope. This only authenticates what the
// issuer signed; independent organization-population completeness is required.
function verifyCohortRosterAttestation({
  attestation, trustedKeys, approvedReportingRole, expectedOrganizationIds,
  sourceEvidenceBytes, approvedSourceQuerySha256, from, to, asOf, now = Date.now()
} = {}) {
  try {
    if (!attestation || typeof attestation !== "object" || Array.isArray(attestation) ||
        Object.keys(attestation).sort().join(",") !== "keyId,payloadB64,signatureB64" ||
        typeof attestation.keyId !== "string" || !KEY_ID_RE.test(attestation.keyId) ||
        !trustedKeys || typeof trustedKeys !== "object" ||
        !Object.prototype.hasOwnProperty.call(trustedKeys, attestation.keyId) ||
        typeof approvedReportingRole !== "string" ||
        !Number.isFinite(now) || !Array.isArray(expectedOrganizationIds) ||
        !Buffer.isBuffer(sourceEvidenceBytes) || sourceEvidenceBytes.length === 0 ||
        sourceEvidenceBytes.length > MAX_MANIFEST_BYTES ||
        typeof approvedSourceQuerySha256 !== "string" ||
        !SHA256_RE.test(approvedSourceQuerySha256)) return invalid();

    const body = decodeBase64Url(attestation.payloadB64, MAX_PAYLOAD_BYTES);
    const signature = decodeBase64Url(attestation.signatureB64, 64);
    if (!body || !signature || signature.length !== 64) return invalid();
    const trusted = trustedKeys[attestation.keyId];
    // A verifier must never accept private material as its trust anchor.
    const pub = trusted?.type === "public" && trusted?.asymmetricKeyType === "ed25519"
      ? trusted : (typeof trusted === "string" && trusted.startsWith("-----BEGIN PUBLIC KEY-----")
        ? createPublicKey(trusted) : null);
    if (pub.asymmetricKeyType !== "ed25519" || pub.type !== "public" ||
        !verify(null, body, pub, signature)) return invalid();

    const claims = JSON.parse(body.toString("utf8"));
    // Enforce a unique deterministic JSON representation. JSON.parse alone
    // silently accepts duplicated keys, alternative whitespace, and escaped
    // spellings that can produce inconsistent signer/verifier interpretations.
    if (!Buffer.from(JSON.stringify(claims)).equals(body)) return invalid();
    if (!claims || typeof claims !== "object" || Array.isArray(claims) ||
        Object.keys(claims).sort().join(",") !== KEYS.join(",") ||
        claims.audience !== PURPOSE || claims.reportingRole !== approvedReportingRole ||
        claims.from !== from || claims.to !== to || claims.asOf !== asOf ||
        typeof claims.evidenceSha256 !== "string" || !SHA256_RE.test(claims.evidenceSha256) ||
        !Array.isArray(claims.organizationIds) ||
        claims.organizationIds.length !== expectedOrganizationIds.length ||
        claims.organizationIds.length === 0 || claims.organizationIds.length > 10_000) return invalid();

    const issued = timestamp(claims.issuedAt);
    const expiry = timestamp(claims.expiresAt);
    const start = timestamp(claims.from);
    const end = timestamp(claims.to);
    const cutoff = timestamp(claims.asOf);
    if (issued === null || expiry === null || start === null || end === null ||
        cutoff === null || start >= end || end > cutoff ||
        issued > now || expiry <= now || expiry <= issued ||
        expiry - issued > MAX_AGE_MS) return invalid();

    const normalizedIds = expectedOrganizationIds.map((id) => String(id).toLowerCase()).sort();
    if (normalizedIds.some((id) => !ID_RE.test(id)) ||
        new Set(normalizedIds).size !== normalizedIds.length) return invalid();
    for (let i = 0; i < normalizedIds.length; i++) {
      if (claims.organizationIds[i] !== normalizedIds[i]) return invalid();
    }

    // Prevent evidence reference laundering: a syntactically valid SHA-256
    // reference alone is not proof that the corresponding manifest exists.
    // Bind signed approval to the EXACT source manifest bytes (not reserialized
    // JSON). This proves consistency/authenticity, not that the issuer actually
    // extracted an exhaustive cohort from the source of record.
    const digest = createHash("sha256").update(sourceEvidenceBytes).digest("hex");
    if (digest !== claims.evidenceSha256) return invalid();
    const manifest = JSON.parse(sourceEvidenceBytes.toString("utf8"));
    if (!Buffer.from(JSON.stringify(manifest)).equals(sourceEvidenceBytes)) return invalid();
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
        Object.keys(manifest).sort().join(",") !== MANIFEST_KEYS.join(",") ||
        manifest.audience !== PURPOSE || manifest.scope !== POPULATION_SCOPE ||
        manifest.complete !== true ||
        manifest.reportingRole !== approvedReportingRole ||
        manifest.from !== from || manifest.to !== to || manifest.asOf !== asOf ||
        typeof manifest.sourceQuerySha256 !== "string" ||
        !SHA256_RE.test(manifest.sourceQuerySha256) ||
        manifest.sourceQuerySha256 !== approvedSourceQuerySha256 ||
        !Number.isSafeInteger(manifest.totalOrganizations) ||
        manifest.totalOrganizations !== normalizedIds.length ||
        !Array.isArray(manifest.organizationIds) ||
        manifest.organizationIds.length !== normalizedIds.length) return invalid();
    for (let i = 0; i < normalizedIds.length; i++) {
      if (manifest.organizationIds[i] !== normalizedIds[i]) return invalid();
    }
    const exported = timestamp(manifest.exportedAt);
    if (exported === null || exported < cutoff ||
        exported > issued || exported > now) return invalid();

    return Object.freeze({
      ok: true, code: "signature_verified_not_population_completeness",
      keyId: attestation.keyId, evidenceSha256: claims.evidenceSha256,
      expiresAt: claims.expiresAt
    });
  } catch {
    return invalid();
  }
}

module.exports = { verifyCohortRosterAttestation };
