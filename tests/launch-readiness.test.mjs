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
const { brandSystem } = await loadModule("../config/brandSystem.ts");
const { getPricingTier } = await loadModule("../config/pricing.ts");
const { getAIProvider } = await loadModule("../lib/sonara/ai/providerConfig.ts");
const { hasEntitlement } = await loadModule("../lib/sonara/billing/entitlements.ts");
const { getSliderRecommendation } = await loadModule("../lib/sonara/generation/sliderRecommendations.ts");
const { getPromptDetailLevel } = await loadModule("../lib/sonara/prompts/promptLengthEngine.ts");
const { calculateRuntimeThreshold, formatRuntime } = await loadModule("../lib/sonara/runtime/runtimeThresholdEngine.ts");
const { buildSoundPack } = await loadModule("../lib/sonara/sound/packBuilder.ts");
const { canRedistributeRawSample, normalizeSoundAsset } = await loadModule("../lib/sonara/sound/licenseRules.ts");
const { fallbackReleaseAnalysis } = await loadModule("../lib/sonara-core.ts");
const { getSupabasePublicConfig, isSupabaseConfigured } = await loadModule("../lib/supabase.ts");
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

test("trademark validator blocks registered SONARA marks and export helper cleans them", () => {
  const restricted = `SONARA OS${registeredSymbol}`;

  assert.equal(validateTrademarkUsage(restricted).isValid, false);
  assert.equal(validateTrademarkUsage("SONARA OS™").isValid, true);
  assert.equal(validateTrademarkUsage(replaceRestrictedTrademarkSymbols(restricted)).isValid, true);

  const exportResult = prepareBrandedExport(`Launch notes for ${restricted}`);
  assert.equal(exportResult.validation.isValid, true);
  assert.equal(exportResult.content.includes(registeredSymbol), false);
  assert.match(exportResult.content, /SONARA Industries/);

  const footerOnce = prepareBrandedExport(`Ready\n\n${brandSystem.legal.footer}`);
  assert.equal(footerOnce.content.split(brandSystem.legal.footer).length - 1, 1);

  const footerAppended = prepareBrandedExport("Ready");
  assert.equal(footerAppended.content.split(brandSystem.legal.footer).length - 1, 1);
});

test("brand permissions keep governance edits role-bound", () => {
  assert.equal(hasBrandPermission("canEditBrandSystem", "owner"), true);
  assert.equal(hasBrandPermission("canEditBrandSystem", "admin"), true);
  assert.equal(hasBrandPermission("canEditBrandSystem", "viewer"), false);
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

test("runtime threshold engine keeps deterministic timing rules", () => {
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
});

test("prompt length engine chooses launch-appropriate prompt modes", () => {
  assert.equal(getPromptDetailLevel({ situation: "suno_style" }).mode, "long");
  assert.equal(getPromptDetailLevel({ situation: "video_prompt" }).mode, "ultra");
  assert.equal(getPromptDetailLevel({ situation: "social_clip" }).mode, "standard");
  assert.equal(getPromptDetailLevel({ situation: "social_clip", userRequestedMode: "short" }).mode, "short");

  const detailed = getPromptDetailLevel({
    situation: "streaming_metadata",
    needsRuntimeTarget: true,
    needsSliderSettings: true,
  });
  assert.ok(detailed.allowedSections.includes("runtime target"));
  assert.ok(detailed.allowedSections.includes("external generator settings"));
});

test("billing entitlements match SONARA OS tiers", async () => {
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

  if (previousUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
  }

  if (previousAnon === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
  }
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
