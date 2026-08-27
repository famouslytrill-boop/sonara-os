"use strict";

// Calling a customer from their record, browser to browser.
//
// The audio never touches this application. Two browsers exchange a session
// description and a handful of network candidates through the rows in
// `call_sessions` and `call_signals`, and from the moment they connect they are
// talking directly to each other -- which is what makes the call cost nothing
// however long it lasts. `docs/architecture/2026-08-26-ZERO-MARGIN-COMMS.md`
// has the numbers behind that.
//
// ## Two sides, one set of endpoints, and how each is authenticated
//
// The business side is a signed-in member of the organization the call belongs
// to. The customer side is a person with a link, and nothing else: requiring an
// account before somebody can answer their builder's call is a product nobody
// would use.
//
// So `resolveCall` authenticates both against the same endpoints and returns
// which side is asking. **The role is derived, never accepted.** A body field
// naming the role would let the customer read the customer's own signals back,
// or worse, post as the business.
//
// ## Why polling, and why that is not a fudge
//
// The obvious signalling channel is a WebSocket. This runs as a Vercel
// serverless function; there is no process to hold one open. Polling costs a
// few small requests while the call is being set up and **nothing once it
// connects**, because after that the browsers do not need us.
//
// ## What this deliberately does not do
//
// No recording, no transcript, no duration billing. The media is not here to
// record, and a schema or an endpoint with room for it would be an invitation
// to route audio through this application later. Recording a call is also a
// consent decision in most places this product is used, which AGENTS.md puts
// behind owner review rather than behind a default.

const signalling = require("../lib/sonara-call-signalling.cjs");
const store = require("../lib/sonara-call-sessions.cjs");

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml",
  "requireCustomer", "getCustomerPrimaryOrganization", "getSupabaseServerConfig", "supabaseHeaders", "getEnv"
];

const CUSTOMER_PAGE = "/call";
const BUSINESS_PAGE = "/business-builder/owner/customers";

// A sentence per refusal, for a page rather than a log. A code with nothing
// beside it tells somebody their call failed and not what to do next.
const EXPLAIN = Object.freeze({
  setup_required: "Calling is not set up on this deployment yet. This is an owner step, not something you have done wrong.",
  misconfigured: "Calling is configured incorrectly on this deployment, so no call can be placed.",
  no_organization: "This sign-in is not attached to a workspace yet.",
  no_such_call: "This call link is not one we recognise.",
  link_expired: "This call link has expired. Ask for a new one.",
  call_over: "This call has already ended.",
  no_expiry: "We could not read when this link stops working, so it will not be opened.",
  unknown_status: "This call is in a state we do not recognise, so it will not be opened.",
  unreadable: "We could not read this call. That says nothing about whether it is still going — only that we could not check.",
  unwritable: "That could not be saved, so the other side will not have heard it.",
  payload_too_large: "The browser sent more than a call setup message should contain.",
  unknown_kind: "The browser sent something this is not part of a call.",
  unknown_role: "We could not work out which end of the call this is."
});

function explain(code) {
  return EXPLAIN[code] || "Something went wrong and the call was not placed.";
}

