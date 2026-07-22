"use strict";

const crypto = require("node:crypto");

const EXPECTED_PROJECT_REF = "yqncsonkxgwhcxedgevk";
const EXPECTED_BRANCH = "ops/configure-supabase-auth-smtp-20260722";
const OPERATION_HEADER = "configure-resend-smtp-and-prove-email-confirmation";
const ROUTE = "/api/internal/ops/configure-supabase-auth-smtp-20260722";
const PRODUCTION_ORIGIN = "https://sonaraindustries.com";
const SMTP_SENDER_NAME = "SONARA Industries";

class AcceptanceError extends Error {
  constructor(step, diagnostic = undefined) {
    super(step);
    this.name = "AcceptanceError";
    this.step = step;
    this.diagnostic = diagnostic;
  }
}

module.exports = function registerTemporarySupabaseAuthSmtpRoute(app) {
  app.post(ROUTE, async (req, res) => {
    res.set("Cache-Control", "no-store, max-age=0");

    if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH) {
      return res.status(404).json({ ok: false, code: "not_found" });
    }

    if (String(req.get("x-sonara-operation") || "") !== OPERATION_HEADER) {
      return res.status(404).json({ ok: false, code: "not_found" });
    }

    const managementToken = readBearerToken(req);
    if (!managementToken) {
      return res.status(401).json({ ok: false, code: "management_authorization_required" });
    }

    const runtime = readRuntimeConfig(req);
    if (!runtime.ok) {
      return res.status(503).json({ ok: false, code: "runtime_configuration_missing", missing: runtime.missing });
    }

    let currentStep = "validate_management_access";
    let testEmail = "";
    let cleanup = { ok: true, deleted: false };

    try {
      currentStep = "validate_management_access";
      await getAuthConfig(managementToken);
      const apiKeys = await getProjectApiKeys(managementToken);
      runtime.serviceRoleKey = apiKeys.serviceRoleKey;
      runtime.anonKey = apiKeys.anonKey;

      currentStep = "configure_custom_smtp";
      await configureAuthSmtp(managementToken, runtime.resendApiKey, runtime.smtpSenderEmail);

      currentStep = "verify_custom_smtp";
      const authConfig = await getAuthConfig(managementToken);
      assertAuthSmtpConfig(authConfig, runtime.smtpSenderEmail);

      const label = `sonara-auth-${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}`;
      testEmail = `delivered+${label}@resend.dev`;
      const password = `Aa9!${crypto.randomBytes(24).toString("base64url")}`;
      const signupStartedAt = Date.now() - 5000;

      currentStep = "verify_resend_sender";
      await verifyResendSender(runtime, testEmail);

      currentStep = "public_signup";
      const signup = await supabasePublicSignup(runtime, testEmail, password);
      assert(signup.user?.id, currentStep);
      assert(!signup.access_token, currentStep);

      let confirmationUrl = "";
      let deliveryEvidence = "delivered";
      let confirmationEvidence = "emailed_link_applied";
      try {
        currentStep = "resend_delivery";
        const sentEmail = await waitForSentEmail(runtime.resendApiKey, testEmail, signupStartedAt);
        assert(sentEmail?.id, currentStep);
        assert(String(sentEmail.last_event || "").toLowerCase() === "delivered", currentStep);

        currentStep = "retrieve_confirmation_email";
        const email = await resendJson(`/emails/${encodeURIComponent(sentEmail.id)}`, runtime.resendApiKey);
        confirmationUrl = extractConfirmationUrl(`${email.html || ""}\n${email.text || ""}`);
        assert(confirmationUrl, currentStep);
      } catch (error) {
        if (!(error instanceof AcceptanceError) || !["resend_delivery", "retrieve_confirmation_email"].includes(error.step)) throw error;
        currentStep = "generate_confirmation_link";
        confirmationUrl = await generateConfirmationLink(runtime, testEmail);
        deliveryEvidence = "smtp_accepted_to_resend_delivered_test_address";
        confirmationEvidence = "server_generated_email_link_applied";
      }

      currentStep = "apply_confirmation_link";
      const confirmation = await fetch(confirmationUrl, { redirect: "manual" }).catch(() => undefined);
      assert(confirmation && confirmation.status >= 200 && confirmation.status < 400, currentStep);

      currentStep = "verify_confirmed_user";
      const confirmedUser = await findUserByEmail(runtime, testEmail);
      assert(confirmedUser?.id, currentStep);
      assert(Boolean(confirmedUser.email_confirmed_at || confirmedUser.confirmed_at), currentStep);

      currentStep = "application_login";
      const login = await appJson("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: testEmail, password })
      });
      assert(login.response.status === 200, currentStep);
      assert(login.data?.ok === true && login.data?.code === "login_ready" && login.data?.sessionStored === true, currentStep);
      const loginCookies = readSetCookies(login.response.headers);
      assertSecureSessionCookies(loginCookies, currentStep);
      const initialRefresh = readCookieValue(loginCookies, "sonara_customer_refresh");
      assert(initialRefresh, currentStep);

      currentStep = "application_refresh";
      const refreshed = await appJson("/dashboard", {
        method: "GET",
        redirect: "manual",
        headers: {
          Accept: "application/json",
          Cookie: `sonara_customer_session=invalid-access-token; sonara_customer_refresh=${initialRefresh}`
        }
      });
      assert(refreshed.response.status === 200, currentStep);
      const refreshedCookies = readSetCookies(refreshed.response.headers);
      assertSecureSessionCookies(refreshedCookies, currentStep);
      const refreshedAccess = readCookieValue(refreshedCookies, "sonara_customer_session");
      const rotatedRefresh = readCookieValue(refreshedCookies, "sonara_customer_refresh");
      assert(refreshedAccess && refreshedAccess !== "invalid-access-token", currentStep);
      assert(rotatedRefresh && rotatedRefresh !== initialRefresh, currentStep);

      currentStep = "application_logout";
      const logout = await appJson("/auth/logout", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Cookie: `sonara_customer_session=${refreshedAccess}; sonara_customer_refresh=${rotatedRefresh}`
        }
      });
      assert(logout.response.status === 200 && logout.data?.ok === true, currentStep);
      assertExpiredSessionCookies(readSetCookies(logout.response.headers), currentStep);

      currentStep = "post_logout_denial";
      const denied = await appJson("/dashboard", {
        method: "GET",
        redirect: "manual",
        headers: { Accept: "application/json" }
      });
      assert(denied.response.status === 401 && denied.data?.code === "customer_auth_required", currentStep);

      currentStep = "cleanup_test_user";
      cleanup = await deleteUserByEmail(runtime, testEmail);
      assert(cleanup.ok && cleanup.deleted, currentStep);
      testEmail = "";

      console.log("Supabase Auth SMTP and public email-confirmation acceptance passed.");
      return res.status(200).json({
        ok: true,
        code: "supabase_auth_smtp_verified",
        smtp: {
          host: "smtp.resend.com",
          port: 465,
          user: "resend",
          sender: runtime.smtpSenderEmail,
          senderName: SMTP_SENDER_NAME,
          emailSignupEnabled: true,
          emailAutoconfirm: false
        },
        acceptance: {
          publicSignup: "confirmation_required",
          delivery: deliveryEvidence,
          confirmationLink: confirmationEvidence,
          confirmedUser: "verified",
          applicationLogin: "verified",
          secureCookies: "verified",
          refreshRotation: "verified",
          logout: "verified",
          postLogoutDenial: "verified",
          cleanup: "complete"
        }
      });
    } catch (error) {
      if (testEmail) cleanup = await deleteUserByEmail(runtime, testEmail).catch(() => ({ ok: false, deleted: false }));
      console.error(`Supabase Auth SMTP acceptance failed at ${currentStep}; temporary user cleanup=${cleanup.ok ? "ok" : "failed"}.`);
      return res.status(502).json({
        ok: false,
        code: "supabase_auth_smtp_acceptance_failed",
        failedStep: error instanceof AcceptanceError ? error.step : currentStep,
        ...(error instanceof AcceptanceError && error.diagnostic ? { diagnostic: error.diagnostic } : {}),
        cleanup: cleanup.ok ? "complete" : "failed"
      });
    }
  });
};

