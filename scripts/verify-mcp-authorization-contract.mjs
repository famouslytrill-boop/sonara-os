#!/usr/bin/env node
"use strict";

// One place that says what MCP revision this repository targets, and a check
// that keeps the rest of the repository agreeing with it.
//
// ## The defect this exists because of
//
// Two modules declared an MCP protocol revision independently:
//
//   lib/sonara-aggregation-control-plane.cjs   PROTOCOL_BASELINE.mcp
//   lib/sonara-platform-completeness.cjs       CURRENT_TECH_BASELINES.mcp.protocol
//
// Both said "2026-07-28", and nothing compared them to each other or to any
// statement of what that revision requires. The aggregation module's own
// adapter rule, on line 273 of the same file that declares the baseline, reads:
// "provider SDK and protocol version compatibility verified at runtime;
// declaring a spec version is not runtime proof". The declaration was the only
// thing there.
//
// lib/sonara-mcp-authorization-contract.cjs now holds the requirements, read
// from the specification on 1 October 2026. This check enforces three things
// the unit tests cannot:
//
//   1. Every module that names an MCP revision names the same one.
//   2. The classifier still refuses a non-conforming connector AND still
//      admits a conforming one -- a gate that denies everything is as broken as
//      one that allows everything, and only the second gets noticed.
//   3. No MCP-capable record in the registry carries a production-reachable
//      integration status, because no MCP runtime exists to carry it safely.
//      docs/CONNECTORS_AND_MCP.md states the repository provides "registry
//      infrastructure only".
//
// ## Why the issuer comparison is re-checked here and not left to the tests
//
// A tolerant issuer comparison is a mix-up vulnerability, not a style
// preference, and the four normalizations the specification forbids are exactly
// the four a developer would add to make a failing comparison pass. That belongs
// in the release chain.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const contract = require("../lib/sonara-mcp-authorization-contract.cjs");
const { PROTOCOL_BASELINE } = require("../lib/sonara-aggregation-control-plane.cjs");
const { CURRENT_TECH_BASELINES } = require("../lib/sonara-platform-completeness.cjs");
const { AI_INTEGRATIONS } = require("../lib/sonara-ai-integration-registry.cjs");

const {
  CURRENT_PROTOCOL_REVISION,
  SPEC_READ_ON,
  CLIENT_REQUIREMENTS,
  SONARA_REQUIREMENTS,
  OAUTH_REQUIREMENT_IDS,
  SONARA_REQUIREMENT_IDS,
  BLOCKING_OAUTH_REQUIREMENT_IDS,
  NEGOTIATION_BY_REVISION,
  issuerMatches,
  validateAuthorizationResponse,
  evaluateConnectorAuthorization
} = contract;

const problems = [];

// --- the population, before anything is concluded from it ---------------------
//
// Each of the counts below is asserted rather than printed, so this check
// reports a figure it actually measured and fails rather than passing on an
// empty list.
if (CLIENT_REQUIREMENTS.length < 6) {
  problems.push(`The contract holds only ${CLIENT_REQUIREMENTS.length} client requirement(s). This check has gone blind -- it cannot verify conformance against a list this short.`);
}
if (SONARA_REQUIREMENTS.length < 2) {
  problems.push(`The contract holds only ${SONARA_REQUIREMENTS.length} SONARA requirement(s); tenant-scoped credentials and audit logging are both required.`);
}
if (BLOCKING_OAUTH_REQUIREMENT_IDS.length < 5) {
  problems.push(`Only ${BLOCKING_OAUTH_REQUIREMENT_IDS.length} requirement(s) block an enablement. With too few, the classifier admits connectors it should refuse.`);
}

