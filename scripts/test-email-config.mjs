import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  const result = {};
  const text = readFileSync(filePath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const index = line.indexOf("=");
    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    const rawValue = line.slice(index + 1).trim();
    result[key] = rawValue.replace(/^['"]|['"]$/g, "").trim();
  }

  return result;
}

const env = {
  ...parseEnvFile(".env"),
  ...parseEnvFile(".env.local"),
  ...process.env,
};

const send = process.argv.includes("--send");
const apiKey = env.RESEND_API_KEY;
const from = env.RESEND_FROM_EMAIL;
// The recipient variables the RUNTIME reads, from the same declaration
// lib/sonara-infrastructure-manifest.cjs gives the resend service and
// scripts/verify-email-env.mjs checks: SUPPORT_TO_EMAIL or CONTACT_TO_EMAIL.
//
// This read `SUPPORT_EMAIL || CONTACT_EMAIL` until 18 September 2026. Those two
// names are not set anywhere and nothing in the runtime reads them, so a
// correctly configured production aborted every `--send` test as
// unconfigured -- the delivery test failing on the one environment it exists to
// test. Codex found it on PR #299, after the sibling check had been fixed and
// this one left behind.
//
// The legacy names are deliberately NOT accepted as a fallback. The first
// attempt at this fix accepted them last, reasoning that an operator
// mid-rotation should not be stranded -- but `server.js:2777` sends support
// mail to `getEnv(["SUPPORT_TO_EMAIL", "CONTACT_TO_EMAIL"])` and nothing else,
// so accepting `SUPPORT_EMAIL` would let `--send` succeed while the
// application still cannot route support mail. A configuration test that
// passes on a configuration the application rejects is the defect, not the
// kindness. Codex caught it on PR #299, in the same revision whose
// documentation said nothing in the runtime reads those names.
//
// The legacy values are still READ, only to say so in the failure message,
// which helps the operator mid-rotation without reporting success.
const to = env.SUPPORT_TO_EMAIL || env.CONTACT_TO_EMAIL;
const legacyOnly = !to && (env.SUPPORT_EMAIL || env.CONTACT_EMAIL);

console.log("Email test readiness:");
console.log(`- RESEND_API_KEY: ${apiKey ? "configured" : "missing"}`);
console.log(`- RESEND_FROM_EMAIL: ${from ? "configured" : "missing"}`);
console.log(`- SUPPORT_TO_EMAIL/CONTACT_TO_EMAIL: ${to ? "configured" : "missing"}`);

if (!send) {
  console.log("Dry run only. Use `pnpm run test:email -- --send` to send a real provider test email.");
  process.exit(0);
}

if (!apiKey || !from || !to) {
  console.error("Cannot send test email until RESEND_API_KEY, RESEND_FROM_EMAIL, and SUPPORT_TO_EMAIL or CONTACT_TO_EMAIL are configured.");
  if (legacyOnly) {
    console.error("SUPPORT_EMAIL or CONTACT_EMAIL is set and neither is read by anything: server.js sends support mail to");
    console.error("SUPPORT_TO_EMAIL or CONTACT_TO_EMAIL only. Rename the variable rather than adding a second one.");
  }
  process.exit(1);
}

const correlationId = randomUUID();
const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to: [to],
    subject: `SONARA email configuration test (${correlationId})`,
    text: `This is a SONARA email configuration test.\nReference ID: ${correlationId}`,
  }),
});

if (!response.ok) {
  console.error("Resend test email failed.", { status: response.status, correlationId });
  process.exit(1);
}

console.log(`Resend test email accepted. Reference ID: ${correlationId}`);
