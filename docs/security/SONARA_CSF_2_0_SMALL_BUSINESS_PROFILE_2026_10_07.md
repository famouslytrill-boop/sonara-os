# SONARA Industries — NIST CSF 2.0 Small-Business Security Profile
**Date:** 2026-10-07  
**Purpose:** low-budget, evidence-driven cybersecurity roadmap for SONARA Industries and Business Builder™, Creator Studio™, Growth Studio™.  
**Status:** internal engineering/security profile. It does not certify NIST conformance, Ohio safe-harbor eligibility, legal compliance, or an audit result.

Ohio Revised Code §1354.02 expressly allows the scale/scope of a cybersecurity program to consider organization size/complexity, business activity, data sensitivity, cost/availability of tools, and resources. §1354.03 recognizes current versions of industry frameworks including NIST CSF, NIST 800-171/800-53, CIS Controls and ISO/IEC 27000. This profile therefore uses **NIST CSF 2.0** as the launch framework rather than purchasing an enterprise compliance platform.

NIST's SP 1300 is specifically a quick-start guide for small/medium organizations with modest or no existing cybersecurity plan. The six CSF 2.0 Functions are **Govern, Identify, Protect, Detect, Respond, Recover**.

## Evidence states — never use a fake security score
Every control has one status:
- **unassessed** — no reliable evidence.
- **gap** — evidence proves the desired outcome is not met.
- **partial** — some implementation/evidence, important gaps remain.
- **implemented_unverified** — source/config exists but operational proof is absent/stale.
- **verified_current** — current source/config + negative/positive test or operational evidence.
- **exception_approved** — written risk acceptance with owner, reason, expiry and compensating controls.

Never calculate a vague “93% secure” score. Dashboards may count outcomes by state, but must retain the underlying evidence and age.

## GOVERN
| Outcome | Launch implementation | Evidence / gate | Target |
|---|---|---|---|
| Business/security context | SaaS-only fee model; customer funds external; four brands/roles documented | `sonara-customer-money-pathways.cjs`, legal/architecture docs | verified_current |
| Roles & authority | Founder/owner approval for refunds, policy publishing, destructive/security actions; customer roles scoped | agent authority tests + route guards | verified_current |
| Risk management | versioned risk register: security, privacy, payments, housing, content, tax, availability | review-case/legal-rule proposed schema | partial |
| Policies | written access, data classification, backup, incident, retention, AI/content, secure development policies | repository docs + signed owner approval/version | partial |
| Supplier risk | Stripe, Supabase, Vercel, email, optional AI providers tracked with purpose/data/keys/exit plan | provider registry + key verification | partial |
| Legal/regulatory context | rule version records + source dates + human reviewer; no AI self-approval | `legal_rule_versions` proposal | implemented_unverified |
| Risk exceptions | exception requires owner, reason, scope, compensating control, expiry | future risk-exception table/workflow | gap |

### Govern cadence
Monthly during launch, then quarterly once stable:
`review changed assets -> threats -> legal/provider changes -> evidence expiry -> exceptions -> priorities -> owner sign-off`.

## IDENTIFY
| Outcome | Deterministic inventory | Current direction |
|---|---|---|
| Assets | repos, routes, DB tables, storage buckets, providers, queues, device shells | existing capability/provider inventories + storage proposal |
| Data | public, tenant standard, tenant confidential, restricted legal, restricted sensitive media | `sonara-file-storage-policy.cjs` |
| Money | SONARA own subscription vs customer external funds | canonical money-path registry |
| AI | model/provider/version, source refs, rights/consent, generated asset hash | governed draft packets + media provenance |
| Devices | device ID, user/org, OS key alias, revocation state, last seen | proposed `offline_devices` |
| Dependencies | lockfiles, OSV/Trivy/current-source scanning | CI evidence |
| Critical services | auth, DB, own billing, object storage, email, DNS/deployment | readiness/health checks |

### Data inventory record
`{data_class, system, owner, tenant_key, purpose, source, retention_rule, encryption_profile, backup_profile, deletion_rule, external_processors}`.

Unknown tenant ownership or retention rule = **gap**, never “default global access” or indefinite retention by convenience.

## PROTECT
### Identity/access
- unique user accounts, MFA/passkeys as supported;
- server-resolved tenant membership;
- least privilege; service-role credentials server-only;
- no authorization based on user-editable metadata;
- step-up for payee/security changes;
- authenticated stream for restricted files;
- revoke lost devices/sessions.

### Data
- private object buckets for customer files;
- generated storage key, original filename only metadata;
- allowlisted type + detected MIME/signature + malware/quarantine + size/container limits;
- TLS transport; provider encryption at rest;
- native local vault under Android Keystore / Apple Keychain-wrapped keys;
- no sensitive persistent web cache by default;
- legal holds prevent purge;
- backup/object restore integrity check = SHA-256 + byte length.

### Application
- exact cents/basis points;
- no arbitrary spreadsheet `eval()`;
- stronger human CSV formula-injection profile;
- bounded AI packets, no secret/private context dumping;
- CSRF/origin/input/rate limits;
- CSP and dependency/security scans;
- customer money routes fail closed.