const uncited = CLIENT_REQUIREMENTS.filter((entry) => !/^https:\/\/modelcontextprotocol\.io\//.test(String(entry.citation || "")));
if (uncited.length) {
  problems.push(
    "These requirements carry no specification citation, so nobody can check the level they claim:\n"
    + uncited.map((entry) => `      ${entry.id}`).join("\n")
  );
}

// --- one revision, named in one place ----------------------------------------
const declarers = [
  { where: "lib/sonara-aggregation-control-plane.cjs PROTOCOL_BASELINE.mcp", value: PROTOCOL_BASELINE && PROTOCOL_BASELINE.mcp },
  { where: "lib/sonara-platform-completeness.cjs CURRENT_TECH_BASELINES.mcp.protocol", value: CURRENT_TECH_BASELINES && CURRENT_TECH_BASELINES.mcp && CURRENT_TECH_BASELINES.mcp.protocol }
];

const disagreeing = declarers.filter((entry) => entry.value !== CURRENT_PROTOCOL_REVISION);
if (disagreeing.length) {
  problems.push(
    `The contract targets MCP ${CURRENT_PROTOCOL_REVISION} and these declare something else:\n`
    + disagreeing.map((entry) => `      ${entry.where} = ${JSON.stringify(entry.value)}`).join("\n")
    + "\n\n    A revision named in two places is a revision that can drift in one of them.\n"
    + "    If the specification moved, update lib/sonara-mcp-authorization-contract.cjs by READING\n"
    + "    the new revision -- the requirements change between revisions, so the string alone is not the update."
  );
}

// The current revision must negotiate per request. If a future edit files it as
// handshake-based, the backward-compatibility path has been confused with the
// current one.
const currentNegotiation = NEGOTIATION_BY_REVISION[CURRENT_PROTOCOL_REVISION];
if (!currentNegotiation || currentNegotiation.style !== "per_request") {
  problems.push(
    `MCP ${CURRENT_PROTOCOL_REVISION} negotiates per request via the _meta protocolVersion key and the MCP-Protocol-Version header; `
    + `this contract files it as ${JSON.stringify(currentNegotiation && currentNegotiation.style)}. `
    + "The initialize handshake is the backward-compatibility path for 2025-11-25 and earlier, not the current mechanism."
  );
}

// --- the classifier still refuses, and still admits --------------------------
//
// Two-sided on purpose. The first direction is the security property; the second
// is what stops this gate being satisfied by a classifier that denies
// everything, which would pass every refusal assertion above.
function conformingRecord() {
  const declares = {};
  for (const id of OAUTH_REQUIREMENT_IDS) declares[id] = true;
  for (const id of SONARA_REQUIREMENT_IDS) declares[id] = true;
  return { transport: "http", protocolRevision: CURRENT_PROTOCOL_REVISION, declares };
}

const admitted = evaluateConnectorAuthorization(conformingRecord());
if (!admitted.ok) {
  problems.push(
    "A connector declaring every requirement in the contract is still refused:\n"
    + `      ${admitted.reason}\n`
    + "    A classifier that refuses everything satisfies every other assertion here while being useless."
  );
}

const admittedDespite = [];
for (const id of BLOCKING_OAUTH_REQUIREMENT_IDS.concat(SONARA_REQUIREMENT_IDS)) {
  const record = conformingRecord();
  delete record.declares[id];
  const decided = evaluateConnectorAuthorization(record);
  if (decided.ok) admittedDespite.push(id);
  else if (!decided.unmet.some((entry) => entry.id === id)) {
    problems.push(`A connector missing ${id} is refused, but the refusal does not name ${id}: ${decided.reason}`);
  }
}
if (admittedDespite.length) {
  problems.push(
    "A connector may be enabled while not meeting these requirements:\n"
    + admittedDespite.map((id) => `      ${id}`).join("\n")
    + "\n\n    Each of these is a MUST in the specification or non-waivable in AGENTS.md."
  );
}

const failOpen = ["websocket", "grpc", "", undefined].filter((transport) => evaluateConnectorAuthorization({ ...conformingRecord(), transport }).ok);
if (failOpen.length) {
  problems.push(
    `These transports are admitted without being recognised: ${failOpen.map((value) => JSON.stringify(value)).join(", ")}.\n`
    + "    An unrecognised transport cannot be shown to meet any requirement, so it must fail closed."
  );
}

// --- the issuer comparison, which must stay a string comparison --------------
const forbidden = [
  { label: "host case folding", recorded: "https://auth.example.com", received: "https://AUTH.example.com" },
  { label: "scheme case folding", recorded: "https://auth.example.com", received: "HTTPS://auth.example.com" },
  { label: "default-port elision", recorded: "https://auth.example.com", received: "https://auth.example.com:443" },
  { label: "trailing-slash normalization", recorded: "https://auth.example.com", received: "https://auth.example.com/" },
  { label: "percent-encoding normalization", recorded: "https://auth.example.com/a%2Fb", received: "https://auth.example.com/a/b" }
];
const tolerated = forbidden.filter((probe) => issuerMatches(probe.recorded, probe.received));
if (tolerated.length) {
  problems.push(
    "The issuer comparison applies normalizations the specification forbids:\n"
    + tolerated.map((probe) => `      ${probe.label}: ${probe.recorded} accepted as ${probe.received}`).join("\n")
    + "\n\n    This is RFC 3986 section 6.2.1 simple string comparison. Each tolerance above\n"
    + "    accepts an issuer the authorization server did not name, which is how a mix-up\n"
    + "    attack reaches the wrong token endpoint."
  );
}
if (!issuerMatches("https://auth.example.com", "https://auth.example.com")) {
  problems.push("The issuer comparison rejects an identical issuer, so it refuses every honest authorization response.");
}

// The row an implementation loses without ever behaving oddly on a real request.
const missingIss = validateAuthorizationResponse({
  recordedIssuer: "https://auth.example.com",
  receivedIssuer: undefined,
  metadataAdvertisesIss: true
});
if (missingIss.ok !== false || missingIss.decision !== "reject_missing_iss") {
  problems.push(
    "An authorization response with no iss, from a server that advertises sending one, is not rejected:\n"
    + `      ${JSON.stringify(missingIss)}\n`
    + "    RFC 9207 section 2.4 requires rejecting it. An implementation missing this row\n"
    + "    behaves correctly on every honest request, which is why it survives review."
  );
}

// --- no MCP record may be production-reachable yet ---------------------------
//
// docs/CONNECTORS_AND_MCP.md: "MCP support requires configured MCP servers. The
// repo provides registry infrastructure only." Until a runtime exists and
// satisfies the contract above, an MCP-capable record must not carry a status
// that puts it in the request path.
const PRODUCTION_REACHABLE_STATUSES = Object.freeze(["adapter_available", "gateway_model_option"]);

const mcpCapable = (AI_INTEGRATIONS || []).filter((record) => {
  const haystack = JSON.stringify([record && record.capabilities, record && record.role, record && record.notes]).toLowerCase();
  return /\bmcp\b/.test(haystack);
});

// The population guard. There are MCP-capable records in the registry; if this
// finds none, the scan stopped matching rather than the risk going away.
if (mcpCapable.length === 0) {
  problems.push(
    "No MCP-capable record was found in lib/sonara-ai-integration-registry.cjs.\n"
    + "    There were two when this check was written (gemini_cli, claude_code), so finding none\n"
    + "    means this scan stopped matching, not that nothing needs checking."
  );
}

const reachable = mcpCapable.filter((record) => PRODUCTION_REACHABLE_STATUSES.includes(String(record && record.integrationStatus)));
if (reachable.length) {
  problems.push(
    "These MCP-capable records carry a production-reachable integration status:\n"
    + reachable.map((record) => `      ${record.key} -> ${record.integrationStatus}`).join("\n")
    + "\n\n    No MCP runtime exists in this repository, so nothing can have satisfied the\n"
    + "    authorization contract. Either the runtime was built and this check needs the\n"
    + "    conformance evidence wired in, or the status is wrong."
  );
}

if (problems.length) {
  console.error(`MCP authorization contract failed on ${problems.length} point(s).\n`);
  console.error(problems.map((problem) => `  - ${problem}`).join("\n\n"));
  process.exit(1);
}

console.log(
  `MCP authorization contract verified against revision ${CURRENT_PROTOCOL_REVISION} (specification read ${SPEC_READ_ON}): `
  + `${CLIENT_REQUIREMENTS.length} specification requirement(s) of which ${BLOCKING_OAUTH_REQUIREMENT_IDS.length} block an enablement, `
  + `${SONARA_REQUIREMENTS.length} non-waivable SONARA requirement(s), `
  + `${declarers.length} module(s) declaring the revision and all agreeing, `
  + `${BLOCKING_OAUTH_REQUIREMENT_IDS.length + SONARA_REQUIREMENT_IDS.length} refusal probe(s) and 1 admission probe, `
  + `${forbidden.length} forbidden issuer normalization(s) still rejected, `
  + `and ${mcpCapable.length} MCP-capable registry record(s) none of which is production-reachable.`
);
