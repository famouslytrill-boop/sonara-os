export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    return sendJson(res, auth.status, { error: auth.code, message: auth.message });
  }

  const supabase = getSupabaseServerConfig();
  if (!supabase.ok) {
    return sendJson(res, 503, {
      error: "support_storage_unavailable",
      message: "Supabase server configuration is missing or invalid."
    });
  }

  const response = await globalThis.fetch(
    `${supabase.url}/rest/v1/support_requests?select=reference_id,category,requester_email,message_preview,email_delivery_status,email_error_summary,email_retry_count,created_at,updated_at&order=created_at.desc&limit=50`,
    {
      headers: {
        [supabaseRestHeaderName()]: supabase.serviceRoleKey,
        Authorization: `Bearer ${supabase.serviceRoleKey}`
      }
    }
  );
  const records = await response.json().catch(() => []);
  if (!response.ok) {
    return sendJson(res, 502, {
      error: "support_queue_read_failed",
      message: `Support queue could not be read. HTTP ${response.status}.`
    });
  }

  return sendJson(res, 200, {
    ok: true,
    adminEmail: auth.email,
    records: Array.isArray(records) ? records.map(sanitizeSupportRecord) : []
  });
}

async function verifyAdminRequest(req) {
  const token = getBearerToken(req);
  if (!token) {
    return deny(401, "missing_auth_token", "Admin support queue requires a Supabase user token.");
  }
  const allowedEmails = readAdminEmails();
  if (allowedEmails.size === 0) {
    return deny(503, "admin_allowlist_missing", "SONARA_ADMIN_EMAILS is not configured.");
  }
  const supabase = getSupabasePublicConfig();
  if (!supabase.ok) {
    return deny(503, "supabase_auth_missing", "Supabase public auth configuration is missing.");
  }

  const response = await globalThis.fetch(`${supabase.url}/auth/v1/user`, {
    headers: {
      [supabaseRestHeaderName()]: supabase.anonKey,
      Authorization: `Bearer ${token}`
    }
  });
  const user = await response.json().catch(() => ({}));
  const email = String(user.email || "").toLowerCase();
  if (!response.ok || !email) {
    return deny(401, "invalid_auth_token", "Supabase user token could not be verified.");
  }
  if (!allowedEmails.has(email)) {
    return deny(403, "admin_required", "This endpoint requires an allowed admin email.");
  }
  return { ok: true, email };
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  const source = Array.isArray(header) ? header[0] : header;
  const match = /^Bearer\s+(.+)$/i.exec(source || "");
  return match?.[1]?.trim();
}

function readAdminEmails() {
  return new Set(
    String(process.env.SONARA_ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return { ok: false };
  }
  return { ok: true, url: url.replace(/\/$/, ""), anonKey };
}

function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    return { ok: false };
  }
  return { ok: true, url: url.replace(/\/$/, ""), serviceRoleKey };
}

function sanitizeSupportRecord(record) {
  return {
    reference_id: record.reference_id,
    category: record.category,
    requester_email: record.requester_email,
    message_preview: record.message_preview,
    email_delivery_status: record.email_delivery_status,
    email_error_summary: record.email_error_summary,
    email_retry_count: record.email_retry_count,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

function deny(status, code, message) {
  return { ok: false, status, code, message };
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function supabaseRestHeaderName() {
  return "api" + "key";
}
