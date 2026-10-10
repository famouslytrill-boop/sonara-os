// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Shared public help FAQ. Answers describe observable behavior and routes,
// not guarantees about live providers, certifications, or legal compliance.
const QUESTIONS = Object.freeze([
  Object.freeze({
    question: "How do I use SONARA for the first time?",
    answer: "Open the Getting Started tutorial, choose the workspace that matches your job, and try a clearly labeled free tool. Saving your work may require a signed-in account and a configured organization."
  }),
  Object.freeze({
    question: "Can I get started without paying?",
    answer: "Yes. The public free-tool directories show which tools are free. Paid features require confirmed plan access. Check Pricing for current plans before purchasing."
  }),
  Object.freeze({
    question: "How do I secure or recover my account?",
    answer: "Use Account Security after signing in. If you cannot sign in, open Forgot Password. Never send passwords, login codes, access tokens, or recovery links to support."
  }),
  Object.freeze({
    question: "Who can see my workspace records?",
    answer: "Access to private workspace records must be checked against the signed-in user and organization permissions on the server. If something looks wrong, report it using Contact without sending private customer data."
  }),
  Object.freeze({
    question: "What happens when I contact support?",
    answer: "The response tells you whether the request was stored, sent by email, or did not go through. A reference ID is issued only when a request is stored or sent. Email acceptance does not prove delivery to a person's inbox."
  }),
  Object.freeze({
    question: "How do I review billing, cancellation, or refund rules?",
    answer: "Review Billing in your account and the Terms and Refund Policy before subscribing. If account billing is unavailable, use Contact and choose Billing. Plan changes and refunds depend on the published terms and provider state."
  }),
  Object.freeze({
    question: "How do I report a security or privacy concern?",
    answer: "Use Contact and select Support, then describe what happened without including passwords, API keys, payment-card details, or other people's personal information. Review the Security and Privacy pages for public disclosures."
  }),
  Object.freeze({
    question: "Where can I find instructions for each product?",
    answer: "The Tutorials directory has Getting Started, Business Builder, Creator Studio, and Growth Studio guides with steps and links to the relevant workspaces."
  })
]);

function renderPublicFaq(escapeHtml) {
  if (typeof escapeHtml !== "function") throw new TypeError("escapeHtml is required");
  return `<section class="sonara-faq" aria-labelledby="help-faq-heading">
    <h2 id="help-faq-heading">Frequently asked questions</h2>
    <div class="sonara-faq-list">
      ${QUESTIONS.map(({ question, answer }) =>
        `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`
      ).join("")}
    </div>
  </section>`;
}

module.exports = { QUESTIONS, renderPublicFaq };