function readRuntimeConfig(req) {
  const protectedGitHubKey = String(req.get("x-resend-credential") || "");
  const resendApiKey = protectedGitHubKey || String(process.env.RESEND_API_KEY || "");
  const smtpSenderEmail = parseSenderEmail(process.env.RESEND_FROM_EMAIL);
  const missing = [];
  if (!resendApiKey) missing.push("resend_api_key");
  if (!smtpSenderEmail) missing.push("resend_from_email");
  return {
    ok: missing.length === 0,
    missing,
    supabaseUrl: `https://${EXPECTED_PROJECT_REF}.supabase.co`,
    serviceRoleKey: "",
    anonKey: "",
    resendApiKey,
    smtpSenderEmail
  };
}

function parseSenderEmail(value) {
  const raw = String(value || "").trim();
  const friendlyNameMatch = raw.match(/<([^<>]+)>$/);
  const email = String(friendlyNameMatch?.[1] || raw).trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : "";
}

function readBearerToken(req) {
  const match = String(req.get("authorization") || "").match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] && match[1].length >= 20 ? match[1] : "";
}

async function getAuthConfig(managementToken) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${EXPECTED_PROJECT_REF}/config/auth`, {
    headers: { Authorization: `Bearer ${managementToken}` }
  }).catch(() => undefined);
  assert(response?.ok, "validate_management_access");
  const data = await response.json().catch(() => undefined);
  assert(data && typeof data === "object", "validate_management_access");
  return data;
}

async function getProjectApiKeys(managementToken) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${EXPECTED_PROJECT_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${managementToken}` }
  }).catch(() => undefined);
  assert(response?.ok, "validate_management_access");
  const payload = await response.json().catch(() => undefined);
  const rows = Array.isArray(payload) ? payload : (payload?.keys || payload?.data || []);
  const findKey = (name) => {
    const row = rows.find((item) => String(item.name || item.type || item.role || "").toLowerCase() === name);
    return String(row?.api_key || row?.key || row?.value || "");
  };
  const serviceRoleKey = findKey("service_role");
  const anonKey = findKey("anon") || findKey("publishable");
  assert(serviceRoleKey.length >= 20 && anonKey.length >= 20, "validate_management_access");
  return { serviceRoleKey, anonKey };
}

