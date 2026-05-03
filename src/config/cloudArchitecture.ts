export const cloudArchitecture = {
  principle:
    "SONARA OS™ is cloud-first, browser-first, and PWA-ready. Normal users should not need to download software to use the core product.",

  userRuntime: {
    website: "Vercel",
    app: "Browser / PWA",
    database: "Supabase Postgres",
    auth: "Supabase Auth or configured cloud auth",
    payments: "Stripe Checkout",
    subscriptions: "Stripe + Supabase",
    storage: "Supabase Storage for user-owned or rights-cleared assets",
    exports: "Browser/server generated downloads",
    mobile: "PWA first, native wrappers later",
  },

  notRequiredForUsers: [
    "local Node.js",
    "local npm",
    "local database",
    "local GPU",
    "desktop DAW",
    "command line",
    "OpenAI API key",
    "Stripe account",
    "Supabase account",
    "Vercel account",
  ],

  founderAdminTools: [
    "Vercel dashboard",
    "Supabase dashboard",
    "Stripe dashboard",
    "GitHub/Codex",
    "Google Play Console later",
    "Apple Developer later",
  ],

  optionalFutureCloudServices: [
    "Qdrant Cloud or self-hosted vector search",
    "Cloudflare R2 or S3-compatible storage",
    "Supabase Edge Functions",
    "Vercel Cron",
    "server-side audio analysis workers",
    "Capacitor cloud build/native packaging later",
  ],

  launchCloudStack: ["Vercel", "Supabase", "Stripe", "GitHub", "PWA"],
} as const;
