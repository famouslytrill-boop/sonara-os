"use strict";

// Letting a person turn notifications on.
//
// Three pieces existed and nothing joined them: `lib/sonara-web-push.cjs` could
// encrypt and send, `lib/sonara-push-subscriptions.cjs` could store and select,
// and `public/sw.js` could receive. No page called any of them, which makes the
// set of three exactly the defect this codebase keeps finding -- a capability
// that is present, tested, and unreachable.
//
// ## Permission is asked for by the browser, never by us
//
// `Notification.requestPermission()` is the browser's own prompt and it can only
// be triggered by a real click. That constraint is a feature: it means this
// application cannot turn notifications on for somebody, only offer to. A page
// that asked on load would be denied by the browser and would also burn the
// permission -- most browsers refuse for ever after a dismissal, so a badly
// timed prompt costs the capability permanently rather than costing one visit.
//
// So the page explains first and the button asks second, and `AGENTS.md` is
// satisfied by construction rather than by discipline: *"Sounds, voice
// announcements, haptics, SMS, push, and email alerts must be off or explicitly
// user-controlled by default."*
//
// ## Why the topics are checkboxes and not a single switch
//
// One on/off makes "tell me when an invoice is paid" and "tell me about
// anything" the same permission, and only one of those is what most people
// meant. The store already refuses to send to a subscription with no topics;
// this is the surface where somebody chooses them.

const push = require("../lib/sonara-web-push.cjs");
const store = require("../lib/sonara-push-subscriptions.cjs");

const REQUIRED = [
  "layout", "brandCard", "escapeHtml",
  "requireCustomer", "getCustomerPrimaryOrganization", "getSupabaseServerConfig", "supabaseHeaders", "getEnv"
];

const PAGE = "/account/notifications";

// What each topic is called on screen. A key with no label here would render as
// a raw identifier, so the two lists are asserted equal in the tests rather
// than assumed to stay in step.
const TOPIC_LABELS = Object.freeze({
  invoice_paid: "An invoice is paid",
  booking_made: "Somebody books an appointment",
  booking_reminder: "A booking is coming up",
  quote_accepted: "A quote is accepted",
  payment_failed: "A payment fails",
  job_finished: "A job is marked finished"
});

