// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { normalizeActivityEvent } = require("./sonara-activity-taxonomy.cjs");

// One server-side writer for the existing public.activity_events ledger.
// Keeping transport here prevents every route family from inventing its own
// analytics payload shape or accidentally bypassing the canonical sanitizer.
function createActivityEventWriter(deps = {}) {
  if (typeof deps.getSupabaseAdminClient !== "function") throw new TypeError("createActivityEventWriter requires getSupabaseAdminClient");
  if (typeof deps.supabaseHeaders !== "function") throw new TypeError("createActivityEventWriter requires supabaseHeaders");

  return async function insertActivityEvent(organizationId, userId, eventType, eventData = {}) {
    const config = deps.getSupabaseAdminClient();
    if (!config?.ok || !organizationId) return { ok: false, code: "activity_store_unavailable" };

    const normalized = normalizeActivityEvent(eventType, eventData);
    if (!normalized.ok) return normalized;

    const request = typeof deps.fetchImpl === "function" ? deps.fetchImpl : globalThis.fetch;
    if (typeof request !== "function") return { ok: false, code: "activity_transport_unavailable" };

    const response = await request(`${config.url}/rest/v1/activity_events`, {
      method: "POST",
      headers: deps.supabaseHeaders(config),
      body: JSON.stringify({
        organization_id: organizationId,
        user_id: userId || null,
        event_type: normalized.eventType,
        event_data: normalized.eventData
      })
    }).catch(() => undefined);

    return {
      ok: Boolean(response?.ok),
      code: response?.ok ? "recorded" : "activity_event_write_failed"
    };
  };
}

module.exports = { createActivityEventWriter };
