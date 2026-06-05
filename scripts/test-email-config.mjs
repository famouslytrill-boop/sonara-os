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
const to = env.SUPPORT_EMAIL || env.CONTACT_EMAIL;

console.log("Email test readiness:");
console.log(`- RESEND_API_KEY: ${apiKey ? "configured" : "missing"}`);
console.log(`- RESEND_FROM_EMAIL: ${from ? "configured" : "missing"}`);
console.log(`- SUPPORT_EMAIL/CONTACT_EMAIL: ${to ? "configured" : "missing"}`);

if (!send) {
  console.log("Dry run only. Use `pnpm run test:email -- --send` to send a real provider test email.");
  process.exit(0);
}

if (!apiKey || !from || !to) {
  console.error("Cannot send test email until RESEND_API_KEY, RESEND_FROM_EMAIL, and SUPPORT_EMAIL or CONTACT_EMAIL are configured.");
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
