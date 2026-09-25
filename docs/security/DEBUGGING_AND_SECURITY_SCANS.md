# Debugging And Security Scans

SONARA uses layered security checks. No one scanner is treated as permission to
ship, and security tooling may block a release but may never grant runtime
authority.

## Enforced repository checks

The normal release/security workflows already run:

- the locked dependency audit;
- CodeQL security-extended analysis;
- SONARA's client-secret boundary scan;
- tenant-isolation and RLS contract checks;
- source/licence and open-source registry validation.

The `Open Source Security Scans` workflow adds three independent developer-side
checks:

- **OSV Scanner 2.6.0** for maintained dependency/lockfile vulnerabilities;
- **Gitleaks 8.30.1** as a blocking current-source secret scan plus a sanitized
  full-history evidence scan;
- **Trivy 0.74.0** for HIGH/CRITICAL maintained-filesystem dependency
  vulnerabilities and infrastructure misconfigurations.

Each upstream binary is downloaded from its official GitHub release and checked
against the release SHA-256 before execution. The versions and checksums are
intentionally explicit rather than floating.

## Privacy and evidence boundary

These scanners are CI/developer tools. They are not customer-runtime
dependencies and receive no SONARA production credentials.

Gitleaks runs with full redaction. Current-source findings are release-blocking.
The full-history pass is retained as review evidence because existing historical
findings require credential/fingerprint review and possibly coordinated
rotation/history rewriting rather than a blind allowlist. Raw Gitleaks reports
remain temporary on the runner and are deleted before artifacts are uploaded;
retained evidence contains rule, file, line, commit/fingerprint metadata only
and never the matched secret.

OSV's release gate is scoped to maintained manifests: the root pnpm lockfile,
the backend requirements, and maintained developer-tool requirements. The
never-executed OpenVoice engine gets a separate advisory scan until its PyTorch
compatibility is validated. Archived dependency manifests do not block the
current release.

Trivy is restricted to the `vuln` and `misconfig` scanners, skips `archive/`,
and treats the unvalidated OpenVoice engine manifest as advisory rather than
runtime. Secret scanning is handled by Gitleaks and the existing SONARA secret
boundary, avoiding a second raw-secret report.

Blocking scanner steps are allowed to finish and write sanitized evidence before
their exit status is enforced. A scanner outage or execution error therefore
does not silently become green, and a maintained-source finding cannot be
waived merely because an artifact was produced.

## Still governed / not release authority

Semgrep and OWASP ZAP remain governed references until their execution,
licensing, network behavior, false-positive policy, and evidence-retention
boundaries are reviewed. Scanner coverage is additive; it does not replace
manual security review, provider-specific threat modeling, penetration testing,
or tenant-boundary proofs.
