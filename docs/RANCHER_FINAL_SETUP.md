# Rancher Final Setup

Rancher/Kubernetes is optional for MVP. Missing Rancher config is `skipped_for_mvp`.

If Rancher is used later:

- Document cluster ID and project ID outside public docs.
- Define namespace strategy.
- Manage secrets outside the repo.
- Configure ingress and TLS for `sonaraindustries.com`.
- Define resource requests/limits.
- Define rollback steps.
- Define monitoring and alerting.
- Require owner approval before production rollout.

Do not make Rancher a launch blocker unless the owner chooses Rancher as the production runtime.
