// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Removing comments from source before measuring what the code names.
//
// Two release-chain reports depend on this and both got it wrong the same way,
// which is why it is one module now rather than two copies.
//
// ## The bug it exists for
//
// Both scripts stripped comments in two passes: block comments first, then line
// comments. That is the obvious order and it is wrong, because the block pass
// runs over text that still contains line comments. A perfectly ordinary line
// comment mentioning a path --
//
//     // /business-builder/owner/* and this module already receives ...
//
// -- contains `/*`, and the block pass reads it as an opener. Everything from
// there to the next `*/` anywhere in the file stops being code as far as the
// measurement is concerned.
//
// While a file has no later `*/` the non-greedy match finds nothing and the
// damage is zero, which is why this sat unnoticed. It surfaced the moment
// somebody wrote a one-line `/* ... */` inside a catch in
// routes/sonara-last9-routes.cjs: 636 lines between the two vanished,
// `invoice.invoice_number` at line 338 went with them, and the column it reads
// began reporting as fetched-and-never-used. The report was accusing correct
// code, on the strength of a parser that had silently stopped matching.
//
// ## Why one alternation is the fix
//
// A single left-to-right pass with both forms in one alternation means whichever
// comment *starts first* wins. At the `//` of a line comment the block branch
// cannot match, so the line branch consumes to end of line and a `/*` inside it
// is never seen as an opener.
//
// The `[^:]` guard on the line branch is unchanged and is there for a different
// hazard: `https://` is not a comment. It costs the character before the `//`,
// which is why the replacement puts it back.

// Group 1 is only defined on the line-comment branch, which is how the
// replacement tells the two apart without a second test.
// ## The second bug, and the third: a string is not code, and a line is a line
//
// Two more failures of the same family were measured on 1 October 2026, and
// both are fixed below by replacing the single regex with a scanner that knows
// where strings are.
//
// ### A `/*` inside a string opened a comment
//
// `server.js` sets a Content-Security-Policy containing
// `connect-src 'self' https://*.supabase.co`. That value holds the characters
// `/` and `*` adjacent, inside a double-quoted string. The alternation's block
// branch cannot see quotes, so it read them as an opener and swallowed
// everything to the next `*/` anywhere in the file. Measured: the two lines
// after that header -- `next();` and the closing `});` -- disappeared from
// every report that strips this file.
//
// The `[^:]` guard was written for the `https://` half of exactly this hazard,
// and it is no help here: the guard is on the *line* branch, and the damage was
// done by the *block* branch one character later.
//
// ### Collapsing a comment renumbered the file
//
// The replacement was a single space, so a multi-line block comment made the
// stripped text shorter than the file and moved every line after it up.
//
// That is harmless for a consumer that only asks what the text contains. It is
// wrong for one that takes a line number from the real file and indexes into the
// stripped text -- and `sourceBlockForRoute` in
// scripts/generate-capability-inventory.cjs does exactly that, with a line
// number out of a V8 stack trace. So the further down `server.js` a route was
// registered, the further from its own registration the generator read.
//
// Measured: adding one three-line JSDoc block to `server.js` moved
// `data/capability-inventory.json` from 50 recorded UI form links to 42. Eight
// forms -- the checkout session, the contact form, the employee invite, the
// organization setup among them -- stopped being recorded because of a comment.
// Nothing reported it, because `--check` compares the file against the same
// shifted reading.
//
// ### What replaces it
//
// `withoutComments` is now a left-to-right scanner that copies string and
// template literals through untouched and only recognises a comment in code
// position, and that emits one newline for every newline it consumes. The
// regex below is kept because `CSS_COMMENT` and its siblings are imported by
// name elsewhere, and because the alternation is still the right explanation of
// the first bug -- but `withoutComments` no longer uses it.
//
// One limit, stated rather than implied: this is a scanner and not a parser, so
// it does not know a regular expression literal from a division. A literal
// containing an unescaped `/*` -- `/[/*]/` -- would still be read as a comment
// opener. No file in this repository contains one, which
// tests/a-line-comment-cannot-open-a-block-comment.test.js asserts across every
// JavaScript file rather than leaving it to be believed.

