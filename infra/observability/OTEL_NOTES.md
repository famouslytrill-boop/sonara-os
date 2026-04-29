# Observability Notes

Use OpenTelemetry in the backend and frontend where possible.

Minimum launch dashboards:
- API latency p50/p95/p99
- Error rate
- Model routing cost per user
- Evolution audit recommendations
- Activation rate
- Day 7 retention
- Marketplace GMV

Use Prometheus + Grafana locally, then graduate to managed Grafana or self-hosted stack in production.
