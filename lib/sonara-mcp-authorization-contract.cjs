// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// The MCP 2026-07-28 authorization requirements, as code rather than as a
// version string.
//
// ## The defect this exists because of
//
// `lib/sonara-aggregation-control-plane.cjs` line 12 declares a protocol
// baseline:
//
//     mcp: "2026-07-28"
//
// and line 273 of that same file says, about provider adapters:
//
//     "provider SDK and protocol version compatibility verified at runtime;
//      declaring a spec version is not runtime proof"
//
// Nothing read the first sentence against the second. The constant named a
// revision; no module held what that revision actually requires, so there was
// nothing a check could compare a connector against. That is this repository's
// recurring defect applied to a protocol version: a string that reports
// conformance without anything being true.
//
// `docs/research/PLATFORM_COMPLETENESS_AND_MARKET_CONVERGENCE_2026-09-25.md`
// line 255 states the prerequisite this module satisfies: "Add MCP
// protocol-version compatibility tests for 2026-07-28 before any MCP runtime
// expansion."
//
// ## What is here, and what is deliberately not
//
// This module grants NO runtime authority. It starts no connection, holds no
// credential and speaks to no provider. `docs/CONNECTORS_AND_MCP.md` records
// that MCP support in this repository is "registry infrastructure only", and
// that remains true. This is the contract an MCP connector would have to
// satisfy BEFORE any runtime is built, written now so the runtime cannot be
// built around it later.
//
// ## Where these requirements were read, and when
//
// Read from the specification itself on 1 October 2026, not from memory:
//
//   https://modelcontextprotocol.io/specification/versioning
//   https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
//
// Both fetched live. The versioning page states: "The current protocol version
// is 2026-07-28." Two findings from that read contradict what a 2026 assistant
// would most likely write from training, and both are load-bearing below:
//
//   1. Dynamic Client Registration (RFC 7591) is DEPRECATED as of this
//      revision -- "retained for backwards compatibility with authorization
//      servers that do not support Client ID Metadata Documents". A gateway
//      written to lead with DCR implements a deprecated mechanism as its
//      primary path.
//
//   2. Version negotiation is no longer the `initialize` handshake. Every
//      request declares its version via the
//      `io.modelcontextprotocol/protocolVersion` key in `_meta`, Streamable
//      HTTP also carries the `MCP-Protocol-Version` header, and a mismatch
//      answers `UnsupportedProtocolVersionError`. The handshake is the
//      BACKWARD-COMPATIBILITY path for 2025-11-25 and earlier.
//
// A requirement whose citation is absent below was not verified and must not be
// treated as though it were.

const CONTRACT_VERSION = "1.0.0";

// The date the specification pages above were fetched. Not the date this file
// was edited -- a later edit does not re-verify anything.
const SPEC_READ_ON = "2026-10-01";

const SPEC_BASE_URL = "https://modelcontextprotocol.io/specification";

// --- revisions ---------------------------------------------------------------
//
// The current revision, per the versioning page. Stated once here; every other
// module that needs it reads it from here rather than repeating the string.
const CURRENT_PROTOCOL_REVISION = "2026-07-28";

// Revisions whose version negotiation is the `initialize` handshake. The
// specification names "2025-11-25 and earlier" as the handshake-based set; the
// earlier dated revisions are listed explicitly rather than inferred from a
// date comparison, because an unknown future string must not sort its way into
// being treated as supported.
const HANDSHAKE_REVISIONS = Object.freeze(["2025-11-25", "2025-06-18", "2025-03-26"]);

// How a revision negotiates. A revision absent from this map is unknown, and
// unknown fails closed -- the same default as lib/sonara-agent-authority.cjs,
// and for the same reason: the moment a capability is added is the moment
// nobody is reading this file.
const NEGOTIATION_BY_REVISION = Object.freeze({
  "2026-07-28": Object.freeze({
    style: "per_request",
    metaKey: "io.modelcontextprotocol/protocolVersion",
    httpHeader: "MCP-Protocol-Version",
    discoveryRpc: "server/discover",
    mismatchError: "UnsupportedProtocolVersionError"
  }),
  "2025-11-25": Object.freeze({ style: "handshake", handshakeMethod: "initialize" }),
  "2025-06-18": Object.freeze({ style: "handshake", handshakeMethod: "initialize" }),
  "2025-03-26": Object.freeze({ style: "handshake", handshakeMethod: "initialize" })
});