## DETECT
High-signal detections rather than “log everything”:
1. authentication anomalies and failed step-up;
2. cross-tenant access denials;
3. unexpected service-role queries without explicit organization scope;
4. current-source secret findings;
5. provider webhook signature failures/replay/duplicate IDs;
6. file quarantine/malware/active-content blocks;
7. unexpected new money flow or Stripe Connected-Account header in SONARA Billing;
8. audit-chain/hash mismatches;
9. unusually high export/import/delete/download activity;
10. AI/model output trying to cite a source outside the approved packet;
11. urgent content/legal cases near internal/statutory deadline;
12. backup/restore integrity failures.

Every detection requires:
`{event_type, occurred_at, org_if_applicable, correlation_id, severity_basis, safe_metadata, evidence_ref, disposition}`.
Do not log secrets, raw sensitive file bodies, passwords, tokens, card/bank data or intimate media.

## RESPOND
### Incident state machine
`reported -> triaged -> contained -> scope_known -> remediation -> notification_decision -> restored -> lessons_learned -> closed`.

Separate tracks:
- cybersecurity/data breach;
- fraudulent payment destination;
- content/copyright/TAKE IT DOWN;
- compromised account/device;
- provider outage;
- corrupted/deleted data;
- subscription/billing dispute.

For potential Ohio breach notification, capture discovery time immediately. Ohio §1349.19 generally requires notice, when its statutory conditions are met, in the most expedient time possible and no later than 45 days after discovery/notification, subject to law-enforcement and scope/integrity needs. The application calculates a **candidate legal-review deadline**, not an automatic legal conclusion.

For qualifying valid TAKE IT DOWN notices on a covered platform, the content workflow separately tracks the 48-hour statutory removal window.

## RECOVER
### Required proof
- DB backup exists **and was restored**;
- object-storage backup/snapshot/export exists **and sampled objects restored**;
- restored object matches expected SHA-256 + byte length;
- auth/config secrets can be rotated;
- deployment rollback restores known commit;
- migrations have rollback/forward-repair plan;
- customer impact and data loss window are measured.

### Deterministic recovery metrics
- **RPO observed:** timestamp newest durable restored record minus incident cutoff.
- **RTO observed:** restored verified service timestamp minus declared recovery start.
- **restore success rate:** verified restored samples / requested restore samples.
- **backup age:** now − newest verified backup.
- **orphan object rate:** storage objects lacking metadata / sampled storage objects.
- **metadata orphan rate:** live file metadata lacking object / sampled metadata rows.

Do not advertise RPO/RTO/SLA until repeated drills prove them under realistic conditions.

## Low-budget 90-day roadmap
### Days 1–30
- approve this profile and data classification;
- inventory critical accounts/providers/buckets/keys;
- enforce MFA/least privilege;
- ensure customer money fee-only boundary;
- finish current-source secret + dependency scans;
- private storage and upload limits;
- written incident contacts;
- test one DB + one object restore;
- fix exact-head CI before production rollout.

### Days 31–60
- implement file quarantine/scan route;
- retention/legal-hold workflow;
- device/session revocation;
- storage/import/export audit events;
- tenant query/service-role audit;
- bounded AI provenance + abuse reporting;
- quarterly access review template;
- simulated compromised account/data deletion/table restore exercise.

### Days 61–90
- produce Current vs Target CSF Profile;
- close or formally accept remaining high risks;
- perform full restore drill and incident tabletop;
- measure p95 app/job performance and storage costs;
- test native encrypted cache canary only if mobile shell is ready;
- establish security evidence retention;
- review framework/source changes.

## Spreadsheet-ready CSF tracking columns
Use one row per outcome/control:
`function, outcome_id, control, system, owner, data_class, current_state, target_state, evidence_ref, evidence_checked_at, gap, remediation, due_date, cost_estimate_cents, exception_ref, next_review`.

Deterministic spreadsheet rules:
- `is_overdue = today > due_date AND current_state != verified_current`
- `evidence_stale = today > evidence_checked_at + approved_evidence_freshness_days`
- `open_gap_count = COUNT(current_state IN {gap,partial,implemented_unverified})`
- `high_risk_exception_expired = today > exception_expiry`
- no weighted “security score” unless weights and limitations are explicitly governed.

## Primary authoritative references
- NIST SP 1300, CSF 2.0 Small Business Quick-Start Guide: https://csrc.nist.gov/pubs/sp/1300/final
- NIST CSF 2.0 Resource Center: https://www.nist.gov/cyberframework
- Ohio ORC §1354.02: https://codes.ohio.gov/ohio-revised-code/section-1354.02
- Ohio ORC §1354.03: https://codes.ohio.gov/ohio-revised-code/section-1354.03
- Ohio ORC §1349.19: https://codes.ohio.gov/ohio-revised-code/section-1349.19
- OWASP File Upload: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection
- Android Keystore: https://developer.android.com/privacy-and-security/keystore
- Apple Keychain: https://developer.apple.com/documentation/security/keychain-items

**This profile reduces risk only if SONARA actually implements and operates the controls. A repository document by itself does not establish reasonable conformance, safe-harbor eligibility or legal compliance.**