module.exports = function registerNotificationRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (typeof deps[name] !== "function") throw new TypeError(`registerNotificationRoutes requires ${name}`);
  }
  const {
    layout, brandCard, escapeHtml,
    requireCustomer, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders, getEnv
  } = deps;

  function moduleDeps() {
    const config = getSupabaseServerConfig();
    if (!config?.url) return null;
    return { getEnv, supabaseUrl: config.url, serviceRoleHeaders: () => supabaseHeaders(config) };
  }

  // Takes the *user* and answers `{ ok, organizationId }`. Passing `req` here
  // filters on `organization_id=eq.[object Object]`, which returns no rows and
  // looks exactly like a working boundary.
  async function organizationFor(req) {
    const user = req.sonaraUser || req.sonaraAccess?.user || null;
    const organization = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!organization?.ok || !organization.organizationId) return null;
    return organization.organizationId;
  }

  // `actions` is not optional: lib/sonara-page-frame.cjs joins it
  // unconditionally, so omitting it throws before a byte is written and every
  // request 500s. Learned on the connected-payments page, where the crawl found
  // it rather than a reader.
  function shell(sections) {
    return layout({
      title: "Notifications",
      eyebrow: "Your account",
      heading: "Notifications",
      body: "",
      sections,
      actions: []
    });
  }

  function explainer() {
    return brandCard(
      "How this works, and what it costs you",
      "Notifications go through your browser's own notification service. There is no charge for them, no phone number involved, and no text message. " +
      "They reach this browser only — if you use the site on a phone and a laptop, each one asks separately. " +
      "Your browser asks the permission question, not us, and you can withdraw it at any time in your browser's site settings without telling us."
    );
  }

  app.get(PAGE, requireCustomer, async (req, res) => {
    const sections = [explainer()];
    const mod = moduleDeps();

    if (!mod) {
      sections.push(brandCard("Not configured", "This workspace has no database connection configured, so notification settings cannot be read."));
      return res.status(503).type("html").send(shell(sections));
    }

    const readiness = push.pushReadiness(mod);
    if (!readiness.ok) {
      // 200, not an error status. Nothing is broken: an owner has not finished
      // a setup step, and a 5xx would tell a customer their account is faulty.
      sections.push(brandCard(
        "Not available yet",
        `${escapeHtml(readiness.detail)} This is a setup step for whoever runs this platform, not something you have done wrong.`
      ));
      return res.status(200).type("html").send(shell(sections));
    }

    const organizationId = await organizationFor(req);
    if (!organizationId) {
      sections.push(brandCard("No workspace", "This sign-in is not attached to a workspace yet, so there is nothing to be notified about."));
      return res.status(200).type("html").send(shell(sections));
    }

    const checkboxes = store.TOPICS.map((topic) => {
      const label = TOPIC_LABELS[topic] || topic;
      return `<label class="choice"><input type="checkbox" name="topic" value="${escapeHtml(topic)}" checked> ${escapeHtml(label)}</label>`;
    }).join("");

    // The public key reaches the browser deliberately -- a subscription cannot
    // be created without it, and it is the public half of the pair. The private
    // key is read only by lib/sonara-web-push.cjs, server-side.
    sections.push(
      brandCard("Choose what is worth interrupting you for", "Everything is ticked to begin with. Untick anything you would rather not hear about; a subscription with nothing ticked receives nothing at all."),
      `<article class="card sonara-depth">
        <form id="sonara-push-form">
          <div class="sonara-push-topics">${checkboxes}</div>
          <button class="action" type="submit" data-sonara-push-subscribe>Turn on notifications for this browser</button>
          <p class="sonara-push-status" data-sonara-push-status role="status"></p>
        </form>
      </article>`,
      `<script type="application/json" id="sonara-push-config">${JSON.stringify({ publicKey: readiness.publicKey, endpoint: `${PAGE}/subscribe` })}</script>`,
      // A separate file, because the Content-Security-Policy here is
      // `script-src 'self'` with no bundler and no inline script.
      `<script src="/sonara-push.js" defer></script>`
    );

    return res.status(200).type("html").send(shell(sections));
  });

  app.post(`${PAGE}/subscribe`, requireCustomer, async (req, res) => {
    const mod = moduleDeps();
    if (!mod) return res.status(503).json({ ok: false, code: "not_configured" });

    const organizationId = await organizationFor(req);
    if (!organizationId) return res.status(400).json({ ok: false, code: "no_organization" });

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const subscription = body.subscription && typeof body.subscription === "object" ? body.subscription : {};
    const keys = subscription.keys && typeof subscription.keys === "object" ? subscription.keys : {};

    const saved = await store.save(mod, {
      organizationId,
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      topics: Array.isArray(body.topics) ? body.topics : [],
      // The browser's own description of itself, for a settings page that has
      // to tell one device from another. Never parsed, never trusted.
      label: req.get("user-agent") || null,
      createdBy: req.sonaraUser?.id || null
    });

    if (!saved.ok) {
      // 400 for a malformed subscription, 500 for our own failure. A browser
      // retrying a bad subscription forever is what one status for both causes.
      const clientFault = ["bad_endpoint", "bad_key", "bad_auth", "no_organization"].includes(saved.code);
      return res.status(clientFault ? 400 : 500).json({ ok: false, code: saved.code });
    }
    // The stored topics are echoed rather than the requested ones: unknown
    // topics are filtered out, and a page that showed what was asked for would
    // claim a subscription this application will not honour.
    return res.status(200).json({ ok: true, topics: saved.topics });
  });

  app.post(`${PAGE}/unsubscribe`, requireCustomer, async (req, res) => {
    const mod = moduleDeps();
    if (!mod) return res.status(503).json({ ok: false, code: "not_configured" });
    const endpoint = req.body && typeof req.body === "object" ? req.body.endpoint : null;
    if (!endpoint) return res.status(400).json({ ok: false, code: "no_endpoint" });
    const removed = await store.remove(mod, endpoint);
    if (!removed.ok) return res.status(500).json({ ok: false, code: removed.code });
    return res.status(200).json({ ok: true });
  });

  return { PAGE };
};

module.exports.REQUIRED = REQUIRED;
module.exports.PAGE = PAGE;
module.exports.TOPIC_LABELS = TOPIC_LABELS;