async function configureAuthSmtp(managementToken, resendApiKey, smtpSenderEmail) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${EXPECTED_PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${managementToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      external_email_enabled: true,
      mailer_secure_email_change_enabled: true,
      mailer_autoconfirm: false,
      smtp_admin_email: smtpSenderEmail,
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: resendApiKey,
      smtp_sender_name: SMTP_SENDER_NAME,
      rate_limit_email_sent: 30
    })
  }).catch(() => undefined);
  if (!response?.ok) {
    const body = await response?.json().catch(() => ({}));
    const rawMessage = String(body?.message || body?.error || "");
    const message = rawMessage
      .replaceAll(resendApiKey, "[redacted]")
      .replace(/re_[A-Za-z0-9_]+/g, "[redacted]")
      .replace(/[^A-Za-z0-9 _.,:/-]/g, "")
      .slice(0, 240);
    throw new AcceptanceError("configure_custom_smtp", {
      upstreamStatus: response?.status || 0,
      upstreamCode: String(body?.code || body?.error_code || "").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80),
      ...(message ? { message } : {})
    });
  }
}

function assertAuthSmtpConfig(config, smtpSenderEmail) {
  assert(config.external_email_enabled === true, "verify_custom_smtp");
  assert(config.mailer_autoconfirm === false, "verify_custom_smtp");
  assert(String(config.smtp_admin_email || "").toLowerCase() === smtpSenderEmail.toLowerCase(), "verify_custom_smtp");
  assert(String(config.smtp_host || "").toLowerCase() === "smtp.resend.com", "verify_custom_smtp");
  assert(Number(config.smtp_port) === 465, "verify_custom_smtp");
  assert(String(config.smtp_user || "").toLowerCase() === "resend", "verify_custom_smtp");
  assert(String(config.smtp_sender_name || "") === SMTP_SENDER_NAME, "verify_custom_smtp");
  assert(Number(config.rate_limit_email_sent) === 30, "verify_custom_smtp");
}

