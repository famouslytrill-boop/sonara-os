// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Camera, microphone, contacts, location -- and whether anybody ever said yes.
//
// AGENTS.md: "Sounds, voice announcements, haptics, SMS, push, and email alerts
// must be off or explicitly user-controlled by default." This module is the half
// of that sentence a schema can hold: **off by default** has to mean something
// other than "a column that happens to be false".
//
// ## Why a row per decision rather than a column per capability
//
// `public.device_capability_profiles` has existed since migration 015 with
// `supports_audio boolean default false`, `supports_geolocation boolean default
// false`, and four more of the same shape. Nothing reads or writes it from any
// route, so no behaviour depended on it -- which is lucky, because the shape
// cannot express the thing it is about:
//
//   - the person said no  ->  false
//   - we never asked      ->  false
//
// Those are not the same fact and the difference is the whole feature. "We never
// asked" is a prompt to show. "They said no" is a prompt never to show again, and
// showing it again is the behaviour that makes somebody uninstall an application.
//
// So a grant is a **row**, and the row carries `granted` or `denied`. No row means
// nobody has been asked. There is no default value to misread, because there is no
// value -- which is the one encoding of three states that cannot decay into two
// when somebody adds a column with a default.
//
// Note what is *not* here: this records what the person told us, and it is not a
// substitute for the browser's own permission prompt. The browser is the thing
// that actually gates the camera. A `granted` row means "this person asked us to
// use it", which is necessary and not sufficient -- `mayAsk` is the honest name
// for what a granted row licenses, and the only thing any caller gets.

const CAPABILITIES = Object.freeze([
  Object.freeze({
    key: "camera",
    label: "Camera",
    why: "Take a photo of a product, a receipt, or a job you have finished, without leaving the page.",
    browserPermission: "camera"
  }),
  Object.freeze({
    key: "microphone",
    label: "Microphone",
    why: "Record a voice note or a take, and keep it in the workspace it belongs to.",
    browserPermission: "microphone"
  }),
  Object.freeze({
    key: "contacts",
    label: "Contacts",
    why: "Add a customer from your phone's address book instead of typing them in again.",
    // There is no Permissions API name for this: the Contact Picker is invoked
    // and the browser asks each time, with no stored state to query. Recorded as
    // null rather than guessed, because a caller testing this string against
    // navigator.permissions would get a thrown error for a made-up name.
    browserPermission: null
  }),
  Object.freeze({
    key: "location",
    label: "Location",
    why: "Fill in where a job happened, or find the nearest of your venues.",
    browserPermission: "geolocation"
  }),
  Object.freeze({
    key: "motion",
    label: "Motion sensors",
    why: "Save a short motion sample when you explicitly ask for one, for device testing and approved motion-aware workflows.",
    // DeviceMotionEvent.requestPermission() is a transient-activation flow that
    // covers accelerometer/gyroscope access; there is no single Permissions API
    // name equivalent to this SONARA capability.
    browserPermission: null
  }),
  Object.freeze({
    key: "local_compute",
    label: "Use this device's processor",
    why: "Do the work on your own computer or phone -- resizing a picture, working out a total -- instead of sending it to us.",
    browserPermission: null
  }),
  Object.freeze({
    key: "local_storage",
    label: "Keep a copy on this device",
    why: "Let a page you have open keep working when the connection drops, and finish saving when it comes back.",
    browserPermission: null
  })
]);

const CAPABILITY_KEYS = Object.freeze(CAPABILITIES.map((capability) => capability.key));
const CAPABILITY_BY_KEY = new Map(CAPABILITIES.map((capability) => [capability.key, capability]));

const STATE = Object.freeze({
  granted: "granted",
  denied: "denied",
  not_recorded: "not_recorded",
  unreadable: "unreadable"
});

// The two a row may hold. `not_recorded` is the absence of a row and is never
// stored; `unreadable` is a failed read and is never stored either. A migration
// check constrains the column to these two.
const STORED_STATES = Object.freeze(["granted", "denied"]);

/** Is this one of the capabilities this application asks about? */
function isCapability(key) {
  return CAPABILITY_BY_KEY.has(String(key || ""));
}

/**
 * What this person has said about one capability.
 *
 * `{ grants, readable }` in, one of the four STATE values out. `readable: false`
 * gives `unreadable` -- a distinct answer from `not_recorded`, because a page
 * that could not read the grants must not tell somebody they have never been
 * asked, and must not re-ask them on the strength of a request that failed.
 */
function permissionState({ grants, readable = true } = {}, capability) {
  if (readable === false) return STATE.unreadable;
  if (!isCapability(capability)) return STATE.not_recorded;
  const rows = Array.isArray(grants) ? grants : [];
  // Newest decision wins. Ordered here rather than trusted from the query,
  // because a caller that forgot `order=` would otherwise get whichever row the
  // database handed back first and call it the person's current answer.
  let newest = null;
  for (const row of rows) {
    if (String(row?.capability || "") !== capability) continue;
    if (!STORED_STATES.includes(String(row?.state || ""))) continue;
    const at = Date.parse(row?.decided_at || "");
    const stamp = Number.isFinite(at) ? at : -Infinity;
    if (!newest || stamp >= newest.stamp) newest = { stamp, state: String(row.state) };
  }
  if (!newest) return STATE.not_recorded;
  return newest.state === "granted" ? STATE.granted : STATE.denied;
}

/**
 * May this application ask the browser for this capability?
 *
 * Only a `granted` row says yes. `denied` and `not_recorded` and `unreadable` all
 * say no, and they say it for different reasons the caller can act on -- which is
 * why this returns the reason rather than a boolean.
 *
 * "Ask", not "use". A granted row is this person telling us they want the feature;
 * the browser still runs its own prompt and can refuse. Anything claiming a
 * granted row means the camera is available is claiming something this cannot
 * know.
 */
function mayAsk(record, capability) {
  const state = permissionState(record, capability);
  if (state === STATE.granted) return { ok: true, state };
  const because = {
    [STATE.denied]: "You turned this off. Turn it back on here if you want it.",
    [STATE.not_recorded]: "This is off until you turn it on.",
    [STATE.unreadable]: "We could not read your settings just now, so nothing was turned on."
  };
  return { ok: false, state, message: because[state] };
}

/**
 * Every capability with its current state, for the page that lists them.
 *
 * Returns one entry per capability in a fixed order, so a capability nobody has
 * answered about still appears -- a list built from the stored rows would show
 * only the ones already decided, which is a settings page that hides the settings
 * you have not found yet.
 */
function permissionSummary(record = {}) {
  return CAPABILITIES.map((capability) => ({
    ...capability,
    state: permissionState(record, capability.key),
    allowed: permissionState(record, capability.key) === STATE.granted
  }));
}

/**
 * The decision a form is asking to record, or null.
 *
 * A checkbox that is absent from a POST body means unchecked, and this is one of
 * the few places where that reading is correct rather than a guess: the form
 * submits every capability's name in a hidden field, so a capability missing from
 * the body was not on the form at all and is refused instead of being read as a
 * no.
 */
function decisionFrom(body = {}, capability) {
  if (!isCapability(capability)) return null;
  const present = Object.prototype.hasOwnProperty.call(body, `offered_${capability}`);
  if (!present) return null;
  return String(body[`allow_${capability}`] || "") === "true" ? "granted" : "denied";
}

module.exports = {
  CAPABILITIES,
  CAPABILITY_KEYS,
  STATE,
  STORED_STATES,
  isCapability,
  permissionState,
  mayAsk,
  permissionSummary,
  decisionFrom
};
