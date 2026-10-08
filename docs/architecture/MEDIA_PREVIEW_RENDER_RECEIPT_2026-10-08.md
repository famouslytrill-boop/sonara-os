# Media preview proof hardening — 2026-10-08

**Scope:** isolated Creator Studio media receipt verification; **not** a render-worker activation, deployment, migration, asset upload, customer-content use or production-ready media pipeline.

## Pre-existing design, preserved

SONARA already has `lib/sonara-media-processing-contract.cjs`, the Platform Kernel's execution envelope, `lib/sonara-deterministic-media.cjs`, and a separately hosted media-worker HTTP contract. This change does **not** introduce another worker, queue or model provider. It strengthens the preview receipt layer.

## Engineering changes

1. Storage object keys in `createMediaProcessingPlan` must be canonical, explicitly prefixed by the request tenant, contain at least one directory plus a basename, and reject traversal segments, percent encoding, URL/query delimiters, backslashes and control characters. This is a plan-level guard only. Storage RLS, signed URLs and worker credentials must enforce the same tenant independently.
2. `verifyMediaPreviewOutput` checks a **Buffer already obtained by the caller**, verifies format-to-operation compatibility, extension and basic file signature, enforces a bounded byte budget, computes SHA-256 directly from bytes, compares any supplied expected digest and length, and emits an immutable, reproducible receipt tied to tenant, actor, idempotency and asset IDs.
3. `buildMediaPreviewProofEvent` creates an event named `media.preview.output_checked`, not `completed` or `published`. It excludes raw media and storage keys.
4. Every receipt truthfully declares `fullDecodeVerified: false`, `malwareScanVerified: false`, `rightsVerified: false` and `workerExecutionAttested: false`. Header sniffing is NOT sufficient validation of real media, successful rendering, consent, legal rights or correctness.
5. The regression suite uses SONARA's existing deterministic WAV generator, corrupts the header, invents invalid MIME/output paths, crosses tenants, tampers approval/isolation and verifies checksum failure behavior. No new dependency, API route, database or provider key.

## Trusted production promotion gates

- Implement and prove a sandboxed media decoder/transcoder with CPU/GPU quota, limits on duration and decompressed pixels, deadline, process kill, no arbitrary shell/arguments and network egress deny.
- Validate uploads by content and scan/quarantine; enforce file size/type controls per OWASP (https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
- Record authorized input asset rights, consent for voices and faces, source storage tenancy and signed upload/download paths.
- Persist job states and uniqueness atomically by tenant+idempotency; make retries replay existing receipts rather than creating duplicate renders or charges.
- Reconcile output bytes/hash against durable storage, scan with a decoder and security tools, prove cancellation, failure rollback and cleanup; then apply human approval for any publication.
- Pass full exact-head GitHub CI, database tenant-isolation checks, accessibility and deployment authorization before any prod connection.

## Technical sources

- FFmpeg global progress reporting and background stdin behavior: https://ffmpeg.org/ffmpeg.html
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- GitHub required status checks against latest head: https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks

## Rollback

Revert this isolated branch/PR if consumers need legacy unscoped media object keys; **do not** relax tenant protections without a secure storage migration and tenant authorization proof.
