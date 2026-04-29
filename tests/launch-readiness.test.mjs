import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const registeredSymbol = String.fromCharCode(174);

async function loadModule(modulePath) {
  const mod = await import(modulePath);
  return typeof mod.default === "object" && mod.default !== null ? { ...mod.default, ...mod } : mod;
}

const { hasBrandPermission } = await loadModule("../config/brandPermissions.ts");
const { getAIProvider } = await loadModule("../lib/sonara/ai/providerConfig.ts");
const { getSliderRecommendation } = await loadModule("../lib/sonara/generation/sliderRecommendations.ts");
const { getPromptDetailLevel } = await loadModule("../lib/sonara/prompts/promptLengthEngine.ts");
const { calculateRuntimeThreshold } = await loadModule("../lib/sonara/runtime/runtimeThresholdEngine.ts");
const { buildSoundPack } = await loadModule("../lib/sonara/sound/packBuilder.ts");
const { canRedistributeRawSample, normalizeSoundAsset } = await loadModule("../lib/sonara/sound/licenseRules.ts");
const { fallbackReleaseAnalysis } = await loadModule("../lib/sonara-core.ts");
const { prepareBrandedExport } = await loadModule("../utils/prepareBrandedExport.ts");
const { replaceRestrictedTrademarkSymbols, validateTrademarkUsage } = await loadModule("../utils/validateTrademarkUsage.ts");

function sourceFiles(dir) {
  const ignored = new Set([".git", ".next", "node_modules"]);
  const results = [];

  for (const entry of readdirSync(dir)) {
    if (ignored.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      results.push(...sourceFiles(fullPath));
    } else if (!entry.endsWith(".png") && !entry.endsWith(".zip") && entry !== "package-lock.json" && entry !== "tsconfig.tsbuildinfo") {
      results.push(fullPath);
    }
  }

  return results;
}

function soundAsset(overrides = {}) {
  return {
    id: "asset-1",
    title: "Vault Demo Kit",
    license: "CC-BY",
    redistributionCategory: "redistributable",
    commercialUseAllowed: true,
    redistributionAllowed: true,
    attributionRequired: false,
    sourceUrl: "https://example.com/source",
    creator: "Demo Artist",
    exportStatus: "approved",
    ...overrides,
  };
}

test("trademark validator blocks registered SONARA marks and export helper cleans them", () => {
  const restricted = `SONARA OS${registeredSymbol}`;

  assert.equal(validateTrademarkUsage(restricted).isValid, false);
  assert.equal(validateTrademarkUsage(replaceRestrictedTrademarkSymbols(restricted)).isValid, true);

  const exportResult = prepareBrandedExport(`Launch notes for ${restricted}`);
  assert.equal(exportResult.validation.isValid, true);
  assert.equal(exportResult.content.includes(registeredSymbol), false);
  assert.match(exportResult.content, /SONARA Industries/);
});

test("brand permissions keep trademark edits owner-only", () => {
  assert.equal(hasBrandPermission("canChangeTrademarkLanguage", "owner"), true);
  assert.equal(hasBrandPermission("canChangeTrademarkLanguage", "admin"), false);
  assert.equal(hasBrandPermission("canExportBrandAssets", "creator"), true);
});

test("sound redistribution rules block unsafe raw sample exports", () => {
  assert.equal(canRedistributeRawSample(soundAsset({ redistributionCategory: "unknown_blocked" })), false);
  assert.equal(canRedistributeRawSample(soundAsset({ redistributionCategory: "music_use_only" })), false);

  const attributionAsset = normalizeSoundAsset(
    soundAsset({
      redistributionCategory: "attribution_required",
      attributionRequired: true,
      redistributionAllowed: false,
      exportStatus: "blocked",
    }),
  );

  assert.equal(attributionAsset.exportStatus, "requires_attribution");
  assert.equal(canRedistributeRawSample(attributionAsset), true);
  assert.match(buildSoundPack([attributionAsset]).attributionSheet[0], /redistributionCategory: attribution_required/);
});

test("runtime, prompt length, and slider engines run without OpenAI", () => {
  delete process.env.SONARA_AI_PROVIDER;
  delete process.env.OPENAI_API_KEY;

  assert.equal(getAIProvider(), "local_rules");

  const runtime = calculateRuntimeThreshold({
    projectType: "single",
    platformGoal: "streaming",
    commercialLane: "mainstream",
    genreFamily: "pop",
  });
  assert.ok(runtime.idealSeconds > runtime.minSeconds);
  assert.ok(runtime.hardLimitSeconds >= runtime.warningSeconds);

  const promptLength = getPromptDetailLevel({
    situation: "song_generation",
    platformTarget: "suno",
    needsRuntimeTarget: true,
    needsSliderSettings: true,
  });
  assert.equal(promptLength.mode, "long");
  assert.ok(promptLength.allowedSections.includes("runtime target"));
  assert.ok(promptLength.allowedSections.includes("external generator settings"));

  const sliders = getSliderRecommendation({ genreFamily: "pop", useCase: "radio_hook" });
  assert.equal(typeof sliders.weirdness, "number");
  assert.equal(typeof sliders.styleInfluence, "number");
  assert.equal(sliders.audioInfluence, null);
  assert.ok(["off", "light", "balanced", "strong"].includes(sliders.autoInfluence));
  assert.ok(sliders.notes.length > 0);
});

test("generated local-rules analysis includes launch output systems", () => {
  const analysis = fallbackReleaseAnalysis({
    songTitle: "Example Song",
    creatorName: "Demo Artist",
    notes: "A focused release with hook, mood, audience, cover art, and rollout context.",
  });

  assert.ok(analysis.runtimeTarget.idealSeconds);
  assert.ok(analysis.promptLength.targetIdealCharacters);
  assert.ok(analysis.sliderRecommendations.notes.length);
  assert.match(analysis.longPrompt, /EXTERNAL GENERATOR SETTINGS/);
});

test("public source and docs avoid blocked private names and registered SONARA marks", () => {
  const blockedNames = [
    ["Ta", "sha"],
    ["Na", "ta", "sha"],
    ["Ta", "sha", " ", "Keys"],
    ["Na", "ta", "sha", " ", "Keys"],
    ["Cold", " ", "Cabin"],
    ["Code", " ", "Cabin"],
  ].map((parts) => new RegExp(parts.join(""), "i"));
  const registeredSonara = new RegExp(`SONARA[^\\n]{0,40}${registeredSymbol}`);
  const publicRoots = ["app", "components", "config", "docs", "lib", "public", "supabase", "utils"];

  for (const publicRoot of publicRoots) {
    for (const file of sourceFiles(join(root, publicRoot))) {
      const content = readFileSync(file, "utf8");
      for (const pattern of blockedNames) {
        assert.doesNotMatch(content, pattern, `${file} contains blocked private name ${pattern}`);
      }
      assert.doesNotMatch(content, registeredSonara, `${file} contains a registered SONARA mark`);
    }
  }
});
