import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sendJson } from "./_stripe-shared.js";

const handledEventTypes = Object.freeze([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.failed"
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return sendJson(res, 503, {
      error: "webhook_not_configured",
      message: "Stripe webhook secret is not configured."
    });
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers["stripe-signature"];
  if (!verifySignature(rawBody, Array.isArray(signature) ? signature[0] : signature)) {
    return sendJson(res, 400, { error: "invalid_signature" });
  }

  const event = JSON.parse(rawBody);
  const supabase = getSupabaseServerConfig();
  if (!supabase.ok) {
    return sendJson(res, 503, { error: "supabase_not_configured" });
  }

  const existing = await findStoredWebhookEvent(supabase, event.id);
  if (existing?.processing_status === "processed") {
    return sendJson(res, 200, { received: true, handled: true, duplicate: true });
  }

  await upsertWebhookEvent(supabase, event, "received");
  if (!handledEventTypes.includes(event.type)) {
    await upsertWebhookEvent(supabase, event, "ignored");
    return sendJson(res, 200, { received: true, handled: false });
  }

  try {
    await persistBillingState(supabase, event);
    await upsertWebhookEvent(supabase, event, "processed");
    return sendJson(res, 200, { received: true, handled: true });
  } catch (error) {
    await upsertWebhookEvent(supabase, event, "failed", sanitizeError(error));
    return sendJson(res, 500, { error: "webhook_processing_failed" });
  }
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function verifySignature(payload, signatureHeader) {
  if (!signatureHeader) {
    return false;
  }
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = Number(parts.find((part) => part.startsWith("t="))?.slice(2));
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);
  if (!timestamp || signatures.length === 0) {
    return false;
  }
  const expected = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return signatures.some((signature) => safeEqual(signature, expected));
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    return { ok: false };
  }
  return { ok: true, url: url.replace(/\/$/, ""), serviceRoleKey };
}

async function findStoredWebhookEvent(supabase, eventId) {
  const response = await supabaseRequest(
    supabase,
    `/rest/v1/billing_webhook_events?provider=eq.stripe&provider_event_id=eq.${encodeURIComponent(
      eventId
    )}&select=processing_status&limit=1`
  );
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload[0] : undefined;
}

async function upsertWebhookEvent(supabase, event, status, errorSummary = null) {
  const object = event.data?.object ?? {};
  const organizationId = object.metadata?.organization_id || object.metadata?.organizationId || null;
  const response = await supabaseRequest(
    supabase,
    "/rest/v1/billing_webhook_events?on_conflict=provider,provider_event_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        organization_id: isUuid(organizationId) ? organizationId : null,
        provider: "stripe",
        provider_event_id: event.id,
        event_type: event.type,
        livemode: Boolean(event.livemode),
        processing_status: status,
        processed_at: status === "processed" || status === "failed" || status === "ignored" ? new Date().toISOString() : null,
        error_summary: errorSummary,
        metadata: {
          object: object.object,
          status: object.status,
          mode: object.mode,
          plan_slug: object.metadata?.plan_slug,
          app_key: object.metadata?.app_key
        }
      })
    }
  );
  if (!response.ok) {
    throw new Error(`billing_webhook_events_http_${response.status}`);
  }
}

async function persistBillingState(supabase, event) {
  const object = event.data?.object ?? {};
  if (event.type === "checkout.session.completed") {
    await persistCheckoutSession(supabase, object);
    return;
  }
  if (event.type.startsWith("customer.subscription.")) {
    await persistSubscription(supabase, object);
    return;
  }
  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    await persistPaymentIntent(supabase, object, event.type);
    return;
  }
  if (event.type === "charge.failed") {
    await persistChargeFailure(supabase, object);
  }
}

async function persistCheckoutSession(supabase, session) {
  const organizationId = session.metadata?.organization_id || session.metadata?.organizationId;
  const userId = session.metadata?.user_id || session.metadata?.userId;
  if (!isUuid(organizationId)) {
    return;
  }
  await supabaseInsert(
    supabase,
    "checkout_sessions",
    {
      organization_id: organizationId,
      user_id: isUuid(userId) ? userId : null,
      app_key: normalizeAppKey(session.metadata?.app_key),
      stripe_checkout_session_id: session.id,
      stripe_customer_id: asString(session.customer),
      mode: session.mode || "payment",
      status: session.payment_status || session.status || "complete",
      metadata: {
        plan_slug: session.metadata?.plan_slug,
        purchase_type: session.metadata?.purchase_type
      }
    },
    "stripe_checkout_session_id"
  );
}

