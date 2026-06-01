import fs from "node:fs";
import path from "node:path";
import { packageName, repoRoot, toFileUrl } from "./workspace.mjs";

const packageArg = process.argv[2];
if (!packageArg) {
  throw new Error("Usage: node scripts/smoke-package.mjs <package-dir>");
}

const packageDir = path.resolve(process.cwd(), packageArg);
const name = packageName(packageDir);
const entry = path.join(packageDir, "dist/index.mjs");

if (!fs.existsSync(entry)) {
  throw new Error(`Missing build output for ${name}. Run pnpm run build first.`);
}

const mod = await import(toFileUrl(entry));
await runSmoke(name, mod);
console.log(`Smoke package gate passed: ${name}`);

async function runSmoke(name, mod) {
  switch (name) {
    case "@signal-os/core":
      smokeCore(mod);
      return;
    case "@signal-os/autopilot":
      smokeAutopilot(mod);
      return;
    case "@signal-os/runtime":
      smokeRuntime(mod);
      return;
    case "@signal-os/provider-gateway":
      await smokeProviderGateway(mod);
      return;
    case "@signal-os/export":
      smokeExport(mod);
      return;
    case "@signal-os/routes":
      smokeRoutes(mod);
      return;
    case "@signal-os/web":
      await smokeWeb(mod);
      return;
    case "@signal-os/spec-driven-build-system":
      smokeSpecDrivenBuildSystem(mod);
      return;
    case "@signal-os/owner-confirmation-lock":
      smokeOwnerConfirmationLock(mod);
      return;
    case "@signal-os/open-source-intake":
      smokeOpenSourceIntake(mod);
      return;
    case "@signal-os/deployment-sync":
      smokeDeploymentSync(mod);
      return;
    case "@signal-os/recommendation-transparency":
      smokeRecommendationTransparency(mod);
      return;
    case "@signal-os/github-update-watcher":
      smokeGitHubUpdateWatcher(mod);
      return;
    case "@signal-os/api-provider-registry":
      smokeApiProviderRegistry(mod);
      return;
    case "@signal-os/agent-orchestration-guard":
      smokeAgentOrchestrationGuard(mod);
      return;
    case "@signal-os/agent-context-layer":
      smokeAgentContextLayer(mod);
      return;
    case "@signal-os/ai-cost-control":
      smokeAiCostControl(mod);
      return;
    case "@signal-os/market-pattern-lab":
      smokeMarketPatternLab(mod);
      return;
    case "@signal-os/brand-experience-system":
      smokeBrandExperienceSystem(mod);
      return;
    case "@signal-os/notification-sound-system":
      smokeNotificationSoundSystem(mod);
      return;
    case "@signal-os/profitability-dashboard":
      smokeProfitabilityDashboard(mod);
      return;
    case "@signal-os/prompt-playbook-center":
      smokePromptPlaybookCenter(mod);
      return;
    case "@signal-os/payments":
      smokePayments(mod);
      return;
    case "@signal-os/auth":
      smokeAuth(mod);
      return;
    case "@signal-os/database":
      smokeDatabase(mod);
      return;
    case "@signal-os/security":
      smokeSecurity(mod);
      return;
    case "@signal-os/reliability-center":
      smokeReliabilityCenter(mod);
      return;
    case "@signal-os/ui":
      smokeUi(mod);
      return;
    default:
      throw new Error(
        `No smoke test registered for ${name} at ${path.relative(repoRoot, packageDir)}`
      );
  }
}

function smokeCore(mod) {
  assertArrayEqual(
    mod.ExportTiers,
    ["prompt_bundle", "production_bundle", "daw_bundle", "release_bundle", "elite_mutation_bundle"],
    "ExportTiers"
  );
  if (!mod.DawNames.includes("ableton-live")) {
    throw new Error("DawNames missing ableton-live.");
  }
  const sessionStore = mod.createSessionStore();
  sessionStore.startSession({
    sessionId: "s1",
    userId: "u1",
    exportTier: "daw_bundle",
    dawName: "reaper"
  });
  if (sessionStore.getState().dawName !== "reaper") {
    throw new Error("Session store did not persist dawName.");
  }
  if (sessionStore.getState().exportTier !== "daw_bundle") {
    throw new Error("Session store did not persist exportTier.");
  }
  const machine = mod.createWorkflowStateMachine();
  machine.send(mod.WorkflowEvents.START_SESSION);
  machine.send(mod.WorkflowEvents.COMPLETE_ANALYSIS);
  if (machine.getState() !== "analysis-ready") {
    throw new Error("Workflow state machine did not advance.");
  }
}

function smokeAutopilot(mod) {
  for (const engineName of [
    "AutopilotWorkflowEngine",
    "HumanApprovalGate",
    "RoutineTaskRunner",
    "SafeAutomationPolicy",
    "ActionQueue",
    "AutomationAuditLedger"
  ]) {
    if (!mod[engineName]) {
      throw new Error(`Autopilot missing internal engine export: ${engineName}`);
    }
  }
  if (!mod.autoSafeActionKinds.includes("create_internal_task")) {
    throw new Error("Autopilot missing auto-safe internal task rule.");
  }
  if (!mod.ownerReviewActionKinds.includes("send_customer_message")) {
    throw new Error("Autopilot missing owner-review customer message rule.");
  }
  if (!mod.blockedActionKinds.includes("delete_customer_data")) {
    throw new Error("Autopilot missing blocked customer data deletion rule.");
  }
  if (mod.evaluateAutomationAction("draft_message").approvalLevel !== "auto_safe") {
    throw new Error("Autopilot should classify draft messages as auto-safe.");
  }
  if (mod.evaluateAutomationAction("update_payment_link").approvalLevel !== "owner_review") {
    throw new Error("Autopilot should require owner review for payment link changes.");
  }
  if (mod.evaluateAutomationAction("change_payout_destination").approvalLevel !== "blocked") {
    throw new Error("Autopilot should block payout destination changes.");
  }
  const engine = mod.createAutopilotWorkflowEngine();
  const state = engine.seedDefaults();
  if (
    state.completed.length === 0 ||
    state.approvalRequired.length === 0 ||
    state.blocked.length === 0
  ) {
    throw new Error("Autopilot seeded state must include safe, review, and blocked records.");
  }
  if (state.auditEvents.length === 0) {
    throw new Error("Autopilot must create audit events for queued records.");
  }
}

