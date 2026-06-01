# GitHub Final Setup

Checklist:

- Set `GITHUB_REPOSITORY` to the canonical repository path.
- Document the default branch.
- Enable branch protection for the production branch.
- Require pull request review before main merges.
- Add or verify CI for install, typecheck, lint, tests, build, smoke, migration validation, and security artifact scan.
- Add secret scanning if available.
- Add Dependabot or dependency review.
- Add CODEOWNERS when ownership is stable.

Do not store GitHub tokens or deployment credentials in repo files.