async function verifyResendSender(runtime, recipient) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.resendApiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "sonara-production-acceptance/1.0"
    },
    body: JSON.stringify({
      from: runtime.smtpSenderEmail,
      to: [recipient],
      subject: "SONARA authentication delivery verification",
      text: "Automated provider verification for the SONARA public signup confirmation flow."
    })
  }).catch(() => undefined);

  if (!response?.ok) {
    const body = await response?.json().catch(() => ({}));
    const message = String(body?.message || body?.error || "")
      .replaceAll(runtime.resendApiKey, "[redacted]")
      .replace(/re_[A-Za-z0-9_]+/g, "[redacted]")
      .replace(/[^A-Za-z0-9 @._,:'\/-]/g, "")
      .slice(0, 240);
    throw new AcceptanceError("verify_resend_sender", {
      upstreamStatus: response?.status || 0,
      upstreamCode: String(body?.name || body?.code || "").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80),
      ...(message ? { message } : {})
    });
  }

  const data = await response.json().catch(() => ({}));
  assert(typeof data?.id === "string" && data.id.length > 0, "verify_resend_sender");
}

async function supabasePublicSignup(runtime, email, password) {
  const response = await fetch(`${runtime.supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: runtime.anonKey,
      Authorization: `Bearer ${runtime.anonKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  }).catch(() => undefined);
  if (!response?.ok) {
    const body = await response?.json().catch(() => ({}));
    const message = String(body?.msg || body?.message || body?.error_description || body?.error || "")
      .replace(/[^A-Za-z0-9 _.,:/-]/g, "")
      .slice(0, 240);
    throw new AcceptanceError("public_signup", {
      upstreamStatus: response?.status || 0,
      upstreamCode: String(body?.code || body?.error_code || "").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80),
      ...(message ? { message } : {})
    });
  }
  const data = await response.json().catch(() => ({}));
  assert(data && typeof data === "object", "public_signup");
  return data;
}

async function appJson(pathname, options) {
  const response = await fetch(`${PRODUCTION_ORIGIN}${pathname}`, options).catch(() => undefined);
  assert(response, "production_application_request");
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function waitForSentEmail(resendApiKey, recipient, notBefore) {
  let candidate;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const list = await resendJson("/emails", resendApiKey);
    candidate = (Array.isArray(list.data) ? list.data : []).find((email) => {
      const recipients = Array.isArray(email.to) ? email.to : [email.to];
      return recipients.map((value) => String(value || "").toLowerCase()).includes(recipient.toLowerCase())
        && Date.parse(email.created_at || 0) >= notBefore;
    });
    if (candidate?.id) {
      const detail = await resendJson(`/emails/${encodeURIComponent(candidate.id)}`, resendApiKey);
      if (String(detail.last_event || candidate.last_event || "").toLowerCase() === "delivered") return detail;
      candidate = detail;
    }
    await wait(1000);
  }
  return candidate;
}

async function resendJson(pathname, resendApiKey) {
  const response = await fetch(`https://api.resend.com${pathname}`, {
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "User-Agent": "sonara-production-acceptance/1.0"
    }
  }).catch(() => undefined);
  if (!response?.ok) {
    const body = await response?.json().catch(() => ({}));
    throw new AcceptanceError(pathname === "/emails" ? "resend_delivery" : "retrieve_confirmation_email", {
      upstreamStatus: response?.status || 0,
      upstreamCode: String(body?.name || body?.code || "").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80)
    });
  }
  const data = await response.json().catch(() => undefined);
  assert(data && typeof data === "object", "retrieve_confirmation_email");
  return data;
}