function smokeRuntime(mod) {
  const bus = mod.createEventBus();
  const seen = [];
  bus.onAny((event) => seen.push(event.eventName));
  const adapter = mod.createRuntimeAdapter({ adapterName: "smoke", eventBus: bus });
  adapter.start();
  adapter.reportHealth();
  adapter.stop();
  assertArrayEqual(
    seen,
    [
      "runtime.adapter.created",
      "runtime.adapter.started",
      "runtime.adapter.health",
      "runtime.adapter.stopped"
    ],
    "runtime events"
  );
}

async function smokeProviderGateway(mod) {
  const provider = {
    name: "smoke-provider",
    async complete(request) {
      return { prompt: request.prompt, musicStyle: request.musicStyle };
    }
  };
  const gateway = mod.createProviderGateway({ provider });
  const accepted = await gateway.complete({ prompt: "Make a calm loop", musicStyle: "ambient" });
  if (!accepted.ok || accepted.blocked) {
    throw new Error("Provider Gateway blocked a safe request.");
  }
  const blocked = await gateway.complete({
    prompt: "Make it exactly like a named artist",
    musicStyle: "ambient"
  });
  if (!blocked.blocked) {
    throw new Error("Provider Gateway allowed an imitation request.");
  }
}

function smokeExport(mod) {
  const bundle = mod.createExportBundle({
    bundleId: "bundle-1",
    files: [{ path: "mix.wav", kind: "audio", contentType: "audio/wav", content: "" }],
    provenance: {
      session: { sessionId: "s1" },
      analysis: { bpm: 120 },
      compose: { musicStyle: "ambient" },
      decisionResult: { status: "accepted" }
    }
  });
  const paths = bundle.files.map((file) => file.path);
  for (const expected of [
    "provenance/session.json",
    "provenance/analysis.json",
    "provenance/compose.json",
    "provenance/decision-result.json",
    "provenance/manifest.json"
  ]) {
    if (!paths.includes(expected)) {
      throw new Error(`Export bundle missing ${expected}`);
    }
  }
}

function smokeRoutes(mod) {
  const billing = mod.createBillingRouteHelpers();
  const admin = mod.createAdminRouteHelpers();
  if (billing.checkout("release_bundle") !== "/billing/checkout/release_bundle") {
    throw new Error("Billing checkout route helper failed.");
  }
  if (admin.user("user 1") !== "/admin/users/user%201") {
    throw new Error("Admin user route helper failed.");
  }
}

