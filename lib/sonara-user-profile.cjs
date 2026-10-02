// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A person's own profile: the name they are shown as, and the picture.
//
// ## What was actually there before this
//
// Measured 3 October 2026. `/account/profile` was served and signed-in, and it
// rendered the account's email address beside a card reading *"This feature
// works, but saving needs your records connected by an administrator first."*
// There was no form on it. `public.profiles` has carried a `full_name` column
// since migration 011 and **no route has ever written it** -- the `full_name`
// hits in `routes/` are all `business_employees`, a different table about a
// different person.
//
// The storage side was further along and in a way that is worth naming, because
// it is this repository's recurring defect wearing a bucket:
//
//   - `lib/sonara-ecosystem-manifest.cjs` declares an `avatars` bucket.
//   - `scripts/verify-production-schema.mjs` asserts that bucket exists.
//   - Nothing in `lib/` or `routes/` ever wrote to it.
//
// So a gate reported the avatars bucket present, every release, truthfully, and
// the capability it looked like evidence for did not exist. A bucket that exists
// and has no writer is not a feature; `scripts/verify-declared-buckets.mjs` now
// fails the build on one, which is the half that was missing.
//
// ## The three decisions in here
//
// **1. A display name is not a required field, and an absent one is not a blank.**
// Somebody who has not set one is shown by something -- their email's local part
// -- and the page has to be able to say *which* of those two it is doing, because
// "you have no name set" and "your name is dave" are different sentences and only
// one of them invites an edit. `displayName` returns `{ text, source }`.
//
// **2. An avatar is accepted on what it is, not on what it is called.**
// A filename is a claim. The content type is a claim. The bytes are not: an
// image has a signature in its first few bytes, and this reads those. A `.png`
// that is a 2MB HTML file is a stored object that renders as nothing and, if it
// were ever served from a public bucket, renders as whatever it actually is.
//
// **3. A picture is stored against the person, never against a workspace.**
// `lib/sonara-file-storage.cjs` grew `personalPathFor` for this. Filing a face
// under an organization's folder would mean somebody leaving a workspace either
// takes it with them or loses it, and neither is a thing a profile picture
// should do.

const multipart = require("./sonara-multipart.cjs");

const DISPLAY_NAME_MAX = 80;
const HEADLINE_MAX = 120;
const BIO_MAX = 600;

// 2 MiB. A profile picture is displayed at a few hundred pixels; the limit is
// about what the request process will hold in memory while it reads the body,
// not about what looks good.
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

// The image types a profile picture may be.
//
// Detection is `lib/sonara-multipart.cjs`'s `sniff`, not a signature table
// written here. The first draft of this file did write one, and it was a worse
// copy of the shared one -- it missed GIF87a and had no minimum-length guard, so
// a 6-byte file would have been read as whatever matched first. The repository
// already refuses a second comment-stripper by name for the same reason; a second
// file-type sniffer is the same mistake with different bytes.
const AVATAR_TYPES = Object.freeze(["image/png", "image/jpeg", "image/gif", "image/webp"]);

const AVATAR_REFUSED = Object.freeze({
  empty: "empty",
  too_large: "too_large",
  not_an_image: "not_an_image"
});

/** The accepted image types, for a page that has to say what it takes. */
const ACCEPTED_AVATAR_TYPES = AVATAR_TYPES;

/**
 * Whether this upload may be stored as somebody's profile picture.
 *
 * `{ ok: true, type, bytes }` or `{ ok: false, code, message }`. The message is
 * for the person looking at the page, so it says what to do rather than what
 * went wrong in the abstract.
 *
 * Size and emptiness are decided here because they are policy. What the file
 * *is* comes from `multipart.accept`, which reads the bytes and never the
 * declared type or the filename -- both of those are supplied by whoever is
 * uploading.
 */
