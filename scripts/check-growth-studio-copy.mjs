// Growth Studio copy must promise exactly the channels this product can deliver.
//
// REWRITTEN 10 September 2026, and the reason for the rewrite is the more
// useful half of this file.
//
// The original said Growth Studio must never claim to send anything, and gave
// this as its justification: "scripts/verify-env.mjs classifies every
// environment variable this application reads, and the only sending credential
// among them is RESEND_API_KEY, used by
// lib/sonara-business-employee-invites.cjs for staff invitations. There is no
// SMTP path, no SMS provider and no Twilio anywhere."
//
// **That was true when it was written and half of it is false now.**
// lib/growth-studio-dispatch.cjs POSTs a campaign to api.resend.com on this
// application's own Resend account, and lib/sonara-paid-capabilities.cjs prices
// it per email. Email delivery is a promise this code keeps.
//
// A check whose stated reason has expired is worse than no check: it is what
// the next person reads instead of checking, and it was about to be "relaxed"
// to let honest copy through -- which is how a check gets quietly weakened into
// nothing. So it is not relaxed. It is split by channel, and the email half is
// made CONDITIONAL ON THE CODE, which is stronger than what it replaced:
//
//   * **Email** -- may be claimed, but only while the dispatcher that delivers
//     it exists. `assertEmailDeliveryIsReal` below reads the source and fails if
//     the Resend call or the route's use of it disappears. Delete the sender and
//     every "send your campaign" sentence becomes a finding again, immediately.
//   * **SMS and voice** -- may NEVER be claimed, and no neighbouring sentence
//     excuses it. lib/sonara-telephony.cjs decides whether a message or call is
//     permitted and priced; it dials nothing. `SONARA_TELEPHONY_PROVIDER_URL` is
//     the adapter variable and no runtime file reads it yet. A carrier claim is
//     a promise the code cannot keep, exactly as the original said of email.
//
// Why a check rather than a note: copy is the one part of a product with
// nothing watching it. A sentence promising a customer their text message will
// be sent would be discovered by a customer pressing a button.
//
// It stays two-sided. Failing only on an overclaim would let somebody delete
// the honest sentence and leave a page that says nothing either way -- which is
// how the claim comes back. So the carrier-boundary sentence has to be present
// as well as the carrier overclaim absent.

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

