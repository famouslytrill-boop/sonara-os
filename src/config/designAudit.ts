export const designAudit = {
  targetScore: 9.5,

  criteria: [
    "clear value proposition within 5 seconds",
    "music as a whole, not only AI generation",
    "warm premium visual identity",
    "mobile-first layout",
    "clear CTAs",
    "readable typography",
    "trust signals visible",
    "pricing easy to understand",
    "create workflow easy for beginners",
    "advanced tools not overwhelming",
    "no fake guarantees",
    "no public kit marketplace at launch",
  ],

  requiredPages: [
    "/",
    "/create",
    "/pricing",
    "/store",
    "/tutorial",
    "/trust",
    "/support",
  ],
} as const;
