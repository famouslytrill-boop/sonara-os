"use strict";

// Addresses the provider has already given up on, so a campaign stops mailing
// them.
//
// `growth-studio-sender.cjs` has always documented a `suppressed` skip reason --
// "They unsubscribed or a previous send bounced." -- and **nothing set it.** The
// field was honoured by the partition and could never be true, which is the
// shape of a check that cannot fire: not wrong, just inert.
//
// ## What this is not
//
// It is not consent. `growth_contact_consents` is the record of what a person
// agreed to, it is organization-scoped, and it stays the authority on whether
// this business may mail that person. This is the separate question of whether
// the ADDRESS still works, and the two are different: a contact can have given
// perfect consent to a mailbox that was deleted a year ago.
//
// So a suppression is read and acted on, and **never written into the consent
// table**. Recording a hard bounce as a withdrawal would put words in somebody's
// mouth -- they did not refuse, their mail server did -- and an owner who later
// fixed the address would find a withdrawal on file that nobody made.
//
// ## The scoping fact I could not confirm, stated as unconfirmed
//
// resend.com/docs/api-reference/suppressions/list-suppressions, read 10
// September 2026: a record carries `id`, `email`, `origin`, `source_id` and
// `created_at`, and `origin` is one of `bounce`, `complaint` or `manual`.
//
// **The documentation does not say whether the list is scoped per account or
// per sending domain.** The endpoint is a bare `/suppressions` with no domain
// parameter, which suggests per account, and suggesting is not knowing. It
// matters because this application sends every customer's campaigns from its
// own Resend account: if the list is account-wide then one organization's hard
// bounce stops every organization mailing that address.
//
// That is defensible -- a dead mailbox is dead for everybody, and continuing to
// mail it damages a sending reputation all customers share -- but it is a real
// cross-tenant effect and it is written down rather than discovered. What is NOT
// disclosed either way: which organization caused it. An owner sees only that
// the provider has the address suppressed.
//
// ## Why a failed read still sends
//
// A campaign is not refused because this list could not be fetched. Sending an
// unscreened campaign costs a little sending reputation; refusing the owner's
// campaign because a third-party API blipped costs them the campaign, and this
// is a screen on top of the consent rules rather than one of them.
//
// **But it is never silent.** The result says whether the screen ran, and the
// caller reports it. "460 sent" and "460 sent, and we could not check which
// addresses the provider has given up on" are different sentences, and only one
// of them is true when this fails.

const SUPPRESSIONS_ENDPOINT = "https://api.resend.com/suppressions";

// The provider's documented maximum per page. Asking for more is silently
// clamped, which would make a page look full when it was not.
const PAGE_SIZE = 100;

// How many pages to walk before giving up on knowing.
//
// 30 pages is 3,000 addresses, and the ceiling is about time rather than
// memory. `dispatchCampaign` makes one request per recipient inside a function
// whose documented budget is 300 seconds, and the send cap of 400 recipients
// already claims 200 of those at a pessimistic 500ms each. Thirty pages at the
// same pessimistic rate is 15 seconds, which fits in the remaining 100 with
// room left.
//
// **Past the ceiling this reports that it does not know, rather than returning
// the first 3,000.** A partial list would skip the suppressed addresses it
// happened to see and mail the rest while reporting the screen as having run,
// which is the defect this repository is named for.
const MAX_PAGES = 30;

// The three values the `origin` field takes, quoted from the reference above.
// Kept as a named set so an unrecognised origin is visible rather than folded
// into a default.
const ORIGINS = Object.freeze(["bounce", "complaint", "manual"]);

function normalise(value) {
  return String(value == null ? "" : value).trim().toLowerCase();
}

