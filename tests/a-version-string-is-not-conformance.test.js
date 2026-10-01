"use strict";

const assert = require("node:assert/strict");
const {
  CURRENT_PROTOCOL_REVISION,
  HANDSHAKE_REVISIONS,
  NEGOTIATION_BY_REVISION,
  CLIENT_REQUIREMENTS,
  SONARA_REQUIREMENTS,
  OAUTH_REQUIREMENT_KEYS,
  SONARA_REQUIREMENT_KEYS,
  BLOCKING_OAUTH_KEYS,
  isKnownRevision,
  negotiationFor,
  issuerMatches,
  validateAuthorizationResponse,
  canonicalResourceUri,
  evaluateConnectorAuthorization
} = require("../lib/sonara-mcp-authorization-contract.cjs");

const { PROTOCOL_BASELINE } = require("../lib/sonara-aggregation-control-plane.cjs");

// lib/sonara-aggregation-control-plane.cjs declared `mcp: "2026-07-28"` while
// nothing in the repository held what 2026-07-28 requires. These tests are the
// difference between naming a revision and conforming to it.

// Every requirement declared, which is what a record has to produce to be
// enabled. Built by reading the contract's own key lists rather than by writing
// the names out again -- a hand-written list here would stop covering a
// requirement the moment one is added, and would do it silently.
function fullyDeclared(extra = {}) {
  const declares = {};
  for (const key of OAUTH_REQUIREMENT_KEYS) declares[key] = true;
  for (const key of SONARA_REQUIREMENT_KEYS) declares[key] = true;
  return { transport: "http", protocolRevision: CURRENT_PROTOCOL_REVISION, declares, ...extra };
}

