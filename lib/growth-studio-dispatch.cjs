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
const { redactSensitiveText } = require("./sonara-redaction.cjs");

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Resend's own documented ceiling for a batch call. Kept as a named constant
// because a number inlined in a loop is a number nobody revisits when the
// vendor changes it.
const MAX_PER_REQUEST = 1;

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

  const accepted = [];
  const failed = [];

  for (const recipient of decision.eligible) {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [recipient.email], subject: cleanSubject, text: cleanBody })
    }).catch(() => undefined);

    if (response?.ok) {
      accepted.push(recipient.email);
      continue;
    }

    // The address is kept, because the owner needs to know WHO did not receive
    // it, and the status is kept because a 422 (bad address) and a 429 (rate
    // limited) need different actions. Redaction is applied when this is
    // logged, not here -- the caller may render it to the owner, who is
    // entitled to see their own customer's address.
    failed.push({ email: recipient.email, status: response?.status || 0 });
  }

  // Charged for what was accepted. We pay Resend per accepted message, so
  // billing for attempts would charge a customer for our own failed requests.
  let charge = { ok: false, code: "not_attempted" };
  if (accepted.length > 0) {
    const entry = drawEntry({
      capability: decision.quote?.capability || "campaign_email",
      units: accepted.length,
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
    code: failed.length === 0 ? "sent" : accepted.length === 0 ? "all_failed" : "partly_sent",
    sent: accepted.length,
    failed,
    skipped: decision.skipped || [],
    charge,
    detail:
      `${accepted.length} sent` +
      `${failed.length ? `, ${failed.length} failed` : ""}` +
      `${(decision.skipped || []).length ? `, ${(decision.skipped || []).length} skipped for consent` : ""}.`,
  };
}

module.exports = { RESEND_ENDPOINT, MAX_PER_REQUEST, dispatchCampaign };
