import { z } from "zod";
import {
  getSliderRecommendation,
  type SliderGenreFamily,
  type SliderUseCase,
} from "./sonara/generation/sliderRecommendations";
import { buildArrangementCore } from "./sonara/arrangement/arrangementCoreEngine";
import { getGenreUniverseGuidance } from "./sonara/genre/genreUniverseEngine";
import { buildLongPrompt } from "./sonara/prompts/longPromptBuilder";
import { getPromptDetailLevel } from "./sonara/prompts/promptLengthEngine";
import type {
  PromptDetailLevel,
  PromptPlatformTarget,
  PromptSituation,
} from "./sonara/prompts/promptLengthTypes";
import { calculateRuntimeThreshold } from "./sonara/runtime/runtimeThresholdEngine";
import { buildSoundIdentity } from "./sonara/soundIdentity/soundIdentityEngine";
import { analyzeAuthenticWriting } from "./sonara/writing/authenticWriterEngine";
import { defaultExplicitnessMode } from "./sonara/writing/explicitLanguagePolicy";
import { analyzeLyricStructure } from "./sonara/writing/lyricStructureEngine";
import type {
  RuntimeCommercialLane,
  RuntimeComplexity,
  RuntimeGenreFamily,
  RuntimePlatformGoal,
  RuntimeProjectType,
} from "./sonara/runtime/runtimeTypes";

export const visibleNavigation = ["Home", "Create", "Library", "Export", "Settings"] as const;

export type VisibleNavigationItem = (typeof visibleNavigation)[number];

export const sonaraProviderOptions = [
  {
    id: "local_rules",
    label: "None / Local Rules",
    description: "No paid API key. SONARA uses deterministic templates for fingerprints, readiness, and release plans.",
  },
  {
    id: "openai_byok",
    label: "OpenAI BYOK",
    description: "Optional bring-your-own-key mode for strict JSON release intelligence through the OpenAI Responses API.",
  },
  {
    id: "ollama_local",
    label: "Ollama Local",
    description: "Optional local model mode using an OpenAI-compatible Ollama endpoint when one is running.",
  },
  {
    id: "lmstudio_local",
    label: "LM Studio Local",
    description: "Optional local model mode using an OpenAI-compatible LM Studio endpoint when one is running.",
  },
] as const;

export type SonaraProvider = (typeof sonaraProviderOptions)[number]["id"];

export const sonaraCoreSystems = [
  {
    system: "Song Fingerprint",
    name: "song-fingerprint.json",
    purpose: "Stable song identity, mood, palette, audience signal, and readiness metadata.",
  },
  {
    system: "Sound Discovery",
    name: "sound-discovery.md",
    purpose: "Template-based notes for sonic palette, listener moment, and discovery angles.",
  },
  {
    system: "Streaming Pack",
    name: "streaming-pack.md",
    purpose: "Release metadata, title treatment, credit reminders, and platform-prep checklist.",
  },
  {
    system: "Broadcast Kit",
    name: "broadcast-kit.md",
    purpose: "Concise talking points, creator positioning, and launch-room notes.",
  },
  {
    system: "Breath Control",
    name: "breath-control.txt",
    purpose: "Vocal/performance clarity checks for the hook, pacing, and delivery pressure.",
  },
  {
    system: "Export Bundle",
    name: "export-bundle-manifest.json",
    purpose: "Machine-readable manifest for the bundled SONARA release package.",
  },
] as const;

export const songInputSchema = z.object({
  songTitle: z.string().trim().min(1).max(120),
  creatorName: z.string().trim().max(120).default(""),
  notes: z.string().trim().min(1).max(2200),
});

export const sliderRecommendationSchema = z.object({
  weirdness: z.number().min(0).max(100),
  styleInfluence: z.number().min(0).max(100),
  audioInfluence: z.number().min(0).max(100).nullable(),
  autoInfluence: z.enum(["off", "light", "balanced", "strong"]),
  notes: z.array(z.string()),
});

export const runtimeTargetSchema = z.object({
  minSeconds: z.number(),
  idealSeconds: z.number(),
  maxSeconds: z.number(),
  warningSeconds: z.number(),
  hardLimitSeconds: z.number(),
  label: z.enum(["very_short", "short", "standard", "extended", "long_form", "too_long"]),
  notes: z.array(z.string()),
  arrangementGuidance: z.array(z.string()),
  platformGuidance: z.array(z.string()),
  commercialGuidance: z.array(z.string()),
});

export const promptLengthSchema = z.object({
  mode: z.enum(["short", "standard", "long", "ultra"]),
  targetMinCharacters: z.number(),
  targetIdealCharacters: z.number(),
  targetMaxCharacters: z.number(),
  allowedSections: z.array(z.string()),
  forbiddenBehaviors: z.array(z.string()),
  notes: z.array(z.string()),
});

const defaultAuthenticWriterGuidance = analyzeAuthenticWriting({ text: "", context: "SONARA Demo Release" });
const defaultGenreUniverseGuidance = getGenreUniverseGuidance();
const defaultArrangementCoreGuidance = buildArrangementCore();
const defaultLyricStructureGuidance = analyzeLyricStructure({ rawLyrics: "" });
const defaultSoundIdentityGuidance = buildSoundIdentity("");

export const authenticWriterSchema = z.object({
  authenticityScore: z.number().min(0).max(100),
  requiredDetails: z.array(z.string()),
  craftGuidance: z.array(z.string()),
  reportingQuestions: z.array(z.string()),
  vocalGuidance: z.array(z.string()),
  socialContextNotes: z.array(z.string()),
  avoidList: z.array(z.string()),
  revisionChecklist: z.array(z.string()),
});

export const genreUniverseSchema = z.object({
  genreFamily: z.string(),
  label: z.string(),
  arrangementPriorities: z.array(z.string()),
  rhythmLanguage: z.array(z.string()),
  harmonicLanguage: z.array(z.string()),
  drumLanguage: z.array(z.string()),
  vocalModes: z.array(z.string()),
  soundPalette: z.array(z.string()),
  runtimeBehavior: z.array(z.string()),
  exportNeeds: z.array(z.string()),
  avoidList: z.array(z.string()),
});

