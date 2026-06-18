import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderAdminLoginPage } from "./app/admin/login/page.ts";
import { renderLoginPage } from "./app/login/page.ts";
import { renderSignupPage } from "./app/signup/page.ts";
import { getRouteDefinition, isKnownRoute } from "./routes/route-manifest.ts";

class FakeElement {
  className = "";
  textContent = "";
  href = "";
  type = "";
  id = "";
  name = "";
  autocomplete = "";
  inputmode = "";
  readonly attributes = new Map<string, string>();
  readonly children: unknown[] = [];

  constructor(readonly tagName: string) {}

  append(...nodes: unknown[]) {
    this.children.push(...nodes);
  }

  addEventListener() {
    return undefined;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name in this) {
      (this as unknown as Record<string, string>)[name] = value;
    }
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
}

const originalDocument = globalThis.document;

function collectText(node: unknown): string {
  if (typeof node === "string") {
    return node;
  }
  if (!(node instanceof FakeElement)) {
    return "";
  }
  return [node.textContent, ...node.children.map(collectText)].join(" ");
}

describe("launch auth UI", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: (tagName: string) => new FakeElement(tagName),
        createTextNode: (text: string) => text
      }
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument
    });
  });

  it("keeps /login email-password only without provider setup cards", () => {
    const text = collectText(renderLoginPage());
    expect(text).toContain("Email and password");
    expect(text).toContain("Log in");
    expect(text).toContain("Create account");
    expect(text).not.toMatch(/Google|OAuth|SUPABASE|STRIPE|RESEND|OPENAI|SERVICE_ROLE/i);
  });

  it("keeps /signup customer-facing and hides raw auth readiness language", () => {
    const text = collectText(renderSignupPage());
    expect(text).toContain("Create account");
    expect(text).toContain("Product interest");
    expect(text).not.toMatch(/Google|OAuth|setup_required|login_ready|signup_requested/i);
  });

  it("renders admin login as a password form without secret variable names", () => {
    const text = collectText(renderAdminLoginPage());
    expect(text).toContain("Admin login");
    expect(text).toContain("Founder access");
    expect(text).toContain("Password");
    expect(text).toContain("Sign in");
    expect(text).not.toMatch(/token|ADMIN_ACCESS_TOKEN|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY|OPENAI_API_KEY/i);
  });

  it("registers exact activated workspace routes with access boundaries", () => {
    for (const route of [
      "/business-builder/dashboard",
      "/business-builder/business-profile",
      "/business-builder/intake",
      "/creator-studio/dashboard",
      "/creator-studio/projects",
      "/growth-studio/dashboard",
      "/growth-studio/leads"
    ]) {
      expect(isKnownRoute(route)).toBe(true);
      expect(getRouteDefinition(route)).toMatchObject({ auth: "auth-ready" });
    }
    expect(getRouteDefinition("/business-builder/employees")).toMatchObject({
      auth: "admin-ready"
    });
    expect(getRouteDefinition("/growth-studio/analytics")).toMatchObject({ auth: "admin-ready" });
  });
});
