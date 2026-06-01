import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOrganizationSetupContext } from "./lib/auth/index.ts";
import { renderProtectedRoute } from "./ui/auth/protected-route.ts";

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

describe("protected route UI", () => {
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

  it("does not render admin-only preview content when access is blocked", () => {
    const rendered = renderProtectedRoute({
      auth: "admin-ready",
      context: createOrganizationSetupContext(),
      routeLabel: "Admin Only",
      render: () => {
        const element = document.createElement("section");
        element.textContent = "Admin secret queue";
        return element;
      },
      renderBlockedPreview: () => {
        const element = document.createElement("section");
        element.textContent = "Blocked preview secret";
        return element;
      }
    }) as unknown as FakeElement;

    const text = collectText(rendered);
    expect(text).toContain("Protected route");
    expect(text).toContain("Sign-in wiring is required");
    expect(text).not.toContain("Admin secret queue");
    expect(text).not.toContain("Blocked preview secret");
  });
});
