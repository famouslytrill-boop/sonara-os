import type { SoundIdentityResult } from "./soundIdentityTypes";

export function buildSoundIdentity(notes = ""): SoundIdentityResult {
  const normalized = notes.toLowerCase();
  return {
    signatureElements: [
      normalized.includes("guitar") ? "human guitar texture" : "one memorable melodic motif",
      normalized.includes("808") ? "controlled 808 movement" : "clear low-end identity",
      normalized.includes("vocal") ? "lead vocal phrasing" : "defined vocal mode",
    ],
    differentiationChecks: ["Avoid generic genre filler.", "Protect one unique key, rhythm, and vocal mode.", "Do not copy a living artist's protected expression."],
    avoidList: ["celebrity cloning", "unlicensed sample identity", "overloaded prompt references"],
  };
}