function isKnownRevision(revision) {
  return Object.prototype.hasOwnProperty.call(NEGOTIATION_BY_REVISION, String(revision || ""));
}

function negotiationFor(revision) {
  const candidate = String(revision || "");
  if (!isKnownRevision(candidate)) {
    return { ok: false, reason: `${candidate || "(no revision)"} is not a protocol revision this contract knows.` };
  }
  return { ok: true, revision: candidate, negotiation: NEGOTIATION_BY_REVISION[candidate] };
}

// --- the normative requirements ----------------------------------------------
//
// Each carries the citation it was read from. `level` is the specification's own
// word, not a paraphrase: a SHOULD recorded as a MUST would make this document
// stricter than the standard it claims to implement, which is its own kind of
// untrue signal.
function requirement(id, level, sentence, citation) {
  return Object.freeze({ id, level, sentence, citation });
}

const AUTHORIZATION_PATH = `${SPEC_BASE_URL}/${CURRENT_PROTOCOL_REVISION}/basic/authorization`;

const CLIENT_REQUIREMENTS = Object.freeze([
  requirement(
    "protectedResourceMetadata",
    "MUST",
    "Use OAuth 2.0 Protected Resource Metadata (RFC 9728) for authorization server discovery; parse the resource_metadata parameter from the WWW-Authenticate header on 401, and fall back to the well-known URIs in the specified order.",
    `${AUTHORIZATION_PATH}/authorization-server-discovery`
  ),
  requirement(
    "resourceParameter",
    "MUST",
    "Include the RFC 8707 resource parameter in BOTH the authorization request and the token request, carrying the canonical URI of the MCP server, and send it whether or not the authorization server is known to support it.",
    `${AUTHORIZATION_PATH}#resource-parameter-implementation`
  ),
  requirement(
    "issuerValidation",
    "MUST",
    "Record the issuer from the authorization server's validated metadata before redirecting, and apply RFC 9207 section 2.4 validation to the authorization response -- including error responses -- before sending the authorization code to any token endpoint.",
    `${AUTHORIZATION_PATH}#authorization-response-validation`
  ),
  requirement(
    "bearerHeaderOnly",
    "MUST",
    "Send the access token in the Authorization request header on every HTTP request, and never in the URI query string.",
    `${AUTHORIZATION_PATH}#access-token-usage`
  ),
  requirement(
    "audienceBoundTokens",
    "MUST NOT",
    "Send the MCP server any token other than one issued by that server's own authorization server.",
    `${AUTHORIZATION_PATH}#token-handling`
  ),
  requirement(
    "pkce",
    "MUST",
    "Implement OAuth 2.1, which requires PKCE for the authorization code flow.",
    AUTHORIZATION_PATH
  ),
  requirement(
    "stepUpScopeUnion",
    "SHOULD",
    "On an insufficient_scope challenge, re-authorize with the UNION of the previously requested scopes and the challenged scopes, so a per-operation challenge does not drop permissions already granted; limit retries and treat repeated failure as permanent.",
    `${AUTHORIZATION_PATH}#step-up-authorization-flow`
  ),
  requirement(
    "clientIdMetadataDocument",
    "SHOULD",
    "Support OAuth Client ID Metadata Documents. Dynamic Client Registration (RFC 7591) is MAY and is deprecated, retained only for authorization servers that do not support Client ID Metadata Documents -- so it is a fallback, never the primary registration path.",
    `${AUTHORIZATION_PATH}/client-registration`
  )
]);

// SONARA's own two, which the specification does not speak to because they are
// not protocol questions. Both come from the owner's instruction for this work:
// "no connector should bypass tenant-scoped credentials and audit logging."
// They are marked non-waivable and apply to EVERY transport, including stdio,
// where the OAuth requirements above deliberately do not.
const SONARA_REQUIREMENTS = Object.freeze([
  Object.freeze({
    id: "tenantScopedCredentials",
    level: "MUST",
    waivable: false,
    sentence: "Resolve every credential through a tenant-scoped path, so one organization's connector can never present another organization's credential.",
    citation: "AGENTS.md -- Keep service-role secrets server-only; owner instruction 1 October 2026"
  }),
  Object.freeze({
    id: "auditLogging",
    level: "MUST",
    waivable: false,
    sentence: "Record every connector call in an organization-scoped audit log, with the outcome, so a run that happened can be told apart from one that was only attempted.",
    citation: "AGENTS.md -- agent action logging; owner instruction 1 October 2026"
  })
]);

