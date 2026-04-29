import type { SoundSource } from "./types";

export const soundSourceRegistry: SoundSource[] = [
  {
    id: "user-upload",
    name: "User Owned Uploads",
    homepage: "/library",
    defaultCategory: "user_owned",
    enabled: true,
  },
  {
    id: "sonara-vault",
    name: "SONARA Vault™",
    homepage: "/vault",
    defaultCategory: "redistributable",
    enabled: true,
  },
  {
    id: "research-reference",
    name: "Research References",
    homepage: "/labs",
    defaultCategory: "research_education_only",
    enabled: false,
  },
];
