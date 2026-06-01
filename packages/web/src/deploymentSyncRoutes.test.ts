import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderDeploymentSecurityPage,
  renderDeploymentSyncDockerRancherPage,
  renderDeploymentSyncDomainPage,
  renderDeploymentSyncGitHubPage,
  renderDeploymentSyncPage,
  renderDeploymentSyncStripePage,
  renderDeploymentSyncSupabasePage,
  renderDeploymentSyncVercelPage
} from "./app/admin/deployment-sync/page-common.ts";
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

describe("deployment sync routes", () => {
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

  it("registers deployment sync and canonical app routes with the correct auth boundary", () => {
    for (const route of [
      "/admin/deployment-sync",
      "/admin/deployment-sync/domain",
      "/admin/deployment-sync/github",
      "/admin/deployment-sync/vercel",
      "/admin/deployment-sync/supabase",
      "/admin/deployment-sync/stripe",
      "/admin/deployment-sync/docker-rancher",
      "/security-center/deployment-security"
    ]) {
      expect(isKnownRoute(route)).toBe(true);
      expect(getRouteDefinition(route)).toMatchObject({ auth: "admin-ready" });
    }

    for (const route of [
      "/app",
      "/app/business-builder",
      "/app/creator-studio",
      "/app/growth-studio",
      "/app/billing",
      "/app/onboarding"
    ]) {
      expect(isKnownRoute(route)).toBe(true);
      expect(getRouteDefinition(route)).toMatchObject({ auth: "auth-ready" });
    }
  });

  it("renders deployment sync sections without exposing secrets", () => {
    const text = [
      renderDeploymentSyncPage(),
      renderDeploymentSyncDomainPage(),
      renderDeploymentSyncGitHubPage(),
      renderDeploymentSyncVercelPage(),
      renderDeploymentSyncSupabasePage(),
      renderDeploymentSyncStripePage(),
      renderDeploymentSyncDockerRancherPage(),
      renderDeploymentSecurityPage()
    ]
      .map((page) => collectText(page))
      .join(" ");

    expect(text).toContain("Deployment Sync");
    expect(text).toContain("sonaraindustries.com");
    expect(text).toContain("GitHub");
    expect(text).toContain("Vercel");
    expect(text).toContain("Supabase");
    expect(text).toContain("Stripe");
    expect(text).toContain("Docker");
    expect(text).toContain("Rancher");
    expect(text).toContain("Auth");
    expect(text).toContain("Paywall");
    expect(text).toContain("Security");
    expect(text).not.toMatch(/sk_live_[a-z0-9]+|whsec_[a-z0-9]+|postgres:\/\/|do-not-print/i);
  });
});
