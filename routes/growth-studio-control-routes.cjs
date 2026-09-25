Warning: truncated output (original token count: 32824)
Total output lines: 2130

// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createHash, randomUUID } = require("node:crypto");
const { finiteNumber } = require("../lib/sonara-owner-record-pages.cjs");
const {
  getGrowthProvider,
  _getGrowthProviderReadiness,
  getGrowthProviderCatalog,
  chooseGrowthProvider
} = require("../lib/growth-studio-provider-registry.cjs");
const { GROWTH_RECORD_PAGES } = require("../lib/sonara-growth-record-pages.cjs");
const { getGrowthCreateSpec, CONSENT_CHANNELS } = require("../lib/sonara-growth-create-specs.cjs");
const leadConversion = require("../lib/sonara-lead-conversion.cjs");
const { getGoogleSearchConsoleReadContract } = require("../lib/sonara-google-search-console-read.cjs");

const { GROWTH_TABLES: TABLES } = require("../lib/sonara-growth-tables.cjs");
const { authoriseCampaign } = require("../lib/growth-studio-sender.cjs");
const { dispatchCampaign } = require("../lib/growth-studio-dispatch.cjs");
const { siteOrigin } = require("../lib/sonara-site-origin.cjs");
const { readSuppressions, markSuppressed } = require("../lib/growth-studio-suppression.cjs");
const {
  UNSUBSCRIBE_PATH,
  deriveSigningKey,
  verifyToken
} = require("../lib/growth-studio-unsubscribe.cjs");
const { mayApproveOwnerAction } = require("../lib/sonara-agent-authority.cjs");
const {
  createBalanceReader,
  createLedgerAppender,
  DEFAULT_STARTING_ALLOWANCE_MINOR
} = require("../lib/sonara-usage-meter.cjs");
const { createSendRecorder, createSendRecordReader, remainderFrom } = require("../lib/growth-studio-send-records.cjs");

// How many people one request may mail, and the arithmetic behind the number.
//
// RAISED 400 -> 1000 on 10 September 2026, when `dispatchCampaign` gained
// batching. The number is derived from the same budget as before and the working
// is here so it can be rechecked rather than trusted.
//
// Vercel's duration limits, read from
// vercel.com/docs/functions/configuring-functions/duration on 10 September
// 2026: with fluid compute (enabled by default) the DEFAULT is 300 seconds on
// Hobby, Pro and Enterprise alike, and `vercel.json` sets no `maxDuration`, so
// 300 seconds is what this actually gets. Costs are figured at a deliberately
// pessimistic 500ms per call -- not the ~150ms a healthy call takes, because a
// cap has to hold on a bad day:
//
//   * 1,000 recipients in batches of 100 is **10 calls, 5 seconds**.
//   * The suppression read is at most 30 pages, **15 seconds**.
//   * The worst case is the fallback: a batch that does not return one id per
//     email is resent one recipient at a time, and `MAX_FALLBACK_BATCHES`
//     bounds that at two batches -- **200 calls, 100 seconds**.
//
// 5 + 15 + 100 is 120 seconds against 300, so the cap holds even when the two
// permitted fallbacks both fire. It is the fallback rather than the batching
// that sets this ceiling, which is why raising MAX_FALLBACK_BATCHES is not free.
//
// **Above the cap the campaign is refused, never truncated.** Sending to the
// first 1,000 of 3,000 and reporting "1,000 sent" is true and useless: the owner
// believes the campaign went out. Reaching further than this needs sending
// across more than one invocation, which is a queue and is not built.
const MAX_RECIPIENTS_PER_SEND = 1000;

// Consent rows are per channel AND purpose, so one contact can have several even
// after filtering to email. A truncated consent read would make people who did
// consent look like people who did not -- safe in that it sends to fewer, but it
// would report "skipped for consent" about contacts whose permission is on file,
// which is a wrong reason shown to an owner. Refused instead.
const CONSENT_ROW_LIMIT = 5000;

const OUTBOUND_CHANNELS = new Set(["email", "sms", "push", "whatsapp"]);
const AUTOMATION_TRIGGERS = new Set(["lead_created", "lead_qualified", "form_submitted", "campaign_started", "conversion_recorded", "consent_granted", "content_ready"]);
const AUTOMATION_ACTIONS = new Set(["create_task", "notify_owner", "add_to_segment", "enqueue_email", "sync_provider", "send_webhook"]);
const APPROVAL_OPERATIONS = new Set(["direct_post", "draft_upload", "content_publish", "campaign_mutation", "budget_change", "ad_mutation", "campaign_send"]);

