export type GrowthSignalCategory =
  | "content_quality"
  | "audience_fit"
  | "consistency"
  | "timing"
  | "format"
  | "campaign_learning"
  | "review_readiness";

export type GrowthSignal = {
  category: GrowthSignalCategory;
  label: string;
  allowedUse: string;
  blockedUse: string;
};

export const growthSignalTaxonomy: GrowthSignal[] = [
  {
    category: "content_quality",
    label: "Content quality",
    allowedUse: "Improve clarity, proof, offer structure, and useful customer education.",
    blockedUse: "Do not create clickbait, fake claims, fake proof, or deceptive urgency.",
  },
  {
    category: "audience_fit",
    label: "Audience fit",
    allowedUse: "Match offers and educational content to user-provided audience context.",
    blockedUse: "Do not target sensitive personal attributes or discriminatory segments.",
  },
  {
    category: "consistency",
    label: "Consistency",
    allowedUse: "Plan sustainable posting, follow-up, review, and referral routines.",
    blockedUse: "Do not automate spam, botting, fake engagement, or platform-rule bypass.",
  },
  {
    category: "timing",
    label: "Timing observations",
    allowedUse: "Record public timing observations and owner-provided campaign results.",
    blockedUse: "Do not scrape private user data or claim guaranteed reach.",
  },
  {
    category: "format",
    label: "Format comparison",
    allowedUse: "Compare public formats such as explainers, checklists, demos, and testimonials.",
    blockedUse: "Do not fake testimonials, logos, customer proof, or endorsements.",
  },
  {
    category: "campaign_learning",
    label: "Campaign learning notes",
    allowedUse: "Summarize what worked, what did not, and what to test next.",
    blockedUse: "Do not infer private traits or manipulate customers.",
  },
  {
    category: "review_readiness",
    label: "Review readiness",
    allowedUse: "Queue owner-approved review request drafts for customers with permission.",
    blockedUse: "Do not send review requests without consent or owner approval.",
  },
];
