# SONARA Industries — Secure Files, Spreadsheets, Money Pathways and Local Storage Roadmap
**Date:** 2026-10-07  
**Status:** engineering blueprint + partial pure-function implementation in draft PR #442. No production migration, customer file movement, offline sync, payment processing or legal certification is created by this document.

## 1. Launch invariant: one company revenue path
SONARA collects its own disclosed software fees. Every other money flow belongs to the customer's business or an external provider.

| Flow | Payer | Merchant/payee | Where funds land | SONARA role |
| --- | --- | --- | --- | --- |
| SONARA software subscription | SONARA customer | SONARA Industries | SONARA company bank via SONARA processor | software seller |
| Restaurant/retail/service sale | buyer | customer business | merchant-owned provider/bank | records/catalog/invoice software |
| Contractor invoice | customer | contractor | contractor-owned provider/bank | invoice/workflow software |
| Rent | tenant | landlord | landlord-controlled lawful method | private records/calculator |
| Security deposit | tenant | landlord | lawful landlord-controlled deposit location | liability calculator/record |
| Creator sale | buyer | creator | creator-owned provider/bank | catalog/rights/records |
| Ad spend | customer business | ad platform | external ad platform | budget/analytics software |
| Supplier purchase | customer business | supplier | external supplier | PO/inventory record |

No wallet, escrow, pooled customer balance, SONARA rent collection, customer-to-customer transfer, customer payout, cash advance or platform split payout is part of the launch architecture.

Implemented draft registry: `lib/sonara-customer-money-pathways.cjs`. It never executes a payment and self-checks that only the SONARA subscription path lands in a SONARA account.

## 2. Data classification before storage
Every file/record receives one of five classes before storage:

1. **public_marketing** — intentionally public brand/marketing media.
2. **tenant_standard** — ordinary project/customer/business files.
3. **tenant_confidential** — contracts, invoices, non-public customer files.
4. **restricted_legal** — abuse evidence, signed agreements, legal complaints, sensitive investigation records.
5. **restricted_sensitive_media** — private likeness/voice/source media, especially media involved in abuse or rights incidents.

Classification drives upload limit, bucket, download mechanism, local caching permission, retention and reviewer access. A user-selected label is not enough: trusted server routing derives the final class.

## 3. Secure upload pipeline
`authenticated request -> tenant/role check -> request body limit -> generated object identity -> extension allowlist -> server MIME/signature detection -> hash -> ZIP/container limits -> active-content rejection -> malware/security scan -> quarantine -> private storage -> metadata transaction -> review/release`.

Security rules:
- Never use the customer filename as the object path.
- Store a generated UUID/object key; original filename is display metadata only.
- Block macro-enabled/legacy spreadsheets at launch (`.xlsm`, `.xlsb`, `.xlam`, `.xls`).
- Accept `.xlsx` only after ZIP/container-bomb limits, detected MIME/signature and clean scan.
- Do not trust HTTP Content-Type as proof.
- Do not execute uploaded files or permit uploaded HTML/script formats.
- Restrict size **before parsing** at the gateway and again after decompression/container inspection.
- Hash with SHA-256 for integrity/evidence linkage; hash does not prove authorship or legal validity.
- Keep sensitive bytes out of request/error logs and model prompts.
- Use quarantine state; a successfully uploaded file is not automatically a safe file.
- File version changes append version/audit metadata; do not silently overwrite evidence.
- Legal hold blocks purge.

OWASP's file-upload guidance recommends allowlisted extensions, server-side type/signature checks, generated names, limits, storage outside the webroot/separate storage, authorization, scanning and CSRF defenses. This architecture follows that defense-in-depth model.

Draft implementation: `lib/sonara-file-storage-policy.cjs`.

## 4. Cloud object storage
Customer objects should live in **private buckets** unless intentionally public. Supabase documents that private bucket access is subject to RLS and can be delivered with authenticated download or time-limited signed URLs. Public buckets bypass read access controls and are inappropriate for customer contracts/source files.

Access pattern:
- **public_marketing** -> intentionally public bucket/CDN after explicit publication workflow.
- **tenant_standard / tenant_confidential** -> private bucket; short-lived signed URL or authenticated download after org membership check.
- **restricted_legal / restricted_sensitive_media** -> authenticated request/stream with fresh authorization on every request; avoid reusable signed URLs by default.

