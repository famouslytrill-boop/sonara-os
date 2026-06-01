# Debugging And Security Scans

SONARA uses pnpm audit and local checks today. Trivy, Semgrep, OSV Scanner, Gitleaks, and OWASP ZAP are governed references until installed in CI with owner approval. These tools must not upload private source or secrets to external services without review.
