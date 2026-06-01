export type ReleaseFormat = "single" | "EP" | "album" | "staggered drops";
export type StorefrontProduct = "prompt packs" | "drum kits" | "presets" | "instrumentals";

export type TimelinePlan = Readonly<{
  format: ReleaseFormat;
  window: string;
  checkpoint: string;
}>;

export type ContentPlan = Readonly<{
  hook: string;
  caption: string;
  visualizerPrompt: string;
  cadence: string;
}>;

export type VisualizerBoard = Readonly<{
  format: "8-sec loop" | "30-sec promo" | "cover-motion concept";
  direction: string;
  motionCue: string;
}>;

export type StorefrontOffer = Readonly<{
  product: StorefrontProduct;
  priceSignal: string;
  packagingNote: string;
}>;

export type OpportunitySignal = Readonly<{
  label: string;
  value: string;
  nextMove: string;
}>;

export type ScaleState = Readonly<{
  timelinePlans: readonly TimelinePlan[];
  contentPlans: readonly ContentPlan[];
  visualizerBoards: readonly VisualizerBoard[];
  storefrontOffers: readonly StorefrontOffer[];
  revenueOpportunities: readonly OpportunitySignal[];
  licensingOpportunities: readonly OpportunitySignal[];
  catalogLeverageScore: number;
}>;

export const scaleState: ScaleState = Object.freeze({
  timelinePlans: Object.freeze([
    Object.freeze({
      format: "single",
      window: "2-week sprint",
      checkpoint: "Finalize master, cover motion, and three teaser clips."
    }),
    Object.freeze({
      format: "EP",
      window: "6-week runway",
      checkpoint: "Sequence lead single, second drop, and release-week bundle."
    }),
    Object.freeze({
      format: "album",
      window: "10-week campaign",
      checkpoint: "Map singles, pre-save push, visual rollout, and catalog recaps."
    }),
    Object.freeze({
      format: "staggered drops",
      window: "Monthly cadence",
      checkpoint: "Ship one track, one content pack, and one optimization pass per drop."
    })
  ]),
  contentPlans: Object.freeze([
    Object.freeze({
      hook: "Open on the strongest two-second motif.",
      caption: "Late-night replay architecture. Hold attention before release.",
      visualizerPrompt: "Chrome waveform over a slow midnight skyline pulse.",
      cadence: "Three teasers, one release-day clip, two follow-up edits."
    })
  ]),
  visualizerBoards: Object.freeze([
    Object.freeze({
      format: "8-sec loop",
      direction: "Tight motif loop for feed signal surfaces.",
      motionCue: "Pulse logo shimmer on the downbeat."
    }),
    Object.freeze({
      format: "30-sec promo",
      direction: "Verse-to-hook arc with title reveal.",
      motionCue: "Camera drift into chorus bloom."
    }),
    Object.freeze({
      format: "cover-motion concept",
      direction: "Animated cover system for release surfaces.",
      motionCue: "Subtle grain, light sweep, and waveform trace."
    })
  ]),
  storefrontOffers: Object.freeze([
    Object.freeze({
      product: "prompt packs",
      priceSignal: "$19 core bundle",
      packagingNote: "Group by mood, genre, and release outcome."
    }),
    Object.freeze({
      product: "drum kits",
      priceSignal: "$29 producer pack",
      packagingNote: "Include one-shots, loops, and provenance notes."
    }),
    Object.freeze({
      product: "presets",
      priceSignal: "$15 tone pack",
      packagingNote: "Bundle by signature chain and compatible DAW."
    }),
    Object.freeze({
      product: "instrumentals",
      priceSignal: "License-ready tiering",
      packagingNote: "Separate personal, creator, and commercial usage."
    })
  ]),
  revenueOpportunities: Object.freeze([
    Object.freeze({
      label: "Bundle upside",
      value: "$420",
      nextMove: "Package prompt packs with the release content kit."
    }),
    Object.freeze({
      label: "Instrumental reuse",
      value: "$900",
      nextMove: "Prepare two non-exclusive licensing versions."
    })
  ]),
  licensingOpportunities: Object.freeze([
    Object.freeze({
      label: "Short-form sync",
      value: "High fit",
      nextMove: "Cut a clean fifteen-second hook bed."
    }),
    Object.freeze({
      label: "Creator pack",
      value: "Medium fit",
      nextMove: "Add loop-safe stems and usage notes."
    })
  ]),
  catalogLeverageScore: 82
});
