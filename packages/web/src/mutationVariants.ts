export type MutationVariant = Readonly<{
  name: string;
  replayScore: number;
  audienceFit: string;
  risk: string;
  recommendation: string;
}>;

export const mutationVariants: readonly MutationVariant[] = Object.freeze([
  Object.freeze({
    name: "Radio Variant",
    replayScore: 92,
    audienceFit: "Broad melodic audience",
    risk: "Low",
    recommendation: "Lead with the hook by bar eight and preserve the clean chorus lift."
  }),
  Object.freeze({
    name: "Dark Variant",
    replayScore: 84,
    audienceFit: "Late-night editorial and mood playlists",
    risk: "Medium",
    recommendation: "Keep the low-end tension, but soften the second pre-chorus density."
  }),
  Object.freeze({
    name: "Short-Form Hook Variant",
    replayScore: 89,
    audienceFit: "Short-form discovery clips",
    risk: "Low",
    recommendation: "Open directly on the vocal motif and export a tight fifteen-second cut."
  })
]);
