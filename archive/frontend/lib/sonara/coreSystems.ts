export const sonaraCoreSystemRegistry = [
  { name: "Song Fingerprint", status: "active", purpose: "Identity, mood, audience signal, and sonic palette." },
  { name: "Anti-Repetition", status: "stubbed", purpose: "Flags repeated phrases and overused release copy." },
  { name: "Differentiation", status: "stubbed", purpose: "Checks whether a plan has a clear artist-specific edge." },
  { name: "Generic Phrase Gate", status: "stubbed", purpose: "Blocks vague music-business copy before export." },
  { name: "Rights-Safe Influence Converter", status: "stubbed", purpose: "Turns references into rights-safe direction notes." },
  { name: "Human Authorship Meter", status: "stubbed", purpose: "Keeps authorship and creator intent visible." },
  { name: "Creative Proof Ledger", status: "stubbed", purpose: "Captures evidence for decisions, assets, credits, and approvals." },
  { name: "Breath Control / Performance Core", status: "active", purpose: "Checks hook pacing, delivery pressure, and performance clarity." },
  { name: "Streaming Readiness", status: "active", purpose: "Prepares metadata, credits, cover state, and release checklist." },
  { name: "Broadcasting Card", status: "active", purpose: "Packages talking points and listener moment." },
  { name: "Visual Prompt Builder", status: "stubbed", purpose: "Creates visual direction without cloning protected likenesses." },
  { name: "Sound Pack Builder", status: "active", purpose: "Builds license-safe sound pack manifests." },
  { name: "Full Export Bundle", status: "active", purpose: "Packages release plan, checks, legal footer, and manifests." },
] as const;

export function createBreathControlMarkers(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const phraseCount = Math.max(1, Math.ceil(words.length / 8));

  return Array.from({ length: phraseCount }, (_, index) => ({
    marker: `Breath ${index + 1}`,
    words: words.slice(index * 8, index * 8 + 8).join(" "),
  }));
}
