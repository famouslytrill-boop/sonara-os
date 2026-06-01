import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderOpenSourceIntakeBlockedPage,
  renderOpenSourceIntakePage,
  renderOpenSourceIntakeReviewsPage,
  renderOpenSourceRiskPage
} from "./app/admin/open-source-intake/page-common.ts";
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

describe("open-source intake routes", () => {
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

  it("registers intake routes as admin-gated", () => {
    for (const route of [
      "/admin/open-source-intake",
      "/admin/open-source-intake/reviews",
      "/admin/open-source-intake/blocked",
      "/security-center/open-source-risk"
    ]) {
      expect(isKnownRoute(route)).toBe(true);
      expect(getRouteDefinition(route)).toMatchObject({ auth: "admin-ready" });
    }
  });

  it("renders the dashboard, review, blocked, and security-risk pages", () => {
    const text = [
      renderOpenSourceIntakePage(),
      renderOpenSourceIntakeReviewsPage(),
      renderOpenSourceIntakeBlockedPage(),
      renderOpenSourceRiskPage()
    ]
      .map((page) => collectText(page))
      .join(" ");
    expect(text).toContain("Open-Source Intake Registry");
    expect(text).toContain("frappe/erpnext");
    expect(text).toContain("Google-Maps-Scrapper");
    expect(text).toContain("Open-Source Risk");
    expect(text).not.toMatch(/sk_live|whsec_|token|secret key/i);
  });
});
