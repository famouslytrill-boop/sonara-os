// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A link that says which campaign it came from.
//
// The Growth chain runs campaign -> delivery -> engagement -> conversion ->
// attribution -> return. A campaign's page counts "people who came in through
// it" by growth_leads.campaign_id, and nothing set that column for somebody who
// arrived by following a campaign: the public chat page wrote every lead with
// source "chat_widget" and no campaign at all. So an emailed campaign that
// brought in five enquiries showed none, and its return was worked out against
// whatever conversions somebody remembered to record by hand.
//
// The reference rides on the link as `?c=<campaign id>`:
//   - a campaign email's links to this business's own chat pages are tagged
//     when it is sent (tagCampaignLinks);
//   - the chat page carries it to the first answer, which keeps it on the
//     conversation as a claim;
//   - when the conversation produces a lead, the claim is checked against the
//     campaigns of the business that owns the page, and only then becomes the
//     lead's campaign_id.
//
// The check is the whole safety property. The parameter is in an address
// anybody can edit, so it is a claim and never a fact: a campaign id from
// another business, a deleted campaign or nonsense is dropped and the lead is
// saved without one. Dropping matters as much as refusing, because
// growth_leads.campaign_id is a foreign key and an unchecked id would make the
// insert fail and lose the enquiry.

const CAMPAIGN_PARAM = "c";
const CAMPAIGN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;

/** A campaign id from a query or form value, or null. Never trusted beyond its shape. */
function campaignFromValue(value) {
  const text = Array.isArray(value) ? "" : String(value ?? "").trim();
  return CAMPAIGN_ID.test(text) ? text.toLowerCase() : null;
}

/** The address that credits an enquiry on one chat page to one campaign. */
function campaignLink({ origin, slug, campaignId }) {
  const id = campaignFromValue(campaignId);
  const base = String(origin || "").replace(/\/+$/, "");
  if (!id || !SLUG.test(String(slug || "")) || !/^https:\/\/[^/\s]+$/.test(base)) return null;
  return `${base}/chat/${slug}?${CAMPAIGN_PARAM}=${id}`;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A link is tagged only where it stands on its own in the text. It starts the
// message or follows a space, an opening bracket or a quote; it ends the
// message or is followed by a space, perhaps after closing punctuation. Any
// other neighbour makes it part of a longer address -- this site's link inside
// somebody else's (a redirect's `?to=`), or a longer address on this site
// (`.html`, `/extra`, `&x`) -- and adding a query there would change where
// that address goes. Leaving a link untagged costs only the credit; the
// enquiry is still taken.
//
// The quotes include the curly ones and guillemets, because a phone keyboard
// types those for a plain quote by default, and a link quoted on a phone would
// otherwise lose its credit without anybody noticing.
const STANDS_ALONE_BEFORE = String.raw`(?<![^\s(<\["'“‘«])`;
const STANDS_ALONE_AFTER = String.raw`(?=$|\s|[.,;:!?)\]>"'”’»…]+(?:\s|$))`;

/**
 * Tag every link in a plain-text body that points at one of this site's chat
 * pages with the campaign it was sent in. Links elsewhere are left as written,
 * and so is a chat link that already carries a query or fragment: the owner
 * wrote that one deliberately, and rewriting it could break what they meant.
 */
function tagCampaignLinks(text, { origin, campaignId } = {}) {
  const body = String(text ?? "");
  const id = campaignFromValue(campaignId);
  const base = String(origin || "").replace(/\/+$/, "");
  if (!id || !/^https:\/\/[^/\s]+$/.test(base)) return body;
  const pattern = new RegExp(`${STANDS_ALONE_BEFORE}${escapeRegExp(base)}/chat/([a-z0-9][a-z0-9-]{1,46}[a-z0-9])${STANDS_ALONE_AFTER}`, "g");
  return body.replace(pattern, (match, slug) => `${base}/chat/${slug}?${CAMPAIGN_PARAM}=${id}`);
}

module.exports = { CAMPAIGN_PARAM, campaignFromValue, campaignLink, tagCampaignLinks };
