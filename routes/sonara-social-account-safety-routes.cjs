// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Authenticated UGC profile reports and person-level blocks.
// Routes are registered but feature-disabled until SQL, reviewer staffing,
// release checks and approved canary are confirmed. A green policy decision
// is never a claim of live database or App Store compliance.

const safety = require("../lib/sonara-social-account-safety.cjs");
const REQUIRED = [
  "requireCustomer", "getEnv", "getSupabaseServerConfig",
  "supabaseHeaders", "createRateLimiter",
  "layout", "brandCard", "linkAction", "escapeHtml"
];

function registerSocialAccountSafetyRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (typeof deps[name] !== "function") throw new TypeError("social safety requires " + name);
  }
  const {
    requireCustomer, getEnv, getSupabaseServerConfig, supabaseHeaders,
    createRateLimiter, layout, brandCard, linkAction, escapeHtml
  } = deps;
  const active = () => safety.featureEnabled(getEnv);
  const limiter = createRateLimiter({
    name: "social_account_safety",
    windowSeconds: 3600, maxAttempts: 30,
    scopes: ["ip"],
    getSupabaseServerConfig
  });

  function fail(res, status, message) {
    return res.status(status).type("text/plain").send(message);
  }
  async function rpc(config, procedure, payload) {
    const response = await fetch(config.url + "/rest/v1/rpc/" + procedure, {
      method: "POST",
      headers: { ...supabaseHeaders(config), "Content-Type": "application/json",
        "Cache-Control": "no-store" },
      body: JSON.stringify(payload)
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false };
    const body = await response.json().catch(() => null);
    return body === null ? { ok: false } : { ok: true, value: body };
  }

  async function act(req, res, action) {
    if (!active()) return fail(res, 503, "These controls are not available yet.");
    if (!safety.sameOrigin(req, getEnv)) return fail(res, 403, "This action needs a verified same-origin request.");
    const input = safety.actionInput({
      action, actorId: req.sonaraUser?.id, profileId: req.params.id, body: req.body
    });
    if (!input.ok) return fail(res, 400, "Check the profile, reason and report details.");
    const config = getSupabaseServerConfig();
    if (!config?.ok) return fail(res, 503, "Your request cannot be saved right now.");
    const result = await rpc(config, "sonara_social_profile_action", {
      p_actor_user_id: input.actorId, p_profile_id: input.profileId,
      p_action: action,
      p_reason: action === "report" ? input.reason : null,
      p_detail: action === "report" ? input.detail : null,
      p_request_id: action === "report" ? input.requestId : null
    });
    if (!result.ok) return fail(res, 503, "Your request cannot be saved right now.");
    if (result.value === "rate_limited") return fail(res, 429, "Too many requests. Try again later.");
    if (!["blocked", "unblocked", "reported", "already_reported"].includes(result.value)) {
      // Do not reveal whether the creator is unpublished, already moderated or
      // has blocked this viewer.
      return fail(res, 404, "This action is not available for that profile.");
    }
    res.setHeader("Cache-Control", "private, no-store");
    return res.redirect(303,
      "/account/social-safety?done=" + encodeURIComponent(
        action === "report" ? "reported" : action === "block" ? "blocked" : "unblocked"));
  }

  app.post("/api/social/creator-profiles/:id/block", requireCustomer, limiter,
    (req, res) => act(req, res, "block"));
  app.post("/api/social/creator-profiles/:id/unblock", requireCustomer, limiter,
    (req, res) => act(req, res, "unblock"));
  app.post("/api/social/creator-profiles/:id/report", requireCustomer, limiter,
    (req, res) => act(req, res, "report"));

  app.post("/api/social/blocked-users/:id/unblock", requireCustomer, limiter,
    async (req, res) => {
      if (!active()) return fail(res, 503, "These controls are not available yet.");
      if (!safety.sameOrigin(req, getEnv)) return fail(res, 403, "This action needs a verified same-origin request.");
      if (!safety.isUuid(req.sonaraUser?.id) || !safety.isUuid(req.params.id) ||
          req.sonaraUser.id.toLowerCase() === req.params.id.toLowerCase()) {
        return fail(res, 400, "Invalid account.");
      }
      const config = getSupabaseServerConfig();
      if (!config?.ok) return fail(res, 503, "Your request cannot be saved right now.");
      const result = await rpc(config, "sonara_unblock_social_user", {
        p_actor_user_id: req.sonaraUser.id, p_target_user_id: req.params.id
      });
      if (!result.ok || result.value !== true) return fail(res, 503, "Your request cannot be saved right now.");
      res.setHeader("Cache-Control", "private, no-store");
      return res.redirect(303, "/account/social-safety?done=unblocked");
    });

  app.get("/account/social-safety", requireCustomer, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const back = [linkAction("/account", "Your account"), linkAction("/support", "Get help")];
    if (!active()) return res.status(200).type("html").send(layout({
      title: "Social safety", eyebrow: "Your account", heading: "Social safety",
      body: "User blocking and reporting are not active yet. Existing public channel reporting remains separate.",
      sections: [], actions: back
    }));
    if (!safety.isUuid(req.sonaraUser?.id)) return fail(res, 401, "Sign in required.");
    const config = getSupabaseServerConfig();
    if (!config?.ok) return fail(res, 503, "Cannot load your safety settings.");
    const response = await rpc(config, "sonara_my_social_blocks", { p_actor_user_id: req.sonaraUser.id });
    const blocks = response.value;
    if (!response.ok || !Array.isArray(blocks) || blocks.length > 200 ||
      blocks.some((block) => !safety.isUuid(block?.blocked_user_id) ||
        (block.handle !== null && block.handle !== undefined && typeof block.handle !== "string") ||
        (block.name !== null && block.name !== undefined && typeof block.name !== "string"))) {
      return fail(res, 503, "Cannot verify your blocked users right now. Your settings were not changed.");
    }
    const entries = blocks.map((block) => {
      const label = escapeHtml((block.name && block.name.slice(0, 120)) ||
        (block.handle && "@" + block.handle.slice(0, 32)) || "Previously blocked user");
      const path = "/api/social/blocked-users/" + encodeURIComponent(block.blocked_user_id) + "/unblock";
      return '<li>' + label + ' <form method="post" action="' + escapeHtml(path) +
        '"><button type="submit">Unblock</button></form></li>';
    });
    const feedback = {
      reported: "Your report was saved for review. Reporting does not automatically remove content.",
      blocked: "The user was blocked on SONARA.",
      unblocked: "The user was unblocked."
    };
    const message = feedback[req.query?.done] || "Choose who may interact with you.";
    return res.status(200).type("html").send(layout({
      title: "Social safety", eyebrow: "Your account", heading: "Social safety",
      body: message,
      sections: [brandCard("Blocked users", entries.length
        ? "<ul>" + entries.join("") + "</ul>"
        : "You have no saved user blocks.")],
      actions: back
    }));
  });
}
module.exports = registerSocialAccountSafetyRoutes;