describe("a version string is not conformance", () => {
  it("has requirements to check at all, so none of this passes by measuring nothing", () => {
    assert.ok(CLIENT_REQUIREMENTS.length >= 6, `only ${CLIENT_REQUIREMENTS.length} client requirements; this file has gone blind`);
    assert.ok(SONARA_REQUIREMENTS.length >= 2, `only ${SONARA_REQUIREMENTS.length} SONARA requirements`);
    assert.ok(BLOCKING_OAUTH_KEYS.length >= 5, `only ${BLOCKING_OAUTH_KEYS.length} blocking requirements; an empty blocking set would let everything through`);
    for (const entry of CLIENT_REQUIREMENTS) {
      assert.ok(entry.citation && /^https:\/\//.test(entry.citation), `${entry.key} has no specification citation, so its level cannot be checked against anything`);
      assert.ok(["MUST", "MUST NOT", "SHOULD"].includes(entry.level), `${entry.key} has level ${entry.level}, which is not a word the specification uses`);
    }
  });

  // The defect itself: the declared baseline and the contract have to be the
  // same revision, or the repository names one revision and checks another.
  it("checks the same revision the aggregation control plane declares", () => {
    assert.equal(
      PROTOCOL_BASELINE.mcp,
      CURRENT_PROTOCOL_REVISION,
      "the protocol baseline names one MCP revision and this contract holds another, which is the drift this file exists to catch"
    );
  });

  describe("protocol revisions", () => {
    it("knows the current revision negotiates per request, not by handshake", () => {
      const resolved = negotiationFor(CURRENT_PROTOCOL_REVISION);
      assert.equal(resolved.ok, true, resolved.reason || "");
      assert.equal(resolved.negotiation.style, "per_request");
      assert.equal(resolved.negotiation.metaKey, "io.modelcontextprotocol/protocolVersion");
      assert.equal(resolved.negotiation.httpHeader, "MCP-Protocol-Version");
      assert.equal(resolved.negotiation.discoveryRpc, "server/discover");
    });

    it("keeps the handshake revisions as the backward-compatibility path", () => {
      assert.ok(HANDSHAKE_REVISIONS.length >= 1, "no handshake revisions recorded");
      for (const revision of HANDSHAKE_REVISIONS) {
        assert.ok(isKnownRevision(revision), `${revision} is listed as handshake-based but is not a known revision`);
        assert.equal(
          NEGOTIATION_BY_REVISION[revision].style,
          "handshake",
          `${revision} is listed as handshake-based but its negotiation says otherwise`
        );
      }
      assert.ok(
        !HANDSHAKE_REVISIONS.includes(CURRENT_PROTOCOL_REVISION),
        "the current revision must not be in the handshake set -- that is the change this revision made"
      );
    });

    // Fail closed, not open. A future revision string is not something to guess at.
    it("refuses a revision it does not know rather than assuming it is close enough", () => {
      for (const unknown of ["2027-01-01", "2026-07-29", "latest", "draft", "", null, undefined, "2026-07-28 ", {}]) {
        assert.equal(isKnownRevision(unknown), false, `${JSON.stringify(unknown)} must not read as a known revision`);
        assert.equal(negotiationFor(unknown).ok, false, `${JSON.stringify(unknown)} must not resolve to a negotiation`);
      }
    });
  });

  // The specification names, by number, the four normalizations a client MUST
  // NOT apply. Each is a tolerance a developer would add on purpose.
  describe("issuer comparison is a string comparison, which is the point", () => {
    const recorded = "https://auth.example.com";

    it("does not fold scheme or host case", () => {
      assert.equal(issuerMatches(recorded, "https://AUTH.example.com"), false, "host case folding would accept a lookalike issuer");
      assert.equal(issuerMatches(recorded, "HTTPS://auth.example.com"), false, "scheme case folding would accept a lookalike issuer");
    });

    it("does not elide a default port", () => {
      assert.equal(issuerMatches(recorded, "https://auth.example.com:443"), false, "default-port elision is named in the specification as forbidden");
    });

    it("does not ignore a trailing slash", () => {
      assert.equal(issuerMatches(recorded, "https://auth.example.com/"), false, "trailing-slash normalization is named in the specification as forbidden");
    });

    it("does not decode percent-encoding", () => {
      assert.equal(issuerMatches("https://auth.example.com/a%2Fb", "https://auth.example.com/a/b"), false, "percent-encoding normalization is named in the specification as forbidden");
    });

    it("matches an identical string, so it is not refusing everything", () => {
      assert.equal(issuerMatches(recorded, recorded), true, "a correct issuer must still pass, or this check proves nothing");
    });

    it("treats a non-string or empty issuer as no match", () => {
      for (const bad of [null, undefined, "", 0, {}, []]) {
        assert.equal(issuerMatches(recorded, bad), false, `${JSON.stringify(bad)} must not match`);
        assert.equal(issuerMatches(bad, recorded), false, `${JSON.stringify(bad)} must not match as the recorded side`);
      }
    });
  });

  // Four rows. The second is the one an implementation loses.
  describe("the RFC 9207 authorization response table", () => {
    const recorded = "https://auth.example.com";

    it("compares a present iss when the server advertises it", () => {
      assert.equal(validateAuthorizationResponse({ recordedIssuer: recorded, receivedIssuer: recorded, metadataAdvertisesIss: true }).decision, "match");
      const bad = validateAuthorizationResponse({ recordedIssuer: recorded, receivedIssuer: "https://evil.example.com", metadataAdvertisesIss: true });
      assert.equal(bad.ok, false);
      assert.equal(bad.decision, "mismatch");
    });

    // The row that is easy to drop. Absence is a rejection here, not a pass,
    // and an implementation missing this row behaves correctly on every honest
    // request -- which is why it would never be noticed.
    it("rejects a MISSING iss when the server advertises that it sends one", () => {
      const decided = validateAuthorizationResponse({ recordedIssuer: recorded, receivedIssuer: undefined, metadataAdvertisesIss: true });
      assert.equal(decided.ok, false, "an advertised-but-absent iss must be rejected, not treated as nothing to check");
      assert.equal(decided.decision, "reject_missing_iss");
    });

    it("still compares a present iss when the server does not advertise it", () => {
      const decided = validateAuthorizationResponse({ recordedIssuer: recorded, receivedIssuer: "https://evil.example.com", metadataAdvertisesIss: false });
      assert.equal(decided.ok, false, "the specification compares a present iss regardless of advertisement");
      assert.equal(decided.decision, "mismatch");
    });

    it("proceeds only when the server neither advertises nor sends an iss", () => {
      const decided = validateAuthorizationResponse({ recordedIssuer: recorded, receivedIssuer: undefined, metadataAdvertisesIss: false });
      assert.equal(decided.ok, true);
      assert.equal(decided.decision, "proceed_unadvertised");
    });

    it("will not validate against an issuer that was never recorded", () => {
      const decided = validateAuthorizationResponse({ recordedIssuer: "", receivedIssuer: "https://auth.example.com", metadataAdvertisesIss: true });
      assert.equal(decided.ok, false, "with nothing authentic recorded, the comparison provides no protection and must not report success");
    });

    it("refuses a mismatch on an error response too", () => {
      // The specification says this applies equally to error responses, and that
      // on mismatch the client must not act on or display error_description.
      const decided = validateAuthorizationResponse({ recordedIssuer: "https://auth.example.com", receivedIssuer: "https://evil.example.com", metadataAdvertisesIss: true });
      assert.equal(decided.ok, false);
      assert.match(decided.reason, /error_description/);
    });
  });

  describe("the canonical resource URI", () => {
    it("accepts the forms the specification lists as valid", () => {
      for (const uri of ["https://mcp.example.com/mcp", "https://mcp.example.com", "https://mcp.example.com:8443", "https://mcp.example.com/server/mcp"]) {
        assert.equal(canonicalResourceUri(uri).ok, true, `${uri} is listed as valid in the specification`);
      }
    });

    it("refuses the forms the specification lists as invalid", () => {
      assert.equal(canonicalResourceUri("mcp.example.com").ok, false, "a missing scheme is named as invalid");
      assert.equal(canonicalResourceUri("https://mcp.example.com#fragment").ok, false, "a fragment is named as invalid");
      assert.equal(canonicalResourceUri("").ok, false);
      assert.equal(canonicalResourceUri(null).ok, false);
    });
  });

  describe("whether a connector may be enabled", () => {
    it("allows one that declares every blocking requirement", () => {
      const decided = evaluateConnectorAuthorization(fullyDeclared());
      assert.equal(decided.ok, true, `expected a fully declared connector to pass, got: ${decided.reason}`);
      assert.equal(decided.mayEnableInProduction, true);
      assert.equal(decided.unmet.length, 0);
    });

    // One case per blocking requirement, generated from the contract's own list
    // so a new requirement is covered the moment it is added.
    it("refuses one with any single blocking requirement missing, and names it", () => {
      for (const key of BLOCKING_OAUTH_KEYS) {
        const record = fullyDeclared();
        delete record.declares[key];
        const decided = evaluateConnectorAuthorization(record);
        assert.equal(decided.ok, false, `a connector missing ${key} must not be enabled`);
        assert.ok(
          decided.unmet.some((entry) => entry.key === key),
          `the refusal for a missing ${key} must name ${key}; it said: ${decided.reason}`
        );
      }
    });

    it("refuses an unrecognised transport rather than picking a rule set for it", () => {
      for (const transport of ["websocket", "grpc", "", undefined, "HTTP2"]) {
        const decided = evaluateConnectorAuthorization(fullyDeclared({ transport }));
        assert.equal(decided.ok, false, `transport ${JSON.stringify(transport)} must fail closed`);
        assert.ok(decided.unmet.some((entry) => entry.key === "transport"), "the refusal must say the transport is the problem");
      }
    });

    it("refuses an unknown protocol revision", () => {
      const decided = evaluateConnectorAuthorization(fullyDeclared({ protocolRevision: "2027-03-01" }));
      assert.equal(decided.ok, false);
      assert.ok(decided.unmet.some((entry) => entry.key === "protocolRevision"));
    });

    it("does not demand HTTP authorization of a stdio connector, which could never satisfy it", () => {
      const declares = {};
      for (const key of SONARA_REQUIREMENT_KEYS) declares[key] = true;
      const decided = evaluateConnectorAuthorization({ transport: "stdio", protocolRevision: CURRENT_PROTOCOL_REVISION, declares });
      assert.equal(decided.ok, true, `a stdio connector with tenant scoping and audit logging should pass, got: ${decided.reason}`);
      assert.equal(decided.transport, "stdio");
    });

    // The owner's two, which are not protocol questions and do not get waived
    // by a transport the specification exempts from OAuth.
    it("still requires tenant-scoped credentials and audit logging on stdio", () => {
      for (const key of SONARA_REQUIREMENT_KEYS) {
        const declares = {};
        for (const other of SONARA_REQUIREMENT_KEYS) if (other !== key) declares[other] = true;
        const decided = evaluateConnectorAuthorization({ transport: "stdio", protocolRevision: CURRENT_PROTOCOL_REVISION, declares });
        assert.equal(decided.ok, false, `a stdio connector without ${key} must not be enabled`);
        assert.ok(decided.unmet.some((entry) => entry.key === key), `the refusal must name ${key}`);
      }
    });

    it("says so when a refused record was asking to go to production", () => {
      const record = fullyDeclared({ enabledInProduction: true });
      delete record.declares.resourceParameter;
      const decided = evaluateConnectorAuthorization(record);
      assert.equal(decided.ok, false);
      assert.match(decided.reason, /must not be/);
    });

    it("treats a record with no declarations at all as refused, not as nothing to check", () => {
      for (const record of [{}, { transport: "http" }, { transport: "http", protocolRevision: CURRENT_PROTOCOL_REVISION }, null, undefined]) {
        const decided = evaluateConnectorAuthorization(record);
        assert.equal(decided.ok, false, `${JSON.stringify(record)} must be refused`);
      }
    });
  });

  // Reading the specification rather than training data is what produced this
  // one: Dynamic Client Registration is deprecated in this revision. A gateway
  // that makes it the primary registration path implements a deprecated
  // mechanism first.
  it("does not make deprecated Dynamic Client Registration a requirement", () => {
    assert.ok(
      OAUTH_REQUIREMENT_KEYS.includes("clientIdMetadataDocument"),
      "Client ID Metadata Documents are the preferred registration path and must be recorded"
    );
    assert.ok(
      !BLOCKING_OAUTH_KEYS.includes("clientIdMetadataDocument"),
      "Client ID Metadata Documents are SHOULD, not MUST; recording them as blocking would be stricter than the specification"
    );
    assert.ok(
      !OAUTH_REQUIREMENT_KEYS.some((key) => /dynamicClientRegistration/i.test(key)),
      "Dynamic Client Registration is deprecated in this revision and must not be carried as a requirement of its own"
    );
  });
});
