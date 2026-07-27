export const designSystem = {
  themeName: "SONARA Warm Editorial Music-Tech",

  brandMood: [
    "premium",
    "warm",
    "human",
    "music-focused",
    "creator-friendly",
    "global",
    "trustworthy",
    "modern",
  ],

  colors: {
    backgroundLight: "#F6F0E8",
    backgroundDark: "#09070D",
    surfaceLight: "#FFF9F0",
    surfaceDark: "#15111F",

    inkText: "#17131F",
    softText: "#6E657A",
    mutedText: "#9A8FA8",

    deepPlum: "#2B153F",
    electricViolet: "#8B5CF6",
    warmGold: "#F5B84B",
    signalCyan: "#29D3C2",
    coralAccent: "#FF6B6B",

    borderLight: "#E6D8C8",
    borderDark: "#342A46",

    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
  },

  gradients: {
    hero: "radial-gradient(circle at top left, rgba(139,92,246,0.22), transparent 34%), radial-gradient(circle at 80% 20%, rgba(245,184,75,0.22), transparent 32%), linear-gradient(135deg, #F6F0E8 0%, #FFF9F0 45%, #EEE4FF 100%)",
    darkHero:
      "radial-gradient(circle at top left, rgba(139,92,246,0.30), transparent 35%), radial-gradient(circle at bottom right, rgba(245,184,75,0.18), transparent 35%), linear-gradient(135deg, #09070D 0%, #15111F 100%)",
    brand:
      "linear-gradient(135deg, #8B5CF6 0%, #FF6B6B 48%, #F5B84B 100%)",
    cool: "linear-gradient(135deg, #29D3C2 0%, #8B5CF6 100%)",
  },

  radii: {
    card: "1.5rem",
    panel: "2rem",
    button: "999px",
    input: "1rem",
  },

  shadows: {
    soft: "0 20px 70px rgba(43,21,63,0.14)",
    dark: "0 24px 90px rgba(0,0,0,0.38)",
    glow: "0 0 42px rgba(139,92,246,0.22)",
  },

  layout: {
    maxWidth: "1180px",
    pagePadding: "clamp(1rem, 4vw, 3rem)",
    cardGap: "1rem",
  },
} as const;
