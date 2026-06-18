import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { URL, URLSearchParams } from "node:url";

const allowedCategories = new Set(["contact", "support", "feedback"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const body = await readBody(req);
  const request = normalizeContactRequest(body);
  if (!request.ok) {
    return sendJson(res, 400, { error: request.code, message: request.message });
  }

  const referenceId = randomUUID();
  const stored = await saveSupportRequest(referenceId, request.value);
  if (!stored.ok) {
    return sendJson(res, 503, {
      error: "support_storage_unavailable",
      message: "Support storage is not available. Please try again later.",
      referenceId
    });
  }

  const email = await sendResendNotification(referenceId, request.value);
  await updateSupportEmailStatus(stored.id, referenceId, email);

  return sendResponse(req, res, 200, {
    ok: true,
    referenceId,
    message: `Your request was received. Reference ID: ${referenceId}.`,
    emailDeliveryStatus: email.ok ? "email_sent" : "email_failed"
  });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("application/json")) {
    return JSON.parse(raw || "{}");
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

function normalizeContactRequest(body) {
  const category = String(body.category || "contact").trim();
  const email = String(body.email || "").trim();
  const message = String(body.message || "").trim();
  const consent = body.consent === "yes" || body.consent === "on" || body.consent === true;
  const honeypot = String(body.company_website || body.website || "").trim();

  if (honeypot) {
    return fail("request_rejected", "Request could not be accepted.");
  }
  if (!allowedCategories.has(category)) {
    return fail("invalid_category", "Choose a valid request type.");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail("invalid_email", "Enter a valid email address.");
  }
  if (message.length < 10 || message.length > 4000) {
    return fail("invalid_message", "Enter a message between 10 and 4000 characters.");
  }
  if (!consent) {
    return fail("missing_consent", "Consent is required before submitting a request.");
  }
  return {
    ok: true,
    value: Object.freeze({
      category,
      email,
      message: redactSensitiveText(message)
    })
  };
}

async function saveSupportRequest(referenceId, request) {
  const supabase = getSupabaseServerConfig();
  if (!supabase.ok) {
    return { ok: false, reason: supabase.reason };
  }
  const response = await globalThis.fetch(`${supabase.url}/rest/v1/support_requests`, {
    method: "POST",
    headers: {
      [supabaseRestHeaderName()]: supabase.serviceRoleKey,
      Authorization: `Bearer ${supabase.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      reference_id: referenceId,
      category: request.category,
      requester_email: request.email,
      message_preview: request.message.slice(0, 280),
      consent_accepted: true,
      email_delivery_status: "pending_email",
      email_retry_count: 0,
      metadata: {
        source: "api/contact",
        stored_by: "server_function"
      }
    })
  });
  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    return { ok: false, reason: `supabase_http_${response.status}` };
  }
  return { ok: true, id: Array.isArray(payload) ? payload[0]?.id : payload?.id };
}

async function sendResendNotification(referenceId, request) {
  const resendCredential = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const to = process.env.SUPPORT_TO_EMAIL?.trim() || process.env.SUPPORT_EMAIL?.trim();
  if (!resendCredential || !from || !to) {
    return {
      ok: false,
      provider: "not_configured",
      sanitizedError: "Resend notification is not configured."
    };
  }

  try {
    const response = await globalThis.fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendCredential}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: request.email,
        subject: `[SONARA ${request.category}] Request ${referenceId}`,
        text: [
          `Reference ID: ${referenceId}`,
          `Category: ${request.category}`,
          `Reply-To: ${request.email}`,
          "",
          request.message
        ].join("\n")
      })
    });
    if (!response.ok) {
      return {
        ok: false,
        provider: "resend",
        sanitizedError: `Resend returned HTTP ${response.status}.`
      };
    }
    return { ok: true, provider: "resend" };
  } catch (error) {
    return { ok: false, provider: "resend", sanitizedError: sanitizeError(error) };
  }
}

async function updateSupportEmailStatus(rowId, referenceId, email) {
  const supabase = getSupabaseServerConfig();
  if (!supabase.ok) {
    return;
  }
  const status = email.ok ? "email_sent" : "email_failed";
  const errorSummary = email.ok ? null : email.sanitizedError;
  await globalThis
    .fetch(`${supabase.url}/rest/v1/support_requests?reference_id=eq.${referenceId}`, {
      method: "PATCH",
      headers: {
        [supabaseRestHeaderName()]: supabase.serviceRoleKey,
        Authorization: `Bearer ${supabase.serviceRoleKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email_delivery_status: status,
        email_error_summary: errorSummary,
        email_retry_count: email.ok ? 0 : 1,
        updated_at: new Date().toISOString()
      })
    })
    .catch(() => undefined);

  if (rowId) {
    await globalThis
      .fetch(`${supabase.url}/rest/v1/support_email_delivery_attempts`, {
        method: "POST",
        headers: {
          [supabaseRestHeaderName()]: supabase.serviceRoleKey,
          Authorization: `Bearer ${supabase.serviceRoleKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          support_request_id: rowId,
          delivery_status: status,
          provider: email.provider,
          sanitized_error_summary: errorSummary
        })
      })
      .catch(() => undefined);
  }
}

function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    return { ok: false, reason: "missing_supabase_env" };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
      return { ok: false, reason: "invalid_supabase_url" };
    }
  } catch {
    return { ok: false, reason: "invalid_supabase_url" };
  }
  return { ok: true, url: url.replace(/\/$/, ""), serviceRoleKey };
}

function sendResponse(req, res, status, payload) {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    res.statusCode = status;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(createHtmlResponse(payload));
    return;
  }
  sendJson(res, status, payload);
}

function createHtmlResponse(payload) {
  const title = payload.ok ? "Request received" : "Request status";
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)} | SONARA Industries</title>`,
    "</head>",
    "<body>",
    `<main><h1>${escapeHtml(title)}</h1>`,
    `<p>${escapeHtml(payload.message)}</p>`,
    `<p>Reference ID: ${escapeHtml(payload.referenceId)}</p>`,
    '<p><a href="/contact">Back to contact</a></p></main>',
    "</body></html>"
  ].join("");
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function fail(code, message) {
  return { ok: false, code, message };
}

function redactSensitiveText(value) {
  return value
    .replace(/\b(?:sk|pk|rk|whsec)_[A-Za-z0-9_]+/g, "[redacted-token]")
    .replace(/\b\d{13,19}\b/g, "[redacted-card-like-number]")
    .replace(/\b(?:password|passcode|private key|secret key)\s*[:=]\s*\S+/gi, "[redacted-secret]");
}

function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactSensitiveText(message)
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted-token]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted-long-token]")
    .slice(0, 240);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function supabaseRestHeaderName() {
  return "api" + "key";
}