module.exports = function registerGrowthStudioControlRoutes(app, deps = {}) {
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => pass;
  const requirePaidOrOwnerAccess = typeof deps.requirePaidOrOwnerAccess === "function" ? deps.requirePaidOrOwnerAccess : requireWorkspaceAccess;
  const access = requireWorkspaceAccess("growth_studio");
  const paidAccess = requirePaidOrOwnerAccess("growth_studio");
  const ui = buildUi(deps);

  app.get("/api/growth/providers", access, (req, res) => {
    return res.status(200).json({ ok: true, providers: getGrowthProviderCatalog() });
  });

  app.get("/api/growth/readiness", access, async (req, res) => {
    const config = getConfig(deps);
    const providers = getGrowthProviderCatalog();
    return res.status(200).json({
      ok: true,
      database: config.ok ? "configured" : "setup_required",
      providers,
      executionCanary: getGoogleSearchConsoleReadContract(),
      configuredProviders: providers.filter((provider) => provider.readiness.configured).map((provider) => provider.key),
      controls: {
        credentials: "server_only",
        directBrowserWrites: "revoked",
        publicPublishing: "human_approval_required",
        paidMediaMutation: "human_approval_required",
        lifecycleMessaging: "purpose_specific_consent_required",
        attribution: "model_and_confidence_recorded",
        sampledReports: "sampling_and_freshness_preserved",
        revenueGuarantees: false,
        autonomousBudgetIncreases: false,
        arbitraryAutomationCode: false
      }
    });
  });

  // Turning a won lead into a customer.
  //
  // growth_leads and customers hold the same four fields and nothing joined
  // them, so a lead that closed had to be retyped before it could be quoted or
  // invoiced. That seam is what the "one system" claim is about: Growth Studio
  // finds the work, Business Builder bills it.
  //
  // Both tables belong to the same organization, so this crosses a product
  // boundary and not a tenancy one -- and every read and write below still
  // carries the organization rather than trusting that.
  //
  // The owner acting, not an agent, for the same reason as the quote step: a
  // person pressing a button they can see is the person.
  app.post("/api/growth-studio/leads/:leadId/customer", access, async (req, res) => {
    // The button on /growth-studio/enquiries posts here from a plain form, so
    // the reply has to be a page. Handing a browser the JSON body shows the
    // owner a wall of punctuation and loses the customer they just created --
    // a working endpoint that reads as a crash.
    const back = "/growth-studio/enquiries";
    const respond = (status, payload) => {
      if (!acceptsHtml(req)) return res.status(status).json(payload);
      // Somewhere useful on success: the customer now exists, so show it.
      if (payload.ok) return res.redirect(303, "/business-builder/owner/customers");
      return res.redirect(303, `${back}?problem=${encodeURIComponent(payload.code || "not_converted")}`);
    };

    const context = await resolveContext(req, deps);
    if (!context.ok) return respond(context.status, context);
    if (!validUuid(req.params.leadId)) return respond(400, { ok: false, code: "invalid_lead_id" });
    const config = getConfig(deps);
    if (!config.ok) return respond(503, { ok: false, code: "supabase_setup_required" });

    const found = await loadOne(config, TABLES.leads, context, req.params.leadId);
    if (!found.ok) return respond(found.status, { ok: false, code: found.code });
    const lead = found.row;

    // Existing customers are read before deciding. An unreadable list is not an
    // empty one -- treating a failed read as "no duplicates" is how the same
    // person ends up in the customer list twice with half the invoices on each.
    const customers = await list(config, TABLES.customers, context, 1000);
    if (!customers.ok) return respond(503, { ok: false, code: "cannot_check_existing_customers" });

    const refusal = leadConversion.reasonNotConvertible(lead, customers.rows);
    if (refusal) return respond(409, { ok: false, code: "not_convertible", reason: refusal });

    const created = await insert(config, TABLES.customers, leadConversion.customerFromLead(lead, {
      organizationId: context.organizationId,
      userId: context.userId
    }));
    if (!created.ok) return respond(502, { ok: false, code: created.code });

    const customerId = created.rows[0]?.id || null;
    if (!customerId) return respond(502, { ok: false, code: "customer_id_missing" });

    // Best-effort, and deliberately after the customer exists. If this fails
    // the customer is real and the lead simply does not know about it yet,
    // which an owner can see and fix. Failing the whole thing here would leave
    // the customer created and the caller told it was not.
    const linked = await patchRows(config, TABLES.leads, context, lead.id, { customer_id: customerId });
    if (created.ok) await controlEvent(config, context, "lead.converted", "success", { lead_id: lead.id, customer_id: customerId, linked: linked.ok });

    return respond(201, { ok: true, customerId, leadLinked: linked.ok });
  });

  app.get("/api/growth/campaigns", access, listHandler(TABLES.campaigns, deps, "campaigns"));
  app.post("/api/growth/campaigns", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const name = clean(req.body.name, 240);
    if (!name) return res.status(400).json({ ok: false, code: "campaign_name_required" });
    const created = await insert(config, TABLES.campaigns, {
      organization_id: context.organizationId,
      user_id: context.userId,
      platform_id: validUuid(req.body.platform_id || req.body.platformId) ? String(req.body.platform_id || req.body.platformId) : null,
      name,
      goal: nullable(req.body.goal, 1000),
      channel: nullable(req.body.channel, 120),
      status: oneOf(req.body.status, ["draft", "active", "paused", "completed", "archived"], "draft"),
      metadata: parseObject(req.body.metadata, {})
    });
    if (created.ok) {
      await controlEvent(config, context, "campaign.created", "success", { campaign_id: created.rows[0]?.id, name });
      if (typeof deps.insertActivityEvent === "function") {
        await deps.insertActivityEvent(context.organizationId, context.userId, "growth_studio.campaign_created", {
          campaign_id: created.rows[0]?.id || null,
          channel: created.rows[0]?.channel || null
        });
      }
    }
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, campaign: created.rows[0], code: created.code });
  });

  // Actually send it.
  //
  // `lib/growth-studio-sender.cjs` decides and `lib/growth-studio-dispatch.cjs`
  // sends; this is the only thing that reads the database, and it is deliberately
  // the only one of the three that cannot be tested without stubs. Everything
  // worth getting right lives in the two it calls.
  //
  // ## Why the meter is the only paywall here
  //
  // This uses `access` rather than `paidAccess`, and that is a choice. The meter
  // already refuses with a 402 naming the reason, and stacking an entitlement
  // gate in front of it means an organization with credit can still be turned
  // away by the other one -- with whichever message that middleware happens to
  // produce rather than the one written for this. One gate, and it is the one
  // that can explain itself.
  //
  // ## The approval, and the limit of what this route can check
  //
  // AGENTS.md forbids automating a customer campaign without owner approval, so
  // the request must carry an explicit attestation and the approver recorded is
  // the authenticated person who posted it -- the same pattern as
  // `/api/growth/content/:contentId/publish`. A person pressing a button they
  // can see is the person; this is not an agent acting unattended.
  //
  // **And the approver has to be entitled to approve.** This was open until
  // 10 September 2026, recorded here as a thing the route could not do:
  // `getCustomerPrimaryOrganization` returned no role, so any active member of
  // the workspace could approve a send.
  //
  // That was not hypothetical. `business_memberships.role` defaults to
  // `employee` and staff are invited as `manager` or `employee`, so an invited
  // employee could email the whole customer list. The resolver now carries the
  // role and `mayApproveOwnerAction` in lib/sonara-agent-authority.cjs decides
  // -- in that module rather than here, because it is AGENTS.md's rule as code
  // and scripts/verify-supabase-contract.mjs checks it on every release, so
  // weakening it fails the build instead of shipping quietly.
  // Two entry points, one handler. The API caller names the campaign in the
  // path; the form on /growth-studio/your-campaigns cannot, because an HTML
  // `<select>` sets a field and not a path segment. Rather than two
  // implementations that will diverge, the id is read from whichever place it
  // came from and everything after that is the same code.
  async function sendCampaign(req, res, campaignIdFrom) {
    // A browser posting a form needs a page back. Handing it the JSON body
    // shows the owner a wall of punctuation after pressing Send, which reads as
    // a crash even when 460 emails went out.
    const back = "/growth-studio/your-campaigns";
    const respond = (status, payload) => {
      if (!acceptsHtml(req)) return res.status(status).json(payload);
      const query = payload.ok
        ? `sent=${encodeURIComponent(payload.sent)}&skipped=${encodeURIComponent((payload.skipped || []).length)}&failed=${encodeURIComponent((payload.failed || []).length)}`
        : `problem=${encodeURIComponent(payload.code || "not_sent")}`;
      return res.redirect(303, `${back}?${query}`);
    };

    const context = await resolveContext(req, deps);
    if (!context.ok) return respond(context.status, { ok: false, code: context.code });
    if (!validUuid(campaignIdFrom)) return respond(400, { ok: false, code: "invalid_campaign_id" });

    // Before anything is read, because an approval nobody gave is the end of the
    // decision and there is no reason to touch the database to find that out.
    if (!truthy(req.body.approved || req.body.approval_attested || req.body.approvalAttested)) {
      return respond(400, {
        ok: false,
        code: "explicit_campaign_approval_required",
        reason: "A customer campaign needs your explicit approval before it can be sent. Nothing was sent and nothing was charged."
      });
    }

    // Asked before the message is even read, and before any database work: an
    // approval this person was not entitled to give is the end of the decision.
    const entitled = mayApproveOwnerAction(context.role);
    if (!entitled.allowed) {
      return respond(entitled.code === "role_unknown" ? 503 : 403, { ok: false, code: entitled.code, reason: entitled.reason });
    }

    const subject = clean(req.body.subject, 300);
    const body = clean(req.body.body || req.body.message, 20000);
    if (!subject || !body) return respond(400, { ok: false, code: "campaign_message_required", reason: "A campaign needs a subject and a body." });

    const config = getConfig(deps);
    if (!config.ok) return respond(503, { ok: false, code: "supabase_setup_required" });

    const loaded = await loadOne(config, TABLES.campaigns, context, campaignIdFrom);
    if (!loaded.ok) return respond(loaded.status, { ok: false, code: loaded.code });
    const campaign = loaded.row;

    // `completed` and `archived` are the owner having said this campaign is
    // finished or put away. Sending from either is the kind of action whose
    // result cannot be undone once the mail has gone.
    if (campaign.status === "completed" || campaign.status === "archived") {
      return respond(409, { ok: false, code: "campaign_not_sendable", reason: `This campaign is ${display(campaign.status)}. Reopen it before sending.` });
    }

    // Default narrow. `growth_leads.campaign_id` is the only audience linkage the
    // schema actually has -- `growth_audience_segments` holds a definition and an
    // estimated count, with no membership rows -- so "the whole lead list" is the
    // only alternative, and mailing an organization's entire list because
    // somebody pressed a button on one campaign is the wrong thing to do by
    // default. Widening it is one explicit field.
    const audience = oneOf(req.body.audience, ["campaign", "organization"], "campaign");

    const loadedRecipients = await loadCampaignRecipients(config, context, { campaignId: campaign.id, audience });
    if (!loadedRecipients.ok) {
      // Never "nobody consented". A read that did not answer is not a list of
      // people who said no, and reporting it as one would tell the owner
      // something definite about their own contacts on the strength of a request
      // that failed.
      return respond(loadedRecipients.status, { ok: false, code: loadedRecipients.code, reason: loadedRecipients.reason });
    }

    // The provider's suppression list, read before the decision so a dead
    // address is skipped with a named reason rather than mailed and billed.
    //
    // This is a screen on top of the consent rules and not one of them, so a
    // failed read does not refuse the campaign -- it sends unscreened and says
    // so. Never silently: the response and the control event both carry whether
    // the screen ran.
    const suppression = await readSuppressions({
      getEnv: typeof deps.getEnv === "function" ? deps.getEnv : undefined,
      fetchImpl: typeof deps.fetchImpl === "function" ? deps.fetchImpl : undefined
    }).catch((error) => ({ ok: false, code: "unreadable", addresses: new Set(), origins: new Map(), reason: String(error?.message || error) }));

    const screened = markSuppressed(loadedRecipients.recipients, suppression);

    // "Send only to the people this campaign has not reached yet."
    //
    // The piece lib/growth-studio-dispatch.cjs named as blocked on a
    // per-recipient record, now that `public.growth_campaign_sends` is that
    // record. It exists because of one specific harm the dispatcher already
    // describes in its own header: a campaign that reached 900 of 1,000 told
    // the owner which 100 were missed, and the only way to reach those 100 was
    // to send the whole campaign again -- mailing the first 900 twice.
    //
    // ## It refuses rather than guesses, and that is the whole feature
    //
    // `remainderFrom` takes the read OUTCOME, not the rows, and answers
    // `known: false` when the read did not succeed. This handler honours that
    // by REFUSING to send, because the alternative is the failure mode the
    // record was built to end: an unreadable record produces zero accepted
    // rows, zero accepted rows makes every recipient look unreached, and
    // "everybody is unreached" mails everybody a second time.
    //
    // So a failed read here is a 503 and nothing is sent. That is shape 4 from
    // .claude/skills/checks-that-cannot-lie applied at a route boundary: absent
    // is not false, and three states rather than two.
    //
    // ## Narrowed before authorisation, not after
    //
    // The remainder is computed above `authoriseCampaign` on purpose. The
    // charge is drawn from the authorised set, so narrowing afterwards would
    // authorise and bill for 1,000 while sending to 100. Consent screening
    // still runs first, so somebody who withdrew consent since the first send
    // is not pulled back in by being "unreached".
    const remainderOnly = truthy(req.body.remainder_only || req.body.remainderOnly);
    let remainderState = null;
    let audienceRecipients = screened.recipients;

    if (remainderOnly) {
      const readRecord = typeof deps.readCampaignSends === "function"
        ? deps.readCampaignSends
        : createSendRecordReader({ getSupabaseServerConfig: () => config });

      const outcome = await readRecord({ organizationId: context.organizationId, campaignId: campaign.id })
        .catch((error) => ({ ok: false, code: "send_record_read_threw", rows: [], detail: String(error?.message || error) }));

      remainderState = remainderFrom(screened.recipients, outcome);

      if (!remainderState.known) {
        await controlEvent(config, context, "campaign.remainder_refused", "refused", {
          campaign_id: campaign.id,
          code: remainderState.code,
          approved_by: context.userId
        }, campaign.id);
        return respond(503, {
          ok: false,
          code: "remainder_unknown",
          reason: `${remainderState.detail} Nothing was sent and nothing was charged.`,
          remainderCode: remainderState.code
        });
      }

      if (remainderState.remainder.length === 0) {
        // Not an error and not a send. 409 rather than 200 because the owner
        // asked for something that did not happen, and a 200 with "sent: 0"
        // reads as a campaign that failed.
        return respond(409, {
          ok: false,
          code: "all_reached",
          reason: remainderState.detail,
          alreadyReached: remainderState.alreadyReached
        });
      }

      audienceRecipients = remainderState.remainder;
    }

    const readLedger = typeof deps.readUsageLedger === "function"
      ? deps.readUsageLedger
      : createBalanceReader({ organizationId: context.organizationId, getSupabaseServerConfig: () => config });
    const history = await readLedger({ organizationId: context.organizationId }).catch((error) => ({
      ok: false,
      rows: [],
      reason: String(error?.message || error)
    }));

    const allowanceMinor = typeof deps.campaignStartingAllowanceMinor === "number"
      ? deps.campaignStartingAllowanceMinor
      : DEFAULT_STARTING_ALLOWANCE_MINOR;

    const decision = authoriseCampaign({
      // The approver is the authenticated caller, never a value from the body. A
      // request that could name its own approver is a request that approves
      // itself.
      approval: { status: "approved", approved_by: context.userId },
      // The narrowed set when this is a remainder send, and every consenting
      // recipient otherwise. Authorised and therefore CHARGED for what is
      // actually being sent -- see the remainder block above for why the
      // narrowing has to happen before this call and not after it.
      recipients: audienceRecipients,
      history,
      allowanceMinor,
      channel: "email"
    });

    if (!decision.allowed) {
  await controlEvent(config, context, "campaign.send_refused", "refused", { campaign_id: campaign.id, code: decision.code, skipped: decision.skipped.length, approved_by: context.userId }, campaign.id);
      // 402 only for credit. "Nobody on your list consented" is not something
      // buying credit fixes, and a blanket 402 would have an owner pay to be
      // refused again.
      const status = decision.code === "insufficient_credit" ? 402 : decision.code === "balance_unreadable" ? 503 : 409;
      return respond(status, { ok: false, code: decision.code, reason: decision.reason, skipped: decision.skipped });
    }

    const sent = await dispatchCampaign({
      decision,
      subject,
      body,
      organizationId: context.organizationId,
      actorUserId: context.userId,
      campaignId: campaign.id,
      // Derived from this request rather than configured here. The dispatcher
      // refuses to send without an https origin, because the unsubscribe link
      // is built from it.
      origin: siteOrigin(req, typeof deps.getEnv === "function" ? deps.getEnv : undefined),
      getEnv: typeof deps.getEnv === "function" ? deps.getEnv : (name) => process.env[name],
      getReadiness: typeof deps.getReadiness === "function" ? deps.getReadiness : null,
      appendLedger: typeof deps.appendUsageLedger === "function"
        ? deps.appendUsageLedger
        : createLedgerAppender({ getSupabaseServerConfig: () => config }),
      // Who this send actually reached, per recipient. Wired here rather than
      // defaulted inside the dispatcher for the same reason appendLedger is: a
      // dispatcher that reaches for the database itself cannot be tested on
      // what it decides.
      recordSends: typeof deps.recordCampaignSends === "function"
        ? deps.recordCampaignSends
        : createSendRecorder({ getSupabaseServerConfig: () => config }),
      // What makes this send's charge distinct from the first send's.
      //
      // Without it the remainder is emailed and the ledger declines the charge
      // as a duplicate of `campaign:<id>` -- the stragglers are reached, we pay
      // Resend, and nobody is billed.
      //
      // Digested over the remainder's own addresses rather than a timestamp or
      // a random value, so the key is STABLE for a retry of this same remainder
      // and different for a different one. A double-click that races the first
      // request's record write lands on the same key and is declined as the
      // duplicate it is; a double-click after it completes finds an empty
      // remainder and is refused above before reaching here.
      sendAttempt: remainderOnly ? `remainder-${remainderDigest(audienceRecipients)}` : ""
    });

    await controlEvent(config, context, "campaign.sent", sent.ok ? "success" : "failed", {
      campaign_id: campaign.id,
      // Who approved it, recorded rather than only checked. An owner-approval
      // requirement with no trace of who gave it is a rule nobody can audit
      // afterwards -- and it is the field that makes the check falsifiable: a
      // route that took the approver from the request body would show it here.
      approved_by: context.userId,
      // The role as well as the person. "Approved by a user id" does not tell
      // an owner reading their own audit trail whether the approver was
      // entitled to approve.
      approved_by_role: context.role,
      code: sent.code,
      sent: sent.sent,
      failed: sent.failed.length,
      skipped: (sent.skipped || []).length,
      charge: sent.charge?.code || null,
      audience,
      // Whether the send was screened against the provider's suppression list,
      // recorded on the event as well as returned. An owner reading back why a
      // campaign bounced needs to know whether it was screened at all.
      suppression_checked: screened.checked,
      suppressed_skipped: screened.marked,
      // Whether this was a send to the remainder, and how many were already
      // reached when it was worked out. On the event rather than only in the
      // response: an owner auditing two charges against one campaign has to be
      // able to see that the second was a remainder and not a second full send.
      remainder_only: remainderOnly,
      already_reached: remainderState ? remainderState.alreadyReached : null,
      charge_reference: sent.chargeReference || null
    }, campaign.id);

    // 200 when anything went out. A campaign where 459 of 460 landed is not a
    // failed campaign, and the counts below are what the owner reads -- a single
    // boolean cannot carry them.
    return respond(sent.ok ? 200 : sent.code === "email_not_configured" ? 503 : 502, {
      ok: sent.ok,
      code: sent.code,
      detail: sent.detail,
      sent: sent.sent,
      failed: sent.failed,
      skipped: sent.skipped,
      // The recipients nothing was tried for. Computed by the dispatcher,
      // returned by it, and dropped here until 15 September 2026 -- so the
      // detail line said "100 not attempted" and the owner had no way to learn
      // which hundred. A value fetched into a decision and never used, at the
      // route boundary rather than inside a query.
      notAttempted: sent.notAttempted || [],
      // Whether who-was-reached is now on record. Forwarded for the same reason
      // notAttempted had to be: the detail line changes with this, and a
      // caller that can read the sentence but not the state cannot decide
      // whether offering "send to the remainder" is safe.
      recorded: sent.recorded || { ok: false, code: "not_reported" },
      charge: sent.charge,
      audience,
      // Present only on a remainder send, and it carries `known` so a caller
      // cannot read "0 already reached" as a fact when it is an absence. A
      // remainder send that got this far always has `known: true` -- the
      // refusal above is the other branch -- and it is still forwarded rather
      // than flattened to a number, because the field's whole value is that
      // the three states stay three.
      remainder: remainderOnly
        ? { known: remainderState.known, alreadyReached: remainderState.alreadyReached, sentTo: audienceRecipients.length }
        : undefined,
      chargeReference: sent.chargeReference,
      suppressionChecked: screened.checked,
      suppressedSkipped: screened.marked,
      // Present only when the screen did not run, and it names why. "460 sent"
      // and "460 sent, unscreened" are different sentences and only one is true.
      suppressionUnchecked: screened.checked ? undefined : suppression.reason
    });
  }

  app.post("/api/growth/campaigns/:campaignId/send", access, (req, res) => sendCampaign(req, res, req.params.campaig…17824 tokens truncated…e same value and two different remainders
// almost never collide. Deliberately NOT a timestamp or a random id: either
// would make every retry a new charge, which is the overcharge the idempotency
// key exists to prevent.
//
// Case-folded the same way lower(email) is in
// growth_campaign_sends_accepted_once. If these two ever disagreed the digest
// would change for a set the database considers identical, and a retry would
// charge twice.
function remainderDigest(recipients) {
  const addresses = (Array.isArray(recipients) ? recipients : [])
    .map((recipient) => String((typeof recipient === "string" ? recipient : recipient?.email) || "").trim().toLowerCase())
    .filter(Boolean)
    .sort();
  // The count is in the digest input as well as the addresses, so a set and a
  // set containing a duplicate of one member cannot hash alike.
  return createHash("sha256").update(`${addresses.length}:${addresses.join(",")}`).digest("hex").slice(0, 16);
}

// Who a campaign would go to, with each contact's own consent rows attached.
//
// Two reads and a join in JavaScript rather than one PostgREST embed. The embed
// (`growth_leads?select=*,growth_contact_consents(*)`) would work -- the foreign
// key is there -- but it puts the tenant filter on the outer table only and
// relies on PostgREST's relationship detection to scope the inner one. Two
// explicitly organization-filtered reads make the boundary visible in both
// queries, and with the service-role key bypassing RLS that filter IS the
// boundary.
//
// Every failure path returns `ok: false` with a reason. Nothing here may turn "we
// could not ask" into "there is nobody" -- the caller would report a definite
// fact about the owner's contacts on the strength of a request that failed.
async function loadCampaignRecipients(config, context, { campaignId, audience }) {
  const scope = audience === "organization" ? "" : `&campaign_id=eq.${encodeURIComponent(campaignId)}`;

  // `archived` is the owner having put a record away. Mailing somebody they
  // retired is the one clearly wrong reading of that. `lost` is deliberately
  // still included: a win-back campaign to lost leads is a real thing an owner
  // does, and it is theirs to decide with consent already enforced.
  const leads = await rest(
    config,
    TABLES.leads,
    `select=id,name,email,status,campaign_id&organization_id=eq.${encodeURIComponent(context.organizationId)}${scope}` +
      `&status=neq.archived&order=created_at.asc&limit=${MAX_RECIPIENTS_PER_SEND + 1}`
  );
  if (!leads.ok) return { ok: false, status: 503, code: "cannot_read_recipients", reason: "The contact list could not be read, so nothing was sent." };

  if (leads.rows.length === 0) {
    return {
      ok: false,
      status: 409,
      code: "no_recipients",
      reason:
        audience === "organization"
          ? "There are no contacts on this workspace to send to."
          : "No contacts are attached to this campaign. Attach some, or send to the whole contact list explicitly."
    };
  }

  if (leads.rows.length > MAX_RECIPIENTS_PER_SEND) {
    return {
      ok: false,
      status: 413,
      code: "too_many_recipients",
      reason: `This campaign reaches more than ${MAX_RECIPIENTS_PER_SEND} contacts, which is more than one send can finish. Nothing was sent.`
    };
  }

  const ids = leads.rows.map((row) => row.id).filter(Boolean);
  const consents = await rest(
    config,
    TABLES.consents,
    `select=lead_id,channel,consent_status,purpose,withdrawn_at,expires_at` +
      `&organization_id=eq.${encodeURIComponent(context.organizationId)}` +
      `&channel=eq.email&lead_id=in.(${ids.map((id) => encodeURIComponent(id)).join(",")})` +
      `&limit=${CONSENT_ROW_LIMIT + 1}`
  );
  if (!consents.ok) return { ok: false, status: 503, code: "cannot_read_consent", reason: "Consent records could not be read, so nothing was sent." };
  if (consents.rows.length > CONSENT_ROW_LIMIT) {
    return { ok: false, status: 503, code: "consent_rows_unreadable", reason: `There are more than ${CONSENT_ROW_LIMIT} email consent records for these contacts; a partial read would skip people who did consent. Nothing was sent.` };
  }

  const byLead = new Map();
  for (const row of consents.rows) {
    if (!row?.lead_id) continue;
    if (!byLead.has(row.lead_id)) byLead.set(row.lead_id, []);
    byLead.get(row.lead_id).push(row);
  }

  return {
    ok: true,
    // `consents` plural, which is the shape consentState reads as a list. A
    // contact with no rows gets `[]` and is skipped as no_consent -- correct
    // here, because the read above succeeded and genuinely found none for them.
    //
    // `suppressed` is deliberately never set: nothing records unsubscribes or
    // bounces yet, so there is no suppression list to read. The sender honours
    // the field if a caller sets it, and this caller has nothing true to put
    // there. Wiring Resend's suppression list is the next piece.
    recipients: leads.rows.map((lead) => ({ ...lead, consents: byLead.get(lead.id) || [] }))
  };
}

async function resolveContext(req, deps) {
  const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || null;
  if (!user?.id) return { ok: false, status: 401, code: "growth_auth_required" };
  if (typeof deps.getCustomerPrimaryOrganization !== "function") return { ok: false, status: 503, code: "organization_resolver_unavailable" };
  const organization = await deps.getCustomerPrimaryOrganization(user);
  if (!organization?.ok) return { ok: false, status: 409, code: organization?.code || "organization_setup_required" };
  // The role rides along so the campaign send can ask whether this person may
  // approve on the business's behalf. Null when the read could not tell us,
  // which mayApproveOwnerAction reports as its own state rather than as a
  // refusal for being the wrong role.
  return { ok: true, organizationId: organization.organizationId, userId: user.id, role: organization.role ?? null };
}

function getConfig(deps) {
  if (typeof deps.getSupabaseServerConfig === "function") return deps.getSupabaseServerConfig();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { ok: true, url: String(url).replace(/\/$/, ""), serviceRoleKey } : { ok: false };
}

// How many rows there are, asked of the database.
//
// PostgREST returns the total in Content-Range when Prefer: count=exact is set,
// so this costs one row of transfer regardless of how many exist. rest() throws
// the headers away, which is why this does its own fetch rather than passing a
// prefer through.
//
// A failed count returns null rather than 0. Nothing here may turn "we could not
// ask" into "there are none" -- that is the substitution the totals card was
// making four times over.
async function countRows(config, table, context, filter = "") {
  if (!config?.ok && (!config?.url || !config?.serviceRoleKey)) return { ok: false, count: null };
  const query = `select=id&organization_id=eq.${encodeURIComponent(context.organizationId)}${filter}&limit=1`;
  const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: "count=exact"
    }
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, count: null };
  const range = response.headers?.get?.("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  if (!match) return { ok: false, count: null };
  return { ok: true, count: Number(match[1]) };
}

async function rest(config, table, query = "", options = {}) {
  if (!config?.ok && (!config?.url || !config?.serviceRoleKey)) return { ok: false, status: 503, code: "supabase_setup_required", rows: [] };
  const response = await fetch(`${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method: options.method || "GET",
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json", ...(options.prefer ? { Prefer: options.prefer } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  }).catch(() => undefined);
  if (!response) return { ok: false, status: 503, code: "database_unreachable", rows: [] };
  const rows = response.status === 204 ? [] : await response.json().catch(() => []);
  return { ok: response.ok, status: response.status, code: response.ok ? "ok" : "database_operation_failed", rows: Array.isArray(rows) ? rows : [] };
}

function insert(config, table, body) { return rest(config, table, "", { method: "POST", prefer: "return=representation", body }); }
function list(config, table, context, limit = 100, extra = "") { return rest(config, table, `select=*&organization_id=eq.${encodeURIComponent(context.organizationId)}${extra}&order=created_at.desc&limit=${limit}`); }
function patchRows(config, table, context, id, body) { return rest(config, table, `id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(context.organizationId)}`, { method: "PATCH", prefer: "return=representation", body }); }
function updateJob(config, context, jobId, body) { return patchRows(config, TABLES.jobs, context, jobId, body); }
async function loadOne(config, table, context, id) {
  const result = await rest(config, table, `select=*&id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(context.organizationId)}&limit=1`);
  if (!result.ok) return { ok: false, status: 502, code: result.code };
  if (!result.rows[0]) return { ok: false, status: 404, code: "resource_not_found" };
  return { ok: true, row: result.rows[0] };
}
async function controlEvent(config, context, type, status, details, campaignId = null, jobId = null) {
  return insert(config, TABLES.events, { organization_id: context.organizationId, user_id: context.userId, campaign_id: validUuid(campaignId) ? campaignId : null, job_id: validUuid(jobId) ? jobId : null, event_type: type, event_status: status, details: sanitizeProviderPayload(details) });
}

// Writing the withdrawal, on the organization's own consent row.
//
// Two shapes, because both are real states and only one of them is an update.
// A contact who was emailed always has a granted row -- the sender refuses
// anybody without one -- but a row can also have been deleted between the send
// and the click, months later. Inserting in that case records the withdrawal
// rather than reporting success over a write that changed nothing.
//
// `withdrawn` and `withdrawn_at` are both set. `growth-studio-sender.cjs` reads
// either as a refusal, and setting both means the two columns agree instead of
// leaving the disagreement its "safe reading" rule exists to survive.
async function recordWithdrawal(config, { organizationId, leadId, channel }) {
  const now = new Date().toISOString();

  // Organization AND lead, always. The service-role key bypasses row-level
  // security, so these filters are the tenant boundary -- and this is an
  // unauthenticated endpoint, which is exactly where a missing one would matter
  // most.
  const scope =
    `organization_id=eq.${encodeURIComponent(organizationId)}` +
    `&lead_id=eq.${encodeURIComponent(leadId)}` +
    `&channel=eq.${encodeURIComponent(channel)}`;

  const updated = await rest(config, TABLES.consents, scope, {
    method: "PATCH",
    prefer: "return=representation",
    body: { consent_status: "withdrawn", withdrawn_at: now, updated_at: now }
  });

  // A failed write is never reported as done. Somebody who pressed Unsubscribe
  // and was told it worked, when it did not, will receive the next campaign --
  // and this is the one place in the product where that is not a bug report but
  // a complaint to a regulator.
  if (!updated.ok) return { ok: false, status: 502 };
  if (updated.rows.length > 0) return { ok: true, rows: updated.rows.length, action: "withdrawn" };

  // Nothing to update. Recorded as a new row so the withdrawal exists even
  // where the original permission no longer does.
  const inserted = await insert(config, TABLES.consents, {
    organization_id: organizationId,
    lead_id: leadId,
    channel,
    purpose: "campaign_email",
    consent_status: "withdrawn",
    source: "recipient_unsubscribe_link",
    withdrawn_at: now,
    metadata: { recorded_by: "unsubscribe_link" }
  });
  if (!inserted.ok) return { ok: false, status: 502 };
  return { ok: true, rows: 1, action: "recorded" };
}

// What a recipient sees. Four states, and each says only what is true.
//
// Nothing here names the organization, the campaign or the address. The page is
// reachable by anybody holding the link -- including whoever an email was
// forwarded to -- so it confirms an action and discloses nothing about who the
// contact is or which business mailed them.
function unsubscribePage(ui, { state, token }) {
  const pages = {
    confirm: {
      title: "Stop these emails",
      heading: "Stop receiving these emails",
      body: "Press the button and you will not be sent any more marketing email from this sender.",
      // The form is what actually withdraws it. A GET could be a link a mail
      // scanner opened rather than a person.
      section: `<form method="post" action="${ui.escape(UNSUBSCRIBE_PATH)}?t=${encodeURIComponent(String(token || ""))}"><button type="submit">Stop these emails</button></form>`
    },
    done: {
      title: "You are unsubscribed",
      heading: "Done",
      body: "You will not be sent any more marketing email from this sender. Nothing else about you was changed.",
      section: ""
    },
    invalid: {
      title: "This link does not work",
      heading: "This link does not work",
      body: "It may have been broken by the email program that displayed it, or it may have expired. Reply to the email you received and ask to be removed, and that request has to be honoured.",
      section: ""
    },
    unavailable: {
      title: "We could not do that just now",
      heading: "We could not do that just now",
      // Never "you are unsubscribed" over a write that failed. The honest
      // reading of a failed write is that it did not happen.
      body: "Your request was not recorded, so please try the link again shortly. If it keeps failing, reply to the email you received and ask to be removed.",
      section: ""
    }
  };

  const page = pages[state] || pages.invalid;
  return ui.layout({
    title: page.title,
    eyebrow: "Email preferences",
    heading: page.heading,
    body: page.body,
    sections: page.section ? [page.section] : [],
    actions: []
  });
}

// What the last send did, read back off the redirect.
//
// The route answers a browser with a 303 rather than a body, so this is the
// only place the counts are shown. All three are rendered even when two are
// zero: "8 sent" alone lets an owner believe they reached everybody, and the
// difference between the list and the send is the thing they most need to see.
//
// Returns null when there is nothing to report, so a first visit is not given a
// card about a send that did not happen.
function sendOutcomeCard(query, escape) {
  const problem = clean(query?.problem, 120);
  if (problem) {
    return `<article class="card"><h2>Nothing was sent</h2><p>${escape(SEND_PROBLEMS[problem] || display(problem))}</p></article>`;
  }

  const sent = Number.parseInt(String(query?.sent ?? ""), 10);
  if (!Number.isFinite(sent)) return null;

  const skipped = Number.parseInt(String(query?.skipped ?? ""), 10) || 0;
  const failed = Number.parseInt(String(query?.failed ?? ""), 10) || 0;
  const parts = [`${sent} sent`];
  if (skipped) parts.push(`${skipped} skipped because they had not agreed to hear from you`);
  if (failed) parts.push(`${failed} could not be delivered`);
  return `<article class="card"><h2>Your campaign went out</h2><p>${escape(`${parts.join(", ")}.`)}</p></article>`;
}

// Sending one of the campaigns above.
//
// The approval is a checkbox and it is deliberately not pre-ticked. AGENTS.md
// requires the owner's approval for a customer campaign, and a box already
// ticked when the page loads is not an approval anybody gave.
function campaignSendCard(rows, escape) {
  // Only the ones that can actually be sent. Offering a completed campaign in
  // this list and refusing it on submit is a form that fails on a choice it
  // presented as valid.
  const sendable = (rows || []).filter((row) => row.status !== "completed" && row.status !== "archived");
  if (sendable.length === 0) {
    return `<article class="card"><h2>Send an email campaign</h2><p>${escape("None of your campaigns can be sent right now. Add one above, or reopen a finished one.")}</p></article>`;
  }

  const options = sendable
    .map((row) => `<option value="${escape(row.id)}">${escape(clean(row.name, 120) || "Untitled campaign")}</option>`)
    .join("");

  // "email" is named rather than left as "a campaign", and not only for the
  // copy check. The handler passes channel "email" to authoriseCampaign, so an
  // unqualified "Send a campaign" would offer a choice the code does not have
  // -- growth_campaigns carries a `channel` column, and a form that ignores it
  // while saying "campaign" implies text messages work.
  return `<article class="card"><h2>Send an email campaign</h2>` +
    `<p>${escape("This goes by email only, and only to the people who recorded consent for it. Anyone who has not, or who withdrew, is left out and counted so you can see the difference.")}</p>` +
    `<form method="post" action="/api/growth/campaigns/send">` +
    `<label for="campaign_id">Which campaign</label><select id="campaign_id" name="campaign_id" required>${options}</select>` +
    `<label for="subject">Subject</label><input id="subject" name="subject" type="text" maxlength="300" required>` +
    `<label for="body">Message</label><textarea id="body" name="body" rows="6" maxlength="20000" required></textarea>` +
    `<label for="audience">Who it goes to</label>` +
    `<select id="audience" name="audience">` +
    `<option value="campaign">The contacts attached to this campaign</option>` +
    `<option value="organization">Everyone in your contact list</option>` +
    `</select>` +
    `<label for="approved"><input id="approved" name="approved" type="checkbox" value="true" required> I approve emailing this to my customers</label>` +
    // Only the people this campaign has not reached yet.
    //
    // A checkbox on the same form rather than a second button, because the
    // subject, the message and the approval all still apply and duplicating
    // them is how two forms drift apart.
    //
    // Worded as what it does to the recipients rather than as a mode name. The
    // owner is being asked "leave out the people who already got this", which
    // is a fact about their customers' inboxes; "remainder only" is a fact
    // about our database.
    `<label for="remainder_only">` +
    `<input id="remainder_only" name="remainder_only" type="checkbox" value="true"> ` +
    `${escape("Skip anyone this campaign already reached")}` +
    `</label>` +
    `<p>${escape("Tick that when you are following up a send that did not finish. If we cannot confirm who was already reached, nothing is sent -- rather than sending to everyone again.")}</p>` +
    `<button type="submit">Send email campaign</button>` +
    `</form></article>`;
}

// The refusal codes this page can be redirected back with, in the owner's
// words. A code with no entry falls back to the code itself with its
// underscores removed -- readable rather than blank, and it says the code so
// they can quote it.
const SEND_PROBLEMS = Object.freeze({
  explicit_campaign_approval_required: "You need to tick the approval box before a campaign can be sent.",
  campaign_message_required: "A campaign needs both a subject and a message.",
  owner_role_required: "Only the account owner can approve sending a campaign to your customers. Ask them to approve it.",
  role_unknown: "We could not confirm your role in this workspace just now, so nothing was sent. Try again shortly.",
  invalid_campaign_id: "That campaign could not be identified. Choose one from the list and try again.",
  campaign_not_sendable: "That campaign is finished or put away. Reopen it before sending.",
  no_recipients: "No contacts are attached to that campaign. Attach some, or send to your whole contact list.",
  too_many_recipients: "That campaign reaches more contacts than one send can finish. Nothing was sent.",
  no_consented_recipients: "Nobody on that list has agreed to hear from you by email. Nothing was sent and nothing was charged.",
  insufficient_credit: "There is not enough credit to send this campaign. Nothing was sent.",
  balance_unreadable: "We could not check your credit just now, so nothing was sent. Try again shortly.",
  // The two the "skip anyone already reached" tickbox can come back with.
  // Written to say what was NOT done, because that is the part an owner needs:
  // in both cases nobody was emailed and nobody was charged.
  remainder_unknown: "We could not confirm who this campaign already reached, so nothing was sent. Sending now could email those people a second time -- try again shortly.",
  all_reached: "Everyone on that list has already had this campaign, so there was nobody left to send it to. Nothing was sent and nothing was charged.",
  cannot_read_recipients: "We could not read your contact list just now, so nothing was sent.",
  cannot_read_consent: "We could not read your consent records just now, so nothing was sent.",
  consent_rows_unreadable: "There are too many consent records to read at once, and a partial read would leave out people who did agree. Nothing was sent.",
  email_not_configured: "Email sending is not set up yet, so nothing was sent.",
  supabase_setup_required: "Your account database is not connected yet, so nothing was sent.",
  resource_not_found: "That campaign could not be found in your workspace.",
});

// The form for a spec, rendered onto the record page the customer already
// reaches. Values are not carried back on a rejection here because this posts
// as JSON from the page; the server-side refusal names the fields it wants.
function createFormCard(spec, escape) {
  const fields = spec.fields.map(([column, kind, options = {}]) => {
    const label = escape(options.label || column);
    const required = options.required ? " required" : "";
    if (kind === "choice") {
      // `value.replace(/_/g, " ")` alone put storage keys in front of customers:
      // the automation action list read "send webhook" and "sync provider". A
      // spec can now carry `labels`, and the underscore swap is the fallback for
      // values whose key already reads as English.
      const opts = (options.values || [])
        .map((value) => {
          const text = (options.labels && options.labels[value]) || value.replace(/_/g, " ");
          return `<option value="${escape(value)}"${value === options.fallback ? " selected" : ""}>${escape(text)}</option>`;
        })
        .join("");
      return `<label>${label}<select name="${escape(column)}"${required}>${opts}</select></label>`;
    }
    // An unticked box submits nothing at all, and truthy(undefined) is false --
    // so the handler refuses exactly when the customer did not tick it, which
    // is the behaviour an attestation needs. "on" is what a ticked box sends
    // and is already in truthy()'s list.
    if (kind === "checkbox") return `<label class="choice"><input name="${escape(column)}" type="checkbox" value="on"${required}> ${label}</label>`;
    if (kind === "longText") return `<label>${label}<textarea name="${escape(column)}" rows="4" maxlength="${options.max || 4000}"${required}></textarea></label>`;
    if (kind === "date") return `<label>${label}<input name="${escape(column)}" type="date"${required}></label>`;
    if (kind === "number") return `<label>${label}<input name="${escape(column)}" type="number" step="0.01"${required}></label>`;
    return `<label>${label}<input name="${escape(column)}" type="text" maxlength="${options.max || 240}"${required}></label>`;
  }).join("");
  const note = spec.safetyNote ? `<p class="fine">${escape(spec.safetyNote)}</p>` : "";
  return `<article class="card"><h2>Add a ${escape(spec.noun)}</h2><p>${escape(spec.intro)}</p>${note}<form method="post" action="/api/growth/${escape(spec.key)}">${fields}<button type="submit">Save ${escape(spec.noun)}</button></form></article>`;
}

function buildUi(deps) {
  const escape = deps.escapeHtml || esc;
  return { layout: deps.layout || basicLayout, card: deps.brandCard || card, link: deps.linkAction || link, escape };
}
function summaryTable(data, escape) {
  const cells = [
    ["Campaigns", data.campaigns.length],
    ["Leads", data.leads.length],
    ["Content queue", data.content.length],
    ["Provider jobs", data.jobs.length]
  ].map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(String(value))}</td></tr>`).join("");
  return `<article class="card"><h2>Current workspace</h2><table><tbody>${cells}</tbody></table></article>`;
}
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function display(value) { return String(value || "unknown").replaceAll("_", " "); }
function clean(value, max = 500) { return String(value || "").trim().slice(0, max); }
function nullable(value, max = 500) { const text = clean(value, max); return text || null; }
function normalizeEmail(value) { const email = clean(value, 320).toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null; }
function validUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }
function validDate(value) { if (!value) return null; const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString(); }
function normalizeDateOnly(value) { const text = clean(value, 40); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null; }
function truthy(value) { return [true, 1, "1", "true", "yes", "on", "approved", "attested"].includes(typeof value === "string" ? value.toLowerCase() : value); }
function parseObject(value, fallback) { if (value && typeof value === "object" && !Array.isArray(value)) return value; if (!String(value || "").trim()) return fallback; try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }
function parseArray(value, fallback) { if (Array.isArray(value)) return value; if (!String(value || "").trim()) return fallback; try { const parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }
function oneOf(value, allowed, fallback) { const normalized = String(value || "").trim().toLowerCase(); return allowed.includes(normalized) ? normalized : fallback; }
function clamp(value, min, max, fallback) { const parsed = Number.parseInt(String(value ?? ""), 10); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback; }
function numberOrNull(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function numberOrUndefined(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
function compact(object) { return Object.fromEntries(Object.entries(object || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")); }
function countBy(rows, field) { return rows.reduce((counts, row) => ({ ...counts, [row[field] || "unknown"]: (counts[row[field] || "unknown"] || 0) + 1 }), {}); }
function safeError(error) { return clean(error?.message || error || "Unknown provider error", 1000); }
function containsUnsafeExpression(value) { const text = JSON.stringify(value || {}).toLowerCase(); return /(?:javascript:|<script|child_process|exec\s*\(|spawn\s*\(|eval\s*\(|require\s*\(|__proto__|constructor\.prototype|file:\/\/|ssh:\/\/)/.test(text); }
function sanitizeProviderPayload(value) { if (!value || typeof value !== "object") return {}; const copy = JSON.parse(JSON.stringify(value)); scrub(copy); return copy; }
function scrub(value) { if (!value || typeof value !== "object") return; for (const key of Object.keys(value)) { if (/api.?key|token|authorization|credential|secret|password/i.test(key)) value[key] = "[redacted]"; else scrub(value[key]); } }

// A browser form post announces itself either by Accept or by content type.
// Same shape as routes/sonara-last9-routes.cjs, which is where the owner record
// pages answer their own row actions.
function acceptsHtml(req) {
  return String(req.get?.("accept") || "").includes("text/html")
    || String(req.get?.("content-type") || "").includes("application/x-www-form-urlencoded");
}

// Named on the export so a test can assert the cap's arithmetic against Vercel's
// documented duration rather than re-typing the number and agreeing with itself.
module.exports.MAX_RECIPIENTS_PER_SEND = MAX_RECIPIENTS_PER_SEND;
module.exports.CONSENT_ROW_LIMIT = CONSENT_ROW_LIMIT;
