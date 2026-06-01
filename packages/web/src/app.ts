import { brandIdentity, getLogoAsset } from "@signal-os/ui";
import { clearElement, createElement, createMetric } from "./dom.ts";
import { renderAIProvidersPage } from "./app/admin/ai-providers/page.ts";
import { renderModelRouterPage } from "./app/admin/ai-providers/model-router/page.ts";
import { renderAccountPage } from "./app/account/page.ts";
import { renderAdminPage } from "./app/admin/page.ts";
import { renderVideoIntelligencePage } from "./app/admin/video-intelligence/page.ts";
import { renderAutomationRulesPage } from "./app/admin/automation-rules/page.ts";
import { renderDeveloperUtilitiesPage } from "./app/admin/developer-utilities/page.ts";
import { renderDevTunnelToolsPage } from "./app/admin/dev-tunnel-tools/page.ts";
import { renderDeveloperToolsPage } from "./app/admin/developer-tools/page.ts";
import { renderDeploymentSyncDockerRancherPage } from "./app/admin/deployment-sync/docker-rancher/page.ts";
import { renderDeploymentSyncDomainPage } from "./app/admin/deployment-sync/domain/page.ts";
import { renderDeploymentSyncGitHubPage } from "./app/admin/deployment-sync/github/page.ts";
import { renderDeploymentSyncPage } from "./app/admin/deployment-sync/page.ts";
import { renderDeploymentSyncStripePage } from "./app/admin/deployment-sync/stripe/page.ts";
import { renderDeploymentSyncSupabasePage } from "./app/admin/deployment-sync/supabase/page.ts";
import { renderDeploymentSyncVercelPage } from "./app/admin/deployment-sync/vercel/page.ts";
import { renderAdminDiagnosticsPage } from "./app/admin/diagnostics/page.ts";
import { renderAdminGoLiveChecklistPage } from "./app/admin/go-live-checklist/page.ts";
import { renderGitHubUpdateWatcherPage } from "./app/admin/github-update-watcher/page.ts";
import { renderAiCostControlPage } from "./app/admin/ai-cost-control/page.ts";
import { renderAdminPromptLibraryPage } from "./app/admin/prompt-library/page.ts";
import { renderAdminLaunchChecklistPage } from "./app/admin/launch-checklist/page.ts";
import { renderMarketPatternLabPage } from "./app/admin/market-pattern-lab/page.ts";
import { renderNotificationSettingsPage } from "./app/admin/notification-settings/page.ts";
import { renderAdminAuditLogsPage } from "./app/admin/audit-logs/page.ts";
import { renderAdminAutopilotPage } from "./app/admin/autopilot/page.ts";
import { renderAdminBillingPage } from "./app/admin/billing/page.ts";
import { renderAdminCommandCenterPage } from "./app/admin/command-center/page.ts";
import { renderOpenSourceIntakeBlockedPage } from "./app/admin/open-source-intake/blocked/page.ts";
import { renderOpenSourceIntakePage } from "./app/admin/open-source-intake/page.ts";
import { renderOpenSourceIntakeReviewsPage } from "./app/admin/open-source-intake/reviews/page.ts";
import { renderPostLaunchOperationsPage } from "./app/admin/operations/page.ts";
import { renderAdminOrganizationsPage } from "./app/admin/organizations/page.ts";
import { renderOwnerReviewPage } from "./app/admin/owner-review/page.ts";
import { renderOwnerReviewApprovedPage } from "./app/admin/owner-review/approved/page.ts";
import { renderOwnerReviewPendingPage } from "./app/admin/owner-review/pending/page.ts";
import { renderOwnerReviewRejectedPage } from "./app/admin/owner-review/rejected/page.ts";
import { renderAdminPaymentsPage } from "./app/admin/payments/page.ts";
import { renderProductionReadinessPage } from "./app/admin/production-readiness/page.ts";
import { renderProfitabilityDashboardPage } from "./app/admin/profitability-dashboard/page.ts";
import { renderRecommendationAuditPage } from "./app/admin/recommendation-audit/page.ts";
import { renderContinuityModePage } from "./app/admin/reliability-center/continuity-mode/page.ts";
import { renderIncidentRecordsPage } from "./app/admin/reliability-center/incidents/page.ts";
import { renderReliabilityCenterPage } from "./app/admin/reliability-center/page.ts";
import { renderProviderHealthPage } from "./app/admin/reliability-center/providers/page.ts";
import { renderSecuritySettingsPage } from "./app/admin/security-settings/page.ts";
import { renderAdminSettingsPage } from "./app/admin/settings/page.ts";
import { renderAdminSupportPage } from "./app/admin/support/page.ts";
import { renderAdminSystemHealthPage } from "./app/admin/system-health/page.ts";
import { renderAdminUsersPage } from "./app/admin/users/page.ts";
import { renderAdminEmailReadinessPage } from "./app/admin/email-readiness/page.ts";
import { renderOwnerBootstrapPage } from "./app/admin/owner-bootstrap/page.ts";
import { renderAudiencePage } from "./app/audience/page.ts";
import { renderAboutPage } from "./app/about/page.ts";
import { renderBetaInvitePage } from "./app/beta/page.ts";
import { renderBillingCancelPage } from "./app/billing/cancel/page.ts";
import { renderBillingPlaceholderPage } from "./app/billing/page.ts";
import { renderBillingSuccessPage } from "./app/billing/success/page.ts";
import { renderAutopilotBoardPage } from "./app/business-builder/autopilot-board/page.ts";
import { renderBusinessBookingsPage } from "./app/business-builder/bookings/page.ts";
import { renderCustomerFollowUpPage } from "./app/business-builder/customers/follow-up/page.ts";
import { renderCustomersPage } from "./app/business-builder/customers/page.ts";
import { renderBusinessLegalReadinessPage } from "./app/business-builder/legal-readiness/page.ts";
import { renderMoneyPathPage } from "./app/business-builder/money-path/page.ts";
import { renderOffersPage } from "./app/business-builder/offers/page.ts";
import { renderBusinessPaymentOptionsPage } from "./app/business-builder/payment-options/page.ts";
import { renderBusinessAiPlaybooksPage } from "./app/business-builder/ai-playbooks/page.ts";
import { renderProofPassportPage } from "./app/business-builder/proof-passport/page.ts";
import { renderBusinessRecommendationsPage } from "./app/business-builder/recommendations/page.ts";
import { renderBusinessReviewsPage } from "./app/business-builder/reviews/page.ts";
import { renderBusinessBuilderSetupPage } from "./app/business-builder/setup/page.ts";
import { renderSmartIntakePage } from "./app/business-builder/smart-intake/page.ts";
import { renderContactPolicyPage } from "./app/contact/page.ts";
import { renderContentPage } from "./app/content/page.ts";
import { renderCreatorPaymentBookingPage } from "./app/creator-studio/payment-booking/page.ts";
import { renderCreatorAiPlaybooksPage } from "./app/creator-studio/ai-playbooks/page.ts";
import { renderAssetVaultPage } from "./app/creator-studio/asset-vault/page.ts";
import { renderRightsLicensingPage } from "./app/creator-studio/legal-readiness/rights-licensing/page.ts";
import { renderProjectRoomsPage } from "./app/creator-studio/project-rooms/page.ts";
import { renderCreatorProofCardPage } from "./app/creator-studio/proof-card/page.ts";
import { renderCreatorRecommendationsPage } from "./app/creator-studio/recommendations/page.ts";
import { renderReleaseChecklistPage } from "./app/creator-studio/release-checklist/page.ts";
import { renderServiceOffersPage } from "./app/creator-studio/service-offers/page.ts";
import { renderCreatorStudioSetupPage } from "./app/creator-studio/setup/page.ts";
import { renderCreatorVideoReviewPage } from "./app/creator-studio/video-review/page.ts";
import { renderVoiceStudioPage } from "./app/creator-studio/voice-studio/page.ts";
import { renderVisualStudioPage } from "./app/creator-studio/visual-studio/page.ts";
import { renderCreatorCrmPage } from "./app/creator-crm/page.ts";
import { renderDownloadsPage } from "./app/downloads/page.ts";
import { renderExperimentsPage } from "./app/experiments/page.ts";
import { renderAcceptableUsePage } from "./app/acceptable-use/page.ts";
import { renderDisclaimersPage } from "./app/disclaimers/page.ts";
import { renderCampaignVisualsPage } from "./app/growth-studio/campaign-visuals/page.ts";
import { renderGrowthCampaignsPage } from "./app/growth-studio/campaigns/page.ts";
import { renderGrowthOffersPage } from "./app/growth-studio/offers/page.ts";
import { renderReferralBuilderPage } from "./app/growth-studio/referrals/page.ts";
import { renderReviewRequestsPage } from "./app/growth-studio/review-requests/page.ts";
import { renderGrowthReviewsPage } from "./app/growth-studio/reviews/page.ts";
import { renderGrowthAiPlaybooksPage } from "./app/growth-studio/ai-playbooks/page.ts";
import { renderGrowthRecommendationsPage } from "./app/growth-studio/recommendations/page.ts";
import { renderCampaignClaimReviewPage } from "./app/growth-studio/legal-readiness/campaign-review/page.ts";
import { renderLocalGrowthPage } from "./app/growth-studio/local-growth/page.ts";
import { renderGrowthStudioSetupPage } from "./app/growth-studio/setup/page.ts";
import { renderWinBackPage } from "./app/growth-studio/win-back/page.ts";
import { renderFeedbackPage } from "./app/feedback/page.ts";
import { renderBusinessBuilderHelpPage } from "./app/help/business-builder/page.ts";
import { renderCreatorStudioHelpPage } from "./app/help/creator-studio/page.ts";
import { renderGrowthStudioHelpPage } from "./app/help/growth-studio/page.ts";
import { renderHelpPage } from "./app/help/page.ts";
import { renderHelpCenterPlaceholderPage } from "./app/help-center/page.ts";
import { renderLicensingPage } from "./app/licensing/page.ts";
import { renderLaunchReadinessPage } from "./app/launch-readiness/page.tsx";
import { renderLoginPage } from "./app/login/page.ts";
import { renderMarketingPage } from "./app/marketing/page.ts";
import { renderOnboardingPage } from "./app/onboarding/page.ts";
import { renderNotFoundPage } from "./app/not-found/page.ts";
import { renderPricingPage } from "./app/pricing/page.ts";
import { renderPromptLibraryPage } from "./app/prompt-library/page.ts";
import { renderPrivacyPage } from "./app/privacy/page.ts";
import {
  renderBusinessBuilderMarketingPage,
  renderCreatorStudioMarketingPage,
  renderGrowthStudioMarketingPage,
  renderPublicHomePage
} from "./app/public-marketing/page.ts";
import { renderApprovalGatesPage } from "./app/security-center/approval-gates/page.ts";
import { renderAutomationReviewPage } from "./app/security-center/automation-review/page.ts";
import { renderAuditLogsPage } from "./app/security-center/audit-logs/page.ts";
import { renderExternalModelSafetyPage } from "./app/security-center/external-model-safety/page.ts";
import { renderHumanApprovalGatesPage } from "./app/security-center/human-approval-gates/page.ts";
import { renderLegalRiskReviewPage } from "./app/security-center/legal-risk-review/page.ts";
import { renderOpenSourceRiskPage } from "./app/security-center/open-source-risk/page.ts";
import { renderDeploymentSecurityPage } from "./app/security-center/deployment-security/page.ts";
import { renderOpportunitiesPage } from "./app/opportunities/page.ts";
import { renderPhishingDefensePage } from "./app/security-center/phishing-defense/page.ts";
import { renderSecurityCenterPage } from "./app/security-center/page.ts";
import { renderSourceLeakPreventionPage } from "./app/security-center/source-leak-prevention/page.ts";
import { renderSensitiveActionsPage } from "./app/security-center/sensitive-actions/page.ts";
import { renderVideoSourceSafetyPage } from "./app/security-center/video-source-safety/page.ts";
import { renderVisualSafetyPage } from "./app/security-center/visual-safety/page.ts";
import { renderVoiceSafetyPage } from "./app/security-center/voice-safety/page.ts";
import { renderSecurityPolicyPage } from "./app/security/page.ts";
import { renderPromptSafetyPage } from "./app/security-center/prompt-safety/page.ts";
import { renderRecommendationSafetyPage } from "./app/security-center/recommendation-safety/page.ts";
import { renderLaunchSecurityGatePage } from "./app/security-center/launch-security-gate/page.ts";
import { renderSettingsPage } from "./app/settings/page.ts";
import { renderSettingsReadinessPage } from "./app/settings/readiness/page.ts";
import { renderSignupPage } from "./app/signup/page.ts";
import { renderShellDashboard } from "./app/sonara-shell.ts";
import { renderStrategyPage } from "./app/strategyPage.ts";
import { renderSupportPage } from "./app/support/page.ts";
import { renderPrivateStatusPage } from "./app/status/page.ts";
import { renderSubmissionsPage } from "./app/submissions/page.ts";
import { renderTermsPage } from "./app/terms/page.ts";
import { renderRefundPolicyPage } from "./app/refund-policy/page.ts";
import { renderStorefrontPage } from "./app/storefront/page.ts";
import { renderTimelinePage } from "./app/timeline/page.ts";
import { renderVisualizerPage } from "./app/visualizer/page.ts";
import { renderAnalyzePage } from "./pages/analyzePage.ts";
import { renderComposePage } from "./pages/composePage.ts";
import { renderCreatePage } from "./pages/createPage.ts";
import { renderExportPage } from "./pages/exportPage.ts";
import { renderMutationPage } from "./pages/mutationPage.ts";
import { createOrganizationSetupContext } from "./lib/auth/organization-context.ts";
import { createClientSafeError, installGlobalErrorBoundary } from "./lib/debugging/index.ts";
import { logger } from "./lib/logger.ts";
import {
  publicMarketingRoutes,
  publicNavigationLinks,
  type PublicMarketingRoute
} from "./lib/public-marketing/index.ts";
import { getNavigationRoutes, getRouteDefinition, isKnownRoute } from "./routes/route-manifest.ts";
import { applyDeploymentMetadata } from "./config/deployment.ts";
import { SignalSound } from "./sound/signal-sound-engine.ts";
import { findStrategyPage } from "./strategyState.ts";
import { renderOrganizationSwitcherPlaceholder } from "./ui/auth/organization-switcher.ts";
import { renderProtectedRoute } from "./ui/auth/protected-route.ts";
import { renderLoadingState, renderMobileBottomNav } from "./ui/shared-components.ts";
import { renderSoundToggle } from "./ui/sound/sound-toggle.tsx";

