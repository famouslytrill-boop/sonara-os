# Rancher Optional Live Path

Rancher is optional and skipped for MVP unless a real cluster is configured.

## If Rancher Is Used Later

- Cluster ID documented outside public code.
- Namespace strategy documented.
- Secrets managed outside the repo.
- Ingress/domain configured.
- TLS configured.
- Rollback plan documented.
- Resource limits documented.
- Monitoring documented.

Missing Rancher config is `skipped_for_mvp`, not a launch failure.
