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
    windowSeconds: 3600, maxAttempts: 600,
    scopes: ["ip"],
    getSupabaseServerConfig
  });

  function fail(res, status, message) {
    return res.status(status).type("text/plain").send(message);
  }
  // These are reviewed, server-only SECURITY INVOKER procedures, not
  // arbitrary REST table reads. Never allow a caller to supply an RPC name.
  const PROCEDURES = new Set([
    "sonara_social_profile_action",
    "sonara_unblock_social_user",
    "sonara_social_moderation_queue",
    "sonara_social_decide_report",
    "sonara_my_social_blocks"
  ]);
  async function rpc({ config, procedure, payload }) {
    if (!PROCEDURES.has(procedure)) return { ok: false };
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
    const result = await rpc({ config, procedure: "sonara_social_profile_action", payload: {
      p_actor_user_id: input.actorId, p_profile_id: input.profileId,
      p_action: action,
      p_reason: action === "report" ? input.reason : null,
      p_detail: action === "report" ? input.detail : null,
      p_request_id: action === "report" ? input.requestId : null
    } });
    if (!result.ok) return fail(res, 503, "Your request cannot be saved right now.");
    if (result.value === "rate_limited") return fail(res, 429, "Too many requests. Try again later.");
    if (result.value === "idempotency_conflict") {
      return fail(res, 409, "This report request identifier was already used for a different submission.");
    }
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
      const result = await rpc({ config, procedure: "sonara_unblock_social_user", payload: {
        p_actor_user_id: req.sonaraUser.id, p_target_user_id: req.params.id
      } });
      if (!result.ok || result.value !== true) return fail(res, 503, "Your request cannot be saved right now.");
      res.setHeader("Cache-Control", "private, no-store");
      return res.redirect(303, "/account/social-safety?done=unblocked");
    });


  // Cross-tenant reports are NOT business-owner records. Only a separate
  // platform-moderator roster can authorize this privileged database RPC.
  app.get("/owner/social-moderation", requireCustomer, async (req, res) => {
    if (!active()) {
      // An unfinished reviewer tool is not a server outage. Render a readable
      // explanation without querying the unpublished moderator roster.
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(200).type("html").send(layout({
        title: "Platform moderation", eyebrow: "SONARA Trust & Safety",
        heading: "Platform moderation",
        body: "Platform moderation is not active yet. Reports and staff review are not available here.",
        sections: [], actions: [linkAction("/account/social-safety", "Your safety settings")]
      }));
    }
    if (!safety.isUuid(req.sonaraUser?.id)) return fail(res, 401, "Sign in required.");
    res.setHeader("Cache-Control", "private, no-store");
    const config = getSupabaseServerConfig();
    if (!config?.ok) return fail(res, 503, "Moderation queue unavailable.");
    const result = await rpc({ config, procedure: "sonara_social_moderation_queue", payload: {
      p_reviewer_user_id: req.sonaraUser.id, p_limit: 40
    } });
    if (!result.ok) return fail(res, 503, "Moderation queue unavailable.");
    if (result.value?.authorized !== true) return fail(res, 403, "Moderator access required.");
    const reports = result.value.reports;
    if (!Array.isArray(reports) || reports.length > 40 ||
      reports.some((r) => !safety.isUuid(r?.id) || !safety.isUuid(r?.profile_id) ||
        !safety.REASONS.includes(r.reason) ||
        !["open", "under_review", "escalated"].includes(r.state) ||
        (r.detail !== null && r.detail !== undefined && typeof r.detail !== "string"))) {
      return fail(res, 503, "Moderation queue is unreadable.");
    }
    const sections = reports.map((item) => {
      const uri = "/api/social/moderation/reports/" + encodeURIComponent(item.id) + "/decision";
      const label = escapeHtml(item.reason) + " / " + escapeHtml(item.state);
      const note = escapeHtml(String(item.detail || "").slice(0, 500));
      const body = '<p>Report ID: ' + escapeHtml(item.id) +
        ' | Profile ID: ' + escapeHtml(item.profile_id) +
        '</p><p>' + note + '</p>' +
        '<form method="post" action="' + escapeHtml(uri) + '">' +
        '<label for="decision-' + escapeHtml(item.id) + '">Decision</label>' +
        '<select id="decision-' + escapeHtml(item.id) + '" name="decision" required>' +
        '<option value="escalate">Escalate for further review</option>' +
        '<option value="dismiss">Dismiss after review</option>' +
        (item.state === "escalated" ? '<option value="reopen">Reopen</option>' : '') +
        '</select>' +
        '<label for="explanation-' + escapeHtml(item.id) + '">Reason for the decision</label>' +
        '<textarea id="explanation-' + escapeHtml(item.id) +
        '" name="explanation" maxlength="500" rows="3" required></textarea>' +
        '<button type="submit">Record reviewed decision</button></form>';
      return brandCard(label, body);
    });
    return res.status(200).type("html").send(layout({
      title: "Platform moderation",
      eyebrow: "SONARA Trust & Safety",
      heading: "Platform moderation",
      body: "Independent reviewer queue. Decisions are audited. Reports never automatically ban anyone.",
      sections: sections.length ? sections : [brandCard("Review queue", "No open reports in this result.")],
      actions: [linkAction("/account/social-safety", "Personal safety settings")]
    }));
  });

  app.post("/api/social/moderation/reports/:id/decision", requireCustomer, limiter,
    async (req, res) => {
      if (!active()) return fail(res, 503, "Platform moderation is not active yet.");
      if (!safety.sameOrigin(req, getEnv)) return fail(res, 403, "This action needs a verified same-origin request.");
      if (!safety.isUuid(req.sonaraUser?.id) || !safety.isUuid(req.params?.id)) {
        return fail(res, 400, "Invalid report or reviewer.");
      }
      const action = req.body?.decision;
      const explanation = typeof req.body?.explanation === "string"
        ? req.body.explanation.trim() : "";
      if (!["dismiss", "escalate", "reopen"].includes(action) ||
        !explanation || explanation.length > 500 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(explanation)) {
        return fail(res, 400, "Choose a decision and explain why.");
      }
      const config = getSupabaseServerConfig();
      if (!config?.ok) return fail(res, 503, "Moderation decision cannot be saved.");
      const result = await rpc({ config, procedure: "sonara_social_decide_report", payload: {
        p_reviewer_user_id: req.sonaraUser.id,
        p_report_id: req.params.id,
        p_decision: action, p_explanation: explanation
      } });
      if (!result.ok) return fail(res, 503, "Moderation decision cannot be saved.");
      if (!["reviewed", "already_done"].includes(result.value)) {
        return fail(res, 403, "Moderation decision not authorized.");
      }
      res.setHeader("Cache-Control", "private, no-store");
      return res.redirect(303, "/owner/social-moderation");
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
    const response = await rpc({ config, procedure: "sonara_my_social_blocks", payload: { p_actor_user_id: req.sonaraUser.id } });
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
