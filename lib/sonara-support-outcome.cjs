// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What to tell somebody who just pressed Send on a support request.
//
// ## The queue that was not there
//
// `saveSupportRequest` had three endings and returned `ok: true` from all of
// them. The third read:
//
//   "Setup required: the account database is not configured, so the request
//    used the safe fallback queue. Reference ID: <uuid>."
//
// There is no fallback queue. Searched for on 17 August 2026: no table, no
// file, no in-memory store, nothing scheduled. The phrase appeared in four
// customer-facing strings and one admin card and described a mechanism that was
// never built.
//
// So on the path where the insert failed *and* the notification email failed,
// nothing happened at all -- and the customer was shown a reference number, the
// word "queue", and `ok: true`. They would reasonably stop chasing it. A
// support request that silently disappears is worse than a form that refuses to
// submit, because the second one gets retried.
//
// A test asserted the fabrication: "POST /support/request uses the safe
// fallback queue with a reference ID when database is missing". It cleared the
// Supabase environment and checked for `ok: true` and a reference ID, so the
// guarantee had a green tick and no implementation.
//
// ## The reference ID is only real in two of the three cases
//
// It is minted before the insert and written into the row as `reference_id`, so
// when the row is stored it genuinely identifies it. When the row is not stored
// but the email provider accepted a send, the reference is in the accepted
// request body. Provider acceptance does not prove inbox delivery, and the
// message below must not make that claim.
//
// When neither happened it identifies nothing anywhere, and handing it over is
// the part that does the damage: it is the artefact that makes somebody believe
// they have a case open. So that case returns no reference at all.

function supportRequestOutcome({ stored, emailed, referenceId }) {
  if (stored) {
    return emailed
      ? {
        ok: true,
        status: "received",
        referenceId,
        heading: "Request received",
        message: `Your request was received. Reference ID: ${referenceId}. The email provider accepted the notification; inbox delivery has not been confirmed.`
      }
      : {
        ok: true,
        status: "email_notification_failed",
        referenceId,
        heading: "Request received",
        // Saved is what matters to the customer; the notification is our
        // problem, and saying so is better than implying theirs is at risk.
        message: `Your request was received. Reference ID: ${referenceId}. Our email notification did not go out, which does not affect your request.`
      };
  }

  if (emailed) {
    return {
      ok: true,
      status: "emailed_not_recorded",
      referenceId,
      heading: "Email accepted, request not recorded",
      message: `The email provider accepted your support message, but inbox delivery has not been confirmed. Reference ID: ${referenceId}. This request is not in your account records, so quote that reference if you follow up.`
    };
  }

  // Nothing stored, nothing sent. The only honest thing left is to say so and
  // give them a way through that does not depend on what just failed.
  return {
    ok: false,
    status: "not_recorded",
    referenceId: null,
    heading: "Your request did not go through",
    message: "Your request did not go through. Nothing was saved and no message was sent, so there is nothing for us to find later. Please try again shortly, and if it keeps failing, email us directly so it does not sit unanswered."
  };
}

module.exports = { supportRequestOutcome };