export type AppRoute =
  | "/"
  | "/app"
  | "/app/business-builder"
  | "/app/creator-studio"
  | "/app/growth-studio"
  | "/app/admin/command-center"
  | "/app/admin/users"
  | "/app/admin/organizations"
  | "/app/admin/billing"
  | "/app/admin/owner-review"
  | "/app/admin/audit-logs"
  | "/app/admin/security-settings"
  | "/app/admin/deployment-sync"
  | "/app/admin/production-readiness"
  | "/app/admin/open-source-intake"
  | "/app/admin/github-update-watcher"
  | "/app/admin/ai-cost-control"
  | "/app/admin/prompt-library"
  | "/app/admin/email-readiness"
  | "/app/admin/owner-bootstrap"
  | "/app/security-center"
  | "/app/security-center/open-source-risk"
  | "/app/security-center/prompt-safety"
  | "/app/billing"
  | "/app/onboarding"
  | "/app/settings"
  | "/app/settings/readiness"
  | "/app/prompt-library"
  | "/app/business-builder/ai-playbooks"
  | "/app/business-builder/recommendations"
  | "/app/creator-studio/ai-playbooks"
  | "/app/creator-studio/recommendations"
  | "/app/growth-studio/ai-playbooks"
  | "/app/growth-studio/recommendations"
  | "/login"
  | "/signup"
  | "/pricing"
  | "/about"
  | "/security"
  | "/contact"
  | "/terms"
  | "/privacy"
  | "/refund-policy"
  | "/acceptable-use"
  | "/disclaimers"
  | "/beta"
  | "/help"
  | "/help/business-builder"
  | "/help/creator-studio"
  | "/help/growth-studio"
  | "/feedback"
  | "/support"
  | "/not-found"
  | "/onboarding"
  | "/dashboard"
  | "/business-builder"
  | "/business-builder/proof-passport"
  | "/business-builder/recommendations"
  | "/business-builder/money-path"
  | "/business-builder/smart-intake"
  | "/business-builder/offers"
  | "/business-builder/customers"
  | "/business-builder/customers/follow-up"
  | "/business-builder/autopilot-board"
  | "/business-builder/payment-options"
  | "/business-builder/bookings"
  | "/business-builder/reviews"
  | "/business-builder/legal-readiness"
  | "/business-builder/setup"
  | "/creator-studio"
  | "/creator-studio/proof-card"
  | "/creator-studio/recommendations"
  | "/creator-studio/asset-vault"
  | "/creator-studio/project-rooms"
  | "/creator-studio/release-checklist"
  | "/creator-studio/service-offers"
  | "/creator-studio/payment-booking"
  | "/creator-studio/legal-readiness/rights-licensing"
  | "/creator-studio/video-review"
  | "/creator-studio/voice-studio"
  | "/creator-studio/visual-studio"
  | "/creator-studio/setup"
  | "/growth-studio"
  | "/growth-studio/offers"
  | "/growth-studio/campaigns"
  | "/growth-studio/win-back"
  | "/growth-studio/referrals"
  | "/growth-studio/review-requests"
  | "/growth-studio/local-growth"
  | "/growth-studio/reviews"
  | "/growth-studio/recommendations"
  | "/growth-studio/legal-readiness/campaign-review"
  | "/growth-studio/campaign-visuals"
  | "/growth-studio/setup"
  | "/security-center"
  | "/security-center/launch-security-gate"
  | "/security-center/automation-review"
  | "/security-center/human-approval-gates"
  | "/security-center/sensitive-actions"
  | "/security-center/audit-logs"
  | "/security-center/approval-gates"
  | "/security-center/source-leak-prevention"
  | "/security-center/phishing-defense"
  | "/security-center/external-model-safety"
  | "/security-center/legal-risk-review"
  | "/security-center/open-source-risk"
  | "/security-center/deployment-security"
  | "/security-center/recommendation-safety"
  | "/security-center/voice-safety"
  | "/security-center/visual-safety"
  | "/security-center/video-source-safety"
  | "/admin/reliability-center"
  | "/admin/reliability-center/providers"
  | "/admin/reliability-center/incidents"
  | "/admin/reliability-center/continuity-mode"
  | "/admin/ai-providers"
  | "/admin/ai-providers/model-router"
  | "/admin/video-intelligence"
  | "/admin/dev-tunnel-tools"
  | "/admin/open-source-intake"
  | "/admin/open-source-intake/reviews"
  | "/admin/open-source-intake/blocked"
  | "/admin/github-update-watcher"
  | "/admin/ai-cost-control"
  | "/admin/production-readiness"
  | "/admin/security-settings"
  | "/admin/deployment-sync"
  | "/admin/deployment-sync/domain"
  | "/admin/deployment-sync/github"
  | "/admin/deployment-sync/vercel"
  | "/admin/deployment-sync/supabase"
  | "/admin/deployment-sync/stripe"
  | "/admin/deployment-sync/docker-rancher"
  | "/admin/diagnostics"
  | "/admin/prompt-library"
  | "/admin/recommendation-audit"
  | "/admin/market-pattern-lab"
  | "/admin/notification-settings"
  | "/admin/profitability-dashboard"
  | "/admin/command-center"
  | "/admin/users"
  | "/admin/organizations"
  | "/admin/billing"
  | "/admin/payments"
  | "/admin/autopilot"
  | "/admin/support"
  | "/admin/email-readiness"
  | "/admin/audit-logs"
  | "/admin/system-health"
  | "/admin/settings"
  | "/admin/owner-bootstrap"
  | "/admin/go-live-checklist"
  | "/admin/operations"
  | "/admin/owner-review"
  | "/admin/owner-review/pending"
  | "/admin/owner-review/approved"
  | "/admin/owner-review/rejected"
  | "/admin/automation-rules"
  | "/admin/developer-utilities"
  | "/admin/developer-tools"
  | "/admin/launch-checklist"
  | "/settings"
  | "/settings/readiness"
  | "/billing"
  | "/billing/success"
  | "/billing/cancel"
  | "/help-center"
  | "/status"
  | "/create"
  | "/analyze"
  | "/compose"
  | "/mutation"
  | "/export"
  | "/downloads"
  | "/marketing"
  | "/account"
  | "/admin"
  | "/launch-readiness"
  | "/timeline"
  | "/content"
  | "/visualizer"
  | "/storefront"
  | "/opportunities"
  | "/creator-crm"
  | "/submissions"
  | "/licensing"
  | "/audience"
  | "/experiments"
  | "/signature-memory"
  | "/prompt-genome"
  | "/producer-copilot"
  | "/rights-vault"
  | "/release-simulator"
  | "/plugin-marketplace"
  | "/collaboration-rooms"
  | "/label-dashboard"
  | "/agent-routing"
  | "/readiness-audit"
  | "/campaign-assistant"
  | "/catalog-compounding"
  | "/deal-room"
  | "/pricing-models"
  | "/knowledge-search"
  | "/enterprise-controls"
  | "/command-center"
  | "/orchestration"
  | "/positioning"
  | "/readiness-package";

