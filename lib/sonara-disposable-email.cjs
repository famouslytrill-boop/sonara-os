"use strict";

// Is this address a throwaway one?
//
// The answer feeds one risk flag on a captured lead and nothing else. It never
// refuses an address, never hides one, and never tells the visitor. A real
// customer whose company mail is down uses a throwaway address, and refusing
// them loses exactly the sale the widget exists to win -- so this changes a
// number the business sees, and nothing about whether the business hears from
// the person.
//
// ## Where the list lives, and why it is not next to the tool that maintains it
//
// tools/disposable-domains/ is the project that fetches, validates and cleans
// the list. The list itself is `lib/sonara-disposable-domains.txt`, because
// `vercel.json` bundles only `{public/**,routes/**,lib/**}` into the deployed
// function. A list kept beside its tool would be present in every test run and
// absent in production, and this module would find nothing, flag nothing, and
// report success -- the defect this codebase is organised against, wearing a
// spam control. tests/a-throwaway-address-is-flagged-not-refused.test.js
// asserts the path is inside a bundled directory rather than trusting that.
//
// ## Matching walks up the labels
//
// A provider hands out `yourname.theirdomain.com` precisely so that a list of
// whole strings misses it, so an entry has to cover its subdomains. It matches
// on label boundaries: `notmailinator.com` is not caught by `mailinator.com`,
// which a plain `endsWith` would get wrong and would be blocking somebody
// else's domain.

const fs = require("node:fs");
const path = require("node:path");

const LIST_PATH = path.join(__dirname, "sonara-disposable-domains.txt");

let cached = null;

// Read once. The file is a hundred kilobytes and never changes at runtime, and
// a serverless function that re-read it per lead would pay for it on every
// request forever.
function domains() {
  if (cached) return cached;
  try {
    const text = fs.readFileSync(LIST_PATH, "utf8");
    cached = new Set(
      text.split("\n").map((line) => line.trim().toLowerCase()).filter((line) => line !== "")
    );
  } catch {
    // A missing or unreadable list is "we could not tell", not "nothing is a
    // throwaway address". Callers get null and are expected to say so rather
    // than to record a clean result -- see blockedBy.
    cached = null;
    return null;
  }
  return cached;
}

// The entry that covers this address or domain, or null if none does.
//
// Returns `undefined` when the list could not be read at all, which is a third
// state and deliberately not merged with "not on the list". A page that treats
// an unreadable list as a clean address is reporting a check that never ran.
function blockedBy(value) {
  const list = domains();
  if (!list) return undefined;

  let text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  if (text.includes("@")) text = text.slice(text.lastIndexOf("@") + 1);
  text = text.replace(/^\.+|\.+$/g, "");
  if (!text) return null;

  const labels = text.split(".");
  for (let i = 0; i < labels.length; i += 1) {
    const candidate = labels.slice(i).join(".");
    if (list.has(candidate)) return candidate;
  }
  return null;
}

// True only when the list was read and the address is on it. An unreadable list
// gives false here, which is the safe direction for a flag: it under-reports
// rather than marking every lead as suspect, and `blockedBy` is there for a
// caller that needs to tell the two apart.
function isDisposable(value) {
  return typeof blockedBy(value) === "string";
}

function listSize() {
  const list = domains();
  return list ? list.size : 0;
}

module.exports = { blockedBy, isDisposable, listSize, LIST_PATH };
