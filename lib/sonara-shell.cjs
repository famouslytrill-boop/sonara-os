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

function checklistCard(title, items) {
  return `<article class="card sonara-depth" data-sonara-enter><h2>${escapeHtml(title)}</h2><p>${items.map((item) => escapeHtml(item)).join(" / ")}</p></article>`;
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

function contactForm() {
  return `<article class="card">
    <h2>Request intake</h2>
    <form method="post" action="/contact">
      <label>Name<input name="name" type="text" required></label>
      <label>Work email<input name="email" type="email" required></label>
      <label>Subject<input name="subject" type="text" required></label>
      <select name="category" required>
        <option value="contact">Contact</option>
        <option value="support">Support</option>
        <option value="billing">Billing</option>
        <option value="feedback">Feedback</option>
      </select>
      <label>Launch context<textarea name="message" rows="6" required></textarea></label>
      <label class="fine"><input name="consent" type="checkbox" value="yes" required> Consent to process this request</label>
      <button type="submit">Submit request</button>
    </form>
  </article>`;
}

function authForm(label, action) {
  const inputId = `password-${crypto.createHash("sha1").update(action).digest("hex").slice(0, 8)}`;
  const isSignup = action === "/auth/signup";
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
    <form method="post" action="${escapeHtml(action)}">
      <label>Email<input name="email" type="email" autocomplete="${isSignup ? "email" : "username"}" required></label>
      <label>Password<input id="${inputId}" name="password" type="password" autocomplete="${passwordAutocomplete}" minlength="${minimumLength}" aria-describedby="${inputId}-hint" required></label>
      <p class="fine" id="${inputId}-hint">${isSignup ? "Use at least 12 characters." : "Enter your password."}</p>
      <button type="button" data-toggle-password="${inputId}" aria-controls="${inputId}" aria-pressed="false" aria-label="Show password">Show password</button>
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
