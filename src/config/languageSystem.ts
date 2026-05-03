export const languageSystem = {
  defaultLocale: "en-US",
  supportedLaunchLocales: ["en-US"],
  plannedLocales: [
    "es",
    "fr",
    "pt-BR",
    "hi",
    "ar",
    "zh-CN",
    "ja",
    "ko",
    "de",
    "sw",
    "yo",
  ],
  writingDirection: {
    ar: "rtl",
    "en-US": "ltr",
  },
  localizationRules: [
    "Avoid slang in core UI labels.",
    "Keep buttons short.",
    "Use plain sentences.",
    "Do not hardcode culturally specific examples in global UI.",
    "Keep music genre labels flexible by region.",
    "Support right-to-left layouts in future.",
  ],
} as const;
