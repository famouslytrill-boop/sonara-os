import { describe, expect, it } from "vitest";
import { findStrategyPage, strategyPages } from "./strategyState.ts";

describe("strategy UI state scaffolding", () => {
  it("defines phases 116 through 135 as routeable pages", () => {
    expect(strategyPages.map((page) => page.route)).toEqual([
      "/signature-memory",
      "/prompt-genome",
      "/producer-copilot",
      "/rights-vault",
      "/release-simulator",
      "/plugin-marketplace",
      "/collaboration-rooms",
      "/label-dashboard",
      "/agent-routing",
      "/readiness-audit",
      "/campaign-assistant",
      "/catalog-compounding",
      "/deal-room",
      "/pricing-models",
      "/knowledge-search",
      "/enterprise-controls",
      "/command-center",
      "/orchestration",
      "/positioning",
      "/readiness-package"
    ]);
  });

  it("keeps each scaffold page display-ready", () => {
    for (const page of strategyPages) {
      expect(page.title).toBeTruthy();
      expect(page.summary).toBeTruthy();
      expect(page.cards.length).toBeGreaterThan(0);
    }
  });

  it("finds strategy pages by route", () => {
    expect(findStrategyPage("/rights-vault")?.title).toBe("Rights Vault");
    expect(findStrategyPage("/knowledge-search")?.summary).toContain("semantic");
  });
});