const COMMENT = /\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g;

/**
 * As many newlines as the text held.
 *
 * Every stripper here emits these in place of what it removed, so a line number
 * means the same thing on both sides of the strip.
 */
function newlinesIn(text) {
  return "\n".repeat((String(text).match(/\n/g) || []).length);
}

/**
 * JavaScript with its comments replaced by a space, strings left alone, and the
 * line count unchanged.
 *
 * A space rather than nothing so that removing a comment cannot join two
 * identifiers into a third that was never written.
 */
function withoutComments(text) {
  const source = String(text);
  const out = [];
  scanCode(source, 0, false, out);
  return out.join("");
}

/**
 * Copy code through, dropping comments, from `start` until the end of the
 * source -- or, when `stopAtBrace`, until the `}` that closes the template
 * interpolation we were called from.
 *
 * Returns the index after the last character consumed.
 */
function scanCode(source, start, stopAtBrace, out) {
  let index = start;
  let braceDepth = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (stopAtBrace) {
      // `${ items.map((item) => { ... }) }` has braces of its own, so the first
      // `}` is not necessarily the one that ends the interpolation.
      if (char === "{") braceDepth += 1;
      else if (char === "}") {
        if (braceDepth === 0) { out.push("}"); return index + 1; }
        braceDepth -= 1;
      }
    }

    // A backslash in code position only ever introduces an escape inside a
    // literal this scanner is about to misread -- in practice a regular
    // expression, which it does not parse. Copying the pair opaquely is what
    // stops `/https?:\/\//g` ending as a line comment: without it the scanner
    // steps onto the second `\`, then onto two adjacent slashes that are the
    // literal's escaped content and its terminator, and swallows the rest of
    // the line. Measured on lib/sonara-redaction.cjs and
    // scripts/ before this line existed.
    if (char === "\\") { out.push(source.slice(index, index + 2)); index += 2; continue; }

    if (char === "/" && next === "/") {
      let end = index + 2;
      while (end < source.length && source[end] !== "\n") end += 1;
      out.push(" ");
      index = end;
      continue;
    }
    if (char === "/" && next === "*") {
      const close = source.indexOf("*/", index + 2);
      const end = close === -1 ? source.length : close + 2;
      out.push(" ", newlinesIn(source.slice(index, end)));
      index = end;
      continue;
    }
    if (char === "\"" || char === "'") { index = copyQuoted(source, index, char, out); continue; }
    if (char === "`") { index = copyTemplate(source, index, out); continue; }

    out.push(char);
    index += 1;
  }
  return index;
}

/**
 * Copy a single- or double-quoted string through verbatim.
 *
 * An unterminated one stops at the newline rather than running to the end of the
 * file: a scanner that mistakes something for a quote should lose one line, not
 * the rest of the source.
 */
function copyQuoted(source, start, quote, out) {
  out.push(quote);
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") { out.push(source.slice(index, index + 2)); index += 2; continue; }
    out.push(char);
    index += 1;
    if (char === quote || char === "\n") return index;
  }
  return index;
}

/** Copy a template literal through, following `${ ... }` back into code. */
function copyTemplate(source, start, out) {
  out.push("`");
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") { out.push(source.slice(index, index + 2)); index += 2; continue; }
    if (char === "`") { out.push("`"); return index + 1; }
    if (char === "$" && source[index + 1] === "{") {
      out.push("${");
      index = scanCode(source, index + 2, true, out);
      continue;
    }
    out.push(char);
    index += 1;
  }
  return index;
}

