// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Creator Studio's marketplace.
//
//   GET  /creator-studio/owner/marketplace          your listings and what each needs
//   POST /creator-studio/owner/marketplace          create a draft listing against a version
//   POST /creator-studio/owner/marketplace/:id      set price, licence, attestations
//   POST /creator-studio/owner/marketplace/:id/list put it on sale
//   POST /creator-studio/owner/marketplace/:id/withdraw
//   GET  /marketplace                               what anybody can browse
//   GET  /marketplace/:id                           one thing on sale
//
// The decisions are in lib/sonara-creator-marketplace.cjs. This file reads,
// renders and writes.
//
// ## Two tables, and why the public pages read only one of them
//
// `creator_listings` is the creator's own record: draft or on sale, price,
// licence, both attestations, a private note. It is tenant data, and every read of
// it here names the organization.
//
// `creator_marketplace_entries` is the public catalogue: one row per listing on
// sale, holding only what a buyer may see and **no organization at all**. The
// public pages read that and nothing else. The first draft of this file read
// creator_listings from /marketplace across every organization in one query;
// tests/cross-tenant-isolation.test.js refused it, and it was right to. A public
// query against the catalogue cannot leak a private column because the table has
// none -- its migration asserts the exact column set.
//
// The catalogue is a snapshot, so this file is responsible for keeping it true:
//
//   - **List** asks listingReadiness again, at the moment of the decision, then
//     writes the snapshot of exactly what it cleared.
//   - **Save** on something already on sale re-asks: still cleared rewrites the
//     snapshot (a new price must not leave the old one on show), no longer
//     cleared takes it off sale and says why.
//   - **Withdraw** removes the catalogue row first and the state second, so a
//     failure leaves it off sale rather than on.
//   - The approval graph removes it when the version's approval is withdrawn,
//     rejected or reopened for review -- see takeVersionOffSale below, which
//     routes/sonara-creator-approval-graph-routes.cjs calls.
//   - The creator's page re-checks every listing live and says plainly when
//     something on sale has stopped being cleared.
//
// Nothing here takes money. Checkout needs the owner's commerce credentials; a
// cleared listing says checkout is not connected rather than showing a Buy button
// that cannot charge.

const market = require("../lib/sonara-creator-marketplace.cjs");

const OWNER_PAGE = "/creator-studio/owner/marketplace";
const PUBLIC_PAGE = "/marketplace";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TITLE_MAX = 200;
const NOTE_MAX = 2000;

// The column lists are written out in each query rather than held in a constant,
// which looks like duplication and is not: scripts/report-unused-selected-columns.mjs
// hunts a column fetched into a decision and never read, and it cannot read a list
// built at run time. None of them is `*`.

/**
 * Take every listing on one version off sale.
 *
 * Exported for the approval graph, which calls it when a version stops being
 * approved. Scoped by organization on every query: the version id arrives from a
 * form, and a version id alone would let one workspace withdraw another's sales.
 *
 * Catalogue first, state second, for the same reason as withdraw: if the second
 * write fails, the listing is off sale and says draft-or-listed wrongly, which is a
 * page to fix; the other order fails with something on sale that is not cleared.
 */
async function takeVersionOffSale({ config, supabaseHeaders, organizationId, versionId }) {
  if (!config?.ok || !UUID.test(String(organizationId || "")) || !UUID.test(String(versionId || ""))) {
    return { ok: false, taken: 0 };
  }
  const enc = encodeURIComponent;
  let listings;
  try {
    const response = await fetch(
      `${config.url}/rest/v1/creator_listings?select=id&version_id=eq.${enc(versionId)}&organization_id=eq.${enc(organizationId)}&state=eq.listed&limit=200`,
      { headers: supabaseHeaders(config) }
    );
    listings = response.ok ? await response.json().catch(() => null) : null;
  } catch {
    listings = null;
  }
  if (!Array.isArray(listings)) return { ok: false, taken: 0 };
  let taken = 0;
  for (const listing of listings) {
    const removed = await fetch(
      `${config.url}/rest/v1/creator_marketplace_entries?listing_id=eq.${enc(listing.id)}`,
      { method: "DELETE", headers: supabaseHeaders(config, { prefer: "return=minimal" }) }
    ).catch(() => undefined);
    if (!removed?.ok) continue;
    await fetch(
      `${config.url}/rest/v1/creator_listings?id=eq.${enc(listing.id)}&organization_id=eq.${enc(organizationId)}`,
      {
        method: "PATCH",
        headers: supabaseHeaders(config, { prefer: "return=minimal" }),
        body: JSON.stringify({ state: "draft", updated_at: new Date().toISOString() })
      }
    ).catch(() => undefined);
    taken += 1;
  }
  return { ok: taken === listings.length, taken };
}

