"use strict";

module.exports = function registerCustomerReadyExperienceRoutes(app, deps) {
  const {
    layout,
    actionCard,
    brandCard,
    linkAction,
    responsePage,
    escapeHtml,
    requireCustomer,
    handleEmailAuth,
    sendEmailAuthResult,
    wantsJson,
    getSupabaseAuthConfig,
    getSupabaseServerConfig,
    getPublicAppUrl,
    supabaseHeaders,
    insertActivityEvent,
    getCustomerPrimaryOrganization,
    setCustomerSessionCookies,
    verifySupabaseAccessToken,
    clearCustomerSessionCookie
  } = deps;

  app.get("/login", (req, res) => {
    const nextPath = safeNextPath(req.query?.next, "");
    return res.status(200).type("html").send(layout({
      title: "Login",
      eyebrow: "Welcome back",
      heading: "Continue your work.",
      body: "One secure sign-in opens every SONARA workspace, billing, support, and approved administration.",
      sections: [
        authForm({ label: "Log in", action: "/auth/login", nextPath, escapeHtml }),
        actionCard("Need a new password?", "We will send a secure recovery link to your email.", [linkAction("/forgot-password", "Reset password")])
      ],
      actions: [linkAction("/signup", "Create account"), linkAction("/support", "Get help"), linkAction("/", "Home")]
    }));
  });

  app.get("/signup", (req, res) => res.status(200).type("html").send(layout({
    title: "Create account",
    eyebrow: "Start free",
    heading: "Create one SONARA account.",
    body: "Use the same account for Business Builder, Creator Studio, and Growth Studio. Your private workspace is prepared automatically after sign-in.",
    sections: [authForm({ label: "Create account", action: "/auth/signup", signup: true, escapeHtml })],
    actions: [linkAction("/login", "Log in"), linkAction("/pricing", "Compare plans"), linkAction("/support", "Get help")]
  })));

  app.post("/auth/login", async (req, res) => {
    const result = await handleEmailAuth("login", req.body || {});
    const nextPath = safeNextPath(req.body?.next, "/dashboard");
    return sendEmailAuthResult(req, res, result, nextPath, "/login");
  });

  app.post("/auth/signup", async (req, res) => {
    const result = await handleEmailAuth("signup", req.body || {});
    if (result.session?.accessToken) setCustomerSessionCookies(res, result.session);
    if (result.session?.accessToken) {
      const verification = await verifySupabaseAccessToken(result.session.accessToken);
      if (verification.ok) await bootstrapWorkspace({ user: verification.user, config: getSupabaseServerConfig(), supabaseHeaders, insertActivityEvent });
    }
    return sendEmailAuthResult(req, res, result, "/dashboard", "/login");
  });

  app.get("/admin/login", (req, res) => res.redirect(303, "/login?next=%2Fadmin"));
  app.post("/admin/login", (req, res) => res.redirect(303, "/login?next=%2Fadmin"));
  app.get("/business-builder/login", (req, res) => res.redirect(303, "/login?next=%2Fbusiness-builder%2Fdashboard"));

  app.get("/forgot-password", (req, res) => res.status(200).type("html").send(layout({
    title: "Reset password",
    eyebrow: "Account recovery",
    heading: "Reset your password.",
    body: "Enter the email used for your SONARA account. We will send a secure recovery link.",
    sections: [passwordRecoveryForm()],
    actions: [linkAction("/login", "Back to login"), linkAction("/support", "Get help")]
  })));

  app.post("/auth/recover", async (req, res) => {
    const result = await requestPasswordRecovery({ req, getSupabaseAuthConfig, getPublicAppUrl });
    if (wantsJson(req)) return res.status(result.status).json(result.body);
    return res.status(result.status).type("html").send(responsePage(
      result.body.ok ? "Check your email" : "Recovery not started",
      result.body.message,
      [linkAction("/login", "Back to login"), linkAction("/support", "Get help")]
    ));
  });

  app.get("/account/update-password", (req, res) => res.status(200).type("html").send(layout({
    title: "Choose a new password",
    eyebrow: "Account recovery",
    heading: "Choose a new password.",
    body: "Open this page from the latest recovery email, then choose a password with at least eight characters.",
    sections: [passwordUpdateForm()],
    actions: [linkAction("/login", "Back to login"), linkAction("/support", "Get help")]
  })));

  app.post("/auth/update-password", async (req, res) => {
    const result = await updateRecoveredPassword({ body: req.body || {}, getSupabaseAuthConfig });
    if (wantsJson(req)) return res.status(result.status).json(result.body);
    return res.status(result.status).type("html").send(responsePage(
      result.body.ok ? "Password updated" : "Password not updated",
      result.body.message,
      [linkAction("/login", "Log in"), linkAction("/forgot-password", "Request another link")]
    ));
  });

  app.get("/account/setup", requireCustomer, async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser, { autoBootstrap: false });
    if (organization.ok) return res.redirect(303, "/account");
    return res.status(200).type("html").send(layout({
      title: "Prepare workspace",
      eyebrow: "One quick step",
      heading: "Name your workspace.",
      body: "Use your business, brand, project, or team name. You can change it later.",
      sections: [
        workspaceNameForm(),
        actionCard("Choose where to begin", "Start with the workspace that matches today’s goal. You can use all three from the same account.", [
          linkAction("/business-builder", "Build a business"),
          linkAction("/creator-studio", "Create and release"),
          linkAction("/growth-studio", "Reach customers")
        ]),
        '<details class="sonara-help-panel"><summary>Why name a workspace?</summary><p>Your workspace keeps projects, customer work, billing, and team access together. Most accounts are prepared automatically; this form is available when you want a custom name.</p></details>'
      ],
      actions: [linkAction("/dashboard", "My workspace"), linkAction("/support", "Get help")]
    }));
  });

  app.post("/account/setup/organization", requireCustomer, async (req, res) => {
    const name = String(req.body?.organizationName || req.body?.organization_name || "").trim();
    const productPath = normalizeProductPath(req.body?.productPath || req.body?.product_path);
    if (name.length < 2 || name.length > 120) {
      const message = "Enter a workspace name between 2 and 120 characters.";
      if (wantsJson(req)) return res.status(400).json({ ok: false, code: "validation_failed", message });
      return res.status(400).type("html").send(responsePage("Check the workspace name", message, [linkAction("/account/setup", "Return") ]));
    }
    const result = await bootstrapWorkspace({
      user: req.sonaraUser,
      organizationName: name,
      productPath,
      config: getSupabaseServerConfig(),
      supabaseHeaders,
      insertActivityEvent
    });
    if (!result.ok) {
      const message = "Your account is secure, but we could not finish preparing the workspace. Try again in a moment or contact support.";
      if (wantsJson(req)) return res.status(503).json({ ok: false, code: "workspace_temporarily_unavailable", message });
      return res.status(503).type("html").send(responsePage("Workspace not ready", message, [linkAction("/account/setup", "Try again"), linkAction("/support", "Get help") ]));
    }
    if (wantsJson(req)) return res.status(200).json({ ok: true, code: result.created ? "workspace_created" : "workspace_ready", organizationId: result.organizationId, nextPath: productPathToRoute(productPath) });
    return res.redirect(303, productPathToRoute(productPath));
  });

  app.get("/account", requireCustomer, async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization.ok) return res.redirect(303, "/account/setup");
    return res.status(200).type("html").send(layout({
      title: "Account",
      eyebrow: "Your SONARA account",
      heading: "One account. Three workspaces.",
      body: "Manage your work, plan, preferences, billing, and security without rebuilding your setup.",
      sections: [
        brandCard("Workspace ready", "Your private workspace is connected and ready to save work."),
        actionCard("Open a workspace", "Choose the job you want to complete now.", [
          linkAction("/business-builder/dashboard", "Business Builder"),
          linkAction("/creator-studio/dashboard", "Creator Studio"),
          linkAction("/growth-studio/dashboard", "Growth Studio")
        ]),
        actionCard("Account controls", "Review billing, experience preferences, and support from one place.", [
          linkAction("/billing", "Billing"),
          linkAction("/settings", "Preferences"),
          linkAction("/support", "Support")
        ])
      ],
      actions: [linkAction("/dashboard", "My workspace"), linkAction("/logout", "Log out")]
    }));
  });

  app.post("/logout", (req, res, next) => {
    clearCustomerSessionCookie(res);
    if (req.path === "/logout") return res.redirect(303, "/");
    return next();
  });

  app.use((req, res, next) => {
    if (!isCustomerFacingPath(req.path)) return next();
    const send = res.send.bind(res);
    res.send = (body) => {
      const contentType = String(res.getHeader("content-type") || "");
      if (typeof body === "string" && (contentType.includes("text/html") || body.trimStart().startsWith("<!doctype html"))) return send(sanitizeCustomerHtml(body));
      return send(body);
    };
    return next();
  });
};