const SPEC_REQUIREMENT_IDS = Object.freeze(CLIENT_REQUIREMENTS.map((entry) => entry.id));
const SONARA_REQUIREMENT_IDS = Object.freeze(SONARA_REQUIREMENTS.map((entry) => entry.id));

// The subset that is MUST or MUST NOT. A SHOULD is real guidance and is
// reported, but it does not by itself block an enablement -- recording it as
// blocking would make this contract stricter than the specification.
const BLOCKING_SPEC_REQUIREMENT_IDS = Object.freeze(
  CLIENT_REQUIREMENTS.filter((entry) => entry.level === "MUST" || entry.level === "MUST NOT").map((entry) => entry.id)
);

// --- issuer comparison -------------------------------------------------------
//
// The specification is explicit that this comparison is NOT a URL comparison:
//
//   "clients MUST NOT apply scheme or host case folding, default-port elision,
//    trailing-slash, or percent-encoding normalization (RFC 3986 Sections
//    6.2.2-6.2.3) before comparison"
//
// It is RFC 3986 section 6.2.1 simple string comparison. This function is
// written as one deliberately, because every instinct a developer has about
// comparing URLs is wrong here, and a tolerant comparison is the vulnerability
// rather than a convenience: accepting `https://EVIL.example.com` as
// `https://evil.example.com`, or a URL object's normalised `href`, is how a
// mix-up attack gets its code to the wrong token endpoint.
function issuerMatches(recordedIssuer, receivedIssuer) {
  if (typeof recordedIssuer !== "string" || typeof receivedIssuer !== "string") return false;
  if (!recordedIssuer || !receivedIssuer) return false;
  return recordedIssuer === receivedIssuer;
}

// The four-row table from the specification, kept as four rows rather than
// collapsed into a boolean expression. The row that is easy to lose is the
// second: `iss` ABSENT while the metadata advertises it is a REJECT, not a
// pass. A reading that treats absence as "nothing to check" implements three of
// the four rows and looks correct on every honest request.
const ISSUER_DECISIONS = Object.freeze(["match", "mismatch", "reject_missing_iss", "proceed_unadvertised"]);

function validateAuthorizationResponse({
  recordedIssuer,
  receivedIssuer,
  metadataAdvertisesIss
} = {}) {
  const advertised = metadataAdvertisesIss === true;
  const present = typeof receivedIssuer === "string" && receivedIssuer.length > 0;

  if (advertised && !present) {
    return Object.freeze({
      ok: false,
      decision: "reject_missing_iss",
      reason: "The authorization server advertises authorization_response_iss_parameter_supported, and this response carried no iss. RFC 9207 section 2.4 requires rejecting it."
    });
  }

  if (present) {
    if (!recordedIssuer) {
      return Object.freeze({
        ok: false,
        decision: "mismatch",
        reason: "No issuer was recorded before the redirect, so there is nothing authentic to compare against. RFC 9207 validation provides no protection without it."
      });
    }
    const matched = issuerMatches(recordedIssuer, receivedIssuer);
    return Object.freeze({
      ok: matched,
      decision: matched ? "match" : "mismatch",
      reason: matched
        ? "The iss in the response is identical to the issuer recorded from validated metadata."
        : "The iss in the response is not identical to the recorded issuer. Do not send the authorization code anywhere, and do not display error, error_description or error_uri from this response."
    });
  }

  return Object.freeze({
    ok: true,
    decision: "proceed_unadvertised",
    reason: "The authorization server does not advertise iss and did not send one, so there is nothing to compare."
  });
}

// --- canonical resource URI --------------------------------------------------
//
// RFC 8707 section 2, as the specification restates it. The two invalid shapes
// it names explicitly are a missing scheme and a fragment.
function canonicalResourceUri(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { ok: false, reason: "No resource URI was given." };
  if (raw.includes("#")) {
    return { ok: false, reason: `${raw} contains a fragment, which RFC 8707 does not permit in a resource identifier.` };
  }
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
    return { ok: false, reason: `${raw} has no scheme, so it is not an absolute URI.` };
  }
  return { ok: true, uri: raw };
}

