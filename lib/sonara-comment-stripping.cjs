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
const COMMENT = /\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g;

/**
 * Source with its comments replaced by a space.
 *
 * A space rather than nothing so that removing a comment cannot join two
 * identifiers into a third that was never written.
 */
function withoutComments(text) {
  return String(text).replace(COMMENT, (match, before) => (before === undefined ? " " : `${before} `));
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
  return String(text).replace(SQL_COMMENT, " ");
}

module.exports = { COMMENT, withoutComments, SQL_COMMENT, withoutSqlComments };
