import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ownerConfirmationCategories } from "@signal-os/owner-confirmation-lock";
import { renderAdminCommandCenterPage } from "./app/admin/command-center/page.ts";
import {
  adminSidebarLinks,
  createAdminCommandCenterSnapshot,
  createOwnerApprovalItems
} from "./lib/admin-command-center/index.ts";
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

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
}

const originalDocument = globalThis.document;

function collectText(node: unknown): string {
  if (!(node instanceof FakeElement)) {
    return "";
  }
  return [node.textContent, ...node.children.map(collectText)].join(" ");
}

describe("admin command center", () => {
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

  it("registers admin command routes as admin-ready", () => {
    for (const link of adminSidebarLinks) {
      expect(isKnownRoute(link.route)).toBe(true);
      expect(getRouteDefinition(link.route)).toMatchObject({ auth: "admin-ready" });
    }
  });

  it("covers every owner-confirmation category in approval cards", () => {
    expect(createOwnerApprovalItems().map((item) => item.category)).toEqual(
      ownerConfirmationCategories
    );
  });

  it("renders command center without exposing secret-like values", () => {
    const rendered = renderAdminCommandCenterPage() as unknown as FakeElement;
    const text = collectText(rendered);
    expect(text).toContain("Administrator Command Center");
    expect(text).toContain("Monthly recurring revenue");
    expect(text).toContain("Stripe webhook status");
    expect(text).toContain("Owner approval is required before execution");
    expect(text).not.toMatch(/sk_live|whsec_|SUPABASE_SERVICE_ROLE_KEY|payout destination/i);
  });

  it("keeps revenue and platform totals in setup mode until real data exists", () => {
    const snapshot = createAdminCommandCenterSnapshot();
    expect(snapshot.metrics.some((metric) => metric.title === "Total users")).toBe(true);
    expect(snapshot.revenue.map((metric) => metric.value)).toContain("Placeholder");
    expect(snapshot.metrics.map((metric) => metric.value).join(" ")).toMatch(/No live data yet/i);
  });
});
