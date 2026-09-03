"use strict";

// What the release chain actually runs.
//
// `verify:launch` used to be one flat line of thirty-one `pnpm run` commands,
// so anything wanting to know what the chain covered could read the string and
// split it on `&&`. Three checks did exactly that.
//
// Then everything after `verify:db` moved into `verify:gates`, so CI could run
// the whole gate as one step instead of naming four commands by hand — and all
// three broke at once, each in a way that looked like a real finding:
//
//   verify-launch-config.mjs   reported verify:config missing from a chain that
//                              still runs it.
//   verify-doc-counts.mjs      reported the chain as 7 commands, against a
//                              document correctly saying 31.
//   the-release-gate test      would have reported the same.
//
// None of them was wrong about the string. All three were measuring **the shape
// of the definition rather than what it does**, which is this repository's
// recurring defect wearing its least obvious disguise: the check was accurate
// and the thing it measured was not the thing it named.
//
// So this is the one implementation. A chain command is anything reachable from
// the named script, however many scripts deep, and the answer does not change
// when somebody regroups the definition.

// `pnpm run x` and `pnpm x` both invoke a script, and this repository writes
// both -- CI's test step is `pnpm test`, without `run`. A name is only counted
// when package.json declares it, so `pnpm install` and `pnpm audit` are not
// mistaken for scripts.
const INVOCATION = /pnpm (?:run )?([a-z0-9:-]+)/g;

/**
 * Every script reachable from `name`, including `name` itself.
 *
 * `scripts` is package.json's scripts object. Cycles terminate: a name already
 * seen is not followed again.
 */
function reaches(scripts, name, seen = new Set()) {
  if (!scripts || seen.has(name)) return seen;
  seen.add(name);
  const body = scripts[name];
  if (typeof body !== "string") return seen;
  for (const match of body.matchAll(INVOCATION)) {
    if (scripts[match[1]]) reaches(scripts, match[1], seen);
  }
  return seen;
}

/**
 * Whether a script only groups other scripts together.
 *
 * `verify:gates` is `pnpm run a && pnpm run b && ...` and nothing else. It runs
 * no check of its own, so counting it as a command would inflate the figure by
 * however many times somebody chose to group things -- a number that would move
 * when the definition was tidied and not when the checks changed.
 *
 * Derived rather than listed. A grouping that gains a real command stops being
 * a grouping on the same day, with nobody having to remember.
 */
function isGrouping(body) {
  if (typeof body !== "string") return false;
  const withoutInvocations = body.replace(INVOCATION, " ").replace(/&&/g, " ").trim();
  return withoutInvocations === "";
}

/**
 * The checks the chain runs.
 *
 * This is the number `docs/owner/WHAT-IS-LEFT.md` quotes at whoever is deciding
 * whether this is shippable, so it has to mean "checks that run" rather than
 * "segments in a string" -- those were the same number until the chain nested,
 * and then one of them was 31 and the other 7.
 *
 * The entry point and any pure groupings are excluded; everything that actually
 * executes something is counted, however deep it sits.
 */
function chainCommands(scripts, entry = "verify:launch") {
  const all = reaches(scripts, entry);
  all.delete(entry);
  return [...all].filter((name) => !isGrouping(scripts[name])).sort();
}

module.exports = { INVOCATION, reaches, chainCommands };
