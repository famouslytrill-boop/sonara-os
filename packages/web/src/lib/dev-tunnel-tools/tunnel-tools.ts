export type DevTunnelProvider =
  | "pinggy"
  | "ngrok"
  | "cloudflare_tunnel"
  | "localhost_run"
  | "localtunnel";

export type DevTunnelPurpose = "local_preview" | "mobile_testing" | "webhook_testing";

export type DevTunnelCommandInput = Readonly<{
  provider: DevTunnelProvider;
  purpose: DevTunnelPurpose;
  localPort: number;
}>;

export type DevTunnelCommandResult = Readonly<{
  ok: boolean;
  command: string;
  warnings: readonly string[];
  error?: string;
}>;

export type BlockedTunnelRoute = Readonly<{
  id: string;
  pattern: string;
  description: string;
  risk: "high" | "critical";
}>;

export type TunnelRouteSafetyResult = Readonly<{
  allowed: boolean;
  route: string;
  matchedRule?: BlockedTunnelRoute;
  message: string;
}>;

export type DevTunnelProviderDoc = Readonly<{
  id: DevTunnelProvider;
  name: string;
  commandStyle: string;
  notes: string;
}>;

export type DevTunnelAuditPlaceholder = Readonly<{
  id: string;
  eventType: string;
  status: "placeholder";
  summary: string;
  humanReviewRequired: boolean;
}>;

export const devTunnelProviders: readonly DevTunnelProviderDoc[] = Object.freeze([
  Object.freeze({
    id: "pinggy",
    name: "Pinggy",
    commandStyle: "ssh reverse tunnel",
    notes: "Good for quick local previews and webhook tests. Use previewed command manually."
  }),
  Object.freeze({
    id: "ngrok",
    name: "ngrok",
    commandStyle: "ngrok http",
    notes: "Useful for webhook testing when the ngrok CLI is already installed and approved."
  }),
  Object.freeze({
    id: "cloudflare_tunnel",
    name: "Cloudflare Tunnel",
    commandStyle: "cloudflared tunnel",
    notes: "Useful for reviewed local previews with Cloudflare tooling already configured."
  }),
  Object.freeze({
    id: "localhost_run",
    name: "localhost.run",
    commandStyle: "ssh reverse tunnel",
    notes: "Useful for lightweight temporary previews with no production data."
  }),
  Object.freeze({
    id: "localtunnel",
    name: "localtunnel",
    commandStyle: "npx localtunnel",
    notes: "Useful for local testing when npm execution is reviewed and expected."
  })
]);

export const tunnelPurposeLabels: Record<DevTunnelPurpose, string> = {
  local_preview: "Local preview",
  mobile_testing: "Mobile testing",
  webhook_testing: "Webhook testing"
};

export const blockedTunnelRoutes: readonly BlockedTunnelRoute[] = Object.freeze([
  Object.freeze({
    id: "admin",
    pattern: "/admin",
    description: "Admin routes must not be exposed through public tunnels.",
    risk: "critical"
  }),
  Object.freeze({
    id: "security-center",
    pattern: "/security-center",
    description: "Security review routes must stay private.",
    risk: "critical"
  }),
  Object.freeze({
    id: "api-internal",
    pattern: "/api/internal/**",
    description: "Internal API routes are blocked from public tunnel exposure.",
    risk: "critical"
  }),
  Object.freeze({
    id: "api-admin",
    pattern: "/api/admin/**",
    description: "Admin API routes are blocked from public tunnel exposure.",
    risk: "critical"
  }),
  Object.freeze({
    id: "stripe-admin",
    pattern: "/api/stripe/admin/**",
    description: "Stripe admin API routes must not be exposed through local tunnels.",
    risk: "critical"
  }),
  Object.freeze({
    id: "supabase-service",
    pattern: "/api/supabase/service/**",
    description: "Supabase service-role routes must stay server-only.",
    risk: "critical"
  }),
  Object.freeze({
    id: "env-file",
    pattern: "/.env",
    description: "Environment files and secrets must never be exposed.",
    risk: "critical"
  }),
  Object.freeze({
    id: "source-maps",
    pattern: "/_next/static/**/*.map",
    description: "Source maps can expose source structure and should stay blocked.",
    risk: "high"
  })
]);

