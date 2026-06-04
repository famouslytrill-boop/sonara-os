import { strategyPages } from "../strategyState.ts";
import type { SignalWorkflowRoute } from "../workflows/workflow-guards.ts";

export type RouteSurface =
  | "workflow"
  | "launch"
  | "product"
  | "admin"
  | "support"
  | "release"
  | "catalog"
  | "strategy";
export type RouteAuthBoundary = "public" | "auth-ready" | "admin-ready";
export type RouteLaunchStatus = "required" | "optional";

export type RouteDefinition = Readonly<{
  route: string;
  label: string;
  surface: RouteSurface;
  nav: boolean;
  launchRequired: boolean;
  launchStatus: RouteLaunchStatus;
  auth: RouteAuthBoundary;
  workflowRoute?: SignalWorkflowRoute;
  recoveryRoute?: string;
}>;

export const coreRouteDefinitions: readonly RouteDefinition[] = Object.freeze([
  Object.freeze({
    route: "/",
    label: "Home",
    surface: "launch",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/app",
    label: "App",
    surface: "launch",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/business-builder",
    label: "Business Builder App",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/creator-studio",
    label: "Creator Studio App",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/growth-studio",
    label: "Growth Studio App",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/admin/command-center",
    label: "App Command Center",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/users",
    label: "App Users",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/organizations",
    label: "App Organizations",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/billing",
    label: "App Admin Billing",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/owner-review",
    label: "App Owner Review",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/audit-logs",
    label: "App Audit Logs",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/security-settings",
    label: "App Security Settings",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/deployment-sync",
    label: "App Deployment Sync",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/production-readiness",
    label: "App Production Readiness",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/open-source-intake",
    label: "App Open-Source Intake",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/github-update-watcher",
    label: "App GitHub Update Watcher",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/ai-cost-control",
    label: "App AI Cost Control",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/prompt-library",
    label: "App Admin Prompt Library",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/email-readiness",
    label: "App Email Readiness",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/owner-bootstrap",
    label: "App Owner Bootstrap",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/security-center",
    label: "App Security Center",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/security-center/open-source-risk",
    label: "App Open-Source Risk",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/security-center/prompt-safety",
    label: "App Prompt Safety",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/billing",
    label: "App Billing",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/settings",
    label: "App Settings",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/settings/readiness",
    label: "App Settings Readiness",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/app/settings/security",
    label: "App Security Settings",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/prompt-library",
    label: "AI Playbook Center",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/business-builder/ai-playbooks",
    label: "Business Builder AI Playbooks",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/business-builder/recommendations",
    label: "Business Builder Recommendations",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/creator-studio/ai-playbooks",
    label: "Creator Studio AI Playbooks",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/creator-studio/recommendations",
    label: "Creator Studio Recommendations",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/growth-studio/ai-playbooks",
    label: "Growth Studio AI Playbooks",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/growth-studio/recommendations",
    label: "Growth Studio Recommendations",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/onboarding",
    label: "App Onboarding",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/pricing",
    label: "Pricing",
    surface: "launch",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/about",
    label: "About",
    surface: "launch",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/security",
    label: "Security",
    surface: "launch",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/contact",
    label: "Contact",
    surface: "support",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/terms",
    label: "Terms",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/privacy",
    label: "Privacy",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/refund-policy",
    label: "Refund Policy",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/acceptable-use",
    label: "Acceptable Use",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/disclaimers",
    label: "Disclaimers",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/beta",
    label: "Beta",
    surface: "support",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/help",
    label: "Help",
    surface: "support",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/help/business-builder",
    label: "Business Builder Help",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/help/creator-studio",
    label: "Creator Studio Help",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/help/growth-studio",
    label: "Growth Studio Help",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/feedback",
    label: "Feedback",
    surface: "support",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/support",
    label: "Support",
    surface: "support",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/login",
    label: "Log in",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/signup",
    label: "Create account",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/auth/callback",
    label: "Auth Callback",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/forgot-password",
    label: "Forgot Password",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/reset-password",
    label: "Reset Password",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/not-found",
    label: "Not Found",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/onboarding",
    label: "Onboarding",
    surface: "support",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/dashboard",
    label: "Dashboard",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder",
    label: "Business Builder",
    surface: "product",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/proof-passport",
    label: "Proof Passport",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/recommendations",
    label: "Business Recommendations",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/money-path",
    label: "Money Path",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/smart-intake",
    label: "Smart Intake",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/offers",
    label: "Offer Builder",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/customers",
    label: "Customer Records",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/customers/follow-up",
    label: "Customer Follow-up",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/autopilot-board",
    label: "Autopilot Board",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/payment-options",
    label: "Payment Options",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/bookings",
    label: "Booking Links",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/reviews",
    label: "Reviews",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/legal-readiness",
    label: "Legal Readiness",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/business-builder/setup",
    label: "Business Builder Setup",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/creator-studio",
    label: "Creator Studio",
    surface: "product",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/creator-studio/proof-card",
    label: "Creator Proof Card",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/creator-studio/recommendations",
    label: "Creator Recommendations",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/creator-studio/asset-vault",
    label: "Asset Vault",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/creator-studio/project-rooms",
    label: "Project Rooms",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/creator-studio/release-checklist",
    label: "Release Checklist",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/creator-studio/service-offers",
    label: "Service Offers",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/creator-studio/payment-booking",
    label: "Payment & Booking",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/creator-studio/legal-readiness/rights-licensing",
    label: "Rights & Licensing",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/creator-studio/video-review",
    label: "Video Review",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/creator-studio/voice-studio",
    label: "Voice Studio",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/creator-studio/visual-studio",
    label: "Visual Studio",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/creator-studio/setup",
    label: "Creator Studio Setup",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/growth-studio",
    label: "Growth Studio",
    surface: "product",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/growth-studio/offers",
    label: "Growth Offers",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/growth-studio/campaigns",
    label: "Campaign Checklist",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/growth-studio/win-back",
    label: "Customer Win-Back",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/growth-studio/referrals",
    label: "Referral Builder",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/growth-studio/review-requests",
    label: "Review Request Flow",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/growth-studio/local-growth",
    label: "Local Growth",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/growth-studio/reviews",
    label: "Growth Reviews",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/growth-studio/recommendations",
    label: "Growth Recommendations",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/growth-studio/legal-readiness/campaign-review",
    label: "Campaign Claim Review",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/growth-studio/campaign-visuals",
    label: "Campaign Visuals",
    surface: "product",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/growth-studio/setup",
    label: "Growth Studio Setup",
    surface: "product",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/security-center",
    label: "Security Center",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/launch-security-gate",
    label: "Launch Security Gate",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/automation-review",
    label: "Automation Review",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/human-approval-gates",
    label: "Human Approval Gates",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/sensitive-actions",
    label: "Sensitive Actions",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/audit-logs",
    label: "Audit Logs",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/approval-gates",
    label: "Approval Gates",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/source-leak-prevention",
    label: "Source Leak Prevention",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/phishing-defense",
    label: "Phishing Defense",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/external-model-safety",
    label: "External Model Safety",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/legal-risk-review",
    label: "Legal Risk Review",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/open-source-risk",
    label: "Open-Source Risk",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/deployment-security",
    label: "Deployment Security",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/recommendation-safety",
    label: "Recommendation Safety",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/voice-safety",
    label: "Voice Safety",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/visual-safety",
    label: "Visual Safety",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/security-center/video-source-safety",
    label: "Video Source Safety",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/reliability-center",
    label: "Reliability Center",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/reliability-center/providers",
    label: "Provider Health",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/reliability-center/incidents",
    label: "Incident Records",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/reliability-center/continuity-mode",
    label: "Continuity Mode",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/ai-providers",
    label: "AI Providers",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/ai-providers/model-router",
    label: "Model Router",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/video-intelligence",
    label: "Video Intelligence",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/dev-tunnel-tools",
    label: "Dev Tunnel Tools",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/open-source-intake",
    label: "Open-Source Intake",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/open-source-intake/reviews",
    label: "Open-Source Reviews",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/open-source-intake/blocked",
    label: "Blocked External Tools",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/github-update-watcher",
    label: "GitHub Update Watcher",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/ai-cost-control",
    label: "AI Cost Control",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/production-readiness",
    label: "Production Readiness",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/security-settings",
    label: "Security Settings",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/deployment-sync",
    label: "Deployment Sync",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/deployment-sync/domain",
    label: "Deployment Domain",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/deployment-sync/github",
    label: "GitHub Sync",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/deployment-sync/vercel",
    label: "Vercel Sync",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/deployment-sync/supabase",
    label: "Supabase Sync",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/deployment-sync/stripe",
    label: "Stripe Sync",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/deployment-sync/docker-rancher",
    label: "Docker and Rancher Sync",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/diagnostics",
    label: "Diagnostics",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/prompt-library",
    label: "Admin Prompt Library",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/recommendation-audit",
    label: "Recommendation Audit",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/market-pattern-lab",
    label: "Market Pattern Lab",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/notification-settings",
    label: "Notification Settings",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/profitability-dashboard",
    label: "Profitability Dashboard",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/command-center",
    label: "Command Center",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/users",
    label: "Users",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/organizations",
    label: "Organizations",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/billing",
    label: "Admin Billing",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/payments",
    label: "Admin Payments",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/autopilot",
    label: "Admin Autopilot",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/support",
    label: "Admin Support",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/email-readiness",
    label: "Email Readiness",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/audit-logs",
    label: "Admin Audit Logs",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/system-health",
    label: "System Health",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/settings",
    label: "Admin Settings",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/owner-bootstrap",
    label: "Owner Bootstrap",
    surface: "admin",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/go-live-checklist",
    label: "Go-live Checklist",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/operations",
    label: "Post-launch Operations",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/owner-review",
    label: "Owner Review",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/owner-review/pending",
    label: "Pending Owner Approvals",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/owner-review/approved",
    label: "Approved Owner Actions",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/owner-review/rejected",
    label: "Rejected Owner Actions",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/automation-rules",
    label: "Automation Rules",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/developer-utilities",
    label: "Developer Utilities",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/developer-tools",
    label: "Developer Tools",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/admin/launch-checklist",
    label: "Launch Checklist",
    surface: "admin",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/settings",
    label: "Settings",
    surface: "support",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/settings/readiness",
    label: "Settings Readiness",
    surface: "support",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/billing",
    label: "Billing",
    surface: "support",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/billing/success",
    label: "Billing Success Return",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/billing/cancel",
    label: "Billing Cancel Return",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/help-center",
    label: "Help Center",
    surface: "support",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/status",
    label: "Status",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/create",
    label: "Signal Initialization",
    surface: "workflow",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public",
    workflowRoute: "create"
  }),
  Object.freeze({
    route: "/analyze",
    label: "Analyze Intelligence",
    surface: "workflow",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public",
    workflowRoute: "analyze",
    recoveryRoute: "/create"
  }),
  Object.freeze({
    route: "/compose",
    label: "Compose System",
    surface: "workflow",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public",
    workflowRoute: "compose",
    recoveryRoute: "/analyze"
  }),
  Object.freeze({
    route: "/mutation",
    label: "Mutation Lab",
    surface: "workflow",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public",
    workflowRoute: "mutation",
    recoveryRoute: "/compose"
  }),
  Object.freeze({
    route: "/export",
    label: "Export Forge",
    surface: "workflow",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public",
    workflowRoute: "export",
    recoveryRoute: "/mutation"
  }),
  Object.freeze({
    route: "/downloads",
    label: "Downloads",
    surface: "launch",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/marketing",
    label: "Creator Studio",
    surface: "launch",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/account",
    label: "Account",
    surface: "launch",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/admin",
    label: "Launch Readiness",
    surface: "launch",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/launch-readiness",
    label: "Launch Readiness",
    surface: "launch",
    nav: false,
    launchRequired: false,
    launchStatus: "optional",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/timeline",
    label: "Release Engine",
    surface: "release",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/content",
    label: "Content Machine",
    surface: "release",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/visualizer",
    label: "Visualizer Studio",
    surface: "release",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/storefront",
    label: "Productization",
    surface: "catalog",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/opportunities",
    label: "Catalog Intelligence",
    surface: "catalog",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/creator-crm",
    label: "CRM",
    surface: "catalog",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/submissions",
    label: "Submissions",
    surface: "catalog",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/licensing",
    label: "Licensing Engine",
    surface: "catalog",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/audience",
    label: "Market Radar",
    surface: "catalog",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  }),
  Object.freeze({
    route: "/experiments",
    label: "Experiment Lab",
    surface: "catalog",
    nav: true,
    launchRequired: false,
    launchStatus: "optional",
    auth: "public"
  })
]);

