import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "lib/brand/brand-system.ts",
  "lib/brand/entities.ts",
  "lib/brand/colors.ts",
  "lib/brand/logo-registry.ts",
  "components/brand/LogoMark.tsx",
  "components/brand/BrandLogo.tsx",
  "components/brand/EntityLogo.tsx",
  "components/brand/AppIcon.tsx",
  "components/brand/BrandArchitecture.tsx",
  "public/brand/logos/parent-mark.svg",
  "public/brand/logos/creator-mark.svg",
  "public/brand/logos/business-mark.svg",
  "public/brand/logos/community-mark.svg",
  "public/brand/logos/launchpad-mark.svg",
  "public/manifest.webmanifest",
  "docs/BRAND_IDENTITY_SYSTEM.md",
  "docs/LOGO_USAGE_GUIDE.md",
  "docs/BRAND_IMPLEMENTATION_REPORT.md",
  "docs/BRAND_LEGAL_REVIEW_WARNING.md",
];

let failed = false;

for (const file of requiredFiles) {
  if (existsSync(join(root, file))) {
    console.log(`[OK] ${file}`);
  } else {
    failed = true;
    console.error(`[FAIL] missing ${file}`);
  }
}

const homepage = existsSync(join(root, "app/page.tsx")) ? readFileSync(join(root, "app/page.tsx"), "utf8") : "";
const unsafeClaims = [/trademark cleared/i, /official government partner/i, /guaranteed success/i, /AI will make you famous/i];
for (const pattern of unsafeClaims) {
  if (pattern.test(homepage)) {
    failed = true;
    console.error(`[FAIL] unsafe brand claim on homepage: ${pattern}`);
  }
}

const manifest = JSON.parse(readFileSync(join(root, "public/manifest.webmanifest"), "utf8"));
for (const icon of manifest.icons ?? []) {
  if (!existsSync(join(root, "public", icon.src.replace(/^\//, "")))) {
    failed = true;
    console.error(`[FAIL] missing manifest icon ${icon.src}`);
  }
}

if (!failed) {
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", "npm run test:brand"], { cwd: root, stdio: "inherit" })
      : spawnSync("npm", ["run", "test:brand"], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  console.error("Brand verification failed.");
  process.exit(1);
}

console.log("Brand verification passed.");