// What has to be true in the source before any email-sending sentence is
// allowed to stand. This is the whole point of the rewrite: the permission is
// granted by the code, not by this file's opinion of it.
//
// Each entry names a file and something that must appear in it. Together they
// say: there is a dispatcher, it posts to Resend, and a route actually calls it.
// A decision core nobody calls would satisfy none of the three.
const EMAIL_DELIVERY_EVIDENCE = [
  ["lib/growth-studio-dispatch.cjs", /api\.resend\.com/, "the dispatcher no longer posts to Resend"],
  ["lib/growth-studio-dispatch.cjs", /async function dispatchCampaign/, "dispatchCampaign is gone"],
  ["routes/growth-studio-control-routes.cjs", /dispatchCampaign\(/, "no route calls the dispatcher, so nothing sends"]
];

function assertEmailDeliveryIsReal() {
  const missing = [];
  for (const [relative, pattern, complaint] of EMAIL_DELIVERY_EVIDENCE) {
    let text;
    try {
      text = readFileSync(path.join(root, relative), "utf8");
    } catch {
      missing.push(`${relative} is named as evidence that email delivery is real and was not found`);
      continue;
    }
    if (!pattern.test(text)) missing.push(`${relative}: ${complaint}`);
  }
  return missing;
}

// A promise that this product delivers over a CARRIER. Never permitted: there
// is no carrier adapter, so these are promises the code cannot keep.
//
// Deliberately not excusable by a nearby qualifier. "we text your customers,
// through the provider you connect" is still a promise about a thing that does
// not happen, because nothing connects.
const CLAIMS_CARRIER_DELIVERY = [
  /\b(we|sonara|growth studio|this product)\s+(will\s+)?(text|texts|call|calls|rings?)\s+(your|the|them|customers|contacts|leads)/gi,
  /\bsend (your|the|a) (sms|text|text message)\b/gi,
  // `messages?` after sms/text is not padding: "SMS messages are sent" is a
  // real overclaim and the first version of this pattern, which required the
  // channel word to sit directly against the verb, walked straight past it. The
  // canary below is what found that.
  /\b(sms|text|voice|phone)( message| call)?s? (are|is|get|gets|will be) (sent|delivered|placed|made)\b/gi,
  /\bbuilt-in (sms|text|voice|calling) (sending|delivery|support)\b/gi,
  /\b(we|sonara|growth studio) answers? (the phone|your calls|calls)\b/gi
];

// A promise that this product delivers EMAIL. Permitted only while
// EMAIL_DELIVERY_EVIDENCE holds; when it does not, every one of these is a
// finding with the same force the carrier claims have.
const CLAIMS_EMAIL_DELIVERY = [
  /\b(we|sonara|growth studio|this product)\s+(will\s+)?(send|sends|deliver|delivers|email|emails)\b/gi,
  /\bsend (your|the|a|an) (email )?(campaign|email|newsletter)\b/gi,
  /\b(campaign|email|newsletter)s? (are|is|get|gets|will be) (sent|delivered)\b/gi
];

// Claims no neighbouring sentence can make true, and no amount of working code
// makes true either.
//
// Split out after probing. "Unlimited emails." was added to the brand registry
// description and the original check **passed**, because the honest sentence sat
// inside the qualifier window and excused it -- the precise leak that window
// exists to close, reappearing one file later.
//
// `replaces klaviyo` stays banned now that sending works, and that is a
// deliberate call rather than an oversight. Sending an email is one of the
// things Klaviyo does; flows, segmentation, deliverability tooling and
// reputation management are the rest, and none of those is built. A capability
// that can send is not a replacement for a product that can send, and claiming
// otherwise fails on a customer's first real comparison.
const CLAIMS_UNCONDITIONALLY = [
  /\bunlimited (emails|sends|sms|texts|messages)\b/gi,
  /\bno (send|sending|email) limits\b/gi,
  /\b(included|free) (email|sms) sends?\b/gi,
  /\breplaces? (klaviyo|hubspot|mailchimp|brevo)\b/gi
];

// Wording that makes an email claim a description of the boundary rather than a
// promise. Kept for the approval sentences, which describe the gate rather than
// offering delivery.
const QUALIFIED = /require[sd]? (explicit )?(human |owner )?approval|through the provider|provider you (connect|already use)|not a (replacement|sender)|does not send|goes out through|on that provider|does and does not|who (agreed|consented)|recorded consent/i;

// The sentence that has to survive, and it is now about the carrier rather than
// about email. Email delivery is guaranteed by the code above; what needs a
// sentence on the page is the half that is still somebody else's job, because
// its absence is how "we text your customers" comes back.
//
// Matched loosely enough that rewording is allowed and tightly enough that
// deleting the meaning is not.
const CARRIER_BOUNDARY = /(text|sms)[^.]{0,80}(call|voice|phone)[^.]{0,120}(provider|carrier)|(call|voice)[^.]{0,80}(text|sms)[^.]{0,120}(provider|carrier)/i;

const findings = [];
let linesRead = 0;
let carrierBoundaryFound = 0;

// How far either side of a match to look for the qualifier. Server-rendered
// copy arrives as long single lines, so a line-wide search would let an honest
// phrase at one end excuse an overclaim at the other -- the same correction
// check-research-lab-public-copy.mjs already carries, for the same reason.
const NEARBY = 160;

const emailEvidenceMissing = assertEmailDeliveryIsReal();
const emailDeliveryIsReal = emailEvidenceMissing.length === 0;

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
  if (CARRIER_BOUNDARY.test(text)) carrierBoundaryFound += 1;

  lines.forEach((line, index) => {
    for (const pattern of CLAIMS_CARRIER_DELIVERY) {
      pattern.lastIndex = 0;
      for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
        findings.push(
          `${relative}:${index + 1}: copy promises a text message or a call this product cannot place -- ` +
          `"${match[0]}" (there is no carrier adapter; no neighbouring sentence excuses this one)`
        );
      }
    }

    // Only a finding when the code cannot back it. When it can, these sentences
    // are the product being described accurately.
    if (!emailDeliveryIsReal) {
      for (const pattern of CLAIMS_EMAIL_DELIVERY) {
        pattern.lastIndex = 0;
        for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
          const window = line.slice(Math.max(0, match.index - NEARBY), match.index + match[0].length + NEARBY);
          if (QUALIFIED.test(window)) continue;
          findings.push(`${relative}:${index + 1}: copy claims Growth Studio sends email -- ${window.trim().slice(0, 150)}`);
        }
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

if (!emailDeliveryIsReal) {
  for (const reason of emailEvidenceMissing) {
    findings.push(
      `email delivery can no longer be shown to work -- ${reason}. ` +
      "Either restore the sender or take the sending claims back out of the copy."
    );
  }
}

if (carrierBoundaryFound === 0) {
  findings.push(
    "no Growth Studio surface says that text messages and calls go out through a provider. " +
    "A page that says nothing about who places them is how that claim comes back; say it on at least one surface."
  );
}

// Guards the check itself. Every loop above passes over an empty list.
if (linesRead < 300) {
  console.error(`Growth Studio copy check read only ${linesRead} lines; it has gone blind.`);
  process.exit(1);
}

// And guards the patterns. A regex that stopped matching is indistinguishable
// from copy that is clean, so the carrier patterns are exercised against a
// sentence they must all reject before they are trusted on real copy.
// One clause per pattern, so the count below is a per-pattern assertion rather
// than a total that a single greedy pattern could satisfy on its own.
const CANARY =
  "We text your customers. Send your sms today. SMS messages are sent within seconds. " +
  "Built-in sms delivery included. Growth Studio answers the phone for you.";
const canaryMisses = CLAIMS_CARRIER_DELIVERY.filter((pattern) => {
  pattern.lastIndex = 0;
  return !pattern.test(CANARY);
});
if (canaryMisses.length) {
  console.error(
    `${canaryMisses.length} of the ${CLAIMS_CARRIER_DELIVERY.length} carrier patterns did not match the canary sentence; ` +
    "they have stopped matching, so clean copy and a broken pattern look the same."
  );
  for (const pattern of canaryMisses) console.error(`- ${pattern}`);
  process.exit(1);
}
const canaryCaught = CLAIMS_CARRIER_DELIVERY.length;

if (findings.length) {
  console.error("Growth Studio copy check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  console.error("");
  console.error("Growth Studio sends email itself, through Resend, priced per email.");
  console.error("It places no calls and sends no text messages: lib/sonara-telephony.cjs");
  console.error("decides and prices them, and no runtime file reads");
  console.error("SONARA_TELEPHONY_PROVIDER_URL yet. Copy may promise the first and");
  console.error("must not promise the second.");
  process.exit(1);
}

console.log(
  `Growth Studio copy check passed: ${SURFACES.length} surfaces, ${linesRead} lines. ` +
  `Email delivery backed by ${EMAIL_DELIVERY_EVIDENCE.length} pieces of source evidence, so email claims are permitted. ` +
  `No carrier claim; carrier-boundary sentence present on ${carrierBoundaryFound}. ` +
  `${canaryCaught} carrier patterns confirmed live against the canary.`
);