export const arrangementCoreSchema = z.object({
  introStrategy: z.string(),
  verseStrategy: z.string(),
  hookStrategy: z.string(),
  bridgeStrategy: z.string(),
  outroStrategy: z.string(),
  transitionNotes: z.array(z.string()),
  energyCurve: z.array(z.string()),
  vocalPlacement: z.array(z.string()),
  drumMovement: z.array(z.string()),
  arrangementRisks: z.array(z.string()),
  genreAuthenticityNotes: z.array(z.string()),
});

export const lyricStructureSchema = z.object({
  suggestedTitle: z.string().optional(),
  explicitnessMode: z.enum(["clean", "radio_safe", "mature", "explicit"]),
  suggestedStructure: z.string(),
  structureReason: z.string(),
  hookCandidates: z.array(z.string()),
  sectionPlan: z.array(
    z.object({
      sectionType: z.string(),
      label: z.string(),
      lines: z.array(z.string()),
      purpose: z.string(),
      energyLevel: z.string(),
      breathNotes: z.array(z.string()),
      performanceNotes: z.array(z.string()),
    }),
  ),
  missingPieces: z.array(z.string()),
  repetitionMap: z.array(z.string()),
  rhymeNotes: z.array(z.string()),
  cadenceNotes: z.array(z.string()),
  breathMarkers: z.array(z.string()),
  emotionalArc: z.array(z.string()),
  revisionChecklist: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const soundIdentitySchema = z.object({
  signatureElements: z.array(z.string()),
  differentiationChecks: z.array(z.string()),
  avoidList: z.array(z.string()),
});

export const externalGeneratorSettingsSchema = z.object({
  primaryGenre: z.string(),
  subgenre: z.string(),
  uniqueKey: z.string(),
  rhythmicFeel: z.string(),
  harmonicIdentity: z.string(),
  drumLanguage: z.string(),
  vocalMode: z.string(),
  genreAuthenticityRules: z.array(z.string()),
  emotionalFunction: z.string(),
  commercialLane: z.string(),
  rightsSafeInfluenceNotes: z.array(z.string()),
  antiRepetitionCheck: z.array(z.string()),
  prompt: z.string(),
  sliderRecommendations: sliderRecommendationSchema,
});

export const releaseAnalysisSchema = z.object({
  fingerprint: z.object({
    id: z.string(),
    identity: z.string(),
    mood: z.string(),
    audienceSignal: z.string(),
    sonicPalette: z.array(z.string()),
  }),
  readiness: z.object({
    score: z.number().min(0).max(100),
    launchState: z.enum(["idea", "demo", "ready", "hold"]),
    blockers: z.array(z.string()),
    nextChecks: z.array(z.string()),
  }),
  releasePlan: z.object({
    positioning: z.string(),
    hook: z.string(),
    rollout: z.array(z.string()),
    exportAssets: z.array(
      z.object({
        name: z.string(),
        purpose: z.string(),
      }),
    ),
  }),
  externalGeneratorSettings: externalGeneratorSettingsSchema,
  sliderRecommendations: sliderRecommendationSchema,
  runtimeTarget: runtimeTargetSchema,
  promptLength: promptLengthSchema,
  authenticWriter: authenticWriterSchema.default(defaultAuthenticWriterGuidance),
  explicitnessMode: z.enum(["clean", "radio_safe", "mature", "explicit"]).default(defaultExplicitnessMode),
  genreUniverse: genreUniverseSchema.default(defaultGenreUniverseGuidance),
  arrangementCore: arrangementCoreSchema.default(defaultArrangementCoreGuidance),
  lyricStructure: lyricStructureSchema.default(defaultLyricStructureGuidance),
  soundIdentity: soundIdentitySchema.default(defaultSoundIdentityGuidance),
  longPrompt: z.string(),
});

export type SongInput = z.infer<typeof songInputSchema>;
export type ReleaseAnalysis = z.infer<typeof releaseAnalysisSchema>;

export const releaseAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "fingerprint",
    "readiness",
    "releasePlan",
    "externalGeneratorSettings",
    "sliderRecommendations",
    "runtimeTarget",
    "promptLength",
    "authenticWriter",
    "explicitnessMode",
    "genreUniverse",
    "arrangementCore",
    "lyricStructure",
    "soundIdentity",
    "longPrompt",
  ],
  properties: {
    fingerprint: {
      type: "object",
      additionalProperties: false,
      required: ["id", "identity", "mood", "audienceSignal", "sonicPalette"],
      properties: {
        id: { type: "string" },
        identity: { type: "string" },
        mood: { type: "string" },
        audienceSignal: { type: "string" },
        sonicPalette: { type: "array", items: { type: "string" } },
      },
    },
    readiness: {
      type: "object",
      additionalProperties: false,
      required: ["score", "launchState", "blockers", "nextChecks"],
      properties: {
        score: { type: "number" },
        launchState: { type: "string", enum: ["idea", "demo", "ready", "hold"] },
        blockers: { type: "array", items: { type: "string" } },
        nextChecks: { type: "array", items: { type: "string" } },
      },
    },
    releasePlan: {
      type: "object",
      additionalProperties: false,
      required: ["positioning", "hook", "rollout", "exportAssets"],
      properties: {
        positioning: { type: "string" },
        hook: { type: "string" },
        rollout: { type: "array", items: { type: "string" } },
        exportAssets: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "purpose"],
            properties: {
              name: { type: "string" },
              purpose: { type: "string" },
            },
          },
        },
      },
    },
    externalGeneratorSettings: {
      type: "object",
      additionalProperties: false,
      required: [
        "primaryGenre",
        "subgenre",
        "uniqueKey",
        "rhythmicFeel",
        "harmonicIdentity",
        "drumLanguage",
        "vocalMode",
        "genreAuthenticityRules",
        "emotionalFunction",
        "commercialLane",
        "rightsSafeInfluenceNotes",
        "antiRepetitionCheck",
        "prompt",
        "sliderRecommendations",
      ],
      properties: {
        primaryGenre: { type: "string" },
        subgenre: { type: "string" },
        uniqueKey: { type: "string" },
        rhythmicFeel: { type: "string" },
        harmonicIdentity: { type: "string" },
        drumLanguage: { type: "string" },
        vocalMode: { type: "string" },
        genreAuthenticityRules: { type: "array", items: { type: "string" } },
        emotionalFunction: { type: "string" },
        commercialLane: { type: "string" },
        rightsSafeInfluenceNotes: { type: "array", items: { type: "string" } },
        antiRepetitionCheck: { type: "array", items: { type: "string" } },
        prompt: { type: "string" },
        sliderRecommendations: {
          type: "object",
          additionalProperties: false,
          required: ["weirdness", "styleInfluence", "audioInfluence", "autoInfluence", "notes"],
          properties: {
            weirdness: { type: "number" },
            styleInfluence: { type: "number" },
            audioInfluence: { type: ["number", "null"] },
            autoInfluence: { type: "string", enum: ["off", "light", "balanced", "strong"] },
            notes: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    sliderRecommendations: {
      type: "object",
      additionalProperties: false,
      required: ["weirdness", "styleInfluence", "audioInfluence", "autoInfluence", "notes"],
      properties: {
        weirdness: { type: "number" },
        styleInfluence: { type: "number" },
        audioInfluence: { type: ["number", "null"] },
        autoInfluence: { type: "string", enum: ["off", "light", "balanced", "strong"] },
        notes: { type: "array", items: { type: "string" } },
      },
    },
    runtimeTarget: {
      type: "object",
      additionalProperties: false,
      required: [
        "minSeconds",
        "idealSeconds",
        "maxSeconds",
        "warningSeconds",
        "hardLimitSeconds",
        "label",
        "notes",
        "arrangementGuidance",
        "platformGuidance",
        "commercialGuidance",
      ],
      properties: {
        minSeconds: { type: "number" },
        idealSeconds: { type: "number" },
        maxSeconds: { type: "number" },
        warningSeconds: { type: "number" },
        hardLimitSeconds: { type: "number" },
        label: {
          type: "string",
          enum: ["very_short", "short", "standard", "extended", "long_form", "too_long"],
        },
        notes: { type: "array", items: { type: "string" } },
        arrangementGuidance: { type: "array", items: { type: "string" } },
        platformGuidance: { type: "array", items: { type: "string" } },
        commercialGuidance: { type: "array", items: { type: "string" } },
      },
    },
    promptLength: {
      type: "object",
      additionalProperties: false,
      required: [
        "mode",
        "targetMinCharacters",
        "targetIdealCharacters",
        "targetMaxCharacters",
        "allowedSections",
        "forbiddenBehaviors",
        "notes",
      ],
      properties: {
        mode: { type: "string", enum: ["short", "standard", "long", "ultra"] },
        targetMinCharacters: { type: "number" },
        targetIdealCharacters: { type: "number" },
        targetMaxCharacters: { type: "number" },
        allowedSections: { type: "array", items: { type: "string" } },
        forbiddenBehaviors: { type: "array", items: { type: "string" } },
        notes: { type: "array", items: { type: "string" } },
      },
    },
    authenticWriter: {
      type: "object",
      additionalProperties: false,
      required: [
        "authenticityScore",
        "requiredDetails",
        "craftGuidance",
        "reportingQuestions",
        "vocalGuidance",
        "socialContextNotes",
        "avoidList",
        "revisionChecklist",
      ],
      properties: {
        authenticityScore: { type: "number" },
        requiredDetails: { type: "array", items: { type: "string" } },
        craftGuidance: { type: "array", items: { type: "string" } },
        reportingQuestions: { type: "array", items: { type: "string" } },
        vocalGuidance: { type: "array", items: { type: "string" } },
        socialContextNotes: { type: "array", items: { type: "string" } },
        avoidList: { type: "array", items: { type: "string" } },
        revisionChecklist: { type: "array", items: { type: "string" } },
      },
    },
    explicitnessMode: { type: "string", enum: ["clean", "radio_safe", "mature", "explicit"] },
    genreUniverse: { type: "object" },
    arrangementCore: { type: "object" },
    lyricStructure: { type: "object" },
    soundIdentity: { type: "object" },
    longPrompt: { type: "string" },
  },
} as const;

export function normalizeProvider(value?: string | null): SonaraProvider {
  const normalized = value?.trim().toLowerCase().replaceAll("_", "-");
  if (normalized === "openai" || normalized === "openai-byok") return "openai_byok";
  if (normalized === "ollama" || normalized === "ollama-local") return "ollama_local";
  if (normalized === "lmstudio" || normalized === "lm-studio" || normalized === "lmstudio-local" || normalized === "lm-studio-local") return "lmstudio_local";
  return "local_rules";
}

export function providerLabel(provider: SonaraProvider) {
  return sonaraProviderOptions.find((option) => option.id === provider)?.label ?? "None / Local Rules";
}

export function getCoreExportAssets() {
  return [
    ...sonaraCoreSystems.map(({ name, purpose }) => ({ name, purpose })),
    { name: "external-generator-settings.md", purpose: "Suno-style and similar external generator slider suggestions." },
    { name: "runtime-target-threshold.md", purpose: "Deterministic runtime target guidance for the project format and platform." },
    { name: "prompt-length-mode.md", purpose: "Deterministic prompt detail level, allowed sections, and prompt constraints." },
    { name: "genre-universe.md", purpose: "All-genre guidance for rhythm, harmony, drums, vocals, palette, and export needs." },
    { name: "arrangement-core.md", purpose: "Idea-to-arrangement structure, energy curve, transitions, and risks." },
    { name: "lyric-structure.md", purpose: "User lyric section mapping, hook candidates, explicitness mode, and breath notes." },
    { name: "authentic-writer-guidance.md", purpose: "Concrete writing, reporting, vocal, and social-context guidance." },
    { name: "sound-identity.md", purpose: "Signature elements, differentiation checks, and safe sound identity notes." },
    { name: "long-prompt.md", purpose: "Full local-rules long prompt with runtime target and external generator settings." },
    { name: "release-plan.md", purpose: "Human-readable launch plan and rollout steps." },
    { name: "checklist.txt", purpose: "Final launch checks and unresolved release blockers." },
  ];
}

export function ensureCoreExportAssets(analysis: ReleaseAnalysis): ReleaseAnalysis {
  const exportAssets = [...analysis.releasePlan.exportAssets];
  const existing = new Set(exportAssets.map((asset) => asset.name.toLowerCase()));

  for (const asset of getCoreExportAssets()) {
    if (!existing.has(asset.name.toLowerCase())) {
      exportAssets.push(asset);
      existing.add(asset.name.toLowerCase());
    }
  }

  return {
    ...analysis,
    releasePlan: {
      ...analysis.releasePlan,
      exportAssets,
    },
  };
}

export function buildReleasePrompt(input: SongInput) {
  return [
    "Analyze this song only as SONARA: a music identity and release-readiness system.",
    "Do not invent distribution, streaming, video editing, raw analytics, or generic music generation features.",
    "The promise is: every song gets a fingerprint, every release gets a plan, every creator gets a cleaner path from idea to launch.",
    "Preserve these SONARA Core systems in export planning: Song Fingerprint, Sound Discovery, Streaming Pack, Broadcast Kit, Breath Control, Export Bundle.",
    "Include external generator settings as suggestions only: primary genre, prompt, and sliderRecommendations for Suno-style and similar tools.",
    "Include runtimeTarget from deterministic local rules; OpenAI may explain it but must not define the numeric threshold.",
    "Include promptLength and longPrompt from deterministic local prompt-length rules; OpenAI may rewrite but must not choose the mode.",
    "Include genreUniverse, arrangementCore, lyricStructure, explicitnessMode, and soundIdentity as local-rule compatible sections.",
    `Song title: ${input.songTitle}`,
    input.creatorName ? `Creator: ${input.creatorName}` : "",
    `Song notes: ${input.notes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function ruleBasedReleaseAnalysis(input: SongInput): ReleaseAnalysis {
  const id = createFingerprintId(`${input.songTitle}:${input.creatorName}:${input.notes}`);
  const notes = input.notes.toLowerCase();
  const hasAudience = notes.includes("audience") || notes.includes("fans") || notes.includes("tiktok");
  const hasAssets = notes.includes("cover") || notes.includes("snippet") || notes.includes("video") || notes.includes("art");
  const hasMix = notes.includes("mix") || notes.includes("master") || notes.includes("demo");
  const hasPerformance = notes.includes("vocal") || notes.includes("breath") || notes.includes("hook") || notes.includes("performance");
  const score = 40 + (hasAudience ? 17 : 0) + (hasAssets ? 15 : 0) + (hasMix ? 14 : 0) + (hasPerformance ? 10 : 0);
  const externalGeneratorSettings = buildExternalGeneratorSettings(input, notes);
  const runtimeTarget = buildRuntimeTarget(input, notes);
  const promptLength = buildPromptLength(input, notes);
  const explicitnessMode = inferExplicitnessMode(notes);
  const genreUniverse = getGenreUniverseGuidance({ genreFamily: externalGeneratorSettings.primaryGenre, mood: notes });
  const arrangementCore = buildArrangementCore({
    genreFamily: externalGeneratorSettings.primaryGenre,
    mood: inferMood(notes),
    runtimeTargetSeconds: runtimeTarget.idealSeconds,
    vocalMode: externalGeneratorSettings.vocalMode,
    drumLanguage: externalGeneratorSettings.drumLanguage,
    harmonicIdentity: externalGeneratorSettings.harmonicIdentity,
  });
  const lyricStructure = analyzeLyricStructure({
    rawLyrics: extractLyricsFromNotes(input.notes),
    genreFamily: externalGeneratorSettings.primaryGenre,
    explicitnessMode,
    targetRuntimeSeconds: runtimeTarget.idealSeconds,
  });
  const soundIdentity = buildSoundIdentity(input.notes);
  const authenticWriter = analyzeAuthenticWriting({
    text: input.notes,
    audience: hasAudience ? "defined in project notes" : undefined,
    context: input.songTitle,
  });
  const longPrompt = buildSONARALongPrompt(input, externalGeneratorSettings, runtimeTarget, promptLength, notes, authenticWriter);

  return ensureCoreExportAssets({
    fingerprint: {
      id,
      identity: `${input.songTitle} has a defined SONARA™ fingerprint seed and can move through release-readiness without a paid model provider.`,
      mood: inferMood(notes),
      audienceSignal: hasAudience
        ? "Audience angle is present; sharpen it into one listener moment."
        : "Audience angle is underdefined; name the exact listener and use case.",
      sonicPalette: inferPalette(notes),
    },
    readiness: {
      score: Math.min(score, 92),
      launchState: score >= 80 ? "ready" : score >= 62 ? "demo" : "idea",
      blockers: [
        hasAudience ? "" : "Define the first audience segment.",
        hasAssets ? "" : "List cover, snippet, credit, and broadcast assets.",
        hasMix ? "" : "Confirm mix/master readiness.",
        hasPerformance ? "" : "Run Breath Control on the hook and vocal pacing.",
      ].filter(Boolean),
      nextChecks: [
        "Lock Song Fingerprint",
        "Run Sound Discovery pass",
        "Prepare Streaming Pack",
        "Assemble Broadcast Kit",
        "Review Breath Control",
        "Verify Export Bundle",
      ],
    },
    releasePlan: {
      positioning: "Lead with the emotional identity of the song before any format, platform, or tactic.",
      hook: "Turn the strongest line into a repeatable phrase that can survive outside the full track.",
      rollout: [
        "Lock Song Fingerprint",
        "Map Sound Discovery to one listener moment",
        "Prepare Streaming Pack metadata",
        "Assemble Broadcast Kit talking points",
        "Run Breath Control on hook delivery",
        "Package Export Bundle for launch review",
      ],
      exportAssets: getCoreExportAssets(),
    },
    externalGeneratorSettings,
    sliderRecommendations: externalGeneratorSettings.sliderRecommendations,
    runtimeTarget,
    promptLength,
    authenticWriter,
    explicitnessMode,
    genreUniverse,
    arrangementCore,
    lyricStructure,
    soundIdentity,
    longPrompt,
  });
}

export function fallbackReleaseAnalysis(input: SongInput): ReleaseAnalysis {
  return ruleBasedReleaseAnalysis(input);
}

export function buildExternalGeneratorSettings(input: SongInput, normalizedNotes = input.notes.toLowerCase()) {
  const primaryGenre = inferGenreFamily(normalizedNotes);
  const subgenre = inferSubgenre(primaryGenre, normalizedNotes);
  const useCase = inferSliderUseCase(normalizedNotes);
  const hasAudioUpload = normalizedNotes.includes("upload") || normalizedNotes.includes("reference") || normalizedNotes.includes("stem");
  const wantsConsistency = normalizedNotes.includes("album") || normalizedNotes.includes("consistent") || normalizedNotes.includes("series");
  const wantsNovelty = normalizedNotes.includes("experimental") || normalizedNotes.includes("weird") || normalizedNotes.includes("surprise");
  const sliderRecommendations = getSliderRecommendation({
    genreFamily: primaryGenre,
    useCase,
    hasAudioUpload,
    wantsConsistency,
    wantsNovelty,
  });

  return {
    primaryGenre,
    subgenre,
    uniqueKey: `${inferMood(normalizedNotes)} ${primaryGenre.replaceAll("_", " ")} identity`,
    rhythmicFeel: inferRhythmicFeel(primaryGenre, normalizedNotes),
    harmonicIdentity: inferHarmonicIdentity(primaryGenre, normalizedNotes),
    drumLanguage: inferDrumLanguage(primaryGenre, normalizedNotes),
    vocalMode: inferVocalMode(normalizedNotes),
    genreAuthenticityRules: [
      "Keep the core genre rhythm language clear before adding secondary colors.",
      "Use references as directional vocabulary only; do not copy protected expression.",
      "Avoid stacking conflicting genre cues in the hook.",
    ],
    emotionalFunction: inferEmotionalFunction(normalizedNotes),
    commercialLane: inferCommercialLane(normalizedNotes),
    rightsSafeInfluenceNotes: [
      "Describe feel, arrangement, era, and texture instead of naming a living artist as a target.",
      "Keep melodies, lyrics, vocal identity, and production signatures original.",
      "Treat external generator settings as suggestions that require human review.",
    ],
    antiRepetitionCheck: [
      "Vary the second verse entry or bridge energy.",
      "Keep the hook memorable without cloning the first phrase in every section.",
      "Run a final lyric and melody pass for repeated filler language.",
    ],
    prompt: buildExternalGeneratorPrompt(input, primaryGenre, subgenre, normalizedNotes),
    sliderRecommendations,
  };
}

export function buildRuntimeTarget(input: SongInput, normalizedNotes = input.notes.toLowerCase()) {
  return calculateRuntimeThreshold({
    projectType: inferRuntimeProjectType(normalizedNotes),
    platformGoal: inferRuntimePlatformGoal(normalizedNotes),
    commercialLane: inferRuntimeCommercialLane(normalizedNotes),
    genreFamily: toRuntimeGenreFamily(inferGenreFamily(normalizedNotes)),
    complexity: inferRuntimeComplexity(normalizedNotes),
    bpm: inferBpm(normalizedNotes),
    hasIntro: normalizedNotes.includes("intro"),
    hasOutro: normalizedNotes.includes("outro"),
    hasBridge: normalizedNotes.includes("bridge"),
    verseCount: inferCount(normalizedNotes, "verse"),
    hookCount: inferCount(normalizedNotes, "hook"),
    userRequestedSeconds: inferRequestedRuntimeSeconds(normalizedNotes),
  });
}

export function buildPromptLength(input: SongInput, normalizedNotes = input.notes.toLowerCase()): PromptDetailLevel {
  return getPromptDetailLevel({
    situation: inferPromptSituation(normalizedNotes),
    platformTarget: inferPromptPlatformTarget(normalizedNotes),
    userRequestedMode: inferUserRequestedPromptMode(normalizedNotes),
    needsStructure: true,
    needsRuntimeTarget: true,
    needsSliderSettings: true,
    needsSoundRights: normalizedNotes.includes("sound") || normalizedNotes.includes("sample") || normalizedNotes.includes("loop"),
    needsMetadata: normalizedNotes.includes("metadata") || normalizedNotes.includes("streaming") || normalizedNotes.includes("release"),
    needsVisualDirection: normalizedNotes.includes("video") || normalizedNotes.includes("visual") || normalizedNotes.includes("sora"),
    needsCommercialCopy: normalizedNotes.includes("marketplace") || normalizedNotes.includes("listing") || normalizedNotes.includes("store"),
    needsLegalFooter: normalizedNotes.includes("export") || normalizedNotes.includes("brand"),
  });
}

export function buildSONARALongPrompt(
  input: SongInput,
  externalGeneratorSettings: ReturnType<typeof buildExternalGeneratorSettings>,
  runtimeTarget: ReturnType<typeof buildRuntimeTarget>,
  promptLength: PromptDetailLevel,
  normalizedNotes = input.notes.toLowerCase(),
  authenticWriter = analyzeAuthenticWriting({ text: input.notes, context: input.songTitle }),
) {
  return buildLongPrompt({
    title: input.songTitle,
    genre: externalGeneratorSettings.primaryGenre,
    subgenre: externalGeneratorSettings.subgenre,
    mood: inferMood(normalizedNotes),
    projectGoal: "Build a distinct music identity and release-ready direction without replacing artist judgment.",
    uniqueKey: externalGeneratorSettings.uniqueKey,
    rhythmicFeel: externalGeneratorSettings.rhythmicFeel,
    harmonicIdentity: externalGeneratorSettings.harmonicIdentity,
    drumLanguage: externalGeneratorSettings.drumLanguage,
    vocalMode: externalGeneratorSettings.vocalMode,
    runtimeTarget,
    sliderRecommendations: externalGeneratorSettings.sliderRecommendations,
    authenticWriter,
    soundRightsMode: "Original composition and rights-safe influence language. Verify third-party sounds before export.",
    arrangementNotes: [
      ...runtimeTarget.arrangementGuidance,
      "Keep the hook memorable without turning the project into a generic generator prompt.",
      "Let SONARA Core guide identity, release prep, and creator workflow.",
    ],
    mixNotes: [
      "Keep lead vocal, drums, and signature motif readable.",
      "Avoid overloading the prompt with contradictory texture requests.",
    ],
    negativeConstraints: [
      ...externalGeneratorSettings.rightsSafeInfluenceNotes,
      "Do not imply guaranteed platform results, placements, income, or approvals.",
    ],
    detailLevel: promptLength,
  });
}

export function applyLocalDeterministicSystems(input: SongInput, analysis: ReleaseAnalysis): ReleaseAnalysis {
  const normalizedNotes = input.notes.toLowerCase();
  const externalGeneratorSettings = buildExternalGeneratorSettings(input, normalizedNotes);
  const runtimeTarget = buildRuntimeTarget(input, normalizedNotes);
  const promptLength = buildPromptLength(input, normalizedNotes);
  const explicitnessMode = inferExplicitnessMode(normalizedNotes);
  const genreUniverse = getGenreUniverseGuidance({ genreFamily: externalGeneratorSettings.primaryGenre, mood: normalizedNotes });
  const arrangementCore = buildArrangementCore({
    genreFamily: externalGeneratorSettings.primaryGenre,
    mood: inferMood(normalizedNotes),
    runtimeTargetSeconds: runtimeTarget.idealSeconds,
    vocalMode: externalGeneratorSettings.vocalMode,
    drumLanguage: externalGeneratorSettings.drumLanguage,
    harmonicIdentity: externalGeneratorSettings.harmonicIdentity,
  });
  const lyricStructure = analyzeLyricStructure({
    rawLyrics: extractLyricsFromNotes(input.notes),
    genreFamily: externalGeneratorSettings.primaryGenre,
    explicitnessMode,
    targetRuntimeSeconds: runtimeTarget.idealSeconds,
  });
  const soundIdentity = buildSoundIdentity(input.notes);
  const authenticWriter = analyzeAuthenticWriting({ text: input.notes, context: input.songTitle });
  const longPrompt = buildSONARALongPrompt(input, externalGeneratorSettings, runtimeTarget, promptLength, normalizedNotes, authenticWriter);

  return ensureCoreExportAssets({
    ...analysis,
    externalGeneratorSettings,
    sliderRecommendations: externalGeneratorSettings.sliderRecommendations,
    runtimeTarget,
    promptLength,
    authenticWriter,
    explicitnessMode,
    genreUniverse,
    arrangementCore,
    lyricStructure,
    soundIdentity,
    longPrompt,
  });
}

function createFingerprintId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return `SONARA-${Math.abs(hash).toString(36).toUpperCase().padStart(6, "0")}`;
}

function inferMood(notes: string) {
  if (notes.includes("dark") || notes.includes("pressure")) return "dark, resilient, cinematic";
  if (notes.includes("love") || notes.includes("heart")) return "intimate, melodic, vulnerable";
  if (notes.includes("club") || notes.includes("dance")) return "kinetic, bright, high-motion";
  return "clear, focused, emerging";
}

function inferExplicitnessMode(notes: string) {
  if (notes.includes("explicitness mode: explicit")) return "explicit";
  if (notes.includes("explicitness mode: mature")) return "mature";
  if (notes.includes("explicitness mode: clean")) return "clean";
  return defaultExplicitnessMode;
}

function extractLyricsFromNotes(notes: string) {
  const marker = "User-written lyrics:";
  const markerIndex = notes.indexOf(marker);
  if (markerIndex === -1) return "";
  const afterMarker = notes.slice(markerIndex + marker.length);
  const nextSection = afterMarker.indexOf("\n\n");
  return (nextSection === -1 ? afterMarker : afterMarker.slice(0, nextSection)).trim();
}

function inferPalette(notes: string) {
  if (notes.includes("dark")) return ["low synth texture", "tight drums", "wide chorus lift"];
  if (notes.includes("acoustic")) return ["dry vocal", "warm guitar", "minimal percussion"];
  if (notes.includes("club") || notes.includes("dance")) return ["clean kick", "bright topline", "high-motion percussion"];
  return ["lead vocal", "signature motif", "clean low-end pocket"];
}

function inferGenreFamily(notes: string): SliderGenreFamily {
  if (notes.includes("hip hop") || notes.includes("rap") || notes.includes("trap")) return "hip_hop";
  if (notes.includes("r&b") || notes.includes("rnb") || notes.includes("soul")) return "rnb";
  if (notes.includes("pop")) return "pop";
  if (notes.includes("country")) return "country";
  if (notes.includes("rock") || notes.includes("guitar band")) return "rock";
  if (notes.includes("electronic") || notes.includes("edm") || notes.includes("house") || notes.includes("techno")) return "electronic";
  if (notes.includes("latin") || notes.includes("reggaeton") || notes.includes("bachata")) return "latin";
  if (notes.includes("afrobeats") || notes.includes("afrobeat") || notes.includes("amapiano")) return "afrobeats";
  if (notes.includes("gospel") || notes.includes("choir")) return "gospel";
  if (notes.includes("cinematic") || notes.includes("score") || notes.includes("trailer")) return "cinematic";
  if (notes.includes("ambient") || notes.includes("drone")) return "ambient";
  if (notes.includes("experimental")) return "experimental";
  return "general";
}

function inferSliderUseCase(notes: string): SliderUseCase {
  if (notes.includes("radio") || notes.includes("hook") || notes.includes("single")) return "radio_hook";
  if (notes.includes("experimental") || notes.includes("weird")) return "experimental";
  if (notes.includes("blend") || notes.includes("fusion")) return "genre_blend";
  if (notes.includes("album") || notes.includes("series")) return "album_consistency";
  if (notes.includes("bridge")) return "bridge_variation";
  if (notes.includes("vocal upload") || notes.includes("voice memo")) return "vocal_upload";
  if (notes.includes("texture") || notes.includes("sample bed")) return "audio_texture";
  if (notes.includes("sound design")) return "sound_design";
  if (notes.includes("demo")) return "demo_safe";
  return "stable_single";
}

function inferRuntimeProjectType(notes: string): RuntimeProjectType {
  if (notes.includes("sample pack loop")) return "sample_pack_loop";
  if (notes.includes("sound pack preview")) return "sound_pack_preview";
  if (notes.includes("social") || notes.includes("short-form") || notes.includes("clip")) return "social_clip";
  if (notes.includes("visualizer")) return "visualizer";
  if (notes.includes("lyric video")) return "lyric_video";
  if (notes.includes("broadcast")) return "broadcast_segment";
  if (notes.includes("podcast intro")) return "podcast_intro";
  if (notes.includes("ad spot")) return "ad_spot";
  if (notes.includes("full performance") || notes.includes("live set")) return "full_performance";
  if (notes.includes("album intro")) return "album_intro";
  if (notes.includes("album outro")) return "album_outro";
  if (notes.includes("interlude")) return "interlude";
  if (notes.includes("hook demo")) return "hook_demo";
  if (notes.includes("loop")) return "loop";
  if (notes.includes("album")) return "album_track";
  return "single";
}

function inferRuntimePlatformGoal(notes: string): RuntimePlatformGoal {
  if (notes.includes("playlist")) return "playlist";
  if (notes.includes("radio")) return "radio";
  if (notes.includes("album")) return "album";
  if (notes.includes("sync") || notes.includes("trailer")) return "sync";
  if (notes.includes("social") || notes.includes("short-form") || notes.includes("tiktok") || notes.includes("reels")) return "social_short";
  if (notes.includes("youtube") || notes.includes("visualizer") || notes.includes("lyric video")) return "youtube";
  if (notes.includes("broadcast")) return "broadcast";
  if (notes.includes("marketplace") || notes.includes("sound pack") || notes.includes("sample pack")) return "marketplace";
  if (notes.includes("demo")) return "demo";
  if (notes.includes("live") || notes.includes("performance")) return "live";
  return "streaming";
}

function inferRuntimeCommercialLane(notes: string): RuntimeCommercialLane {
  if (notes.includes("mainstream") || notes.includes("radio")) return "mainstream";
  if (notes.includes("underground")) return "underground";
  if (notes.includes("cinematic") || notes.includes("trailer")) return "cinematic";
  if (notes.includes("experimental") || notes.includes("weird")) return "experimental";
  if (notes.includes("asset") || notes.includes("loop") || notes.includes("sound pack") || notes.includes("sample pack")) return "creator_asset";
  if (notes.includes("sync")) return "sync_ready";
  if (notes.includes("social") || notes.includes("short-form")) return "social_first";
  if (notes.includes("performance") || notes.includes("live")) return "performance_first";
  return "label_release";
}

function inferRuntimeComplexity(notes: string): RuntimeComplexity {
  if (notes.includes("minimal") || notes.includes("sparse") || notes.includes("acoustic")) return "minimal";
  if (notes.includes("cinematic") || notes.includes("trailer")) return "cinematic";
  if (notes.includes("extended") || notes.includes("long-form")) return "extended";
  if (notes.includes("expanded") || notes.includes("bridge") || notes.includes("three verse") || notes.includes("3 verse")) return "expanded";
  return "standard";
}

function toRuntimeGenreFamily(genre: SliderGenreFamily): RuntimeGenreFamily {
  return genre;
}

function inferPromptSituation(notes: string): PromptSituation {
  if (notes.includes("album sequence")) return "album_sequence";
  if (notes.includes("album")) return "album_track";
  if (notes.includes("sound pack") || notes.includes("sample pack")) return "sound_pack";
  if (notes.includes("marketplace") || notes.includes("listing")) return "marketplace_listing";
  if (notes.includes("suno")) return "suno_style";
  if (notes.includes("udio")) return "udio_style";
  if (notes.includes("lyric video")) return "lyric_video";
  if (notes.includes("video prompt") || notes.includes("sora") || notes.includes("runway") || notes.includes("pika")) return "video_prompt";
  if (notes.includes("visualizer")) return "visualizer";
  if (notes.includes("broadcast")) return "broadcast_kit";
  if (notes.includes("social") || notes.includes("short-form") || notes.includes("tiktok") || notes.includes("reels")) return "social_clip";
  if (notes.includes("brand export")) return "brand_export";
  if (notes.includes("artist profile")) return "artist_profile";
  if (notes.includes("prompt pack")) return "prompt_pack_product";
  if (notes.includes("runtime")) return "runtime_analysis";
  if (notes.includes("metadata") || notes.includes("streaming")) return "streaming_metadata";
  if (notes.includes("release plan") || notes.includes("release")) return "release_plan";
  if (notes.includes("external generator")) return "external_generator";
  return "song_generation";
}

function inferPromptPlatformTarget(notes: string): PromptPlatformTarget {
  if (notes.includes("suno")) return "suno";
  if (notes.includes("udio")) return "udio";
  if (notes.includes("sora")) return "sora";
  if (notes.includes("runway")) return "runway";
  if (notes.includes("pika")) return "pika";
  if (notes.includes("capcut")) return "capcut";
  if (notes.includes("youtube")) return "youtube";
  if (notes.includes("tiktok") || notes.includes("reels")) return "tiktok";
  if (notes.includes("spotify")) return "spotify";
  if (notes.includes("apple music")) return "apple_music";
  if (notes.includes("marketplace")) return "marketplace";
  return "sonara";
}

function inferUserRequestedPromptMode(notes: string) {
  if (notes.includes("ultra prompt") || notes.includes("ultra-detailed prompt")) return "ultra";
  if (notes.includes("long prompt")) return "long";
  if (notes.includes("standard prompt")) return "standard";
  if (notes.includes("short prompt")) return "short";
  return undefined;
}

function inferBpm(notes: string) {
  const explicitBpm = notes.match(/(?:bpm|tempo)\D{0,8}(\d{2,3})/i) ?? notes.match(/(\d{2,3})\s*bpm/i);
  if (!explicitBpm) return undefined;
  const bpm = Number(explicitBpm[1]);
  return bpm >= 40 && bpm <= 240 ? bpm : undefined;
}

function inferCount(notes: string, noun: "verse" | "hook") {
  const match = notes.match(new RegExp(`(\\d+)\\s*${noun}s?`, "i"));
  return match ? Number(match[1]) : undefined;
}

function inferRequestedRuntimeSeconds(notes: string) {
  const minuteSecond = notes.match(/(?:runtime|length|duration)\D{0,12}(\d+):(\d{2})/i);
  if (minuteSecond) {
    return Number(minuteSecond[1]) * 60 + Number(minuteSecond[2]);
  }

  const seconds = notes.match(/(?:runtime|length|duration)\D{0,12}(\d{1,4})\s*(?:sec|seconds)/i);
  if (seconds) return Number(seconds[1]);

  const minutes = notes.match(/(?:runtime|length|duration)\D{0,12}(\d+(?:\.\d+)?)\s*(?:min|minutes)/i);
  if (minutes) return Math.round(Number(minutes[1]) * 60);

  return undefined;
}

function inferSubgenre(primaryGenre: SliderGenreFamily, notes: string) {
  if (notes.includes("cinematic")) return "cinematic crossover";
  if (notes.includes("dark")) return `dark ${primaryGenre.replaceAll("_", " ")}`;
  if (notes.includes("acoustic")) return "acoustic songwriter";
  if (notes.includes("club")) return "club-ready";
  if (notes.includes("anthem")) return "anthemic";
  return "modern core";
}

function inferRhythmicFeel(primaryGenre: SliderGenreFamily, notes: string) {
  if (notes.includes("bounce") || primaryGenre === "afrobeats") return "syncopated bounce with stable pocket";
  if (notes.includes("club") || primaryGenre === "electronic") return "four-on-floor or high-motion pulse";
  if (notes.includes("ballad")) return "slow, spacious, lyric-forward pulse";
  if (primaryGenre === "hip_hop") return "tight drum pocket with clear downbeat";
  return "steady groove with room for vocal phrasing";
}

function inferHarmonicIdentity(primaryGenre: SliderGenreFamily, notes: string) {
  if (notes.includes("dark") || primaryGenre === "cinematic") return "minor color with lift in the hook";
  if (notes.includes("love") || primaryGenre === "rnb") return "warm extended chords and smooth resolution";
  if (primaryGenre === "country") return "direct chord movement with lyric-forward turns";
  return "clear progression that supports a memorable hook";
}

function inferDrumLanguage(primaryGenre: SliderGenreFamily, notes: string) {
  if (primaryGenre === "hip_hop") return "tight kicks, crisp hats, controlled low-end";
  if (primaryGenre === "afrobeats") return "percussion bounce, warm kick, syncopated accents";
  if (primaryGenre === "rock") return "live-feeling drums with strong chorus lift";
  if (primaryGenre === "electronic") return "clean kick, layered percussion, movement automation";
  if (notes.includes("acoustic")) return "minimal percussion with human timing";
  return "supportive groove, no clutter, clear hook entry";
}

function inferVocalMode(notes: string) {
  if (notes.includes("rap")) return "rhythmic lead vocal with hook contrast";
  if (notes.includes("choir") || notes.includes("gospel")) return "stacked harmony and emotional lift";
  if (notes.includes("intimate") || notes.includes("soft")) return "close, restrained, breath-aware vocal";
  return "clear lead vocal with memorable hook phrasing";
}

function inferEmotionalFunction(notes: string) {
  if (notes.includes("pressure") || notes.includes("survive")) return "resilience and forward motion";
  if (notes.includes("love") || notes.includes("heart")) return "connection and vulnerability";
  if (notes.includes("party") || notes.includes("club")) return "movement and release";
  return "identity, clarity, and launch momentum";
}

function inferCommercialLane(notes: string) {
  if (notes.includes("sync") || notes.includes("trailer")) return "sync-friendly pitch lane";
  if (notes.includes("radio") || notes.includes("single")) return "single and short-form hook lane";
  if (notes.includes("club")) return "club and performance lane";
  return "creator-owned release lane";
}

function buildExternalGeneratorPrompt(input: SongInput, primaryGenre: SliderGenreFamily, subgenre: string, notes: string) {
  const palette = inferPalette(notes).join(", ");

  return [
    `${input.songTitle || "Example Song"}: ${primaryGenre.replaceAll("_", " ")} / ${subgenre}.`,
    `Mood: ${inferMood(notes)}.`,
    `Sonic palette: ${palette}.`,
    `Vocal mode: ${inferVocalMode(notes)}.`,
    `Rhythmic feel: ${inferRhythmicFeel(primaryGenre, notes)}.`,
    "Original composition, rights-safe influence language, memorable hook, clean arrangement, release-ready structure.",
  ].join(" ");
}
