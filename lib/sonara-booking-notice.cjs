"use strict";

// Telling a business somebody just asked for an appointment.
//
// `/book/:slug` is the one place in this application where a **stranger**
// writes a row. Everything else needs a session. That makes it the event most
// worth a notification and the one with the fewest ways to find out: nobody is
// watching an owner page at the moment a booking arrives, and the row sits at
// status `requested` until a person looks.
//
// ## Why this is simpler than the invoice notice
//
// `lib/sonara-invoice-paid-notice.cjs` has to compute a settlement twice,
// because "the invoice is paid" is a state that stays true and would re-announce
// itself. A booking request is not a state -- **the insert is the event.** It
// happens once, it cannot happen again for the same row, and there is nothing
// to compare against. So there is no before-and-after here, and adding one
// would be ceremony rather than care.
//
// ## What goes on a lock screen, and what does not
//
// The customer's name and the service, because without them the notification
// says only that something happened. **Not their email or phone number.** A
// push payload is decrypted by the browser and rendered by the operating
// system: it lands in a notification history, on a lock screen a stranger can
// read over a shoulder, and in whatever the OS syncs. Contact details belong on
// the booking page behind a session, which is one tap away and is where
// somebody would act on them anyway.
//
// The times are shown as the business's own booking page shows them -- UTC,
// stated -- rather than guessed at from a timezone this module does not know.

const store = require("./sonara-push-subscriptions.cjs");

const TOPIC = "booking_made";

/**
 * When a booking starts, as a person reads it.
 *
 * Returns null rather than a guess when the value is unreadable. A notification
 * that says "starting Invalid Date" is worse than one that does not mention the
 * time at all, and the row is one tap away either way.
 */
function when(value) {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

/**
 * The push payload for one booking request.
 *
 * Exported separately from the sending so the wording can be checked without a
 * database, a push service, or a browser.
 */
function bookingPayload({ customerName, serviceName, startsAt, bookingId } = {}) {
  const who = String(customerName || "").trim() || "Somebody";
  const what = String(serviceName || "").trim();
  const at = when(startsAt);

  const body = [
    what ? `${who} asked for ${what}` : `${who} asked for an appointment`,
    at ? ` on ${at}` : "",
    ". Not confirmed until you accept it."
  ].join("");

  return {
    title: "New booking request",
    body: body.slice(0, 240),
    path: "/business-builder/owner/bookings",
    // One tag per booking rather than a shared one: two requests arriving in
    // the same minute are two facts, and collapsing them would hide the second.
    // The invoice notice tags by invoice for the opposite reason -- there, a
    // repeat is the same fact twice.
    tag: bookingId ? `booking-${bookingId}` : `booking-${Date.now()}`
  };
}

/**
 * Send it, and never let the sending break the booking.
 *
 * Returns `{ ok, notified, reason }` and does not throw. This runs after a
 * stranger's booking has already been written; a failure to notify must not
 * turn a saved request into an error page for a customer who did nothing wrong.
 *
 * `deps` is the shape `lib/sonara-push-subscriptions.cjs` wants:
 * `{ getEnv, supabaseUrl, serviceRoleHeaders }`.
 */
async function announceBooking(deps, booking, options = {}) {
  const notifyImpl = options.notify || store.notify;
  const organizationId = booking?.organizationId;
  if (!organizationId) return { ok: false, notified: false, reason: "no_organization" };

  let result;
  try {
    result = await notifyImpl(
      deps,
      { organizationId, topic: TOPIC, payload: bookingPayload(booking) },
      { fetchImpl: options.fetchImpl || fetch }
    );
  } catch {
    // The store is written not to throw. This is the second line of that rule,
    // because the caller is a route serving somebody who is not our customer.
    return { ok: false, notified: false, reason: "send_failed" };
  }
  if (!result?.ok) return { ok: false, notified: false, reason: result?.code || "not_sent" };
  return { ok: true, notified: true, reason: "sent", sent: result.sent, considered: result.considered, removed: result.removed };
}

module.exports = { TOPIC, when, bookingPayload, announceBooking };