function smokeSpecDrivenBuildSystem(mod) {
  const incomplete = mod.checkSpecDrift({
    id: "missing-acceptance",
    title: "Missing Acceptance",
    productArea: "business-builder"
  });
  if (incomplete.ok) {
    throw new Error("Spec drift checker did not flag an incomplete spec.");
  }
  if (!incomplete.issues.some((issue) => issue.section === "acceptanceCriteria")) {
    throw new Error("Spec drift checker did not flag missing acceptance criteria.");
  }

  const spec = mod.createFeatureSpec({
    id: "proof-passport",
    title: "Proof Passport",
    productArea: "business-builder",
    problem: "Owners need controlled public proof.",
    users: ["Owner"],
    userStories: ["As an owner, I can review proof before publishing."],
    nonGoals: ["No fake verification."],
    dataModelNotes: ["Separate draft and public fields."],
    routeRequirements: ["Owner route and public route are separate."],
    apiRequirements: ["Public reads return public fields only."],
    securityRequirements: ["Explicit publish action is required."],
    privacyRequirements: ["Owner-only fields stay private."],
    acceptanceCriteria: ["Public profile excludes private fields."],
    testRequirements: ["Test public visibility rules."],
    launchGateRequirements: ["Run typecheck and build."]
  });
  const prompt = mod.createCodexPrompt(spec);
  if (!prompt.includes("Feature: Proof Passport") || !prompt.includes("Acceptance Criteria")) {
    throw new Error("Codex prompt generator did not create a structured prompt.");
  }

  for (const specFile of [
    "specs/business-builder/proof-passport.md",
    "specs/business-builder/money-path.md",
    "specs/business-builder/smart-intake.md",
    "specs/business-builder/offer-builder.md",
    "specs/business-builder/customer-records.md",
    "specs/business-builder/booking-appointments.md",
    "specs/business-builder/reviews.md",
    "specs/creator-studio/creator-asset-vault.md",
    "specs/growth-studio/growth-campaigns.md",
    "specs/security-center/trust-shield.md",
    "specs/security-center/security-center.md",
    "specs/security-center/legal-readiness-center.md",
    "specs/shared-infrastructure/reliability-center.md",
    "specs/shared-infrastructure/ai-provider-registry.md",
    "specs/shared-infrastructure/developer-utility-center.md"
  ]) {
    const fullPath = path.join(repoRoot, specFile);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing starter spec: ${specFile}`);
    }
    const source = fs.readFileSync(fullPath, "utf8");
    for (const heading of [
      "## Problem",
      "## Users",
      "## User Stories",
      "## Non-Goals",
      "## Data Model Notes",
      "## Route Requirements",
      "## API Requirements",
      "## Security Requirements",
      "## Privacy Requirements",
      "## Acceptance Criteria",
      "## Test Requirements",
      "## Launch Gate Requirements"
    ]) {
      if (!source.includes(heading)) {
        throw new Error(`Starter spec ${specFile} missing ${heading}.`);
      }
    }
  }
}

function smokeOwnerConfirmationLock(mod) {
  if (!mod.OwnerConfirmationLock || mod.OwnerConfirmationLock.status !== "enabled") {
    throw new Error("Owner Confirmation Lock package missing enabled metadata.");
  }
  if (!mod.ownerConfirmationFeatureFlags.OWNER_CONFIRMATION_LOCK_ENABLED) {
    throw new Error("Owner Confirmation Lock feature flag must be enabled.");
  }
  if (!mod.areHighRiskAutoExecutionFlagsDisabled()) {
    throw new Error("High-risk owner confirmation auto-execution flags must remain disabled.");
  }
  if (
    mod.getOwnerApprovalRequirement(createOwnerLockSmokeAction("money_movement")) !==
    "owner_review_required"
  ) {
    throw new Error("Money movement must require owner review.");
  }
  if (
    mod.getOwnerApprovalRequirement({
      ...createOwnerLockSmokeAction("payout_settings"),
      actionKey: "change_payout_destination"
    }) !== "blocked_always"
  ) {
    throw new Error("Payout destination changes must be blocked.");
  }
  const gate = mod.createHumanApprovalGate();
  const queued = gate.submitAction(createOwnerLockSmokeAction("customer_facing_campaigns"));
  if (!queued.queued || gate.executeOnlyAfterApproval(queued.record.id).executed) {
    throw new Error("Sensitive action executed without owner approval.");
  }
  gate.approveAction(queued.record.id, "owner_smoke");
  if (!gate.executeOnlyAfterApproval(queued.record.id).executed) {
    throw new Error("Approved sensitive action did not execute after owner approval.");
  }
}

function smokeOpenSourceIntake(mod) {
  const registry = mod.getOpenSourceProjectRegistry();
  if (registry.length !== 35) {
    throw new Error("Open-source intake registry must include all 35 owner-provided projects.");
  }
  if (
    mod.normalizeExternalProjectUrl(
      "https://github.com/xai-org/x-algorithm?fbclid=123&utm_source=facebook#readme"
    ) !== "https://github.com/xai-org/x-algorithm"
  ) {
    throw new Error("Open-source URL normalizer must strip tracking parameters.");
  }
  const erpnext = mod.findOpenSourceProject("frappe", "erpnext");
  if (!erpnext || erpnext.licenseRisk !== "high" || !mod.requiresLicenseReview(erpnext)) {
    throw new Error("ERPNext must remain GPL license-review required.");
  }
  const nextcloud = mod.findOpenSourceProject("nextcloud", "server");
  if (!nextcloud || nextcloud.licenseRisk !== "critical" || !mod.requiresLicenseReview(nextcloud)) {
    throw new Error("Nextcloud must remain AGPL license-review required.");
  }
  const blocked = mod.getBlockedOpenSourceProjects().map((project) => project.repoName);
  if (!blocked.includes("Google-Maps-Scrapper") || !blocked.includes("OpenWA")) {
    throw new Error("Scraping and unofficial WhatsApp automation candidates must be blocked.");
  }
  if (mod.openSourceIntakeFeatureFlags.AUTO_INSTALL_EXTERNAL_REPOS) {
    throw new Error("Open-source intake must not auto-install external repositories.");
  }
  const unknown = mod.findOpenSourceProject("dograh-hq", "dograh");
  if (!unknown || unknown.integrationStatus !== "not_reviewed") {
    throw new Error("Unknown projects must remain not_reviewed.");
  }
}

function smokeRecommendationTransparency(mod) {
  if (!mod.RecommendationSafetyGate || mod.RecommendationSafetyGate.status !== "enabled") {
    throw new Error("Recommendation Transparency missing safety gate metadata.");
  }
  const rankings = mod.createNextBestActions("Business Builder");
  if (!rankings.length || !rankings[0].explanation.whySuggested.includes("because")) {
    throw new Error("Recommendation Transparency must generate explainable actions.");
  }
  const unsafe = mod.evaluateRecommendationSafety({
    actionKey: "request_review_draft",
    title: "Unsafe auto-send",
    productArea: "Growth Studio",
    expectedBusinessValue: "Customer campaign",
    riskLevel: "high",
    confidence: "medium",
    dataUsed: ["sensitive_attribute"],
    dataNotUsed: [],
    customerFacing: true,
    requiresConsent: true,
    hasConsent: false,
    autoExecutes: true,
    usesSensitiveAttributes: true,
    usesFakeUrgency: false,
    usesFakeScarcity: false,
    mentionsFakeReviews: false,
    metadata: {}
  });
  if (unsafe.approvalRequirement !== "blocked") {
    throw new Error("Recommendation safety gate must block unsafe recommendation behavior.");
  }
}

function smokeGitHubUpdateWatcher(mod) {
  const report = mod.createGitHubUpdateWatchReport("2026-05-26T00:00:00.000Z");
  if (report.repositories.length !== 8) {
    throw new Error("GitHub Update Watcher must include the research repo watchlist.");
  }
  if (report.policy.autoInstallExternalRepos || report.policy.autoMergeUpdates) {
    throw new Error("GitHub Update Watcher must remain report-only.");
  }
}

function smokeApiProviderRegistry(mod) {
  const blocked = mod.getBlockedApiProviders().map((provider) => provider.providerId);
  if (!blocked.includes("direct_google_scraping")) {
    throw new Error("API Provider Registry must block direct scraping providers.");
  }
  if (mod.evaluateApiProvider("unknown").status !== "needs_terms_review") {
    throw new Error("Unknown API providers must default to review.");
  }
}

function smokeAgentOrchestrationGuard(mod) {
  if (mod.evaluateAgentAction("draft").allowed !== true) {
    throw new Error("Agent guard must allow draft actions.");
  }
  if (!mod.evaluateAgentAction("production_deploy").approvalRequired) {
    throw new Error("Agent production deploy must require owner approval.");
  }
  if (!mod.evaluateAgentAction("payout_change").blocked) {
    throw new Error("Agent payout changes must be blocked.");
  }
}

function smokeAgentContextLayer(mod) {
  const snapshot = mod.createAgentContextSnapshot(
    "Security Center",
    "redaction",
    "secret=abc token=123 user@example.com"
  );
  if (!snapshot.secretsRedacted || snapshot.rawContext.includes("user@example.com")) {
    throw new Error("Agent context layer must redact sensitive context.");
  }
}

function smokeAiCostControl(mod) {
  if (mod.aiCostControlFeatureFlags.AUTO_RUN_EXPENSIVE_AI_JOBS) {
    throw new Error("AI Cost Control must not auto-run expensive jobs.");
  }
  if (!mod.evaluateAiRunCost(10).ownerApprovalRequired) {
    throw new Error("AI Cost Control must require approval for expensive runs.");
  }
}

function smokeMarketPatternLab(mod) {
  if (!mod.marketPatternCategories.includes("landing_page_layout")) {
    throw new Error("Market Pattern Lab missing landing page category.");
  }
  if (!mod.createMarketPatternChecklist().some((rule) => rule.includes("Do not copy"))) {
    throw new Error("Market Pattern Lab must include copy-prevention rules.");
  }
}

function smokeBrandExperienceSystem(mod) {
  if (mod.sonaraBrandExperience.parent !== "SONARA Industries") {
    throw new Error("Brand Experience System missing parent brand.");
  }
  if (!mod.getBrandExperienceSummary().includes("Build. Prove. Get paid. Grow.")) {
    throw new Error("Brand Experience System missing final message.");
  }
}

function smokeNotificationSoundSystem(mod) {
  if (!mod.notificationSoundPreference.mutedByDefault) {
    throw new Error("Notification Sound System must be muted by default.");
  }
  if (mod.canPlayNotificationSound(true)) {
    throw new Error("Notification Sound System must not autoplay while muted by default.");
  }
}

function smokeProfitabilityDashboard(mod) {
  const summary = mod.summarizeRevenueModel();
  if (!summary.noGuarantees || summary.items < 6) {
    throw new Error("Profitability Dashboard must document revenue model without guarantees.");
  }
}

function smokePromptPlaybookCenter(mod) {
  if (!mod.PromptSafetyGate || mod.PromptSafetyGate.status !== "enabled") {
    throw new Error("Prompt Playbook Center missing safety gate metadata.");
  }
  if (mod.promptPlaybookFeatureFlags.AUTO_SEND_PROMPT_OUTPUTS) {
    throw new Error("Prompt Playbook Center must not auto-send prompt outputs.");
  }
  if (mod.getPromptTemplates().length < mod.promptCategories.length) {
    throw new Error("Prompt Playbook Center must include templates for the requested categories.");
  }
  const unsafe = mod.evaluatePromptSafety({
    text: "Write fake reviews and spam customers.",
    product_area: "growth-studio",
    category: "cold_outreach",
    risk_level: "high",
    public_facing: true,
    customer_facing: true
  });
  if (unsafe.approval_status !== "blocked") {
    throw new Error("Prompt Playbook Center must block unsafe prompt requests.");
  }
}

function smokePayments(mod) {
  if (mod.paymentLaunchPolicy.storesRawCardData || mod.paymentLaunchPolicy.storesCvv) {
    throw new Error("Payments package must not store raw card data or CVV.");
  }
  if (!mod.paymentLaunchPolicy.refundsRequireOwnerApproval) {
    throw new Error("Payments package must require owner approval for refunds.");
  }
}

function smokeAuth(mod) {
  if (!mod.sonaraRoles.includes("owner") || !mod.canAccessAdmin("admin")) {
    throw new Error("Auth package missing owner/admin role model.");
  }
  if (mod.canAccessOwnerOnly("admin")) {
    throw new Error("Auth package must keep owner-only routes owner-only.");
  }
}

function smokeDatabase(mod) {
  if (!mod.launchDatabaseTables.includes("organizations")) {
    throw new Error("Database package missing organizations table registry.");
  }
  if (!mod.databaseLaunchPolicy.serviceRoleServerOnly) {
    throw new Error("Database package must keep service role server-only.");
  }
}

function smokeSecurity(mod) {
  if (!mod.assertLaunchSecurityDefaults()) {
    throw new Error("Security package defaults are unsafe.");
  }
}

function smokeReliabilityCenter(mod) {
  const snapshot = mod.createReliabilitySnapshot();
  if (snapshot.policy.fakeProviderStatusAllowed || snapshot.policy.autoFailoverEnabled) {
    throw new Error("Reliability Center must not fake provider status or auto-failover.");
  }
}

function createOwnerLockSmokeAction(category) {
  return {
    actionKey: `${category}_smoke`,
    category,
    productArea: "SONARA One",
    title: "Smoke action",
    description: "Smoke sensitive action.",
    triggeredBy: "smoke"
  };
}

function smokeUi(mod) {
  if (mod.brandIdentity.parentName !== "SONARA Industries") {
    throw new Error("UI brand identity missing SONARA Industries.");
  }
  if (mod.brandIdentity.platformName !== "SONARA One") {
    throw new Error("UI brand identity missing SONARA One.");
  }
  if (mod.brandIdentity.tagline !== "Build. Create. Grow.") {
    throw new Error("UI brand tagline mismatch.");
  }
  for (const logoId of [
    "parent-logo",
    "app-icon",
    "favicon",
    "open-graph",
    "business-builder-logo",
    "creator-studio-logo",
    "growth-studio-logo"
  ]) {
    const asset = mod.getLogoAsset(logoId);
    if (!asset.src.startsWith("/")) {
      throw new Error(`UI logo asset must use a root-relative path: ${logoId}`);
    }
  }
  if (mod.getProductThemeByRoute("/business-builder").publicName !== "Business Builder") {
    throw new Error("UI product theme missing Business Builder.");
  }
  if (!mod.brandCssVariables["--sonara-business-accent"]) {
    throw new Error("UI brand CSS variables missing product accents.");
  }
}

async function smokeWeb(mod) {
  const context = mod.createSessionContext();
  context.setState(mod.completeUploadSimulation("smoke.wav"));
  if (context.getState().currentStep !== "analyze") {
    throw new Error("Web SessionContext did not advance to analyze after upload simulation.");
  }
  if (context.getState().uploadedFileName !== "smoke.wav") {
    throw new Error("Web SessionContext did not persist uploadedFileName.");
  }
  context.setState({
    ...mod.createMockAnalysis("smoke.wav"),
    analysis: mod.createMockAnalysis("smoke.wav")
  });
  const composition = mod.createMockComposerSheet(context.getState());
  context.setState(composition);
  const generatedVariants = mod.createMockMutationVariants();
  context.setState({
    variants: generatedVariants,
    selectedVariant: generatedVariants[0].name
  });
  const bundle = mod.createMockExportBundle(context.getState());
  if (
    !bundle.json.includes("Radio Variant") ||
    !bundle.text.includes("Signal OS Export Forge Bundle")
  ) {
    throw new Error("Web Export Forge bundle did not include JSON and TXT payloads.");
  }
  const progress = mod
    .createUploadSimulationSnapshots("smoke.wav")
    .map((snapshot) => snapshot.progress);
  assertArrayEqual(progress, [0, 23, 67, 100], "upload simulation progress");
  if (!mod.mutationVariants.some((variant) => variant.name === "Short-Form Hook Variant")) {
    throw new Error("Web mutation variants missing Short-Form Hook Variant.");
  }
  if (mod.createSignalOrbModel().title !== "Signal OS") {
    throw new Error("Web Signal Orb model missing premium hero state.");
  }
  if (mod.normalizeRoute("/mutation") !== "/mutation") {
    throw new Error("Web route normalization did not preserve /mutation.");
  }
  if (mod.normalizeRoute("/missing-route") !== "/not-found") {
    throw new Error("Web route normalization must send unknown routes to /not-found.");
  }
  for (const route of ["/timeline", "/content", "/visualizer", "/storefront", "/opportunities"]) {
    if (mod.normalizeRoute(route) !== route) {
      throw new Error(`Web route normalization did not preserve ${route}.`);
    }
  }
  if (!mod.scaleState.timelinePlans.some((plan) => plan.format === "staggered drops")) {
    throw new Error("Web scale state missing staggered drops timeline plan.");
  }
  if (!mod.scaleState.storefrontOffers.some((offer) => offer.product === "instrumentals")) {
    throw new Error("Web scale state missing instrumentals storefront offer.");
  }
  if (mod.scaleState.catalogLeverageScore <= 0) {
    throw new Error("Web scale state missing catalog leverage score.");
  }
  for (const route of ["/creator-crm", "/submissions", "/licensing", "/audience", "/experiments"]) {
    if (mod.normalizeRoute(route) !== route) {
      throw new Error(`Web route normalization did not preserve ${route}.`);
    }
  }
  if (!mod.growthState.creatorContacts.some((contact) => contact.stage === "prospect")) {
    throw new Error("Web growth state missing creator CRM prospects.");
  }
  if (!mod.growthState.submissionPackage.privateLink) {
    throw new Error("Web growth state missing A&R private links.");
  }
  if (
    !mod.growthState.audienceSignals.some((signal) => signal.segment === "high-value supporters")
  ) {
    throw new Error("Web growth state missing high-value supporters audience segment.");
  }
  if (!mod.growthState.experiments.some((experiment) => experiment.surface === "release timing")) {
    throw new Error("Web growth state missing release timing experiments.");
  }
  for (const route of [
    "/signature-memory",
    "/prompt-genome",
    "/producer-copilot",
    "/rights-vault",
    "/release-simulator",
    "/plugin-marketplace",
    "/collaboration-rooms",
    "/label-dashboard",
    "/agent-routing",
    "/readiness-audit",
    "/campaign-assistant",
    "/catalog-compounding",
    "/deal-room",
    "/pricing-models",
    "/knowledge-search",
    "/enterprise-controls",
    "/command-center",
    "/orchestration",
    "/positioning",
    "/readiness-package"
  ]) {
    if (mod.normalizeRoute(route) !== route) {
      throw new Error(`Web route normalization did not preserve ${route}.`);
    }
  }
  if (mod.strategyPages.length !== 20) {
    throw new Error("Web strategy state must define phases 116 through 135.");
  }
  if (mod.findStrategyPage("/rights-vault")?.title !== "Rights Vault") {
    throw new Error("Web strategy state missing Rights Vault.");
  }
  for (const route of mod.requiredLaunchRoutes) {
    if (mod.normalizeRoute(route) !== route) {
      throw new Error(`Web launch route missing from normalizer: ${route}`);
    }
    const definition = mod.getRouteDefinition(route);
    if (!definition || definition.launchStatus !== "required") {
      throw new Error(`Web launch route missing required metadata: ${route}`);
    }
  }
  assertMajorRoutesResolvable(mod);
  assertWebShellAssetsRootRelative();
  assertWebBrandAssets();
  if (mod.getRouteDefinition("/account")?.auth !== "auth-ready") {
    throw new Error("Web account route must be auth-ready.");
  }
  if (mod.getRouteDefinition("/admin")?.auth !== "admin-ready") {
    throw new Error("Web admin route must be admin-ready.");
  }
  if (mod.getRouteDefinition("/export")?.recoveryRoute !== "/mutation") {
    throw new Error("Web export route must recover through Mutation Lab.");
  }
  assertArrayEqual(
    mod.finalExportTiers,
    ["prompt_bundle", "production_bundle", "daw_bundle", "release_bundle", "elite_mutation_bundle"],
    "web final export tiers"
  );
  if (!mod.checkAudioDeviceSupport().status || !mod.checkVideoDeviceSupport().status) {
    throw new Error("Web media readiness helpers returned an invalid status.");
  }
  await mod.listAudioInputDevices();
  await mod.listVideoInputDevices();
  await assertSoundEngineCanInitialize(mod);
  assertNoOldExportTiers();
  assertNoVisibleEmojiStrings();
}

function assertMajorRoutesResolvable(mod) {
  const majorRoutes = [
    "/",
    "/app",
    "/app/business-builder",
    "/app/creator-studio",
    "/app/growth-studio",
    "/app/admin/command-center",
    "/app/security-center",
    "/app/billing",
    "/app/onboarding",
    "/dashboard",
    "/business-builder",
    "/business-builder/setup",
    "/business-builder/payment-options",
    "/business-builder/bookings",
    "/business-builder/reviews",
    "/business-builder/customers",
    "/business-builder/customers/follow-up",
    "/creator-studio",
    "/creator-studio/setup",
    "/growth-studio",
    "/growth-studio/setup",
    "/beta",
    "/help",
    "/help/business-builder",
    "/help/creator-studio",
    "/help/growth-studio",
    "/feedback",
    "/support",
    "/login",
    "/signup",
    "/onboarding",
    "/pricing",
    "/security",
    "/admin/launch-checklist",
    "/admin/go-live-checklist",
    "/security-center",
    "/security-center/launch-security-gate",
    "/security-center/automation-review",
    "/admin/reliability-center",
    "/admin/diagnostics",
    "/admin/open-source-intake",
    "/admin/github-update-watcher",
    "/admin/ai-cost-control",
    "/admin/prompt-library",
    "/admin/production-readiness",
    "/admin/security-settings",
    "/admin/recommendation-audit",
    "/admin/market-pattern-lab",
    "/admin/notification-settings",
    "/admin/profitability-dashboard",
    "/security-center/open-source-risk",
    "/security-center/recommendation-safety",
    "/app/prompt-library",
    "/app/business-builder/ai-playbooks",
    "/app/creator-studio/ai-playbooks",
    "/app/growth-studio/ai-playbooks",
    "/app/admin/prompt-library",
    "/app/security-center/prompt-safety",
    "/admin/deployment-sync",
    "/admin/deployment-sync/domain",
    "/security-center/deployment-security",
    "/app/admin/github-update-watcher",
    "/app/admin/ai-cost-control",
    "/app/admin/production-readiness",
    "/app/admin/open-source-intake",
    "/app/business-builder/recommendations",
    "/app/creator-studio/recommendations",
    "/app/growth-studio/recommendations",
    "/business-builder/recommendations",
    "/creator-studio/recommendations",
    "/growth-studio/recommendations",
    "/admin/automation-rules",
    "/admin/developer-tools"
  ];
  for (const route of majorRoutes) {
    if (mod.normalizeRoute(route) !== route) {
      throw new Error(`Major route smoke failed normalization for ${route}.`);
    }
    const definition = mod.getRouteDefinition(route);
    if (!definition) {
      throw new Error(`Major route smoke missing manifest definition for ${route}.`);
    }
  }
}

function assertWebShellAssetsRootRelative() {
  const htmlPath = path.join(repoRoot, "packages/web/src/index.html");
  const source = fs.readFileSync(htmlPath, "utf8");
  if (
    !source.includes('href="/styles.css"') ||
    !source.includes('src="/app.mjs"') ||
    !source.includes('src="/deployment-config.mjs"') ||
    !source.includes('rel="canonical"') ||
    !source.includes('name="twitter:card"') ||
    !source.includes('rel="icon"') ||
    !source.includes('rel="manifest"')
  ) {
    throw new Error("Web shell assets must be root-relative so nested routes can boot.");
  }
}

function assertWebBrandAssets() {
  const distDir = path.join(repoRoot, "packages/web/dist");
  const appBundle = fs.readFileSync(path.join(distDir, "app.mjs"), "utf8");
  if (appBundle.includes('from "@signal-os/ui"')) {
    throw new Error("Web app bundle must not expose browser-unresolvable UI workspace imports.");
  }
  if (appBundle.includes('from "@signal-os/autopilot"')) {
    throw new Error(
      "Web app bundle must not expose browser-unresolvable autopilot workspace imports."
    );
  }
  if (appBundle.includes('from "@signal-os/owner-confirmation-lock"')) {
    throw new Error(
      "Web app bundle must not expose browser-unresolvable owner confirmation workspace imports."
    );
  }
  if (appBundle.includes('from "@signal-os/open-source-intake"')) {
    throw new Error(
      "Web app bundle must not expose browser-unresolvable open-source intake workspace imports."
    );
  }
  if (appBundle.includes('from "@signal-os/deployment-sync"')) {
    throw new Error(
      "Web app bundle must not expose browser-unresolvable deployment sync workspace imports."
    );
  }
  for (const workspaceImport of [
    "@signal-os/recommendation-transparency",
    "@signal-os/github-update-watcher",
    "@signal-os/api-provider-registry",
    "@signal-os/agent-orchestration-guard",
    "@signal-os/ai-cost-control",
    "@signal-os/market-pattern-lab",
    "@signal-os/brand-experience-system",
    "@signal-os/notification-sound-system",
    "@signal-os/profitability-dashboard",
    "@signal-os/prompt-playbook-center"
  ]) {
    if (appBundle.includes(`from "${workspaceImport}"`)) {
      throw new Error(`Web app bundle must not expose browser-unresolvable ${workspaceImport}.`);
    }
  }
  for (const assetPath of [
    "favicon.svg",
    "site.webmanifest",
    "deployment-config.mjs",
    "_headers",
    "robots.txt",
    "sitemap.xml",
    "api/health",
    "api/stripe/checkout",
    "api/stripe/webhook",
    "api/stripe/customer-portal",
    "vendor/signal-os-ui/index.mjs",
    "vendor/signal-os-autopilot/index.mjs",
    "vendor/signal-os-owner-confirmation-lock/index.mjs",
    "vendor/signal-os-open-source-intake/index.mjs",
    "vendor/signal-os-deployment-sync/index.mjs",
    "vendor/signal-os-recommendation-transparency/index.mjs",
    "vendor/signal-os-github-update-watcher/index.mjs",
    "vendor/signal-os-api-provider-registry/index.mjs",
    "vendor/signal-os-agent-orchestration-guard/index.mjs",
    "vendor/signal-os-ai-cost-control/index.mjs",
    "vendor/signal-os-market-pattern-lab/index.mjs",
    "vendor/signal-os-brand-experience-system/index.mjs",
    "vendor/signal-os-notification-sound-system/index.mjs",
    "vendor/signal-os-profitability-dashboard/index.mjs",
    "vendor/signal-os-prompt-playbook-center/index.mjs",
    "brand/sonara-industries-logo.svg",
    "brand/sonara-one-app-icon.svg",
    "brand/sonara-one-og.svg",
    "brand/business-builder-logo.svg",
    "brand/creator-studio-logo.svg",
    "brand/growth-studio-logo.svg"
  ]) {
    if (!fs.existsSync(path.join(distDir, assetPath))) {
      throw new Error(`Web brand asset missing from dist: ${assetPath}`);
    }
  }
  const deploymentConfig = fs.readFileSync(path.join(distDir, "deployment-config.mjs"), "utf8");
  if (deploymentConfig.includes("localhost") || deploymentConfig.includes("NEXT_PUBLIC")) {
    throw new Error("Web deployment config must contain concrete non-localhost public values.");
  }
  const health = JSON.parse(fs.readFileSync(path.join(distDir, "api", "health"), "utf8"));
  if (!health.ok || health.service !== "SONARA One web") {
    throw new Error("Web health endpoint artifact did not return an ok SONARA response.");
  }
  if (!health.checks?.securityHeaders) {
    throw new Error("Web health endpoint artifact must report security header generation.");
  }
  if (!health.checks?.diagnostics) {
    throw new Error("Web health endpoint artifact must report diagnostics readiness.");
  }
  const stripeWebhook = JSON.parse(
    fs.readFileSync(path.join(distDir, "api", "stripe", "webhook"), "utf8")
  );
  if (
    stripeWebhook.status !== "setup_mode" ||
    !stripeWebhook.signatureVerificationRequired ||
    stripeWebhook.secretsExposed
  ) {
    throw new Error("Web Stripe webhook artifact must safely block with signature guidance.");
  }
  const headers = fs.readFileSync(path.join(distDir, "_headers"), "utf8");
  for (const header of [
    "Content-Security-Policy",
    "frame-ancestors 'none'",
    "X-Frame-Options: DENY",
    "X-Content-Type-Options: nosniff",
    "Referrer-Policy: strict-origin-when-cross-origin",
    "Permissions-Policy"
  ]) {
    if (!headers.includes(header)) {
      throw new Error(`Web security headers artifact missing ${header}.`);
    }
  }
  const robots = fs.readFileSync(path.join(distDir, "robots.txt"), "utf8");
  if (!robots.includes("Sitemap:") || robots.includes("localhost")) {
    throw new Error("Web robots.txt must include a non-localhost sitemap.");
  }
  if (!robots.includes("https://sonaraindustries.com/sitemap.xml")) {
    throw new Error("Web robots.txt must use sonaraindustries.com as the sitemap domain.");
  }
  const sitemap = fs.readFileSync(path.join(distDir, "sitemap.xml"), "utf8");
  if (!sitemap.includes("<urlset") || sitemap.includes("localhost")) {
    throw new Error("Web sitemap.xml must include non-localhost URL entries.");
  }
  if (!sitemap.includes("https://sonaraindustries.com/business-builder")) {
    throw new Error("Web sitemap.xml must use sonaraindustries.com canonical routes.");
  }
}

function smokeDeploymentSync(mod) {
  if (mod.canonicalDomain !== "sonaraindustries.com") {
    throw new Error("Deployment Sync must use sonaraindustries.com as the canonical domain.");
  }
  if (!mod.canonicalPublicRoutes.includes("/refund-policy")) {
    throw new Error("Deployment Sync public route map missing /refund-policy.");
  }
  if (!mod.canonicalAppRoutes.includes("/app/admin/command-center")) {
    throw new Error("Deployment Sync app route map missing admin command center.");
  }
  const env = mod.validateDeploymentEnv({
    env: {
      NEXT_PUBLIC_SERVICE_ROLE_KEY: "unsafe-public-secret",
      STRIPE_SECRET_KEY: "sk_test_redacted"
    }
  });
  if (JSON.stringify(env).includes("unsafe-public-secret")) {
    throw new Error("Deployment Sync env validator leaked a secret value.");
  }
  if (!env.findings.some((finding) => finding.riskLevel === "critical")) {
    throw new Error("Deployment Sync must flag dangerous public secret env names.");
  }
  const rancher = mod.checkRancherSync({ env: {} });
  if (rancher.status !== "skipped_for_mvp") {
    throw new Error("Rancher must be skipped for MVP when not configured.");
  }
  const report = mod.createDeploymentSyncReport({
    env: {
      NEXT_PUBLIC_SITE_URL: "https://sonaraindustries.com",
      NEXT_PUBLIC_APP_URL: "https://sonaraindustries.com/app"
    }
  });
  if (report.statuses.domain.status === "verified") {
    throw new Error(
      "Deployment Sync must not claim verified domain connectivity from local config."
    );
  }
  if (!report.statuses.stripe.metadata || report.statuses.stripe.metadata.rawCardDataStored) {
    throw new Error("Deployment Sync Stripe metadata must make raw card storage false.");
  }
}

function assertArrayEqual(actual, expected, label) {
  if (JSON.stringify(Array.from(actual)) !== JSON.stringify(expected)) {
    throw new Error(`${label} mismatch.`);
  }
}

async function assertSoundEngineCanInitialize(mod) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      AudioContext: createFakeAudioContextClass(),
      matchMedia: () => ({ matches: false })
    }
  });
  try {
    const engine = mod.createSignalSoundEngine(null);
    const enabled = await engine.enable();
    if (!enabled || !engine.play("primary_action")) {
      throw new Error("Web Signal sound engine did not initialize after user-action mock.");
    }
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
}

function createFakeAudioContextClass() {
  class FakeAudioParam {
    setValueAtTime() {}
    linearRampToValueAtTime() {}
    exponentialRampToValueAtTime() {}
  }

  class FakeAudioNode {
    connect() {
      return this;
    }
  }

  class FakeOscillator extends FakeAudioNode {
    frequency = new FakeAudioParam();
    type = "sine";
    start() {}
    stop() {}
  }

  class FakeGain extends FakeAudioNode {
    gain = new FakeAudioParam();
  }

  return class FakeAudioContext {
    currentTime = 0;
    destination = new FakeAudioNode();
    state = "suspended";
    createOscillator() {
      return new FakeOscillator();
    }
    createGain() {
      return new FakeGain();
    }
    async resume() {
      this.state = "running";
    }
  };
}

function assertNoOldExportTiers() {
  const oldTierPattern = new RegExp(
    `\\b(${["starter", "stems", "full", "elite", "basic", ["p", "ro"].join("")]
      .map((prefix) => `${prefix}_bundle`)
      .join("|")})\\b`
  );
  for (const filePath of listSourceFiles([
    path.join(repoRoot, "packages"),
    path.join(repoRoot, "scripts")
  ])) {
    const source = fs.readFileSync(filePath, "utf8");
    if (oldTierPattern.test(source)) {
      throw new Error(`Old export tier reference found in ${path.relative(repoRoot, filePath)}.`);
    }
  }
}

function assertNoVisibleEmojiStrings() {
  const emojiPattern = /\p{Extended_Pictographic}/u;
  const visibleRoots = [
    path.join(repoRoot, "packages/web/src/app"),
    path.join(repoRoot, "packages/web/src/pages"),
    path.join(repoRoot, "packages/web/src/ui"),
    path.join(repoRoot, "packages/web/src/styles.css")
  ];
  for (const filePath of listSourceFiles(visibleRoots)) {
    const source = fs.readFileSync(filePath, "utf8");
    if (emojiPattern.test(source)) {
      throw new Error(`Visible emoji string found in ${path.relative(repoRoot, filePath)}.`);
    }
  }
}

function listSourceFiles(roots) {
  const results = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      continue;
    }
    const stat = fs.statSync(root);
    if (stat.isFile()) {
      if (/\.(ts|tsx|mjs|css|html)$/.test(root)) {
        results.push(root);
      }
      continue;
    }
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        results.push(...listSourceFiles([fullPath]));
      } else if (/\.(ts|tsx|mjs|css|html)$/.test(fullPath)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}
