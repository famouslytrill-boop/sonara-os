import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const apiEntry = await readFile(new URL("../api/index.js", import.meta.url), "utf8");
const scripts = packageJson.scripts || {};
const scriptText = JSON.stringify(scripts);

assert.match(packageJson.packageManager || "", /^pnpm@/, "package.json must pin pnpm");
assert.doesNotMatch(scriptText, /\bnpm\b|\bnpx\b/, "package scripts must use pnpm consistently");
assert.doesNotMatch(scriptText, /\|\|\s*echo/, "verification scripts must not hide failures");
assert.match(scripts["verify:launch"] || "", /smoke:routes/, "launch verification must run route smoke checks");
assert.match(scripts["verify:launch"] || "", /verify:config/, "launch verification must validate deployment configuration");
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
