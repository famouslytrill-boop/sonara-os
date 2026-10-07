// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What may be sold, at what price, and for how much in total.
//
// Every figure a buyer sees or agrees to is computed here, from rows the server
// read. The routes read, write and render; they do not price anything.
//
// ## The invariant this file exists for: an unreadable price is not free
//
// `merchant_product_variants.price_cents` is `not null default 0`, so zero is
// indistinguishable between "this is free" and "nobody has set a price yet".
// CLAUDE.md records the version of this that already shipped in this codebase:
// `Number(null)` is `0` and finite, which made unpriced services read as free
// across twenty-three columns.
//
// A shop that offers a zero-priced variant gives stock away on the strength of a
// half-filled form. So `offerFor` refuses a variant at zero and says why, and
// `storefrontFor` reports those separately to the owner as needing a price rather
// than dropping them silently -- a shop that hides what it cannot sell is a shop
// whose owner never finds out.
//
// There is no `is_free` flag. Giving something away is a decision somebody should
// make out loud, and inventing a column for it would be inventing the decision.
//
// ## The second invariant: a total is never taken from the request
//
// `priceOrder` takes the variants it was handed by a server read and the quantities
// from the form, and nothing else. A posted price is a buyer naming their own, and
// it is the oldest bug in online selling. The quantity comes from the request --
// that is the one thing a buyer is allowed to choose -- and it is bounded.
//
// ## The third: two currencies do not add up
//
// A shop declares one currency. A variant in another is not priced into the same
// total, because there is no exchange rate here and inventing one would make a
// figure wrong by a factor rather than by a rounding.
//
// ## What is not here
//
// No card, no charge, no token. Taking payment runs through the organization's own
// connected account. Nothing in this file sends anything either.

// Integer cents throughout. No float goes near a total: 0.1 + 0.2 is the reason
// money is counted in the smallest unit, and business_service_catalog,
// customer_invoice_lines and merchant_product_variants all already do.
const QUANTITY_MAX = 999;
const LINES_MAX = 50;
const NAME_MAX = 200;
const NOTE_MAX = 2000;
const ORDER_STATUSES = Object.freeze(["placed", "confirmed", "fulfilled", "cancelled"]);
const SELLABLE_PRODUCT_STATUSES = Object.freeze(["active"]);
const SELLABLE_VARIANT_STATUSES = Object.freeze(["active"]);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;
// A variant id is a uuid from `gen_random_uuid()`. Fixed-length groups with no
// nesting, so there is nothing here to backtrack over either.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The email shape, from lib/sonara-email-shape.cjs rather than a regular
// expression here. The one that was here could be made to run slowly on a long
// run of dots -- CodeQL raised it as high severity on this very file -- and it
// runs on whatever a stranger types into a public form.
const { looksLikeEmail } = require("./sonara-email-shape.cjs");

// Why a variant is not on sale. Named rather than filtered out, so the owner's page
// can say which and the public page can simply not show it.
const NOT_OFFERED = Object.freeze({
  product_not_active: "product_not_active",
  variant_not_active: "variant_not_active",
  price_not_set: "price_not_set",
  price_unreadable: "price_unreadable",
  currency_mismatch: "currency_mismatch",
  sold_out: "sold_out",
  stock_unreadable: "stock_unreadable"
});