// The same shape for SQL, where the line form is `--` rather than `//`.
//
// scripts/report-security-definer-exposure.mjs stripped block comments and then
// `--` comments, in two passes, which is the identical bug one language over:
// six migrations carry the line
//
//     -- lib/catalog/*.cjs, so the table wins wherever it holds a value.
//
// and the block pass reads that `/*` as an opener. Measured on those files it
// removed 9-10% of each. Unlike the JavaScript case this changed no verdict --
// none of the six mentions SECURITY DEFINER either way -- so it was latent
// rather than wrong, and it is fixed here for the same reason the first one
// was: the next migration to land in a swallowed region would be invisible and
// nothing would say so.
//
// No `[^:]` guard on this branch: `--` has no `https://` equivalent to protect.
//
// One limit, stated rather than implied: a `--` inside a dollar-quoted function
// body ($$ ... $$) is stripped as a comment, because this is a scanner and not
// a SQL parser. That was true of the two-pass version too, so nothing regressed;
// it is written down so the next person does not have to rediscover it.
const SQL_COMMENT = /\/\*[\s\S]*?\*\/|--[^\n]*/g;

/**
 * SQL with its comments replaced by a space.
 */
function withoutSqlComments(text) {
  return String(text).replace(SQL_COMMENT, (match) => ` ${newlinesIn(match)}`);
}

// And the same shape again for YAML and shell, where the line form is `#`.
//
// Added 19 September 2026 for scripts/verify-targeted-mocha.mjs, which scans
// GitHub workflow files for mocha invocations. Its first version hand-rolled a
// two-pass stripper and was caught by
// tests/a-line-comment-cannot-open-a-block-comment.test.js -- the fourth time
// that bug has been written in this repository, which is the whole argument for
// this module existing.
//
// There is no block form in YAML, so this is a single branch and the ordering
// hazard cannot arise. The `[^:]` guard is here for the same reason as the
// JavaScript one, one character over: a `#` after a colon is ordinarily a
// fragment or an anchor rather than a comment, and more importantly `${{ }}`
// expressions and quoted URLs should not lose their tails. It costs the
// character before the `#`, which the replacement puts back.
//
// One limit, stated rather than implied: a `#` inside a single- or
// double-quoted YAML scalar is stripped as a comment, because this is a scanner
// and not a YAML parser. For the use this was written for -- finding a command
// in a `run:` block -- that is harmless, and a caller who needs YAML semantics
// should parse the document instead.
const HASH_COMMENT = /(^|[^:])#[^\n]*/g;

/**
 * YAML or shell source with its comments replaced by a space.
 */
function withoutHashComments(text) {
  // A `#` comment holds no newline, so only the captured character before it can
  // carry one -- and that character is re-emitted, so nothing is lost or gained.
  return String(text).replace(HASH_COMMENT, (match, before) => `${before} `);
}

// The CSS form, which is one branch because CSS has only one comment syntax.
//
// `//` is NOT a comment in CSS, and that is the reason this is separate rather
// than reusing COMMENT. Applied to a stylesheet, the JavaScript alternation
// would read a value like `url(//cdn.example.com/x.png)` as a line comment --
// the `[^:]` guard admits the `(` before the slashes -- and silently blank the
// rest of that line, including the closing brace. Neither stylesheet in this
// repository contains such a value today, which is exactly the kind of "works
// until somebody writes one" that this module exists to stop repeating.
//
// With a single branch there is no ordering hazard to get wrong, so this is
// here for the boundary rather than for the bug.
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/**
 * CSS source with its comments replaced by a space, and the line count unchanged.
 *
 * This used to say that a caller reporting a file and a line -- which
 * scripts/report-unreachable-breakpoints.mjs does -- could not use it, because
 * collapsing a multi-line comment to one space moved every byte after it, and
 * that such a caller should apply CSS_COMMENT with a newline-preserving
 * replacement of its own. That note was right about the hazard and it described
 * the JavaScript stripper above just as accurately, where nobody had written it
 * down and a release-chain generator was quietly reading the wrong lines.
 *
 * The newlines are preserved here now, so the restriction is lifted. The
 * replacement in report-unreachable-breakpoints.mjs is left as it is rather than
 * rewritten to call this: it works, and it is not what this change is about.
 */
function withoutCssComments(text) {
  return String(text).replace(CSS_COMMENT, (match) => ` ${newlinesIn(match)}`);
}

module.exports = { COMMENT, withoutComments, SQL_COMMENT, withoutSqlComments, HASH_COMMENT, withoutHashComments, CSS_COMMENT, withoutCssComments, newlinesIn };