// One call, as a sentence. Deliberately never says "connected" for a call whose
// connected_at is null: the column is what distinguishes a call that happened
// from a link nobody opened, and a status word without it would be guessing.
function describeCall(row) {
  const when = row.created_at ? String(row.created_at).replace("T", " ").slice(0, 16) : "at an unrecorded time";
  if (row.status === "connected" || row.connected_at) return `Answered, ${when}`;
  if (row.status === "ringing") return `Placed ${when}, still open`;
  if (row.status === "ended") return `Placed ${when}, ended without connecting`;
  return `Placed ${when}, not answered`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

module.exports = function registerCallRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (typeof deps[name] !== "function") throw new TypeError(`registerCallRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireCustomer, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders, getEnv
  } = deps;

  // Built per request rather than once: getSupabaseServerConfig reads the
  // environment, and a value captured at module load is the value at cold start.
  function storeDeps() {
    const config = getSupabaseServerConfig();
    if (!config?.url) return null;
    return { getEnv, supabaseUrl: config.url, serviceRoleHeaders: () => supabaseHeaders(config) };
  }

  // Takes the *user*, not the request. Passing `req` and using the answer as a
  // string filters on `organization_id=eq.[object Object]`, which returns no
  // rows and looks exactly like a working boundary.
  async function organizationFor(req) {
    const user = req.sonaraUser || req.sonaraAccess?.user || null;
    if (!user) return null;
    const organization = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!organization?.ok || !organization.organizationId) return null;
    return organization.organizationId;
  }

  /**
   * Whether this customer record is one of ours.
   *
   * Three answers rather than two: it is ours, it is not, or the read did not
   * happen. The third must never be reported as the second -- refusing a call
   * because the database was briefly unreachable and refusing it because
   * somebody guessed an id are different things, and only one of them is the
   * caller's fault.
   */
  async function customerBelongsHere(dependencies, organizationId, customerId) {
    let response;
    try {
      response = await fetch(
        `${dependencies.supabaseUrl}/rest/v1/customers?select=id&id=eq.${encodeURIComponent(customerId)}` +
          `&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`,
        { headers: dependencies.serviceRoleHeaders() }
      );
    } catch {
      return { ok: false, belongs: false };
    }
    if (!response?.ok) return { ok: false, belongs: false };
    let rows;
    try {
      rows = await response.json();
    } catch {
      return { ok: false, belongs: false };
    }
    return { ok: true, belongs: Array.isArray(rows) && rows.length > 0 };
  }

  /**
   * Which end of which call is asking.
   *
   * The token path is tried first and on its own terms: a request carrying a
   * join token is the customer's browser, whether or not somebody happens to be
   * signed in on that device. Deciding by session first would make a business
   * owner testing their own call link the business end of it, and then nothing
   * would ever be delivered to the customer end.
   */
  async function resolveCall(req) {
    const dependencies = storeDeps();
    if (!dependencies) return { ok: false, code: "setup_required" };

    const token = String(req.body?.token || req.query?.token || "");
    if (token) {
      const found = await store.byToken(dependencies, token);
      if (!found.ok) return { ok: false, code: found.code };
      return { ok: true, deps: dependencies, call: found.call, role: "customer" };
    }

    const organizationId = await organizationFor(req);
    if (!organizationId) return { ok: false, code: "no_organization" };
    const callId = String(req.params?.callId || "");
    if (!isUuid(callId)) return { ok: false, code: "no_such_call" };
    const found = await store.byId(dependencies, { organizationId, callId });
    if (!found.ok) return { ok: false, code: found.code };
    return { ok: true, deps: dependencies, call: found.call, role: "business" };
  }

  // A call the customer's side may not read is refused before the route body
  // runs, so no handler has to remember the expiry rule.
  function refuseUnjoinable(call) {
    const open = signalling.joinable(call);
    return open.ok ? null : open.code;
  }

  // ---------------------------------------------------------------------------
  // Placing a call.
  // ---------------------------------------------------------------------------

  app.post("/api/calls", requireCustomer, async (req, res) => {
    const readiness = signalling.callReadiness({ getEnv });
    // Refused before a row is written. A call row with no way to connect is a
    // link somebody sends a customer that can never work, and the customer is
    // the person who finds out.
    if (!readiness.ok) return res.status(503).json({ ok: false, code: readiness.status, detail: readiness.detail });

    const dependencies = storeDeps();
    if (!dependencies) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });

    const organizationId = await organizationFor(req);
    if (!organizationId) return res.status(403).json({ ok: false, code: "no_organization" });

    const customerId = String(req.body?.customer_id || "");
    if (customerId && !isUuid(customerId)) return res.status(400).json({ ok: false, code: "no_such_customer" });

    // Scoped by organization as well as by id, for the reason every reference
    // check in this codebase is: the service key bypasses row level security, so
    // a guessed id from another business would otherwise attach this call to
    // their customer.
    //
    // The first version of this asked `store.forCustomer`, which reads
    // call_sessions -- so it looked up previous CALLS against that id and
    // proved nothing about whether the customer exists or is ours. It passed on
    // an empty list, which is what an id from another business returns. A check
    // measuring a different population from the one it names, in the one place
    // here where that means writing a call against somebody else's record.
    if (customerId) {
      const owned = await customerBelongsHere(dependencies, organizationId, customerId);
      if (!owned.ok) return res.status(502).json({ ok: false, code: "unreadable", detail: explain("unreadable") });
      if (!owned.belongs) return res.status(403).json({ ok: false, code: "no_such_customer" });
    }

    const placed = await store.place(dependencies, {
      organizationId,
      customerId: customerId || null,
      createdBy: (req.sonaraUser || req.sonaraAccess?.user || {}).id || null
    });
    if (!placed.ok) return res.status(502).json({ ok: false, code: placed.code, detail: explain(placed.code) });

    return res.status(200).json({
      ok: true,
      callId: placed.call.id,
      // The link the business sends. Built here rather than in the browser so
      // there is one answer to what a join link looks like.
      joinUrl: `${CUSTOMER_PAGE}/${placed.call.join_token}`,
      expiresAt: placed.call.expires_at,
      iceServers: readiness.iceServers,
      relay: readiness.relay
    });
  });

  // ---------------------------------------------------------------------------
  // The signalling exchange.
  // ---------------------------------------------------------------------------

  app.get("/api/calls/:callId/signals", async (req, res) => {
    const resolved = await resolveCall(req);
    if (!resolved.ok) return res.status(resolved.code === "setup_required" ? 503 : 403).json({ ok: false, code: resolved.code, detail: explain(resolved.code) });
    // The id in the path has to be the call the token names. Without this a
    // valid token would read any call's signals by changing the path.
    if (String(req.params.callId) !== String(resolved.call.id)) {
      return res.status(403).json({ ok: false, code: "no_such_call" });
    }
    const stop = refuseUnjoinable(resolved.call);
    if (stop) return res.status(410).json({ ok: false, code: stop, detail: explain(stop) });

    const found = await store.signalsFor(resolved.deps, {
      callId: resolved.call.id,
      organizationId: resolved.call.organization_id,
      role: resolved.role,
      after: req.query.after || null
    });
    // Reported as a failed read, never as an empty list. A person watching a
    // spinner deserves to know the difference.
    if (!found.ok) return res.status(502).json({ ok: false, code: found.code, detail: explain(found.code) });

    return res.status(200).json({
      ok: true,
      status: resolved.call.status,
      role: resolved.role,
      signals: found.rows,
      // The cursor for the next poll, taken from the last row rather than from
      // this server's clock: the rows are timestamped by the database, and two
      // clocks would eventually skip a candidate.
      cursor: found.rows.length ? found.rows[found.rows.length - 1].created_at : (req.query.after || null)
    });
  });

  app.post("/api/calls/:callId/signals", async (req, res) => {
    const resolved = await resolveCall(req);
    if (!resolved.ok) return res.status(resolved.code === "setup_required" ? 503 : 403).json({ ok: false, code: resolved.code, detail: explain(resolved.code) });
    if (String(req.params.callId) !== String(resolved.call.id)) {
      return res.status(403).json({ ok: false, code: "no_such_call" });
    }
    const stop = refuseUnjoinable(resolved.call);
    if (stop) return res.status(410).json({ ok: false, code: stop, detail: explain(stop) });

    const added = await store.addSignal(resolved.deps, {
      callId: resolved.call.id,
      organizationId: resolved.call.organization_id,
      // Derived by resolveCall. Never read from the body -- that is the field
      // that would let one end post as the other.
      role: resolved.role,
      kind: String(req.body?.kind || ""),
      payload: req.body?.payload
    });
    if (!added.ok) {
      const status = ["unknown_kind", "payload_too_large", "payload_not_an_object", "payload_unreadable"].includes(added.code) ? 400 : 502;
      return res.status(status).json({ ok: false, code: added.code, detail: added.detail || explain(added.code) });
    }
    return res.status(200).json({ ok: true });
  });

  app.post("/api/calls/:callId/status", async (req, res) => {
    const resolved = await resolveCall(req);
    if (!resolved.ok) return res.status(resolved.code === "setup_required" ? 503 : 403).json({ ok: false, code: resolved.code, detail: explain(resolved.code) });
    if (String(req.params.callId) !== String(resolved.call.id)) {
      return res.status(403).json({ ok: false, code: "no_such_call" });
    }

    const wanted = String(req.body?.status || "");
    // Only the two either end may legitimately declare. 'ringing' is where a
    // call starts and 'missed' is the owner's judgement about a call nobody
    // answered -- neither is something a browser gets to assert.
    if (!["connected", "ended"].includes(wanted)) {
      return res.status(400).json({ ok: false, code: "unknown_status", detail: "A call may be marked connected or ended." });
    }
    // Deliberately allowed on a call the expiry has passed. Hanging up is the
    // one thing that must still work when everything else about the call has
    // stopped -- refusing it would leave rows that say 'ringing' for ever.
    const moved = await store.setStatus(resolved.deps, {
      callId: resolved.call.id,
      organizationId: resolved.call.organization_id,
      status: wanted,
      reason: req.body?.reason || null
    });
    if (!moved.ok) return res.status(502).json({ ok: false, code: moved.code, detail: explain(moved.code) });
    return res.status(200).json({ ok: true, status: wanted });
  });

  // ---------------------------------------------------------------------------
  // The two pages.
  // ---------------------------------------------------------------------------

  function callShell({ title, heading, eyebrow, sections, actions = [] }) {
    return layout({ title, eyebrow, heading, body: "", sections, actions });
  }

  // Configuration as JSON in a script tag rather than a global set inline: the
  // Content-Security-Policy is `script-src 'self'`, and an inline script would
  // need 'unsafe-inline'. `<` is escaped to its JSON unicode form because the
  // contents of a <script> element are raw text -- HTML entities inside one are
  // not decoded, so HTML-escaping would hand JSON.parse a string of `&quot;`.
  function configTag(id, value) {
    return `<script type="application/json" id="${escapeHtml(id)}">${JSON.stringify(value).replaceAll("<", "\\u003c")}</script>`;
  }

  function callSurface(config) {
    return [
      '<div class="card">',
      "<h2>The call</h2>",
      '<p class="fine" data-sonara-call-status>Not connected.</p>',
      '<button class="action" type="button" data-sonara-call-start>Start the call</button>',
      '<button class="action" type="button" data-sonara-call-hangup disabled>Hang up</button>',
      // Autoplay is what makes the far end audible the moment it arrives.
      // muted is deliberately absent: a muted call is a call nobody can hear.
      '<audio data-sonara-call-audio autoplay></audio>',
      "</div>",
      configTag("sonara-call-config", config)
    ].join("");
  }

  function withCallScript(html) {
    return html.replace("</body>", '<script src="/sonara-call.js"></script></body>');
  }

  // The business end. Reached from a customer record.
  app.get(`${BUSINESS_PAGE}/:recordId/call`, requireCustomer, async (req, res) => {
    const readiness = signalling.callReadiness({ getEnv });
    const recordId = String(req.params.recordId || "");
    // linkAction(href, label) takes two arguments. A third is silently ignored,
    // which is how an earlier page here shipped GET anchors to POST-only routes.
    const back = [
      linkAction(`${BUSINESS_PAGE}/${encodeURIComponent(recordId)}`, "Back to the customer"),
      linkAction(BUSINESS_PAGE, "All customers")
    ];

    if (!isUuid(recordId)) {
      return res.status(404).type("html").send(callShell({
        title: "Call", eyebrow: "Business Builder", heading: "Call",
        sections: [brandCard("No such customer", "That customer record does not exist.")],
        actions: back
      }));
    }

    if (!readiness.ok) {
      // Rendered as a page rather than an error, and it says what still works:
      // this is the state of every deployment that has not configured a STUN
      // address, which is most of them on day one.
      return res.status(200).type("html").send(callShell({
        title: "Call", eyebrow: "Business Builder", heading: "Calling is not set up yet",
        sections: [
          brandCard("What is missing", explain(readiness.status)),
          brandCard("What it needs", "A STUN address in SONARA_STUN_URLS. It is what lets two browsers find each other across the internet. Without it a call still connects between two devices on the same network, and not across one."),
          brandCard("What this costs", "Nothing per call. The audio goes directly between the two browsers and never passes through SONARA.")
        ],
        actions: back
      }));
    }

    // Calls already placed against this record.
    //
    // Not decoration. A call that never connected leaves a row saying so, and
    // without somewhere to read it the only evidence a link was ever sent is in
    // whatever the owner used to send it. `{ ok, rows }` rather than a bare
    // array: a failed read must not render as "you have never called them".
    const dependencies = storeDeps();
    const organizationId = dependencies ? await organizationFor(req) : null;
    const history = dependencies && organizationId
      ? await store.forCustomer(dependencies, { organizationId, customerId: recordId, limit: 10 })
      : { ok: false, code: "setup_required", rows: [] };

    const historyCard = history.ok
      ? brandCard(
        "Calls to this customer",
        history.rows.length
          ? history.rows.map((row) => `${describeCall(row)}.`).join(" ")
          : "No calls have been placed from this record yet."
      )
      : brandCard(
        "Calls to this customer",
        "We could not read your call history just now. That says nothing about whether there is any — only that we could not check."
      );

    const html = callShell({
      title: "Call", eyebrow: "Business Builder", heading: "Call this customer",
      sections: [
        brandCard(
          "How this works",
          "Pressing start places a call and gives you a link to send. When they open it, the two browsers talk directly to each other — the audio never passes through SONARA, and neither of you is charged for the minutes."
        ),
        callSurface({
          role: "business",
          createEndpoint: "/api/calls",
          customerId: recordId,
          joinBase: CUSTOMER_PAGE,
          // Sent with the page as well as with the placed call. The TURN
          // credentials in here are minted per request and expire within the
          // hour -- see lib/sonara-call-signalling.cjs for why a static relay
          // password in page source would be a permanent open relay.
          iceServers: readiness.iceServers,
          relay: readiness.relay
        }),
        historyCard,
        brandCard(
          "If it does not connect",
          readiness.relay
            ? "A small number of networks block direct connections. This deployment has a relay configured for those, so the call should still go through."
            : "About one call in six is on a network that blocks direct connections between browsers. Those calls will not connect here, because no relay is configured. Nothing is charged either way."
        )
      ],
      actions: back
    });
    return res.status(200).type("html").send(withCallScript(html));
  });

  // The customer end. A link, and nothing else.
  app.get(`${CUSTOMER_PAGE}/:token`, async (req, res) => {
    const dependencies = storeDeps();
    const notAvailable = (heading, message) => res.status(200).type("html").send(callShell({
      title: "Call", eyebrow: "SONARA", heading, sections: [brandCard("What happened", message)], actions: []
    }));

    if (!dependencies) return notAvailable("Call not available", explain("setup_required"));

    const found = await store.byToken(dependencies, req.params.token);
    if (!found.ok) return notAvailable("Call not available", explain(found.code));

    const stop = refuseUnjoinable(found.call);
    if (stop) return notAvailable("Call not available", explain(stop));

    const readiness = signalling.callReadiness({ getEnv });
    if (!readiness.ok) return notAvailable("Call not available", explain(readiness.status));

    const html = callShell({
      title: "Call", eyebrow: "SONARA", heading: "You have been called",
      sections: [
        brandCard(
          "Before you answer",
          "Your browser will ask to use your microphone. The call goes directly between your device and theirs — the audio does not pass through SONARA, and nothing is recorded."
        ),
        callSurface({
          role: "customer",
          callId: found.call.id,
          // The token is what authenticates this browser for this one call. It
          // is already in the address bar of the page it is being written into.
          token: String(req.params.token),
          // The customer end never calls POST /api/calls, so this page is the
          // only place its ICE servers can come from. Without them the browser
          // has host candidates only and the call connects on a shared network
          // and nowhere else.
          iceServers: readiness.iceServers,
          relay: readiness.relay
        })
      ],
      actions: []
    });
    return res.status(200).type("html").send(withCallScript(html));
  });
};

module.exports.REQUIRED = REQUIRED;
module.exports.EXPLAIN = EXPLAIN;
module.exports.CUSTOMER_PAGE = CUSTOMER_PAGE;
module.exports.BUSINESS_PAGE = BUSINESS_PAGE;
