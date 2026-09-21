// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { randomUUID } = require("node:crypto");
const { context, metrics, trace } = require("@opentelemetry/api");
const { emitEvent } = require("./sonara-structured-log.cjs");

let telemetryState = Object.freeze({ enabled: false, status: "not_started", sdk: null });

function truthy(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function endpointFor(env, signal) {
  const specific = String(env[`OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_ENDPOINT`] || "").trim();
  if (specific) return specific;
  const base = String(env.OTEL_EXPORTER_OTLP_ENDPOINT || "").trim().replace(/\/+$/, "");
  return base ? `${base}/v1/${signal}` : "";
}

function endpointAllowed(value, env) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

// Start before Express is required. Http/Express instrumentation patches modules
// as they load; starting it after server.js imports Express produces a dashboard
// that looks configured while missing the requests it was installed to observe.
function startTelemetry(env = process.env) {
  if (telemetryState.status !== "not_started") return telemetryState;

  if (!truthy(env.SONARA_OTEL_ENABLED)) {
    telemetryState = Object.freeze({ enabled: false, status: "disabled", sdk: null });
    return telemetryState;
  }

  const tracesEndpoint = endpointFor(env, "traces");
  const metricsEndpoint = endpointFor(env, "metrics");
  if (!endpointAllowed(tracesEndpoint, env) || !endpointAllowed(metricsEndpoint, env)) {
    emitEvent({
      event: "observability.otel_start",
      scope: "process",
      capability: "opentelemetry",
      outcome: "refused",
      reason: "invalid_or_missing_otlp_endpoint",
      detail: {
        traces_configured: Boolean(tracesEndpoint),
        metrics_configured: Boolean(metricsEndpoint),
        production_requires_https: env.NODE_ENV === "production"
      }
    });
    telemetryState = Object.freeze({ enabled: false, status: "invalid_configuration", sdk: null });
    return telemetryState;
  }

  try {
    if (!env.OTEL_SERVICE_NAME) env.OTEL_SERVICE_NAME = "sonara-os";

    const { NodeSDK } = require("@opentelemetry/sdk-node");
    const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
    const { ExpressInstrumentation } = require("@opentelemetry/instrumentation-express");
    const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
    const { OTLPMetricExporter } = require("@opentelemetry/exporter-metrics-otlp-http");
    const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");

    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({ url: tracesEndpoint }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: metricsEndpoint }),
        exportIntervalMillis: 60_000,
        exportTimeoutMillis: 10_000
      }),
      instrumentations: [
        new HttpInstrumentation(),
        new ExpressInstrumentation()
      ]
    });

    sdk.start();
    telemetryState = Object.freeze({ enabled: true, status: "started", sdk });
    emitEvent({
      event: "observability.otel_start",
      scope: "process",
      capability: "opentelemetry",
      outcome: "ok",
      reason: "otlp_http_exporters_started",
      detail: { service: env.OTEL_SERVICE_NAME }
    });
    return telemetryState;
  } catch (error) {
    emitEvent({
      event: "observability.otel_start",
      scope: "process",
      capability: "opentelemetry",
      outcome: "failed",
      reason: "sdk_start_failed",
      detail: { error: String(error && error.message || error) }
    });
    telemetryState = Object.freeze({ enabled: false, status: "start_failed", sdk: null });
    return telemetryState;
  }
}

function currentTelemetryState() {
  return { enabled: telemetryState.enabled, status: telemetryState.status };
}

function safeRouteTemplate(req) {
  const route = req && req.route && req.route.path;
  if (typeof route === "string" && route.length <= 160) {
    return `${String(req.baseUrl || "")}${route}` || "/";
  }
  return "unmatched";
}

function installHttpObservability(app) {
  if (!app || typeof app.use !== "function") throw new TypeError("installHttpObservability requires an Express app");

  const meter = metrics.getMeter("sonara-http");
  const requestCounter = meter.createCounter("sonara.http.server.requests", {
    description: "Count of dynamic HTTP requests handled by SONARA"
  });
  const durationHistogram = meter.createHistogram("sonara.http.server.duration_ms", {
    description: "Dynamic HTTP request duration in milliseconds",
    unit: "ms"
  });

  app.use((req, res, next) => {
    // Versioned/static assets have their own cache and availability checks.
    // Counting every CSS/image request makes customer transactions harder to see.
    if (req.method === "GET" && /\.[a-z0-9]{1,8}$/i.test(req.path || "")) return next();

    const started = process.hrtime.bigint();
    const correlationId = randomUUID();
    req.sonaraCorrelationId = correlationId;
    res.setHeader("X-Request-ID", correlationId);

    const activeSpan = trace.getSpan(context.active());
    const spanContext = activeSpan && activeSpan.spanContext ? activeSpan.spanContext() : null;

    res.once("finish", () => {
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      const route = safeRouteTemplate(req);
      const status = Number(res.statusCode) || 0;
      const statusClass = status >= 500 ? "5xx" : status >= 400 ? "4xx" : status >= 300 ? "3xx" : "2xx";
      const attributes = {
        "http.request.method": String(req.method || "UNKNOWN"),
        "http.route": route,
        "http.response.status_code": status,
        "sonara.status_class": statusClass
      };

      requestCounter.add(1, attributes);
      durationHistogram.record(elapsedMs, attributes);

      const organizationId =
        typeof req.sonaraAccess?.organizationId === "string" && req.sonaraAccess.organizationId.trim()
          ? req.sonaraAccess.organizationId
          : null;

      emitEvent({
        event: "http.request",
        scope: organizationId ? "organization" : "process",
        organizationId: organizationId || undefined,
        capability: "http",
        outcome: status >= 500 ? "failed" : status >= 400 ? "refused" : "ok",
        correlationId,
        reason: statusClass,
        detail: {
          method: attributes["http.request.method"],
          route,
          status,
          duration_ms: Math.round(elapsedMs * 100) / 100,
          trace_id: spanContext?.traceId || null,
          span_id: spanContext?.spanId || null
        }
      });
    });

    next();
  });
}

module.exports = {
  startTelemetry,
  currentTelemetryState,
  installHttpObservability
};
