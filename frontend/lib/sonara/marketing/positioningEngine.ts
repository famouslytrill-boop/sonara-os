import type { PositioningProfile } from "./positioningTypes";

export function getSonaraPositioning(): PositioningProfile {
  return {
    audience: "artists, producers, creators, local businesses, labels, and digital product builders",
    promise: "SONARA turns creative ideas into organized, release-ready systems without requiring paid model access.",
    proofPoints: [
      "local rules engine",
      "runtime and prompt guidance",
      "rights-aware exports",
      "OBS-ready broadcast kit",
      "supervised autonomy checks",
    ],
    avoidClaims: [
      "guaranteed revenue",
      "fake testimonials",
      "fake user numbers",
      "celebrity cloning",
      "literal autonomy-overclaim language",
    ],
  };
}
