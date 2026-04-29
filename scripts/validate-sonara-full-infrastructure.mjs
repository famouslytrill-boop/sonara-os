import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const registeredSymbol = String.fromCharCode(174);

const requiredFiles = [
  "frontend/types/sonaraBusinessPrinciples.ts",
  "frontend/config/sonara/businessPrinciples.ts",
  "frontend/config/sonara/circleOfCompetence.ts",
  "frontend/config/sonara/marginOfSafetyRules.ts",
  "frontend/config/sonara/productArchitecture.ts",
  "frontend/config/sonara/systemVisibility.ts",
  "frontend/config/brandSystem.ts",
  "frontend/config/brandPermissions.ts",
  "frontend/utils/validateTrademarkUsage.ts",
  "frontend/utils/prepareBrandedExport.ts",
  "frontend/components/BrandLegalFooter.tsx",
  "frontend/components/RegisterServiceWorker.tsx",
  "frontend/components/PWAInstallPrompt.tsx",
  "frontend/public/manifest.webmanifest",
  "frontend/public/sw.js",
  "frontend/vercel.json",
  "frontend/public/icons/icon-192.png",
  "frontend/public/icons/icon-512.png",
  "frontend/public/icons/maskable-icon-512.png",
  "frontend/public/icons/apple-touch-icon.png",
  "frontend/app/brand-system/page.tsx",
  "frontend/app/privacy/page.tsx",
  "frontend/app/terms/page.tsx",
  "frontend/app/contact/page.tsx",
  "frontend/app/offline/page.tsx",
  "frontend/app/api/sound-discovery/sync/route.ts",
  "frontend/lib/sonara/coreSystems.ts",
  "frontend/lib/sonara/ai/providerConfig.ts",
  "frontend/lib/sonara/generation/sliderRecommendations.ts",
  "frontend/lib/sonara/prompts/promptLengthTypes.ts",
  "frontend/lib/sonara/prompts/promptLengthEngine.ts",
  "frontend/lib/sonara/prompts/longPromptBuilder.ts",
  "frontend/lib/sonara/runtime/runtimeTypes.ts",
  "frontend/lib/sonara/runtime/runtimeThresholdEngine.ts",
  "frontend/lib/sonara/runtime/audioRuntimeAnalysis.ts",
  "frontend/lib/sonara/sound/types.ts",
  "frontend/lib/sonara/sound/sourceRegistry.ts",
  "frontend/lib/sonara/sound/licenseRules.ts",
  "frontend/lib/sonara/sound/redistributionRules.ts",
  "frontend/lib/sonara/sound/genreSoundTargets.ts",
  "frontend/lib/sonara/sound/sourceAdapters.ts",
  "frontend/lib/sonara/sound/autonomousSoundUpdater.ts",
  "frontend/lib/sonara/sound/packBuilder.ts",
  "frontend/lib/sonara/businessPrinciples/index.ts",
  "frontend/components/sonara-os/BusinessPrinciplesDashboard.tsx",
  "frontend/components/sonara/SliderRecommendationCard.tsx",
  "frontend/components/sonara/RuntimeThresholdCard.tsx",
  "frontend/components/sonara/PromptLengthCard.tsx",
  "frontend/app/dashboard/page.tsx",
  "frontend/app/api/sonara/generate/route.ts",
  "docs/sonara-full-infrastructure-package.md",
  "docs/sonara-business-principles-layer.md",
  "docs/sonara-business-principles-schema.md",
  "docs/RUNTIME_TARGET_THRESHOLD_ENGINE.md",
  "docs/PROMPT_LENGTH_ENGINE.md",
];

