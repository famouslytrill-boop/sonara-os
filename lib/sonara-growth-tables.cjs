"use strict";

// Which database table each Growth Studio record type lives in.
//
// This was a const inside routes/growth-studio-control-routes.cjs, where the
// data-export endpoint could not reach it -- so the export was assembled from
// the Business Builder and Creator Studio page lists and silently covered
// neither Growth Studio nor the line items inside a record. A customer taking
// "a copy of your records" got no leads, no campaigns, no consent records and
// no invoice lines, while the Terms of Service said their records were theirs
// to export at any time.
//
// One copy, in lib/, so the routes that read these tables and the export that
// has to include them cannot disagree about what exists.

const TABLES = Object.freeze({
  campaigns: "growth_campaigns",
  leads: "growth_leads",
  // Business Builder's table, named here because a won lead becomes one. Every
  // other call in this file goes through TABLES, and passing a literal name
  // instead hides the table from the member-policy scan -- which is what the
  // "no read helper hides from the policy check" test caught.
  customers: "customers",
  experiments: "growth_experiments",
  automations: "automation_rules",
  connections: "growth_provider_connections",
  segments: "growth_audience_segments",
  consents: "growth_contact_consents",
  touchpoints: "growth_touchpoints",
  conversions: "growth_conversions",
  content: "growth_content_queue",
  jobs: "growth_provider_jobs",
  metrics: "growth_metric_snapshots",
  variants: "growth_experiment_variants",
  events: "growth_control_events"
});

module.exports = { GROWTH_TABLES: TABLES };
