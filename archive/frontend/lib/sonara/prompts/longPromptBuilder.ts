import type { SliderProfile } from "../generation/sliderRecommendations";
import type { AuthenticWriterGuidance } from "../writing/authenticWriterTypes";
import type { RuntimeThreshold } from "../runtime/runtimeTypes";
import { formatRuntime } from "../runtime/runtimeThresholdEngine";
import type { PromptDetailLevel } from "./promptLengthTypes";

export type LongPromptBuilderInput = {
  title?: string;
  genre: string;
  subgenre?: string;
  mood?: string;
  projectGoal?: string;
  uniqueKey: string;
  rhythmicFeel: string;
  harmonicIdentity: string;
  drumLanguage: string;
  vocalMode: string;
  runtimeTarget?: RuntimeThreshold;
  sliderRecommendations?: SliderProfile;
  authenticWriter?: AuthenticWriterGuidance;
  soundRightsMode?: string;
  arrangementNotes?: string[];
  mixNotes?: string[];
  negativeConstraints?: string[];
  detailLevel: PromptDetailLevel;
};

export function buildLongPrompt(input: LongPromptBuilderInput) {
  const sections: string[] = [];

  sections.push(`PROJECT TITLE: ${input.title ?? "Untitled Creator Project"}`);
  sections.push(`GENRE: ${input.genre}${input.subgenre ? ` / ${input.subgenre}` : ""}`);
  sections.push(`MOOD / EMOTIONAL TARGET: ${input.mood ?? "focused, distinct, release-ready"}`);
  sections.push(`PROJECT GOAL: ${input.projectGoal ?? "Build a distinct music identity and release-ready direction."}`);

  sections.push(
    [
      "SONG FINGERPRINT:",
      `- Unique Key: ${input.uniqueKey}`,
      `- Unique Rhythmic Feel: ${input.rhythmicFeel}`,
      `- Unique Harmonic Identity: ${input.harmonicIdentity}`,
      `- Unique Drum Language: ${input.drumLanguage}`,
      `- Unique Vocal Mode: ${input.vocalMode}`,
    ].join("\n"),
  );

  if (input.runtimeTarget) {
    sections.push(
      [
        "RUNTIME TARGET THRESHOLD:",
        `- Minimum: ${formatRuntime(input.runtimeTarget.minSeconds)}`,
        `- Ideal: ${formatRuntime(input.runtimeTarget.idealSeconds)}`,
        `- Maximum: ${formatRuntime(input.runtimeTarget.maxSeconds)}`,
        `- Warning: ${formatRuntime(input.runtimeTarget.warningSeconds)}`,
        `- Hard Limit: ${formatRuntime(input.runtimeTarget.hardLimitSeconds)}`,
      ].join("\n"),
    );
  }

  if (input.sliderRecommendations) {
    sections.push(
      [
        "EXTERNAL GENERATOR SETTINGS:",
        `- Weirdness: ${input.sliderRecommendations.weirdness}%`,
        `- Style Influence: ${input.sliderRecommendations.styleInfluence}%`,
        `- Audio Influence: ${
          input.sliderRecommendations.audioInfluence === null
            ? "N/A"
            : `${input.sliderRecommendations.audioInfluence}%`
        }`,
        `- Auto Influence: ${input.sliderRecommendations.autoInfluence}`,
        ...input.sliderRecommendations.notes.map((note) => `- ${note}`),
      ].join("\n"),
    );
  }

  if (input.arrangementNotes?.length) {
    sections.push(
      ["ARRANGEMENT NOTES:", ...input.arrangementNotes.map((note) => `- ${note}`)].join("\n"),
    );
  }

  if (input.authenticWriter) {
    sections.push(
      [
        "AUTHENTIC WRITER GUIDANCE:",
        `- Authenticity Score: ${input.authenticWriter.authenticityScore}/100`,
        ...input.authenticWriter.requiredDetails.slice(0, 6).map((detail) => `- Add: ${detail}`),
        ...input.authenticWriter.craftGuidance.slice(0, 3).map((note) => `- Craft: ${note}`),
        ...input.authenticWriter.vocalGuidance.slice(0, 3).map((note) => `- Vocal: ${note}`),
      ].join("\n"),
    );
  }

  if (input.mixNotes?.length) {
    sections.push(
      ["MIX / MASTER DIRECTION:", ...input.mixNotes.map((note) => `- ${note}`)].join("\n"),
    );
  }

  if (input.soundRightsMode) {
    sections.push(`SOUND RIGHTS MODE: ${input.soundRightsMode}`);
  }

  sections.push(
    [
      "NEGATIVE CONSTRAINTS:",
      "- Do not use direct artist clone language.",
      "- Do not mention private artist ecosystem names.",
      "- Do not use registered trademark symbols for SONARA marks.",
      ...(input.negativeConstraints ?? []).map((note) => `- ${note}`),
    ].join("\n"),
  );

  sections.push(
    [
      "PROMPT LENGTH CONTROL:",
      `- Mode: ${input.detailLevel.mode}`,
      `- Target Ideal Characters: ${input.detailLevel.targetIdealCharacters}`,
      `- Target Max Characters: ${input.detailLevel.targetMaxCharacters}`,
      `- Allowed Sections: ${input.detailLevel.allowedSections.join(", ")}`,
    ].join("\n"),
  );

  return sections.join("\n\n");
}