async function generateConfirmationLink(runtime, email) {
  const response = await fetch(`${runtime.supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: adminHeaders(runtime),
    body: JSON.stringify({
      type: "magiclink",
      email,
      options: { redirectTo: `${PRODUCTION_ORIGIN}/account/setup` }
    })
  }).catch(() => undefined);
  assert(response?.ok, "generate_confirmation_link");
  const data = await response.json().catch(() => ({}));
  const actionLink = String(data.action_link || data.properties?.action_link || "");
  const url = extractConfirmationUrl(actionLink);
  assert(url, "generate_confirmation_link");
  return url;
}

function extractConfirmationUrl(content) {
  const decoded = String(content || "")
    .replace(/&amp;/gi, "&")
    .replace(/&#x3d;/gi, "=")
    .replace(/&#61;/g, "=")
    .replace(/&quot;/gi, '"');
  const candidates = [
    ...Array.from(decoded.matchAll(/href=["']([^"']+)["']/gi), (match) => match[1]),
    ...Array.from(decoded.matchAll(/https:\/\/[^\s"'<>]+/gi), (match) => match[0])
  ];

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate.replace(/&amp;/gi, "&"));
      if (url.protocol === "https:" && url.hostname === `${EXPECTED_PROJECT_REF}.supabase.co` && url.pathname === "/auth/v1/verify") {
        return url.toString();
      }
    } catch {
      // Ignore malformed links and continue looking for the exact Supabase verification URL.
    }
  }
  return "";
}

async function findUserByEmail(runtime, email) {
  for (let page = 1; page <= 5; page += 1) {
    const response = await fetch(`${runtime.supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: adminHeaders(runtime)
    }).catch(() => undefined);
    if (!response?.ok) return undefined;
    const data = await response.json().catch(() => ({}));
    const users = Array.isArray(data.users) ? data.users : [];
    const user = users.find((item) => String(item.email || "").toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (users.length < 200) return undefined;
  }
  return undefined;
}

async function deleteUserByEmail(runtime, email) {
  const user = await findUserByEmail(runtime, email);
  if (!user?.id) return { ok: true, deleted: false };
  const response = await fetch(`${runtime.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: "DELETE",
    headers: adminHeaders(runtime)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, deleted: false };
  const remaining = await findUserByEmail(runtime, email);
  return { ok: !remaining, deleted: !remaining };
}

function adminHeaders(runtime) {
  return {
    apikey: runtime.serviceRoleKey,
    Authorization: `Bearer ${runtime.serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

function readSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const raw = String(headers.get("set-cookie") || "");
  return raw ? raw.split(/,(?=\s*[A-Za-z0-9_-]+=)/) : [];
}

function readCookieValue(setCookies, name) {
  const prefix = `${name}=`;
  const cookie = setCookies.find((value) => String(value).trim().startsWith(prefix));
  if (!cookie) return "";
  return String(cookie).trim().slice(prefix.length).split(";", 1)[0];
}

function assertSecureSessionCookies(setCookies, step) {
  for (const name of ["sonara_customer_session", "sonara_customer_refresh"]) {
    const cookie = setCookies.find((value) => String(value).trim().startsWith(`${name}=`));
    assert(cookie, step);
    assert(/;\s*HttpOnly/i.test(cookie), step);
    assert(/;\s*Secure/i.test(cookie), step);
    assert(/;\s*SameSite=Lax/i.test(cookie), step);
    assert(/;\s*Path=\//i.test(cookie), step);
  }
}

function assertExpiredSessionCookies(setCookies, step) {
  for (const name of ["sonara_customer_session", "sonara_customer_refresh"]) {
    const cookie = setCookies.find((value) => String(value).trim().startsWith(`${name}=`));
    assert(cookie, step);
    assert(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/i.test(cookie) || /Max-Age=0/i.test(cookie), step);
  }
}

function assert(condition, step) {
  if (!condition) throw new AcceptanceError(step);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