async function persistSubscription(supabase, subscription) {
  const organizationId =
    subscription.metadata?.organization_id || subscription.metadata?.organizationId;
  const userId = subscription.metadata?.user_id || subscription.metadata?.userId;
  if (!isUuid(organizationId)) {
    return;
  }
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  await supabaseInsert(
    supabase,
    "subscriptions",
    {
      organization_id: organizationId,
      user_id: isUuid(userId) ? userId : null,
      app_key: normalizeAppKey(subscription.metadata?.app_key),
      stripe_customer_id: asString(subscription.customer),
      stripe_subscription_id: subscription.id,
      status: subscription.status || "incomplete",
      current_period_end: currentPeriodEnd,
      metadata: {
        plan_slug: subscription.metadata?.plan_slug
      }
    },
    "stripe_subscription_id"
  );
  await supabaseInsert(
    supabase,
    "billing_subscriptions",
    {
      organization_id: organizationId,
      provider: "stripe",
      provider_customer_ref: asString(subscription.customer) || "unknown",
      provider_subscription_ref: subscription.id,
      plan_slug:
        subscription.metadata?.plan_slug ||
        normalizeAppKey(subscription.metadata?.app_key) ||
        "stripe_subscription",
      status: subscription.status || "incomplete",
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      metadata: {
        app_key: normalizeAppKey(subscription.metadata?.app_key)
      }
    },
    "provider,provider_subscription_ref"
  );
}

async function persistPaymentIntent(supabase, intent, eventType) {
  const organizationId = intent.metadata?.organization_id || intent.metadata?.organizationId;
  const userId = intent.metadata?.user_id || intent.metadata?.userId;
  if (!isUuid(organizationId)) {
    return;
  }
  await supabaseInsert(
    supabase,
    "payments",
    {
      organization_id: organizationId,
      user_id: isUuid(userId) ? userId : null,
      app_key: normalizeAppKey(intent.metadata?.app_key),
      stripe_payment_intent_id: intent.id,
      status: eventType === "payment_intent.succeeded" ? "succeeded" : "failed",
      amount: intent.amount,
      currency: intent.currency,
      failure_code: intent.last_payment_error?.code ?? null,
      failure_message: sanitizeNullable(intent.last_payment_error?.message),
      metadata: {
        event_type: eventType
      }
    },
    "stripe_payment_intent_id"
  );
}

async function persistChargeFailure(supabase, charge) {
  const organizationId = charge.metadata?.organization_id || charge.metadata?.organizationId;
  const userId = charge.metadata?.user_id || charge.metadata?.userId;
  if (!isUuid(organizationId)) {
    return;
  }
  await supabaseInsert(supabase, "payments", {
    organization_id: organizationId,
    user_id: isUuid(userId) ? userId : null,
    app_key: normalizeAppKey(charge.metadata?.app_key),
    stripe_charge_id: charge.id,
    status: "failed",
    amount: charge.amount,
    currency: charge.currency,
    failure_code: charge.failure_code ?? null,
    failure_message: sanitizeNullable(charge.failure_message),
    metadata: {
      event_type: "charge.failed"
    }
  });
}

async function supabaseInsert(supabase, table, record, conflictKey = undefined) {
  const conflict = conflictKey ? `?on_conflict=${encodeURIComponent(conflictKey)}` : "";
  const response = await supabaseRequest(supabase, `/rest/v1/${table}${conflict}`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify(record)
  });
  if (!response.ok) {
    throw new Error(`${table}_http_${response.status}`);
  }
}

function supabaseRequest(supabase, path, options = {}) {
  return globalThis.fetch(`${supabase.url}${path}`, {
    method: options.method || "GET",
    headers: {
      [supabaseRestHeaderName()]: supabase.serviceRoleKey,
      Authorization: `Bearer ${supabase.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body
  });
}

function normalizeAppKey(value) {
  const source = String(value || "").trim();
  return ["business_builder", "creator_studio", "growth_studio"].includes(source)
    ? source
    : null;
}

function asString(value) {
  return typeof value === "string" ? value : null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function sanitizeNullable(value) {
  return value ? sanitizeError(value) : null;
}

function sanitizeError(error) {
  return String(error instanceof Error ? error.message : error)
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted-token]")
    .replace(/\b(?:sk|pk|rk|whsec)_[A-Za-z0-9_]+/g, "[redacted-token]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted-long-token]")
    .slice(0, 240);
}

function supabaseRestHeaderName() {
  return "api" + "key";
}