function authForm({ label, action, signup = false, nextPath = "", escapeHtml }) {
  const passwordId = signup ? "signup-password" : "login-password";
  const confirmId = "signup-confirm-password";
  const nextField = nextPath ? `<input type="hidden" name="next" value="${escapeHtml(nextPath)}">` : "";
  return `<article class="card sonara-primary-card">
    <h2>${escapeHtml(label)}</h2>
    <form method="post" action="${escapeHtml(action)}">
      ${nextField}
      <label>Email<input name="email" type="email" autocomplete="${signup ? "email" : "username"}" required></label>
      <label>Password<input id="${passwordId}" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="8" required></label>
      <button type="button" data-toggle-password="${passwordId}" aria-controls="${passwordId}" aria-pressed="false">Show password</button>
      ${signup ? `<label>Confirm password<input id="${confirmId}" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label><button type="button" data-toggle-password="${confirmId}" aria-controls="${confirmId}" aria-pressed="false">Show password</button>` : ""}
      <button type="submit">${escapeHtml(label)}</button>
    </form>
  </article>`;
}

function passwordRecoveryForm() {
  return '<article class="card sonara-primary-card"><h2>Email recovery link</h2><form method="post" action="/auth/recover"><label>Email<input name="email" type="email" autocomplete="email" required></label><button type="submit">Send recovery link</button></form></article>';
}