function registerCreatorMarketplaceRoutes(app, deps = {}) {
  for (const name of ["layout", "brandCard", "linkAction", "responsePage", "escapeHtml", "requireWorkspaceAccess", "getCustomerPrimaryOrganization", "getSupabaseServerConfig", "supabaseHeaders"]) {
    if (!deps[name]) throw new TypeError(`registerCreatorMarketplaceRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, responsePage, escapeHtml,
    requireWorkspaceAccess, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders
  } = deps;

  const page = (res, input) => res.status(200).type("html").send(layout(input));
  const enc = encodeURIComponent;

  /** `{ ok, rows }`, never a bare array: a failed read must not render as none. */
  async function read(pathAndQuery) {
    const config = getSupabaseServerConfig();
    if (!config?.ok) return { ok: false, rows: [] };
    let response;
    try {
      response = await fetch(`${config.url}/rest/v1/${pathAndQuery}`, { headers: supabaseHeaders(config) });
    } catch {
      return { ok: false, rows: [] };
    }
    if (!response.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => null);
    if (!Array.isArray(rows)) return { ok: false, rows: [] };
    return { ok: true, rows };
  }

  async function write(pathAndQuery, { method = "POST", body, prefer = "return=minimal" } = {}) {
    const config = getSupabaseServerConfig();
    if (!config?.ok) return { ok: false };
    try {
      const response = await fetch(`${config.url}/rest/v1/${pathAndQuery}`, {
        method,
        headers: supabaseHeaders(config, { prefer }),
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      return { ok: response.ok };
    } catch {
      return { ok: false };
    }
  }

  /**
   * The version a listing points at, with its approvals, inside one organization.
   *
   * The organization is required. The first draft accepted null here so the
   * public page could call it, and built `organization_id=eq.null` -- a filter
   * matching nothing, which would have meant no listing could ever appear
   * publicly. The public pages read the catalogue now and never call this.
   */
  async function versionFor(organizationId, versionId) {
    if (!UUID.test(String(organizationId || ""))) return { ok: false, version: null, approvals: null };
    if (!UUID.test(String(versionId || ""))) return { ok: true, version: null, approvals: [] };
    const versions = await read(
      `creator_asset_versions?select=id,asset_id,version_number,source,ai_disclosure,provenance&id=eq.${enc(versionId)}&organization_id=eq.${enc(organizationId)}&limit=1`
    );
    if (!versions.ok) return { ok: false, version: null, approvals: null };
    const row = versions.rows[0];
    if (!row) return { ok: true, version: null, approvals: [] };
    // `asset_version_id`, which is what the approvals table keys on. The first
    // draft filtered on `version_id`, a column that table does not have, so every
    // approvals read would have failed and no listing could ever have been cleared.
    // `created_at` as well as `decided_at`: a review request has no decided_at, and
    // the approval graph orders by decidedAt falling back to createdAt -- without
    // it, a re-review requested after an approval would sort first and leave the
    // listing cleared, when asking again is exactly what un-clears it.
    const approvals = await read(
      `creator_asset_approvals?select=state,decided_at,decided_by,created_at&asset_version_id=eq.${enc(versionId)}&organization_id=eq.${enc(organizationId)}&order=created_at.asc&limit=100`
    );
    return {
      ok: true,
      // The decision module reads camelCase and the database gives snake_case. The
      // mapping happens here, once, which is why the module tests without a database.
      version: {
        id: row.id,
        assetId: row.asset_id,
        versionNumber: row.version_number,
        source: row.source,
        aiDisclosure: row.ai_disclosure,
        provenance: row.provenance
      },
      // null rather than [] when the read failed: publishReadiness tells "no
      // approvals" from "could not read the approvals", and [] would lose that.
      approvals: approvals.ok
        ? approvals.rows.map((approval) => ({
          state: approval.state,
          decidedAt: approval.decided_at,
          decidedBy: approval.decided_by,
          createdAt: approval.created_at
        }))
        : null
    };
  }

  function currencyOf(listing) {
    return String(listing?.currency || "usd").toLowerCase();
  }

  async function readinessFor(organizationId, listing) {
    const found = await versionFor(organizationId, listing.version_id);
    return market.listingReadiness({
      listing,
      version: found.ok ? found.version : null,
      approvals: found.ok ? found.approvals : null,
      storefrontCurrency: currencyOf(listing)
    });
  }

  async function ownListing(organizationId, id) {
    return read(
      `creator_listings?select=id,title,medium,price_cents,currency,licence,state,rights_attested,consent_attested,note,version_id&id=eq.${enc(id)}&organization_id=eq.${enc(organizationId)}&limit=1`
    );
  }

  /** Write the snapshot of a cleared listing, replacing any older one. */
  async function publishEntry(entry) {
    return write("creator_marketplace_entries?on_conflict=listing_id", {
      method: "POST",
      body: { ...entry, listed_at: new Date().toISOString() },
      prefer: "resolution=merge-duplicates,return=minimal"
    });
  }

  async function removeEntry(listingId) {
    return write(`creator_marketplace_entries?listing_id=eq.${enc(listingId)}`, { method: "DELETE" });
  }

  function refuse(res, message, status = 400) {
    return res.status(status).type("html").send(responsePage("That did not happen", message, [linkAction(OWNER_PAGE, "Back to your marketplace")]));
  }

  // -------------------------------------------------------------------------
  // The creator's side
  // -------------------------------------------------------------------------

  app.get(OWNER_PAGE, requireWorkspaceAccess("creator_studio"), async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization.ok) {
      return page(res, {
        title: "Marketplace",
        eyebrow: "Creator Studio",
        heading: "Your marketplace",
        body: "We could not tell which workspace you are signed in to, so nothing is shown and nothing has been changed.",
        sections: [brandCard("Nothing was read", "This is a problem on our side, not an empty marketplace.")],
        actions: [linkAction("/creator-studio", "Creator Studio")]
      });
    }
    const organizationId = organization.organizationId;

    const listings = await read(
      `creator_listings?select=id,title,medium,price_cents,currency,licence,state,rights_attested,consent_attested,note,version_id&organization_id=eq.${enc(organizationId)}&order=updated_at.desc&limit=200`
    );
    const versions = await read(
      `creator_asset_versions?select=id,version_number,source&organization_id=eq.${enc(organizationId)}&order=created_at.desc&limit=100`
    );

    const sections = [];
    if (!listings.ok) {
      sections.push(brandCard(
        "We could not read your listings just now",
        "Nothing has been changed or removed. This is a problem on our side — try again shortly."
      ));
    } else if (!listings.rows.length) {
      sections.push(brandCard(
        "Nothing listed yet",
        "A listing points at one version of a piece of work, so a buyer gets the thing they heard rather than whatever it becomes next."
      ));
    } else {
      for (const listing of listings.rows) {
        const readiness = await readinessFor(organizationId, listing);
        const onSale = listing.state === "listed";
        const status = onSale && !readiness.ok
          // The case the catalogue snapshot cannot see by itself. Said plainly,
          // with the reason, and with the button to act on it -- nothing is taken
          // down by a page load.
          ? `<p><strong>On sale, and no longer cleared.</strong> ${escapeHtml(market.listingSentence(readiness))} Take it off sale until that is answered.</p>`
          : `<p><strong>${escapeHtml(onSale ? "On sale" : String(listing.state || "draft"))}</strong> — ${escapeHtml(market.listingSentence(readiness))}</p>`;
        const licence = market.LICENCES.map((entry) =>
          `<option value="${entry.key}"${listing.licence === entry.key ? " selected" : ""}>${escapeHtml(entry.label)}</option>`).join("");
        const attest = (name, value, label) => `<label><select name="${name}">`
          + `<option value="unanswered"${value === null || value === undefined ? " selected" : ""}>Not answered yet</option>`
          + `<option value="yes"${value === true ? " selected" : ""}>Yes</option>`
          + `<option value="no"${value === false ? " selected" : ""}>No</option>`
          + `</select> ${escapeHtml(label)}</label>`;
        sections.push(
          `<section class="card"><h2>${escapeHtml(listing.title || "Untitled")}</h2>${status}`
          + `<form method="post" action="${OWNER_PAGE}/${escapeHtml(listing.id)}">`
          + `<label>Title<input name="title" value="${escapeHtml(listing.title || "")}" maxlength="${TITLE_MAX}" required></label>`
          + `<label>Price in pence or cents<input name="priceCents" type="number" min="0" step="1" value="${listing.price_cents === null || listing.price_cents === undefined ? "" : escapeHtml(String(listing.price_cents))}" placeholder="Leave empty if you have not decided"></label>`
          + `<label>Currency<input name="currency" value="${escapeHtml(currencyOf(listing))}" maxlength="3"></label>`
          + `<label>What the buyer may do<select name="licence"><option value="">Not chosen</option>${licence}</select></label>`
          + attest("rightsAttested", listing.rights_attested, "I hold the rights to sell this")
          + attest("consentAttested", listing.consent_attested, "Everyone whose voice, face or likeness is in it has agreed to it being sold")
          + `<label>Note to yourself<textarea name="note" maxlength="${NOTE_MAX}" rows="2">${escapeHtml(listing.note || "")}</textarea></label>`
          + `<button type="submit">Save</button></form>`
          + (readiness.ok && !onSale
            ? `<form method="post" action="${OWNER_PAGE}/${escapeHtml(listing.id)}/list"><button type="submit">Put it on sale</button></form>`
            : "")
          + (onSale
            ? `<form method="post" action="${OWNER_PAGE}/${escapeHtml(listing.id)}/withdraw"><button type="submit">Take it off sale</button></form>`
            : "")
          + `</section>`
        );
      }
    }

    if (!versions.ok) {
      // Not "nothing to sell". The versions could not be read, which says nothing
      // about whether there are any.
      sections.push(brandCard(
        "We could not read your versions just now",
        "The form to list one is not shown until they can be read. Nothing has been changed."
      ));
    } else if (!versions.rows.length) {
      sections.push(brandCard(
        "No versions to list yet",
        "A listing needs a version of a piece of work. Add one on the approval graph first, and get it approved."
      ));
    } else {
      const options = versions.rows
        .map((version) => `<option value="${escapeHtml(version.id)}">v${escapeHtml(String(version.version_number))} — ${escapeHtml(version.source)}</option>`)
        .join("");
      sections.push(
        `<form class="card" method="post" action="${OWNER_PAGE}">`
        + `<h2>Sell a version of something</h2>`
        + `<label>Which version<select name="versionId" required>${options}</select></label>`
        + `<label>Title<input name="title" maxlength="${TITLE_MAX}" required placeholder="What a buyer will see"></label>`
        + `<label>What kind of work<input name="medium" maxlength="60" placeholder="audio, video, picture, art"></label>`
        + `<p class="fine">It starts as a draft. Nothing is on sale until you say so, and it cannot go on sale until it is approved and its rights are recorded.</p>`
        + `<button type="submit">Create listing</button></form>`
      );
    }

    return page(res, {
      title: "Marketplace",
      eyebrow: "Creator Studio",
      heading: "Your marketplace",
      body: "What you are selling, and what each one still needs. Selling is never easier than publishing — anything that cannot be published cannot be sold, and each listing says why.",
      sections,
      actions: [
        linkAction("/creator-studio/owner/approval-graph", "Approvals"),
        linkAction(PUBLIC_PAGE, "The public marketplace"),
        linkAction("/creator-studio", "Creator Studio")
      ]
    });
  });

  app.post(OWNER_PAGE, requireWorkspaceAccess("creator_studio"), async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization.ok) return refuse(res, "We could not tell which workspace to add this to, so nothing was created.");
    const versionId = String(req.body?.versionId || "");
    if (!UUID.test(versionId)) return refuse(res, "Choose a version to sell.");

    const found = await versionFor(organization.organizationId, versionId);
    if (!found.ok) return refuse(res, "We could not read that version just now, so nothing was created.", 503);
    if (!found.version) return refuse(res, "That version is not one of this workspace's.");

    const title = String(req.body?.title || "").trim().slice(0, TITLE_MAX);
    if (!title) return refuse(res, "Give the listing a title a buyer would recognise.");

    const created = await write("creator_listings", {
      body: {
        organization_id: organization.organizationId,
        version_id: versionId,
        title,
        medium: String(req.body?.medium || "").trim().slice(0, 60) || null,
        // A draft with no price, no licence and no attestations. Everything a sale
        // needs is absent until somebody answers it, which is the point.
        state: "draft",
        created_by: req.sonaraUser?.id || null
      }
    });
    if (!created.ok) return refuse(res, "The listing was not created and nothing has changed.", 503);
    return res.status(303).set("location", OWNER_PAGE).end();
  });

  app.post(`${OWNER_PAGE}/:id`, requireWorkspaceAccess("creator_studio"), async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization.ok) return refuse(res, "We could not tell which workspace this belongs to, so nothing was saved.");
    const organizationId = organization.organizationId;
    const id = String(req.params.id || "");
    if (!UUID.test(id)) return refuse(res, "That listing reference is not one of ours.");

    const title = String(req.body?.title || "").trim().slice(0, TITLE_MAX);
    if (!title) return refuse(res, "A listing needs a title.");

    // An empty price box means "I have not decided", stored as null rather than as
    // zero. Writing 0 here is the defect the migration's assertions exist to
    // prevent, arriving through a form instead.
    const rawPrice = String(req.body?.priceCents ?? "").trim();
    let priceCents = null;
    if (rawPrice !== "") {
      const parsed = Number(rawPrice);
      if (!Number.isInteger(parsed) || parsed < 0) return refuse(res, "A price has to be a whole number of pence or cents, or empty if you have not decided.");
      priceCents = parsed;
    }
    const licence = String(req.body?.licence || "");
    if (licence && !market.LICENCE_KEYS.includes(licence)) return refuse(res, "Choose one of the licences offered.");

    const attestation = (value) => {
      const text = String(value || "unanswered");
      if (text === "yes") return true;
      if (text === "no") return false;
      // Anything else, including a missing field, is unanswered. Three states.
      return null;
    };

    const changes = {
      title,
      price_cents: priceCents,
      currency: String(req.body?.currency || "usd").trim().toLowerCase().slice(0, 3) || null,
      licence: licence || null,
      rights_attested: attestation(req.body?.rightsAttested),
      consent_attested: attestation(req.body?.consentAttested),
      note: String(req.body?.note || "").trim().slice(0, NOTE_MAX) || null,
      updated_at: new Date().toISOString()
    };
    const saved = await write(`creator_listings?id=eq.${enc(id)}&organization_id=eq.${enc(organizationId)}`, { method: "PATCH", body: changes });
    if (!saved.ok) return refuse(res, "Nothing was saved and the listing is unchanged.", 503);

    // Something already on sale has just changed, so the public snapshot is now
    // either stale or wrong. Read back what was saved and ask the gate again.
    const after = await ownListing(organizationId, id);
    const listing = after.ok ? after.rows[0] : null;
    if (listing && listing.state === "listed") {
      const readiness = await readinessFor(organizationId, listing);
      if (readiness.ok) {
        // Still cleared: the snapshot must show the new price and title, not the
        // ones a buyer saw yesterday.
        const entry = market.marketplaceEntry({ listing, readiness });
        const refreshed = await publishEntry(entry);
        if (!refreshed.ok) {
          return refuse(res, "Your changes were saved, and the public listing could not be updated to match. Take it off sale and put it back on to refresh it.", 503);
        }
      } else {
        const removed = await removeEntry(id);
        await write(`creator_listings?id=eq.${enc(id)}&organization_id=eq.${enc(organizationId)}`, {
          method: "PATCH",
          body: { state: "draft", updated_at: new Date().toISOString() }
        });
        return res.status(removed.ok ? 200 : 503).type("html").send(responsePage(
          removed.ok ? "Saved, and taken off sale" : "Saved, and it could not be taken off sale",
          removed.ok
            ? `It is no longer cleared to sell, so it is no longer on sale. ${market.listingSentence(readiness)}`
            : "It is no longer cleared to sell and the public listing could not be removed. Press Take it off sale on your marketplace page.",
          [linkAction(OWNER_PAGE, "Back to your marketplace")]
        ));
      }
    }
    return res.status(303).set("location", OWNER_PAGE).end();
  });

  app.post(`${OWNER_PAGE}/:id/list`, requireWorkspaceAccess("creator_studio"), async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization.ok) return refuse(res, "We could not tell which workspace this belongs to, so nothing was listed.");
    const organizationId = organization.organizationId;
    const id = String(req.params.id || "");
    if (!UUID.test(id)) return refuse(res, "That listing reference is not one of ours.");

    const found = await ownListing(organizationId, id);
    if (!found.ok) return refuse(res, "We could not read that listing just now, so nothing was put on sale.", 503);
    const listing = found.rows[0];
    if (!listing) return refuse(res, "That listing is not one of this workspace's.");

    // Asked again, here, at the moment of the decision. The button was drawn from a
    // readiness computed when the page rendered, and an approval may have been
    // withdrawn since. A page that asks the gate and then acts regardless is a gate
    // that was never there.
    const readiness = await readinessFor(organizationId, listing);
    if (!readiness.ok) {
      return refuse(res, `This is not ready to sell, so nothing was listed. ${market.listingSentence(readiness)}`);
    }

    // State first, catalogue second. If the catalogue write fails, the state is
    // put back, so the failure leaves it off sale -- the other order could leave a
    // public entry for something the creator's page says is a draft.
    const listed = await write(`creator_listings?id=eq.${enc(id)}&organization_id=eq.${enc(organizationId)}`, {
      method: "PATCH",
      body: { state: "listed", updated_at: new Date().toISOString() }
    });
    if (!listed.ok) return refuse(res, "It was not put on sale and nothing has changed.", 503);
    const published = await publishEntry(market.marketplaceEntry({ listing: { ...listing, state: "listed" }, readiness }));
    if (!published.ok) {
      await write(`creator_listings?id=eq.${enc(id)}&organization_id=eq.${enc(organizationId)}`, {
        method: "PATCH",
        body: { state: "draft", updated_at: new Date().toISOString() }
      });
      return refuse(res, "It was not put on sale -- the public marketplace could not be updated, so it is still a draft.", 503);
    }
    return res.status(303).set("location", OWNER_PAGE).end();
  });

  app.post(`${OWNER_PAGE}/:id/withdraw`, requireWorkspaceAccess("creator_studio"), async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization.ok) return refuse(res, "We could not tell which workspace this belongs to, so nothing was withdrawn.");
    const organizationId = organization.organizationId;
    const id = String(req.params.id || "");
    if (!UUID.test(id)) return refuse(res, "That listing reference is not one of ours.");

    // Confirm it is this workspace's before touching the catalogue, which has no
    // organization to filter on -- the ownership check has to happen here.
    const found = await ownListing(organizationId, id);
    if (!found.ok) return refuse(res, "We could not read that listing just now. It is still on sale.", 503);
    if (!found.rows[0]) return refuse(res, "That listing is not one of this workspace's.");

    // Catalogue first: stopping the sale is the part that matters, and if the
    // state write then fails the listing is off sale and mislabelled, not on sale.
    const removed = await removeEntry(id);
    if (!removed.ok) return refuse(res, "It is still on sale -- the public listing could not be removed. Nothing has changed.", 503);
    await write(`creator_listings?id=eq.${enc(id)}&organization_id=eq.${enc(organizationId)}`, {
      method: "PATCH",
      body: { state: "withdrawn", updated_at: new Date().toISOString() }
    });
    return res.status(303).set("location", OWNER_PAGE).end();
  });

  // -------------------------------------------------------------------------
  // What anybody can see. Only the catalogue is read here.
  // -------------------------------------------------------------------------

  app.get(PUBLIC_PAGE, async (req, res) => {
    const entries = await read(
      "creator_marketplace_entries?select=listing_id,title,medium,price_cents,currency,licence,made_by_machine,ai_disclosed,listed_at&order=listed_at.desc&limit=100"
    );
    const sections = [];
    if (!entries.ok) {
      sections.push(brandCard(
        "We could not read the marketplace just now",
        "This is a problem on our side rather than an empty marketplace. Nothing has been removed."
      ));
    } else if (!entries.rows.length) {
      sections.push(brandCard("Nothing on sale yet", "Creators list work here once it is approved and its rights are recorded."));
    } else {
      for (const entry of entries.rows) {
        // An entry with no usable id cannot be linked, so it is not shown. The
        // first version rendered `/marketplace/undefined` for one, which
        // tests/every-row-control-reaches-a-handler.test.js followed and found
        // dead: a card a buyer can see and click that leads nowhere.
        if (!UUID.test(String(entry.listing_id || ""))) continue;
        const licence = market.LICENCES.find((candidate) => candidate.key === entry.licence);
        sections.push(
          `<section class="card"><h2>${escapeHtml(entry.title)}</h2>`
          + (entry.medium ? `<p>${escapeHtml(entry.medium)}</p>` : "")
          + `<p><strong>${escapeHtml(money(entry.price_cents, entry.currency))}</strong></p>`
          + (licence ? `<p>${escapeHtml(licence.label)} — ${escapeHtml(licence.means)}</p>` : "")
          + madeSentence(entry)
          + `<div class="card-actions"><a class="action" href="${PUBLIC_PAGE}/${escapeHtml(entry.listing_id)}">See this listing</a></div>`
          + `</section>`
        );
      }
    }
    return page(res, {
      title: "Marketplace",
      eyebrow: "Creator Studio",
      heading: "Work for sale, by the people who made it",
      body: "Every listing says what you may do with it and whether a machine made it. Nothing is listed until its creator has recorded that they hold the rights.",
      surface: "marketing",
      sections,
      actions: [linkAction("/creator-studio", "Creator Studio"), linkAction("/signup", "Create a free account")]
    });
  });

  app.get(`${PUBLIC_PAGE}/:id`, async (req, res) => {
    const id = String(req.params.id || "");
    if (!UUID.test(id)) {
      return res.status(404).type("html").send(responsePage("No such listing", "That listing reference is not one of ours.", [linkAction(PUBLIC_PAGE, "The marketplace")]));
    }
    const found = await read(
      `creator_marketplace_entries?select=listing_id,title,medium,price_cents,currency,licence,made_by_machine,ai_disclosed,listed_at&listing_id=eq.${enc(id)}&limit=1`
    );
    if (!found.ok) {
      return res.status(503).type("html").send(responsePage(
        "We could not read that listing",
        "This is a problem on our side. It has not been removed — try again shortly.",
        [linkAction(PUBLIC_PAGE, "The marketplace")]
      ));
    }
    const entry = found.rows[0];
    if (!entry) {
      return res.status(404).type("html").send(responsePage(
        "That is not on sale",
        "It may have been taken off sale, or it may never have been listed.",
        [linkAction(PUBLIC_PAGE, "The marketplace")]
      ));
    }
    const licence = market.LICENCES.find((candidate) => candidate.key === entry.licence);
    return page(res, {
      title: entry.title,
      eyebrow: "Creator Studio marketplace",
      heading: entry.title,
      body: `${money(entry.price_cents, entry.currency)}${licence ? ` — ${licence.label}` : ""}`,
      surface: "marketing",
      sections: [
        licence ? brandCard("What you may do with it", licence.means) : brandCard("Licence", "This listing does not say what you may do with it."),
        brandCard("How it was made", madeText(entry)),
        brandCard(
          "Buying it",
          "Checkout is not connected yet, so nobody can pay for this through SONARA. The listing, its price and its licence are real; the payment step is not built."
        )
      ],
      actions: [linkAction(PUBLIC_PAGE, "Back to the marketplace"), linkAction("/signup", "Create a free account")]
    });
  });

  function madeText(entry) {
    if (!entry.made_by_machine) return "The creator uploaded this rather than generating it.";
    if (entry.ai_disclosed === true) return "The creator has disclosed this as made or altered by a machine.";
    return "A machine was involved in making this.";
  }

  function madeSentence(entry) {
    return entry.made_by_machine ? `<p>${escapeHtml(madeText(entry))}</p>` : "";
  }

  function money(cents, currency) {
    if (cents === null || cents === undefined) return "Not priced";
    const symbol = { usd: "$", gbp: "£", eur: "€" }[String(currency || "").toLowerCase()] || "";
    return `${symbol}${(cents / 100).toFixed(2)}${symbol ? "" : ` ${String(currency || "").toUpperCase()}`}`;
  }
}

module.exports = registerCreatorMarketplaceRoutes;
module.exports.takeVersionOffSale = takeVersionOffSale;
