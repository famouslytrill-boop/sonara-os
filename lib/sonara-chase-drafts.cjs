"use strict";

// Draft messages for invoices a customer has not paid.
//
// Tool five of the twelve in docs/market/2026-08-11-TRADES-AI-TOOL-STACK.md is
// "Claude for overdue invoices" -- the thing an owner puts off because writing
// it while annoyed is how a customer relationship ends. The guide's own example
// asks for a firm follow-up to a client 45 days overdue.
//
// `draft_reply` is on the self-serve list in lib/sonara-agent-authority.cjs --
// "It writes a reply a person still has to send." Every action that would
// actually send falls through to `unrecognised` and needs the owner, which was
// checked against the module rather than assumed. So this drafts and stops.
//
// **No model call.** These are assembled from the owner's own rows. That keeps
// them free, which is the requirement, but it is also why they can be trusted:
// a template cannot hallucinate a payment that was never made or a term nobody
// agreed. What it costs is range -- these read like forms, because they are.
//
// The hard rule is what a draft may say. It may state what the records show:
// the invoice number, what is outstanding, the date it was due, how many days
// ago that was. It may not state anything the records do not hold, and three
// things in particular that the obvious version of this would have invented:
//
//   How many reminders have already been sent. Nothing records that. "As we
//   have already reminded you twice" is a claim that can be false to the
//   customer's face.
//
//   Payment terms, interest, or late fees. No table holds them. A draft that
//   mentions a fee the business never agreed is a term it cannot enforce and
//   may not be allowed to charge.
//
//   Any threat of legal action, collection or credit reporting. That is a
//   statement the business is held to, and AGENTS.md puts anything of that kind
//   behind owner approval. An owner can write it themselves; a draft that
//   arrives pre-written invites sending it unread.

const STAGES = Object.freeze([
  Object.freeze({
    key: "gentle",
    from: 1,
    to: 14,
    label: "A short reminder",
    // Most invoices at this age are an oversight, not a refusal.
    opening: (context) => `I hope you are well. I wanted to check in about invoice ${context.reference}, which was due on ${context.dueOn}.`,
    body: () => "It may well have been missed, in which case please ignore this. If there is anything you need from me to get it processed, let me know and I will send it over.",
    closing: () => "Thanks very much."
  }),
  Object.freeze({
    key: "firm",
    from: 15,
    to: 45,
    label: "A firmer follow-up",
    opening: (context) => `I am following up on invoice ${context.reference} for ${context.amount}, which was due on ${context.dueOn} and is now ${context.daysOverdue} days past due.`,
    body: () => "Could you let me know when it will be paid? If there is a problem with the invoice itself, or the timing is difficult, tell me and we can sort something out.",
    closing: () => "I would appreciate a reply either way."
  }),
  Object.freeze({
    key: "final",
    from: 46,
    to: Infinity,
    label: "A direct request",
    opening: (context) => `Invoice ${context.reference} for ${context.amount} was due on ${context.dueOn} and is now ${context.daysOverdue} days overdue.`,
    // Deliberately no threat and no deadline invented on the owner's behalf.
    // The next step is the owner's decision, and a draft that has already made
    // it is a draft that gets sent without being read.
    body: () => "I need to get this settled. Please let me know today when payment will be made, or call me so we can agree a way forward.",
    closing: () => "Thanks for dealing with this promptly."
  })
]);

// Grouped, because this is text a customer reads. "$18400.00" in a message
// chasing eighteen thousand dollars looks like a mistake, and a customer who
// thinks the figure is wrong has a reason not to pay it yet.
function money(cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return null;
  const [whole, fraction] = (amount / 100).toFixed(2).split(".");
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

function daysOverdue(dueOn, now = Date.now()) {
  if (dueOn === null || dueOn === undefined || String(dueOn).trim() === "") return null;
  const due = Date.parse(String(dueOn).slice(0, 10));
  if (!Number.isFinite(due)) return null;
  const today = Date.parse(new Date(now).toISOString().slice(0, 10));
  const days = Math.round((today - due) / 86400000);
  return days > 0 ? days : null;
}

function stageFor(days) {
  if (days === null) return null;
  return STAGES.find((stage) => days >= stage.from && days <= stage.to) || null;
}

function outstandingCents(invoice, paidByInvoice) {
  const total = Number(invoice?.total_cents);
  if (!Number.isFinite(total)) return null;
  const paid = Number(paidByInvoice?.get?.(invoice?.id) || 0);
  return Math.max(0, total - (Number.isFinite(paid) ? paid : 0));
}

/**
 * One draft per overdue invoice, or a stated reason there is none.
 *
 * Returns { drafts, skipped }. A skipped invoice is reported with why rather
 * than dropped: an invoice this cannot write about is still money owed, and a
 * shorter list with no explanation reads as less debt.
 */
function build({ invoices = [], customersById = new Map(), paidByInvoice = new Map(), businessName = "", now = Date.now() } = {}) {
  const drafts = [];
  const skipped = [];

  for (const invoice of Array.isArray(invoices) ? invoices : []) {
    if (!invoice || String(invoice.status || "").toLowerCase() !== "sent") continue;

    const reference = String(invoice.invoice_number || "").trim();
    const days = daysOverdue(invoice.due_on, now);
    const stage = stageFor(days);
    if (!stage) continue;

    const outstanding = outstandingCents(invoice, paidByInvoice);
    if (outstanding === null || outstanding === 0) {
      skipped.push({
        id: invoice.id,
        reference: reference || "an invoice with no number",
        reason: outstanding === 0
          ? "It has been paid in full, so there is nothing to chase. Its status is still \"sent\" — change it to paid."
          : "It has no amount recorded, so a draft would have to invent the figure."
      });
      continue;
    }

    const customer = customersById.get?.(invoice.customer_id) || null;
    if (!customer || !String(customer.name || "").trim()) {
      skipped.push({
        id: invoice.id,
        reference: reference || "an invoice with no number",
        reason: "It is not attached to a customer, so there is nobody to address. Set the customer on the invoice."
      });
      continue;
    }

    const context = {
      reference: reference || "the outstanding invoice",
      amount: money(outstanding),
      dueOn: String(invoice.due_on).slice(0, 10),
      daysOverdue: days
    };

    // The signature is the business's own name if it is known, and a marked
    // blank if it is not. Signing a customer message with a guess is worse
    // than leaving the owner one thing to fill in.
    const signature = String(businessName || "").trim() || "[your business name]";

    drafts.push({
      invoiceId: invoice.id,
      reference: context.reference,
      customerName: String(customer.name).trim(),
      customerEmail: String(customer.email || "").trim() || null,
      daysOverdue: days,
      outstandingCents: outstanding,
      stage: stage.key,
      stageLabel: stage.label,
      subject: `Invoice ${context.reference} — ${context.amount} outstanding`,
      body: [
        `Hi ${String(customer.name).trim()},`,
        "",
        stage.opening(context),
        "",
        stage.body(context),
        "",
        stage.closing(context),
        "",
        signature
      ].join("\n")
    });
  }

  drafts.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return { drafts, skipped };
}

module.exports = { STAGES, daysOverdue, stageFor, outstandingCents, build };
