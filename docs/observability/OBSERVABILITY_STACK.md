# Observability Stack

SONARA tracks OpenTelemetry-style traces, metrics, logs, and correlation IDs as a governed architecture. No telemetry is sent to third-party providers until environment variables, privacy review, and security review are complete.

Reference stack: OpenTelemetry, Grafana, Prometheus, Loki, Tempo or Jaeger, Sentry or GlitchTip-style error tracking, Playwright traces, and CI scan reports.

Rules:
- Do not log secrets, tokens, card data, private customer messages, or raw provider credentials.
- Redact emails, phone numbers, payment references, and private customer data where practical.
- Support requests, workflow runs, agent actions, and admin actions must have correlation IDs.
- Third-party telemetry is disabled unless configured and documented.