const publicMarketingRouteSet = new Set<string>(publicMarketingRoutes);

function isPublicMarketingRoute(route: AppRoute): route is PublicMarketingRoute {
  return publicMarketingRouteSet.has(route);
}

export function normalizeRoute(pathname: string): AppRoute {
  if (isKnownRoute(pathname)) {
    return pathname as AppRoute;
  }
  return "/not-found";
}

export function createApp(root: HTMLElement) {
  const organizationContext = createOrganizationSetupContext();
  installGlobalErrorBoundary();

  function routeTo(path: string) {
    window.history.pushState({}, "", path);
    SignalSound.play("state_change");
    renderLoadingRoute(normalizeRoute(path));
    Promise.resolve().then(render);
  }

  function render() {
    const requestedPath = window.location.pathname;
    const route = normalizeRoute(requestedPath);
    applyDeploymentMetadata(route);
    clearElement(root);
    root.append(
      isPublicMarketingRoute(route)
        ? createPublicNavigation(route)
        : createNavigation(route, organizationContext)
    );

    try {
      if (route === "/") {
        root.append(renderPublicHomePage());
        return;
      }
      if (route === "/pricing") {
        root.append(renderPricingPage());
        return;
      }
      if (route === "/about") {
        root.append(renderAboutPage());
        return;
      }
      if (route === "/security") {
        root.append(renderSecurityPolicyPage());
        return;
      }
      if (route === "/contact") {
        root.append(renderContactPolicyPage());
        return;
      }
      if (route === "/terms") {
        root.append(renderTermsPage());
        return;
      }
      if (route === "/privacy") {
        root.append(renderPrivacyPage());
        return;
      }
      if (route === "/refund-policy") {
        root.append(renderRefundPolicyPage());
        return;
      }
      if (route === "/acceptable-use") {
        root.append(renderAcceptableUsePage());
        return;
      }
      if (route === "/disclaimers") {
        root.append(renderDisclaimersPage());
        return;
      }
      if (route === "/beta") {
        root.append(renderBetaInvitePage());
        return;
      }
      if (route === "/help") {
        root.append(renderHelpPage());
        return;
      }
      if (route === "/help/business-builder") {
        root.append(renderBusinessBuilderHelpPage());
        return;
      }
      if (route === "/help/creator-studio") {
        root.append(renderCreatorStudioHelpPage());
        return;
      }
      if (route === "/help/growth-studio") {
        root.append(renderGrowthStudioHelpPage());
        return;
      }
      if (route === "/feedback") {
        root.append(renderFeedbackPage());
        return;
      }
      if (route === "/support") {
        root.append(renderSupportPage());
        return;
      }
      if (route === "/login") {
        root.append(renderLoginPage());
        return;
      }
      if (route === "/signup") {
        root.append(renderSignupPage());
        return;
      }
      if (route === "/not-found") {
        root.append(renderNotFoundPage(requestedPath));
        return;
      }
      if (route === "/onboarding") {
        root.append(renderOnboardingPage());
        return;
      }
      if (route === "/app") {
        appendRoute(route, () => renderShellDashboard());
        return;
      }
      if (route === "/app/business-builder") {
        appendRoute(route, () => renderBusinessBuilderMarketingPage());
        return;
      }
      if (route === "/app/creator-studio") {
        appendRoute(route, () => renderCreatorStudioMarketingPage());
        return;
      }
      if (route === "/app/growth-studio") {
        appendRoute(route, () => renderGrowthStudioMarketingPage());
        return;
      }
      if (route === "/app/admin/command-center") {
        appendRoute(route, () => renderAdminCommandCenterPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/users") {
        appendRoute(route, () => renderAdminUsersPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/organizations") {
        appendRoute(route, () => renderAdminOrganizationsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/billing") {
        appendRoute(route, () => renderAdminBillingPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/owner-review") {
        appendRoute(route, () => renderOwnerReviewPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/audit-logs") {
        appendRoute(route, () => renderAdminAuditLogsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/security-settings") {
        appendRoute(route, () => renderSecuritySettingsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/deployment-sync") {
        appendRoute(route, () => renderDeploymentSyncPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/production-readiness") {
        appendRoute(route, () => renderProductionReadinessPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/open-source-intake") {
        appendRoute(route, () => renderOpenSourceIntakePage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/github-update-watcher") {
        appendRoute(route, () => renderGitHubUpdateWatcherPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/ai-cost-control") {
        appendRoute(route, () => renderAiCostControlPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/prompt-library") {
        appendRoute(route, () => renderAdminPromptLibraryPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/email-readiness") {
        appendRoute(route, () => renderAdminEmailReadinessPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/admin/owner-bootstrap") {
        appendRoute(route, () => renderOwnerBootstrapPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/settings") {
        appendRoute(route, () => renderSettingsPage());
        return;
      }
      if (route === "/app/settings/readiness") {
        root.append(renderSettingsReadinessPage());
        return;
      }
      if (route === "/app/security-center") {
        appendRoute(route, () => renderSecurityCenterPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/security-center/open-source-risk") {
        appendRoute(route, () => renderOpenSourceRiskPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/security-center/prompt-safety") {
        appendRoute(route, () => renderPromptSafetyPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/app/billing") {
        appendRoute(route, () => renderBillingPlaceholderPage());
        return;
      }
      if (route === "/app/onboarding") {
        appendRoute(route, () => renderOnboardingPage());
        return;
      }
      if (route === "/app/prompt-library") {
        appendRoute(route, () => renderPromptLibraryPage());
        return;
      }
      if (route === "/app/business-builder/ai-playbooks") {
        appendRoute(route, () => renderBusinessAiPlaybooksPage());
        return;
      }
      if (route === "/app/business-builder/recommendations") {
        appendRoute(route, () => renderBusinessRecommendationsPage());
        return;
      }
      if (route === "/app/creator-studio/ai-playbooks") {
        appendRoute(route, () => renderCreatorAiPlaybooksPage());
        return;
      }
      if (route === "/app/creator-studio/recommendations") {
        appendRoute(route, () => renderCreatorRecommendationsPage());
        return;
      }
      if (route === "/app/growth-studio/ai-playbooks") {
        appendRoute(route, () => renderGrowthAiPlaybooksPage());
        return;
      }
      if (route === "/app/growth-studio/recommendations") {
        appendRoute(route, () => renderGrowthRecommendationsPage());
        return;
      }
      if (route === "/dashboard") {
        root.append(renderShellDashboard());
        return;
      }
      if (route === "/business-builder") {
        root.append(renderBusinessBuilderMarketingPage());
        return;
      }
      if (route === "/business-builder/proof-passport") {
        root.append(renderProofPassportPage());
        return;
      }
      if (route === "/business-builder/recommendations") {
        root.append(renderBusinessRecommendationsPage());
        return;
      }
      if (route === "/business-builder/money-path") {
        root.append(renderMoneyPathPage());
        return;
      }
      if (route === "/business-builder/smart-intake") {
        root.append(renderSmartIntakePage());
        return;
      }
      if (route === "/business-builder/offers") {
        root.append(renderOffersPage());
        return;
      }
      if (route === "/business-builder/customers") {
        root.append(renderCustomersPage());
        return;
      }
      if (route === "/business-builder/customers/follow-up") {
        root.append(renderCustomerFollowUpPage());
        return;
      }
      if (route === "/business-builder/autopilot-board") {
        root.append(renderAutopilotBoardPage());
        return;
      }
      if (route === "/business-builder/payment-options") {
        root.append(renderBusinessPaymentOptionsPage());
        return;
      }
      if (route === "/business-builder/bookings") {
        root.append(renderBusinessBookingsPage());
        return;
      }
      if (route === "/business-builder/reviews") {
        root.append(renderBusinessReviewsPage());
        return;
      }
      if (route === "/business-builder/legal-readiness") {
        root.append(renderBusinessLegalReadinessPage());
        return;
      }
      if (route === "/business-builder/setup") {
        root.append(renderBusinessBuilderSetupPage());
        return;
      }
      if (route === "/creator-studio") {
        root.append(renderCreatorStudioMarketingPage());
        return;
      }
      if (route === "/creator-studio/proof-card") {
        root.append(renderCreatorProofCardPage());
        return;
      }
      if (route === "/creator-studio/recommendations") {
        root.append(renderCreatorRecommendationsPage());
        return;
      }
      if (route === "/creator-studio/asset-vault") {
        root.append(renderAssetVaultPage());
        return;
      }
      if (route === "/creator-studio/project-rooms") {
        root.append(renderProjectRoomsPage());
        return;
      }
      if (route === "/creator-studio/release-checklist") {
        root.append(renderReleaseChecklistPage());
        return;
      }
      if (route === "/creator-studio/service-offers") {
        root.append(renderServiceOffersPage());
        return;
      }
      if (route === "/creator-studio/payment-booking") {
        root.append(renderCreatorPaymentBookingPage());
        return;
      }
      if (route === "/creator-studio/legal-readiness/rights-licensing") {
        root.append(renderRightsLicensingPage());
        return;
      }
      if (route === "/creator-studio/video-review") {
        appendRoute(route, () => renderCreatorVideoReviewPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/creator-studio/voice-studio") {
        appendRoute(route, () => renderVoiceStudioPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/creator-studio/visual-studio") {
        appendRoute(route, () => renderVisualStudioPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/creator-studio/setup") {
        root.append(renderCreatorStudioSetupPage());
        return;
      }
      if (route === "/growth-studio") {
        root.append(renderGrowthStudioMarketingPage());
        return;
      }
      if (route === "/growth-studio/offers") {
        root.append(renderGrowthOffersPage());
        return;
      }
      if (route === "/growth-studio/campaigns") {
        root.append(renderGrowthCampaignsPage());
        return;
      }
      if (route === "/growth-studio/win-back") {
        root.append(renderWinBackPage());
        return;
      }
      if (route === "/growth-studio/referrals") {
        root.append(renderReferralBuilderPage());
        return;
      }
      if (route === "/growth-studio/review-requests") {
        root.append(renderReviewRequestsPage());
        return;
      }
      if (route === "/growth-studio/local-growth") {
        root.append(renderLocalGrowthPage());
        return;
      }
      if (route === "/growth-studio/reviews") {
        root.append(renderGrowthReviewsPage());
        return;
      }
      if (route === "/growth-studio/recommendations") {
        root.append(renderGrowthRecommendationsPage());
        return;
      }
      if (route === "/growth-studio/legal-readiness/campaign-review") {
        root.append(renderCampaignClaimReviewPage());
        return;
      }
      if (route === "/growth-studio/campaign-visuals") {
        appendRoute(route, () => renderCampaignVisualsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/growth-studio/setup") {
        root.append(renderGrowthStudioSetupPage());
        return;
      }
      if (route === "/security-center") {
        appendRoute(route, () => renderSecurityCenterPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/launch-security-gate") {
        appendRoute(route, () => renderLaunchSecurityGatePage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/automation-review") {
        appendRoute(route, () => renderAutomationReviewPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/human-approval-gates") {
        appendRoute(route, () => renderHumanApprovalGatesPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/sensitive-actions") {
        appendRoute(route, () => renderSensitiveActionsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/audit-logs") {
        appendRoute(route, () => renderAuditLogsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/approval-gates") {
        appendRoute(route, () => renderApprovalGatesPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/source-leak-prevention") {
        appendRoute(route, () => renderSourceLeakPreventionPage(), {
          renderBlockedPreview: true
        });
        return;
      }
      if (route === "/security-center/phishing-defense") {
        appendRoute(route, () => renderPhishingDefensePage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/external-model-safety") {
        appendRoute(route, () => renderExternalModelSafetyPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/legal-risk-review") {
        appendRoute(route, () => renderLegalRiskReviewPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/open-source-risk") {
        appendRoute(route, () => renderOpenSourceRiskPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/deployment-security") {
        appendRoute(route, () => renderDeploymentSecurityPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/recommendation-safety") {
        appendRoute(route, () => renderRecommendationSafetyPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/voice-safety") {
        appendRoute(route, () => renderVoiceSafetyPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/visual-safety") {
        appendRoute(route, () => renderVisualSafetyPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/security-center/video-source-safety") {
        appendRoute(route, () => renderVideoSourceSafetyPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/reliability-center") {
        appendRoute(route, () => renderReliabilityCenterPage());
        return;
      }
      if (route === "/admin/reliability-center/providers") {
        appendRoute(route, () => renderProviderHealthPage());
        return;
      }
      if (route === "/admin/reliability-center/incidents") {
        appendRoute(route, () => renderIncidentRecordsPage());
        return;
      }
      if (route === "/admin/reliability-center/continuity-mode") {
        appendRoute(route, () => renderContinuityModePage());
        return;
      }
      if (route === "/admin/ai-providers") {
        appendRoute(route, () => renderAIProvidersPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/ai-providers/model-router") {
        appendRoute(route, () => renderModelRouterPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/video-intelligence") {
        appendRoute(route, () => renderVideoIntelligencePage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/dev-tunnel-tools") {
        appendRoute(route, () => renderDevTunnelToolsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/open-source-intake") {
        appendRoute(route, () => renderOpenSourceIntakePage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/open-source-intake/reviews") {
        appendRoute(route, () => renderOpenSourceIntakeReviewsPage(), {
          renderBlockedPreview: true
        });
        return;
      }
      if (route === "/admin/open-source-intake/blocked") {
        appendRoute(route, () => renderOpenSourceIntakeBlockedPage(), {
          renderBlockedPreview: true
        });
        return;
      }
      if (route === "/admin/github-update-watcher") {
        appendRoute(route, () => renderGitHubUpdateWatcherPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/ai-cost-control") {
        appendRoute(route, () => renderAiCostControlPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/production-readiness") {
        appendRoute(route, () => renderProductionReadinessPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/security-settings") {
        appendRoute(route, () => renderSecuritySettingsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/deployment-sync") {
        appendRoute(route, () => renderDeploymentSyncPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/deployment-sync/domain") {
        appendRoute(route, () => renderDeploymentSyncDomainPage(), {
          renderBlockedPreview: true
        });
        return;
      }
      if (route === "/admin/deployment-sync/github") {
        appendRoute(route, () => renderDeploymentSyncGitHubPage(), {
          renderBlockedPreview: true
        });
        return;
      }
      if (route === "/admin/deployment-sync/vercel") {
        appendRoute(route, () => renderDeploymentSyncVercelPage(), {
          renderBlockedPreview: true
        });
        return;
      }
      if (route === "/admin/deployment-sync/supabase") {
        appendRoute(route, () => renderDeploymentSyncSupabasePage(), {
          renderBlockedPreview: true
        });
        return;
      }
      if (route === "/admin/deployment-sync/stripe") {
        appendRoute(route, () => renderDeploymentSyncStripePage(), {
          renderBlockedPreview: true
        });
        return;
      }
      if (route === "/admin/deployment-sync/docker-rancher") {
        appendRoute(route, () => renderDeploymentSyncDockerRancherPage(), {
          renderBlockedPreview: true
        });
        return;
      }
      if (route === "/admin/diagnostics") {
        appendRoute(route, () => renderAdminDiagnosticsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/prompt-library") {
        appendRoute(route, () => renderAdminPromptLibraryPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/recommendation-audit") {
        appendRoute(route, () => renderRecommendationAuditPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/market-pattern-lab") {
        appendRoute(route, () => renderMarketPatternLabPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/notification-settings") {
        appendRoute(route, () => renderNotificationSettingsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/profitability-dashboard") {
        appendRoute(route, () => renderProfitabilityDashboardPage(), {
          renderBlockedPreview: true
        });
        return;
      }
      if (route === "/admin/command-center") {
        appendRoute(route, () => renderAdminCommandCenterPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/users") {
        appendRoute(route, () => renderAdminUsersPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/organizations") {
        appendRoute(route, () => renderAdminOrganizationsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/billing") {
        appendRoute(route, () => renderAdminBillingPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/payments") {
        appendRoute(route, () => renderAdminPaymentsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/autopilot") {
        appendRoute(route, () => renderAdminAutopilotPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/support") {
        appendRoute(route, () => renderAdminSupportPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/email-readiness") {
        appendRoute(route, () => renderAdminEmailReadinessPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/audit-logs") {
        appendRoute(route, () => renderAdminAuditLogsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/system-health") {
        appendRoute(route, () => renderAdminSystemHealthPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/settings") {
        appendRoute(route, () => renderAdminSettingsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/owner-bootstrap") {
        appendRoute(route, () => renderOwnerBootstrapPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/go-live-checklist") {
        appendRoute(route, () => renderAdminGoLiveChecklistPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/operations") {
        appendRoute(route, () => renderPostLaunchOperationsPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/owner-review") {
        appendRoute(route, () => renderOwnerReviewPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/owner-review/pending") {
        appendRoute(route, () => renderOwnerReviewPendingPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/owner-review/approved") {
        appendRoute(route, () => renderOwnerReviewApprovedPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/owner-review/rejected") {
        appendRoute(route, () => renderOwnerReviewRejectedPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/automation-rules") {
        appendRoute(route, () => renderAutomationRulesPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/admin/developer-utilities") {
        appendRoute(route, () => renderDeveloperUtilitiesPage());
        return;
      }
      if (route === "/admin/developer-tools") {
        appendRoute(route, () => renderDeveloperToolsPage());
        return;
      }
      if (route === "/admin/launch-checklist") {
        appendRoute(route, () => renderAdminLaunchChecklistPage(), { renderBlockedPreview: true });
        return;
      }
      if (route === "/settings") {
        appendRoute(route, () => renderSettingsPage());
        return;
      }
      if (route === "/settings/readiness") {
        root.append(renderSettingsReadinessPage());
        return;
      }
      if (route === "/billing") {
        appendRoute(route, () => renderBillingPlaceholderPage());
        return;
      }
      if (route === "/billing/success") {
        root.append(renderBillingSuccessPage());
        return;
      }
      if (route === "/billing/cancel") {
        root.append(renderBillingCancelPage());
        return;
      }
      if (route === "/help-center") {
        root.append(renderHelpCenterPlaceholderPage());
        return;
      }
      if (route === "/status") {
        root.append(renderPrivateStatusPage());
        return;
      }
      if (route === "/marketing") {
        root.append(renderMarketingPage());
        return;
      }
      if (route === "/analyze") {
        root.append(renderAnalyzePage());
        return;
      }
      if (route === "/mutation") {
        root.append(renderMutationPage());
        return;
      }
      if (route === "/export") {
        root.append(renderExportPage());
        return;
      }
      if (route === "/downloads") {
        appendRoute(route, () => renderDownloadsPage());
        return;
      }
      if (route === "/account") {
        appendRoute(route, () => renderAccountPage());
        return;
      }
      if (route === "/admin" || route === "/launch-readiness") {
        appendRoute(route, () =>
          route === "/admin" ? renderAdminPage() : renderLaunchReadinessPage()
        );
        return;
      }
      if (route === "/compose") {
        root.append(renderComposePage());
        return;
      }
      if (route === "/timeline") {
        root.append(renderTimelinePage());
        return;
      }
      if (route === "/content") {
        root.append(renderContentPage());
        return;
      }
      if (route === "/visualizer") {
        root.append(renderVisualizerPage());
        return;
      }
      if (route === "/storefront") {
        root.append(renderStorefrontPage());
        return;
      }
      if (route === "/opportunities") {
        root.append(renderOpportunitiesPage());
        return;
      }
      if (route === "/creator-crm") {
        root.append(renderCreatorCrmPage());
        return;
      }
      if (route === "/submissions") {
        root.append(renderSubmissionsPage());
        return;
      }
      if (route === "/licensing") {
        root.append(renderLicensingPage());
        return;
      }
      if (route === "/audience") {
        root.append(renderAudiencePage());
        return;
      }
      if (route === "/experiments") {
        root.append(renderExperimentsPage());
        return;
      }
      const strategyPage = findStrategyPage(route);
      if (strategyPage) {
        root.append(renderStrategyPage(strategyPage));
        return;
      }
      root.append(renderCreatePage(routeTo));
    } catch (error) {
      logger.error("Route render failed", {
        route,
        requestedPath,
        errorMessage: error instanceof Error ? error.message : "Unknown route render error"
      });
      root.append(renderRouteError(route, error));
    } finally {
      root.append(createMobileNavigation(route));
    }
  }

  function appendRoute(
    route: AppRoute,
    renderPage: () => HTMLElement,
    options: { renderBlockedPreview?: boolean } = {}
  ) {
    const definition = getRouteDefinition(route);
    root.append(
      renderProtectedRoute({
        auth: definition?.auth ?? "public",
        context: organizationContext,
        routeLabel: definition?.label ?? route,
        render: renderPage,
        renderBlockedPreview: options.renderBlockedPreview ? renderPage : undefined
      })
    );
  }

  function renderLoadingRoute(route: AppRoute) {
    applyDeploymentMetadata(route);
    clearElement(root);
    root.append(
      isPublicMarketingRoute(route)
        ? createPublicNavigation(route)
        : createNavigation(route, organizationContext)
    );
    const definition = getRouteDefinition(route);
    root.append(renderLoadingState(`Loading ${definition?.label ?? "page"}`));
    root.append(createMobileNavigation(route));
  }

  window.addEventListener("popstate", render);
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const link = target.closest("a");
    const href = link?.getAttribute("href");
    if (!link || !href?.startsWith("/")) {
      return;
    }
    event.preventDefault();
    if (link.classList.contains("primary-action") || link.classList.contains("secondary-action")) {
      SignalSound.play("primary_action");
    }
    routeTo(href);
  });

  render();
  return Object.freeze({ render, routeTo });
}

function createPublicNavigation(activeRoute: PublicMarketingRoute) {
  const nav = createElement("nav", { className: "app-nav" });
  nav.append(createBrandMark(brandIdentity.parentName, getLogoAsset("parent-logo").src));
  nav.append(
    createNavGroup(
      "Products",
      publicNavigationLinks.filter((route) => route.group === "Products"),
      activeRoute
    ),
    createNavGroup(
      "Company",
      publicNavigationLinks.filter((route) => route.group === "Company"),
      activeRoute
    ),
    createNavGroup(
      "Legal",
      publicNavigationLinks.filter((route) => route.group === "Legal"),
      activeRoute
    )
  );
  return nav;
}

function renderRouteError(route: AppRoute, error: unknown) {
  const safeError = createClientSafeError(error, "route");
  const page = createElement("section", {
    className: "work-screen sonara-shell protected-route-card"
  });
  page.setAttribute("role", "alert");
  page.append(
    createElement("p", { className: "shell-kicker", textContent: "Route error" }),
    createElement("h1", { textContent: safeError.title }),
    createElement("p", {
      className: "screen-copy",
      textContent: safeError.message
    }),
    createMetric("Route", route),
    createMetric("Reference", safeError.referenceId),
    createElement("a", {
      className: "secondary-action security-back-link",
      href: "/",
      textContent: "Back home"
    })
  );
  return page;
}

function createNavigation(
  activeRoute: AppRoute,
  organizationContext: ReturnType<typeof createOrganizationSetupContext>
) {
  const nav = createElement("nav", { className: "app-nav" });
  const productRoutes = getNavigationRoutes().filter((route) => route.surface === "product");
  const adminRoutes = getNavigationRoutes().filter((route) => route.surface === "admin");
  const signalRoutes = getNavigationRoutes().filter((route) => route.surface === "workflow");
  nav.append(createBrandMark(brandIdentity.platformName, getLogoAsset("app-icon").src));
  nav.append(renderOrganizationSwitcherPlaceholder(organizationContext));
  nav.append(
    createNavGroup("Products", productRoutes, activeRoute),
    createNavGroup("Admin", adminRoutes, activeRoute),
    createNavGroup("Signal OS", signalRoutes, activeRoute)
  );
  const utilityGroup = createElement("div", {
    className: "app-nav__group app-nav__group--utility"
  });
  for (const route of getNavigationRoutes().filter((item) => item.surface === "support")) {
    utilityGroup.append(createNavLink(route.route, route.label, activeRoute));
  }
  utilityGroup.append(renderSoundToggle());
  nav.append(utilityGroup);
  return nav;
}

function createMobileNavigation(activeRoute: AppRoute) {
  const mobileLabels: Readonly<Record<string, string>> = {
    "/": "Home",
    "/business-builder": "Business",
    "/creator-studio": "Creator",
    "/growth-studio": "Growth",
    "/security-center": "Trust",
    "/onboarding": "Setup"
  };
  const routes = getNavigationRoutes()
    .filter((route) =>
      [
        "/",
        "/business-builder",
        "/creator-studio",
        "/growth-studio",
        "/security-center",
        "/onboarding"
      ].includes(route.route)
    )
    .map((route) => ({ ...route, label: mobileLabels[route.route] ?? route.label }));
  return renderMobileBottomNav({ activeRoute, routes });
}

function createBrandMark(label: string, logoSrc: string) {
  const wrapper = createElement("div", { className: "app-nav__brand brand-mark" });
  const logo = createElement("img", { className: "brand-mark__logo" });
  logo.setAttribute("src", logoSrc);
  logo.setAttribute("alt", "");
  logo.setAttribute("aria-hidden", "true");
  wrapper.append(logo, createElement("strong", { textContent: label }));
  return wrapper;
}

function createNavGroup(
  label: string,
  routes: readonly { route: string; label: string }[],
  activeRoute: AppRoute
) {
  const group = createElement("div", { className: "app-nav__group" });
  group.append(createElement("span", { className: "app-nav__label", textContent: label }));
  for (const route of routes) {
    group.append(createNavLink(route.route, route.label, activeRoute));
  }
  return group;
}

function createNavLink(route: string, label: string, activeRoute: AppRoute) {
  const link = createElement("a", { href: route, textContent: label });
  if (route === activeRoute) {
    link.setAttribute("aria-current", "page");
  }
  return link;
}

if (typeof document !== "undefined") {
  const root = document.getElementById("app");
  if (root) {
    createApp(root);
  }
}
