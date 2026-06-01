import { describe, expect, it } from "vitest";
import {
  blockedTunnelRoutes,
  buildTunnelCommand,
  devTunnelAuditPlaceholders,
  devTunnelProviders,
  devTunnelSafetyWarnings,
  devTunnelWebhookNotes,
  evaluateTunnelRouteSafety
} from "./lib/dev-tunnel-tools/index.ts";

describe("Dev Tunnel Tools MVP", () => {
  it("documents supported providers", () => {
    expect(devTunnelProviders.map((provider) => provider.name)).toEqual([
      "Pinggy",
      "ngrok",
      "Cloudflare Tunnel",
      "localhost.run",
      "localtunnel"
    ]);
  });

  it("generates a Pinggy-style command preview", () => {
    const result = buildTunnelCommand({
      provider: "pinggy",
      purpose: "webhook_testing",
      localPort: 3000
    });

    expect(result.ok).toBe(true);
    expect(result.command).toBe("ssh -p 443 -R0:localhost:3000 a.pinggy.io");
    expect(result.warnings.join(" ")).toMatch(/verify webhook signatures/i);
  });

  it("rejects invalid local ports", () => {
    expect(
      buildTunnelCommand({
        provider: "ngrok",
        purpose: "local_preview",
        localPort: 0
      }).ok
    ).toBe(false);
  });

  it("blocks unsafe tunnel routes", () => {
    for (const route of [
      "/admin",
      "/admin/dev-tunnel-tools",
      "/security-center",
      "/api/internal/session",
      "/api/admin/users",
      "/api/stripe/admin/replay",
      "/api/supabase/service/keys",
      "/.env",
      "/_next/static/chunks/app/page.js.map"
    ]) {
      expect(evaluateTunnelRouteSafety(route).allowed).toBe(false);
    }
    expect(blockedTunnelRoutes).toHaveLength(8);
  });

  it("allows non-blocked test routes with warnings handled separately", () => {
    const result = evaluateTunnelRouteSafety("/api/webhooks/stripe-test");

    expect(result.allowed).toBe(true);
    expect(result.message).toMatch(/test data/i);
    expect(devTunnelSafetyWarnings.join(" ")).toMatch(/Preview commands only/i);
    expect(devTunnelWebhookNotes.join(" ")).toMatch(/provider test mode/i);
  });

  it("keeps audit entries as placeholders", () => {
    expect(devTunnelAuditPlaceholders).toEqual([
      expect.objectContaining({
        eventType: "dev_tunnel.command_previewed",
        status: "placeholder"
      }),
      expect.objectContaining({
        eventType: "dev_tunnel.unsafe_route_blocked",
        humanReviewRequired: true
      })
    ]);
  });
});
