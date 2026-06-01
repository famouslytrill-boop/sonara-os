export const sonaraBrandExperience = Object.freeze({
  parent: "SONARA Industries",
  platform: "SONARA One",
  tagline: "Independent systems. Shared infrastructure. Stronger markets.",
  finalMessage: "Build. Prove. Get paid. Grow.",
  publicProducts: Object.freeze(["Business Builder", "Creator Studio", "Growth Studio"]),
  copyRules: Object.freeze([
    "Use plain customer-facing language.",
    "Do not overuse internal engine names.",
    "Do not overuse AI as a promise.",
    "Do not make guaranteed revenue, legal, financial, or security claims."
  ])
});

export function getBrandExperienceSummary(): string {
  return `${sonaraBrandExperience.platform}: ${sonaraBrandExperience.finalMessage}`;
}
