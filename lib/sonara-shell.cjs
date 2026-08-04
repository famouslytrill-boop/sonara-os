"use strict";

// The small rendering helpers server.js assembles every page out of.
//
// These are the leaves of the rendering tree: a card, a link, a form, the
// wording for a status. They call each other and nothing else, which is why
// they could move as a group -- unlike `layout`, which sits directly under
// eleven generators and is the reason step 7 was originally marked
// "do not attempt".
//
// `layout`, `renderHomepageContent`, `responsePage`, `adminActions` and
// `adminRowsPage` deliberately stayed in server.js. Generators anchor on markup
// inside all five: `  </head>` alone is a replacement target for four of them.
// See docs/SERVER_SPLIT_PLAN.md.
//
// No factory and no injected dependencies, because this group genuinely needs
// none. createProductPages and createReadiness take deps because they read
// things server.js owns; inventing a createShell({}) here would only add a
// binding to get wrong.

const crypto = require("node:crypto");

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function displayStatus(value) {
  return String(value)
    .replace(/setup_required/g, "Setup required")
    .replace(/review_required/g, "Review required")
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatLabel(value) {
  const labels = {
    supabase: "Account database",
    stripe: "Payment connection",
    stripeWebhook: "Payment updates",
    resend: "Email delivery",
    googleOAuth: "Google sign-in",
    adminProtection: "Founder access",
    legalPages: "Legal pages",
    checkout: "Checkout",
    emailDelivery: "Email delivery",
    accountDatabase: "Account database",
    paymentConnection: "Payment connection",
    paymentUpdates: "Payment updates",
    googleSignIn: "Google sign-in",
    founderAccess: "Founder access"
  };
  return labels[value] || value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function adminReadinessText(item) {
  if (item.status === "configured") return "Configured";
  if (item.status === "invalid") return "Invalid placeholder";
  if (item.status === "missing") return "Missing";
  return item.warning || displayStatus(item.status || "setup_required");
}

// Every card carries the depth class, and that is safe on a work screen
// because the design system already strips depth and motion inside
// [data-sonara-surface="work"], which lib/sonara-page-frame.cjs renders on
// every non-marketing page. The alternative -- a second set of card helpers
// for marketing -- would mean two functions to keep in step and one of them
// eventually forgotten. One card, and the surface decides how it behaves.
function brandCard(title, body) {
  return `<article class="card sonara-depth" data-sonara-enter><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></article>`;
}

function actionCard(title, body, actions = []) {
  return `<article class="card sonara-action-card sonara-depth" data-sonara-enter><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p>${actions.length ? `<div class="card-actions">${actions.join("")}</div>` : ""}</article>`;
}

// A checklist is a list. Joining the steps with " / " inside one paragraph
// produced a run-on that wrapped mid-sequence and read as a single sentence:
//
//   "Create a free account / Pick a product workspace / Create or attach your
//    organization / Use the free tools / Request services from the catalog /
//    Upgrade when paid records are needed"
//
// A customer has to count separators to find where they are. An <ol> also tells
// a screen reader how many steps there are and which one it is on, which the
// paragraph could not.
function checklistCard(title, items) {
  return `<article class="card sonara-depth" data-sonara-enter><h2>${escapeHtml(title)}</h2><ol class="sonara-checklist">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></article>`;
}

function accessCard(access) {
  if (access?.ownerOverride) return brandCard("Owner/Admin access", "Founder operations can open all workspaces for setup, testing, support, and administration. Customer billing rules are unchanged.");
  if (access?.mode === "customer") return brandCard("Free customer access", "Logged-in users can use free tools. Paid tools require confirmed plan access from payment records.");
  return brandCard("Access", "Login is required before protected workspace tools can open.");
}

function linkAction(href, label) {
  return `<a class="action" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function logoutAction() {
  return `<form method="post" action="/logout"><button class="action" type="submit">Logout</button></form>`;
}

// The message field accepts up to 4000 characters.
//
// A rejected submission used to render a separate page saying what was wrong,
// with a "Try again" link back to /contact -- and /contact renders an empty
// form. So getting one field wrong threw away everything the person had
// written. Someone who had just typed several paragraphs describing their
// business was told to try again, meaning type it all again.
//
// Nothing failed. The validation was right, the message was accurate, the link
// worked. It just quietly cost the customer their work, and the more care they
// had put in, the more it cost.
//
// So the form takes back what was submitted and re-renders it. `values` is the
// raw request body, escaped here; `error` is the sentence the validator
// produced.
const CONTACT_CATEGORIES = [
  ["contact", "Contact"],
  ["support", "Support"],
  ["billing", "Billing"],
  ["feedback", "Feedback"]
];

function contactForm(values = {}, error = "") {
  const value = (field) => escapeHtml(String(values?.[field] ?? ""));
  const submittedCategory = String(values?.category ?? "contact");
  // Checkbox state carries over too. Re-ticking a consent box you already
  // ticked is a small thing, but it is the field most likely to be blamed on
  // the customer when it is missed twice.
  const consented = values?.consent === "yes" || values?.consent === "on" || values?.consent === true;
  const errorBlock = error
    ? `<p class="fine" id="contact-error" role="alert" data-contact-error>${escapeHtml(error)}</p>`
    : "";
  const describedBy = error ? ` aria-describedby="contact-error"` : "";
  return `<article class="card">
    <h2>Request intake</h2>
    ${errorBlock}
    <form method="post" action="/contact"${describedBy}>
      <label>Name<input name="name" type="text" value="${value("name")}" required></label>
      <label>Work email<input name="email" type="email" value="${value("email")}" required></label>
      <label>Subject<input name="subject" type="text" value="${value("subject")}" required></label>
      <select name="category" required>
        ${CONTACT_CATEGORIES.map(
          ([key, label]) => `<option value="${key}"${key === submittedCategory ? " selected" : ""}>${label}</option>`
        ).join("")}
      </select>
      <label>Launch context<textarea name="message" rows="6" required>${value("message")}</textarea></label>
      <label class="fine"><input name="consent" type="checkbox" value="yes"${consented ? " checked" : ""} required> Consent to process this request</label>
      <button type="submit">Submit request</button>
    </form>
  </article>`;
}

// The password reset link sits inside the form, next to the password field.
//
// It was reachable before -- routes/customer-ready-experience.cjs appends it to
// the login page when it is not already there -- but appended means just before
// </main>, which put it at 98% of the way down the page, below the sign-in card
// and two marketing cards. Measured, not estimated: the password field is at
// 53% and the link was at 98%. Somebody who cannot remember their password is
// looking at the password field, not scrolling past two cards to find help.
//
// A test asserted the link was on the page, and it was. Being present and being
// findable are different properties, and only one of them was checked.
//
// The injection can stay: it only fires when the link is absent, so rendering
// it here makes that branch a no-op on its own rather than needing to be
// removed.
//
// `email` comes back on a rejected attempt; the password never does.
//
// A refused sign-in used to render a separate page and link back to an empty
// form, so a mistyped password also cost you the email address you had just
// typed. Giving the email back is safe -- the person submitting it already knew
// it. Giving the password back is not, and would put it in the HTML of a page
// that a shared screen, a screenshot, or a browser cache could keep.
function authForm(label, action, { email = "", error = "" } = {}) {
  const inputId = `password-${crypto.createHash("sha1").update(action).digest("hex").slice(0, 8)}`;
  const isSignup = action === "/auth/signup";
  const errorId = `${inputId}-error`;
  const errorBlock = error
    ? `<p class="fine" id="${errorId}" role="alert" data-auth-error>${escapeHtml(error)}</p>`
    : "";
  // Signing up chooses a new password, so it gets the higher floor that
  // lib/sonara-customer-auth.cjs and the reset flow both enforce. Logging in
  // submits an existing one, and the field must not refuse a password somebody
  // already has -- the browser would block the form before the server ever saw
  // it, with no way through to the reset flow that could fix it.
  const minimumLength = isSignup ? 12 : 8;
  const passwordAutocomplete = isSignup ? "new-password" : "current-password";
  const confirmInputId = `${inputId}-confirm`;
  const confirmationField = isSignup
    ? `<label>Confirm password<input id="${confirmInputId}" name="confirmPassword" type="password" autocomplete="new-password" minlength="${minimumLength}" aria-describedby="${inputId}-hint" required></label>
      <button type="button" data-toggle-password="${confirmInputId}" aria-controls="${confirmInputId}" aria-pressed="false" aria-label="Show confirmed password">Show password</button>`
    : "";
  return `<article class="card">
    <h2>${escapeHtml(label)}</h2>
    ${errorBlock}
    <form method="post" action="${escapeHtml(action)}">
      <label>Email<input name="email" type="email" value="${escapeHtml(String(email))}" autocomplete="${isSignup ? "email" : "username"}" required></label>
      <label>Password<input id="${inputId}" name="password" type="password" autocomplete="${passwordAutocomplete}" minlength="${minimumLength}" aria-describedby="${inputId}-hint" required></label>
      <p class="fine" id="${inputId}-hint">${isSignup ? "Use at least 12 characters." : "Enter your password."}</p>
      <button type="button" data-toggle-password="${inputId}" aria-controls="${inputId}" aria-pressed="false" aria-label="Show password">Show password</button>
      ${isSignup ? "" : `<p class="fine"><a href="/forgot-password">Forgot your password?</a></p>`}
      ${confirmationField}
      <button type="submit">${escapeHtml(label)}</button>
    </form>
  </article>`;
}

module.exports = {
  accessCard,
  actionCard,
  adminReadinessText,
  authForm,
  brandCard,
  checklistCard,
  contactForm,
  displayStatus,
  escapeHtml,
  formatLabel,
  linkAction,
  logoutAction
};