// Every address the provider has suppressed, or an honest account of why not.
//
// Returns `{ ok, addresses, origins, pages, reason }`. `addresses` is a Set and
// `origins` a Map from address to why -- the owner does something different
// about a complaint than about a bounce, and "suppressed" alone tells them
// nothing.
//
// Three outcomes, not two: configured and read, not configured at all, and
// configured but unreadable. A caller that collapsed the last two would tell an
// owner their provider was misconfigured when it had merely timed out.
async function readSuppressions({ getEnv = (name) => process.env[name], fetchImpl = fetch } = {}) {
  const apiKey = getEnv("RESEND_API_KEY");
  if (!apiKey) {
    return { ok: false, code: "not_configured", addresses: new Set(), origins: new Map(), pages: 0, reason: "RESEND_API_KEY is unset, so the provider's suppression list cannot be read." };
  }

  const addresses = new Set();
  const origins = new Map();
  let after = null;
  let pages = 0;

  while (pages < MAX_PAGES) {
    const query = `limit=${PAGE_SIZE}${after ? `&after=${encodeURIComponent(after)}` : ""}`;
    const response = await fetchImpl(`${SUPPRESSIONS_ENDPOINT}?${query}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
    }).catch(() => undefined);

    if (!response?.ok) {
      return {
        ok: false,
        code: "unreadable",
        addresses: new Set(),
        origins: new Map(),
        pages,
        reason: `The provider's suppression list could not be read (${response?.status || 0}).`
      };
    }

    const body = await response.json().catch(() => null);
    const rows = Array.isArray(body?.data) ? body.data : null;
    if (!rows) {
      // Not an empty list. A body this cannot parse is a body whose emptiness
      // is unknown, and reading it as "nobody is suppressed" is the absent-read
      // -as-zero defect on the one field that decides who gets mailed.
      return { ok: false, code: "unreadable", addresses: new Set(), origins: new Map(), pages, reason: "The provider's suppression list came back in a shape this cannot read." };
    }

    pages += 1;

    for (const row of rows) {
      const email = normalise(row?.email);
      if (!email) continue;
      addresses.add(email);
      // An origin outside the documented three is kept as itself rather than
      // mapped to one of them. If the provider adds a fourth, the owner should
      // see its name, not a guess.
      origins.set(email, ORIGINS.includes(normalise(row?.origin)) ? normalise(row.origin) : "unrecognised");
    }

    // `has_more` is the provider's own answer, and a page shorter than the
    // limit is checked too: a body that omitted has_more would otherwise loop
    // to the ceiling on a list already exhausted.
    if (body?.has_more !== true || rows.length < PAGE_SIZE) {
      return { ok: true, code: "read", addresses, origins, pages, reason: null };
    }

    const last = rows[rows.length - 1]?.id;
    if (!last) {
      // No cursor to continue from. Reported rather than looped, because
      // repeating the same request would return the same page for ever.
      return { ok: false, code: "unreadable", addresses: new Set(), origins: new Map(), pages, reason: "The provider's suppression list gave no cursor to page with." };
    }
    after = last;
  }

  return {
    ok: false,
    code: "too_many",
    addresses: new Set(),
    origins: new Map(),
    pages,
    reason: `The provider has more than ${MAX_PAGES * PAGE_SIZE} suppressed addresses; a partial list would mail the ones it did not reach while reporting the check as done.`
  };
}

// Set `suppressed` on the recipients the provider has given up on.
//
// This does not decide anything: `growth-studio-sender.cjs` already skips a
// recipient whose `suppressed` is true, with a named reason. All this does is
// make the field it documented finally capable of being true.
//
// A failed read marks nobody, which is the deliberate degrade -- the campaign
// goes out unscreened and the caller says so.
function markSuppressed(recipients, suppression) {
  const list = Array.isArray(recipients) ? recipients : [];
  if (!suppression?.ok) return { recipients: list, marked: 0, checked: false };

  let marked = 0;
  const out = list.map((recipient) => {
    if (!suppression.addresses.has(normalise(recipient?.email))) return recipient;
    marked += 1;
    // `suppressed: true` is what the sender reads. The origin rides along for
    // the owner, who does something different about a complaint than a bounce.
    return { ...recipient, suppressed: true, suppression_origin: suppression.origins.get(normalise(recipient.email)) || "unrecognised" };
  });

  return { recipients: out, marked, checked: true };
}

module.exports = {
  SUPPRESSIONS_ENDPOINT,
  PAGE_SIZE,
  MAX_PAGES,
  ORIGINS,
  readSuppressions,
  markSuppressed
};