function passwordUpdateForm() {
  return '<article class="card sonara-primary-card" data-sonara-recovery-form><h2>New password</h2><form method="post" action="/auth/update-password"><input type="hidden" name="accessToken" data-sonara-recovery-token><label>New password<input id="recovery-new-password" name="password" type="password" autocomplete="new-password" minlength="8" required></label><button type="button" data-toggle-password="recovery-new-password" aria-controls="recovery-new-password" aria-pressed="false">Show password</button><label>Confirm password<input id="recovery-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label><button type="button" data-toggle-password="recovery-confirm-password" aria-controls="recovery-confirm-password" aria-pressed="false">Show password</button><p class="fine" data-sonara-recovery-status>Open this page from the secure link in your email.</p><button type="submit">Update password</button></form></article>';
}

function workspaceNameForm() {
  return '<article class="card sonara-primary-card"><h2>Name your workspace</h2><form method="post" action="/account/setup/organization"><label>Workspace name<input name="organizationName" type="text" minlength="2" maxlength="120" autocomplete="organization" required></label><label>Start in<select name="productPath" required><option value="business-builder">Business Builder</option><option value="creator-studio">Creator Studio</option><option value="growth-studio">Growth Studio</option><option value="dashboard">All workspaces</option></select></label><button type="submit">Create workspace</button></form></article>';
}

async function requestPasswordRecovery({ req, getSupabaseAuthConfig, getPublicAppUrl }) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, body: { ok: false, message: "Enter a valid email address." } };
  const config = getSupabaseAuthConfig();
  if (!config.ok) return { status: 503, body: { ok: false, message: "Password recovery is temporarily unavailable. Contact support." } };
  const response = await fetch(`${config.url}/auth/v1/recover`, {
    method: "POST",
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, redirect_to: `${getPublicAppUrl(req)}/account/update-password` })
  }).catch(() => undefined);
  if (!response?.ok) return { status: 502, body: { ok: false, message: "We could not send the recovery email. Try again or contact support." } };
  return { status: 200, body: { ok: true, message: "If an account uses that email, a secure recovery link is on the way." } };
}