function integerCents(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  // Integer and finite. `Number(null)` is 0 and finite, which is exactly why the
  // null check above comes first rather than relying on this.
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function money(cents, currency) {
  return `${(cents / 100).toFixed(2)} ${String(currency || "usd").toUpperCase()}`;
}

/**
 * Is this variant on sale, and at what?
 *
 * `{ ok, priceCents, reason, code }`. `ok` false is never a thrown-away row: the
 * code says which of the five reasons applies, and the owner's page prints it.
 *
 * Zero is refused. That is the whole point of this function, and the comment is
 * here rather than only in the header because this is the line somebody will one
 * day be tempted to relax: a variant at zero is a variant nobody has priced, and
 * selling it is giving stock away. If free items are ever wanted, they need a
 * column saying so and an owner who set it.
 */
function offerFor(product, variant, storefrontCurrency) {
  if (!SELLABLE_PRODUCT_STATUSES.includes(String(product?.status || ""))) {
    return Object.freeze({
      ok: false,
      code: NOT_OFFERED.product_not_active,
      priceCents: null,
      reason: `${product?.name || "This product"} is ${product?.status || "not readable"}, so none of its variants are on sale.`
    });
  }
  if (!SELLABLE_VARIANT_STATUSES.includes(String(variant?.status || ""))) {
    return Object.freeze({
      ok: false,
      code: NOT_OFFERED.variant_not_active,
      priceCents: null,
      reason: `${variant?.variant_name || "This option"} is ${variant?.status || "not readable"}.`
    });
  }

  const priceCents = integerCents(variant?.price_cents);
  if (priceCents === null) {
    return Object.freeze({
      ok: false,
      code: NOT_OFFERED.price_unreadable,
      priceCents: null,
      reason: `We could not read a price for ${variant?.variant_name || "this option"}, so it is not being offered. It has not been priced at zero -- it has not been read.`
    });
  }
  if (priceCents === 0) {
    return Object.freeze({
      ok: false,
      code: NOT_OFFERED.price_not_set,
      priceCents: 0,
      reason: `${variant?.variant_name || "This option"} has no price set, so it is not on sale. A price of zero here means nobody has filled it in rather than that it is free.`
    });
  }

  const variantCurrency = String(variant?.currency || "usd").toLowerCase();
  const shopCurrency = String(storefrontCurrency || "usd").toLowerCase();
  if (variantCurrency !== shopCurrency) {
    return Object.freeze({
      ok: false,
      code: NOT_OFFERED.currency_mismatch,
      priceCents,
      reason: `${variant?.variant_name || "This option"} is priced in ${variantCurrency.toUpperCase()} and this shop sells in ${shopCurrency.toUpperCase()}. We are not converting it, because there is no exchange rate here to convert it with.`
    });
  }

  return Object.freeze({
    ok: true,
    code: null,
    priceCents,
    currency: shopCurrency,
    reason: `${money(priceCents, shopCurrency)}.`
  });
}

/**
 * The shop, split into what is on sale and what is not.
 *
 * `{ ok, offered, withheld, reason }`. `offered` is what a visitor sees; `withheld`
 * carries a reason each and is for the owner, because a shop that silently hides
 * what it cannot sell is a shop whose owner never finds out why it is empty.
 *
 * A read that failed is reported, never rendered as an empty shop. "You have
 * nothing for sale" is a sentence, and it is the wrong one to say on the strength
 * of a request that did not happen.
 */
// `stock` is lib/sonara-inventory-stock.cjs availabilityFor's Map, for variants
// linked to an inventory item. Three cases, kept apart on purpose:
//   undefined  stock was not considered (a caller that does not track it)
//   null       stock was asked for and could not be read -- a linked variant is
//              withheld, because offering it would be offering something we
//              cannot say is there
//   a Map      a linked variant with nothing available is withheld as sold out
// Unlinked variants are never affected. And none of this is the final word: the
// stock function holds an order or refuses it at the moment it is placed.
function storefrontFor({ storefront, products, variants, stock } = {}) {
  if (!Array.isArray(products) || !Array.isArray(variants)) {
    return Object.freeze({
      ok: false,
      offered: Object.freeze([]),
      withheld: Object.freeze([]),
      reason: "We could not read what this shop sells. That is a problem on our side, and it does not mean the shop is empty."
    });
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const offered = [];
  const withheld = [];

  for (const variant of variants) {
    const product = productById.get(variant.product_id);
    if (!product) {
      // A variant whose product did not come back. Withheld with a reason rather
      // than priced against a product nobody read.
      withheld.push(Object.freeze({
        variant,
        product: null,
        code: NOT_OFFERED.product_not_active,
        reason: "The product this option belongs to could not be read, so it is not being offered."
      }));
      continue;
    }
    const offer = offerFor(product, variant, storefront?.currency);
    if (!offer.ok) {
      withheld.push(Object.freeze({ variant, product, code: offer.code, reason: offer.reason }));
      continue;
    }
    let available = null;
    if (variant.inventory_item_id && stock !== undefined) {
      const level = stock === null ? null : stock.get(variant.inventory_item_id);
      const label = `${product.name || "This product"}${variant.variant_name ? ` — ${variant.variant_name}` : ""}`;
      if (!level) {
        withheld.push(Object.freeze({
          variant, product, code: NOT_OFFERED.stock_unreadable,
          reason: `${label} is linked to a stock item we could not read, so it is not being offered rather than offered without knowing it is there.`
        }));
        continue;
      }
      if (level.available < 1) {
        withheld.push(Object.freeze({
          variant, product, code: NOT_OFFERED.sold_out,
          reason: `${label} is sold out: ${level.onHand === null ? "no count recorded" : `${level.onHand} on hand`}, ${level.held} held for orders not yet shipped${level.active ? "" : ", and the stock item is not active"}.`
        }));
        continue;
      }
      available = level.available;
    }
    offered.push(Object.freeze({ variant, product, offer, available }));
  }

  return Object.freeze({
    ok: true,
    offered: Object.freeze(offered),
    withheld: Object.freeze(withheld),
    reason: offered.length
      ? `${offered.length} ${offered.length === 1 ? "thing" : "things"} on sale.`
      : "Nothing is on sale here yet."
  });
}

/**
 * Whether this shop is open, and what to say if not.
 *
 * Three states: not published, published but closed, open. The middle one is why
 * `accepts_orders` is separate from `enabled` -- a shop can be readable while
 * closed, and a visitor is owed that sentence rather than a form that fails.
 */
function shopWindow(storefront) {
  if (!storefront) {
    return Object.freeze({ ok: false, open: false, code: "no_storefront", sentence: "There is no shop at this address." });
  }
  if (storefront.enabled !== true) {
    return Object.freeze({ ok: true, open: false, code: "not_published", sentence: "This shop is not open to the public yet." });
  }
  if (storefront.accepts_orders !== true) {
    return Object.freeze({ ok: true, open: false, code: "not_taking_orders", sentence: "This shop is not taking orders at the moment. What is here is still what they sell." });
  }
  return Object.freeze({ ok: true, open: true, code: "open", sentence: "This shop is taking orders." });
}

/**
 * Price an order from the server's own figures.
 *
 * Takes the offered entries the server built and a map of `variantId -> quantity`
 * from the form. **No price comes from the request**, which is the oldest bug in
 * online selling and the reason this function takes `offered` rather than lines.
 *
 * `{ ok, lines, subtotalCents, currency, problems }`. A line whose variant is not
 * in `offered` is refused rather than skipped: quietly dropping it would charge
 * somebody for less than they asked for and call it their order.
 */
function priceOrder({ offered, quantities, currency } = {}) {
  const problems = [];
  if (!Array.isArray(offered)) {
    return { ok: false, problems: Object.freeze(["shop_unreadable"]), lines: Object.freeze([]), subtotalCents: 0 };
  }
  // A Map from quantitiesFrom, or a plain object from a direct caller. An object
  // is read with `Object.keys` and copied into a Map, so an inherited property
  // cannot reach the loop below however it got onto the object.
  const wanted = quantities instanceof Map
    ? quantities
    : new Map(Object.keys(quantities && typeof quantities === "object" ? quantities : {})
      .map((key) => [key, quantities[key]]));
  const byVariantId = new Map(offered.map((entry) => [entry.variant.id, entry]));

  const lines = [];
  let subtotalCents = 0;

  for (const [variantId, rawQuantity] of wanted) {
    const quantity = integerCents(rawQuantity);
    if (quantity === null || quantity < 1 || quantity > QUANTITY_MAX) {
      problems.push("quantity_unusable");
      continue;
    }
    const entry = byVariantId.get(variantId);
    if (!entry) {
      // Not on sale, or not from this shop. Refused rather than dropped: an order
      // that quietly contains less than was asked for is not that person's order.
      problems.push("not_on_sale");
      continue;
    }
    // Asking for more than the shop shows as available. A courtesy check against
    // figures read a moment ago; the stock function decides at the moment of the
    // order, and refuses there too if the shelf changed in between.
    if (Number.isInteger(entry.available) && quantity > entry.available) {
      problems.push("more_than_available");
      continue;
    }
    const unitPriceCents = entry.offer.priceCents;
    const lineTotalCents = unitPriceCents * quantity;
    lines.push(Object.freeze({
      variantId,
      // Copied, not joined. A variant renamed next month does not rewrite what
      // somebody ordered.
      description: `${entry.product.name}${entry.variant.variant_name ? ` — ${entry.variant.variant_name}` : ""}`.slice(0, 300),
      quantity,
      unitPriceCents,
      lineTotalCents,
      currency: entry.offer.currency
    }));
    subtotalCents += lineTotalCents;
  }

  if (!lines.length && !problems.length) problems.push("nothing_ordered");
  if (lines.length > LINES_MAX) problems.push("too_many_lines");
  if (problems.length) {
    return { ok: false, problems: Object.freeze([...new Set(problems)]), lines: Object.freeze([]), subtotalCents: 0 };
  }

  return {
    ok: true,
    problems: Object.freeze([]),
    lines: Object.freeze(lines),
    subtotalCents,
    currency: String(currency || lines[0].currency || "usd").toLowerCase(),
    // Said back to the buyer, from the figures above rather than from the form.
    reason: `${lines.length} ${lines.length === 1 ? "line" : "lines"}, ${money(subtotalCents, currency || lines[0].currency)}.`
  };
}

/**
 * Read a buyer out of a public form.
 *
 * Codes, never sentences, because these round-trip through a page and a sentence
 * supplied by a request is text a crafted link can put in this product's voice.
 */
function normalizeBuyer(input = {}) {
  const problems = [];
  const buyerName = String(input.buyer_name ?? input.buyerName ?? "").trim();
  if (!buyerName) problems.push("name_missing");
  else if (buyerName.length > NAME_MAX) problems.push("name_long");

  const buyerEmail = String(input.buyer_email ?? input.buyerEmail ?? "").trim().toLowerCase();
  if (!buyerEmail) problems.push("email_missing");
  else if (!looksLikeEmail(buyerEmail)) problems.push("email_shape");

  const note = String(input.note ?? "").trim();
  if (note.length > NOTE_MAX) problems.push("note_long");

  if (problems.length) return { ok: false, problems: Object.freeze(problems) };
  return { ok: true, buyer: Object.freeze({ buyerName, buyerEmail, note: note || null }) };
}

/**
 * The quantities a form asked for, read from `qty_<variantId>` fields.
 *
 * Zero and blank mean "not ordering this", which is the common case on a shop page
 * where every line has a box. They are dropped rather than recorded as problems --
 * refusing a form because somebody left most of it blank would make a shop with
 * twelve items unusable.
 */
function quantitiesFrom(body = {}) {
  // A Map, not an object, and the key has to look like a uuid.
  //
  // This built `quantities[variantId] = text` on a plain object until 2 October
  // 2026, where `variantId` came straight out of a form field name. CodeQL raised
  // it as "Remote property injection", and it is not theoretical -- measured on
  // the spot:
  //
  //   q["__proto__"] = "1"   -> creates NO own property. The quantity silently
  //                             vanishes, so a buyer's line disappears from an
  //                             order they will be told was placed.
  //   q["constructor"] = "x" -> overwrites a real property with a string.
  //
  // A Map has no prototype keys to collide with, so neither can happen. The uuid
  // check is the second half and is the correctness half: a field called
  // `qty___proto__` is not a variant, and neither is `qty_banana`. Rejecting it
  // here means `priceOrder` never has to ask.
  const quantities = new Map();
  for (const key of Object.keys(body || {})) {
    if (!key.startsWith("qty_")) continue;
    const variantId = key.slice(4);
    if (!UUID_PATTERN.test(variantId)) continue;
    const text = String(body[key] ?? "").trim();
    // Zero and blank mean "not ordering this", which is the common case on a page
    // with a box against every line.
    if (!text || text === "0") continue;
    quantities.set(variantId, text);
  }
  return quantities;
}

function problemSentence(code) {
  return Object.freeze({
    name_missing: "We need a name for the order.",
    name_long: `A name has to be ${NAME_MAX} characters or fewer.`,
    email_missing: "We need an email address so the shop can reach you.",
    email_shape: "That does not look like an email address.",
    note_long: `A note has to be ${NOTE_MAX} characters or fewer.`,
    nothing_ordered: "Nothing was ordered. Put a number against at least one thing.",
    quantity_unusable: `A quantity has to be a whole number between 1 and ${QUANTITY_MAX}.`,
    not_on_sale: "Something in that order is not on sale here, so none of it has been placed. Nothing has been charged and nothing has been recorded.",
    too_many_lines: `An order can have up to ${LINES_MAX} different things in it.`,
    more_than_available: "You asked for more than the shop has left of something. Nothing has been ordered or charged -- the shop page says how many are available.",
    stock_unavailable: "We could not check the shop's stock just now, so your order was not placed. Nothing has been charged -- try again shortly.",
    shop_unreadable: "We could not read what this shop sells, so we have not taken an order. Nothing has changed.",
    slug_shape: "A web address can use lowercase letters, numbers and hyphens, and has to be 3 to 48 characters.",
    slug_taken: "Another shop already uses that web address.",
    order_missing: "That order could not be found in this workspace.",
    status_unknown: "That is not a state an order can be in.",
    status_transition_invalid: "Confirm an order before fulfilling it. Fulfilled and cancelled orders cannot be reopened here.",
    payment_not_ready: "This online order needs a verified full payment with no refund or dispute before fulfillment.",
    order_lines_missing: "This order has no saved items, so it cannot be fulfilled.",
    inventory_snapshot_missing: "This order predates stock snapshots or has inconsistent items. Review it before fulfillment; no stock has changed.",
    inventory_unavailable: "A linked stock item is unavailable in this workspace. No stock or order status has changed.",
    stock_insufficient: "There is not enough linked stock to fulfill the whole order. No stock or order status has changed.",
    save_failed: "That did not save. Nothing has changed, and it is worth trying again."
  })[code] || null;
}

module.exports = {
  UUID_PATTERN,
  QUANTITY_MAX,
  LINES_MAX,
  NAME_MAX,
  NOTE_MAX,
  ORDER_STATUSES,
  NOT_OFFERED,
  SLUG_PATTERN,
  money,
  offerFor,
  storefrontFor,
  shopWindow,
  priceOrder,
  normalizeBuyer,
  quantitiesFrom,
  problemSentence
};
