import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const registeredSymbol = String.fromCharCode(174);

const requiredFiles = [
  "package.json",
  "app/page.tsx",
  "app/create/page.tsx",
  "app/dashboard/page.tsx",
  "app/store/page.tsx",
  "app/pricing/page.tsx",
  "app/tutorial/page.tsx",
  "app/trust/page.tsx",
  "app/support/page.tsx",
  "app/founder/page.tsx",
  "app/api/cron/sonara-maintenance/route.ts",
  "app/api/stripe/checkout/route.ts",
  "app/api/stripe/webhook/route.ts",
  "components/RegisterServiceWorker.tsx",
  "components/PWAInstallPrompt.tsx",
  "components/sonara/GenreUniverseCard.tsx",
  "components/sonara/ArrangementCoreCard.tsx",
  "components/sonara/LyricStructureCard.tsx",
  "components/sonara/SoundDiscoveryCard.tsx",
  "components/sonara/AutonomyStatusCard.tsx",
  "config/brandSystem.ts",
  "config/pricing.ts",
  "lib/sonara/ai/providerConfig.ts",
  "lib/sonara/genre/genreUniverseEngine.ts",
  "lib/sonara/arrangement/arrangementCoreEngine.ts",
  "lib/sonara/writing/lyricStructureEngine.ts",
  "lib/sonara/writing/explicitLanguagePolicy.ts",
  "lib/sonara/history/generationHistoryEngine.ts",
  "lib/sonara/soundDiscovery/licenseClassifier.ts",
  "lib/sonara/memory/vectorMemoryEngine.ts",
  "public/manifest.webmanifest",
  "public/sw.js",
  "public/icons/icon-192.png",
  "public/icons/icon-512.png",
  "public/icons/maskable-icon-512.png",
  "supabase/migrations/003_sonara_subscriptions.sql",
  "supabase/migrations/004_sonara_vector_memory.sql",
  "supabase/migrations/005_sonara_sound_discovery.sql",
  "supabase/migrations/006_sonara_generation_history.sql",
  "docs/SYSTEM_SCAN_REPORT.md",
  "docs/FINAL_10_OUT_OF_10_AUDIT_CRITERIA.md",
  "docs/PASSKEY_WEBAUTHN_SECURITY_PLAN.md",
];

const ignored = new Set([".git", ".next", "node_modules", ".vercel"]);
const ignoredExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".ico"]);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name === ".env.local") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    if (entry.isFile()) {
      const extension = entry.name.includes(".") ? entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase() : "";
      if (!ignoredExtensions.has(extension)) files.push(fullPath);
    }
  }
  return files;
}

const missing = requiredFiles.filter((file) => !existsSync(join(root, file)));
const textFiles = walk(root);
const registeredSymbolFiles = textFiles.filter((file) => readFileSync(file, "utf8").includes(registeredSymbol));
const blockedPrivateNames = [
  ["Ta", "sha"],
  ["Na", "ta", "sha"],
  ["Ta", "sha", " ", "Keys"],
  ["Na", "ta", "sha", " ", "Keys"],
  ["Cold", " ", "Cabin"],
  ["Code", " ", "Cabin"],
].map((parts) => parts.join(""));
const blockedPrivateNameFiles = textFiles.filter((file) => blockedPrivateNames.some((name) => readFileSync(file, "utf8").includes(name)));

const manifest = JSON.parse(readFileSync(join(root, "public/manifest.webmanifest"), "utf8"));
const pwaValid =
  manifest.name === "SONARA OSâ„¢" &&
  manifest.short_name === "SONARA" &&
  manifest.start_url === "/dashboard" &&
  manifest.display === "standalone" &&
  manifest.orientation === "portrait-primary" &&
  manifest.background_color === "#08070B" &&
  manifest.theme_color === "#08070B" &&
  manifest.categories?.includes("music") &&
  manifest.icons.some((icon) => icon.src === "/icons/icon-192.png" && icon.sizes === "192x192") &&
  manifest.icons.some((icon) => icon.src === "/icons/icon-512.png" && icon.sizes === "512x512") &&
  manifest.icons.some((icon) => icon.src === "/icons/maskable-icon-512.png" && icon.purpose?.includes("maskable"));

const envExample = readFileSync(join(root, ".env.example"), "utf8");
const requiredEnvPlaceholders = [
  "SONARA_AI_PROVIDER=local_rules",
  ["SONARA_CRON", "_SECRET="].join(""),
  ["OPENAI", "_API_KEY="].join(""),
  "NEXT_PUBLIC_SUPABASE_URL=",
  ["SUPABASE_SERVICE", "_ROLE_KEY="].join(""),
  ["STRIPE", "_SECRET_KEY="].join(""),
  ["STRIPE_WEBHOOK", "_SECRET="].join(""),
  ["FREESOUND", "_API_KEY="].join(""),
  ["OPENVERSE", "_CLIENT_ID="].join(""),
  ["OPENVERSE_CLIENT", "_SECRET="].join(""),
];
const missingEnv = requiredEnvPlaceholders.filter((placeholder) => !envExample.includes(placeholder));

if (missing.length || registeredSymbolFiles.length || blockedPrivateNameFiles.length || !pwaValid || missingEnv.length) {
  console.error("SONARA infrastructure validation failed.");
  if (missing.length) console.error("Missing files:", missing);
  if (registeredSymbolFiles.length) console.error("Restricted symbol found in:", registeredSymbolFiles.map((file) => relative(root, file)));
  if (blockedPrivateNameFiles.length) console.error("Blocked private artist names found in:", blockedPrivateNameFiles.map((file) => relative(root, file)));
  if (!pwaValid) console.error("PWA manifest is incomplete.");
  if (missingEnv.length) console.error("Missing env placeholders:", missingEnv);
  process.exit(1);
}

console.log("SONARA infrastructure validation passed.");
