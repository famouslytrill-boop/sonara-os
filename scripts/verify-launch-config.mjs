import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const apiEntry = await readFile(new URL("../api/index.js", import.meta.url), "utf8");
const scripts = packageJson.scripts || {};
const scriptText = JSON.stringify(scripts);

assert.match(packageJson.packageManager || "", /^pnpm@/, "package.json must pin pnpm");
assert.doesNotMatch(scriptText, /\bnpm\b|\bnpx\b/, "package scripts must use pnpm consistently");
assert.doesNotMatch(scriptText, /\|\|\s*echo/, "verification scripts must not hide failures");
// What the release chain reaches, following one script into another.
//
// These two assertions read the `verify:launch` string directly, which was
// right while the chain was one flat line of thirty-one commands. It is not any
// more: everything after `verify:db` moved into `verify:gates`, so CI could run
// the whole gate as one step instead of naming four commands by hand.
//
// Reading the literal string after that change reported `verify:config` as
// missing from a chain that still runs it -- a check measuring the shape of the
// definition rather than what it does. lib/sonara-release-chain.cjs is the one
// implementation of the expansion; three checks grew their own and all three
// broke on the same day.
const { reaches } = createRequire(import.meta.url)("../lib/sonara-release-chain.cjs");
const launchChain = reaches(scripts, "verify:launch");
assert.ok(launchChain.size > 20, `verify:launch expands to ${launchChain.size} scripts; that is too few to be the release chain`);
assert.ok(launchChain.has("smoke:routes"), "launch verification must run route smoke checks");
assert.ok(launchChain.has("verify:config"), "launch verification must validate deployment configuration");
assert.equal(scripts["smoke:routes"], "node scripts/smoke-routes.cjs");

assert.equal(vercel.framework, null, "Vercel should keep the Express runtime configuration");
assert.match(vercel.installCommand || "", /^pnpm install --frozen-lockfile$/);
assert.match(vercel.buildCommand || "", /^pnpm run vercel-build$/);
assert.match(vercel.functions?.["api/index.js"]?.includeFiles || "", /public\/\*\*/);
assert.match(vercel.functions?.["api/index.js"]?.includeFiles || "", /routes\/\*\*/);
assert.match(vercel.functions?.["api/index.js"]?.includeFiles || "", /lib\/\*\*/);
assert.deepEqual(vercel.rewrites, [{ source: "/(.*)", destination: "/api" }]);
assert.match(apiEntry, /require\("\.\.\/server"\)/, "Vercel API entry must export the root Express app");

console.log("Launch configuration verification passed for pnpm, Vercel Express routing, and required proof gates.");
