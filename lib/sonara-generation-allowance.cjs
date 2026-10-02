// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Stripe moved billing periods from the subscription to its items in Basil.
// Mixed item periods do not describe one allowance period; refuse to invent one.
function subscriptionPeriod(subscription) {
  const pairs = Array.isArray(subscription?.items?.data) && subscription.items.data.some((item) => item.current_period_start !== undefined || item.current_period_end !== undefined)
    ? subscription.items.data.map((item) => [item.current_period_start, item.current_period_end])
    : [[subscription?.current_period_start, subscription?.current_period_end]];
  const valid = ([start, end]) => Number.isSafeInteger(start) && Number.isSafeInteger(end)
    && start > 0 && end > start && end <= 253402300799;
  if (!pairs.every(valid) || pairs.some(([start, end]) => start !== pairs[0][0] || end !== pairs[0][1])) {
    return { ok: false, code: "subscription_period_unavailable" };
  }
  return { ok: true, start: new Date(pairs[0][0] * 1000).toISOString(), end: new Date(pairs[0][1] * 1000).toISOString() };
}

async function generationAllowance({ config, organizationId, action = "status", jobId = null, amountMinor = 0, entry = {} }) {
  if (!config?.ok || !organizationId) return { ok: false, code: "generation_allowance_unavailable" };
  const response = await fetch(`${config.url}/rest/v1/rpc/generation_usage`, {
    method: "POST",
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_organization_id: organizationId, p_action: action, p_job_id: jobId, p_amount_minor: amountMinor, p_entry: entry })
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "generation_allowance_unavailable" };
  const value = await response.json().catch(() => null);
  if (!value || typeof value.ok !== "boolean") return { ok: false, code: "generation_allowance_unavailable" };
  return value;
}

module.exports = { subscriptionPeriod, generationAllowance };
