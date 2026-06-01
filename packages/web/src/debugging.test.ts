import { afterEach, describe, expect, it } from "vitest";
import { normalizeRoute } from "./app.ts";
import {
  createApiErrorResponse,
  createClientSafeError,
  createDiagnosticsSnapshot,
  redactLogContext,
  sanitizeClientMessage
} from "./index.ts";
import { getRouteDefinition, isKnownRoute } from "./routes/route-manifest.ts";

type DiagnosticsConfigGlobal = typeof globalThis & {
  __SONARA_DEPLOYMENT_CONFIG__?: {
    appVersion?: string;
    environment?: string;
    diagnostics?: {
      database?: {
        configured?: boolean;
        message?: string;
      };
      stripe?: {
        configured?: boolean;
        message?: string;
      };
      aiProviders?: {
        configured?: boolean;
        message?: string;
      };
    };
  };
};

const diagnosticsGlobal = globalThis as DiagnosticsConfigGlobal;

describe("debugging helpers", () => {
  afterEach(() => {
    Reflect.deleteProperty(diagnosticsGlobal, "__SONARA_DEPLOYMENT_CONFIG__");
  });

  it("redacts sensitive structured log context", () => {
    const redacted = redactLogContext({
      requestId: "request-1",
      token: "private",
      nested: {
        apiKey: "private",
        route: "/admin/diagnostics"
      }
    });

    expect(redacted).toEqual({
      requestId: "request-1",
      token: "[REDACTED]",
      nested: {
        apiKey: "[REDACTED]",
        route: "/admin/diagnostics"
      }
    });
  });

  it("keeps public error messages client-safe", () => {
    expect(sanitizeClientMessage("stack trace includes a secret")).toContain(
      "Something went wrong"
    );
    expect(
      createApiErrorResponse({ code: "internal_error", message: "", status: 500 })
    ).toMatchObject({
      ok: false,
      status: 500
    });
    expect(createClientSafeError(new Error("raw internal failure"), "route")).toMatchObject({
      title: "This page could not load."
    });
  });

  it("creates diagnostics without exposing raw secret values", () => {
    diagnosticsGlobal.__SONARA_DEPLOYMENT_CONFIG__ = {
      appVersion: "0.2.0",
      environment: "preview",
      diagnostics: {
        database: { configured: true, message: "Supabase public config is present." },
        stripe: { configured: false, message: "Stripe setup required." },
        aiProviders: { configured: false, message: "AI provider setup required." }
      }
    };

    const snapshot = createDiagnosticsSnapshot();

    expect(snapshot.appVersion).toBe("0.2.0");
    expect(snapshot.environment).toBe("preview");
    expect(snapshot.database.configured).toBe(true);
    expect(snapshot.stripe.message).toBe("Stripe setup required.");
    expect(JSON.stringify(snapshot)).not.toContain("sk_");
  });

  it("registers diagnostics and not-found routes", () => {
    expect(isKnownRoute("/admin/diagnostics")).toBe(true);
    expect(isKnownRoute("/not-found")).toBe(true);
    expect(getRouteDefinition("/admin/diagnostics")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/not-found")).toMatchObject({
      auth: "public",
      launchStatus: "optional"
    });
    expect(normalizeRoute("/missing-route")).toBe("/not-found");
  });
});
