export const securityConfig = {
  appName: "SONARA OS™",

  protectedServerOnlyFeatures: [
    "stripe_checkout",
    "stripe_webhook",
    "supabase_service_role",
    "subscription_entitlements",
    "user_project_history",
    "generation_history",
    "sound_rights_review",
    "private_exports",
  ],

  publicSafeFeatures: [
    "homepage",
    "pricing_display",
    "store_display",
    "tutorial",
    "trust_page",
    "support_page",
    "public_brand_copy",
  ],

  blockedPublicClaims: [
    "guaranteed profit",
    "guaranteed streams",
    "guaranteed IPO",
    "self-aware",
    "sentient",
    "biometric database",
    "sell third-party kits",
    "public sample marketplace",
  ],

  secretPatterns: [
    "sk_live_",
    "sk_test_",
    "whsec_",
    "SUPABASE_SERVICE_ROLE_KEY=",
    "STRIPE_SECRET_KEY=",
    "STRIPE_WEBHOOK_SECRET=",
    "OPENAI_API_KEY=",
  ],

  securityHeaders: {
    contentSecurityPolicy: true,
    frameOptions: "DENY",
    referrerPolicy: "strict-origin-when-cross-origin",
    permissionsPolicy: true,
    noSniff: true,
  },
} as const;