const finalGoLiveRouteDefinitions: readonly RouteDefinition[] = Object.freeze([
  Object.freeze({
    route: "/app/dashboard",
    label: "App Dashboard",
    surface: "launch",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "auth-ready"
  }),
  Object.freeze({
    route: "/app/admin",
    label: "App Admin",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/integrations",
    label: "App Admin Integrations",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/app/admin/github-radar",
    label: "App GitHub Radar",
    surface: "admin",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "admin-ready"
  }),
  Object.freeze({
    route: "/trust",
    label: "Trust",
    surface: "launch",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/legal",
    label: "Legal",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/legal/terms",
    label: "Terms",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/legal/privacy",
    label: "Privacy",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/legal/refund-policy",
    label: "Refund Policy",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/legal/acceptable-use",
    label: "Acceptable Use",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/legal/cookie-policy",
    label: "Cookie Policy",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/legal/accessibility",
    label: "Accessibility",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/legal/security",
    label: "Security",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/legal/dpa",
    label: "DPA",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/research-lab",
    label: "Research Lab",
    surface: "launch",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/research-lab/open-source",
    label: "Open Source Review",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/research-lab/github-radar",
    label: "GitHub Opportunity Radar",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/open-source",
    label: "Open Source",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/docs",
    label: "Docs",
    surface: "support",
    nav: true,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/api-webhooks",
    label: "API and Webhooks",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/integrations",
    label: "Integrations",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  }),
  Object.freeze({
    route: "/changelog",
    label: "Changelog",
    surface: "support",
    nav: false,
    launchRequired: true,
    launchStatus: "required",
    auth: "public"
  })
]);

export function getAllRouteDefinitions(): readonly RouteDefinition[] {
  return Object.freeze([
    ...coreRouteDefinitions,
    ...finalGoLiveRouteDefinitions,
    ...strategyPages.map((page) =>
      Object.freeze({
        route: page.route,
        label: page.title,
        surface: "strategy" as const,
        nav: true,
        launchRequired: false,
        launchStatus: "optional" as const,
        auth: "public" as const
      })
    )
  ]);
}

export function getNavigationRoutes(): readonly RouteDefinition[] {
  return getAllRouteDefinitions().filter((route) => route.nav);
}

export function getRequiredLaunchRoutes(): readonly string[] {
  return [...coreRouteDefinitions, ...finalGoLiveRouteDefinitions]
    .filter((route) => route.launchRequired)
    .map((route) => route.route);
}

export function isKnownRoute(route: string): boolean {
  return getAllRouteDefinitions().some((definition) => definition.route === route);
}

export function getRouteDefinition(route: string): RouteDefinition | null {
  return getAllRouteDefinitions().find((definition) => definition.route === route) ?? null;
}
