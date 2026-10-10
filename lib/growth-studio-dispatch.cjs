// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Sending the campaign that `lib/growth-studio-sender.cjs` authorised.
//
// The two are separate on purpose. The sender decides -- approval, per-channel
// consent, credit -- and its refusals can therefore be tested without a mail
// server. This half does the sending, and it is deliberately incapable of
// deciding anything: it takes an authorised decision and sends to exactly the
// recipients that decision approved.
//
// ## The rule that makes the split worth anything
//
// **This only ever reads `decision.eligible`.** It never sees the original
// recipient list, so there is no path by which a recipient the consent check
// refused could be sent to. That is enforced by the signature rather than by
// care: the caller hands over a decision, not a list.
//
// A page that asked the gate and then did the work regardless of the answer is
// what `lib/sonara-agent-runner.cjs` was written to replace. This is the same
// shape one product along, so it is built the same way.
//
// ## What it does when a send half-fails
//
// A campaign to 460 people is 460 HTTP requests, and some will fail. Three
// rules, each because the alternative is worse:
//
//   * **Failures are counted and named, never swallowed.** An owner told "sent"
//     when 40 bounced has been told something false.
//   * **The charge is for what was accepted**, not for what was attempted. We
//     pay Resend for accepted messages; billing a customer for our own failed
//     requests would be charging them for our fault.
//   * **A ledger failure does not un-send the email.** It has gone. The gap is
//     reported loudly, because a meter that silently stops charging is the
//     defect this repository is named for.

const crypto = require("node:crypto");
const { drawEntry } = require("./sonara-usage-meter.cjs");
const { sendRowsFor } = require("./growth-studio-send-records.cjs");
const { billableEmailCount } = require("./growth-studio-sender.cjs");
const {
  deriveSigningKey,
  signToken,
  unsubscribeUrl,
  unsubscribeHeaders,
  withUnsubscribeLine
} = require("./growth-studio-unsubscribe.cjs");
const { redactSensitiveText } = require("./sonara-redaction.cjs");
const { emitEvent } = require("./sonara-structured-log.cjs");
const { tagCampaignLinks } = require("./sonara-campaign-links.cjs");

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_BATCH_ENDPOINT = "https://api.resend.com/emails/batch";

// How many recipients go in one HTTP request, and what happens when a request
// carrying a hundred of them does not come back cleanly.
//
// CORRECTED TWICE, and both corrections are worth keeping.
//
// This constant was 1, with a comment claiming 1 was "Resend's own documented
// ceiling for a batch call". It is not:
// resend.com/docs/api-reference/emails/send-batch-emails, read 10 September
// 2026, says a batch call takes "up to 100 batch emails at once". The number was
// right and the reason was invented, which reads identically to a reason that
// was checked.
//
// The real reason for keeping it at 1 was attribution: `failed` carries an
// address and a status per recipient, and an owner told "100 sent" with no way
// to say which 3 did not is an owner told something false. That reason was
// sound and it is why this is not simply raised to 100.
//
// ## Why batching is safe here anyway
//
// Two documented facts make it work. The batch response is index-aligned --
// quoted from the same reference: "each entry in `data` corresponds to the email
// at the same index in the batch payload (0-based)" -- so a clean batch
// attributes perfectly. And the reference says **nothing at all** about partial
// failure or per-item errors, which is the fact that shapes the rest of this:
// coding against an undocumented error shape would be guessing.
//
// A successful response is proven only when every recipient has a provider
// receipt. A timeout or partial body may follow real delivery: replaying those
// recipients individually is not a harmless attribution repair. Resend supports
// Idempotency-Key on both individual and batch endpoints, but its 24-hour
// retention is not permanent proof. Mark uncertain responses for reconciliation,
// do not fall back to another send, and block "send to remainder" until resolved.
const MAX_PER_REQUEST = 100;
const MAX_FALLBACK_BATCHES = 0; // Kept as an explicit compatibility contract: no unsafe replay.

