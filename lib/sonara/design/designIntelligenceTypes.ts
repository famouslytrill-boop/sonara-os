export type DesignAuditStatus = "passing" | "warning" | "blocked";

export type DesignAuditResult = {
  score: number;
  status: DesignAuditStatus;
  strengths: string[];
  warnings: string[];
  nextActions: string[];
};

export type DesignAuditInput = {
  hasDarkTheme: boolean;
  hasReadableText: boolean;
  hasMobileNav: boolean;
  hasPrimaryCta: boolean;
  usesWarmAccent?: boolean;
  hasTrustLinks?: boolean;
};
