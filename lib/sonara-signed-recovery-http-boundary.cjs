// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const { parseSignedRecoveryTransport } = require("./sonara-signed-recovery-transport.cjs");
const { ingestSignedRecoveryEnvelope } = require("./sonara-signed-recovery-ingress.cjs");

// Explicit server-side composition contract for raw HTTP bytes and
// IncomingMessage.rawHeaders (original pairs). No route is registered here,
// and neither credentials nor sensor traffic are accepted automatically.
// Never pass parsed JSON or normalized headers to this security boundary.
async function ingestSignedRecoveryRawHttp(rawBody, rawHeaders, {
  enabled = false, ...adapters
} = {}) {
  if (enabled !== true) return Object.freeze({
    status: "disabled", reason: "recovery_not_enabled"
  });
  const parsed = parseSignedRecoveryTransport(rawBody, rawHeaders);
  if (parsed.ok !== true) return Object.freeze({
    status: "escalated", reason: "invalid_signed_transport"
  });
  return ingestSignedRecoveryEnvelope(parsed.envelope, {
    ...adapters, enabled: true
  });
}
module.exports = { ingestSignedRecoveryRawHttp };
