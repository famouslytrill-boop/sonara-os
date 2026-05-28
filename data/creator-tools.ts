export type CreatorToolCategory = "animation" | "open-source" | "video" | "design" | "ai-agents";
export type CreatorToolStatus = "external_reference" | "research_only" | "needs_license_review" | "blocked_until_review";

export type CreatorToolRecord = {
  name: string;
  slug: string;
  category: CreatorToolCategory;
  status: CreatorToolStatus;
  useCase: string;
  productFit: string[];
  notes: string;
  safety: string[];
};

export const creatorTools: CreatorToolRecord[] = [
  {
    name: "OpenToonz",
    slug: "opentoonz",
    category: "animation",
    status: "external_reference",
    useCase: "2D animation planning, project checklists, and creator workflow notes.",
    productFit: ["Creator Studio", "Asset Vault", "Project Launch Checklist"],
    notes: "External animation reference only. SONARA does not bundle or host OpenToonz.",
    safety: ["review license before redistribution", "do not redistribute third-party assets", "do not imply native integration"],
  },
  {
    name: "LongLive-style long-video research",
    slug: "longlive-video-research",
    category: "video",
    status: "research_only",
    useCase: "Long-video workflow research, performance planning, and render cost awareness.",
    productFit: ["Creator Studio", "Research Lab", "Performance Planner"],
    notes: "Research-only reference. No video-generation model weights or dependencies are bundled.",
    safety: ["no deepfake tooling", "no impersonation", "no non-consensual likeness generation", "license review required"],
  },
  {
    name: "Miro-style collaboration patterns",
    slug: "miro-style-collaboration-patterns",
    category: "design",
    status: "research_only",
    useCase: "Visual planning, board organization, and collaboration UX research.",
    productFit: ["Creator Studio", "Business Builder", "Growth Studio"],
    notes: "Pattern research only. SONARA does not copy Miro UI or claim a native Miro integration.",
    safety: ["no copied UI", "no private-board scraping", "API/legal review before integration"],
  },
  {
    name: "AI builder tool lists",
    slug: "ai-builder-tool-lists",
    category: "ai-agents",
    status: "needs_license_review",
    useCase: "Developer workflow research, agent safety policy, and prompt playbook organization.",
    productFit: ["Creator Studio", "Prompt Playbook", "Research Lab"],
    notes: "Curated reference category only. Unknown tools default to review-required.",
    safety: ["no auto-install", "no production write access", "no secret sharing", "owner approval for expensive runs"],
  },
  {
    name: "Open-source creator workflow references",
    slug: "open-source-creator-workflows",
    category: "open-source",
    status: "needs_license_review",
    useCase: "Collect tool setup notes, rights notes, and safe creator templates.",
    productFit: ["Creator Tool Library", "Asset Vault", "Creator Passport"],
    notes: "External projects stay reference-only until license and security review is complete.",
    safety: ["no GPL/AGPL copy into proprietary packages", "no false endorsement", "no hidden dependency installs"],
  },
];

export function getCreatorToolsByCategory(category: CreatorToolCategory) {
  return creatorTools.filter((tool) => tool.category === category);
}
