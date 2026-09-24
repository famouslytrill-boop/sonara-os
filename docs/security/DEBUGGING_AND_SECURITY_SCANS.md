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

- **OSV Scanner 2.6.0** for dependency/lockfile vulnerabilities;
- **Gitleaks 8.30.1** for secrets across Git history;
- **Trivy 0.74.0** for HIGH/CRITICAL filesystem dependency vulnerabilities and
  infrastructure misconfigurations.

Each upstream binary is downloaded from its official GitHub release and checked
against the release SHA-256 before execution. The versions and checksums are
intentionally explicit rather than floating.

## Privacy and evidence boundary

These scanners are CI/developer tools. They are not customer-runtime
dependencies and receive no SONARA production credentials.

Gitleaks runs with full redaction. Its raw finding report remains temporary on
the GitHub runner and is deleted before artifacts are uploaded; the retained
evidence contains only finding counts grouped by rule. This prevents a detected
credential from being copied into long-lived CI evidence.

Trivy is restricted here to the `vuln` and `misconfig` scanners. Secret scanning
is handled by Gitleaks and the existing SONARA secret boundary, avoiding a
second raw-secret report. OSV output contains dependency/advisory evidence, not
application secrets.

The scanner steps are allowed to finish and write evidence before the workflow
enforces their exit status. A scanner outage or execution error therefore does
not silently become green, and a real finding cannot be waived merely because
an artifact was produced.

## Still governed / not release authority

Semgrep and OWASP ZAP remain governed references until their execution,
licensing, network behavior, false-positive policy, and evidence-retention
boundaries are reviewed. Scanner coverage is additive; it does not replace
manual security review, provider-specific threat modeling, penetration testing,
or tenant-boundary proofs.
