import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderAiCostControlPage,
  renderGitHubUpdateWatcherPage,
  renderMarketPatternLabPage,
  renderNotificationSettingsPage,
  renderProductionReadinessPage,
  renderProfitabilityDashboardPage,
  renderSecuritySettingsPage
} from "./app/admin/master-sprint-pages.ts";
import {
  renderRecommendationAuditPage,
  renderRecommendationSafetyPage
} from "./app/recommendations/page-common.ts";
import { getRouteDefinition, isKnownRoute } from "./routes/route-manifest.ts";

class FakeElement {
  className = "";
  textContent = "";
  readonly attributes = new Map<string, string>();
  readonly children: unknown[] = [];

  constructor(readonly tagName: string) {}

  append(...nodes: unknown[]) {
    this.children.push(...nodes);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

const originalDocument = globalThis.document;

function collectText(node: unknown): string {
  if (!(node instanceof FakeElement)) {
    return "";
  }
  return [node.textContent, ...node.children.map(collectText)].join(" ");
}

describe("master sprint routes", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: (tagName: string) => new FakeElement(tagName)
      }
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument
    });
  });

  it("registers admin and app aliases with safe auth boundaries", () => {
    for (const route of [
      "/admin/github-update-watcher",
      "/admin/ai-cost-control",
      "/admin/production-readiness",
      "/admin/security-settings",
      "/admin/recommendation-audit",
      "/admin/market-pattern-lab",
      "/admin/notification-settings",
      "/admin/profitability-dashboard",
      "/security-center/recommendation-safety",
      "/app/admin/github-update-watcher",
      "/app/admin/open-source-intake",
      "/app/admin/production-readiness"
    ]) {
      expect(isKnownRoute(route)).toBe(true);
      expect(getRouteDefinition(route)).toMatchObject({ auth: "admin-ready" });
    }
  });

  it("renders setup-mode dashboards without secrets or fake live status", () => {
    const text = [
      renderGitHubUpdateWatcherPage(),
      renderAiCostControlPage(),
      renderProductionReadinessPage(),
      renderSecuritySettingsPage(),
      renderRecommendationAuditPage(),
      renderRecommendationSafetyPage(),
      renderMarketPatternLabPage(),
      renderNotificationSettingsPage(),
      renderProfitabilityDashboardPage()
    ]
      .map((page) => collectText(page))
      .join(" ");

    expect(text).toContain("GitHub Update Watcher");
    expect(text).toContain("AI Cost Control");
    expect(text).toContain("Recommendation Audit");
    expect(text).toContain("Recommendation Safety");
    expect(text).toContain("Profitability Dashboard");
    expect(text).toContain("setup-mode");
    expect(text).not.toMatch(/sk_live|whsec_|postgres:\/\//i);
    expect(text).not.toContain("Verified production connection");
  });
});
