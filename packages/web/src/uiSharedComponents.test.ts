import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderDashboardHeader,
  renderMobileBottomNav,
  renderProductCard,
  renderStatusBadge
} from "./ui/shared-components.ts";
import type { RouteDefinition } from "./routes/route-manifest.ts";

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

describe("shared UI components", () => {
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

  it("renders dashboard headers and product cards with consistent classes", () => {
    const header = renderDashboardHeader({
      kicker: "Product",
      title: "Business Builder",
      description: "Setup proof, payments, booking, intake, reviews, and customer records."
    }) as unknown as FakeElement;
    const card = renderProductCard({
      title: "Proof Profile",
      description: "Set this up before launch.",
      status: "Setup required",
      href: "/business-builder"
    }) as unknown as FakeElement;

    expect(header.className).toContain("dashboard-header");
    expect(card.className).toContain("product-card");
    expect(card.children.length).toBeGreaterThan(2);
  });

  it("renders status badges and mobile bottom navigation accessibly", () => {
    const badge = renderStatusBadge("Beta", "beta") as unknown as FakeElement;
    const routes: RouteDefinition[] = [
      {
        route: "/business-builder",
        label: "Business",
        surface: "product",
        nav: true,
        launchRequired: true,
        launchStatus: "required",
        auth: "public"
      }
    ];
    const nav = renderMobileBottomNav({
      activeRoute: "/business-builder",
      routes
    }) as unknown as FakeElement;
    const link = nav.children[0] as FakeElement;

    expect(badge.className).toContain("status-badge--beta");
    expect(nav.getAttribute("aria-label")).toBe("Primary mobile navigation");
    expect(link.getAttribute("aria-current")).toBe("page");
  });
});
