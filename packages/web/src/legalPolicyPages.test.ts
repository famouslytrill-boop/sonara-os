import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderAcceptableUsePage,
  renderContactPolicyPage,
  renderDisclaimersPage,
  renderPrivacyPage,
  renderRefundPolicyPage,
  renderSecurityPolicyPage,
  renderTermsPage
} from "./app/legal-policy-pages.ts";
import { publicMarketingRoutes } from "./lib/public-marketing/index.ts";
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

describe("legal and policy pages", () => {
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

  it("registers all launch policy routes as public review-ready pages", () => {
    for (const route of [
      "/terms",
      "/privacy",
      "/refund-policy",
      "/acceptable-use",
      "/security",
      "/disclaimers",
      "/contact"
    ]) {
      expect(isKnownRoute(route)).toBe(true);
      expect(publicMarketingRoutes).toContain(route);
      expect(getRouteDefinition(route)).toMatchObject({
        auth: "public",
        launchStatus: "required"
      });
    }
  });

  it("marks policy pages as drafts and avoids fake legal authority", () => {
    const copy = [
      renderTermsPage(),
      renderPrivacyPage(),
      renderRefundPolicyPage(),
      renderAcceptableUsePage(),
      renderSecurityPolicyPage(),
      renderDisclaimersPage(),
      renderContactPolicyPage()
    ]
      .map(collectText)
      .join(" ");

    expect(copy).toMatch(/Attorney-review-ready draft/i);
    expect(copy).toMatch(/Owner Confirmation Lock/i);
    expect(copy).toMatch(/not legal advice/i);
    expect(copy).toMatch(/does not claim guaranteed legal compliance/i);
    expect(copy).toMatch(/does not store raw card numbers/i);
    expect(copy).toMatch(/does not store CVV/i);
    expect(copy).not.toMatch(
      /replaces a lawyer|certified legal compliance|AI outputs are professional advice/i
    );
  });
});
