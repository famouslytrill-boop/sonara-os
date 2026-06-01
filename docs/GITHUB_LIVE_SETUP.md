# GitHub Live Setup

GitHub connection must be verified through repository settings and CI results. Local config alone is not proof of connection.

## Checklist

- Default branch documented.
- Branch protection recommended.
- Pull request review recommended before merge.
- CI workflow exists.
- Security artifact scan workflow exists.
- Secret scanning enabled or documented as required.
- CODEOWNERS recommended.
- GitHub Update Watcher remains report-only.

## Safety

No workflow may auto-install external repos, auto-merge updates, or deploy production without owner approval.
