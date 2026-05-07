import { getGenreUniverseGuidance } from "../genre/genreUniverseEngine";
import type { ArrangementCoreGuidance, ArrangementCoreInput } from "./arrangementCoreTypes";

export function buildArrangementCore(input: ArrangementCoreInput = {}): ArrangementCoreGuidance {
  const genre = getGenreUniverseGuidance({ genreFamily: input.genreFamily, subgenre: input.subgenre, mood: input.mood, releaseGoal: input.releaseGoal });
  const runtime = input.runtimeTargetSeconds ?? 165;
  const shortRuntime = runtime <= 120;
  const complexity = input.arrangementComplexity ?? (runtime > 240 ? "expanded" : "standard");
  const vocalMode = input.vocalMode ?? genre.vocalModes[0];
  const drumLanguage = input.drumLanguage ?? genre.drumLanguage[0];

  return {
    introStrategy: shortRuntime
      ? "Open with the signature sound or hook fragment in 2 to 4 bars."
      : "Use 4 to 8 bars to establish mood, palette, and first rhythmic cue.",
    verseStrategy: "Keep verses specific and forward-moving; add new detail instead of repeating the hook idea too early.",
    hookStrategy: "Make the hook simple enough to market but specific enough to belong to this song.",
    bridgeStrategy: complexity === "minimal" ? "Use a bridge only if it adds a real emotional turn." : "Use bridge or breakdown for contrast, tension, or final-hook lift.",
    outroStrategy: "Exit cleanly; do not add a long fade unless it serves the project format.",
    transitionNotes: [
      "Signal each section with one clear musical change.",
      "Use drum dropouts, fills, silence, or texture changes instead of clutter.",
      shortRuntime ? "Avoid extra intros that delay the first memorable moment." : "Let transitions breathe if the runtime target supports a larger arc.",
    ],
    energyCurve: [
      "Intro establishes identity.",
      "Verse narrows the story.",
      "Hook opens the room.",
      complexity === "cinematic" ? "Bridge expands scale before the final lift." : "Second half should add contrast without losing the central phrase.",
    ],
    vocalPlacement: [vocalMode, "Keep the lead readable before adding stacks.", "Reserve ad-libs for section lift or emotional punctuation."],
    drumMovement: [drumLanguage, "Avoid crowding the vocal pocket.", "Let percussion density increase only where energy needs it."],
    arrangementRisks: [
      "Too many genre cues can blur the core identity.",
      "Long intros can weaken streaming and social-first use cases.",
      "Repeating every section with the same drum density can make the song feel flat.",
    ],
    genreAuthenticityNotes: genre.arrangementPriorities,
  };
}