Reason: current Supabase Storage documentation notes signed URLs remain valid until expiry and that cached signed responses can complicate revocation. Critical evidence therefore uses a fresh authorization decision, and emergency revocation must include object/access action rather than assuming an expired login revokes already-issued URLs.

Database dumps and object backups are separate. `pg_dump` is not a file backup strategy.

## 5. Local/native filing and offline storage
### Web/PWA
- **No persistent restricted legal or sensitive-media cache by default.**
- Ordinary web local storage/IndexedDB is not treated as a secure secret vault.
- Never put service keys, Stripe secret keys, database passwords or raw file-encryption keys in browser persistence.
- Standard business offline caching requires separate browser threat review, explicit retention, cache purge on logout and a device/storage quota.

### Android native shell
Use app-private storage plus a randomly generated data-encryption key whose key/wrapping key is protected by **Android Keystore**. Android documents that Keystore key material can be non-exportable and can be bound to secure hardware/user authentication. Do not hardcode cryptographic secrets. Sensitive external-storage files require application encryption and integrity validation.

### Apple native shell
Use app sandboxed storage and **Keychain** for small secrets/cryptographic keys. Apple documents Keychain as an encrypted database for confidential items/keys and recommends not storing secure content as plaintext files.

### Desktop-native future shell
Require OS keychain/credential vault + encrypted local database/file vault; no application-wide static encryption password checked into source.

**Envelope pattern:** device/OS secure key -> wraps local vault DEK -> DEK encrypts database/files -> ciphertext carries nonce/tag/version -> metadata does not contain raw DEK. Rotate by rewrapping where possible rather than decrypting the whole data set.

Draft decision code: `localCachePlan` in `lib/sonara-file-storage-policy.cjs`.

## 6. Offline mutation algorithm
No offline action may change:
- payment confirmation;
- refunds/payout destinations;
- bank details;
- subscription state;
- signatures/legal notices;
- tenant rejection;
- security-deposit settlement;
- permission/security settings;
- destructive deletion;
- public publishing.

Allowed examples are append note, draft task, non-financial task update, inventory observation, content draft, customer-record draft and local file reference.

Each offline mutation carries:
`{mutation_id, organization_id, device_id, entity_id, operation, base_version, payload_hash}`.

Reconciliation:
1. verify device/session/org and payload integrity;
2. if mutation ID already applied -> idempotent no-op;
3. if `base_version == server_version` -> apply candidate in atomic server transaction;
4. if server advanced and operation is append-only -> append candidate, never overwrite;
5. otherwise -> explicit conflict queue;
6. **no last-write-wins for legal/financial/security data**.

Draft implementation: `lib/sonara-offline-sync-policy.cjs`.

## 7. Spreadsheet architecture
Existing repository capabilities already parse CSV/TSV spreadsheet paste and produce accounting CSV. This branch hardens rather than replaces them.

### Imports
- CSV/TSV pasted text: explicit headers, no fuzzy field guessing, all rejected rows retain line numbers.
- XLSX future upload: quarantine -> ZIP-size limits -> macro/active-content rejection -> worksheet/row/column limits -> typed schema mapping -> preview -> owner approval -> atomic import.
- No `xlsm/xlsb/xlam/xls` at launch.
- Never import hidden executable formulas/macros as business logic.
- Unknown columns remain unknown; do not map a phone number into an email field.
- Empty value remains missing/null, never the literal string `"null"`.
- Import limits are explicit; over-limit input is refused/truncated **with a visible state**, never silently shortened.

### Calculations
SONARA calculations run server-side using named deterministic operations:
- cents: integer minor units;
- percentages/rates: integer basis points;
- dates: normalized ISO date;
- explicit rounding per formula;
- overflow -> refuse;
- missing input -> null/unknown, not invented zero;
- no `eval()`, external URL formulas, macros or arbitrary workbook code.

Current named operations:
`sum_cents`, `subtract_cents`, `quantity_x_unit_cents`, `basis_points_of_cents`, `days_between`, `copy`.

Draft implementation: `lib/sonara-spreadsheet-formulas.cjs`.

