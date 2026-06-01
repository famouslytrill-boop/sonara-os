import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderAdminPromptLibraryPage,
  renderBusinessAiPlaybooksPage,
  renderCreatorAiPlaybooksPage,
  renderGrowthAiPlaybooksPage,
  renderPromptLibraryPage,
  renderPromptSafetyPage
} from "./app/prompt-playbooks/page-common.ts";
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

describe("prompt playbook routes", () => {
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

  it("registers the requested app prompt-library routes", () => {
    for (const route of [
      "/app/prompt-library",
      "/app/business-builder/ai-playbooks",
      "/app/creator-studio/ai-playbooks",
      "/app/growth-studio/ai-playbooks",
      "/app/admin/prompt-library",
      "/app/security-center/prompt-safety"
    ]) {
      expect(isKnownRoute(route)).toBe(true);
    }
    expect(getRouteDefinition("/app/admin/prompt-library")).toMatchObject({
      auth: "admin-ready",
      surface: "admin"
    });
    expect(getRouteDefinition("/app/security-center/prompt-safety")).toMatchObject({
      auth: "admin-ready",
      surface: "admin"
    });
  });

  it("renders product prompt libraries with preview, quality, and approval controls", () => {
    const text = [
      renderPromptLibraryPage(),
      renderBusinessAiPlaybooksPage(),
      renderCreatorAiPlaybooksPage(),
      renderGrowthAiPlaybooksPage()
    ]
      .map((page) => collectText(page as unknown as FakeElement))
      .join(" ");

    expect(text).toContain("AI Playbook Center");
    expect(text).toContain("Business Builder AI Playbooks");
    expect(text).toContain("Creator Studio AI Playbooks");
    expect(text).toContain("Growth Studio AI Playbooks");
    expect(text).toContain("Prompt quality");
    expect(text).toContain("Generated prompt preview");
    expect(text).toContain("Copy prompt");
    expect(text).toContain("Save template");
  });

  it("renders admin prompt safety with blocked behavior and owner review language", () => {
    const text = `${collectText(renderAdminPromptLibraryPage() as unknown as FakeElement)} ${collectText(
      renderPromptSafetyPage() as unknown as FakeElement
    )}`;

    expect(text).toContain("Admin Prompt Library");
    expect(text).toContain("Prompt Safety");
    expect(text).toContain("Owner Confirmation Lock");
    expect(text).toContain("Auto-send prompt outputs");
    expect(text).toContain("Disabled");
    expect(text).toContain("fake reviews");
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
