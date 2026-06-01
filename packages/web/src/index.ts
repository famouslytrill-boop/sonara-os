export {
  appIconSet,
  brandBackgrounds,
  brandCssVariables,
  brandIdentity,
  brandLogos,
  brandProductThemes,
  brandTokens,
  getLogoAsset,
  getProductBackground,
  getProductTheme,
  getProductThemeByRoute,
  manifestIconSet,
  openGraphImages,
  productThemeByRoute
} from "@signal-os/ui";
export {
  ActionQueue,
  AutomationAuditLedger,
  AutopilotWorkflowEngine,
  HumanApprovalGate,
  RoutineTaskRunner,
  SafeAutomationPolicy,
  approveWorkflowRecord,
  autoSafeActionKinds,
  blockedActionKinds,
  canRunWithoutApproval,
  createActionQueue,
  createAutomationAuditEvent,
  createAutomationAuditLedger,
  createAutopilotWorkflowEngine,
  createRoutineTaskRunner,
  createWorkflowRecord,
  defaultWorkflowInputs,
  evaluateAutomationAction,
  isBlockedAutomationAction,
  ownerReviewActionKinds,
  rejectWorkflowRecord,
  requiresHumanApproval,
  safeAutomationPolicyRules,
  updateWorkflowStatus,
  workflowTypeLabels
} from "@signal-os/autopilot";
export type {
  ActionQueueState,
  ApprovalDecision,
  ApprovalLevel,
  AutomationActionKind,
  AutomationAuditEvent,
  AutomationAuditEventType,
  AutomationPolicyRule,
  AutomationRiskLabel,
  AutopilotWorkflowType,
  QueueActionResult,
  WorkflowRecord,
  WorkflowRecordInput,
  WorkflowStatus
} from "@signal-os/autopilot";
export {
  OwnerConfirmationLock,
  alwaysBlockedActionKeys,
  areHighRiskAutoExecutionFlagsDisabled,
  approveAction,
  blockAction,
  canBlockedActionExecute,
  classifyActionCategory,
  classifyActionRisk,
  consumeConfirmationToken,
  createApprovalAuditEvent as createOwnerApprovalAuditEvent,
  createApprovalAuditLedger as createOwnerApprovalAuditLedger,
  createConfirmationToken,
  createHumanApprovalGate,
  createOwnerReviewQueueItem,
  createSensitiveActionRecord,
  executeOnlyAfterApproval,
  getOwnerApprovalRequirement,
  getSensitiveActionRegistryEntry,
  isAlwaysBlockedActionKey,
  isConfirmationTokenExpired,
  isOwnerConfirmationCategory,
  isUnknownSensitiveAction,
  ownerConfirmationCategories,
  ownerConfirmationFeatureFlags,
  redactSensitiveText,
  rejectAction,
  requiresOwnerConfirmation,
  sanitizeMetadata,
  sensitiveActionRegistry
} from "@signal-os/owner-confirmation-lock";
export {
  buildExternalProjectRecommendation,
  classifyLicenseRisk as classifyOpenSourceLicenseRisk,
  classifySecurityRisk as classifyOpenSourceSecurityRisk,
  determineIntegrationStatus as determineOpenSourceIntegrationStatus,
  findOpenSourceProject,
  getBlockedOpenSourceProjects,
  getLicenseReviewProjects,
  getOpenSourceIntakeSummary,
  getOpenSourceProjectRegistry,
  getReferenceOnlyProjects,
  getSecurityReviewProjects,
  normalizeExternalProjectUrl,
  openSourceIntakeFeatureFlags,
  openSourceProjectRegistry
} from "@signal-os/open-source-intake";
export type {
  ExternalProjectRecommendation,
  OpenSourceAuditEvent,
  OpenSourceIntegrationStatus,
  OpenSourceLicenseRisk,
  OpenSourceProductFit,
  OpenSourceProjectCategory,
  OpenSourceProjectRecord,
  OpenSourceSecurityRisk,
  OpenSourceUseMode
} from "@signal-os/open-source-intake";
export type {
  ActionRiskLevel,
  ApprovalAuditEvent as OwnerApprovalAuditEvent,
  ApprovalAuditEventType as OwnerApprovalAuditEventType,
  BlockedActionReason,
  ConfirmationToken,
  HumanApprovalGateState,
  OwnerApprovalRequirement,
  OwnerConfirmationAction,
  OwnerConfirmationCategory,
  OwnerConfirmationDecision,
  OwnerConfirmationExecutionResult,
  OwnerConfirmationStatus,
  OwnerReviewQueueItem,
  SensitiveActionRecord,
  SensitiveActionRegistryEntry
} from "@signal-os/owner-confirmation-lock";
export { createApp, normalizeRoute } from "./app.ts";
export { exportTierLabels, finalExportTiers, isFinalExportTier } from "./exportTiers.ts";
export { growthState } from "./growthState.ts";
export { featureFlags, isFeatureEnabled } from "./lib/feature-flags.ts";
export {
  areUnsafeFlagsDisabled,
  featureFlags as sonaraFeatureFlags,
  isSonaraFeatureEnabled
} from "./lib/shared/feature-flags.ts";
export {
  pricingSafetyNotes,
  pricingTiers,
  productMarketingPages,
  publicMarketingRoutes,
  publicNavigationLinks,
  setupServiceTiers,
  sonaraParentStatement,
  sonaraProductPromise,
  sonaraTagline
} from "./lib/public-marketing/index.ts";
export {
  createIncompleteSetupWarnings,
  createLaunchChecklist as createOnboardingLaunchChecklist,
  createLaunchScorePlaceholder as createOnboardingLaunchScorePlaceholder,
  createOnboardingStore,
  createProductSetupChecklist,
  createProductSetupProgress,
  initialOnboardingState,
  launchReadinessStatusLabels,
  onboardingProductLabels,
  onboardingProductSetupRoutes,
  setupNeedLabels
} from "./lib/onboarding/index.ts";
export type {
  IncompleteSetupWarning,
  LaunchChecklistItem,
  LaunchChecklistStatus,
  LaunchReadinessStatus,
  LaunchScorePlaceholder,
  OnboardingProductId,
  OnboardingState,
  OnboardingStorageLike,
  ProductSetupInput,
  ProductSetupProgress,
  SetupChecklistItem,
  SetupNeedStatus
} from "./lib/onboarding/index.ts";
export {
  getCriticalGoLiveBlockers,
  getGoLiveItemsByCategory,
  goLiveCategoryLabels,
  goLiveChecklistItems,
  goLiveStatusLabels,
  summarizeGoLiveChecklist
} from "./lib/go-live/index.ts";
export type {
  GoLiveCategory,
  GoLiveChecklistItem,
  GoLiveChecklistSummary,
  GoLiveLaunchStatus,
  GoLiveStatus
} from "./lib/go-live/index.ts";
export { validateInfrastructureRegistry } from "./lib/shared/validate-infrastructure-registry.ts";
export { getSignalEnv, isSupabaseConfigured, validateSignalEnv } from "./lib/env.ts";
export {
  applyDeploymentMetadata,
  createDeploymentHeadMetadata,
  createHealthResponse,
  getDeploymentConfig
} from "./config/deployment.ts";
export type {
  DeploymentConfig,
  DeploymentDiagnosticsConfig,
  DeploymentHeadMetadata,
  EnvStatus,
  StripeBillingDeploymentHealth
} from "./config/deployment.ts";
export {
  createStripeBillingHealthSnapshot,
  getStripeTestModeChecklist
} from "./lib/billing-health/index.ts";
export type {
  StripeBillingHealthInput,
  StripeBillingHealthSnapshot,
  StripeHealthField,
  StripeHealthStatus
} from "./lib/billing-health/index.ts";
export { createLogRecord, createStructuredLogger, logger, redactLogContext } from "./lib/logger.ts";
export type { LogLevel, LogRecord, StructuredLogger } from "./lib/logger.ts";
export {
  containsSensitiveErrorDetail,
  createApiErrorResponse,
  createClientSafeError,
  createDiagnosticsSnapshot,
  createFeatureFlagSummary,
  formatEnvStatus,
  installGlobalErrorBoundary,
  sanitizeClientMessage
} from "./lib/debugging/index.ts";
export type {
  ApiErrorCode,
  ApiErrorResponse,
  ClientSafeError,
  DiagnosticsSnapshot,
  FeatureFlagSummary,
  GlobalErrorBoundaryController
} from "./lib/debugging/index.ts";
export { auditServerSecrets, getServerSecret, isBrowserRuntime } from "./lib/server-secrets.ts";
export {
  canAccessAdminArea,
  canAccessProtectedRoute,
  canManageOrganization,
  createAuditMetadata,
  createOrganizationContext,
  createOrganizationSetupContext,
  createSignedOutOrganizationContext,
  getActiveMembership,
  getRolePermissions,
  hasAuditMetadata,
  isOrganizationContextReady,
  isOrganizationRole,
  organizationRoles,
  roleHasPermission,
  rolePermissions
} from "./lib/auth/index.ts";
export type {
  AuditMetadata,
  AuthSetupState,
  MembershipStatus,
  Organization,
  OrganizationContext,
  OrganizationKind,
  OrganizationMembership,
  OrganizationRole,
  OrganizationStatus,
  Permission,
  UserProfile
} from "./lib/auth/index.ts";
export {
  checkAudioDeviceSupport,
  isAudioCaptureSupported,
  listAudioInputDevices,
  requestAudioReadiness
} from "./media/audio-device-check.ts";
export { requestMicrophonePermission } from "./media/audio-permissions.ts";
export {
  checkVideoDeviceSupport,
  isVideoCaptureSupported,
  isMediaRecorderSupported,
  listVideoInputDevices,
  requestCameraPermission,
  requestVideoReadiness
} from "./media/video-device-check.ts";
export {
  createMockAnalysis,
  createMockComposerSheet,
  createMockExportBundle,
  createMockMutationVariants
} from "./mockWorkflow.ts";
export {
  createCodexRequirementsGatePrompt,
  createFeatureIntakeSubmission,
  createFeatureSpecCard,
  featureIntakeRequiredQuestions,
  getFeatureIntakeRequiredQuestions,
  validateFeatureIntake
} from "./lib/requirements/index.ts";
export type {
  FeatureIntakeCategory,
  FeatureIntakeSubmission,
  FeatureIntakeValidationResult,
  FeatureSpecCard
} from "./lib/requirements/index.ts";
export { mutationVariants } from "./mutationVariants.ts";
export { routeProviderRequest } from "./providers/provider-gateway.ts";
export {
  coreRouteDefinitions,
  getAllRouteDefinitions,
  getNavigationRoutes,
  getRequiredLaunchRoutes,
  getRouteDefinition,
  isKnownRoute
} from "./routes/route-manifest.ts";
export { scaleState } from "./scaleState.ts";
export {
  detectUnsafeCloneRequest,
  rewriteStyleRequestSafely
} from "./safety/music-style-safety.ts";
export {
  AppShell,
  DashboardHeader,
  EmptyState,
  LoadingState,
  MobileBottomNav,
  ProductCard,
  PublicShell,
  RiskBadge,
  SetupChecklist,
  StatusBadge,
  renderAppShell,
  renderDashboardHeader,
  renderEmptyState,
  renderLoadingState,
  renderMobileBottomNav,
  renderProductCard,
  renderPublicShell,
  renderRiskBadge,
  renderSetupChecklist,
  renderStatusBadge
} from "./ui/shared-components.ts";
export type {
  BadgeTone,
  ProductCardInput,
  RiskTone,
  SetupChecklistItemView
} from "./ui/shared-components.ts";
export { createSignalOrbModel } from "./signalOrb.ts";
export {
  createLaunchReadinessChecklist,
  createLaunchReadinessSummary,
  requiredLaunchRoutes
} from "./launchReadiness.ts";
export { createLaunchAuditReport } from "./launchAudit.ts";
export { getQ1BuildOrder } from "./lib/implementation-sequencer/build-order-planner.ts";
export { evaluateFinalLaunchHardening } from "./lib/final-launch-hardening/final-launch-hardening-engine.ts";
export {
  aiProviderRegistry,
  createProviderUsageAuditRecord,
  evaluatePromptRedactionGate,
  getAIProviderById,
  getAIProviderRegistry,
  getDefaultEnabledProviders,
  providerUsageAuditModel
} from "./lib/ai-models/index.ts";
export type {
  AIProviderCapability,
  AIProviderDefinition,
  AIProviderId,
  AIProviderPrivacyRisk,
  AIProviderUsageAuditRecord,
  ExternalModelApprovalStatus,
  PromptRedactionGateResult,
  PromptRiskLabel
} from "./lib/ai-models/index.ts";
export {
  createIncidentRecord,
  createRecoveryChecklist,
  createReliabilityCenterStore,
  degradedFeatureStates,
  defaultContinuityModeState,
  initialReliabilityCenterState,
  incidentSeverityLabels,
  providerHealthCards,
  publicStatusPageConfig,
  recoveryChecklist,
  reliabilityProviderLabels,
  webhookReplayQueueStub
} from "./lib/reliability-center/index.ts";
export type {
  ContinuityModeState,
  ContinuityModeStatus,
  DegradedFeatureState,
  IncidentInput,
  IncidentRecord,
  IncidentSeverity,
  IncidentStatus,
  ProviderHealthCard,
  ProviderHealthStatus,
  RecoveryChecklistItem,
  ReliabilityCenterState,
  ReliabilityProviderId,
  ReliabilityStorageLike,
  WebhookReplayQueueStub
} from "./lib/reliability-center/index.ts";
export {
  createAttorneyReviewPacketDraft,
  createCampaignClaimReviewDraft,
  createLegalReadinessStore,
  createRightsLicensingTrackerDraft,
  evaluateLegalTextRisk,
  getLegalRiskLabel,
  initialLegalReadinessState,
  legalProductAreaLabels,
  legalReadinessChecklist,
  legalReadinessSafetyRules,
  legalRiskLabels,
  requiresHumanReview
} from "./lib/legal-readiness/index.ts";
export type {
  AttorneyReviewPacketDraft,
  AttorneyReviewPacketInput,
  CampaignClaimReviewDraft,
  CampaignClaimReviewInput,
  LegalChecklistItem,
  LegalProductArea,
  LegalReadinessState,
  LegalReadinessStorageLike,
  LegalRecordStatus,
  LegalReviewArea,
  LegalRiskEvaluation,
  LegalRiskLevel,
  RightsLicensingTrackerDraft,
  RightsLicensingTrackerInput
} from "./lib/legal-readiness/index.ts";
export {
  areDangerousBetaCapabilitiesDisabled,
  betaAuditPlaceholders,
  betaDangerousCapabilityDefaults,
  betaSafetyRules,
  betaStudioFeatureFlagDefaults,
  betaStudioShells,
  getBetaAuditPlaceholders,
  getBetaStudioShellByRoute
} from "./lib/beta-studios/index.ts";
export type {
  BetaAuditPlaceholder,
  BetaDangerousCapabilityFlag,
  BetaSafetyRule,
  BetaStudioFeatureFlag,
  BetaStudioId,
  BetaStudioRiskLevel,
  BetaStudioRoute,
  BetaStudioShell
} from "./lib/beta-studios/index.ts";
export {
  blockedTunnelRoutes,
  buildTunnelCommand,
  devTunnelAuditPlaceholders,
  devTunnelProviders,
  devTunnelSafetyWarnings,
  devTunnelWebhookNotes,
  evaluateTunnelRouteSafety,
  isSafeLocalPort,
  tunnelPurposeLabels
} from "./lib/dev-tunnel-tools/index.ts";
export type {
  BlockedTunnelRoute,
  DevTunnelAuditPlaceholder,
  DevTunnelCommandInput,
  DevTunnelCommandResult,
  DevTunnelProvider,
  DevTunnelProviderDoc,
  DevTunnelPurpose,
  TunnelRouteSafetyResult
} from "./lib/dev-tunnel-tools/index.ts";
export {
  businessBuilderSetupOrganizationId,
  communicationPreferenceLabels,
  createBusinessBuilderStore,
  createBusinessJourneyOverview,
  createBusinessJourneySteps,
  createBusinessSetupChecklist,
  createCustomerFollowUpDraft,
  createCustomerRecordDraft,
  customerConsentStatusLabels,
  customerSourceLabels,
  customerStatusLabels,
  createBusinessJourneyWarnings,
  evaluateCustomerCommunicationSafety,
  followUpDraftTypeLabels,
  createLaunchReadinessPlaceholder,
  createMoneyPathEvent,
  createMoneyPathTimeline,
  createNextBusinessAction,
  createOfferDraft,
  createProofPassportDraft,
  createSmartIntakeDraft,
  initialBusinessBuilderState,
  moneyPathEventLabels
} from "./lib/business-builder/index.ts";
export type {
  BusinessBuilderRecordStatus,
  BusinessBuilderState,
  BusinessBuilderStorageLike,
  BusinessJourneyOverview,
  BusinessJourneyStep,
  BusinessJourneyStepId,
  BusinessJourneyTimelineEvent,
  BusinessJourneyTimelineSource,
  BusinessJourneyWarning,
  BusinessNextAction,
  BusinessSetupChecklistItem,
  CustomerCommunicationPreference,
  CustomerConsentStatus,
  CustomerFollowUpDraft,
  CustomerFollowUpInput,
  CustomerRecordDraft,
  CustomerRecordInput,
  CustomerSource,
  CustomerStatus,
  FollowUpDraftStatus,
  FollowUpDraftType,
  MoneyPathEvent,
  MoneyPathEventType,
  OfferDraft,
  ProofPassportDraft,
  SmartIntakeDraft
} from "./lib/business-builder/index.ts";
export {
  analyticsEventPlaceholders,
  areDemoAccountsClearlyFake,
  betaDemoAccounts,
  betaFeedbackTypeLabels,
  betaIssueSeverityLabels,
  betaLaunchProductLabels,
  createBetaInviteRequest,
  createBetaLaunchStore,
  createFeedbackRecord,
  createIssueReportRecord,
  getHelpDoc,
  getProductWalkthrough,
  helpDocs,
  initialBetaLaunchState,
  onboardingEmailTemplates,
  productWalkthroughs
} from "./lib/beta-launch/index.ts";
export type {
  AnalyticsEventPlaceholder,
  BetaDemoAccount,
  BetaFeedbackType,
  BetaInviteInput,
  BetaInviteRequest,
  BetaIssueSeverity,
  BetaLaunchProductId,
  BetaLaunchState,
  BetaLaunchStorageLike,
  FeedbackInput,
  FeedbackRecord,
  HelpDoc,
  HelpDocSection,
  IssueReportInput,
  IssueReportRecord,
  OnboardingEmailTemplate,
  ProductWalkthrough,
  ProductWalkthroughStep
} from "./lib/beta-launch/index.ts";
export {
  bookingTypeLabels,
  createBookingLinkRecord,
  createLinkWarnings,
  createMoneyAdjacentStore,
  createPaymentOptionRecord,
  createPaymentWarnings,
  createReviewTrustRecord,
  hasPaymentCredentialFields,
  initialMoneyAdjacentState,
  isSafeHttpUrl,
  normalizeHttpUrl,
  paymentProviderLabels,
  reviewRecordLabels,
  trustWarningLabels
} from "./lib/money-adjacent/index.ts";
export type {
  BookingLinkRecord,
  BookingLinkType,
  LinkTrustWarning,
  MoneyAdjacentState,
  MoneyAdjacentStorageLike,
  MoneyProductArea,
  PaymentOptionRecord,
  PaymentProvider,
  ReviewRecordType,
  ReviewTrustRecord,
  VerificationStatus
} from "./lib/money-adjacent/index.ts";
export {
  createCreatorAssetRecord,
  createCreatorProofCardDraft,
  createCreatorServiceOfferDraft,
  createCreatorSetupChecklist,
  createCreatorStudioStore,
  createProjectRoomRecord,
  createRightsLabels,
  creatorAssetTypeLabels,
  creatorReleaseChecklist,
  initialCreatorStudioState,
  rightsReviewLabels
} from "./lib/creator-studio/index.ts";
export type {
  CreatorAssetInput,
  CreatorAssetRecord,
  CreatorAssetType,
  CreatorProofCardDraft,
  CreatorProofCardInput,
  CreatorRecordStatus,
  CreatorServiceOfferDraft,
  CreatorServiceOfferInput,
  CreatorStudioState,
  CreatorStudioStorageLike,
  ProjectRoomInput,
  ProjectRoomRecord,
  ReleaseChecklistItem,
  RightsReviewLabel
} from "./lib/creator-studio/index.ts";
export {
  campaignChannelLabels,
  createGrowthCampaignRecord,
  createGrowthOfferDraft,
  createGrowthSetupChecklist,
  createGrowthStudioStore,
  createReferralCampaignDraft,
  createWinBackCustomerTag,
  initialGrowthStudioState,
  reviewRequestChecklist
} from "./lib/growth-studio/index.ts";
export type {
  CampaignChannel,
  GrowthCampaignInput,
  GrowthCampaignRecord,
  GrowthOfferDraft,
  GrowthOfferInput,
  GrowthRecordStatus,
  GrowthStudioState,
  GrowthStudioStorageLike,
  ReferralCampaignDraft,
  ReferralCampaignInput,
  ReviewRequestChecklistItem,
  WinBackCustomerInput,
  WinBackCustomerTag
} from "./lib/growth-studio/index.ts";
export {
  decodeBase64,
  decodeJwt,
  decodeUrl,
  encodeBase64,
  encodeUrl,
  formatJson,
  generateSlug,
  generateUuid,
  redactWebhookPayload
} from "./lib/developer-utilities/index.ts";
export type {
  JwtDecodeResult,
  RedactionResult,
  UtilityResult
} from "./lib/developer-utilities/index.ts";
export {
  approvalEventModel,
  auditLogModel,
  getRiskLabelText,
  isCriticalRiskBlocked,
  launchSecurityChecklist,
  summarizeSecurityChecklist,
  trustShieldRiskLabels
} from "./lib/security/trust-shield-mvp.ts";
export {
  createSensitiveAuditRecord,
  createSetupModeApiResponse,
  createWebhookSignature,
  createWebhookSigningPayload,
  evaluateFileUploadSafety,
  evaluateRateLimitStub,
  fileUploadSafetyPolicy,
  getRateLimitPolicy,
  getSensitiveAuditActionModel,
  hasPublicSecretExposure,
  launchSecurityGateHardeningChecks,
  requiresCsrfProtection,
  sensitiveAuditActionModels,
  sensitiveRateLimitPolicies,
  summarizeLaunchSecurityHardening,
  validateApiRequestContract,
  validateCsrfRequirement,
  validateSecurityEnv,
  verifyWebhookSignature
} from "./lib/security/index.ts";
export type {
  ApiRequestMethod,
  ApiRequestValidationInput,
  ApiRequestValidationResult,
  ApiValidationIssue,
  CsrfValidationResult,
  FileUploadSafetyInput,
  FileUploadSafetyResult,
  LaunchSecurityGateHardeningCheck,
  RateLimitPolicy,
  RateLimitPolicyEvaluation,
  SecurityEnvIssue,
  SecurityEnvIssueSeverity,
  SecurityEnvValidationResult,
  SensitiveAuditActionModel,
  SensitiveAuditActionType,
  SensitiveRateLimitPolicyId,
  SetupModeApiResponse,
  WebhookSignatureVerificationInput,
  WebhookSignatureVerificationResult
} from "./lib/security/index.ts";
export {
  createSourceLeakRiskReport,
  isUnsafeEnvFile,
  scanArtifactTarget,
  sourceLeakCheckDefinitions
} from "./lib/security/source-leak-prevention.ts";
export type {
  ArtifactScanTarget,
  SourceLeakFinding,
  SourceLeakFindingType,
  SourceLeakRiskReport,
  SourceLeakSeverity
} from "./lib/security/source-leak-prevention.ts";
export {
  createSignalSoundEngine,
  playSignalSound,
  prefersReducedMotion,
  readSoundPreference,
  unlockSignalAudio,
  writeSoundPreference
} from "./sound/signal-sound-engine.ts";
export { findStrategyPage, strategyPages } from "./strategyState.ts";
export { SessionContext, createSessionContext, initialSessionState } from "./sessionContext.ts";
export { completeUploadSimulation, createUploadSimulationSnapshots } from "./uploadSimulation.ts";
export { getMissingRequirement, getRecoveryRoute } from "./workflows/workflow-guards.ts";
