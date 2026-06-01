export const brandIdentity = Object.freeze({
  parentName: "SONARA Industries",
  platformName: "SONARA One",
  platformDisplayName: "SONARA One™",
  tagline: "Build. Create. Grow.",
  productPromise: "Build. Prove. Get paid. Grow.",
  products: Object.freeze({
    businessBuilder: "Business Builder",
    creatorStudio: "Creator Studio",
    growthStudio: "Growth Studio"
  })
});

export const brandTokens = Object.freeze({
  color: Object.freeze({
    surface0: "#070912",
    surface1: "#0b1020",
    surface2: "#111827",
    panel: "rgba(8, 12, 24, 0.88)",
    panelStrong: "rgba(11, 16, 32, 0.94)",
    border: "rgba(170, 190, 255, 0.18)",
    borderStrong: "rgba(170, 190, 255, 0.28)",
    text: "#eef4ff",
    textStrong: "#ffffff",
    textMuted: "#b9c5dc",
    textSubtle: "#8fa0bd",
    accent: "#6f8cff",
    accentStrong: "#315cff",
    focus: "#9db8ff",
    warning: "#ffdca8",
    danger: "#fecaca",
    success: "#b8f5d7"
  }),
  productAccent: Object.freeze({
    businessBuilder: "#74d9b0",
    creatorStudio: "#b79cff",
    growthStudio: "#f4c76b"
  })
});

export const statusColors = Object.freeze({
  ready: "#b8f5d7",
  setup: "#c9d7ff",
  review: "#ffdca8",
  blocked: "#fecaca",
  beta: "#d8c7ff"
});

export const brandSpacing = Object.freeze({
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "28px",
  "3xl": "40px"
});

export const brandRadii = Object.freeze({
  control: "8px",
  card: "8px",
  panel: "12px",
  pill: "999px"
});

export const brandShadows = Object.freeze({
  panel: "0 24px 80px rgba(0, 0, 0, 0.32)",
  focus: "0 0 0 3px rgba(157, 184, 255, 0.24)"
});

export const brandTypography = Object.freeze({
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  displayLineHeight: "1",
  bodyLineHeight: "1.6",
  letterSpacing: "0"
});

export const brandCssVariables = Object.freeze({
  "--sonara-surface-0": brandTokens.color.surface0,
  "--sonara-surface-1": brandTokens.color.surface1,
  "--sonara-surface-2": brandTokens.color.surface2,
  "--sonara-panel": brandTokens.color.panel,
  "--sonara-panel-strong": brandTokens.color.panelStrong,
  "--sonara-border": brandTokens.color.border,
  "--sonara-border-strong": brandTokens.color.borderStrong,
  "--sonara-text": brandTokens.color.text,
  "--sonara-text-strong": brandTokens.color.textStrong,
  "--sonara-text-muted": brandTokens.color.textMuted,
  "--sonara-text-subtle": brandTokens.color.textSubtle,
  "--sonara-accent": brandTokens.color.accent,
  "--sonara-accent-strong": brandTokens.color.accentStrong,
  "--sonara-focus": brandTokens.color.focus,
  "--sonara-warning": brandTokens.color.warning,
  "--sonara-danger": brandTokens.color.danger,
  "--sonara-success": brandTokens.color.success,
  "--sonara-business-accent": brandTokens.productAccent.businessBuilder,
  "--sonara-creator-accent": brandTokens.productAccent.creatorStudio,
  "--sonara-growth-accent": brandTokens.productAccent.growthStudio,
  "--sonara-radius-control": brandRadii.control,
  "--sonara-radius-card": brandRadii.card,
  "--sonara-radius-panel": brandRadii.panel,
  "--sonara-radius-pill": brandRadii.pill,
  "--sonara-shadow-panel": brandShadows.panel,
  "--sonara-shadow-focus": brandShadows.focus
});

export type BrandColorToken = keyof typeof brandTokens.color;
export type BrandCssVariableName = keyof typeof brandCssVariables;
