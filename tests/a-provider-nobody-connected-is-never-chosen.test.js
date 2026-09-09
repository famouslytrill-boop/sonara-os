"use strict";

const assert = require("node:assert/strict");

const creator = require("../lib/creator-generation-provider-registry.cjs");
const growth = require("../lib/growth-studio-provider-registry.cjs");
const { generationFailureText } = require("../lib/sonara-plain-language.cjs");

const PROVIDERS = creator.CREATOR_GENERATION_PROVIDERS;
const REFERENCE_ONLY = PROVIDERS.filter((provider) => provider.adapterMode === "reference_only");
const SELECTABLE = PROVIDERS.filter((provider) => provider.adapterMode !== "reference_only");
const CAPABILITIES = [...new Set(PROVIDERS.flatMap((provider) => provider.capabilities || []))];

// A reference-only provider carries no `enabledEnv`, no `baseUrlEnv` and no
// `requiredEnv`. `getProviderReadiness` returns `configured: false` for it in
// every environment, so a job routed to one can never leave `setup_required` --
// and `setup_required` tells a customer to go and finish a setup that does not
// exist.
//
// ComfyUI, LTX-2, Wan 2.2, HunyuanVideo, CogVideoX, Stable Audio 3, AudioCraft,
// OpenVoice and GPT-SoVITS are all in that state deliberately. Several are
// blocked by licence rather than by effort: AudioCraft's published weights are
// CC-BY-NC 4.0, which no amount of engineering makes usable in a product sold on
// paid plans.
//
// Before the fix, 23 of 44 capabilities auto-selected one of them, `voice_cloning`
// and `voice_conversion` among them. That is the FORM_CAPABILITY_ORDER story in
// routes/creator-generation-routes.cjs repeating one layer down: the menu was
// filtered by what a provider *declares*, and a reference-only provider declares
// plenty.
describe("a provider nobody connected is never chosen", () => {
  it("has both kinds to compare, or this proves nothing", () => {
    assert.ok(REFERENCE_ONLY.length >= 5, `only ${REFERENCE_ONLY.length} reference-only providers; this check has gone blind`);
    assert.ok(SELECTABLE.length >= 3, `only ${SELECTABLE.length} selectable providers; this check has gone blind`);
    assert.ok(CAPABILITIES.length >= 20, `only ${CAPABILITIES.length} capabilities found`);
  });

  it("never reports one as configured, whatever the environment", () => {
    // The claim the rest of this file rests on. Checked against an environment
    // that sets every variable the registry knows about, so it cannot pass by
    // the environment simply being empty.
    const generous = {};
    for (const provider of PROVIDERS) {
      for (const name of [provider.enabledEnv, provider.baseUrlEnv, ...(provider.requiredEnv || [])]) {
        if (name) generous[name] = name.endsWith("_URL") ? "https://example.invalid" : "set";
      }
      if (provider.enabledEnv) generous[provider.enabledEnv] = "true";
    }
    for (const provider of REFERENCE_ONLY) {
      const readiness = creator.getProviderReadiness(provider, generous);
      assert.equal(readiness.configured, false, `${provider.key} reported configured, so a job could be queued against it`);
    }
  });

  it("chooses a reference-only provider for no capability at all", () => {
    const chosen = CAPABILITIES
      .map((capability) => ({ capability, result: creator.chooseProvider(capability, "auto", {}) }))
      .filter(({ result }) => result.ok && result.provider.adapterMode === "reference_only");
    assert.deepEqual(
      chosen.map(({ capability, result }) => `${capability} -> ${result.provider.key}`),
      [],
      "auto-selection landed on a provider that can never be configured"
    );
  });

  it("says a capability is unsupported rather than parking it on an unconnectable provider", () => {
    // The 23. Each must now refuse rather than create a job that waits forever.
    const orphans = CAPABILITIES.filter((capability) => !SELECTABLE.some((provider) => provider.capabilities.includes(capability)));
    assert.ok(orphans.length > 0, "no capability is reference-only anymore; this case is not being exercised");
    for (const capability of orphans) {
      const result = creator.chooseProvider(capability, "auto", {});
      assert.equal(result.ok, false, `${capability} still resolves to a provider`);
      assert.equal(result.code, "capability_not_supported");
    }
  });

  it("refuses one asked for by name instead of promising setup", () => {
    for (const provider of REFERENCE_ONLY) {
      const capability = (provider.capabilities || [])[0];
      assert.ok(capability, `${provider.key} declares no capability to ask for`);
      const result = creator.chooseProvider(capability, provider.key, {});
      assert.equal(result.ok, false, `${provider.key} was accepted by name`);
      assert.equal(result.code, "provider_not_connected");
    }
  });

  it("still chooses the real provider for the capabilities that have one", () => {
    // The other direction. A filter that refuses everything would pass every
    // assertion above and break the product.
    for (const [capability, expected] of [["text_to_speech", "elevenlabs"], ["text_to_video", "google_veo"], ["song_cover", "suno"]]) {
      const result = creator.chooseProvider(capability, "auto", {});
      assert.equal(result.ok, true, `${capability} no longer resolves to anything`);
      assert.equal(result.provider.key, expected);
    }
  });

  it("says both refusals in words a customer can act on", () => {
    for (const code of ["provider_not_connected", "capability_not_supported"]) {
      const text = generationFailureText(code);
      assert.doesNotMatch(text, /^[a-z0-9_]+$/, `${code} renders as a raw code`);
      assert.ok(text.length > 20, `${code} has no real sentence`);
    }
  });

  it("agrees with the growth-studio registry, which already did this", () => {
    // The two registries disagreeing is what let this through. If growth-studio
    // ever starts selecting reference-only providers, that is the same bug
    // arriving from the other side.
    const growthProviders = Object.values(growth).find((value) => Array.isArray(value)) || [];
    const growthCaps = [...new Set(growthProviders.flatMap((provider) => provider.capabilities || []))];
    assert.ok(growthCaps.length > 0, "no growth-studio capabilities found; this comparison has gone blind");
    for (const capability of growthCaps) {
      const result = growth.chooseGrowthProvider ? growth.chooseGrowthProvider(capability, "auto", {}) : null;
      if (result && result.ok) {
        assert.notEqual(result.provider.adapterMode, "reference_only", `growth-studio chose a reference-only provider for ${capability}`);
      }
    }
  });
});