async function updateRecoveredPassword({ body, getSupabaseAuthConfig }) {
  const accessToken = String(body?.accessToken || body?.access_token || "").trim();
  const password = String(body?.password || "");
  const confirmation = String(body?.confirmPassword || body?.confirm_password || "");
  if (!accessToken) return { status: 400, body: { ok: false, message: "Open the latest recovery link from your email." } };
  if (password.length < 8) return { status: 400, body: { ok: false, message: "Use a password with at least 8 characters." } };
  if (password !== confirmation) return { status: 400, body: { ok: false, message: "The password confirmation does not match." } };
  const config = getSupabaseAuthConfig();
  if (!config.ok) return { status: 503, body: { ok: false, message: "Password recovery is temporarily unavailable." } };
  const response = await fetch(`${config.url}/auth/v1/user`, {
    method: "PUT",
    headers: { apikey: config.anonKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  }).catch(() => undefined);
  if (!response?.ok) return { status: 401, body: { ok: false, message: "This recovery link is invalid or expired. Request a new one." } };
  return { status: 200, body: { ok: true, message: "Your password was updated. You can log in now." } };
}

async function bootstrapWorkspace({ user, organizationName = null, productPath = "dashboard", config, supabaseHeaders, insertActivityEvent }) {
  if (!config?.ok || !user?.id) return { ok: false };
  const response = await fetch(`${config.url}/rest/v1/rpc/sonara_bootstrap_customer_workspace`, {
    method: "POST",
    headers: supabaseHeaders(config, { "content-type": "application/json" }),
    body: JSON.stringify({ p_user_id: user.id, p_email: user.email || null, p_organization_name: organizationName, p_product_path: normalizeProductPath(productPath) })
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const payload = await response.json().catch(() => ({}));
  const value = Array.isArray(payload) ? payload[0] : payload;
  const organizationId = value?.organization_id || value?.organizationId;
  if (!organizationId) return { ok: false };
  await insertActivityEvent(organizationId, user.id, value?.created === true ? "account.organization_created" : "account.organization_ready", { product_path: normalizeProductPath(productPath) });
  return { ok: true, organizationId, created: value?.created === true };
}

function normalizeProductPath(value) {
  return ["business-builder", "creator-studio", "growth-studio", "dashboard"].includes(String(value || "")) ? String(value) : "dashboard";
}

function productPathToRoute(value) {
  const productPath = normalizeProductPath(value);
  return productPath === "dashboard" ? "/dashboard" : `/${productPath}/dashboard`;
}

function safeNextPath(value, fallback = "/dashboard") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  try {
    const resolved = new URL(raw, "https://sonara.local");
    if (resolved.origin !== "https://sonara.local") return fallback;
    return `${resolved.pathname}${resolved.search}`;
  } catch {
    return fallback;
  }
}

function isCustomerFacingPath(pathname) {
  return /^(\/|\/(business-builder|creator-studio|growth-studio|account|dashboard|billing|settings|login|signup|forgot-password|pricing|free-tools|support|requests|deliverables|service-catalog))(\/|$)/.test(String(pathname || ""));
}

function sanitizeCustomerHtml(html) {
  return String(html)
    .replace(/profiles, organizations, and organization_memberships/gi, "account and workspace records")
    .replace(/organization_memberships|business_memberships|service_requests|service_deliverables|module_outputs/gi, "workspace records")
    .replace(/organization membership/gi, "workspace access")
    .replace(/account database/gi, "workspace")
    .replace(/server-side Supabase/gi, "secure account")
    .replace(/Supabase/gi, "secure account service")
    .replace(/service-role credentials?/gi, "protected credentials")
    .replace(/service-role/gi, "protected server")
    .replace(/environment variables?/gi, "secure configuration")
    .replace(/database migrations?/gi, "workspace updates")
    .replace(/\bRLS\b/g, "access controls")
    .replace(/Setup required:/gi, "Not ready yet:")
    .replace(/setup-required/gi, "not ready yet");
}
