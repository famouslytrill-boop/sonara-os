import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const registeredSymbol = String.fromCharCode(174);
const trademarkSymbol = String.fromCharCode(8482);

async function loadModule(modulePath) {
  const mod = await import(modulePath);
  return typeof mod.default === "object" && mod.default !== null ? { ...mod.default, ...mod } : mod;
}

const { hasBrandPermission } = await loadModule("../config/brandPermissions.ts");
const { brandSystem } = await loadModule("../config/brandSystem.ts");
const { getPricingTier } = await loadModule("../config/pricing.ts");
const { calculateActivationState } = await loadModule("../lib/sonara/activation/activationEngine.ts");
const { calculateFounderKpis } = await loadModule("../lib/sonara/analytics/kpiEngine.ts");
const { buildArrangementCore } = await loadModule("../lib/sonara/arrangement/arrangementCoreEngine.ts");
const { evaluateAutonomyClaim, getAutonomyChecks } = await loadModule("../lib/sonara/autonomy/autonomyEngine.ts");
const { getAIProvider } = await loadModule("../lib/sonara/ai/providerConfig.ts");
const { hasEntitlement } = await loadModule("../lib/sonara/billing/entitlements.ts");
const { getUpgradeNudge } = await loadModule("../lib/sonara/conversion/conversionEngine.ts");
const { getSliderRecommendation } = await loadModule("../lib/sonara/generation/sliderRecommendations.ts");
const { genreFamilies, getGenreUniverseGuidance } = await loadModule("../lib/sonara/genre/genreUniverseEngine.ts");
const { compareGenerations, createGenerationSnapshot, regenerateFromSameData, restoreGeneration } = await loadModule("../lib/sonara/history/generationHistoryEngine.ts");
const { createMemoryRecord, prepareMemoryForStorage } = await loadModule("../lib/sonara/memory/vectorMemoryEngine.ts");
const { getVectorMemoryProvider } = await loadModule("../lib/sonara/memory/vectorProvider.ts");
const { getPromptDetailLevel } = await loadModule("../lib/sonara/prompts/promptLengthEngine.ts");
const { getRetentionInsight } = await loadModule("../lib/sonara/retention/retentionEngine.ts");
const { calculateRuntimeThreshold, formatRuntime } = await loadModule("../lib/sonara/runtime/runtimeThresholdEngine.ts");
const { createSoundDiscoveryMetadataRecord } = await loadModule("../lib/sonara/soundDiscovery/discoveryWorkflow.ts");
const { classifySoundLicense } = await loadModule("../lib/sonara/soundDiscovery/licenseClassifier.ts");
const { buildSoundPack } = await loadModule("../lib/sonara/sound/packBuilder.ts");
const { canRedistributeRawSample, normalizeSoundAsset } = await loadModule("../lib/sonara/sound/licenseRules.ts");
const { evaluateStoreProductReadiness } = await loadModule("../lib/sonara/store/storeReadinessEngine.ts");
const { fallbackReleaseAnalysis } = await loadModule("../lib/sonara-core.ts");
const { getSupabasePublicConfig, isSupabaseConfigured } = await loadModule("../lib/supabase.ts");
const { blocksUnsafeBiometricStorage, getPasskeyReadiness } = await loadModule("../lib/sonara/auth/passkeyReadiness.ts");
const { analyzeAuthenticWriting } = await loadModule("../lib/sonara/writing/authenticWriterEngine.ts");
const { containsProfanity, defaultExplicitnessMode, explicitnessAllowsProfanity } = await loadModule("../lib/sonara/writing/explicitLanguagePolicy.ts");
const { analyzeLyricStructure } = await loadModule("../lib/sonara/writing/lyricStructureEngine.ts");
const { prepareBrandedExport } = await loadModule("../utils/prepareBrandedExport.ts");
const { replaceRestrictedTrademarkSymbols, validateTrademarkUsage } = await loadModule("../utils/validateTrademarkUsage.ts");
const { POST: createCheckout } = await loadModule("../app/api/stripe/checkout/route.ts");

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

