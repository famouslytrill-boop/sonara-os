# SONARA OS: HTTP telemetry route labels, privacy and cardinality (2026-10-08)

## Reproduced issue

The common observability middleware previously emitted `http.route` and the structured `http.request.detail.route` by concatenating `req.baseUrl` and `req.route.path`. Express 4's `req.baseUrl` is the **matched URL path**, not the router's registered mount pattern. Therefore a nested route mounted at `/organizations/:organizationId` could emit `/organizations/<real tenant id>/jobs/:jobId`. That identifier creates a distinct metrics time series per tenant and may also be copied into operational logs.

An isolated before/after execution of the exact source proved this: the baseline emitted a concrete customer identifier in the label, while the patched source emits only `/jobs/:jobId`. A synthetic middleware invocation also showed the histogram and event log use the sanitized label.

## Changes on this draft branch

- Derive the shared route metric and log field **only from Express's registered `req.route.path` template**, never `req.baseUrl` or `req.originalUrl`. When no route template is available, emit the constant `unmatched`.
- Normalize the `http.request.method` attribute to OpenTelemetry's known verbs; emit `_OTHER` for unknown/untrusted method tokens. Both counters and duration histograms use the same normalized attributes.
- Add tests to the existing observability suite for nested dynamic mounts, direct helper behavior, event redaction and bounded method labels. No new Mocha test file or provider/dependency is needed.
- Preserve `X-Request-ID`, correlation handling, status classes, trace IDs, tenant-scoped event ownership and the existing opt-in telemetry flag.

## Deliberate tradeoff

For nested Express Router mounts, `req.route.path` alone is a child-router template rather than the complete absolute route. This is **privacy-preserving but less specific**: multiple routers with a child route named `/:id` can share a label. Never reconstruct the prefix from a matched URL, infer it from user identifiers, or emit a raw request path to recover this specificity. A later reviewed registry can attach **statically declared mount templates at route registration** (e.g., `/organizations/:organizationId/jobs/:jobId`), accompanied by tests that prove there is no arbitrary string injection.

Until then, availability SLO analysis should use the statically routed paths already on `server.js`, service/capability attributes and explicit product-specific events for finer breakdowns. Avoid using per-user, per-organization, per-order, per-session or email identifiers as metric dimensions.

## Cardinality model / operational test

With an `http.route` label, the approximate number of series is bounded by:

```text
series <= known_methods × registered_route_templates × response_statuses × bounded_other_dimensions
```

Replacing a template with customer-specific URLs instead produces at least one additional distinct value for every unique customer/path combination. An error-budget dashboard that unintentionally aggregates one route into thousands of series is costly and can be harder to alert on.

Acceptance before release:

1. Targeted `pnpm exec mocha tests/observability.test.js` green.
2. Full Node 22/24/26, security, release, accessibility and browser checks green at the exact review commit.
3. A real Express nested-mount test shows no customer ID in emitted event or instrument attributes, and unmatched requests remain `unmatched`.
4. Two different dynamic customer mount paths produce identical `http.route` labels for the same registered template.
5. OpenTelemetry and log backends do not retain a second raw-URL attribute; inspect exporter and collector configuration before enabling production traces.
6. Document the reduced router-prefix specificity before building SLO dashboards.

## Official references

- Express 4 API: `app.mountpath` versus the concrete `req.baseUrl`: https://expressjs.com/en/4x/api/application/
- OpenTelemetry HTTP semantic conventions: `http.route` MUST be a low-cardinality matched template and unknown HTTP methods use `_OTHER`: https://opentelemetry.io/docs/specs/semconv/http/http-metrics/
- OpenTelemetry HTTP spans: https://opentelemetry.io/docs/specs/semconv/http/http-spans/

## Safety / release

This change affects observability only. It does not change request routing, permissions, subscription entitlements, storage, media, payment, authentication, RLS, SQL migrations, production configuration, or the owner's existing website-offline instruction. Do not merge or deploy until exact-head required CI, branch protection, independent review and production environment controls are proven.
