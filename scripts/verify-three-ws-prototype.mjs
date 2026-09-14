#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const experimentRoot = path.join(root, "experiments", "three-ws-presentation");
const adapterPath = path.join(experimentRoot, "presentation-adapter.js");
const pagePath = path.join(experimentRoot, "index.html");
const readmePath = path.join(experimentRoot, "README.md");
const packagePath = path.join(root, "package.json");
const serverPath = path.join(root, "server.js");
const vercelPath = path.join(root, "vercel.json");

const requiredFiles = [adapterPath, pagePath, readmePath, packagePath, serverPath, vercelPath];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) fail(`Missing required prototype boundary file: ${path.relative(root, file)}`);
}

const adapter = fs.readFileSync(adapterPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const readme = fs.readFileSync(readmePath, "utf8");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const server = fs.readFileSync(serverPath, "utf8");
const vercel = fs.readFileSync(vercelPath, "utf8");
const prototypeSource = `${adapter}\n${page}`;

const checks = [];

expect(/@three-ws\/avatar@0\.2\.3/.test(adapter), "adapter pins @three-ws/avatar to 0.2.3");
expect(/three@0\.180\.0/.test(adapter), "adapter pins the Three.js peer dependency");
expect(!/(@three-ws\/avatar|three\.ws)[^\n"']*(latest|next|canary)/i.test(prototypeSource), "prototype has no floating latest/next/canary SDK reference");
expect(/import\(moduleUrl\)/.test(adapter), "SDK load stays behind the explicit dynamic mount path");
expect(/addEventListener\("submit"/.test(page), "3D mount requires an explicit user submit action");
expect(/Disable 3D/.test(page) && /adapter\.unmount\(\)/.test(page), "prototype has an explicit disable/fallback control");
expect(/parsed\.protocol !== "https:"/.test(adapter), "model validator rejects non-HTTPS asset URLs");
expect(/\.glb/.test(adapter) && /\.gltf/.test(adapter), "model validator limits the experiment to direct GLB/glTF assets");
expect(/parsed\.username \|\| parsed\.password/.test(adapter), "model validator rejects embedded URL credentials");
expect(/three-ws-viewer/.test(prototypeSource), "prototype uses the viewer-only custom element");
expect(!/<agent-3d\b/i.test(prototypeSource), "prototype does not instantiate the richer agent element");
expect(!/\bbrain\s*=|setAttribute\(["']brain["']|\.brain\s*=/i.test(prototypeSource), "prototype does not configure an LLM brain");
expect(!/\b(wallet|private[_-]?key|seed[_-]?phrase)\b/i.test(prototypeSource), "prototype source contains no wallet/private-key capability");
expect(!/\b(openai|anthropic|gemini|provider[_-]?key|api[_-]?key)\b/i.test(prototypeSource), "prototype source contains no model-provider credential path");
expect(!/sonara-agent-authority|sonara-agent-runner|supabase|stripe|resend/i.test(prototypeSource), "prototype source is disconnected from SONARA authority, data, payment, and mail systems");

const rootDeps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}), ...(packageJson.optionalDependencies || {}) };
expect(!Object.hasOwn(rootDeps, "@three-ws/avatar"), "three.ws is not a root runtime or development dependency");
expect(!Object.hasOwn(rootDeps, "three"), "Three.js is not added to the root SONARA dependency graph for this experiment");
expect(!server.includes("three-ws-presentation") && !server.includes("@three-ws/avatar"), "production server does not mount or import the experiment");
expect(!vercel.includes("three-ws-presentation") && !vercel.includes("@three-ws/avatar"), "Vercel production routing does not expose the experiment");
expect(/developer-only, opt-in presentation experiment/i.test(readme), "README labels the prototype as developer-only and opt-in");
expect(/Asset rights are separate/i.test(readme), "README keeps generated/model asset rights separate from SDK licensing");
expect(/text\/voice functionality works with the 3D layer disabled or unavailable/i.test(readme), "promotion checklist preserves a non-3D fallback");

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, checks, failed: failed.map((check) => check.message) }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks, version: "0.2.3", runtimeIntegrated: false }, null, 2));

function expect(ok, message) {
  checks.push({ ok: Boolean(ok), message });
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}