test("brand governance validates trademark usage and permissions", () => {
  const restricted = `SONARA OS${registeredSymbol}`;

  assert.equal(validateTrademarkUsage(restricted).isValid, false);
  assert.equal(validateTrademarkUsage(`SONARA OS${trademarkSymbol}`).isValid, true);
  assert.equal(validateTrademarkUsage(replaceRestrictedTrademarkSymbols(restricted)).isValid, true);

  const exportResult = prepareBrandedExport(`Launch notes for ${restricted}`);
  assert.equal(exportResult.validation.isValid, true);
  assert.equal(exportResult.content.includes(registeredSymbol), false);

  const footerOnce = prepareBrandedExport(`Ready\n\n${brandSystem.legal.footer}`);
  assert.equal(footerOnce.content.split(brandSystem.legal.footer).length - 1, 1);
  assert.equal(prepareBrandedExport("Ready").content.split(brandSystem.legal.footer).length - 1, 1);

  assert.equal(hasBrandPermission("canEditBrandSystem", "owner"), true);
  assert.equal(hasBrandPermission("canEditBrandSystem", "admin"), true);
  assert.equal(hasBrandPermission("canEditBrandSystem", "viewer"), false);
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

test("genre universe and arrangement core support all-genre launch guidance", () => {
  assert.ok(genreFamilies.length >= 12);
  const genre = getGenreUniverseGuidance({ genreFamily: "afrobeats", mood: "warm bounce" });
  assert.equal(genre.genreFamily, "afrobeats");
  assert.ok(genre.rhythmLanguage.length);

  const arrangement = buildArrangementCore({ genreFamily: "pop", runtimeTargetSeconds: 165 });
  assert.match(arrangement.introStrategy, /signature|establish/i);
  assert.match(arrangement.hookStrategy, /hook/i);
  assert.match(arrangement.outroStrategy, /Exit/i);
});

test("lyric structure and explicit language controls are deterministic", () => {
  assert.equal(defaultExplicitnessMode, "radio_safe");
  assert.equal(explicitnessAllowsProfanity("explicit"), true);
  assert.equal(containsProfanity("this has shit in it"), true);

  const short = analyzeLyricStructure({ rawLyrics: "one line only", explicitnessMode: "radio_safe" });
  assert.ok(short.missingPieces.length > 0);
  assert.ok(short.sectionPlan.length > 0);

  const explicit = analyzeLyricStructure({ rawLyrics: "I said shit twice\nI said shit twice", explicitnessMode: "explicit" });
  assert.equal(explicit.warnings.length, 1);

  const clean = analyzeLyricStructure({ rawLyrics: "I said shit twice", explicitnessMode: "clean" });
  assert.match(clean.warnings.join(" "), /Clean|radio-safe/i);
});

test("generation history supports snapshots, same-data regeneration, restore, and comparison", () => {
  const snapshot = createGenerationSnapshot({
    engineName: "lyric_structure",
    inputData: { rawLyrics: "line" },
    settingsSnapshot: { explicitnessMode: "radio_safe" },
    outputData: { mode: "draft" },
    isSelected: true,
  });
  const regenerated = regenerateFromSameData(snapshot);
  assert.deepEqual(regenerated.inputData, snapshot.inputData);
  assert.deepEqual(regenerated.settingsSnapshot, snapshot.settingsSnapshot);
  assert.equal(restoreGeneration([snapshot, regenerated])?.id, snapshot.id);
  assert.deepEqual(compareGenerations(snapshot, { ...regenerated, outputData: { mode: "final" } }).differences, ["mode"]);
});

test("passkey readiness warns safely and blocks unsafe biometric storage claims", () => {
  const readiness = getPasskeyReadiness();
  assert.equal(readiness.manualSetupNeeded, true);
  assert.equal(readiness.passkeySupported, false);
  assert.equal(blocksUnsafeBiometricStorage(["biometric", " database"].join("")), true);
});

test("sound discovery classifier and redistribution rules block unsafe exports", () => {
  assert.equal(classifySoundLicense("CC0").redistributionCategory, "redistributable");
  assert.equal(classifySoundLicense("CC BY").exportStatus, "requires_attribution");
  assert.equal(classifySoundLicense("CC BY-NC").commercialUseAllowed, false);
  assert.equal(classifySoundLicense("unknown").exportStatus, "blocked");
  assert.equal(classifySoundLicense("music use only").redistributionAllowed, false);
  assert.equal(classifySoundLicense("user_owned", { userAttestedOwnership: true }).exportStatus, "approved");

  const metadata = createSoundDiscoveryMetadataRecord({
    id: "asset-meta",
    name: "Open texture metadata",
    sourceId: "openverse",
    license: "unknown",
  });
  assert.equal(metadata.fileDownloaded, false);
  assert.equal(metadata.classification.exportStatus, "blocked");

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

test("vector memory is optional and stores records without embeddings", () => {
  delete process.env.SONARA_EMBEDDING_PROVIDER;
  delete process.env.OPENAI_API_KEY;

  assert.equal(getVectorMemoryProvider(), "supabase_pgvector");
  const record = createMemoryRecord({ kind: "project", title: "Project Alpha", content: "release plan notes" });
  assert.equal(record.embedding, undefined);
  assert.equal(prepareMemoryForStorage(record).status, "not_configured");
});

test("runtime, prompt length, and slider engines run without OpenAI", () => {
  delete process.env.SONARA_AI_PROVIDER;
  delete process.env.OPENAI_API_KEY;

  assert.equal(getAIProvider(), "local_rules");
  assert.equal(formatRuntime(165), "2:45");

  const socialClip = calculateRuntimeThreshold({
    projectType: "social_clip",
    platformGoal: "social_short",
    commercialLane: "social_first",
    genreFamily: "pop",
  });
  assert.ok(socialClip.maxSeconds <= 60);

  const standard = calculateRuntimeThreshold({
    projectType: "single",
    platformGoal: "streaming",
    commercialLane: "mainstream",
    genreFamily: "pop",
    complexity: "standard",
  });
  const cinematic = calculateRuntimeThreshold({
    projectType: "single",
    platformGoal: "streaming",
    commercialLane: "cinematic",
    genreFamily: "cinematic",
    complexity: "cinematic",
  });
  assert.ok(cinematic.idealSeconds > standard.idealSeconds);

  assert.equal(getPromptDetailLevel({ situation: "suno_style" }).mode, "long");
  assert.equal(getPromptDetailLevel({ situation: "video_prompt" }).mode, "ultra");
  assert.equal(getPromptDetailLevel({ situation: "social_clip" }).mode, "standard");
  assert.equal(getPromptDetailLevel({ situation: "social_clip", userRequestedMode: "short" }).mode, "short");

  const detailed = getPromptDetailLevel({ situation: "streaming_metadata", needsRuntimeTarget: true, needsSliderSettings: true });
  assert.ok(detailed.allowedSections.includes("runtime target"));
  assert.ok(detailed.allowedSections.includes("external generator settings"));

  const sliders = getSliderRecommendation({ genreFamily: "pop", useCase: "radio_hook" });
  assert.equal(typeof sliders.weirdness, "number");
  assert.ok(sliders.notes.length > 0);
});

test("authentic writer returns reporting questions and avoids fake biography dumping", () => {
  const minimal = analyzeAuthenticWriting({ text: "one line" });
  assert.ok(minimal.reportingQuestions.length > 0);
  assert.ok(minimal.requiredDetails.length > 0);
  assert.ok(minimal.avoidList.includes("fake biography dumping"));
});

test("autonomy, activation, conversion, retention, founder, store, and billing rules are safe", async () => {
  const checks = getAutonomyChecks();
  assert.ok(checks.length > 0);
  assert.equal(evaluateAutonomyClaim(["self", "-aware"].join("")).requiresHumanApproval, true);

  const activation = calculateActivationState({ create_first_project: true });
  assert.ok(activation.score > 0);
  assert.ok(activation.nextBestStep);

  const nudge = getUpgradeNudge("free", "full_bundle_exports");
  assert.equal(nudge.allowed, false);
  assert.equal(nudge.recommendedTier, "pro");

  const retention = getRetentionInsight(["created_project_no_export"]);
  assert.ok(retention.riskScore > 0);

  const founder = calculateFounderKpis({ projectsCreated: 1, exportsCreated: 1 });
  assert.ok(founder.launchReadinessScore > 0);

  const blockedProduct = evaluateStoreProductReadiness({
    title: "Vault Stack Export",
    description: "Rights-sensitive export",
    price: 9,
    rightsClassification: "unknown",
    exportBundleExists: true,
    hasBlockedSoundAssets: true,
  });
  assert.equal(blockedProduct.canPublish, false);

  assert.equal(hasEntitlement("free", "full_bundle_exports"), false);
  assert.equal(hasEntitlement("creator", "runtime_target_engine"), true);
  assert.equal(hasEntitlement("pro", "full_bundle_exports"), true);
  assert.equal(hasEntitlement("label", "brand_governance"), true);
  assert.equal(getPricingTier("invalid-tier"), undefined);

  const response = await createCheckout(
    new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      body: JSON.stringify({ tierId: "invalid-tier" }),
      headers: { "Content-Type": "application/json" },
    }),
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "invalid_tier");
});

test("malformed Supabase placeholders do not count as configured", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "pending";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder";
  assert.equal(isSupabaseConfigured(), false);
  assert.equal(getSupabasePublicConfig(), null);

  if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;

  if (previousAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
});

test("generated local-rules analysis includes launch output systems", () => {
  const analysis = fallbackReleaseAnalysis({
    songTitle: "Example Song",
    creatorName: "Demo Artist",
    notes: "Genre family: pop\n\nA focused release with hook, mood, audience, cover art, mix, master, lyrics, and rollout context.\n\nUser-written lyrics:\nI kept the light on\nStill walked out in the rain",
  });

  assert.ok(analysis.runtimeTarget.idealSeconds);
  assert.ok(analysis.promptLength.targetIdealCharacters);
  assert.ok(analysis.sliderRecommendations.notes.length);
  assert.ok(analysis.genreUniverse.label);
  assert.ok(analysis.arrangementCore.hookStrategy);
  assert.ok(analysis.lyricStructure.sectionPlan.length);
  assert.ok(analysis.soundIdentity.signatureElements.length);
  assert.match(analysis.longPrompt, /EXTERNAL GENERATOR SETTINGS/);
});

test("deployment config is valid and cron route exists", () => {
  const vercelConfig = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
  assert.deepEqual(vercelConfig.crons, [
    {
      path: "/api/cron/sonara-maintenance",
      schedule: "0 10 * * 1",
    },
  ]);
  assert.ok(statSync(join(root, "app", "api", "cron", "sonara-maintenance", "route.ts")).isFile());
});
