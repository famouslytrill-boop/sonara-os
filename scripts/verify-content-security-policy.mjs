// The Content-Security-Policy may not be widened past what a review approved.
//
// `docs/architecture/2026-08-26-BROWSER-INFERENCE-SECURITY-REVIEW.md` cleared
// browser-side inference on four conditions, three of which are lines in one
// header. A condition recorded only in a document is one the next person
// widening a header will not read, so the three are checked here.
//
// The header is the last boundary that still holds after script injection. Its
// two jobs, in the order they matter:
//
//   `connect-src` decides where a page may send data. Every host on it is a
//   destination injected script may post a customer's records to. Supabase and
//   Stripe are there because they already hold that data; a model host is a new
//   place it could go.
//
//   `script-src` decides what may execute. `'self'` with no bundler and no
//   inline script is the strong version of this, and `'unsafe-eval'` is the
//   sentence that undoes it -- it turns every injection into code execution.
//
// The distinction this check is really about: `'wasm-unsafe-eval'` permits
// WebAssembly compilation and nothing else, while `'unsafe-eval'` re-enables
// `eval()` and `new Function()` across the origin. They read almost identically
// and one is a security decision the other is not. Verified against MDN and
// WebAssembly/content-security-policy issue 7 rather than recalled.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "server.js";

// Hosts allowed to receive data from a page. Anything else in `connect-src` is
// a finding, whatever it is: the point is that adding a destination is a
// decision somebody makes deliberately, not one that arrives with a feature.
const ALLOWED_CONNECT = new Set([
  "'self'",
  "https://*.supabase.co",
  "https://api.stripe.com"
]);

// Never permitted in script-src, whatever else is going on.
const FORBIDDEN_SCRIPT = [
  ["'unsafe-eval'", "re-enables eval() and new Function() across the origin. Browser-side inference needs 'wasm-unsafe-eval', which permits WebAssembly compilation and nothing else"],
  ["'unsafe-inline'", "makes every injected <script> executable, which is what script-src 'self' exists to prevent"],
  ["data:", "a data: script URL is script assembled from a string"],
  ["blob:", "a blob: script URL is script assembled at runtime"],
  ["*", "a wildcard script source permits any origin"]
];

// Condition 3 of the review. A blob: worker is script assembled at runtime from
// a string, which is the property script-src 'self' exists to remove.
const FORBIDDEN_WORKER = ["blob:", "data:", "*"];

const findings = [];

let source;
try {
  source = readFileSync(path.join(root, SOURCE), "utf8");
} catch {
  console.error(`${SOURCE} could not be read, so this check has nothing to measure.`);
  process.exit(1);
}

// The header as written, not as remembered.
// Double-quoted only, and deliberately so. The policy's own value is full of
// single quotes -- `'self'`, `'unsafe-inline'` -- so a character class excluding
// both quote kinds stops at the first `'` and yields one directive. The first
// version did exactly that, and the blindness guard below is what reported it
// rather than the check passing over a policy it had misread.
const match = source.match(/setHeader\(\s*"Content-Security-Policy"\s*,\s*"([^"]+)"/);
if (!match) {
  console.error(
    "No Content-Security-Policy header found in server.js.\n" +
    "That is either a header that moved -- update SOURCE here in the same commit -- or a header that\n" +
    "was removed, which is a far larger problem than this check reporting it."
  );
  process.exit(1);
}

const policy = match[1];
const directives = new Map();
for (const part of policy.split(";")) {
  const tokens = part.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) continue;
  directives.set(tokens[0], tokens.slice(1));
}

// Guards the check itself. A header that parsed to one or two directives is a
// header this has misread, and every loop below would then pass over nothing.
if (directives.size < 8) {
  console.error(`The policy parsed to only ${directives.size} directive(s); this check has gone blind.`);
  process.exit(1);
}

// --- the directives that must exist at all --------------------------------
//
// Checked by presence rather than assumed. `default-src` covers a missing
// directive, so an absent `script-src` is not obviously wrong on a read -- and
// deleting it is a much easier edit than weakening it.
for (const required of ["default-src", "script-src", "connect-src", "object-src", "frame-ancestors", "base-uri"]) {
  if (!directives.has(required)) {
    findings.push(`${required} is missing from the policy. Absent is not the same as restrictive; say it explicitly.`);
  }
}

const scriptSrc = directives.get("script-src") || [];
for (const [token, why] of FORBIDDEN_SCRIPT) {
  if (scriptSrc.includes(token)) findings.push(`script-src contains ${token}: ${why}`);
}
// Named hosts in script-src are code from somewhere else executing on this
// origin, on pages holding a signed-in session.
for (const token of scriptSrc) {
  if (token.startsWith("http")) {
    findings.push(`script-src names the external host ${token}; code served from a host we do not control runs here with a signed-in session`);
  }
}

const connectSrc = directives.get("connect-src") || [];
for (const token of connectSrc) {
  if (!ALLOWED_CONNECT.has(token)) {
    findings.push(
      `connect-src names ${token}, which no review has approved. ` +
      "Every host here is somewhere injected script may send a customer's records. " +
      "If this is deliberate, add it to ALLOWED_CONNECT in this file with the reason."
    );
  }
}
// The other direction, so an approved host quietly disappearing is also a
// finding: it would break Stripe or Supabase at runtime and look like an outage.
for (const expected of ALLOWED_CONNECT) {
  if (!connectSrc.includes(expected)) {
    findings.push(`connect-src no longer names ${expected}; this application needs it to function, so its absence is a fault rather than a tightening`);
  }
}

// worker-src is optional -- default-src covers it -- but if present it must not
// widen past same-origin.
const workerSrc = directives.get("worker-src");
if (workerSrc) {
  for (const token of FORBIDDEN_WORKER) {
    if (workerSrc.includes(token)) {
      findings.push(`worker-src contains ${token}: condition 3 of the browser-inference review refuses it. Use a same-origin worker file.`);
    }
  }
}

if (findings.length) {
  console.error("Content-Security-Policy check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  console.error("");
  console.error("docs/architecture/2026-08-26-BROWSER-INFERENCE-SECURITY-REVIEW.md records why");
  console.error("each of these lines is where it is. Widening one is a decision, not a fix.");
  process.exit(1);
}

console.log(
  `Content-Security-Policy verified: ${directives.size} directives, ` +
  `script-src [${scriptSrc.join(" ")}], ${connectSrc.length} approved connect destinations.`
);
