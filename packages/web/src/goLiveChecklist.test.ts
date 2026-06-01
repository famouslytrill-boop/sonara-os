import { describe, expect, it } from "vitest";
import {
  getCriticalGoLiveBlockers,
  goLiveCategoryLabels,
  goLiveChecklistItems,
  summarizeGoLiveChecklist,
  type GoLiveCategory,
  type GoLiveStatus
} from "./lib/go-live/index.ts";
import { getRouteDefinition, isKnownRoute } from "./routes/route-manifest.ts";

const requiredCategories: readonly GoLiveCategory[] = Object.freeze([
  "domain",
  "ssl",
  "env_vars",
  "database",
  "auth",
  "stripe",
  "webhooks",
  "security_headers",
  "source_leak_scan",
  "rls",
  "admin_protection",
  "backups",
  "monitoring",
  "public_pages",
  "pricing",
  "onboarding",
  "email_support",
  "legal_pages",
  "mobile_layout"
]);

const allowedStatuses: readonly GoLiveStatus[] = Object.freeze([
  "not_started",
  "needs_review",
  "ready",
  "blocked"
]);

describe("go-live checklist", () => {
  it("covers required production launch categories", () => {
    const categories = new Set(goLiveChecklistItems.map((item) => item.category));
    for (const category of requiredCategories) {
      expect(goLiveCategoryLabels[category]).toBeTruthy();
      expect(categories.has(category)).toBe(true);
    }
  });

  it("uses only supported statuses and blocks launch on critical open items", () => {
    for (const item of goLiveChecklistItems) {
      expect(allowedStatuses).toContain(item.status);
    }

    const summary = summarizeGoLiveChecklist();

    expect(summary.total).toBe(goLiveChecklistItems.length);
    expect(summary.launchStatus).toBe("no_go");
    expect(summary.criticalOpen).toBeGreaterThan(0);
    expect(getCriticalGoLiveBlockers().every((item) => item.critical)).toBe(true);
  });

  it("registers the admin go-live checklist as a launch-required route", () => {
    expect(isKnownRoute("/admin/go-live-checklist")).toBe(true);
    expect(getRouteDefinition("/admin/go-live-checklist")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required",
      surface: "admin"
    });
  });
});