function acceptAvatar({ bytes, filename } = {}) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (!buffer.length) {
    return { ok: false, code: AVATAR_REFUSED.empty, message: "That file has nothing in it. Choose a picture and try again." };
  }
  if (buffer.length > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      code: AVATAR_REFUSED.too_large,
      message: `That picture is ${Math.ceil(buffer.length / 1024)}KB and the limit is ${AVATAR_MAX_BYTES / 1024}KB. A smaller version of the same image will do.`
    };
  }
  const verdict = multipart.accept({ bytes: buffer, filename: String(filename || "picture") }, AVATAR_TYPES);
  if (!verdict.ok) {
    // Deliberately not the verdict's own message, which names the real type it
    // found. Telling somebody "that is a text/html" is a hint to the one person
    // who already knew, and a puzzle to everybody else.
    return {
      ok: false,
      code: AVATAR_REFUSED.not_an_image,
      message: "That file is not a picture we can read. PNG, JPEG, GIF and WebP work."
    };
  }
  return { ok: true, type: verdict.type, bytes: buffer.length };
}

function trimmed(value, max) {
  const text = typeof value === "string" ? value : String(value == null ? "" : value);
  const clean = text.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return clean.length > max ? clean.slice(0, max).trim() : clean;
}

/**
 * The fields a profile form may set, cleaned.
 *
 * An empty box clears the field rather than leaving the old value, which is what
 * a person pressing save on an emptied input means. `null` rather than `""`, so
 * the column holds "not set" and not "set to nothing".
 */
function profileFieldsFrom(body = {}) {
  return {
    display_name: trimmed(body.displayName, DISPLAY_NAME_MAX) || null,
    headline: trimmed(body.headline, HEADLINE_MAX) || null,
    bio: trimmed(body.bio, BIO_MAX) || null
  };
}

/**
 * The name to show, and where it came from.
 *
 * Three states collapse to two words on a page unless the source travels with
 * the text: a person who has set "Dave" and a person whose email is dave@ look
 * identical in the output and need different prompts. `source` is one of
 * `set`, `email`, or `unknown`.
 */
function displayName(profile = {}, user = {}) {
  const chosen = trimmed(profile.display_name, DISPLAY_NAME_MAX);
  if (chosen) return { text: chosen, source: "set" };
  const email = trimmed(user.email || profile.email, 320);
  const local = email.includes("@") ? email.slice(0, email.indexOf("@")) : "";
  if (local) return { text: local, source: "email" };
  // Not "there", not "Anonymous". A page that cannot read who this is says so
  // rather than inventing a stand-in that looks like a choice somebody made.
  return { text: "", source: "unknown" };
}

/**
 * What is still unset on this profile, and whether the profile could be read.
 *
 * `readable: false` is a distinct third state from "nothing is filled in". A
 * failed read rendered as an empty profile tells somebody a definite thing about
 * their own account on the strength of a request that did not happen -- the same
 * mistake `lib/sonara-creator-approval-graph.cjs` carries a comment about.
 */
function profileCompleteness({ profile, readable = true } = {}) {
  if (readable === false) {
    return { readable: false, missing: [], filled: [], complete: null };
  }
  const row = profile || {};
  const fields = [
    ["display_name", "a name to be shown as"],
    ["avatar_path", "a profile picture"],
    ["headline", "a line about what you do"],
    ["bio", "a short description"]
  ];
  const missing = [];
  const filled = [];
  for (const [column, label] of fields) {
    (trimmed(row[column], BIO_MAX) ? filled : missing).push(label);
  }
  return { readable: true, missing, filled, complete: missing.length === 0 };
}

module.exports = {
  DISPLAY_NAME_MAX,
  HEADLINE_MAX,
  BIO_MAX,
  AVATAR_MAX_BYTES,
  ACCEPTED_AVATAR_TYPES,
  AVATAR_REFUSED,
  acceptAvatar,
  profileFieldsFrom,
  displayName,
  profileCompleteness
};
