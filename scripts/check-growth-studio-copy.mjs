// Growth Studio copy must not claim this product sends anything.
//
// The decision, made 26 August 2026 and recorded in
// docs/market/2026-08-26-PER-PRODUCT-COMPETITOR-REASSESSMENT.md: Growth Studio
// is a control plane over HubSpot and Klaviyo, not a sender.
//
// That is a fact about the source, not a marketing preference.
// scripts/verify-env.mjs classifies every environment variable this application
// reads, and the only sending credential among them is RESEND_API_KEY, used by
// lib/sonara-business-employee-invites.cjs for staff invitations. There is no
// SMTP path, no SMS provider and no Twilio anywhere.
// routes/growth-studio-control-routes.cjs posts to HubSpot's campaigns endpoint;
// lib/growth-studio-provider-registry.cjs registers the providers.
//
// Why a check rather than a note: copy is the one part of a product with
// nothing watching it. A sentence promising a customer their campaign will be
// sent is a promise the code cannot keep, and it would be discovered by a
// customer pressing a button rather than by anything here.
//
// It is two-sided on purpose. Failing only on an overclaim would let somebody
// delete the honest sentence and leave a page that says nothing either way --
// which is how the claim comes back. So the control-plane sentence has to be
// present as well as the overclaim absent.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The files that render Growth Studio copy a customer reads. Named rather than
// globbed, because "some file somewhere" is a weaker statement than "these
// files" and the weaker one passes when a page moves out.
const SURFACES = [
  "routes/growth-studio-control-routes.cjs",
  "lib/sonara-brand-registry.cjs",
  "lib/growth-studio-provider-registry.cjs"
];

// A promise that this product performs the delivery. Each pattern is an active
// claim with this product as the subject -- "we send", "campaigns are sent",
// "send your campaign". Describing the boundary is the honest sentence and must
// not trip it, which is what the qualifier below is for.
const CLAIMS_DELIVERY = [
  /\b(we|sonara|growth studio|this product)\s+(will\s+)?(send|sends|deliver|delivers|blast|blasts|text|texts|email|emails)\b/gi,
  /\bsend (your|the|a) (campaign|email|newsletter|blast|sms|text|message)\b/gi,
  /\b(campaign|email|newsletter|sms|message)s? (are|is|get|gets|will be) (sent|delivered|blasted)\b/gi
];

// Claims no neighbouring sentence can make true.
//
// Split out after probing. "Unlimited emails." was added to the brand registry
// description and this check **passed**, because the honest sentence sat inside
// the 160-character qualifier window below and excused it -- the precise leak
// that window exists to close, reappearing one file later.
//
// The distinction that fixes it is real rather than a patch. A contextual verb
// ("sends") genuinely changes meaning when a boundary sentence sits beside it,
// so it belongs in the list above. A volume promise or a built-in-delivery
// claim does not: "unlimited emails, but the provider sends them" is still a
// promise about somebody else's bill. These are never excused.
const CLAIMS_UNCONDITIONALLY = [
  /\bunlimited (emails|sends|sms|texts|messages)\b/gi,
  /\bbuilt-in (email|sms|newsletter) (sending|delivery)\b/gi,
  /\bno (send|sending|email) limits\b/gi,
  /\b(included|free) (email|sms) sends?\b/gi,
  /\breplaces? (klaviyo|hubspot|mailchimp|brevo)\b/gi
];

// Wording that makes the claim a description of the boundary rather than a
// promise. "campaign sends ... require explicit human approval" is the approval
// boundary doing its job; "sending runs through the provider" is the sentence
// this check exists to keep.
const QUALIFIED = /require[sd]? (explicit )?(human |owner )?approval|through the provider|provider you (connect|already use)|not a (replacement|sender)|does not send|goes out through|on that provider|does and does not/i;

// The sentence that has to survive. Matched loosely enough that rewording is
// allowed and tightly enough that deleting the meaning is not.
const CONTROL_PLANE = /layer above your email and SMS tools|sending runs through the email and SMS provider|goes out through the provider you connect/i;

const findings = [];
let linesRead = 0;
let controlPlaneFound = 0;

// How far either side of a match to look for the qualifier. Server-rendered
// copy arrives as long single lines, so a line-wide search would let an honest
// phrase at one end excuse an overclaim at the other -- the same correction
// check-research-lab-public-copy.mjs already carries, for the same reason.
const NEARBY = 160;

for (const relative of SURFACES) {
  let text;
  try {
    text = readFileSync(path.join(root, relative), "utf8");
  } catch {
    // A named surface that has moved is a finding, not a file to skip past.
    findings.push(`${relative}: named as a Growth Studio copy surface and not found`);
    continue;
  }
  const lines = text.split(/\r?\n/);
  linesRead += lines.length;
  if (CONTROL_PLANE.test(text)) controlPlaneFound += 1;
  lines.forEach((line, index) => {
    for (const pattern of CLAIMS_DELIVERY) {
      pattern.lastIndex = 0;
      for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
        const window = line.slice(Math.max(0, match.index - NEARBY), match.index + match[0].length + NEARBY);
        if (QUALIFIED.test(window)) continue;
        findings.push(`${relative}:${index + 1}: copy claims Growth Studio sends -- ${window.trim().slice(0, 150)}`);
      }
    }
    for (const pattern of CLAIMS_UNCONDITIONALLY) {
      pattern.lastIndex = 0;
      for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
        findings.push(`${relative}:${index + 1}: copy promises delivery this product does not control -- "${match[0]}" (no neighbouring sentence excuses this one)`);
      }
    }
  });
}

if (controlPlaneFound === 0) {
  findings.push(
    "no Growth Studio surface carries the control-plane sentence any more. " +
    "A page that says nothing about who sends is how the claim comes back; say it on at least one surface."
  );
}

// Guards the check itself. Every loop above passes over an empty list.
if (linesRead < 300) {
  console.error(`Growth Studio copy check read only ${linesRead} lines; it has gone blind.`);
  process.exit(1);
}

if (findings.length) {
  console.error("Growth Studio copy check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  console.error("");
  console.error("Growth Studio plans campaigns and records consent; the provider sends.");
  console.error("There is no SMTP path, no SMS and no Twilio in this source, so copy");
  console.error("promising delivery is a promise the code cannot keep.");
  process.exit(1);
}

console.log(`Growth Studio copy check passed: ${SURFACES.length} surfaces, ${linesRead} lines, no delivery claim, control-plane sentence present on ${controlPlaneFound}.`);
