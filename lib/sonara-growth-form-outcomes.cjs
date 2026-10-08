// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What a person sees after pressing Save on a Growth Studio form.
//
// The nine "Add a ..." forms on the Growth record pages post straight to
// /api/growth/<key>, and those handlers answer in JSON. Nothing turned that
// into a page -- no client script intercepts the forms and no server adapter
// renders the answer -- so a person who saved an enquiry, a campaign or a
// conversion was shown {"ok":true,...} or {"ok":false,"code":"..."} and had to
// press Back to find out whether anything had happened.
//
// For a browser's form post, the answer becomes a redirect back to the page
// the form is on, carrying what happened as one of a fixed set of codes, and
// the page says it in words. A caller that asks for JSON gets exactly what it
// got before.
//
// A failure comes back as `?problem=<code>`, the convention every other form
// here uses and tests/no-save-looks-like-it-worked.test.js holds them to, with
// `&form=create` beside it. The marker is there because the campaigns page
// already reads `?problem=` for a campaign that could not be sent, and without
// it a failed save would be announced there as "Nothing was sent" and a failed
// send as "Not saved". Each card reads only its own.
//
// The page shows only sentences written here. A code it does not know gets the
// general "not saved" sentence and is never echoed: the query string is in an
// address anybody can send, and a page that printed it would let a link put
// any words on a SONARA page.

// Every code the nine create handlers answer with, and the two the workspace
// check in front of them can. tests/a-growth-form-answers-with-a-page.test.js
// reads the handlers' source and fails if one has no sentence here.
const PROBLEMS = Object.freeze({
  lead_identity_required: "Give a name, an email or a phone number, so there is a way to reach them.",
  campaign_name_required: "Give the campaign a name.",
  segment_name_and_definition_required: "Give the segment a name and say who belongs in it.",
  segment_definition_not_allowed: "That description could not be saved as written. Say who belongs in it in plain words.",
  experiment_name_hypothesis_and_two_variants_required: "Say what you are testing and what you expect, and name both versions.",
  variant_weights_must_equal_one: "The versions' shares must add up to the whole.",
  consent_fields_required: "Choose the channel and whether they agreed, and say what it is for and where the permission came from.",
  content_channel_and_type_required: "Say where it goes and what kind of content it is.",
  audience_consent_basis_required: "Confirm that the people this goes to agreed to hear from you on that channel.",
  automation_template_not_allowed: "Choose one of the triggers and one of the actions offered.",
  arbitrary_automation_code_prohibited: "An automation cannot carry code. Use the choices offered.",
  conversion_type_required: "Say what happened, such as a sale or a sign-up.",
  event_name_required: "Say what happened.",
  tracking_basis_attestation_required: "Confirm you are allowed to record this before it can be saved.",
  supabase_setup_required: "Your account database is not connected yet, so nothing could be saved.",
  growth_auth_required: "We could not confirm your workspace. Sign in and try again.",
  organization_resolver_unavailable: "We could not confirm your workspace just now. Try again shortly."
});

// The links a record can carry (REFERENCES in
// routes/growth-studio-control-routes.cjs), named the way the forms name them.
const LINKED = Object.freeze({
  campaign_id: "campaign",
  lead_id: "enquiry",
  touchpoint_id: "touchpoint",
  content_id: "content item",
  provider_connection_id: "connection",
  audience_segment_id: "segment",
  platform_id: "platform"
});

const NOT_SAVED = "That could not be saved just now. Nothing was recorded.";

/** The sentence for a code, or the general one. Never the code itself. */
function problemText(code) {
  const text = String(code ?? "");
  if (Object.prototype.hasOwnProperty.call(PROBLEMS, text)) return PROBLEMS[text];
  const linked = text.match(/^([a-z_]+_id)_(invalid|not_yours|unreadable)$/);
  if (linked && Object.prototype.hasOwnProperty.call(LINKED, linked[1])) {
    const thing = LINKED[linked[1]];
    if (linked[2] === "unreadable") return `We could not check the ${thing} you linked just now. Nothing was saved.`;
    return `The ${thing} you linked is not one of this workspace's, so nothing was saved. Pick one of your own, or leave it empty.`;
  }
  return NOT_SAVED;
}

// A browser posting a form asks for HTML and does not ask for JSON. A script
// that wants JSON says so, and keeps getting it.
function wantsPage(req) {
  const accept = String(req.get?.("accept") || "");
  return accept.includes("text/html") && !accept.includes("application/json");
}

/**
 * Middleware for one create route. When a browser posted the form, the
 * handler's JSON answer becomes a redirect back to the form's page. Goes in
 * front of the access check, so a refusal there reaches the person as a page
 * too.
 */
function answerFormWithPage(pagePath) {
  if (typeof pagePath !== "string" || !pagePath.startsWith("/")) {
    throw new TypeError("answerFormWithPage needs the path of the page the form is on");
  }
  return function answerWithPage(req, res, next) {
    if (!wantsPage(req)) return next();
    res.json = function redirectInstead(payload) {
      const saved = res.statusCode < 400 && payload?.ok !== false;
      const query = saved ? "saved=1" : `problem=${encodeURIComponent(String(payload?.code || "not_saved"))}&form=create`;
      return res.redirect(303, `${pagePath}?${query}`);
    };
    return next();
  };
}

/** The notice at the top of a record page after its form was posted, or "". */
function outcomeCard(query = {}, noun, escape) {
  if (String(query.saved ?? "") === "1") {
    return `<article class="card" role="status"><h2>Saved</h2><p>${escape(`The ${noun || "record"} is saved.`)}</p></article>`;
  }
  if (String(query.form ?? "") === "create" && query.problem !== undefined) {
    return `<article class="card" role="alert"><h2>Not saved</h2><p>${escape(problemText(query.problem))}</p></article>`;
  }
  return "";
}

module.exports = { PROBLEMS, LINKED, NOT_SAVED, problemText, wantsPage, answerFormWithPage, outcomeCard };
