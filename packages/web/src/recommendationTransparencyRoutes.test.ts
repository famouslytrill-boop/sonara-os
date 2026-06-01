import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderProductRecommendationsPage,
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

describe("recommendation transparency routes", () => {
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

  it("registers the requested product, audit, and safety routes", () => {
    for (const route of [
      "/business-builder/recommendations",
      "/creator-studio/recommendations",
      "/growth-studio/recommendations",
      "/admin/recommendation-audit",
      "/security-center/recommendation-safety"
    ]) {
      expect(isKnownRoute(route)).toBe(true);
    }

    expect(getRouteDefinition("/admin/recommendation-audit")).toMatchObject({
      auth: "admin-ready",
      surface: "admin"
    });
    expect(getRouteDefinition("/security-center/recommendation-safety")).toMatchObject({
      auth: "admin-ready",
      surface: "admin"
    });
  });

  it("renders explainable recommendations without auto-execution claims", () => {
    const page = renderProductRecommendationsPage("Growth Studio") as unknown as FakeElement;
    const text = collectText(page);

    expect(text).toContain("Smart Recommendations");
    expect(text).toContain("Data used");
    expect(text).toContain("Data not used");
    expect(text).toContain("Next action");
    expect(text).toContain("Owner Confirmation Lock");
    expect(text).toContain("Auto execution");
    expect(text).toContain("Disabled");
  });

  it("renders admin audit and safety surfaces with blocked behavior language", () => {
    const text = `${collectText(renderRecommendationAuditPage() as unknown as FakeElement)} ${collectText(
      renderRecommendationSafetyPage() as unknown as FakeElement
    )}`;

    expect(text).toContain("Recommendation Audit");
    expect(text).toContain("Recommendation Safety");
    expect(text).toContain("Sensitive attributes");
    expect(text).toContain("fake urgency");
    expect(text).toContain("automatic campaign sends");
  });
});

function collectText(node: unknown): string {
  if (typeof node === "string") {
    return node;
  }
  if (!(node instanceof FakeElement)) {
    return "";
  }
  return [node.textContent, ...node.children.map(collectText)].filter(Boolean).join(" ");
}
