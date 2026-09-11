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

const { drawEntry } = require("./sonara-usage-meter.cjs");
const { billableEmailCount } = require("./growth-studio-sender.cjs");
const {
  deriveSigningKey,
  signToken,
  unsubscribeUrl,
  unsubscribeHeaders,
  withUnsubscribeLine
} = require("./growth-studio-unsubscribe.cjs");
const { redactSensitiveText } = require("./sonara-redaction.cjs");

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
// So nothing is guessed. A batch counts as clean only when the request
// succeeded AND `data` has exactly one entry per email sent. **Anything else
// falls back to sending that batch one recipient at a time**, which is the old
// path, and every failure in it is attributed by address. The undocumented case
// is therefore never interpreted -- it is retried in a form that cannot be
// ambiguous.
const MAX_PER_REQUEST = 100;

// The ceiling on how much recovery the fallback may attempt, and it exists
// because the fallback is the expensive path.
//
// Vercel's documented default duration is 300 seconds. At a pessimistic 500ms
// per call, ten batches of 100 is 5 seconds -- but if every batch fell back,
// 1,000 individual sends would be 500 seconds and the function would be killed
// mid-campaign, which is the one outcome worse than refusing.
//
// So at most two batches may fall back: 10 + 200 calls, 105 seconds pessimistic,
// which still leaves room for the suppression read (up to 15s) and the ledger
// write. Past that the remaining recipients are reported as **not attempted**
// rather than attempted and untracked. An owner reading "not attempted" knows
// to send again; an owner reading nothing does not.
const MAX_FALLBACK_BATCHES = 2;

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

  const cleanSubject = String(subject || "").trim();
  const cleanBody = String(body || "").trim();
  if (!cleanSubject || !cleanBody) {
    return { ok: false, code: "empty_message", detail: "A campaign needs a subject and a body.", sent: 0, failed: [] };
  }

  // Off unless configured, which is AGENTS.md's rule rather than a preference:
  // "email alerts must be off or explicitly user-controlled by default."
  if (typeof getReadiness === "function" && getReadiness()?.services?.emailDelivery !== "enabled") {
    return { ok: false, code: "email_not_configured", detail: "Email delivery is not configured, so nothing was sent.", sent: 0, failed: [] };
  }

  const apiKey = getEnv("RESEND_API_KEY");
  const from = getEnv("RESEND_FROM_EMAIL");
  if (!apiKey || !from) {
    return { ok: false, code: "email_not_configured", detail: "RESEND_API_KEY or RESEND_FROM_EMAIL is unset, so nothing was sent.", sent: 0, failed: [] };
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
    return {
      ok: false,
      code: "unsubscribe_not_configured",
      detail: "No unsubscribe signing key is available, so nothing was sent: a campaign has to carry a way to stop it.",
      sent: 0,
      failed: []
    };
  }
  const probeUrl = unsubscribeUrl({ origin, token: "probe" });
  if (!probeUrl) {
    return {
      ok: false,
      code: "unsubscribe_origin_required",
      detail: "This site's https address is not known, so an unsubscribe link cannot be built and nothing was sent.",
      sent: 0,
      failed: []
    };
  }

  const accepted = [];
  const failed = [];
  const notAttempted = [];

  // Each recipient's message, built before anything is sent.
  //
  // The unsubscribe token names the recipient, so a message cannot be shared
  // between two of them -- one shared link would let any recipient unsubscribe
  // every other, and would make a forwarded email a way to remove somebody else
  // from the list. Batching changes how many go per request; it does not change
  // that each carries its own.
  const messages = [];
  for (const recipient of decision.eligible) {
    const token = signToken({ organizationId, leadId: recipient.id, key: signingKey });
    const url = unsubscribeUrl({ origin, token });
    const text = withUnsubscribeLine(cleanBody, url);
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

  // One recipient, one request. The fallback path, and the only path that can
  // attribute a failure to an address with certainty.
  async function sendOne(message) {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: authorised,
      body: JSON.stringify(message)
    }).catch(() => undefined);

    if (response?.ok) {
      accepted.push(message.to[0]);
      return;
    }

    // The address is kept, because the owner needs to know WHO did not receive
    // it, and the status is kept because a 422 (bad address) and a 429 (rate
    // limited) need different actions. Redaction is applied when this is
    // logged, not here -- the caller may render it to the owner, who is
    // entitled to see their own customer's address.
    failed.push({ email: message.to[0], status: response?.status || 0 });
  }

  let fallbacksUsed = 0;

  for (let index = 0; index < messages.length; index += MAX_PER_REQUEST) {
    const batch = messages.slice(index, index + MAX_PER_REQUEST);

    // A single recipient is not a batch. Sending it through the batch endpoint
    // would buy nothing and would put the one case that needs no reconciliation
    // through the code that reconciles.
    if (batch.length === 1) {
      await sendOne(batch[0]);
      continue;
    }

    const response = await fetchImpl(RESEND_BATCH_ENDPOINT, {
      method: "POST",
      headers: authorised,
      body: JSON.stringify(batch)
    }).catch(() => undefined);

    const payload = response?.ok ? await response.json().catch(() => null) : null;
    const ids = Array.isArray(payload?.data) ? payload.data : null;

    // Clean means the request succeeded AND there is exactly one entry per
    // email. The reference documents the alignment, so a full-length `data` can
    // be trusted to name these recipients in this order -- and a short one
    // cannot be reconciled at all, which is why it is not tried.
    if (ids && ids.length === batch.length) {
      for (const message of batch) accepted.push(message.to[0]);
      continue;
    }

    // Not clean. Rather than interpret an undocumented shape, resend this batch
    // one at a time so every outcome is attributed to an address.
    //
    // **The duplicate risk is real and is accepted deliberately.** A batch that
    // failed after accepting some of its emails would send those again. The
    // alternative is telling the owner that 100 people may or may not have been
    // emailed, which is the reporting defect this whole file is built against --
    // and a duplicate email is a smaller harm than an unknown one.
    if (fallbacksUsed >= MAX_FALLBACK_BATCHES) {
      // Bounded, because the fallback is what could run the function out of
      // time. Reported as not attempted, which is a state an owner can act on.
      for (const message of batch) notAttempted.push({ email: message.to[0], reason: "fallback_budget_spent" });
      continue;
    }

    fallbacksUsed += 1;
    report({
      code: "batch_fell_back",
      detail: `campaign ${campaignId} batch of ${batch.length} did not return one id per email (status ${response?.status || 0}); resending it individually`
    });
    for (const message of batch) await sendOne(message);
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
      idempotencyKey: `campaign:${campaignId}`
    });

    if (!entry.ok) {
      report({ code: entry.code, detail: `campaign ${campaignId} sent ${accepted.length} and was not charged` });
      charge = { ok: false, code: entry.code };
    } else if (typeof appendLedger !== "function") {
      // Absent rather than failed, and said differently. A caller that forgot
      // to wire the ledger has a bug; a ledger that rejected the row has an
      // outage. Reporting both as the same thing hides one of them.
      report({ code: "ledger_not_wired", detail: `campaign ${campaignId} sent ${accepted.length} with no ledger writer supplied` });
      charge = { ok: false, code: "ledger_not_wired" };
    } else {
      const written = await appendLedger({
        ...entry.row,
        metadata: { campaign_id: campaignId, accepted: accepted.length, failed: failed.length, skipped: (decision.skipped || []).length }
      }).catch((error) => ({ ok: false, code: "ledger_write_threw", detail: String(error?.message || error) }));

      if (!written.ok) {
        // The emails have gone. Nothing here can un-send them, so this is
        // reported rather than raised: failing the dispatch now would tell the
        // owner nothing was sent when 460 messages are already in flight.
        report({ code: written.code, detail: `campaign ${campaignId} sent ${accepted.length} and the charge of ${entry.row.amount_minor} was not recorded` });
      }
      charge = { ok: Boolean(written.ok), code: written.code, amountMinor: entry.row.amount_minor, duplicate: Boolean(written.duplicate) };
    }
  }

  return {
    // `ok` is about the dispatch, and it is true when anything was accepted --
    // a campaign where 459 of 460 landed is not a failed campaign. The counts
    // below are what an owner reads; a single boolean cannot carry them.
    ok: accepted.length > 0,
    code:
      accepted.length === 0
        ? "all_failed"
        : failed.length === 0 && notAttempted.length === 0
          ? "sent"
          : "partly_sent",
    sent: accepted.length,
    failed,
    // Recipients nothing was even tried for, because the fallback budget ran
    // out. Named separately from `failed` on purpose: a failed send was
    // attempted and refused, and this was not attempted at all. An owner does
    // something different about each -- one is a bad address, the other is
    // "send this again".
    notAttempted,
    skipped: decision.skipped || [],
    charge,
    detail:
      `${accepted.length} sent` +
      `${failed.length ? `, ${failed.length} failed` : ""}` +
      `${notAttempted.length ? `, ${notAttempted.length} not attempted -- send again to reach them` : ""}` +
      `${(decision.skipped || []).length ? `, ${(decision.skipped || []).length} skipped for consent` : ""}.`,
  };
}

module.exports = { RESEND_ENDPOINT, RESEND_BATCH_ENDPOINT, MAX_PER_REQUEST, MAX_FALLBACK_BATCHES, dispatchCampaign };
