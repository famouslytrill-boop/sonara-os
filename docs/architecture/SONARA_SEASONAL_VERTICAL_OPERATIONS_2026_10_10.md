# SONARA vertical operations and seasonal capacity — October 10, 2026

Status: **implementation in draft / planning-only / no deployment**.

## Scope and source-grounded repository position

This narrow expansion reuses the existing SONARA business platform. It does not create an independent company, separate subscription, unauthenticated customer data endpoint, or alternative authorization system. Existing repository foundations already include booking, invoicing, inventory, route-ordering, customer workflows, worker/planner calculations and motion settings. Pull request #600 separately develops consented device motion capture; pull request #601 separately develops opt-in governed learning; pull request #604 separately stages read-only provider readiness. None of those draft PRs should be treated as deployed.

New code: lib/sonara-seasonal-vertical-playbooks.cjs
New tests: tests/seasonal-vertical-workflow-planner.test.js

## Planning catalog, NOT live product promises

16 non-executing vertical playbooks cover bars; food trucks; parcel delivery; food delivery; independent contractors; pet services; art sellers; construction; towing; janitorial/cleaning; tutoring; winter services; spring services; summer services; fall services; and year-round businesses. They reuse a controlled operations vocabulary (CRM, scheduling, estimates, work orders, inventory, proof, delivery, invoices) and list business-specific human-review gates. Workflow strings are inert. Do not advertise an integration or business operating feature as available to customers because it appears in this catalog.

Bar sales, age/licensing verification, food safety, worker classification, financial actions, public media rights and unsupervised dispatch require separately reviewed implementations and human authorization where appropriate. No implied legal advice, geolocation/background device access, autonomous vehicle control or live food temperature monitoring.

## Deterministic math and processing

1. Planning scenario seasonal demand: ceil(baselineJobs * seasonFactorBasisPoints / 10000). Season multiplier is neutral unless explicitly supplied by the user; there is no weather feed or learned estimate. Time calculations use exact nonnegative safe integer bounds.
2. Effective crew minutes: floor(workers * minutesPerWorker * (10000 - reserveBasisPoints) / 10000). The feasible job count is floor(effectiveCrewMinutes / minutesPerJob). An unserved job count is the positive shortfall against scenario demand. This is a capacity *scenario*, not a staffing guarantee.
3. Estimate-only unit economics: sum(quantity * unitPriceCents) plus declared delivery fee, minus sum(quantity * unitCostCents) and declared delivery fulfillment costs. BigInt protects integer arithmetic; outputs refuse values outside JavaScript's safe-integer range. Taxes, overhead, tips and legal classification are excluded. The result does not issue an invoice, sell regulated goods or initiate a payment.
4. Event consolidation: exact duplicate event IDs may collapse only if organization, record, status and revision agree. Conflicts and cross-tenant mixed batches fail closed. A maximum of 500 rows bounds processing. Only the five required event-envelope fields are accepted. Any customer name, address, location, message, financial token or other unrecognized property is **rejected**, not silently processed. Only per-status counts survive reduction; event IDs are omitted from the output.
5. Data compression: counts-only receipts created by this module can be losslessly gzip-compressed and returned as base64 with byte-length evidence. The input uses an in-process branded summary so unreviewed objects cannot be passed to compression. gzip is **not encryption**, and the compressed receipt is not persisted or transmitted by this code. The receipt also carries a SHA-256 digest of its uncompressed counts-only JSON for accidental-corruption detection. This digest is **not a signature or authentication** and cannot prove who sent it. Small receipts may compress poorly or grow in encoded size; measure before selecting a transport.

Example capacity scenario: 100 baseline jobs * 150% declared seasonal factor = 150 scenario jobs; two workers, eight hours each, 10% reserve and 45 minutes per job = 864 usable minutes, 19 feasible jobs and 131 unserved. This is arithmetic on supplied assumptions, not a claim about a real business or customer forecast.

## October 2026 regulatory research update

The FDA's **2026** Food Code is the current model release; the 2022 edition is historical. The 2026 changes explicitly introduce a *mobile food establishment* definition and written illness policy provisions. SONARA must store the user's jurisdiction and verified regulatory version before suggesting that any food-truck checklist is compliant. There is no automatic certification, food-temperature verification, age-gated transaction or establishment permit check in this module. Local adoption may lag the FDA model. For contractor use, the IRS common-law evidence categories (behavioral control, financial control, and relationship) require actual review; a selected "independent contractor" playbook must never classify a person automatically.

## Device accelerometers and gyroscopes

Do not duplicate draft PR #600. Merge its work only after security and integration review, tests and separate production authorization. Browser device motion/orientation access must be triggered by a user gesture where permission is required, use HTTPS and Permissions-Policy, sample only in visible foreground, offer an accessible no-sensor fallback, stop promptly on page hide/cancel, and never infer crash/fall/driver behavior from noisy raw motion alone.

Research:
- W3C Generic Sensor API (14 May 2026): https://www.w3.org/TR/generic-sensor/
- MDN DeviceMotionEvent permission: https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static
- MDN DeviceOrientationEvent permission: https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static

## Research / self-improvement governance

An authorized research reader could later propose improvements based on strictly consented, tenant-scoped aggregate evidence. Future improvements should enter a versioned proposal record with provenance, baseline metric, bounded counterfactual, test plan, failure and rollback criteria, reviewed reviewer identity, and approval. The implementation must never interpret an LLM suggestion, a workflow string, or a research score as authority to edit code, alter customer records, publish content or modify billing. PR #601 addresses a separate review-only learning approach; this PR does not wire it.

## Reliability, networking and release

New operations must reuse authenticated organization context on the server and tenant RLS. The in-memory organizationId in this offline helper is an input-integrity guard, **not authentication or RLS evidence**. A future route must derive the organization from the authenticated session and recheck access before each read/write.

Before runtime rollout:
- main branch protection + exact-head mandatory CI checks, Node 22/24 compatibility, lint, Mocha, typecheck, build, security audit, no leaked secrets;
- reconcile production Supabase project identity, migration history and two-tenant positive/negative RLS evidence;
- add server adapter only after explicit permission, bounded payload, rate limit, idempotency, retries with bounded backoff, dead-letter evidence and redaction;
- document provider billing, costs, cancellation, service capacity and trace/error-budget measurements; validate with representative load and fault injection;
- separate money-moving, contractor payments, taxes, age-gated bar transactions, food safety data, vehicle dispatch and public rights/publishing adapters from general planning;
- check generated capability/handoff artifacts and keep inventory and market-facing copy truthful;
- keep production off until owner-reviewed deployment, live SHA proof and rollback readiness.

This PR introduces **no routes, database migrations, permissions, feature flags, providers, scheduled workers, hosted deployment, website navigation, mobile permissions, customer actions or background task**.

## Reference standards

- IRS employee vs independent contractor relationship (behavioral and financial control; relationship facts must be assessed, not inferred from a label): https://www.irs.gov/businesses/small-businesses-self-employed/independent-contractor-self-employed-or-employee
- FDA Food Code **2026** (released September 17, 2026; model code, not automatic local law): https://www.fda.gov/food/fda-food-code/food-code-2026
- FDA 2026 changes (including a new mobile-food-establishment definition and written employee-illness policies): https://www.fda.gov/food/fda-food-code/summary-changes-2026-fda-food-code
- OWASP API resource consumption: https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/
- NIST microservices security/resilience: https://csrc.nist.gov/pubs/sp/800/204/final
- Node zlib gzip: https://nodejs.org/api/zlib.html
