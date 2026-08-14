"use strict";

// /business-builder/owner/assistant -- the first thing in this product that
// does work on a business's own records rather than storing them.
//
// It runs the nine checks in lib/sonara-record-checks.cjs against the owner's
// rows and says what needs attention: dishes selling below what they cost,
// invoices past due, stock at its reorder level, bookings with no way to reach
// the customer. All arithmetic over records the business already has. No model
// call, no provider, nothing metered -- which is why it can run every time the
// page is opened without costing the owner or the customer anything.
//
// It changes nothing. Every check is a read, and every finding links to the
// page where the owner fixes it themselves. That places it on the self-serve
// side of lib/sonara-agent-authority.cjs, and the module is consulted here
// rather than assumed: if check_data_quality ever moves onto the sensitive
// list, this page stops running rather than quietly continuing.
//
// Two things it deliberately does not do.
//
// It does not hide checks that found nothing. "We looked and it is fine" and
// "we did not look" have to render differently, or a page full of silence reads
// as a clean bill of health it has not earned.
//
// It does not treat a failed read as a clean result. If a table is unavailable
// the page says so for that check. Counting an error as zero findings is the
// exact shape of every blind spot this codebase has had.

const {
  SEVERITY_LABEL,
  checksFor,
  selectFor,
  runCheck,
  summarise
} = require("../lib/sonara-record-checks.cjs");
const journey = require("../lib/sonara-customer-journey.cjs");
const { createRunner } = require("../lib/sonara-agent-runner.cjs");
const search = require("../lib/sonara-search.cjs");
const cash = require("../lib/sonara-cash-position.cjs");
const chase = require("../lib/sonara-chase-drafts.cjs");
const ollama = require("../lib/sonara-ollama-adapter.cjs");
const langflow = require("../lib/sonara-langflow-adapter.cjs");
const openWebUi = require("../lib/sonara-open-webui-adapter.cjs");
const crawl4ai = require("../lib/sonara-crawl4ai-adapter.cjs");
const dify = require("../lib/sonara-dify-adapter.cjs");
const ragflow = require("../lib/sonara-ragflow-adapter.cjs");

// Every adapter on one page, because "which of these is on" is one question.
// Each reports a host and never a URL -- readiness objects carry the configured
// URL non-enumerably for exactly this reason.
const SERVICES = Object.freeze([
  Object.freeze({ label: "Ollama", what: "Runs models on hardware you own. MIT. No key, nothing metered.", readiness: (o) => ollama.getOllamaReadiness(o) }),
  Object.freeze({ label: "Langflow", what: "Runs flows you build in Langflow's own interface, so a flow changes without a deploy here. MIT.", readiness: (o) => langflow.getLangflowReadiness(o) }),
  Object.freeze({ label: "Open WebUI", what: "Puts a chat interface and an OpenAI-compatible interface in front of models you already run. Its licence restricts altering its branding in a deployment you publish; calling it from here is not restricted, and none of it ships inside this product.", readiness: (o) => openWebUi.getOpenWebUiReadiness(o) }),
  Object.freeze({ label: "Crawl4AI", what: "Fetches a page and returns readable text. Apache-2.0. Refuses private, loopback and cloud-metadata addresses.", readiness: (o) => crawl4ai.getCrawl4aiReadiness(o) }),
  Object.freeze({ label: "Dify", what: "Runs a workflow you built in Dify. Its licence allows this for a Dify you run yourself; it does not allow one shared Dify serving many businesses.", readiness: (o) => dify.getDifyReadiness(o) }),
  Object.freeze({ label: "RAGFlow", what: "Answers a question from documents you have loaded into it, and shows which document each passage came from. Apache-2.0. It reads; it never loads your records into it.", readiness: (o) => ragflow.getRagflowReadiness(o) })
]);

const ROW_LIMIT = 500;