const excludedSegments = new Set(["node_modules", ".next", ".git", ".venv", "dist", "__pycache__", ".pytest_cache"]);
const excludedTextScanExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".ico"]);

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (excludedSegments.has(entry.name) || entry.name === ".env.local") continue;
    if (entry.isDirectory()) files.push(...walk(fullPath));
    if (entry.isFile() && !excludedTextScanExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

const missing = requiredFiles.filter((file) => !existsSync(join(root, file)));
const registeredSymbolFiles = walk(root).filter((file) => readFileSync(file, "utf8").includes(registeredSymbol));
const blockedPrivateNames = [
  "Ta" + "sh" + "a",
  "Na" + "ta" + "sh" + "a",
  "Ta" + "sh" + "a Keys",
  "Na" + "ta" + "sh" + "a Keys",
  "Co" + "ld Cabin",
  "Co" + "de Cabin",
];
const blockedPrivateNameFiles = walk(root).filter((file) => {
  const relativePath = relative(root, file).replaceAll("\\", "/");
  if (relativePath === "AGENTS.md" || relativePath === "scripts/validate-sonara-full-infrastructure.mjs") return false;
  const content = readFileSync(file, "utf8");
  return blockedPrivateNames.some((name) => content.includes(name));
});
const exportRoute = readFileSync(join(root, "frontend/app/api/sonara/export/route.ts"), "utf8");
const exportNoticeWired = exportRoute.includes("appendSonaraOperatingNotice") && exportRoute.includes("final-company-audit.json");
const brandedExportWired = exportRoute.includes("prepareBrandedExport") && exportRoute.includes("license-attribution-sheet.md");
const brandSystem = readFileSync(join(root, "frontend/config/brandSystem.ts"), "utf8");
const permissions = readFileSync(join(root, "frontend/config/brandPermissions.ts"), "utf8");
const soundTypes = readFileSync(join(root, "frontend/lib/sonara/sound/types.ts"), "utf8");
const soundRules = readFileSync(join(root, "frontend/lib/sonara/sound/redistributionRules.ts"), "utf8");
const manifest = JSON.parse(readFileSync(join(root, "frontend/public/manifest.webmanifest"), "utf8"));
const envExample = readFileSync(join(root, ".env.example"), "utf8");
const providerConfig = readFileSync(join(root, "frontend/lib/sonara/ai/providerConfig.ts"), "utf8");
const sliderRecommendations = readFileSync(join(root, "frontend/lib/sonara/generation/sliderRecommendations.ts"), "utf8");
const sliderCard = readFileSync(join(root, "frontend/components/sonara/SliderRecommendationCard.tsx"), "utf8");
const promptLengthEngine = readFileSync(join(root, "frontend/lib/sonara/prompts/promptLengthEngine.ts"), "utf8");
const longPromptBuilder = readFileSync(join(root, "frontend/lib/sonara/prompts/longPromptBuilder.ts"), "utf8");
const promptLengthCard = readFileSync(join(root, "frontend/components/sonara/PromptLengthCard.tsx"), "utf8");
const promptLengthDocs = readFileSync(join(root, "docs/PROMPT_LENGTH_ENGINE.md"), "utf8");
const runtimeEngine = readFileSync(join(root, "frontend/lib/sonara/runtime/runtimeThresholdEngine.ts"), "utf8");
const runtimeTypes = readFileSync(join(root, "frontend/lib/sonara/runtime/runtimeTypes.ts"), "utf8");
const runtimeCard = readFileSync(join(root, "frontend/components/sonara/RuntimeThresholdCard.tsx"), "utf8");
const runtimeDocs = readFileSync(join(root, "docs/RUNTIME_TARGET_THRESHOLD_ENGINE.md"), "utf8");
const sonaraCore = readFileSync(join(root, "frontend/lib/sonara-core.ts"), "utf8");
const generateRoute = readFileSync(join(root, "frontend/app/api/sonara/generate/route.ts"), "utf8");
const privacyPage = readFileSync(join(root, "frontend/app/privacy/page.tsx"), "utf8");
const termsPage = readFileSync(join(root, "frontend/app/terms/page.tsx"), "utf8");
const contactPage = readFileSync(join(root, "frontend/app/contact/page.tsx"), "utf8");
const requiredBrandMarks = ["SONARA Industries™", "SONARA Records™", "SONARA OS™", "SONARA Vault™", "SONARA Engine™", "SONARA Exchange™", "SONARA Labs™"];
const missingBrandMarks = requiredBrandMarks.filter((mark) => !brandSystem.includes(mark));
const requiredProviderModes = ["local_rules", "openai_byok", "ollama_local", "lmstudio_local"];
const missingProviderModes = requiredProviderModes.filter((mode) => !sonaraCore.includes(mode));
const requiredSoundCategories = [
  "redistributable",
  "music_use_only",
  "attribution_required",
  "non_commercial_only",
  "research_education_only",
  "user_owned",
  "commercial_license_required",
  "unknown_blocked",
];
const missingSoundCategories = requiredSoundCategories.filter((category) => !soundTypes.includes(category));
const pwaValid =
  manifest.name === "SONARA OS™" &&
  manifest.short_name === "SONARA" &&
  manifest.start_url === "/dashboard" &&
  manifest.display === "standalone" &&
  manifest.orientation === "portrait-primary" &&
  manifest.background_color === "#07070A" &&
  manifest.theme_color === "#07070A" &&
  manifest.categories?.includes("music") &&
  manifest.icons.some((icon) => icon.src === "/icons/icon-192.png" && icon.sizes === "192x192" && icon.type === "image/png") &&
  manifest.icons.some((icon) => icon.src === "/icons/icon-512.png" && icon.sizes === "512x512" && icon.type === "image/png") &&
  manifest.icons.some((icon) => icon.src === "/icons/maskable-icon-512.png" && icon.sizes === "512x512" && icon.type === "image/png" && icon.purpose.includes("maskable")) &&
  manifest.shortcuts?.some((shortcut) => shortcut.url === "/create?type=song") &&
  manifest.shortcuts?.some((shortcut) => shortcut.url === "/export");
const providerConfigValid =
  providerConfig.includes('DEFAULT_AI_PROVIDER: SonaraAIProvider = "local_rules"') &&
  providerConfig.includes("getAIProvider") &&
  providerConfig.includes("hasOpenAIKey");
const sliderRecommendationsValid =
  sliderRecommendations.includes("getSliderRecommendation") &&
  sliderRecommendations.includes("weirdness") &&
  sliderRecommendations.includes("styleInfluence") &&
  sliderRecommendations.includes("audioInfluence") &&
  sliderRecommendations.includes("autoInfluence") &&
  sonaraCore.includes("sliderRecommendations") &&
  sonaraCore.includes("externalGeneratorSettings") &&
  exportRoute.includes("external-generator-settings.md") &&
  sliderCard.includes("External Generator Settings");
const runtimeThresholdValid =
  runtimeTypes.includes("RuntimeThresholdInput") &&
  runtimeTypes.includes("RuntimeProjectType") &&
  runtimeEngine.includes("calculateRuntimeThreshold") &&
  runtimeEngine.includes("formatRuntime") &&
  runtimeEngine.includes("social_clip") &&
  runtimeEngine.includes("userRequestedSeconds") &&
  runtimeCard.includes("Runtime Target") &&
  runtimeDocs.includes("Default mode:") &&
  sonaraCore.includes("runtimeTarget") &&
  generateRoute.includes("runtimeTarget") &&
  exportRoute.includes("runtime-target-threshold.md") &&
  exportRoute.includes("RUNTIME TARGET THRESHOLD");
const promptLengthValid =
  promptLengthEngine.includes("getPromptDetailLevel") &&
  promptLengthEngine.includes("suno_style") &&
  promptLengthEngine.includes('video_prompt: "ultra"') &&
  promptLengthEngine.includes('social_clip: "standard"') &&
  longPromptBuilder.includes("buildLongPrompt") &&
  longPromptBuilder.includes("SONG FINGERPRINT") &&
  longPromptBuilder.includes("RUNTIME TARGET THRESHOLD") &&
  longPromptBuilder.includes("EXTERNAL GENERATOR SETTINGS") &&
  promptLengthCard.includes("Prompt Length") &&
  promptLengthDocs.includes("OpenAI may rewrite or explain prompts") &&
  sonaraCore.includes("promptLength") &&
  sonaraCore.includes("longPrompt") &&
  generateRoute.includes("promptLength") &&
  generateRoute.includes("longPrompt") &&
  exportRoute.includes("prompt-length-mode.md") &&
  exportRoute.includes("long-prompt.md") &&
  exportRoute.includes("PROMPT LENGTH MODE");
const legalPagesValid =
  privacyPage.includes("account details") &&
  privacyPage.includes("sound upload metadata") &&
  privacyPage.includes("support@sonaraindustries.com") &&
  termsPage.includes("streaming approval") &&
  termsPage.includes("rights clearance") &&
  termsPage.includes("fake streaming") &&
  contactPage.includes("support@sonaraindustries.com");
const permissionsValid =
  permissions.includes("canEditBrandSystem") &&
  permissions.includes('"admin"') &&
  permissions.includes('"owner"') &&
  !permissions.match(/canEditBrandSystem:[^\n]+viewer/);
const soundRulesValid =
  soundRules.includes('case "unknown_blocked"') &&
  soundRules.includes('case "research_education_only"') &&
  soundRules.includes('case "non_commercial_only"') &&
  soundRules.includes('case "music_use_only"') &&
  soundRules.includes('case "commercial_license_required"');

if (
  missing.length ||
  registeredSymbolFiles.length ||
  blockedPrivateNameFiles.length ||
  !exportNoticeWired ||
  !brandedExportWired ||
  missingBrandMarks.length ||
  missingProviderModes.length ||
  missingSoundCategories.length ||
  !pwaValid ||
  !providerConfigValid ||
  !sliderRecommendationsValid ||
  !runtimeThresholdValid ||
  !promptLengthValid ||
  !legalPagesValid ||
  !permissionsValid ||
  !soundRulesValid ||
  !envExample.includes("SONARA_CRON_SECRET=")
) {
  console.error("SONARA infrastructure validation failed.");
  if (missing.length) console.error("Missing files:", missing);
  if (registeredSymbolFiles.length) console.error("Restricted symbol found in:", registeredSymbolFiles.map((file) => relative(root, file)));
  if (blockedPrivateNameFiles.length) console.error("Blocked private artist ecosystem names found in:", blockedPrivateNameFiles.map((file) => relative(root, file)));
  if (!exportNoticeWired) console.error("Export governance notice or final audit asset is not wired.");
  if (!brandedExportWired) console.error("Branded export helper or license sheet is not wired.");
  if (missingBrandMarks.length) console.error("Missing brand marks:", missingBrandMarks);
  if (missingProviderModes.length) console.error("Missing provider modes:", missingProviderModes);
  if (missingSoundCategories.length) console.error("Missing sound redistribution categories:", missingSoundCategories);
  if (!pwaValid) console.error("PWA manifest is incomplete.");
  if (!providerConfigValid) console.error("Provider config is incomplete.");
  if (!sliderRecommendationsValid) console.error("Slider recommendation system is incomplete.");
  if (!runtimeThresholdValid) console.error("Runtime Target Threshold Engine is incomplete.");
  if (!promptLengthValid) console.error("Prompt Length Engine is incomplete.");
  if (!legalPagesValid) console.error("Legal/public pages are incomplete.");
  if (!permissionsValid) console.error("Brand permissions are incomplete.");
  if (!soundRulesValid) console.error("Sound redistribution rules are incomplete.");
  if (!envExample.includes("SONARA_CRON_SECRET=")) console.error("SONARA_CRON_SECRET is missing from .env.example.");
  process.exit(1);
}

console.log("SONARA infrastructure validation passed.");
