import { URL } from "node:url";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const auth = await verifyUser(req);
  if (!auth.ok) {
    return sendJson(res, auth.status, { error: auth.code, message: auth.message });
  }
  const body = await readJson(req);
  const subscription = normalizeSubscription(body?.subscription);
  if (!subscription.ok) {
    return sendJson(res, 400, { error: "invalid_subscription", message: subscription.message });
  }

  const supabase = getSupabaseServerConfig();
  if (!supabase.ok) {
    return sendJson(res, 503, {
      error: "notification_storage_unavailable",
      message: "Notification storage is not configured. An administrator must apply the notification migration."
    });
  }
  const response = await globalThis.fetch(`${supabase.url}/rest/v1/push_notification_subscriptions`, {
    method: "POST",
    headers: {
      [supabaseRestHeaderName()]: supabase.serviceRoleKey,
      Authorization: `Bearer ${supabase.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      user_id: auth.userId,
      endpoint: subscription.value.endpoint,
      p256dh: subscription.value.p256dh,
      auth_secret: subscription.value.auth,
      user_agent: String(body?.userAgent || "").slice(0, 240) || null,
      enabled: true,
      updated_at: new Date().toISOString()
    })
  });
  if (!response.ok) {
    return sendJson(res, 502, {
      error: "notification_subscription_save_failed",
      message: "The notification subscription could not be saved. Confirm the Supabase migration is applied."
    });
  }
  return sendJson(res, 200, { ok: true, status: "registered" });
}

async function verifyUser(req) {
  const token = getBearerToken(req);
  const supabase = getSupabasePublicConfig();
  if (!token) return deny(401, "missing_auth_token", "Sign in before enabling notifications.");
  if (!supabase.ok) return deny(503, "supabase_auth_missing", "Supabase browser auth is not configured.");
  const response = await globalThis.fetch(`${supabase.url}/auth/v1/user`, {
    headers: {
      [supabaseRestHeaderName()]: supabase.anonKey,
      Authorization: `Bearer ${token}`
    }
  });
  const user = await response.json().catch(() => ({}));
  if (!response.ok || !isUuid(user.id)) return deny(401, "invalid_auth_token", "Your session could not be verified.");
  return { ok: true, userId: user.id };
}

function normalizeSubscription(input) {
  const endpoint = String(input?.endpoint || "").trim();
  const p256dh = String(input?.keys?.p256dh || "").trim();
  const auth = String(input?.keys?.auth || "").trim();
  if (!/^https:\/\//i.test(endpoint) || endpoint.length > 2048 || !p256dh || !auth) {
    return { ok: false, message: "The browser did not provide a valid notification subscription." };
  }
  return { ok: true, value: { endpoint, p256dh, auth } };
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { ok: true, url: url.replace(/\/$/, ""), anonKey } : { ok: false };
}

function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return { ok: false };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) return { ok: false };
  } catch { return { ok: false }; }
  return { ok: true, url: url.replace(/\/$/, ""), serviceRoleKey };
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  const match = /^Bearer\s+(.+)$/i.exec(Array.isArray(header) ? header[0] : header || "");
  return match?.[1]?.trim();
}

function isUuid(value) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function deny(status, code, message) { return { ok: false, status, code, message }; }
function supabaseRestHeaderName() { return "api" + "key"; }
function sendJson(res, status, payload) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(payload)); }
