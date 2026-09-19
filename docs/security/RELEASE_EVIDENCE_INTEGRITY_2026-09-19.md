# Release evidence integrity hardening

## Scope

This engineering change hardens `scripts/generate-release-evidence.mjs` and its existing Engineering Intelligence and Security Evidence workflow. It does not deploy application code, apply database migrations, change customer data, or approve a production release.

Baseline: `f3831caa6fd67a724984fc0851dd2da6fcce1a29`.
Original verifier blob: `22c06b2680da596e95c1d39db7b3775c26e527a2`.

## Reproduced defect

The original `--check` branch accepted a JSON object containing only `overall: "pass"` and a 64-character hexadecimal `evidenceDigest`. It did not require checks, artifact records, workflow identity or evidence files. A fabricated receipt with a zero-filled digest returned exit code 0. A digest-shaped value was not proof that the files existed or matched it.

## Verification contract

The verifier now requires schema version 1, a full commit SHA, a canonical generated timestamp, workflow run and attempt identifiers, and the exact authored set of eight gates and eleven evidence files. All gates must have status `success`. Both failure summaries must be present and empty. Gate-to-file associations cannot be changed, omitted or duplicated.

Verification reads the actual files from `--source` (default: `artifacts`), rejects missing, empty, symbolic-link and non-regular files, compares each byte count and SHA-256, and recomputes the aggregate digest from actual evidence. Receipt-supplied paths never become filesystem read targets: the fixed authored path list controls reads.

The workflow supplies repository, commit, ref, event, run ID and run attempt independently to the checker from GitHub's execution context. A receipt from another run or commit therefore fails even when its file hashes are internally consistent. Local verification without these optional identity flags still checks file integrity and required metadata, but does not establish matching execution identity beyond the default repository.

Generation intentionally still returns a diagnostic receipt when a gate fails; the final `--check` enforces failure after artifact upload. Invalid or empty files are recorded as unavailable, rather than suppressing the diagnostic report. No action pins or dependency versions change.

## Tests

Run through the project's package manager and targeted test configuration:

```sh
pnpm exec mocha --config .mocharc.targeted.json tests/release-evidence-integrity.test.js --reporter spec
```

The dependency-free equivalent for a restricted checkout is:

```sh
node --test tests/release-evidence-integrity.test.js
```

Cases cover forged pass-only receipts, every missing/duplicate/unknown gate and artifact shape, forged digests, same-size file changes, missing files, directory and symlink substitution, zero-byte files, mismatched execution identity, failed/skipped/cancelled/unknown/timed-out gates, malformed JSON, successful round trips, and workflow enforcement bindings. Test evidence is synthetic and does not claim production security or database isolation was exercised.

## Trust boundary and rollout

This is integrity checking and execution-context matching, not a digital signature. A party controlling the producer and all receipt/files can rewrite consistent evidence. A trustworthy CI runner, protected workflow/branch settings and artifact provenance verification remain separate controls. Hashes do not prove the semantics of arbitrary log content, that CodeQL found no alerts, that database migrations ran, or that populated staging tenant isolation passed.

Node 24, locked pnpm dependencies, audit, typecheck, lint, the full test suite, build and required CI checks remain merge gates. Local focused results on another Node version are not substitutes for those gates. Keep the change unmerged until those checks pass. Preserve staging validation, owner approval and the existing controlled production deployment workflow for the outstanding tenant-boundary release; do not use this change as authorization for a manual database push or deployment.

References: Node's `node:crypto` SHA-256 API and GitHub's official artifact-attestation documentation distinguish file hashing from verifiable build provenance.