function defaultReport({ code, detail }) {
  console.error(`[campaign-dispatch] ${redactSensitiveText(String(code))}: ${redactSensitiveText(String(detail || ""))}`);
}

// Send an authorised campaign.
//
// `decision` is the return of `authoriseCampaign`. Anything that is not an
// allowed decision is refused here too rather than trusted -- a caller that
// passes a refusal by mistake must not send, and checking is cheaper than
// relying on every caller to have checked.
async function dispatchCampaign({
  decision = null,
  subject = "",
  body = "",
  organizationId = null,
  actorUserId = null,
  campaignId = null,
  // Where the unsubscribe link points. Required: see the refusal below.
  origin = null,
  getEnv = (name) => process.env[name],
  getReadiness = null,
  appendLedger = null,
  report = defaultReport,
  fetchImpl = fetch,
  recordSends,
  // What distinguishes this send from another send of the same campaign, in the
  // charge's idempotency key. Empty for a first send, so that key stays exactly
  // `campaign:<id>` and no existing charge changes shape.
  //
  // It exists because "send to the remainder" is a SECOND send of one campaign
  // and the key was keyed on the campaign alone. Without a discriminator the
  // remainder's charge is refused by the ledger's unique index as a duplicate,
  // the hundred stragglers are emailed, and nobody is billed -- which is the
  // same missing signal the send-record migration was written to restore, only
  // pointing the other way.
  sendAttempt = "",
} = {}) {
  if (!decision || decision.allowed !== true || !Array.isArray(decision.eligible) || decision.eligible.length === 0) {
    return { ok: false, code: "not_authorised", detail: "Nothing was sent: this campaign was not authorised.", sent: 0, failed: [] };
  }
  if (!organizationId) {
    // The same rule the action log and the ledger enforce. A send nobody can
    // attribute is a charge nobody pays.
    return { ok: false, code: "no_organization", detail: "A campaign send requires an organizationId.", sent: 0, failed: [] };
  }
  if (!campaignId) {
    // The idempotency key is built from this. Without it a retried dispatch
    // charges twice, and the ledger's unique index would not catch it because
    // the key would differ.
    return { ok: false, code: "no_campaign_id", detail: "A campaign send requires a campaignId to key its charge on.", sent: 0, failed: [] };
  }

  // Every report() in this file is a NAMED DEGRADATION that did not stop the
  // send: a charge that was not recorded, a ledger or send-record writer that
  // was not wired, a batch that fell back. None of them is a failure -- the
  // emails went out -- and none is a clean success either.
  //
  // `note` keeps the injected reporter exactly as it was, so every existing
  // caller and test sees the same calls, and adds one structured line carrying
  // the tenant. The prose line is for a person reading one incident; the
  // structured line is countable, which is what an SLO needs and what
  // docs/PRODUCTION_RELIABILITY_AND_OBSERVABILITY_PLAN.md item 1 is for.
  //
  // The campaign id is the correlation: every line from one send shares it.
  const note = (payload) => {
    report(payload);
    emitEvent({
      event: "campaign.dispatch.degraded",
      scope: "organization",
      organizationId,
      capability: "campaign_email",
      outcome: "degraded",
      reason: payload && payload.code ? String(payload.code) : "unnamed",
      correlationId: campaignId,
      detail: { detail: payload ? payload.detail : null }
    });
  };

  // A gate said no and nothing was sent. Deliberately `refused` rather than
  // `failed`: a campaign stopped for a missing unsubscribe link or unconfigured
  // email is this code working, and spending error budget on it would make the
  // budget measure correctness of configuration rather than reliability.
  const refuse = (code, detail) => {
    emitEvent({
      event: "campaign.dispatch",
      scope: "organization",
      organizationId,
      capability: "campaign_email",
      outcome: "refused",
      reason: code,
      correlationId: campaignId,
      detail: { detail }
    });
    return { ok: false, code, detail, sent: 0, failed: [] };
  };

  // The charge's idempotency key, derived once so the retry and the charge
  // cannot disagree about it.
  //
  // `campaign:<id>` for a first send -- byte-identical to what this file used
  // before, so no existing ledger row is orphaned by a key that changed shape.
  // A remainder send passes a discriminator and gets its own key.
  //
  // Sanitised rather than interpolated raw: the key is stored, compared by a
  // unique index, and a caller-supplied string with a colon in it could be made
  // to collide with another attempt's key on purpose.
  const attemptSuffix = String(sendAttempt || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  const chargeReference = attemptSuffix ? `campaign:${campaignId}:${attemptSuffix}` : `campaign:${campaignId}`;

  const cleanSubject = String(subject || "").trim();
  const cleanBody = String(body || "").trim();
  if (!cleanSubject || !cleanBody) {
    return refuse("empty_message", "A campaign needs a subject and a body.");
  }

  // Off unless configured, which is AGENTS.md's rule rather than a preference:
  // "email alerts must be off or explicitly user-controlled by default."
  if (typeof getReadiness === "function" && getReadiness()?.services?.emailDelivery !== "enabled") {
    return refuse("email_not_configured", "Email delivery is not configured, so nothing was sent.");
  }

  const apiKey = getEnv("RESEND_API_KEY");
  const from = getEnv("RESEND_FROM_EMAIL");
  if (!apiKey || !from) {
    return refuse("email_not_configured", "RESEND_API_KEY or RESEND_FROM_EMAIL is unset, so nothing was sent.");
  }

  // **A campaign nobody can unsubscribe from is not sent.**
  //
  // This is the one refusal here that is not about cost or consent, and it fails
  // closed on purpose. The alternative -- send anyway, without a way out -- is
  // the option that cannot be taken back: the mail is in somebody's inbox, they
  // have no way to stop the next one, and this product's own /legal/can-spam
  // page told the owner a working unsubscribe was one of the basics.
  //
  // Both halves are needed and neither is guessable. The key signs the token;
  // the origin makes it a URL a recipient can open. `siteOrigin` returns an
  // empty string rather than inventing a host, and RFC 8058 requires HTTPS, so
  // an http or absent origin is a refusal rather than a downgrade.
  const signingKey = deriveSigningKey(getEnv);
  if (!signingKey) {
    return refuse(
      "unsubscribe_not_configured",
      "No unsubscribe signing key is available, so nothing was sent: a campaign has to carry a way to stop it."
    );
  }
  const probeUrl = unsubscribeUrl({ origin, token: "probe" });
  if (!probeUrl) {
    return refuse(
      "unsubscribe_origin_required",
      "This site's https address is not known, so an unsubscribe link cannot be built and nothing was sent."
    );
  }

  const accepted = [];
  const failed = [];
  // Could have been accepted by the provider: distinct from definite failures.
  const uncertain = [];
  const notAttempted = [];

  // Each recipient's message, built before anything is sent.
  //
  // The unsubscribe token names the recipient, so a message cannot be shared
  // between two of them -- one shared link would let any recipient unsubscribe
  // every other, and would make a forwarded email a way to remove somebody else
  // from the list. Batching changes how many go per request; it does not change
  // that each carries its own.
  const messages = [];
  // Links to this business's own chat pages carry the campaign, so an enquiry
  // that comes from this email is credited to it (lib/sonara-campaign-links.cjs).
  // Links anywhere else, and chat links the owner already gave a query, are
  // sent exactly as written.
  const taggedBody = tagCampaignLinks(cleanBody, { origin, campaignId });
  for (const recipient of decision.eligible) {
    const token = signToken({ organizationId, leadId: recipient.id, key: signingKey });
    const url = unsubscribeUrl({ origin, token });
    const text = withUnsubscribeLine(taggedBody, url);
    const headers = unsubscribeHeaders(url);

    if (!token || !url || !text || !headers) {
      // A recipient with no usable id cannot be given a way out, so they are
      // not emailed. Counted as a failure with a named status rather than
      // skipped quietly, because the owner needs to see it.
      failed.push({ email: recipient.email, status: 0, reason: "no_unsubscribe_link" });
      continue;
    }

    messages.push({ from, to: [recipient.email], subject: cleanSubject, text, headers });
  }

  const authorised = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  // A stable SHA-256 digest of the whole request, tenant, campaign and approved
  // send attempt creates separate provider idempotency namespaces per operation.
  // No recipient address, message body or credentials appear in the header.
  // A 24-hour provider cache is only a short retry guard, not durable proof.
  function requestKey(body, scope) {
    return "sonara-growth-" + crypto.createHash("sha256")
      .update(JSON.stringify({ organizationId, campaignId, attemptSuffix, scope, body }))
      .digest("hex");
  }

  // A single-recipient request still needs a stable key: a successful send
  // can lose its HTTP response, and no later retry may presume it failed.
  async function sendOne(message) {
    const response = await Promise.resolve().then(() => fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: { ...authorised, "Idempotency-Key": requestKey(message, "individual") },
      body: JSON.stringify(message)
    })).catch(() => undefined);

    if (response?.ok) {
      // HTTP 2xx without a provider receipt is not proof of an accepted
      // message. The documented /emails response includes an id. A missing,
      // malformed or unreadable body remains uncertain, never billable.
      const receipt = typeof response.json === "function"
        ? await Promise.resolve().then(() => response.json()).catch(() => null)
        : null;
      const id = receipt && typeof receipt.id === "string" ? receipt.id.trim() : "";
      if (id) {
        accepted.push({ email: message.to[0], providerMessageId: id });
      } else {
        uncertain.push({ email: message.to[0], status: response.status || 0, reason: "provider_outcome_unknown" });
      }
      return;
    }

    // The address is kept, because the owner needs to know WHO did not receive
    // it, and the status is kept because a 422 (bad address) and a 429 (rate
    // limited) need different actions. Redaction is applied when this is
    // logged, not here -- the caller may render it to the owner, who is
    // entitled to see their own customer's address.
    const status = response?.status || 0;
    // Only definite client rejections are treated as known failures.
    // Timeouts, 409 concurrent idempotency requests, throttles and 5xx may
    // have completed server-side; repeating them blindly may double-send.
    if (status >= 400 && status < 500 && ![408, 409, 425, 429].includes(status)) {
      failed.push({ email: message.to[0], status });
    } else {
      uncertain.push({ email: message.to[0], status, reason: "provider_outcome_unknown" });
    }
  }

  for (let index = 0; index < messages.length; index += MAX_PER_REQUEST) {
    const batch = messages.slice(index, index + MAX_PER_REQUEST);

    // A single recipient is not a batch. Sending it through the batch endpoint
    // would buy nothing and would put the one case that needs no reconciliation
    // through the code that reconciles.
    if (batch.length === 1) {
      const unresolvedBefore = uncertain.length;
      await sendOne(batch[0]);
      if (uncertain.length > unresolvedBefore) {
        // The request may already have delivered. Stop the campaign; do not
        // run later batches or offer an automatic remainder resend.
        for (const pending of messages.slice(index + 1)) {
          notAttempted.push({ email: pending.to[0], reason: "earlier_send_unconfirmed" });
        }
        note({
          code: "individual_delivery_unconfirmed",
          detail: `campaign ${campaignId} individual provider receipt is unavailable; no additional messages sent`
        });
        break;
      }
      continue;
    }

    const response = await Promise.resolve().then(() => fetchImpl(RESEND_BATCH_ENDPOINT, {
      method: "POST",
      headers: { ...authorised, "Idempotency-Key": requestKey(batch, `batch-${index / MAX_PER_REQUEST}`) },
      body: JSON.stringify(batch)
    })).catch(() => undefined);

    const payload = response?.ok && typeof response.json === "function"
      ? await Promise.resolve().then(() => response.json()).catch(() => null)
      : null;
    const ids = Array.isArray(payload?.data) ? payload.data : null;

    // Clean means the request succeeded AND there is exactly one entry per
    // email. The reference documents the alignment, so a full-length `data` can
    // be trusted to name these recipients in this order -- and a short one
    // cannot be reconciled at all, which is why it is not tried.
    if (ids && ids.length === batch.length
      && ids.every((entry) => entry && typeof entry.id === "string" && entry.id.trim())
      && new Set(ids.map((entry) => entry.id)).size === ids.length) {
      // The ids were read to decide the batch was clean and then thrown away.
      // They are index-aligned by the documented contract quoted above, so each
      // one names the message at the same position -- and keeping it is what
      // lets a later delivery question be traced to one request rather than to
      // "some campaign send". Recorded per address in growth_campaign_sends.
      for (let position = 0; position < batch.length; position += 1) {
        const id = ids[position] && typeof ids[position] === "object" ? ids[position].id : null;
        accepted.push({ email: batch[position].to[0], providerMessageId: typeof id === "string" ? id : null });
      }
      continue;
    }

    // Ambiguous: the provider may already have accepted all, some or none.
    // Never resend the same batch as new individual requests. Record each
    // address as uncertain, preserve the response status, and stop creating
    // additional side effects in this invocation.
    const status = response?.status || 0;
    for (const message of batch) {
      uncertain.push({ email: message.to[0], status, reason: "provider_outcome_unknown" });
    }
    for (const pending of messages.slice(index + batch.length)) {
      notAttempted.push({ email: pending.to[0], reason: "earlier_batch_unconfirmed" });
    }
    note({
      code: "batch_delivery_unconfirmed",
      detail: `campaign ${campaignId} batch of ${batch.length} has no complete provider receipt (status ${status}); no automatic resend; reconcile before any remainder send`
    });
    break;
  }

  // Charged for what was accepted. We pay Resend per accepted message, so
  // billing for attempts would charge a customer for our own failed requests.
  let charge = { ok: false, code: "not_attempted" };
  if (accepted.length > 0) {
    const entry = drawEntry({
      capability: decision.quote?.capability || "campaign_email",
      // The SAME function the sender authorised against, not `accepted.length`.
      // It was the raw count, so a campaign to one person was authorised for the
      // documented ten-email minimum -- and told the customer so -- then charged
      // for one, at exactly the zero margin the minimum exists to prevent.
      units: billableEmailCount(accepted.length),
      organizationId,
      actorUserId,
      // A retry of THIS send must reuse this key, and a different send of the
      // same campaign must not. `chargeReference` is derived once, above the
      // send loop, from the attempt discriminator the caller supplied.
      idempotencyKey: chargeReference
    });

    if (!entry.ok) {
      note({ code: entry.code, detail: `campaign ${campaignId} sent ${accepted.length} and was not charged` });
      charge = { ok: false, code: entry.code };
    } else if (typeof appendLedger !== "function") {
      // Absent rather than failed, and said differently. A caller that forgot
      // to wire the ledger has a bug; a ledger that rejected the row has an
      // outage. Reporting both as the same thing hides one of them.
      note({ code: "ledger_not_wired", detail: `campaign ${campaignId} sent ${accepted.length} with no ledger writer supplied` });
      charge = { ok: false, code: "ledger_not_wired" };
    } else {
      const written = await appendLedger({
        ...entry.row,
        metadata: {
          campaign_id: campaignId,
          accepted: accepted.length,
          failed: failed.length,
          skipped: (decision.skipped || []).length,
          // Which send of this campaign the charge belongs to. Null for a first
          // send. An owner reading their own ledger has to be able to tell a
          // remainder charge from a second full send, and the key alone does
          // not read as English.
          send_attempt: attemptSuffix || null
        }
      }).catch((error) => ({ ok: false, code: "ledger_write_threw", detail: String(error?.message || error) }));

      if (!written.ok) {
        // The emails have gone. Nothing here can un-send them, so this is
        // reported rather than raised: failing the dispatch now would tell the
        // owner nothing was sent when 460 messages are already in flight.
        note({ code: written.code, detail: `campaign ${campaignId} sent ${accepted.length} and the charge of ${entry.row.amount_minor} was not recorded` });
      }
      charge = { ok: Boolean(written.ok), code: written.code, amountMinor: entry.row.amount_minor, duplicate: Boolean(written.duplicate) };
    }
  }

  // What this send did, per recipient, written before anything is returned.
  //
  // This is the record the header above says both "send to the remainder" and
  // the >1,000 queue were waiting on. It is written on the same terms as the
  // ledger: the emails have already gone, so a failed write is REPORTED and
  // never raised -- failing the dispatch here would tell an owner nothing was
  // sent while hundreds of messages are in flight.
  //
  // But it is not reported the same way, because the consequence differs. A
  // missing ledger row costs us money. A missing send record costs a customer's
  // customers a second copy of the same email, because the only remaining way
  // to reach the stragglers is to send the whole campaign again. So the detail
  // below changes with this outcome rather than reading the same either way.
  let recorded = { ok: false, code: "not_attempted", written: 0 };
  if (accepted.length > 0 || failed.length > 0 || uncertain.length > 0 || notAttempted.length > 0) {
    const built = sendRowsFor({
      organizationId,
      campaignId,
      accepted,
      failed: [...failed, ...uncertain],
      notAttempted,
      leadIdByEmail: new Map((decision.eligible || []).map((recipient) => [String(recipient.email || "").trim().toLowerCase(), recipient.id || null]))
    });

    if (!built.ok) {
      note({ code: built.code, detail: `campaign ${campaignId} sent ${accepted.length} and no send record could be built: ${built.detail}` });
      recorded = { ok: false, code: built.code, written: 0 };
    } else if (built.dropped.length) {
      // Built, but incomplete. Said before the write rather than after, because
      // an incomplete record that writes successfully is the dangerous case: it
      // looks like a record.
      note({
        code: "send_record_incomplete",
        detail: `campaign ${campaignId} produced ${built.dropped.length} row(s) with no usable address, so the record of who was reached is incomplete`
      });
    }

    if (built.ok) {
      if (typeof recordSends !== "function") {
        // Absent rather than failed, and named differently, for the same reason
        // the ledger distinguishes them: a caller that forgot to wire this has
        // a bug, and a database that rejected the rows has an outage.
        note({ code: "send_record_not_wired", detail: `campaign ${campaignId} sent ${accepted.length} with no send-record writer supplied, so the remainder cannot be worked out` });
        recorded = { ok: false, code: "send_record_not_wired", written: 0 };
      } else if (!built.rows.length) {
        recorded = { ok: true, code: "nothing_to_record", written: 0 };
      } else {
        const written = await recordSends(built.rows)
          .catch((error) => ({ ok: false, code: "send_record_write_threw", detail: String(error?.message || error) }));

        if (!written || written.ok !== true) {
          note({
            code: (written && written.code) || "send_record_write_failed",
            detail: `campaign ${campaignId} sent ${accepted.length} and the per-recipient record was NOT written, so who was reached is unknown`
          });
          recorded = { ok: false, code: (written && written.code) || "send_record_write_failed", written: 0 };
        } else {
          recorded = { ok: true, code: "recorded", written: built.rows.length, accepted: built.acceptedCount };
        }
      }
    }
  }

  // The line an SLO is written against.
  //
  // One event per completed dispatch, per tenant, with an outcome from a closed
  // set -- which is the whole reason that set is closed. `partial` is its own
  // member because a campaign where 459 of 460 landed is neither a success nor
  // a failure, and counting it as either makes the resulting rate a number that
  // describes nothing.
  //
  // Emitted before the return rather than by the caller: a caller that forgets
  // leaves a gap in the series, and a gap looks exactly like a period with no
  // sends.
  emitEvent({
    event: "campaign.dispatch",
    scope: "organization",
    organizationId,
    capability: "campaign_email",
    outcome: accepted.length === 0
      ? (uncertain.length > 0 ? "degraded" : "failed")
      : (failed.length > 0 || uncertain.length > 0 || notAttempted.length > 0)
        ? "partial"
        : "ok",
    reason: accepted.length === 0
      ? (uncertain.length > 0 ? "delivery_unconfirmed" : "all_failed")
      : failed.length === 0 && uncertain.length === 0 && notAttempted.length === 0
        ? "sent"
        : "partly_sent",
    correlationId: campaignId,
    detail: {
      accepted: accepted.length,
      failed: failed.length,
      unconfirmed: uncertain.length,
      not_attempted: notAttempted.length,
      skipped: (decision.skipped || []).length,
      // Whether the money and the record were written, because a send that
      // went out uncharged or unrecorded is the case worth alerting on later.
      charge: charge.code || null,
      charged: Boolean(charge.ok),
      recorded: Boolean(recorded.ok),
      charge_reference: chargeReference
    }
  });

  return {
    // `ok` is about the dispatch, and it is true when anything was accepted --
    // a campaign where 459 of 460 landed is not a failed campaign. The counts
    // below are what an owner reads; a single boolean cannot carry them.
    ok: accepted.length > 0,
    code:
      accepted.length === 0
        ? (uncertain.length > 0 ? "delivery_unconfirmed" : "all_failed")
        : failed.length === 0 && uncertain.length === 0 && notAttempted.length === 0
          ? "sent"
          : "partly_sent",
    sent: accepted.length,
    failed,
    // Unknown whether the provider accepted these addresses; never assume
    // delivery or rejection and never offer an automatic remainder replay.
    uncertain,
    // Recipients nothing was even tried for, because the fallback budget ran
    // out. Named separately from `failed` on purpose: a failed send was
    // attempted and refused, and this was not attempted at all. An owner does
    // something different about each -- one is a bad address, the other is
    // somebody who has heard nothing.
    //
    // Returned here and, until 15 September 2026, dropped by the route: the
    // send handler forwarded sent/failed/skipped and not this, so an owner was
    // told "100 not attempted" and had no way to find out who. The test that
    // asserted these "must be reported, not silently dropped" was asserting it
    // at this boundary, one layer below the one that dropped them.
    notAttempted,
    skipped: decision.skipped || [],
    charge,
    // Which key this send's charge was drawn against. Returned so a caller --
    // and a test -- can tell a remainder send from a first send without
    // reading the ledger, and so two remainder sends of one campaign can be
    // seen to have taken different keys rather than assumed to have.
    chargeReference,
    // Whether who-was-reached is now on record. A caller must not offer to
    // send to the remainder unless this says ok.
    recorded,
    detail:
      `${accepted.length} sent` +
      `${failed.length ? `, ${failed.length} failed` : ""}` +
      `${uncertain.length ? `, ${uncertain.length} delivery outcomes unconfirmed -- reconcile provider receipts before retry or remainder send` : ""}` +
      `${notAttempted.length
        ? `, ${notAttempted.length} not attempted -- their addresses are listed${uncertain.length
            ? "; earlier provider acceptance remains unconfirmed, so do not send the remainder until reconciliation"
            : recorded.ok
              ? ", and who was already reached is on record, so only the remainder needs sending"
              : ", and who was already reached was NOT recorded, so sending this campaign again would re-mail everyone above"}`
        : ""}` +
      `${(decision.skipped || []).length ? `, ${(decision.skipped || []).length} skipped for consent` : ""}.`,
  };
}

module.exports = { RESEND_ENDPOINT, RESEND_BATCH_ENDPOINT, MAX_PER_REQUEST, MAX_FALLBACK_BATCHES, dispatchCampaign };
