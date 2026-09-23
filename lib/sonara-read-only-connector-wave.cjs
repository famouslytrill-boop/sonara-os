// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const READ_ONLY_CONNECTOR_WAVE_VERSION = "1.0.0";
const READ_ONLY_CONNECTOR_WAVE_DATE = "2026-09-23";

const SHARED_SYNC_REQUIREMENTS = Object.freeze([
  "tenant_scoped_connection",
  "credential_reference_only",
  "least_privilege_scope_check",
  "capability_negotiation",
  "initial_backfill",
  "incremental_cursor_or_window_checkpoint",
  "checkpoint_persistence",
  "pagination_proof",
  "duplicate_and_replay_handling",
  "schema_version_capture",
  "provider_timestamp_capture",
  "received_timestamp_capture",
  "per_record_failure_capture",
  "bounded_retry_with_retry_after",
  "rate_and_quota_state",
  "reconciliation",
  "disconnect_and_delete_proof",
  "opentelemetry_trace_metric_log_correlation",
  "tenant_canary_before_production_verified"
]);

const CANONICAL_REPORT_ENVELOPE = Object.freeze([
  "organization_id",
  "connection_id",
  "provider_key",
  "external_account_id",
  "report_type",
  "period_start",
  "period_end",
  "dimensions",
  "metrics",
  "source_timestamp",
  "received_at",
  "provider_version",
  "adapter_version",
  "checkpoint",
  "provenance"
]);

function connector(input) {
  return Object.freeze({
    wave: 1,
    executionMode: "read_only",
    productionEnabled: false,
    verifiedNative: false,
    ...input,
    canonicalEnvelope: CANONICAL_REPORT_ENVELOPE,
    sharedRequirements: SHARED_SYNC_REQUIREMENTS
  });
}

const READ_ONLY_CONNECTOR_WAVE = Object.freeze([
  connector({
    key: "google_search_console",
    productOwner: "Growth Studio",
    authTypes: Object.freeze(["oauth2"]),
    canonicalReports: Object.freeze(["search_performance"]),
    canonicalDimensions: Object.freeze(["date", "query", "page", "country", "device", "search_appearance"]),
    canonicalMetrics: Object.freeze(["clicks", "impressions", "ctr", "position"]),
    checkpointStrategy: "date_window_plus_dimension_page",
    webhookStrategy: "none_poll_and_reconcile",
    sourceDocs: Object.freeze([
      "https://developers.google.com/webmaster-tools/v1/searchanalytics/query"
    ])
  }),
  connector({
    key: "app_store_connect_analytics",
    productOwner: "Growth Studio",
    authTypes: Object.freeze(["jwt_key"]),
    canonicalReports: Object.freeze(["app_store_analytics"]),
    canonicalDimensions: Object.freeze(["app", "territory", "platform", "source_type", "date"]),
    canonicalMetrics: Object.freeze(["impressions", "product_page_views", "downloads", "proceeds", "sessions", "active_devices"]),
    checkpointStrategy: "report_request_plus_instance_segments",
    webhookStrategy: "none_poll_and_reconcile",
    sourceDocs: Object.freeze([
      "https://developer.apple.com/documentation/appstoreconnectapi"
    ])
  }),
  connector({
    key: "google_play_developer_reporting",
    productOwner: "Growth Studio",
    authTypes: Object.freeze(["oauth2", "service_account"]),
    canonicalReports: Object.freeze(["android_vitals", "play_reporting"]),
    canonicalDimensions: Object.freeze(["app", "version", "device", "country", "date"]),
    canonicalMetrics: Object.freeze(["crash_rate", "anr_rate", "error_count", "affected_users"]),
    checkpointStrategy: "date_window_plus_metric_set",
    webhookStrategy: "none_poll_and_reconcile",
    sourceDocs: Object.freeze([
      "https://developers.google.com/play/developer/reporting"
    ])
  }),
  connector({
    key: "google_analytics_data",
    productOwner: "Growth Studio",
    authTypes: Object.freeze(["oauth2", "service_account"]),
    canonicalReports: Object.freeze(["web_product_analytics"]),
    canonicalDimensions: Object.freeze(["date", "source", "medium", "campaign", "page", "country", "device"]),
    canonicalMetrics: Object.freeze(["sessions", "active_users", "new_users", "engagement_rate", "conversions", "revenue"]),
    checkpointStrategy: "date_window_plus_query_fingerprint",
    webhookStrategy: "none_poll_and_reconcile",
    sourceDocs: Object.freeze([
      "https://developers.google.com/analytics/devguides/reporting/data/v1"
    ])
  }),
  connector({
    key: "posthog",
    productOwner: "Growth Studio",
    authTypes: Object.freeze(["api_key", "oauth2"]),
    canonicalReports: Object.freeze(["product_analytics"]),
    canonicalDimensions: Object.freeze(["date", "event", "path", "feature", "cohort"]),
    canonicalMetrics: Object.freeze(["events", "persons", "sessions", "conversions", "retention"]),
    checkpointStrategy: "event_time_plus_cursor_or_query_window",
    webhookStrategy: "optional_ingress_never_without_poll_reconciliation",
    sourceDocs: Object.freeze([
      "https://posthog.com/docs/api"
    ])
  })
]);

function getReadOnlyConnectorWave() {
  return Object.freeze({
    version: READ_ONLY_CONNECTOR_WAVE_VERSION,
    observed: READ_ONLY_CONNECTOR_WAVE_DATE,
    runtimeEnabled: false,
    verifiedNativeCount: 0,
    mode: "read_only",
    connectorCount: READ_ONLY_CONNECTOR_WAVE.length,
    connectors: READ_ONLY_CONNECTOR_WAVE,
    sharedRequirements: SHARED_SYNC_REQUIREMENTS,
    canonicalReportEnvelope: CANONICAL_REPORT_ENVELOPE,
    rule: "A manifest defines the adapter contract only. Production verification still requires real authorization, sync, telemetry, reconciliation, disconnect/delete proof, exact deployed SHA evidence, and a tenant canary."
  });
}

module.exports = {
  READ_ONLY_CONNECTOR_WAVE_VERSION,
  READ_ONLY_CONNECTOR_WAVE_DATE,
  SHARED_SYNC_REQUIREMENTS,
  CANONICAL_REPORT_ENVELOPE,
  READ_ONLY_CONNECTOR_WAVE,
  getReadOnlyConnectorWave
};
