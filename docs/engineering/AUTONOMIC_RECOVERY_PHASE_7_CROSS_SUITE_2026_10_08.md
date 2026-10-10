# SONARA Cross-Suite Reliability — Phase 7 (2026-10-08)

Draft PR #510 only: not merged, deployed, or activated.

## Actual integration
Existing HTTP observability middleware now emits bounded product and journey attributes in OpenTelemetry server metrics and structured events. The input is the declared Express route template, never a raw request URL. No customer ID is added to new labels, and unknown routes are unclassified.

Business Builder: business operations, field operations and merchant commerce. Work-order changes, dispatch, inventory and payment require their existing approvals.
Creator Studio: generation and delivery diagnostics. Paid generation, voice rights, publication and marketplace release remain owner-controlled.
Growth Studio: campaigns, integrations and analytics diagnostics. Sending campaigns, publication, consent changes and lead writes remain owner-controlled.
SONARA One: platform and identity diagnostics. Tenant permissions, billing, deployments, security and identity remain owner-controlled.

New module: lib/sonara-cross-suite-reliability.cjs.
Existing integration changed: lib/sonara-observability.cjs.
Test module: tests/sonara-cross-suite-reliability.test.js.

All recovery policy decisions in this module deny automatic business effects; diagnostics never create a privileged incident or a repair claim. Current recovery ingestion, claim scheduling and provider execution remain disabled until independently approved and proved safe.

The isolated local classification test suite passed 5/5 in Node 22. Full repository Mocha, exact-head CI and PostgreSQL tests remain release gates.

Research references:
https://opentelemetry.io/docs/specs/semconv/http/
https://sre.google/workbook/alerting-on-slos/
https://www.postgresql.org/docs/current/sql-select.html
