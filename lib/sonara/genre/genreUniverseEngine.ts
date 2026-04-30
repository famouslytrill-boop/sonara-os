import type { GenreFamily, GenreUniverseGuidance, GenreUniverseInput } from "./genreUniverseTypes";

export const genreFamilies: GenreFamily[] = [
  "hip_hop",
  "rnb",
  "pop",
  "country",
  "rock",
  "electronic",
  "latin",
  "afrobeats",
  "gospel",
  "cinematic",
  "ambient",
  "experimental",
  "spoken",
  "global_fusion",
  "custom",
];

const labels: Record<GenreFamily, string> = {
  hip_hop: "Hip-Hop",
  rnb: "R&B",
  pop: "Pop",
  country: "Country",
  rock: "Rock",
  electronic: "Electronic",
  latin: "Latin",
  afrobeats: "Afrobeats",
  gospel: "Gospel",
  cinematic: "Cinematic",
  ambient: "Ambient",
  experimental: "Experimental",
  spoken: "Spoken Word",
  global_fusion: "Global Fusion",
  custom: "Custom Hybrid",
};

export function normalizeGenreFamily(value?: string): GenreFamily {
  const normalized = value?.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!normalized) return "custom";
  if (normalized === "hiphop" || normalized === "rap" || normalized === "trap") return "hip_hop";
  if (normalized === "r_b" || normalized === "r_and_b" || normalized === "soul") return "rnb";
  if (normalized === "edm" || normalized === "house" || normalized === "techno") return "electronic";
  if (normalized === "afrobeat" || normalized === "amapiano") return "afrobeats";
  if (normalized === "world" || normalized === "fusion") return "global_fusion";
  return genreFamilies.includes(normalized as GenreFamily) ? (normalized as GenreFamily) : "custom";
}

export function getGenreUniverseGuidance(input: GenreUniverseInput = {}): GenreUniverseGuidance {
  const genreFamily = normalizeGenreFamily(input.genreFamily);
  const isLowKey = /\b(soft|intimate|ambient|vulnerable|minimal)\b/i.test(`${input.mood ?? ""} ${input.releaseGoal ?? ""}`);

  const base: GenreUniverseGuidance = {
    genreFamily,
    label: labels[genreFamily],
    arrangementPriorities: [
      "Make the listener understand the main identity before adding secondary colors.",
      "Keep the hook or central motif easy to remember.",
      "Use contrast between sections instead of stacking every idea at once.",
    ],
    rhythmLanguage: ["Define pocket, swing, pulse, or grid before adding fills."],
    harmonicLanguage: ["Use chord movement that supports the emotional promise."],
    drumLanguage: ["Let drums clarify movement without crowding the vocal."],
    vocalModes: ["Choose a clear lead identity before adding stacks, ad-libs, or call-and-response."],
    soundPalette: ["Pick one signature texture and two support textures."],
    runtimeBehavior: [isLowKey ? "Leave more negative space and avoid rushing the first emotional turn." : "Reach the main idea quickly and keep the middle section active."],
    exportNeeds: ["Song fingerprint", "runtime target", "prompt length mode", "rights-aware export notes"],
    avoidList: ["Do not guarantee hits or platform outcomes.", "Do not copy protected artist signatures."],
  };

  const byGenre: Partial<Record<GenreFamily, Partial<GenreUniverseGuidance>>> = {
    hip_hop: {
      rhythmLanguage: ["Prioritize pocket, bar cadence, kick pattern, and hat movement."],
      drumLanguage: ["Use drums as the main energy driver; keep 808 movement purposeful."],
      vocalModes: ["Conversational verse, memorable hook, controlled ad-libs."],
      soundPalette: ["808 or bass focus", "tight drums", "one melodic signature"],
    },
    rnb: {
      rhythmLanguage: ["Use pocket, syncopation, and vocal phrasing as the main motion."],
      harmonicLanguage: ["Favor emotional chord color, extensions, and space for melody."],
      vocalModes: ["Lead intimacy, stacked harmonies, soft response lines."],
      soundPalette: ["warm keys", "subtle bass", "silky vocal texture"],
    },
    pop: {
      arrangementPriorities: ["Reach the hook quickly.", "Keep the title phrase repeatable.", "Make the bridge optional and useful."],
      runtimeBehavior: ["Keep the ideal runtime streaming-friendly unless the song earns a longer arc."],
      soundPalette: ["clear lead vocal", "signature motif", "polished rhythm bed"],
    },
    country: {
      harmonicLanguage: ["Use straightforward harmonic movement that leaves room for lyric specificity."],
      vocalModes: ["Plainspoken lead, harmony lift, story-first delivery."],
      soundPalette: ["guitar texture", "live-feeling rhythm", "warm vocal center"],
    },
    rock: {
      arrangementPriorities: ["Make riff, vocal, and chorus energy distinct."],
      drumLanguage: ["Use live drum movement, fills, and section transitions to signal lift."],
      soundPalette: ["guitars", "live drums", "bass drive"],
    },
    electronic: {
      arrangementPriorities: ["Use build, drop, breakdown, and texture automation intentionally."],
      rhythmLanguage: ["Define pulse, groove, and transition effects."],
      soundPalette: ["synth motif", "sub movement", "transition texture"],
    },
    latin: {
      rhythmLanguage: ["Protect clave, dembow, bachata, or regional rhythm feel where relevant."],
      vocalModes: ["Hook-forward lead with rhythmic phrasing and response moments."],
      avoidList: ["Avoid flattening regional styles into generic Latin texture.", ...base.avoidList],
    },
    afrobeats: {
      rhythmLanguage: ["Use percussion pocket, bounce, and melodic repetition as the center."],
      drumLanguage: ["Keep kick, percussion, and groove interlocked rather than overfilled."],
      soundPalette: ["warm percussion", "melodic plucks", "light vocal stacks"],
    },
    gospel: {
      harmonicLanguage: ["Use lift, resolution, and call-and-response harmony with restraint."],
      vocalModes: ["Lead conviction, choir lift where earned, dynamic ad-libs."],
      soundPalette: ["keys", "choir texture", "live rhythm feel"],
    },
    cinematic: {
      arrangementPriorities: ["Build tension, release, and scale with clear scene function."],
      runtimeBehavior: ["Longer arcs can work when the visual or sync purpose is clear."],
      soundPalette: ["low pulses", "strings or choir", "wide impacts"],
    },
    ambient: {
      arrangementPriorities: ["Use texture, space, and slow development instead of hook pressure."],
      drumLanguage: ["Drums are optional; texture can carry movement."],
      runtimeBehavior: ["Extended runtime is acceptable when the loop or atmosphere evolves."],
    },
    experimental: {
      arrangementPriorities: ["Choose one rule to break and keep the rest intentional."],
      avoidList: ["Do not confuse randomness with identity.", ...base.avoidList],
    },
    spoken: {
      arrangementPriorities: ["Protect words, breath, pacing, and silence."],
      vocalModes: ["Spoken lead, callout lines, light response texture."],
      soundPalette: ["minimal bed", "field texture", "subtle transition cues"],
    },
  };

  return {
    ...base,
    ...(byGenre[genreFamily] ?? {}),
    exportNeeds: [...new Set([...(byGenre[genreFamily]?.exportNeeds ?? []), ...base.exportNeeds])],
  };
}
