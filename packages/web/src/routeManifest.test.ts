import { describe, expect, it } from "vitest";
import {
  getAllRouteDefinitions,
  getNavigationRoutes,
  getRequiredLaunchRoutes,
  getRouteDefinition,
  isKnownRoute
} from "./routes/route-manifest.ts";

describe("route manifest", () => {
  it("centralizes launch and navigation routes", () => {
    expect(getRequiredLaunchRoutes()).toEqual([
      "/",
      "/app",
      "/app/business-builder",
      "/app/creator-studio",
      "/app/growth-studio",
      "/app/admin/command-center",
      "/app/security-center",
      "/app/billing",
      "/app/onboarding",
      "/pricing",
      "/about",
      "/security",
      "/contact",
      "/terms",
      "/privacy",
      "/refund-policy",
      "/acceptable-use",
      "/disclaimers",
      "/onboarding",
      "/dashboard",
      "/business-builder",
      "/business-builder/proof-passport",
      "/business-builder/money-path",
      "/business-builder/smart-intake",
      "/business-builder/offers",
      "/business-builder/customers",
      "/business-builder/customers/follow-up",
      "/business-builder/autopilot-board",
      "/business-builder/payment-options",
      "/business-builder/bookings",
      "/business-builder/reviews",
      "/business-builder/legal-readiness",
      "/business-builder/setup",
      "/creator-studio",
      "/creator-studio/proof-card",
      "/creator-studio/asset-vault",
      "/creator-studio/project-rooms",
      "/creator-studio/release-checklist",
      "/creator-studio/service-offers",
      "/creator-studio/payment-booking",
      "/creator-studio/legal-readiness/rights-licensing",
      "/creator-studio/setup",
      "/growth-studio",
      "/growth-studio/offers",
      "/growth-studio/campaigns",
      "/growth-studio/win-back",
      "/growth-studio/referrals",
      "/growth-studio/review-requests",
      "/growth-studio/local-growth",
      "/growth-studio/reviews",
      "/growth-studio/legal-readiness/campaign-review",
      "/growth-studio/setup",
      "/security-center",
      "/security-center/launch-security-gate",
      "/security-center/automation-review",
      "/security-center/human-approval-gates",
      "/security-center/sensitive-actions",
      "/security-center/audit-logs",
      "/security-center/approval-gates",
      "/security-center/source-leak-prevention",
      "/security-center/phishing-defense",
      "/security-center/external-model-safety",
      "/security-center/legal-risk-review",
      "/security-center/open-source-risk",
      "/security-center/deployment-security",
      "/admin/reliability-center",
      "/admin/reliability-center/providers",
      "/admin/reliability-center/incidents",
      "/admin/reliability-center/continuity-mode",
      "/admin/ai-providers",
      "/admin/ai-providers/model-router",
      "/admin/open-source-intake",
      "/admin/open-source-intake/reviews",
      "/admin/open-source-intake/blocked",
      "/admin/deployment-sync",
      "/admin/deployment-sync/domain",
      "/admin/deployment-sync/github",
      "/admin/deployment-sync/vercel",
      "/admin/deployment-sync/supabase",
      "/admin/deployment-sync/stripe",
      "/admin/deployment-sync/docker-rancher",
      "/admin/diagnostics",
      "/admin/command-center",
      "/admin/users",
      "/admin/organizations",
      "/admin/billing",
      "/admin/payments",
      "/admin/autopilot",
      "/admin/support",
      "/admin/audit-logs",
      "/admin/system-health",
      "/admin/settings",
      "/admin/go-live-checklist",
      "/admin/operations",
      "/admin/owner-review",
      "/admin/owner-review/pending",
      "/admin/owner-review/approved",
      "/admin/owner-review/rejected",
      "/admin/automation-rules",
      "/admin/developer-utilities",
      "/admin/developer-tools",
      "/admin/launch-checklist",
      "/settings",
      "/billing",
      "/billing/success",
      "/billing/cancel",
      "/help-center",
      "/status",
      "/create",
      "/analyze",
      "/compose",
      "/mutation",
      "/export",
      "/downloads",
      "/marketing",
      "/account",
      "/admin"
    ]);
    expect(getNavigationRoutes().some((route) => route.label === "Signal Initialization")).toBe(
      true
    );
  });

  it("recognizes core and strategy routes", () => {
    expect(isKnownRoute("/export")).toBe(true);
    expect(isKnownRoute("/pricing")).toBe(true);
    expect(isKnownRoute("/about")).toBe(true);
    expect(isKnownRoute("/security")).toBe(true);
    expect(isKnownRoute("/contact")).toBe(true);
    expect(isKnownRoute("/terms")).toBe(true);
    expect(isKnownRoute("/privacy")).toBe(true);
    expect(isKnownRoute("/refund-policy")).toBe(true);
    expect(isKnownRoute("/acceptable-use")).toBe(true);
    expect(isKnownRoute("/disclaimers")).toBe(true);
    expect(isKnownRoute("/beta")).toBe(true);
    expect(isKnownRoute("/help")).toBe(true);
    expect(isKnownRoute("/help/business-builder")).toBe(true);
    expect(isKnownRoute("/help/creator-studio")).toBe(true);
    expect(isKnownRoute("/help/growth-studio")).toBe(true);
    expect(isKnownRoute("/feedback")).toBe(true);
    expect(isKnownRoute("/support")).toBe(true);
    expect(isKnownRoute("/not-found")).toBe(true);
    expect(isKnownRoute("/onboarding")).toBe(true);
    expect(isKnownRoute("/business-builder")).toBe(true);
    expect(isKnownRoute("/business-builder/proof-passport")).toBe(true);
    expect(isKnownRoute("/business-builder/money-path")).toBe(true);
    expect(isKnownRoute("/business-builder/customers/follow-up")).toBe(true);
    expect(isKnownRoute("/business-builder/autopilot-board")).toBe(true);
    expect(isKnownRoute("/business-builder/payment-options")).toBe(true);
    expect(isKnownRoute("/business-builder/legal-readiness")).toBe(true);
    expect(isKnownRoute("/business-builder/setup")).toBe(true);
    expect(isKnownRoute("/creator-studio/proof-card")).toBe(true);
    expect(isKnownRoute("/creator-studio/asset-vault")).toBe(true);
    expect(isKnownRoute("/creator-studio/project-rooms")).toBe(true);
    expect(isKnownRoute("/creator-studio/release-checklist")).toBe(true);
    expect(isKnownRoute("/creator-studio/service-offers")).toBe(true);
    expect(isKnownRoute("/creator-studio/payment-booking")).toBe(true);
    expect(isKnownRoute("/creator-studio/legal-readiness/rights-licensing")).toBe(true);
    expect(isKnownRoute("/creator-studio/video-review")).toBe(true);
    expect(isKnownRoute("/creator-studio/voice-studio")).toBe(true);
    expect(isKnownRoute("/creator-studio/visual-studio")).toBe(true);
    expect(isKnownRoute("/creator-studio/setup")).toBe(true);
    expect(isKnownRoute("/growth-studio/offers")).toBe(true);
    expect(isKnownRoute("/growth-studio/campaigns")).toBe(true);
    expect(isKnownRoute("/growth-studio/win-back")).toBe(true);
    expect(isKnownRoute("/growth-studio/referrals")).toBe(true);
    expect(isKnownRoute("/growth-studio/review-requests")).toBe(true);
    expect(isKnownRoute("/growth-studio/local-growth")).toBe(true);
    expect(isKnownRoute("/growth-studio/reviews")).toBe(true);
    expect(isKnownRoute("/growth-studio/legal-readiness/campaign-review")).toBe(true);
    expect(isKnownRoute("/growth-studio/campaign-visuals")).toBe(true);
    expect(isKnownRoute("/growth-studio/setup")).toBe(true);
    expect(isKnownRoute("/admin/developer-tools")).toBe(true);
    expect(isKnownRoute("/admin/reliability-center/providers")).toBe(true);
    expect(isKnownRoute("/admin/reliability-center/incidents")).toBe(true);
    expect(isKnownRoute("/admin/reliability-center/continuity-mode")).toBe(true);
    expect(isKnownRoute("/admin/ai-providers")).toBe(true);
    expect(isKnownRoute("/admin/ai-providers/model-router")).toBe(true);
    expect(isKnownRoute("/admin/video-intelligence")).toBe(true);
    expect(isKnownRoute("/admin/dev-tunnel-tools")).toBe(true);
    expect(isKnownRoute("/admin/open-source-intake")).toBe(true);
    expect(isKnownRoute("/admin/open-source-intake/reviews")).toBe(true);
    expect(isKnownRoute("/admin/open-source-intake/blocked")).toBe(true);
    expect(isKnownRoute("/admin/deployment-sync")).toBe(true);
    expect(isKnownRoute("/admin/deployment-sync/domain")).toBe(true);
    expect(isKnownRoute("/admin/deployment-sync/github")).toBe(true);
    expect(isKnownRoute("/admin/deployment-sync/vercel")).toBe(true);
    expect(isKnownRoute("/admin/deployment-sync/supabase")).toBe(true);
    expect(isKnownRoute("/admin/deployment-sync/stripe")).toBe(true);
    expect(isKnownRoute("/admin/deployment-sync/docker-rancher")).toBe(true);
    expect(isKnownRoute("/admin/diagnostics")).toBe(true);
    expect(isKnownRoute("/admin/command-center")).toBe(true);
    expect(isKnownRoute("/admin/users")).toBe(true);
    expect(isKnownRoute("/admin/organizations")).toBe(true);
    expect(isKnownRoute("/admin/billing")).toBe(true);
    expect(isKnownRoute("/admin/payments")).toBe(true);
    expect(isKnownRoute("/admin/autopilot")).toBe(true);
    expect(isKnownRoute("/admin/support")).toBe(true);
    expect(isKnownRoute("/admin/audit-logs")).toBe(true);
    expect(isKnownRoute("/admin/system-health")).toBe(true);
    expect(isKnownRoute("/admin/settings")).toBe(true);
    expect(isKnownRoute("/admin/go-live-checklist")).toBe(true);
    expect(isKnownRoute("/admin/operations")).toBe(true);
    expect(isKnownRoute("/admin/owner-review")).toBe(true);
    expect(isKnownRoute("/admin/owner-review/pending")).toBe(true);
    expect(isKnownRoute("/admin/owner-review/approved")).toBe(true);
    expect(isKnownRoute("/admin/owner-review/rejected")).toBe(true);
    expect(isKnownRoute("/admin/automation-rules")).toBe(true);
    expect(isKnownRoute("/admin/developer-utilities")).toBe(true);
    expect(isKnownRoute("/admin/launch-checklist")).toBe(true);
    expect(isKnownRoute("/billing/success")).toBe(true);
    expect(isKnownRoute("/billing/cancel")).toBe(true);
    expect(isKnownRoute("/security-center/launch-security-gate")).toBe(true);
    expect(isKnownRoute("/security-center/automation-review")).toBe(true);
    expect(isKnownRoute("/security-center/human-approval-gates")).toBe(true);
    expect(isKnownRoute("/security-center/sensitive-actions")).toBe(true);
    expect(isKnownRoute("/security-center/audit-logs")).toBe(true);
    expect(isKnownRoute("/security-center/external-model-safety")).toBe(true);
    expect(isKnownRoute("/security-center/legal-risk-review")).toBe(true);
    expect(isKnownRoute("/security-center/open-source-risk")).toBe(true);
    expect(isKnownRoute("/security-center/deployment-security")).toBe(true);
    expect(isKnownRoute("/app")).toBe(true);
    expect(isKnownRoute("/app/business-builder")).toBe(true);
    expect(isKnownRoute("/app/creator-studio")).toBe(true);
    expect(isKnownRoute("/app/growth-studio")).toBe(true);
    expect(isKnownRoute("/app/admin/command-center")).toBe(true);
    expect(isKnownRoute("/app/security-center")).toBe(true);
    expect(isKnownRoute("/app/billing")).toBe(true);
    expect(isKnownRoute("/app/onboarding")).toBe(true);
    expect(isKnownRoute("/security-center/voice-safety")).toBe(true);
    expect(isKnownRoute("/security-center/visual-safety")).toBe(true);
    expect(isKnownRoute("/security-center/video-source-safety")).toBe(true);
    expect(isKnownRoute("/rights-vault")).toBe(true);
    expect(getAllRouteDefinitions().length).toBeGreaterThan(20);
  });

  it("stores route metadata for auth, workflow, and launch status", () => {
    expect(getRouteDefinition("/downloads")).toMatchObject({
      auth: "auth-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/")).toMatchObject({
      auth: "public",
      label: "Home",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/app")).toMatchObject({
      auth: "auth-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/app/admin/command-center")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/app/security-center")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/pricing")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/security")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/terms")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/privacy")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/refund-policy")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/acceptable-use")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/disclaimers")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/onboarding")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/beta")).toMatchObject({
      auth: "public",
      launchStatus: "optional"
    });
    expect(getRouteDefinition("/help/business-builder")).toMatchObject({
      auth: "public",
      launchStatus: "optional"
    });
    expect(getRouteDefinition("/feedback")).toMatchObject({
      auth: "public",
      surface: "support"
    });
    expect(getRouteDefinition("/support")).toMatchObject({
      auth: "public",
      surface: "support"
    });
    expect(getRouteDefinition("/not-found")).toMatchObject({
      auth: "public",
      launchStatus: "optional"
    });
    expect(getRouteDefinition("/admin")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/security-center")).toMatchObject({
      auth: "admin-ready",
      surface: "admin"
    });
    expect(getRouteDefinition("/security-center/launch-security-gate")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/security-center/automation-review")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/security-center/human-approval-gates")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/security-center/sensitive-actions")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/security-center/approval-gates")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/developer-utilities")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/diagnostics")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/command-center")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/users")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/organizations")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/billing")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/payments")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/autopilot")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/support")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/audit-logs")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/system-health")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/settings")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/go-live-checklist")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/operations")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/owner-review")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/owner-review/pending")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/automation-rules")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/launch-checklist")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/reliability-center/providers")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/billing/success")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/billing/cancel")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/status")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/ai-providers")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/security-center/legal-risk-review")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/security-center/open-source-risk")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/security-center/deployment-security")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/open-source-intake")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/open-source-intake/reviews")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/open-source-intake/blocked")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/deployment-sync")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/deployment-sync/domain")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/admin/video-intelligence")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "optional"
    });
    expect(getRouteDefinition("/admin/dev-tunnel-tools")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "optional"
    });
    expect(getRouteDefinition("/creator-studio/voice-studio")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "optional"
    });
    expect(getRouteDefinition("/creator-studio/video-review")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "optional"
    });
    expect(getRouteDefinition("/creator-studio/visual-studio")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "optional"
    });
    expect(getRouteDefinition("/growth-studio/campaign-visuals")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "optional"
    });
    expect(getRouteDefinition("/security-center/video-source-safety")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "optional"
    });
    expect(getRequiredLaunchRoutes()).not.toContain("/admin/video-intelligence");
    expect(getRequiredLaunchRoutes()).not.toContain("/admin/dev-tunnel-tools");
    expect(getRequiredLaunchRoutes()).not.toContain("/creator-studio/voice-studio");
    expect(getRouteDefinition("/business-builder/payment-options")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/business-builder/legal-readiness")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/business-builder/proof-passport")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/business-builder/customers/follow-up")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/creator-studio/proof-card")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/growth-studio/campaigns")).toMatchObject({
      auth: "public",
      launchStatus: "required"
    });
    expect(getRouteDefinition("/compose")).toMatchObject({
      workflowRoute: "compose",
      recoveryRoute: "/analyze"
    });
  });
});