export const devTunnelSafetyWarnings: readonly string[] = Object.freeze([
  "Preview commands only. SONARA One does not start production tunnels from this UI.",
  "Use test data only. Do not expose admin, security, internal API, secret, or source map routes.",
  "Webhook tests must use test-mode provider events and verified signatures.",
  "Stop the tunnel when testing is complete and rotate any exposed development secrets."
]);

export const devTunnelWebhookNotes: readonly string[] = Object.freeze([
  "Use provider test mode before sending webhook events to a local tunnel.",
  "Verify webhook signatures in the receiving route.",
  "Do not tunnel admin-only webhook replay or service-role endpoints.",
  "Record the test purpose and exposed route before sharing a tunnel URL."
]);

export const devTunnelAuditPlaceholders: readonly DevTunnelAuditPlaceholder[] = Object.freeze([
  Object.freeze({
    id: "tunnel-command-preview",
    eventType: "dev_tunnel.command_previewed",
    status: "placeholder",
    summary: "Future audit event for reviewed local tunnel command previews.",
    humanReviewRequired: false
  }),
  Object.freeze({
    id: "unsafe-route-blocked",
    eventType: "dev_tunnel.unsafe_route_blocked",
    status: "placeholder",
    summary:
      "Future audit event for blocked admin, security, internal API, env, or source map routes.",
    humanReviewRequired: true
  })
]);

export function buildTunnelCommand(input: DevTunnelCommandInput): DevTunnelCommandResult {
  if (!isSafeLocalPort(input.localPort)) {
    return Object.freeze({
      ok: false,
      command: "",
      warnings: Object.freeze([]),
      error: "Local port must be an integer between 1 and 65535."
    });
  }

  const command = getProviderCommand(input.provider, input.localPort);
  return Object.freeze({
    ok: true,
    command,
    warnings: Object.freeze(createPurposeWarnings(input.purpose))
  });
}

export function evaluateTunnelRouteSafety(route: string): TunnelRouteSafetyResult {
  const normalized = normalizeRoutePath(route);
  const matchedRule = blockedTunnelRoutes.find((rule) =>
    doesRouteMatchBlockedPattern(normalized, rule.pattern)
  );

  if (matchedRule) {
    return Object.freeze({
      allowed: false,
      route: normalized,
      matchedRule,
      message: `${matchedRule.pattern} is blocked for tunnel exposure. ${matchedRule.description}`
    });
  }

  return Object.freeze({
    allowed: true,
    route: normalized,
    message: "Route is not on the blocked tunnel checklist. Use only test data and reviewed flows."
  });
}

export function isSafeLocalPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function getProviderCommand(provider: DevTunnelProvider, port: number): string {
  if (provider === "pinggy") {
    return `ssh -p 443 -R0:localhost:${port} a.pinggy.io`;
  }
  if (provider === "ngrok") {
    return `ngrok http ${port}`;
  }
  if (provider === "cloudflare_tunnel") {
    return `cloudflared tunnel --url http://localhost:${port}`;
  }
  if (provider === "localhost_run") {
    return `ssh -R 80:localhost:${port} nokey@localhost.run`;
  }
  return `npx localtunnel --port ${port}`;
}

function createPurposeWarnings(purpose: DevTunnelPurpose): readonly string[] {
  const warnings = [
    "Do not expose admin, security, service-role, env, or source map routes.",
    "Command preview only. Run manually in a reviewed local terminal if appropriate."
  ];
  if (purpose === "webhook_testing") {
    warnings.push("Use provider test mode and verify webhook signatures.");
  }
  if (purpose === "mobile_testing") {
    warnings.push("Use local test accounts and avoid private customer data on shared networks.");
  }
  return warnings;
}

function normalizeRoutePath(route: string): string {
  const trimmed = route.trim();
  if (!trimmed) {
    return "/";
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      return new URL(trimmed).pathname || "/";
    } catch {
      return trimmed;
    }
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function doesRouteMatchBlockedPattern(route: string, pattern: string): boolean {
  if (pattern.endsWith("/**")) {
    const base = pattern.slice(0, -3);
    return route === base || route.startsWith(`${base}/`);
  }
  if (pattern === "/admin" || pattern === "/security-center") {
    return route === pattern || route.startsWith(`${pattern}/`);
  }
  if (pattern === "/_next/static/**/*.map") {
    return route.startsWith("/_next/static/") && route.endsWith(".map");
  }
  return route === pattern;
}