// One page per product, because an owner opening Creator Studio should not be
// shown what is wrong with their invoices. The product key is also the
// workspace-access key, so the page is gated by the same rule as everything
// else in that workspace rather than by a second one written here.
const PAGES = Object.freeze([
  Object.freeze({
    product: "business_builder",
    path: "/business-builder/owner/assistant",
    eyebrow: "Business Builder",
    backPath: "/business-builder/owner",
    backLabel: "Back to your business"
  }),
  Object.freeze({
    product: "creator_studio",
    path: "/creator-studio/assistant",
    eyebrow: "Creator Studio",
    backPath: "/creator-studio/dashboard",
    backLabel: "Back to Creator Studio"
  }),
  Object.freeze({
    product: "growth_studio",
    path: "/growth-studio/assistant",
    eyebrow: "Growth Studio",
    backPath: "/growth-studio/dashboard",
    backLabel: "Back to Growth Studio"
  })
]);

module.exports = function registerSonaraAssistantRoutes(app, deps = {}) {
  const layout = deps.layout;
  const brandCard = deps.brandCard;
  const linkAction = deps.linkAction;
  const escapeHtml = deps.escapeHtml;
  // /search is any signed-in customer's own records, so it needs the customer
  // gate rather than a per-workspace one.
  const requireCustomer = deps.requireCustomer;
  const requireWorkspaceAccess = deps.requireWorkspaceAccess;
  const getCustomerPrimaryOrganization = deps.getCustomerPrimaryOrganization;
  const getSupabaseServerConfig = deps.getSupabaseServerConfig;
  const supabaseHeaders = deps.supabaseHeaders;

  if (typeof layout !== "function" || typeof requireWorkspaceAccess !== "function") return;

  // One runner for every assistant page. check_data_quality is on the
  // self-serve list because it reads records and changes nothing; the runner
  // still classifies it on every call rather than trusting that.
  const runner = createRunner();
  runner.register("check_data_quality", async ({ config, organizationId, checks }) => {
    // Up to eleven checks on one page, each reading a different table, none
    // depending on another -- so they were eleven waits in a row for no reason.
    // Promise.all keeps the order, which the severity sort downstream relies on
    // being stable for checks of equal severity.
    return Promise.all(checks.map(async (check) => {
      const read = await readRows(config, check, organizationId);
      // An unreadable table is reported as unavailable rather than as a check
      // that found nothing wrong -- those are opposite conclusions.
      if (!read.ok) return { id: check.id, label: check.label, severity: check.severity, count: 0, findings: [], unavailable: true, why: check.why };
      return runCheck(check, read.rows);
    }));
  });

  // Drafting only. `draft_reply` is on the self-serve list -- "It writes a reply
  // a person still has to send" -- and every action that would actually send
  // classifies as unrecognised and stops at the owner. The runner is asked on
  // every request rather than trusted once, so if draft_reply ever moves onto
  // the sensitive list this page refuses instead of quietly continuing.
  runner.register("draft_reply", async ({ config, organizationId, businessName }) => {
    const [invoices, payments, customers] = await Promise.all([
      readRows(config, { table: "customer_invoices", columns: ["id", "invoice_number", "due_on", "total_cents", "status", "customer_id"] }, organizationId),
      readRows(config, { table: "customer_invoice_payments", columns: ["id", "invoice_id", "amount_cents"] }, organizationId),
      readRows(config, { table: "customers", columns: ["id", "name", "email"] }, organizationId)
    ]);

    // An unreadable table is reported, never counted as "nothing owed". A chase
    // list that is short because a read failed is the most reassuring possible
    // way to be wrong.
    const unavailable = [];
    if (!invoices.ok) unavailable.push("your invoices");
    if (!payments.ok) unavailable.push("payments received");
    if (!customers.ok) unavailable.push("your customers");

    const paidByInvoice = new Map();
    for (const row of payments.ok ? payments.rows : []) {
      const amount = Number(row?.amount_cents);
      if (!row?.invoice_id || !Number.isFinite(amount)) continue;
      paidByInvoice.set(row.invoice_id, (paidByInvoice.get(row.invoice_id) || 0) + amount);
    }

    const customersById = new Map((customers.ok ? customers.rows : []).map((row) => [row?.id, row]));

    // Without the payments table a draft would state the full total on an
    // invoice that may be half settled, so no draft is written at all.
    if (!payments.ok || !invoices.ok) return { unavailable, drafts: [], skipped: [] };

    return { unavailable, ...chase.build({ invoices: invoices.rows, customersById, paidByInvoice, businessName }) };
  });

  function asMoney(cents) {
    const amount = Number(cents);
    if (!Number.isFinite(amount)) return "an unknown amount";
    const sign = amount < 0 ? "-" : "";
    return `${sign}$${(Math.abs(amount) / 100).toFixed(2)}`;
  }

  async function readRows(config, check, organizationId) {
    const query = `?select=${selectFor(check)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=${ROW_LIMIT}`;
    const response = await fetch(`${config.url}/rest/v1/${check.table}${query}`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => []);
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  }

  function findingList(result) {
    // Ten is enough to act on. Past that the list becomes the problem.
    const shown = result.findings.slice(0, 10);
    const rest = result.findings.length - shown.length;
    const items = shown.map((finding) => `<li>${escapeHtml(finding.sentence)}</li>`).join("");
    const more = rest > 0 ? `<p>and ${rest} more.</p>` : "";
    return `<ul>${items}</ul>${more}`;
  }

  function resultCard(result) {
    if (result.unavailable) {
      return brandCard(
        result.label,
        "This check could not run — the records behind it were not reachable just now. It is not a result; try again shortly."
      );
    }
    if (result.count === 0) {
      return brandCard(result.label, "Checked, nothing to fix.");
    }
    const heading = `${result.count} ${result.count === 1 ? "item needs" : "items need"} attention. ${result.why}`;
    return brandCard(result.label, `${heading}${findingList(result)}`);
  }

  for (const page of PAGES) {
    const checks = checksFor(page.product);
    if (checks.length === 0) continue;

    app.get(page.path, requireWorkspaceAccess(page.product), async (req, res) => {
      const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : null;
      const org = typeof getCustomerPrimaryOrganization === "function"
        ? await getCustomerPrimaryOrganization(req.sonaraAccess?.user || req.user, { autoBootstrap: false }).catch(() => null)
        : null;

      if (!config?.ok || !org?.ok || !org.organizationId) {
        return res.status(200).type("html").send(layout({
          title: "Assistant",
          eyebrow: page.eyebrow,
          heading: "Setup required",
          body: "Your workspace is not connected yet, so there are no records to check.",
          sections: [brandCard("What to do", "Finish setting up your workspace and this page will start checking your records.")],
          actions: [linkAction(page.backPath, page.backLabel)]
        }));
      }

      // Through the runner rather than around it. Before this, the page asked
      // the authority module and then did the work regardless of the answer,
      // which is a gate a caller walks past by not reading the return value.
      const run = await runner.run({
        action: { id: `assistant-${page.product}`, action_type: "check_data_quality" },
        context: { config, organizationId: org.organizationId, checks }
      });

      if (run.status === "refused") {
        return res.status(200).type("html").send(layout({
          title: "Assistant",
          eyebrow: page.eyebrow,
          heading: "This needs your approval before it can run",
          body: run.reason,
          sections: [brandCard("Why you are seeing this", "Checking your records has been reclassified as something that needs your say-so. Nothing has run.")],
          actions: [linkAction(page.backPath, page.backLabel)]
        }));
      }

      if (run.status !== "completed") {
        return res.status(200).type("html").send(layout({
          title: "Assistant",
          eyebrow: page.eyebrow,
          heading: "The check could not finish",
          body: "Nothing was changed. This is not a clean result -- it is a check that did not run.",
          sections: [brandCard("What happened", run.reason || "The check stopped before it finished.")],
          actions: [linkAction(page.backPath, page.backLabel)]
        }));
      }

      const summary = summarise(run.result);
      const unavailable = summary.results.filter((result) => result.unavailable).length;
      const ran = summary.results.length - unavailable;

      // The headline never rounds an unreachable check down to "fine".
      const headline = unavailable > 0
        ? `${summary.total} ${summary.total === 1 ? "item needs" : "items need"} attention. ${unavailable} of ${summary.results.length} checks could not run.`
        : summary.total === 0
          ? `All ${ran} checks ran and found nothing to fix.`
          : `${summary.total} ${summary.total === 1 ? "item needs" : "items need"} attention across ${ran} checks.`;

      const sections = [];
      let currentSeverity = "";
      for (const result of summary.results) {
        if (result.severity !== currentSeverity) {
          currentSeverity = result.severity;
          sections.push(brandCard(SEVERITY_LABEL[currentSeverity] || currentSeverity, ""));
        }
        sections.push(resultCard(result));
      }

      const actions = [linkAction(page.backPath, page.backLabel)];
      for (const result of summary.results.slice(0, 3)) {
        const check = checks.find((entry) => entry.id === result.id);
        if (result.count > 0 && check) actions.push(linkAction(check.fixPath, check.fixLabel));
      }

      return res.status(200).type("html").send(layout({
        title: "Assistant",
        eyebrow: page.eyebrow,
        heading: "What needs your attention",
        body: `${headline} Nothing here has been changed -- every item links to the page where you decide what to do about it.`,
        sections,
        actions
      }));
    });
  }

  // /growth-studio/journey -- how many people are at each stage, and where the
  // number drops.
  //
  // The assistant pages say what is broken. A business can have nothing broken
  // and still be losing everybody between enquiry and booking, and no check in
  // this product would mention it.
  //
  // Growth Studio because the traceable half of the journey -- touchpoints,
  // leads, conversions -- is Growth Studio's schema. Bookings and reviews sit
  // beside those as counts, labelled as counts.
  // /business-builder/owner/money-due -- what is promised in both directions.
  //
  // Tool six of the twelve in docs/market/2026-08-11-TRADES-AI-TOOL-STACK.md is
  // a cash forecast at $49 a month. This is not that, and the difference is the
  // point: a forecast predicts revenue nobody has promised yet, and this adds
  // up what has been. An owner deciding whether payroll clears cannot afford to
  // be unable to tell the predicted part from the counted part, so there is no
  // predicted part.
  //
  // It reports movement, not a balance. No table in this product holds the
  // bank balance, and a position computed from an opening balance of zero would
  // read as the money the business has.
  // /business-builder/owner/local-model -- whether this deployment can call a
  // model at all, and what happens when it cannot.
  //
  // Every other surface in this product is arithmetic over the owner's own
  // rows, which is why they can be trusted and why they cost nothing. This is
  // the one place that says what would change if a model were reachable, and
  // it is deliberately owner-only: nothing a customer sees depends on it.
  app.get("/business-builder/owner/local-model", requireWorkspaceAccess("business_builder"), async (req, res) => {
    const states = SERVICES.map((service) => ({ ...service, state: service.readiness() }));
    const ready = states.filter((entry) => entry.state.status === "configured");

    const sections = [
      ...states.map((entry) => brandCard(
        `${entry.label} — ${entry.state.status === "configured" ? "ready" : entry.state.enabled ? "not usable yet" : "off"}`,
        `${entry.what} ${entry.state.detail}`
      )),
      brandCard(
        "Why this is off by default",
        "Nothing in this product needs a model to work. The checks, the money figures and the chase drafts are all arithmetic over your own records, which is why none of them can invent a number and why none of them cost anything to run. A model adds range, never a dependency — if it is unreachable, every page falls back to what it already did."
      ),
      brandCard(
        "What it costs",
        "Nothing per use. Ollama runs models on hardware you already own, under an MIT licence, and needs no account and no key. That is the whole reason it is the first one wired in rather than a hosted provider that bills per token."
      ),
      brandCard(
        "The part that catches people out",
        "This application runs as serverless functions. A model on your own laptop is not reachable from there — a localhost address in production means the server's own container, where nothing is listening. It has to be a host this server can reach, or the application has to run somewhere that shares a network with it. This page names that case rather than letting you find it as a timeout."
      ),
      brandCard(
        "How to turn one on",
        `Each takes the same three settings: <PREFIX>_ENABLED=true, <PREFIX>_URL pointing at an address this server can reach, and <PREFIX>_TIMEOUT_MS optionally, capped at ${ollama.MAX_TIMEOUT_MS}ms so a service that hangs cannot hold a request open until the platform kills it. Ollama and Open WebUI also need a model; Langflow needs a flow id.`
      ),
      brandCard(
        "Making a service on your own machine reachable",
        "There are three ways, in the order worth trying them: a tunnel such as Cloudflare Tunnel or Tailscale Funnel, which needs no architecture change and is free at this scale; running the service on a host this server can already reach; or running this application beside the services on one network, which removes the constraint rather than working around it. docs/architecture/EXTERNAL-SERVICES.md has the detail — including the part people skip, which is that a tunnel makes your service reachable by everybody, and Ollama and Crawl4AI have no authentication of their own."
      )
    ];

    return res.status(200).type("html").send(layout({
      title: "Connected services",
      eyebrow: "Business Builder",
      heading: "Services you run yourself",
      body: ready.length > 0
        ? `${ready.length} of ${states.length} configured: ${escapeHtml(ready.map((entry) => `${entry.label} at ${entry.state.host}`).join(", "))}.`
        : "None of these are configured. Everything in this product works without them.",
      sections,
      actions: [linkAction("/business-builder/owner", "Back to your business"), linkAction("/business-builder/owner/assistant", "What needs attention")]
    }));
  });

  app.get("/business-builder/owner/chase-drafts", requireWorkspaceAccess("business_builder"), async (req, res) => {
    const back = linkAction("/business-builder/owner/receivables", "Money owed to you");
    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : null;
    const org = typeof getCustomerPrimaryOrganization === "function"
      ? await getCustomerPrimaryOrganization(req.sonaraAccess?.user || req.user, { autoBootstrap: false }).catch(() => null)
      : null;

    const page = (heading, body, sections) => res.status(200).type("html").send(layout({
      title: "Chase drafts",
      eyebrow: "Business Builder",
      heading,
      body,
      sections,
      actions: [back, linkAction("/business-builder/owner/money-due", "Money due in and out")]
    }));

    if (!config?.ok || !org?.ok || !org.organizationId) {
      return page("Setup required", "Your workspace is not connected yet, so there are no invoices to write about.", []);
    }

    const run = await runner.run({
      action: { id: "chase-drafts", action_type: "draft_reply" },
      context: { config, organizationId: org.organizationId, businessName: org.organizationName || org.name || "" }
    });

    if (run.status !== "completed") {
      return page(
        "Not available right now",
        run.status === "refused"
          ? "Writing these drafts is not currently allowed under your rules, so nothing has been written."
          : "The drafts could not be prepared just now. Nothing has been sent, and nothing has changed.",
        [brandCard("What this means", escapeHtml(String(run.reason || "No reason recorded.")))]
      );
    }

    const { drafts = [], skipped = [], unavailable = [] } = run.result || {};
    const sections = [];

    if (unavailable.length > 0) {
      sections.push(brandCard(
        "Some records could not be read",
        `${unavailable.join(", ")} could not be loaded, so this list is incomplete. It is not a shorter list of debts; it is an unfinished one. No draft has been written against a figure that might be wrong.`
      ));
    }

    for (const draft of drafts) {
      // A readonly textarea rather than a copy button: the CSP is
      // script-src 'self' and there is no bundler, so a button would need
      // inline script. Selecting the text works everywhere and cannot fail
      // silently the way a clipboard call can.
      sections.push(`<article class="card sonara-depth" data-sonara-enter>
        <h2>${escapeHtml(draft.customerName)} — ${escapeHtml(draft.reference)}</h2>
        <p>${escapeHtml(`${draft.stageLabel}. ${asMoney(draft.outstandingCents)} outstanding, ${draft.daysOverdue} days past due.${draft.customerEmail ? ` Send to ${draft.customerEmail}.` : " No email address on this customer."}`)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(draft.subject)}</p>
        <label for="draft-${escapeHtml(draft.invoiceId)}">Message</label>
        <textarea id="draft-${escapeHtml(draft.invoiceId)}" rows="12" readonly>${escapeHtml(draft.body)}</textarea>
      </article>`);
    }

    for (const entry of skipped) {
      sections.push(brandCard(`No draft for ${entry.reference}`, entry.reason));
    }

    sections.push(brandCard(
      "Nothing here has been sent",
      "These are drafts. This product does not send them, and it will not: sending something to a customer is one of the things your own rules keep behind your approval. Read each one, change what you want, and send it yourself from your own email."
    ));

    sections.push(brandCard(
      "Written from your records, not by a model",
      "Every figure above comes from your own invoices and the payments recorded against them. Nothing is generated, which is why these read like forms — and also why none of them can claim a reminder you never sent, a payment term you never agreed, or a late fee you cannot charge."
    ));

    const headline = drafts.length === 0
      ? (skipped.length > 0
        ? "Nothing here can be drafted yet — see below for what each invoice needs first."
        : "Nothing is overdue. There is nothing to chase.")
      : `${drafts.length} ${drafts.length === 1 ? "invoice needs" : "invoices need"} chasing, most overdue first.`;

    return page("Chase drafts", headline, sections);
  });

  app.get("/business-builder/owner/money-due", requireWorkspaceAccess("business_builder"), async (req, res) => {
    const back = linkAction("/business-builder/owner", "Back to your business");
    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : null;
    const org = typeof getCustomerPrimaryOrganization === "function"
      ? await getCustomerPrimaryOrganization(req.sonaraAccess?.user || req.user, { autoBootstrap: false }).catch(() => null)
      : null;

    const page = (heading, body, sections) => res.status(200).type("html").send(layout({
      title: "Money due in and out",
      eyebrow: "Business Builder",
      heading,
      body,
      sections,
      actions: [
        back,
        linkAction("/business-builder/owner/receivables", "Money owed to you"),
        linkAction("/business-builder/owner/invoices", "Bills you owe")
      ]
    }));

    if (!config?.ok || !org?.ok || !org.organizationId) {
      return page(
        "Setup required",
        "Your workspace is not connected yet, so there is nothing to add up.",
        [brandCard("What to do", "Finish setting up your workspace and this page will start reading your own invoices.")]
      );
    }

    const [incoming, outgoing, received] = await Promise.all([
      readRows(config, { table: cash.SOURCES.incoming.table, columns: cash.SOURCES.incoming.columns }, org.organizationId),
      readRows(config, { table: cash.SOURCES.outgoing.table, columns: cash.SOURCES.outgoing.columns }, org.organizationId),
      readRows(config, { table: cash.SOURCES.received.table, columns: cash.SOURCES.received.columns }, org.organizationId)
    ]);

    const view = cash.build({ incoming, outgoing, received });

    const sections = view.rows.map((row) => {
      const detail = row.incomingCount === 0 && row.outgoingCount === 0
        ? "Nothing due in this period."
        : `${asMoney(row.incomingCents)} coming in from ${row.incomingCount} ${row.incomingCount === 1 ? "invoice" : "invoices"}, ` +
          `${asMoney(row.outgoingCents)} going out across ${row.outgoingCount} ${row.outgoingCount === 1 ? "bill" : "bills"}. ` +
          `Net ${asMoney(row.netCents)}.`;
      return brandCard(row.label, detail);
    });

    // Everything that makes the totals less than the whole picture is said
    // before the totals, not in a footnote under them.
    if (view.unavailable.length > 0) {
      sections.unshift(brandCard(
        "Some of this could not be read",
        `${view.unavailable.join(" and ")} could not be loaded just now, so the figures below are missing part of the picture. They are not a smaller total; they are an incomplete one.`
      ));
    }

    if (view.undated.incomingCount > 0 || view.undated.outgoingCount > 0) {
      const parts = [];
      if (view.undated.incomingCount > 0) {
        parts.push(`${asMoney(view.undated.incomingCents)} owed to you across ${view.undated.incomingCount} ${view.undated.incomingCount === 1 ? "invoice" : "invoices"} with no due date`);
      }
      if (view.undated.outgoingCount > 0) {
        parts.push(`${asMoney(view.undated.outgoingCents)} you owe across ${view.undated.outgoingCount} ${view.undated.outgoingCount === 1 ? "bill" : "bills"} with no due date`);
      }
      sections.unshift(brandCard(
        "Money with no date on it",
        `${parts.join(", and ")}. None of it appears in the periods below, because there is no way to say when it lands. Give each one a due date and it will.`
      ));
    }

    sections.push(brandCard(
      "This is not a forecast",
      "Every figure here is money somebody has already been invoiced for, or a bill that has already arrived. Nothing is predicted or averaged from past months. It is also movement rather than a balance — this does not know what is in your bank account, so it cannot tell you what you will have, only what is due to move."
    ));

    const headline = view.complete
      ? `${asMoney(view.totalIncoming)} due in, ${asMoney(view.totalOutgoing)} due out. Net ${asMoney(view.netCents)}.`
      : `${asMoney(view.totalIncoming)} due in and ${asMoney(view.totalOutgoing)} due out of what could be dated and read — see above for what is missing.`;

    return page("Money due in and out", headline, sections);
  });

  app.get("/growth-studio/journey", requireWorkspaceAccess("growth_studio"), async (req, res) => {
    const back = linkAction("/growth-studio/dashboard", "Back to Growth Studio");
    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : null;
    const org = typeof getCustomerPrimaryOrganization === "function"
      ? await getCustomerPrimaryOrganization(req.sonaraAccess?.user || req.user, { autoBootstrap: false }).catch(() => null)
      : null;

    if (!config?.ok || !org?.ok || !org.organizationId) {
      return res.status(200).type("html").send(layout({
        title: "Customer journey",
        eyebrow: "Growth Studio",
        heading: "Setup required",
        body: "Your workspace is not connected yet, so there is nothing to count.",
        sections: [brandCard("What to do", "Finish setting up your workspace and this page will start counting your own records.")],
        actions: [back]
      }));
    }

    const results = [];
    let unreachable = 0;
    for (const stage of journey.STAGES) {
      const read = await readRows(config, stage, org.organizationId);
      if (!read.ok) {
        unreachable += 1;
        results.push(journey.countStage(stage, []));
        continue;
      }
      results.push(journey.countStage(stage, read.rows));
    }

    const view = journey.build(results);

    // An unreadable table is never rounded into a zero.
    const headline = unreachable > 0
      ? `${unreachable} of ${journey.STAGES.length} stages could not be read, so these numbers are incomplete.`
      : view.worst
        ? `Your biggest measurable drop is into "${view.worst.label}" -- ${view.worst.dropRate}% of the stage before it does not arrive.`
        : view.total === 0
          ? "Nothing recorded at any stage yet."
          : "No measurable drop between the stages that can be traced.";

    const sections = view.stages.map((stage) => {
      const rate = stage.dropRate === null
        ? "Counted, not compared."
        : `${stage.dropRate}% fewer than ${stage.comparedWith}.`;
      return brandCard(`${stage.label} — ${stage.count}`, `${rate} ${stage.plain}`);
    });

    sections.push(brandCard(
      "Why some of these are counts and not rates",
      "Touchpoints, leads and conversions each record which lead they belong to, so a drop between them is one person not arriving. Bookings and reviews do not record a lead, so comparing them with the stages above would be a ratio between two unrelated numbers. It would look exactly like a measurement, so this page counts them instead."
    ));

    return res.status(200).type("html").send(layout({
      title: "Customer journey",
      eyebrow: "Growth Studio",
      heading: "Where people fall out",
      body: `${headline} Every number here is counted from your own records.`,
      sections,
      actions: [back, linkAction("/growth-studio/leads", "Open leads"), linkAction("/growth-studio/assistant", "What needs attention")]
    }));
  });

  // /search -- find one record among thousands.
  //
  // This product had none. An owner with two years of bookings could open the
  // bookings page, see the most recent hundred, and have no way to find the one
  // from March. Every record page had the same hole, and none of them looked
  // broken, which is why it went unnoticed.
  // Without the customer gate this route would be registered with `undefined`
  // as its middleware, which Express accepts and then fails on at request time
  // -- so the page would 500 rather than never existing. Skipping registration
  // is the honest failure: the route 404s, which is visible immediately.
  if (typeof requireCustomer === "function") {
  app.get("/search", requireCustomer, async (req, res) => {
    const raw = typeof req.query.q === "string" ? req.query.q : "";
    const term = search.escapeTerm(raw);
    const back = linkAction("/dashboard", "Back to your dashboard");

    const form = `<form method="get" action="/search" class="sonara-form" role="search">
      <label for="sonara-search-q">Search your records</label>
      <input id="sonara-search-q" name="q" type="search" value="${escapeHtml(term)}" placeholder="A name, a phone number, an invoice number" minlength="${search.MINIMUM_TERM}" autocomplete="off">
      <button type="submit">Search</button>
    </form>`;

    const page = (heading, body, sections) => res.status(200).type("html").send(layout({
      title: "Search",
      eyebrow: "SONARA One",
      heading,
      body,
      sections: [form, ...sections],
      actions: [back]
    }));

    if (!search.isUsableTerm(raw)) {
      return page(
        "Search your records",
        raw ? `Type at least ${search.MINIMUM_TERM} characters. One letter matches almost everything, which is a list nobody can use.` : "Find a booking, a customer, an invoice, a lead — anything you have saved.",
        []
      );
    }

    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : null;
    const org = typeof getCustomerPrimaryOrganization === "function"
      ? await getCustomerPrimaryOrganization(req.sonaraAccess?.user || req.user, { autoBootstrap: false }).catch(() => null)
      : null;

    if (!config?.ok || !org?.ok || !org.organizationId) {
      return page("Setup required", "Your workspace is not connected yet, so there are no records to search.", []);
    }

    // Eighteen tables, asked at the same time rather than one after another.
    //
    // This awaited inside the loop, so a search made eighteen round trips in
    // series -- roughly a second of latency before anything rendered, on the
    // most latency-sensitive screen in the product, and every one of those
    // waits was for a query that depended on none of the others.
    //
    // Promise.all keeps the order, which matters: the groups render in
    // SEARCHABLE order and a customer who searched twice should see the same
    // arrangement both times.
    const groups = await Promise.all(search.SEARCHABLE.map(async (entry) => {
      const response = await fetch(`${config.url}/rest/v1/${entry.table}${search.queryFor(entry, term, org.organizationId)}`, {
        headers: supabaseHeaders(config)
      }).catch(() => undefined);
      // A table that could not be read stays marked unavailable rather than
      // becoming an empty result -- "we could not look there" is not "nothing
      // was found there", and on a search those are opposite answers.
      if (!response?.ok) return { label: entry.label, rows: [], unavailable: true };
      const rows = await response.json().catch(() => []);
      return { label: entry.label, path: entry.path, entry, rows: Array.isArray(rows) ? rows : [] };
    }));

    const summary = search.summarise(groups, term);

    const sections = summary.groups.map((group) => {
      const items = group.rows.map((row) => {
        const hit = search.matchedField(group.entry, row, term);
        const where = hit ? ` — matched ${hit.column.replace(/_/g, " ")}: ${hit.value}` : "";
        return `<li>${escapeHtml(group.entry.display(row))}${escapeHtml(where)}</li>`;
      }).join("");
      const more = group.rows.length >= search.PER_TABLE_LIMIT
        ? `<p>Showing the first ${search.PER_TABLE_LIMIT}. Narrow the search or open the page to see the rest.</p>`
        : "";
      return brandCard(`${group.label} — ${group.rows.length}`, `<ul>${items}</ul>${more}${linkAction(group.path, `Open ${group.label.toLowerCase()}`)}`);
    });

    // A table that could not be read is not a table with no matches. Merging
    // the two would tell an owner their record is gone when it is not.
    const headline = summary.unavailable > 0
      ? `${summary.total} ${summary.total === 1 ? "match" : "matches"} across ${summary.searched} record types. ${summary.unavailable} could not be searched, so this is not a complete answer.`
      : summary.total === 0
        ? `Nothing matched "${term}" in any of your ${summary.searched} record types.`
        : `${summary.total} ${summary.total === 1 ? "match" : "matches"} for "${term}".`;

    return page("Search your records", headline, sections);
  });
  }
};
