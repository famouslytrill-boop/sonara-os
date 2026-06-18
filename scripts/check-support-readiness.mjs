import { exists, failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const fallback = "Request received. Email notification is not configured yet.";

const requiredFiles = [
  "packages/web/src/lib/support/email-readiness.ts",
  "packages/web/src/lib/support/support-email.ts",
  "packages/web/src/lib/support/support-storage.ts",
  "packages/web/src/components/support/ContactForm.tsx",
  "packages/web/src/components/support/EmailConfigurationNotice.tsx",
  "api/contact.js",
  "api/admin/contact-requests.js",
  "docs/email/CLOUDFLARE_EMAIL_ROUTING.md",
  "docs/email/OUTBOUND_EMAIL_PROVIDER.md",
  "docs/email/SUPPORT_EMAIL_ROUTING_CHECKLIST.md"
];

for (const filePath of requiredFiles) {
  if (!exists(filePath)) {
    issues.push(`Missing support readiness artifact: ${filePath}`);
  }
}

const supportEmail = exists("packages/web/src/lib/support/support-email.ts")
  ? read("packages/web/src/lib/support/support-email.ts")
  : "";
if (!supportEmail.includes(fallback)) {
  issues.push("support-email helper missing required fallback message.");
}
for (const forbidden of ["passwords", "card numbers", "bank", "API keys", "private keys"]) {
  const docs = [
    "docs/email/SUPPORT_EMAIL_ROUTING_CHECKLIST.md",
    "packages/web/src/app/beta-launch/pages.ts"
  ]
    .filter((filePath) => exists(filePath))
    .map((filePath) => read(filePath))
    .join("\n");
  if (!docs.toLowerCase().includes(forbidden.toLowerCase())) {
    issues.push(`Support docs/pages should warn against ${forbidden}.`);
  }
}

const cloudflare = exists("docs/email/CLOUDFLARE_EMAIL_ROUTING.md")
  ? read("docs/email/CLOUDFLARE_EMAIL_ROUTING.md")
  : "";
for (const expected of ["MX", "SPF", "DKIM", "DMARC", "Destination mailbox", "inbound"]) {
  if (!cloudflare.includes(expected)) {
    issues.push(`Cloudflare email docs missing ${expected}.`);
  }
}

failIfIssues("Support readiness check", issues);
