"use strict";

// The front door a stranger walks through, and the four owner pages behind it.
//
//   GET  /chat/:slug                          public, no account
//   POST /chat/:slug                          public, rate limited, one answer
//   GET  /growth-studio/owner/ideal-customer  what a good customer looks like
//   POST /api/lead-profile
//   GET  /growth-studio/owner/chat-widget     the address, and the snippet
//   POST /api/lead-capture-page
//   GET  /growth-studio/owner/lead-routing    who gets what
//   POST /api/lead-routing-rules
//   GET  /growth-studio/pipeline              the leads, by stage, with the working
//
// ## The resolution order is the security property
//
// Exactly as /book/:slug: the slug finds one *enabled* `lead_capture_pages`
// row, that row names the organization, and the profile, the rules, the people
// and the written lead are all filtered on that organization id. The public page
// never chooses an organization -- it is told one by the row its owner
// published. Every read here uses the service-role key, which bypasses row level
// security, so that filter is the only tenant boundary there is.
//
// ## The conversation is a form, not a chat client
//
// One question per request, server-rendered, ordinary POST. It works with
// JavaScript switched off, in an iframe on somebody else's site, and on a phone
// with one bar. A widget that needs a bundle to ask "how many people are on the
// team?" is a widget that fails on the connections where leads are worth most.
//
// ## Why the embed is an iframe and not a script
//
// The owner page hands out an `<iframe>` snippet rather than a `<script>` tag.
// A script would be this application executing on somebody else's domain, with
// their cookies and their DOM, for the lifetime of every page it is pasted into
// -- a permanent liability for a floating bubble. An iframe renders the same
// conversation inside a box the host page cannot read and which cannot read the
// host page. It is the smaller promise, and it is the one this can keep.
//
// ## What a visitor is never shown
//
// Not the score, not the band, not the profile it was scored against, and not
// who it was routed to. All four are the business's working. A visitor who could
// see the score would learn what this business is not interested in, and a
// visitor who could see the rules would learn how to score better.

const crypto = require("node:crypto");

const { encode: encodeQr } = require("../lib/sonara-qr.cjs");
const { toSvg: qrToSvg } = require("../lib/sonara-qr-png.cjs");
const { scoreLead } = require("../lib/sonara-lead-scoring.cjs");
const { routeLead } = require("../lib/sonara-lead-routing.cjs");
const {
  questionsFor, recordAnswer, nextStep, transcriptActivity, scorableAnswers,
  OTHER_VALUE, CONTACT_KEY
} = require("../lib/sonara-lead-capture-script.cjs");

const PROFILES_TABLE = "lead_icp_profiles";
const PAGES_TABLE = "lead_capture_pages";
const CONVERSATIONS_TABLE = "lead_conversations";
const RULES_TABLE = "lead_routing_rules";
const LEADS_TABLE = "growth_leads";
const EMPLOYEES_TABLE = "business_employee_profiles";

// Same shape as the CHECK constraint in the migration, and checked before the
// value reaches a PostgREST filter. An unchecked slug is interpolated into a
// query, and the empty string there matches rows whose slug is empty rather
// than none.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 24 random bytes, base64url: 32 characters, 192 bits. The token is the only
// thing that lets somebody add to a conversation already in progress, so it is
// unguessable rather than merely unlikely -- the same reasoning, and the same
// fixed-length pattern, as the share token in lib/sonara-shared-results.cjs. A
// bounded pattern would accept the empty string, and `token=eq.` matches rows
// whose token is empty rather than none.
const TOKEN_BYTES = 24;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

const MAX_TRANSCRIPT = 60;

const STAGES = Object.freeze([
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
]);

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml",
  "requireCustomer", "getCustomerPrimaryOrganization",
  "getSupabaseServerConfig", "supabaseHeaders", "createRateLimiter"
];

function mintToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function isToken(value) {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function money(cents) {
  const amount = finiteNumber(cents);
  if (amount === null) return null;
  return `${(amount / 100).toFixed(2)}`;
}

// A text[] column from a comma-separated field. Empty entries dropped, so
// "plumbing, , hvac" is two industries rather than three.
function listFromField(value, limit = 24) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .slice(0, limit);
}

// The profile row as the scoring and script modules want it. Named separately
// rather than passing the row through, because the column names and the module's
// field names are allowed to differ and this is the one place that knows both.
function profileFromRow(row) {
  if (!row) return {};
  return {
    industries: Array.isArray(row.industries) ? row.industries : [],
    regions: Array.isArray(row.regions) ? row.regions : [],
    teamSizeMin: row.team_size_min,
    teamSizeMax: row.team_size_max,
    budgetMinCents: row.budget_min_cents,
    budgetMaxCents: row.budget_max_cents,
    timelineDays: row.timeline_days,
    disqualifiers: Array.isArray(row.disqualifiers) ? row.disqualifiers : [],
    weights: {
      fit: row.fit_weight,
      urgency: row.urgency_weight,
      engagement: row.engagement_weight,
      risk: row.risk_weight
    }
  };
}

function ruleFromRow(row) {
  return {
    id: row.id,
    when: {
      minScore: row.min_score,
      maxScore: row.max_score,
      unscored: row.match_unscored === true,
      bands: Array.isArray(row.bands) ? row.bands : [],
      industries: Array.isArray(row.industries) ? row.industries : [],
      regions: Array.isArray(row.regions) ? row.regions : [],
      sources: Array.isArray(row.sources) ? row.sources : []
    },
    assignTo: row.assign_to || "round_robin"
  };
}

// A scannable version of an address, inline, so nothing has to be fetched and
// no route has to serve an image. SVG rather than PNG because the thing an
// owner does with this is print it, and a vector scales to a shop window.
//
// Returns null rather than throwing if the URL is somehow too long to encode:
// a settings page that fails to render because a code would not fit is worse
// than one that shows the address without a code beside it.
function qrCardBody(url) {
  const encoded = encodeQr(url, { ecc: "M" });
  if (!encoded.ok) return null;
  return `<div class="sonara-qr">${qrToSvg(encoded.modules)}</div>`;
}

function registerLeadCaptureRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerLeadCaptureRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireCustomer, getCustomerPrimaryOrganization,
    getSupabaseServerConfig, supabaseHeaders, createRateLimiter
  } = deps;

  const enc = encodeURIComponent;

  async function rest(config, path) {
    const response = await fetch(`${config.url}/rest/v1/${path}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => null);
    return Array.isArray(rows) ? { ok: true, rows } : { ok: false, rows: [] };
  }

  async function write(config, table, body, { method = "POST", query = "", prefer = "return=representation" } = {}) {
    const response = await fetch(`${config.url}/rest/v1/${table}${query}`, {
      method,
      headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: prefer },
      body: JSON.stringify(body)
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [] };
    if (prefer === "return=minimal") return { ok: true, rows: [] };
    const rows = await response.json().catch(() => null);
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  }

  // brandCard escapes its body, which is right for a sentence and wrong for a
  // form. Cards carrying markup are built here, the same way the other route
  // modules do it, rather than by loosening brandCard for everybody.
  function htmlCard(title, inner) {
    return `<article class="card sonara-depth" data-sonara-enter><h2>${escapeHtml(title)}</h2>${inner}</article>`;
  }

  function publicPage({ heading, body, sections = [] }) {
    return layout({
      title: heading, eyebrow: "SONARA One", heading, body, surface: "marketing",
      sections, actions: [linkAction("/", "SONARA One")]
    });
  }

  // The same page for "no such slug" and "switched off", on purpose. Telling
  // them apart tells somebody guessing addresses when they have guessed one that
  // exists.
  function noSuchPage(res) {
    return res.status(404).type("html").send(publicPage({
      heading: "That page is not open",
      body: "It may never have existed, or the business may have taken it down. Nothing here can tell the difference.",
      sections: [brandCard("If you were given this link", "Go back to whoever sent it and ask for a current one.")]
    }));
  }

  // A read that failed is not a business that does not exist. Saying "no such
  // page" to somebody holding a working link would have them tell the business
  // it was broken.
  function unavailable(res) {
    return res.status(503).type("html").send(publicPage({
      heading: "We could not open that just now",
      body: "This is on our side and the page has not been removed. Try again shortly.",
      sections: []
    }));
  }

  async function findPage(config, slug) {
    const path = `${PAGES_TABLE}?slug=eq.${enc(slug)}&enabled=is.true&select=id,organization_id,slug,headline,greeting,closing&limit=1`;
    const result = await rest(config, path);
    if (!result.ok) return { ok: false, page: null };
    return { ok: true, page: result.rows[0] || null };
  }

  async function readProfile(config, organizationId) {
    const path = `${PROFILES_TABLE}?organization_id=eq.${enc(organizationId)}`
      + `&select=id,name,industries,regions,team_size_min,team_size_max,budget_min_cents,budget_max_cents,`
      + `timeline_days,disqualifiers,fit_weight,urgency_weight,engagement_weight,risk_weight&limit=1`;
    const result = await rest(config, path);
    if (!result.ok) return { ok: false, row: null };
    return { ok: true, row: result.rows[0] || null };
  }

  // ---- The conversation -----------------------------------------------------

  function questionField(question) {
    if (question.kind === "choice") {
      const options = question.options.map(
        (option) => `<label class="sonara-slot"><input type="radio" name="answer" value="${escapeHtml(option.value)}" required> ${escapeHtml(option.label)}</label>`
      ).join("");
      const other = question.allowOther
        ? `<label class="sonara-slot"><input type="radio" name="answer" value="${escapeHtml(OTHER_VALUE)}"> ${escapeHtml(question.otherPrompt || "Something else")}</label>`
          + `<label>In your own words<input type="text" name="other" maxlength="120"></label>`
        : "";
      return options + other;
    }
    if (question.kind === "number") {
      return `<label>${escapeHtml(question.unit || "How many")}<input type="number" name="answer" min="0" step="1" required></label>`;
    }
    if (question.kind === "money") {
      return `<label>Roughly<input type="text" name="answer" maxlength="24" inputmode="decimal" required placeholder="2,000"></label>`;
    }
    return [
      `<label>Your name<input type="text" name="name" maxlength="120" autocomplete="name"></label>`,
      `<label>Email<input type="email" name="email" maxlength="320" autocomplete="email"></label>`,
      `<label>Phone<input type="tel" name="phone" maxlength="40" autocomplete="tel"></label>`,
      `<p class="fine">One of the two is enough.</p>`
    ].join("");
  }

  function conversationPage({ page, question, token, problem, said = [] }) {
    const heading = String(page.headline || "").trim() || "Tell us what you need";
    const greeting = String(page.greeting || "").trim()
      || "A few quick questions, and somebody will pick this up.";

    const history = said.length
      ? htmlCard("So far", `<ul>${said.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`)
      : "";

    return publicPage({
      heading,
      body: greeting,
      sections: [
        problem ? brandCard("Not quite", escapeHtml(problem)) : "",
        history,
        htmlCard(question.prompt, `
          <form method="post" action="/chat/${escapeHtml(page.slug)}" class="sonara-booking-form">
            <input type="hidden" name="question" value="${escapeHtml(question.key)}">
            ${token ? `<input type="hidden" name="token" value="${escapeHtml(token)}">` : ""}
            ${questionField(question)}
            <button type="submit">Next</button>
          </form>`),
        brandCard("How this works", "These questions come from a list this business wrote. Nothing you type is sent to anybody else, and this page never asks for card details.")
      ].filter(Boolean)
    });
  }

  function donePage(page) {
    const closing = String(page.closing || "").trim()
      || "Thanks -- somebody from this business will get back to you.";
    return publicPage({
      heading: "Thank you",
      body: closing,
      sections: [brandCard("What happens now", "Your answers have gone to the business. Nothing has been charged and no card details were taken.")]
    });
  }

  // What the visitor has already told us, in their own words, so the page can
  // show it back rather than making somebody answer into a void.
  function saidSoFar(profile, answers) {
    const lines = [];
    for (const question of questionsFor(profile)) {
      const value = answers[question.key];
      if (value === undefined || value === null) continue;
      if (question.key === CONTACT_KEY) continue;
      if (question.key === "budgetCents") {
        const shown = money(value);
        if (shown) lines.push(`${question.prompt} ${shown}`);
        continue;
      }
      lines.push(`${question.prompt} ${String(value)}`);
    }
    return lines;
  }

  app.get("/chat/:slug", async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!SLUG_PATTERN.test(slug)) return noSuchPage(res);

    const config = getSupabaseServerConfig();
    if (!config?.ok) return unavailable(res);

    const found = await findPage(config, slug);
    if (!found.ok) return unavailable(res);
    if (!found.page) return noSuchPage(res);

    const profile = await readProfile(config, found.page.organization_id);
    // A profile that could not be read is not a profile with no criteria. The
    // second would silently ask a stranger for nothing but an email address and
    // record it as a fully-answered conversation.
    if (!profile.ok) return unavailable(res);

    const step = nextStep(profileFromRow(profile.row), {});
    if (step.done) return res.status(200).type("html").send(donePage(found.page));

    return res.status(200).type("html").send(conversationPage({
      page: found.page,
      question: step.question,
      token: null,
      problem: String(req.query?.problem || "") ? "That did not come through. Try once more." : null
    }));
  });

  // Sixty answers an hour from one address. A conversation is a dozen messages,
  // so a person working through it several times over stays well under, and a
  // script filling somebody's table does not.
  const chatLimiter = createRateLimiter({
    name: "lead_capture_chat",
    windowSeconds: 3600,
    maxAttempts: 60,
    scopes: ["ip"],
    getSupabaseServerConfig
  });

  app.post("/chat/:slug", chatLimiter, async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!SLUG_PATTERN.test(slug)) return noSuchPage(res);

    const config = getSupabaseServerConfig();
    if (!config?.ok) return unavailable(res);

    const found = await findPage(config, slug);
    if (!found.ok) return unavailable(res);
    if (!found.page) return noSuchPage(res);
    const page = found.page;

    const profileRead = await readProfile(config, page.organization_id);
    if (!profileRead.ok) return unavailable(res);
    const profile = profileFromRow(profileRead.row);

    // An existing conversation, or a new one. The token is checked against the
    // pattern before it reaches a filter, and the row is refused unless it
    // belongs to the organization this slug named -- a token from another
    // business's widget resolves to nothing here rather than to their row.
    const submitted = String(req.body?.token || "");
    let conversation = null;
    if (submitted) {
      if (!isToken(submitted)) return res.redirect(303, `/chat/${slug}`);
      const existing = await rest(
        config,
        `${CONVERSATIONS_TABLE}?token=eq.${enc(submitted)}&organization_id=eq.${enc(page.organization_id)}`
          + `&select=id,answers,transcript,status,organization_id&limit=1`
      );
      if (!existing.ok) return unavailable(res);
      conversation = existing.rows[0] || null;
      if (!conversation) return res.redirect(303, `/chat/${slug}`);
    }

    const answers = conversation && conversation.answers && typeof conversation.answers === "object"
      ? { ...conversation.answers }
      : {};
    const transcript = Array.isArray(conversation?.transcript) ? conversation.transcript.slice() : [];

    // Which question this answer is for comes from the form, but it is only
    // accepted if it is the one actually outstanding. Otherwise a replayed form
    // could overwrite an earlier answer, or skip the contact step entirely.
    const step = nextStep(profile, answers);
    if (step.done) {
      return res.status(200).type("html").send(donePage(page));
    }
    const asked = step.question;
    if (String(req.body?.question || "") !== asked.key) {
      return res.status(200).type("html").send(conversationPage({
        page, question: asked, token: submitted || null, said: saidSoFar(profile, answers)
      }));
    }

    const raw = asked.kind === "contact"
      ? { name: req.body?.name, email: req.body?.email, phone: req.body?.phone }
      : (asked.allowOther ? { value: req.body?.answer, other: req.body?.other } : req.body?.answer);

    const recorded = recordAnswer(profile, asked.key, raw);
    if (!recorded.ok) {
      return res.status(200).type("html").send(conversationPage({
        page, question: asked, token: submitted || null,
        problem: recorded.message, said: saidSoFar(profile, answers)
      }));
    }

    answers[asked.key] = recorded.value;
    // The transcript records that the question was put and that something came
    // back. It deliberately does not store the raw text of a contact answer a
    // second time -- the answer is in `answers`, and two copies of somebody's
    // phone number is one more than is needed.
    transcript.push({ role: "assistant", questionKey: asked.key, at: new Date().toISOString() });
    transcript.push({ role: "visitor", at: new Date().toISOString() });
    while (transcript.length > MAX_TRANSCRIPT) transcript.shift();

    const after = nextStep(profile, answers);
    const finished = after.done;

    let token = submitted;
    if (!conversation) {
      token = mintToken();
      const created = await write(config, CONVERSATIONS_TABLE, {
        // From the published page, never from the request.
        organization_id: page.organization_id,
        capture_page_id: page.id,
        token,
        answers,
        transcript,
        status: finished ? "captured" : "open",
        last_message_at: new Date().toISOString()
      });
      if (!created.ok) {
        return res.status(200).type("html").send(conversationPage({
          page, question: asked, token: null,
          problem: "We could not save that just now. Nothing was lost -- please answer again.",
          said: saidSoFar(profile, answers)
        }));
      }
      conversation = created.rows[0] || null;
    } else {
      const updated = await write(config, CONVERSATIONS_TABLE, {
        answers,
        transcript,
        status: finished ? "captured" : "open",
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        method: "PATCH",
        query: `?id=eq.${enc(conversation.id)}&organization_id=eq.${enc(page.organization_id)}`,
        prefer: "return=minimal"
      });
      if (!updated.ok) {
        return res.status(200).type("html").send(conversationPage({
          page, question: asked, token,
          problem: "We could not save that just now. Please answer again.",
          said: saidSoFar(profile, answers)
        }));
      }
    }

    if (!finished) {
      return res.status(200).type("html").send(conversationPage({
        page, question: after.question, token, said: saidSoFar(profile, answers)
      }));
    }

    await captureLead({ config, page, profile, answers, transcript, conversationId: conversation?.id || null });
    return res.status(200).type("html").send(donePage(page));
  });

  // Score it, decide whose it is, write it. Runs once, when the conversation
  // finishes -- which is the moment there is a way to get back to somebody.
  //
  // Every failure here is deliberately silent to the visitor. They have answered
  // the questions and given their details; telling them the business's routing
  // table could not be read tells them something about somebody else's systems
  // and gives them nothing they can act on. The conversation row is already
  // saved either way, so nothing they typed is lost.
  async function captureLead({ config, page, profile, answers, transcript, conversationId }) {
    const contact = answers[CONTACT_KEY] || {};
    const activity = transcriptActivity(profile, transcript, answers);
    const scored = scoreLead({ profile, answers: scorableAnswers(answers), activity });

    const rules = await rest(
      config,
      `${RULES_TABLE}?organization_id=eq.${enc(page.organization_id)}&enabled=is.true`
        + `&select=id,name,position,min_score,max_score,match_unscored,bands,industries,regions,sources,assign_to`
        + `&order=position.asc,created_at.asc&limit=100`
    );
    const people = await rest(
      config,
      `${EMPLOYEES_TABLE}?organization_id=eq.${enc(page.organization_id)}&select=id,full_name,status&limit=200`
    );
    // Open leads per person, for the round robin. Deliberately not filtered on
    // `assigned_to=not.is.null`: PostgREST spells that with a `not.` prefix, and
    // a filter the query layer gets subtly wrong is worse than counting the
    // nulls out here, where it is one line and visible.
    const openLeads = await rest(
      config,
      `${LEADS_TABLE}?organization_id=eq.${enc(page.organization_id)}&status=in.(new,contacted,qualified)`
        + `&select=assigned_to&limit=2000`
    );

    // A failed read is not an empty list. Routing against rules that could not
    // be read would quietly give a lead to the wrong person and record a rule
    // that never ran, so the lead is written unassigned with the reason instead.
    let decision = null;
    if (rules.ok && people.ok && openLeads.ok) {
      const load = {};
      for (const row of openLeads.rows) {
        if (row.assigned_to) load[row.assigned_to] = (load[row.assigned_to] || 0) + 1;
      }
      decision = routeLead({
        lead: {
          score: scored.score,
          band: scored.band ? scored.band.key : null,
          industry: answers.industry || null,
          region: answers.region || null,
          source: "chat_widget"
        },
        rules: rules.rows.map(ruleFromRow),
        people: people.rows.map((row) => ({
          id: row.id,
          name: row.full_name,
          active: row.status !== "inactive" && row.status !== "archived",
          away: row.status === "on_leave"
        })),
        openLeads: load
      });
    }

    const row = {
      organization_id: page.organization_id,
      name: contact.name || null,
      email: contact.email || null,
      phone: contact.phone || null,
      source: "chat_widget",
      status: "new",
      score: scored.score,
      score_band: scored.band ? scored.band.key : null,
      score_provisional: scored.provisional,
      score_breakdown: {
        fit: scored.fit,
        urgency: scored.urgency,
        engagement: scored.engagement,
        risk: scored.risk,
        riskFlags: scored.riskFlags,
        confidence: scored.confidence,
        answered: scored.answered,
        declared: scored.declared,
        perCriterion: scored.perCriterion,
        componentsUsed: scored.componentsUsed
      },
      assigned_to: decision ? decision.assignedTo : null,
      assigned_at: decision && decision.assignedTo ? new Date().toISOString() : null,
      routing_note: decision || {
        assignedTo: null,
        unassigned: {
          code: "routing_unavailable",
          message: "The routing rules or the people list could not be read when this lead arrived, so nobody was chosen."
        }
      },
      conversation_id: conversationId
    };

    const saved = await write(config, LEADS_TABLE, row);
    if (!saved.ok || !saved.rows.length || !conversationId) return;
    await write(config, CONVERSATIONS_TABLE, { lead_id: saved.rows[0].id }, {
      method: "PATCH",
      query: `?id=eq.${enc(conversationId)}&organization_id=eq.${enc(page.organization_id)}`,
      prefer: "return=minimal"
    });
  }

  // ---- The owner's side -----------------------------------------------------

  async function scopeFor(req) {
    const config = getSupabaseServerConfig();
    const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user || null;
    const org = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!config?.ok || !org?.ok || !org.organizationId) return null;
    return { config, organizationId: org.organizationId, userId: user?.id || null };
  }

  function ownerPage({ title, heading, body, sections, actions }) {
    return layout({
      title, eyebrow: "Growth Studio", heading, body, sections,
      actions: actions || [linkAction("/growth-studio/dashboard", "Back to your workspace")]
    });
  }

  function setupRequired(res, { title, heading, body }) {
    return res.status(503).type("html").send(ownerPage({
      title, heading, body, sections: []
    }));
  }

  // ---- What a good customer looks like --------------------------------------

  app.get("/growth-studio/owner/ideal-customer", requireCustomer, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) {
      return setupRequired(res, {
        title: "Your ideal customer", heading: "Your ideal customer",
        body: "Your workspace could not be read, so this page cannot say what you have written down."
      });
    }

    const profile = await readProfile(scope.config, scope.organizationId);
    const row = profile.row;
    const sections = [];

    if (!profile.ok) {
      // Never "you have not set one up yet". That sentence would invite an owner
      // to save a second row over the top of the one they already have.
      sections.push(brandCard("We could not read your profile", "This is a problem on our side. The form below is not your saved profile -- do not save over it until this page loads properly."));
    } else if (!row) {
      sections.push(brandCard("You have not described a customer yet", "Fill this in and every lead that arrives is scored against it. Leave a line blank and it is not scored on -- a blank is not a rule that matches everybody."));
    } else {
      const declared = [
        row.industries?.length ? "what they do" : null,
        row.regions?.length ? "where they are" : null,
        row.team_size_min !== null || row.team_size_max !== null ? "how big" : null,
        row.timeline_days !== null ? "how soon" : null,
        row.budget_min_cents !== null || row.budget_max_cents !== null ? "budget" : null
      ].filter(Boolean);
      sections.push(htmlCard("What you score on", declared.length
        ? `<p>${escapeHtml(declared.join(", "))}. Your widget asks exactly these, in this order, and then how to get back to them.</p>`
        : `<p>Nothing yet. Until you fill something in, a lead's fit is recorded as unknown rather than as a match — which is why an empty profile does not mark every visitor as ideal.</p>`));
    }

    const problem = String(req.query?.problem || "");
    const problems = {
      order: "A smallest that is larger than the largest matches nobody. Check the two numbers.",
      not_saved: "We could not save that. Nothing was changed."
    };
    if (problems[problem]) sections.unshift(brandCard("Not saved", escapeHtml(problems[problem])));

    sections.push(htmlCard("Your profile", `
      <form method="post" action="/api/lead-profile" class="sonara-settings-form">
        <label>What do they do?<input type="text" name="industries" value="${escapeHtml((row?.industries || []).join(", "))}" maxlength="400" placeholder="plumbing, heating"></label>
        <p class="fine">Comma separated. Leave blank and this is not scored on.</p>
        <label>Where are they?<input type="text" name="regions" value="${escapeHtml((row?.regions || []).join(", "))}" maxlength="400" placeholder="UK, Ireland"></label>
        <label>Smallest team<input type="number" name="team_size_min" min="0" value="${escapeHtml(row?.team_size_min ?? "")}"></label>
        <label>Largest team<input type="number" name="team_size_max" min="0" value="${escapeHtml(row?.team_size_max ?? "")}"></label>
        <label>Smallest budget<input type="text" name="budget_min" value="${escapeHtml(money(row?.budget_min_cents) ?? "")}" maxlength="24" placeholder="500.00"></label>
        <label>Largest budget<input type="text" name="budget_max" value="${escapeHtml(money(row?.budget_max_cents) ?? "")}" maxlength="24" placeholder="5000.00"></label>
        <label>They want it sorted within, in days<input type="number" name="timeline_days" min="1" value="${escapeHtml(row?.timeline_days ?? "")}"></label>
        <label>Words that should stop you picking one up<input type="text" name="disqualifiers" value="${escapeHtml((row?.disqualifiers || []).join(", "))}" maxlength="400" placeholder="student, competitor"></label>
        <p class="fine">Only what you write here counts as a warning sign. Leave it blank and no lead is flagged.</p>
        <label>How much fit is worth<input type="number" name="fit_weight" min="0" max="100" value="${escapeHtml(row?.fit_weight ?? 40)}"></label>
        <label>How much urgency is worth<input type="number" name="urgency_weight" min="0" max="100" value="${escapeHtml(row?.urgency_weight ?? 25)}"></label>
        <label>How much engagement is worth<input type="number" name="engagement_weight" min="0" max="100" value="${escapeHtml(row?.engagement_weight ?? 20)}"></label>
        <label>How much a warning sign takes off<input type="number" name="risk_weight" min="0" max="100" value="${escapeHtml(row?.risk_weight ?? 15)}"></label>
        <button type="submit">Save</button>
      </form>`));

    return res.status(200).type("html").send(ownerPage({
      title: "Your ideal customer",
      heading: "Your ideal customer",
      body: "What you write here does two jobs: it is the list your chat widget asks about, and it is what every lead is scored against. There is one list so the two cannot drift apart.",
      sections,
      actions: [linkAction("/growth-studio/dashboard", "Back to your workspace"), linkAction("/growth-studio/pipeline", "Your pipeline")]
    }));
  });

  app.post("/api/lead-profile", requireCustomer, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required" });
    const settings = "/growth-studio/owner/ideal-customer";

    const teamMin = finiteNumber(req.body?.team_size_min);
    const teamMax = finiteNumber(req.body?.team_size_max);
    const budgetMin = finiteNumber(String(req.body?.budget_min || "").replace(/[^0-9.]/g, ""));
    const budgetMax = finiteNumber(String(req.body?.budget_max || "").replace(/[^0-9.]/g, ""));

    if (teamMin !== null && teamMax !== null && teamMin > teamMax) {
      return res.redirect(303, `${settings}?problem=order`);
    }
    if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
      return res.redirect(303, `${settings}?problem=order`);
    }

    const weight = (value, fallback) => {
      const number = finiteNumber(value);
      if (number === null) return fallback;
      return Math.max(0, Math.min(100, Math.round(number)));
    };

    const row = {
      organization_id: scope.organizationId,
      industries: listFromField(req.body?.industries),
      regions: listFromField(req.body?.regions),
      team_size_min: teamMin === null ? null : Math.max(0, Math.round(teamMin)),
      team_size_max: teamMax === null ? null : Math.max(0, Math.round(teamMax)),
      budget_min_cents: budgetMin === null ? null : Math.round(budgetMin * 100),
      budget_max_cents: budgetMax === null ? null : Math.round(budgetMax * 100),
      timeline_days: finiteNumber(req.body?.timeline_days) === null
        ? null
        : Math.max(1, Math.round(finiteNumber(req.body.timeline_days))),
      disqualifiers: listFromField(req.body?.disqualifiers),
      fit_weight: weight(req.body?.fit_weight, 40),
      urgency_weight: weight(req.body?.urgency_weight, 25),
      engagement_weight: weight(req.body?.engagement_weight, 20),
      risk_weight: weight(req.body?.risk_weight, 15),
      updated_at: new Date().toISOString()
    };

    // The unique index on organization_id makes this an upsert rather than an
    // insert. Without `merge-duplicates` a second save is a constraint violation
    // an owner would read as "we could not save that".
    const saved = await write(scope.config, PROFILES_TABLE, { ...row, created_by: scope.userId }, {
      prefer: "resolution=merge-duplicates,return=minimal",
      query: "?on_conflict=organization_id"
    });
    if (!saved.ok) return res.redirect(303, `${settings}?problem=not_saved`);
    return res.redirect(303, settings);
  });

  // ---- The widget address ---------------------------------------------------

  app.get("/growth-studio/owner/chat-widget", requireCustomer, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) {
      return setupRequired(res, {
        title: "Your chat widget", heading: "Your chat widget",
        body: "Your workspace could not be read, so this page cannot say whether you have a widget or what is on it."
      });
    }

    const existing = await rest(
      scope.config,
      `${PAGES_TABLE}?organization_id=eq.${enc(scope.organizationId)}&select=slug,enabled,headline,greeting,closing&limit=1`
    );
    const row = existing.ok ? (existing.rows[0] || null) : null;
    const sections = [];

    if (!existing.ok) {
      sections.push(brandCard("We could not read your settings", "This is a problem on our side. The form below is not your saved configuration -- do not save over it until this page loads properly."));
    } else if (row?.slug && row.enabled) {
      const origin = "https://sonaraindustries.com";
      const snippet = `<iframe src="${origin}/chat/${row.slug}" title="Talk to us" width="380" height="560" style="border:0;border-radius:12px"></iframe>`;
      const qr = qrCardBody(`${origin}/chat/${row.slug}`);
      sections.push(htmlCard("Your widget is live", [
        `<p>Paste this into any page on your own site.</p>`,
        `<pre class="sonara-snippet"><code>${escapeHtml(snippet)}</code></pre>`,
        `<p><a class="action" href="/chat/${escapeHtml(row.slug)}">Open it yourself</a></p>`
      ].join("")));
      if (qr) {
        sections.push(htmlCard("The same address, on paper", [
          qr,
          `<p class="fine">Point a phone camera at this and it opens your widget. Right-click to save it \u2014 it is a vector, so it stays sharp at any size from a business card to a shop window.</p>`
        ].join("")));
      }
      sections.push(brandCard("Why a frame and not a script", "A script would be this application running on your domain, with your visitors' cookies and your page's contents, on every page you paste it into. A frame shows the same conversation in a box that cannot read your page and that your page cannot read. It is the smaller promise, and it is the one we can keep."));
    } else if (row?.slug) {
      sections.push(htmlCard("Your address is reserved and switched off", `<p>Nobody can open <code>/chat/${escapeHtml(row.slug)}</code> until you tick &quot;Take enquiries&quot;.</p>`));
    } else {
      sections.push(brandCard("You do not have a widget yet", "Choose an address below. Nothing is public until you tick the box."));
    }

    // A live widget with an empty profile asks a stranger for their email and
    // nothing else. That is the right thing for it to do and the wrong thing for
    // an owner to find out from a lead nobody could score.
    if (row?.enabled) {
      const profile = await readProfile(scope.config, scope.organizationId);
      if (!profile.ok) {
        sections.push(brandCard("We could not check your profile", "This page cannot tell you what your widget is asking. It is not saying it asks nothing."));
      } else {
        const asks = questionsFor(profileFromRow(profile.row)).length - 1;
        if (asks <= 0) {
          sections.push(brandCard("Your widget only asks for contact details", `You have not described an ideal customer, so there is nothing to qualify against and every lead arrives with its fit unknown. Fill in your profile and the widget asks about it the same day.`));
        } else {
          sections.push(brandCard("What your widget asks", `${asks} question${asks === 1 ? "" : "s"} from your ideal customer profile, then how to get back to them. Change the profile and this changes with it.`));
        }
      }
    }

    const problem = String(req.query?.problem || "");
    const problems = {
      slug_taken: "That address is already in use by another business. Choose a different one.",
      slug_shape: "An address can use lowercase letters, digits and hyphens, and must start and end with a letter or digit.",
      no_slug: "You asked to take enquiries and there is no address, so there would be nothing for anybody to open.",
      not_saved: "We could not save that. Nothing was changed."
    };
    if (problems[problem]) sections.unshift(brandCard("Not saved", escapeHtml(problems[problem])));

    sections.push(htmlCard("Settings", `
      <form method="post" action="/api/lead-capture-page" class="sonara-settings-form">
        <label>Address<span class="sonara-prefix">/chat/</span><input type="text" name="slug" value="${escapeHtml(String(row?.slug || ""))}" maxlength="48" pattern="[a-z0-9][a-z0-9-]{1,46}[a-z0-9]" placeholder="your-business"></label>
        <label><input type="checkbox" name="enabled"${row?.enabled ? " checked" : ""}> Take enquiries</label>
        <label>Headline<input type="text" name="headline" value="${escapeHtml(String(row?.headline || ""))}" maxlength="120"></label>
        <label>First thing it says<textarea name="greeting" maxlength="400" rows="2">${escapeHtml(String(row?.greeting || ""))}</textarea></label>
        <label>Last thing it says<textarea name="closing" maxlength="400" rows="2">${escapeHtml(String(row?.closing || ""))}</textarea></label>
        <p class="fine">Both are your words. This product does not write to your customers on your behalf.</p>
        <button type="submit">Save</button>
      </form>`));

    return res.status(200).type("html").send(ownerPage({
      title: "Your chat widget",
      heading: "Your chat widget",
      body: "One address a visitor can open, on your site or on its own, and answer a few questions without making an account.",
      sections,
      actions: [
        linkAction("/growth-studio/dashboard", "Back to your workspace"),
        linkAction("/growth-studio/owner/ideal-customer", "What it asks about")
      ]
    }));
  });

  app.post("/api/lead-capture-page", requireCustomer, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required" });
    const settings = "/growth-studio/owner/chat-widget";

    const slug = String(req.body?.slug || "").trim().toLowerCase();
    if (slug && !SLUG_PATTERN.test(slug)) return res.redirect(303, `${settings}?problem=slug_shape`);
    const enabled = String(req.body?.enabled || "") === "on";
    if (enabled && !slug) return res.redirect(303, `${settings}?problem=no_slug`);

    // Taken by somebody else is a different answer from taken by you. Checked
    // before the write so the owner is told which, rather than being handed a
    // constraint violation as "we could not save that".
    if (slug) {
      const taken = await rest(scope.config, `${PAGES_TABLE}?slug=eq.${enc(slug)}&select=organization_id&limit=1`);
      if (!taken.ok) return res.redirect(303, `${settings}?problem=not_saved`);
      const holder = taken.rows[0];
      if (holder && holder.organization_id !== scope.organizationId) {
        return res.redirect(303, `${settings}?problem=slug_taken`);
      }
    }

    const saved = await write(scope.config, PAGES_TABLE, {
      organization_id: scope.organizationId,
      slug: slug || null,
      enabled,
      headline: String(req.body?.headline || "").trim().slice(0, 120) || null,
      greeting: String(req.body?.greeting || "").trim().slice(0, 400) || null,
      closing: String(req.body?.closing || "").trim().slice(0, 400) || null,
      created_by: scope.userId,
      updated_at: new Date().toISOString()
    }, {
      prefer: "resolution=merge-duplicates,return=minimal",
      query: "?on_conflict=organization_id"
    });
    if (!saved.ok) return res.redirect(303, `${settings}?problem=not_saved`);
    return res.redirect(303, settings);
  });

  // ---- Who gets what --------------------------------------------------------

  app.get("/growth-studio/owner/lead-routing", requireCustomer, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) {
      return setupRequired(res, {
        title: "Who gets each lead", heading: "Who gets each lead",
        body: "Your workspace could not be read, so this page cannot say what your rules are."
      });
    }

    const rules = await rest(
      scope.config,
      `${RULES_TABLE}?organization_id=eq.${enc(scope.organizationId)}`
        + `&select=id,name,position,enabled,min_score,max_score,match_unscored,bands,industries,regions,sources,assign_to`
        + `&order=position.asc,created_at.asc&limit=100`
    );
    const people = await rest(
      scope.config,
      `${EMPLOYEES_TABLE}?organization_id=eq.${enc(scope.organizationId)}&select=id,full_name,status&order=full_name.asc&limit=200`
    );

    const sections = [];
    if (!rules.ok) {
      sections.push(brandCard("We could not read your rules", "This page cannot show what you have set up. It is not saying you have none."));
    } else if (!rules.rows.length) {
      sections.push(brandCard("You have no rules, and leads are still being given out", "Without a rule, every lead goes to whoever is carrying the fewest open ones. That is a reasonable default and it is what is happening now -- a rule is for the cases where it is wrong."));
    } else {
      sections.push(htmlCard("Your rules, in order", `<ol>${rules.rows.map((rule) => {
        const conditions = [
          rule.min_score !== null ? `score ${rule.min_score} or more` : null,
          rule.max_score !== null ? `score ${rule.max_score} or less` : null,
          rule.match_unscored ? "not scored" : null,
          rule.bands?.length ? `band ${rule.bands.join(" or ")}` : null,
          rule.industries?.length ? `does ${rule.industries.join(" or ")}` : null,
          rule.regions?.length ? `in ${rule.regions.join(" or ")}` : null,
          rule.sources?.length ? `from ${rule.sources.join(" or ")}` : null
        ].filter(Boolean);
        const named = people.ok ? people.rows.find((person) => person.id === rule.assign_to) : null;
        const to = rule.assign_to
          ? (named ? escapeHtml(named.full_name || "somebody") : "somebody who is no longer here")
          : "whoever is carrying the fewest";
        return `<li>${escapeHtml(rule.name)} — ${conditions.length ? escapeHtml(conditions.join(", ")) : "anything"} → ${to}`
          + `${rule.enabled ? "" : " <em>(off)</em>"}`
          + `<form method="post" action="/api/lead-routing-rules" class="sonara-inline-form">`
          + `<input type="hidden" name="action" value="delete">`
          + `<input type="hidden" name="rule_id" value="${escapeHtml(rule.id)}">`
          + `<button type="submit">Remove</button></form></li>`;
      }).join("")}</ol>`));
    }

    if (!people.ok) {
      sections.push(brandCard("We could not read your people", "The list below is empty because of that, not because you have nobody."));
    } else if (!people.rows.length) {
      sections.push(brandCard("You have nobody to give a lead to", "Leads will arrive and wait. Add somebody on your people page and they start being given out."));
    }

    const problem = String(req.query?.problem || "");
    const problems = {
      name: "A rule needs a name, so you can tell which one did this.",
      order: "A lowest score above the highest matches nothing. Check the two numbers.",
      person: "That person is not in your workspace.",
      not_saved: "We could not save that. Nothing was changed."
    };
    if (problems[problem]) sections.unshift(brandCard("Not saved", escapeHtml(problems[problem])));

    const peopleOptions = (people.ok ? people.rows : []).map(
      (person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.full_name || "Unnamed")}</option>`
    ).join("");

    sections.push(htmlCard("Add a rule", `
      <form method="post" action="/api/lead-routing-rules" class="sonara-settings-form">
        <input type="hidden" name="action" value="create">
        <label>Name<input type="text" name="name" maxlength="80" required placeholder="Hot leads to Ana"></label>
        <label>Lowest score<input type="number" name="min_score" min="0" max="100"></label>
        <label>Highest score<input type="number" name="max_score" min="0" max="100"></label>
        <label><input type="checkbox" name="match_unscored"> Only leads with no score</label>
        <p class="fine">A score range never matches a lead that has no score. If you want those, tick the box instead — not scored and scored zero are different leads.</p>
        <label>They do<input type="text" name="industries" maxlength="200" placeholder="plumbing, heating"></label>
        <label>They are in<input type="text" name="regions" maxlength="200" placeholder="UK"></label>
        <label>Give it to<select name="assign_to"><option value="">Whoever is carrying the fewest</option>${peopleOptions}</select></label>
        <label>Position<input type="number" name="position" min="0" max="999" value="${escapeHtml(String((rules.ok ? rules.rows.length : 0)))}"></label>
        <p class="fine">Lowest position first. The first rule that matches wins, and the rest are not looked at.</p>
        <button type="submit">Add this rule</button>
      </form>`));

    return res.status(200).type("html").send(ownerPage({
      title: "Who gets each lead",
      heading: "Who gets each lead",
      body: "Rules are tried in order and the first match wins. A lead is never left with nobody because a rule could not be honoured — if the person a rule names is away, it goes to whoever is carrying the fewest and the lead records that it was rerouted.",
      sections,
      actions: [linkAction("/growth-studio/pipeline", "Your pipeline"), linkAction("/growth-studio/dashboard", "Back to your workspace")]
    }));
  });

  app.post("/api/lead-routing-rules", requireCustomer, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required" });
    const settings = "/growth-studio/owner/lead-routing";

    if (String(req.body?.action || "") === "delete") {
      const ruleId = String(req.body?.rule_id || "");
      if (!UUID_PATTERN.test(ruleId)) return res.redirect(303, `${settings}?problem=not_saved`);
      // Filtered on the organization as well as the id. The id alone would let a
      // request delete another business's rule, and the service-role key would
      // happily do it.
      const removed = await fetch(
        `${scope.config.url}/rest/v1/${RULES_TABLE}?id=eq.${enc(ruleId)}&organization_id=eq.${enc(scope.organizationId)}`,
        { method: "DELETE", headers: { ...supabaseHeaders(scope.config), Prefer: "return=minimal" } }
      ).catch(() => undefined);
      if (!removed?.ok) return res.redirect(303, `${settings}?problem=not_saved`);
      return res.redirect(303, settings);
    }

    const name = String(req.body?.name || "").trim().slice(0, 80);
    if (!name) return res.redirect(303, `${settings}?problem=name`);

    const min = finiteNumber(req.body?.min_score);
    const max = finiteNumber(req.body?.max_score);
    if (min !== null && max !== null && min > max) return res.redirect(303, `${settings}?problem=order`);

    const assignTo = String(req.body?.assign_to || "").trim();
    if (assignTo) {
      if (!UUID_PATTERN.test(assignTo)) return res.redirect(303, `${settings}?problem=person`);
      const person = await rest(
        scope.config,
        `${EMPLOYEES_TABLE}?id=eq.${enc(assignTo)}&organization_id=eq.${enc(scope.organizationId)}&select=id&limit=1`
      );
      if (!person.ok) return res.redirect(303, `${settings}?problem=not_saved`);
      if (!person.rows.length) return res.redirect(303, `${settings}?problem=person`);
    }

    const clamp = (value) => (value === null ? null : Math.max(0, Math.min(100, Math.round(value))));
    const saved = await write(scope.config, RULES_TABLE, {
      organization_id: scope.organizationId,
      name,
      position: Math.max(0, Math.min(999, Math.round(finiteNumber(req.body?.position) ?? 0))),
      enabled: true,
      min_score: clamp(min),
      max_score: clamp(max),
      match_unscored: String(req.body?.match_unscored || "") === "on",
      bands: listFromField(req.body?.bands, 4),
      industries: listFromField(req.body?.industries),
      regions: listFromField(req.body?.regions),
      sources: listFromField(req.body?.sources),
      assign_to: assignTo || null,
      created_by: scope.userId
    }, { prefer: "return=minimal" });
    if (!saved.ok) return res.redirect(303, `${settings}?problem=not_saved`);
    return res.redirect(303, settings);
  });

  // ---- The pipeline ---------------------------------------------------------

  function scoreCell(lead) {
    if (lead.score === null || lead.score === undefined) {
      // Not a zero. A lead nothing has scored is a lead nobody has assessed, and
      // showing 0 would sort it to the bottom of a list it was never in.
      return `<span class="sonara-meta">Not scored</span>`;
    }
    const band = lead.score_band ? ` ${lead.score_band}` : "";
    const provisional = lead.score_provisional === true
      ? ` <span class="fine">provisional</span>`
      : "";
    return `<strong>${escapeHtml(String(lead.score))}</strong>${escapeHtml(band)}${provisional}`;
  }

  function whoCell(lead, people) {
    if (lead.assigned_to) {
      const person = people.find((entry) => entry.id === lead.assigned_to);
      return escapeHtml(person?.full_name || "Somebody no longer here");
    }
    const note = lead.routing_note;
    const reason = note && note.unassigned && note.unassigned.message ? note.unassigned.message : null;
    return `<span class="sonara-meta">${escapeHtml(reason || "Nobody yet")}</span>`;
  }

  app.get("/growth-studio/pipeline", requireCustomer, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) {
      return setupRequired(res, {
        title: "Your pipeline", heading: "Your pipeline",
        body: "Your workspace could not be read, so this page cannot show your leads. It is not saying you have none."
      });
    }

    const leads = await rest(
      scope.config,
      `${LEADS_TABLE}?organization_id=eq.${enc(scope.organizationId)}`
        + `&select=id,name,email,phone,source,status,score,score_band,score_provisional,assigned_to,routing_note,created_at`
        + `&order=created_at.desc&limit=200`
    );
    const people = await rest(
      scope.config,
      `${EMPLOYEES_TABLE}?organization_id=eq.${enc(scope.organizationId)}&select=id,full_name&limit=200`
    );

    if (!leads.ok) {
      return res.status(503).type("html").send(ownerPage({
        title: "Your pipeline", heading: "Your pipeline",
        body: "We could not read your leads just now. This is a problem on our side, and it is not telling you that you have none.",
        sections: []
      }));
    }

    const staff = people.ok ? people.rows : [];
    const sections = [];

    if (!people.ok) {
      sections.push(brandCard("We could not read your people", "Names are missing below because of that, not because nobody is assigned."));
    }

    if (!leads.rows.length) {
      sections.push(brandCard("No leads have arrived yet", "When somebody finishes your chat widget, they appear here scored and assigned. You can also record one by hand from your leads page."));
    }

    for (const stage of STAGES) {
      const inStage = leads.rows.filter((lead) => lead.status === stage.key);
      if (!inStage.length) continue;
      sections.push(htmlCard(`${stage.label} (${inStage.length})`, `<ul class="sonara-pipeline">${inStage.map((lead) => `
        <li>
          <strong>${escapeHtml(lead.name || "No name given")}</strong>
          ${lead.email ? ` <span class="sonara-meta">${escapeHtml(lead.email)}</span>` : ""}
          <div>${scoreCell(lead)} · ${whoCell(lead, staff)}</div>
          ${lead.source ? `<div class="fine">${escapeHtml(lead.source)}</div>` : ""}
        </li>`).join("")}</ul>`));
    }

    // Counted rather than described. A number an owner can check against their
    // own list is worth more than an adjective.
    const unassigned = leads.rows.filter((lead) => !lead.assigned_to).length;
    if (unassigned > 0) {
      sections.push(brandCard(
        `${unassigned} lead${unassigned === 1 ? " is" : "s are"} with nobody`,
        "Each one says why on its row. The usual reasons are that the workspace has no people yet, or that everybody was marked away when it arrived."
      ));
    }

    const provisional = leads.rows.filter((lead) => lead.score_provisional === true).length;
    if (provisional > 0) {
      sections.push(brandCard(
        `${provisional} score${provisional === 1 ? " is" : "s are"} provisional`,
        "That means the lead answered less than half of what you score on, so the number is standing on very little. It is shown rather than hidden because a band you cannot see the working for is worse than one you can."
      ));
    }

    return res.status(200).type("html").send(ownerPage({
      title: "Your pipeline",
      heading: "Your pipeline",
      body: "Every lead, by stage, with what it scored and who has it.",
      sections,
      actions: [
        linkAction("/growth-studio/owner/ideal-customer", "What you score on"),
        linkAction("/growth-studio/owner/lead-routing", "Who gets what"),
        linkAction("/growth-studio/owner/chat-widget", "Your widget")
      ]
    }));
  });
}

module.exports = registerLeadCaptureRoutes;
module.exports.STAGES = STAGES;
module.exports.SLUG_PATTERN = SLUG_PATTERN;
module.exports.TOKEN_PATTERN = TOKEN_PATTERN;
module.exports.profileFromRow = profileFromRow;
module.exports.ruleFromRow = ruleFromRow;
