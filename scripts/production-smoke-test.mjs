import { existsSync } from "node:fs";
import { join } from "node:path";

const requiredRoutes = [
  "app/page.tsx",
  "app/contact/page.tsx",
  "app/support/page.tsx",
  "app/help/page.tsx",
  "app/feedback/page.tsx",
  "app/pricing/page.tsx",
  "app/legal/terms/page.tsx",
  "app/legal/privacy/page.tsx",
  "app/legal/refund-policy/page.tsx",
  "app/trust/page.tsx",
  "app/open-source/page.tsx",
  "app/research-lab/open-source/page.tsx",
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