// --- the connector decision --------------------------------------------------
//
// `transport` decides WHICH requirements apply, and getting that wrong in
// either direction is a defect:
//
//   - An HTTP connector exempted from the OAuth requirements is an
//     unauthenticated remote connection.
//   - A stdio connector held to them can never be enabled, because the
//     specification says stdio implementations SHOULD NOT follow the HTTP
//     authorization flow and should take credentials from the environment
//     instead. Demanding protected resource metadata of a subprocess is a
//     requirement nothing can satisfy.
//
// An unrecognised transport is neither, and fails closed.
const HTTP_TRANSPORTS = Object.freeze(["http", "streamable-http", "sse"]);
const STDIO_TRANSPORTS = Object.freeze(["stdio"]);

function declaredSet(record) {
  const declares = record && typeof record.declares === "object" && record.declares ? record.declares : {};
  return (id) => declares[id] === true;
}

function evaluateConnectorAuthorization(record) {
  const unmet = [];
  const advisory = [];
  const transport = String((record && record.transport) || "").trim().toLowerCase();
  const revision = String((record && record.protocolRevision) || "").trim();
  const declares = declaredSet(record);
  const wantsProduction = Boolean(record && record.enabledInProduction);

  const isHttp = HTTP_TRANSPORTS.includes(transport);
  const isStdio = STDIO_TRANSPORTS.includes(transport);

  if (!isHttp && !isStdio) {
    unmet.push({
      id: "transport",
      sentence: transport
        ? `"${transport}" is not a transport this contract recognises. An unrecognised transport cannot be shown to meet any requirement, so it is refused.`
        : "No transport was declared, so which requirements apply cannot be decided."
    });
  }

  if (!isKnownRevision(revision)) {
    unmet.push({
      id: "protocolRevision",
      sentence: `${revision || "(none declared)"} is not a protocol revision this contract knows. Supported: ${Object.keys(NEGOTIATION_BY_REVISION).join(", ")}.`
    });
  }

  // SONARA's two apply to every transport and cannot be waived.
  for (const entry of SONARA_REQUIREMENTS) {
    if (!declares(entry.id)) unmet.push({ id: entry.id, sentence: entry.sentence });
  }

  if (isHttp) {
    for (const entry of CLIENT_REQUIREMENTS) {
      if (declares(entry.id)) continue;
      if (BLOCKING_SPEC_REQUIREMENT_IDS.includes(entry.id)) unmet.push({ id: entry.id, sentence: entry.sentence });
      else advisory.push({ id: entry.id, level: entry.level, sentence: entry.sentence });
    }
  }

  if (isStdio) {
    const httpOnly = SPEC_REQUIREMENT_IDS.filter((id) => declares(id));
    if (httpOnly.length) {
      advisory.push({
        id: "stdioDeclaresHttpAuthorization",
        level: "NOTE",
        sentence: `A stdio connector declares HTTP authorization requirements (${httpOnly.join(", ")}). The specification says stdio implementations SHOULD NOT follow the HTTP authorization flow and should take credentials from the environment; these declarations are not what makes it safe.`
      });
    }
  }

  const ok = unmet.length === 0;
  return Object.freeze({
    ok,
    mayEnableInProduction: ok,
    transport: isHttp ? "http" : isStdio ? "stdio" : "unrecognised",
    protocolRevision: isKnownRevision(revision) ? revision : null,
    unmet: Object.freeze(unmet),
    advisory: Object.freeze(advisory),
    reason: ok
      ? `Every blocking requirement for a ${isHttp ? "HTTP" : "stdio"} MCP connector on ${revision} is declared.`
      : `${unmet.length} requirement(s) are not met: ${unmet.map((entry) => entry.id).join(", ")}.`
      + (wantsProduction ? " This record asks to be enabled in production, and must not be." : "")
  });
}

module.exports = {
  CONTRACT_VERSION,
  SPEC_READ_ON,
  SPEC_BASE_URL,
  CURRENT_PROTOCOL_REVISION,
  HANDSHAKE_REVISIONS,
  NEGOTIATION_BY_REVISION,
  CLIENT_REQUIREMENTS,
  SONARA_REQUIREMENTS,
  SPEC_REQUIREMENT_IDS,
  SONARA_REQUIREMENT_IDS,
  BLOCKING_SPEC_REQUIREMENT_IDS,
  ISSUER_DECISIONS,
  HTTP_TRANSPORTS,
  STDIO_TRANSPORTS,
  isKnownRevision,
  negotiationFor,
  issuerMatches,
  validateAuthorizationResponse,
  canonicalResourceUri,
  evaluateConnectorAuthorization
};
