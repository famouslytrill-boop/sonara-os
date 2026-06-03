import { existsSync } from "node:fs";
import { join } from "node:path";

const requiredRoutes = [
  "app/page.tsx",
  "app/contact/page.tsx",
  "app/support/page.tsx",
  "app/help/page.tsx",
  "app/feedback/page.tsx",
  "app/pricing/page.tsx",
  "app/status/page.tsx",
  "app/docs/page.tsx",
  "app/api-webhooks/page.tsx",
  "app/integrations/page.tsx",
  "app/changelog/page.tsx",
  "app/login/page.tsx",
  "app/signup/page.tsx",
  "app/auth/callback/route.ts",
  "app/logout/route.ts",
  "app/legal/page.tsx",
  "app/legal/terms/page.tsx",
  "app/legal/privacy/page.tsx",
  "app/legal/refund-policy/page.tsx",
  "app/legal/acceptable-use/page.tsx",
  "app/legal/cookie-policy/page.tsx",
  "app/legal/accessibility/page.tsx",
  "app/legal/security/page.tsx",
  "app/legal/dpa/page.tsx",
  "app/trust/page.tsx",
  "app/research-lab/page.tsx",
  "app/open-source/page.tsx",
  "app/research-lab/open-source/page.tsx",
  "app/research-lab/github-radar/page.tsx",
  "app/research-lab/github-radar/high-value/page.tsx",
  "app/research-lab/github-radar/research-only/page.tsx",
  "app/research-lab/github-radar/blocked/page.tsx",
  "app/research-lab/github-radar/categories/page.tsx",
  "app/business-builder/page.tsx",
  "app/creator-studio/page.tsx",
  "app/growth-studio/page.tsx",
  "app/os/page.tsx",
  "app/settings/page.tsx",
  "app/customers/page.tsx",
  "app/bookings/page.tsx",
  "app/payments/page.tsx",
  "app/files/page.tsx",
  "app/reviews/page.tsx",
  "app/campaigns/page.tsx",
  "app/research/page.tsx",
  "app/app/dashboard/page.tsx",
  "app/app/customers/page.tsx",
  "app/app/bookings/page.tsx",
  "app/app/payments/page.tsx",
  "app/app/files/page.tsx",
  "app/app/reviews/page.tsx",
  "app/app/campaigns/page.tsx",
  "app/app/research/page.tsx",
];

const missing = requiredRoutes.filter((route) => !existsSync(join(process.cwd(), route)));

if (missing.length) {
  console.error("Missing production smoke-test routes:");
  for (const route of missing) {
    console.error(`- ${route}`);
  }
  process.exit(1);
}

console.log("Production smoke route files exist.");