### Exports
Two CSV profiles:
- **portable_text** — compatibility mode, apostrophe guard; useful for programmatic downstream import, but weaker after Excel resave/reopen.
- **spreadsheet_human** — current accounting-download default: dangerous formula-like strings use a tab prefix *inside a quoted field*; exact numeric negatives stay numeric.

Formula-like starts include `= + - @ tab CR LF` and full-width variants `＝ ＋ － ＠`. Every altered cell is counted. OWASP warns there is no single universal CSV sanitization strategy, so exported business data should remain a **data file**, never a trusted executable workbook.

For future XLSX export, write values only by default. If formulas are ever added, formulas must be generated solely from a server allowlist; no customer string can become formula code.

## 8. Proposed database/file model
Review-only SQL:
`docs/architecture/SONARA_FILE_SPREADSHEET_OFFLINE_SCHEMA_PROPOSAL_2026_10_07.sql`

11 conceptual tables:
- `file_objects`
- `file_versions`
- `file_access_events`
- `offline_devices`
- `offline_mutations`
- `workbooks`
- `workbook_sheets`
- `workbook_rows`
- `spreadsheet_import_jobs`
- `spreadsheet_export_jobs`
- `retention_actions`

Metadata is private, RLS enabled as defense-in-depth, and anon/authenticated generic grants are revoked in the proposal. No end-user policy is invented until canonical SONARA organization membership tables are verified.

## 9. AI-generated content + files
Generation pipeline:
`source -> consent/rights evidence -> bounded model packet -> generate -> raw output private -> hash/model version -> safety/rights review -> provenance record -> transformed derivatives -> approved publication -> complaint/removal history`.

Store separately:
- original source object;
- generated output;
- derivative/transcode;
- prompt/source **references** (not secrets/private context dumped into logs);
- model/provider/version;
- rights/consent evidence;
- SHA-256;
- C2PA manifest/validation if genuine signing is implemented;
- human reviewer;
- publication/removal state.

AI never self-certifies copyright, legal consent, statutory compliance or authenticity. U.S. Copyright Office guidance states human-authored expressive elements remain central to copyrightability of generative-AI outputs; prompting alone is not automatically sufficient.

For covered-platform TAKE IT DOWN Act cases, maintain a human review queue using the valid-request receipt time and known-identical-copy workflow. The FTC began enforcing Section 3 on May 19, 2026 and states valid requests require removal within 48 hours.

## 10. Legal records and electronic signatures
Ohio's UETA provides that electronic records/signatures cannot be denied legal effect solely because they are electronic, but that does **not** make every click enforceable or every template legally sufficient.

For a future signing service, store:
- exact final document hash;
- immutable version identifier;
- signer identity/evidence;
- intent/affirmative action;
- timestamp;
- authentication/security procedure used;
- applicable disclosure/consent evidence;
- signature provider envelope ID;
- signed binary/document object;
- correction/revocation/amendment history.

Do not regenerate a signed document from mutable database fields and call it the original. Ohio's record-retention provision requires retained electronic information to accurately/completely reflect the final information and remain accessible for later reference where retention requirements apply.

## 11. Low-budget cybersecurity program
Ohio's cybersecurity safe-harbor statute is especially useful as a planning framework: it calls for written administrative, technical and physical safeguards, and expressly says appropriate scope can consider the company's size/complexity, activity, data sensitivity, cost/availability of tools and resources. It recognizes conformance to industry frameworks such as NIST/CIS/ISO.

Practical startup target:
- adopt **NIST CSF 2.0 Small Business Quick-Start Guide** as the written framework baseline;
- create a lightweight SONARA Current Profile / Target Profile spreadsheet;
- assign one owner to every gap;
- link repository evidence/tests/runbooks to each CSF outcome;
- review quarterly and after material incidents/releases;
- preserve evidence that the controls are actually operated, not merely documented.

Six CSF 2.0 functions: **Govern, Identify, Protect, Detect, Respond, Recover**.

Do not market this as "immune from lawsuits." Ohio describes an affirmative defense under specified conditions; eligibility depends on actual conformity and facts.

