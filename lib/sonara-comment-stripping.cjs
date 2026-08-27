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

module.exports = { COMMENT, withoutComments };