## 12. Security/breach operations
Ohio breach law can require notification to affected Ohio residents when the statutory conditions are met, generally no later than 45 days following discovery/notification, subject to statutory exceptions/needs. SONARA needs:
`detect -> contain -> preserve evidence -> determine affected data/people -> restore integrity -> legal determination -> notice decision -> customer communication -> lessons learned`.

The incident system should track:
- discovery time;
- containment time;
- affected tenant/data classes;
- evidence refs;
- law/rule version;
- investigator;
- decision;
- notice deadline;
- notification proof;
- restore proof.

## 13. Scale roadmap
### Phase A — bootstrap / 0–50 paid customers
Existing Node/Vercel + Supabase + private Storage + Stripe for SONARA subscriptions only. Manual trust/safety/legal queue, CSV/TSV import/export, no persistent restricted PWA cache, no public marketplace money processing. Weekly backups; monthly restore drill until proven automated.

### Phase B — 50–500
Durable review/outbox queue, object lifecycle policies, local/native encrypted cache pilot, XLSX values-only import/export, malware/container scanning, per-tenant storage/AI budgets, p95 queue/storage dashboards, device revocation and offline sync canary.

### Phase C — 500–5,000
Separated media workers, connection pooling, object version lifecycle, tenant quotas, signed audit checkpoints, automated but human-governed policy-source refresh, dedicated incident operator rotation, restore SLO, cost-per-tenant reporting.

### Phase D — 5,000+
Only after demonstrated revenue/SLO/security maturity: regional isolation, read replicas/DR, specialized object tiers, managed device policies, enterprise retention controls. Any merchant payment orchestration or public rental brokerage remains a **separate funded/licensed product decision**, not an automatic scale step.

## 14. Deterministic capacity formulas
- Storage logical bytes = `tenants × assets_per_tenant_per_day × avg_asset_bytes × retention_days`.
- Storage physical planning = logical × redundancy + derivative/transcode + backup + DB metadata overhead.
- File processing workers = `ceil(peak_jobs_per_hour / measured_worker_capacity_per_hour)`.
- Worker capacity ≈ `floor(3,600,000 × concurrency × target_utilization / p95_processing_ms)`.
- Offline conflict rate = `conflicted_mutations / received_mutations`; money/legal conflict rate target = **not applicable** because those mutations are not queueable offline.
- Spreadsheet rejection rate = `rejected_rows / total_nonblank_rows`; a rising rate is a schema/usability issue, not evidence that users are "bad at spreadsheets."
- Restore coverage = `restored_and_verified_objects / sampled_backup_objects`.
- Private download authorization failure rate = `denied_private_downloads / private_download_requests`.
- AI publication review escape rate = `post-publication policy defects / published_generated_assets`; measure, don't claim zero.

## 15. Release gates
Do not merge this branch solely because these designs exist. Required:
1. exact-head Node 24/26 green;
2. full test suite green;
3. maintained-source secret/scanner gates green;
4. generated handoff/coverage inventory synchronized;
5. migration replay green;
6. storage/file negative tests;
7. tenant-scoped service-role query audit;
8. no real SQL proposal accidentally included in migration glob;
9. staging file upload/download/delete/restore test;
10. owner approval for production rollout.

## 16. Research sources
- NIST CSF 2.0 Small Business QSG: https://www.nist.gov/publications/nist-cybersecurity-framework-20-small-business-quick-start-guide
- Ohio cyber safe harbor: https://codes.ohio.gov/ohio-revised-code/section-1354.02
- Ohio recognized frameworks: https://codes.ohio.gov/ohio-revised-code/section-1354.03
- Ohio breach notice: https://codes.ohio.gov/ohio-revised-code/section-1349.19
- Ohio UETA: https://codes.ohio.gov/ohio-revised-code/chapter-1306
- Supabase private Storage: https://supabase.com/docs/guides/storage/buckets/fundamentals
- OWASP File Upload: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection
- Android Keystore: https://developer.android.com/privacy-and-security/keystore
- Apple Keychain: https://developer.apple.com/documentation/security/keychain-items
- NIST AI RMF/GAI Profile: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- U.S. Copyright Office AI: https://copyright.gov/ai/
- FTC TAKE IT DOWN: https://www.ftc.gov/business-guidance/resources/complying-take-it-down-act

**Nothing in this blueprint certifies compliance or authorizes a regulated activity.**
