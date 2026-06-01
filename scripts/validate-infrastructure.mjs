import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "packages/web/src/lib/shared/feature-flags.ts",
  "packages/web/src/lib/shared/engine-registry.ts",
  "packages/web/src/lib/shared/module-registry.ts",
  "packages/web/src/lib/shared/product-registry.ts",
  "packages/web/src/lib/shared/safety-rules.ts",
  "packages/web/src/lib/shared/validate-infrastructure-registry.ts",
  "packages/web/src/lib/implementation-sequencer/implementation-sequencer.ts",
  "packages/web/src/lib/implementation-sequencer/build-order-planner.ts",
  "packages/web/src/lib/final-launch-hardening/final-launch-hardening-engine.ts",
  "packages/web/src/lib/project-execution/project-execution-spine.ts",
  "docs/FINAL_LAUNCH_HARDENING_SCOPE_FREEZE.md",
  "docs/IMPLEMENTATION_SEQUENCER_REPO_BOOTSTRAP_HANDOFF.md",
  "docs/MANUAL_PROJECT_BUILD_LOG.md"
];

const reportFiles = [
  "packages/web/src/reports/security-report.ts",
  "packages/web/src/reports/payment-options-report.ts",
  "packages/web/src/reports/customer-command-center-report.ts",
  "packages/web/src/reports/booking-report.ts",
  "packages/web/src/reports/emergency-continuity-report.ts",
  "packages/web/src/reports/risk-resilience-report.ts",
  "packages/web/src/reports/formulas-report.ts",
  "packages/web/src/reports/voice-ai-report.ts",
  "packages/web/src/reports/visual-generation-report.ts",
  "packages/web/src/reports/ai-safety-report.ts",
  "packages/web/src/reports/repo-intelligence-report.ts",
  "packages/web/src/reports/agent-evolution-report.ts",
  "packages/web/src/reports/launch-readiness-report.ts",
  "packages/web/src/reports/reliability-report.ts",
  "packages/web/src/reports/operating-twin-report.ts",
  "packages/web/src/reports/prompt-intelligence-report.ts",
  "packages/web/src/reports/model-evaluation-report.ts",
  "packages/web/src/reports/debugging-report.ts",
  "packages/web/src/reports/advanced-debugger-report.ts",
  "packages/web/src/reports/smart-debugger-report.ts",
  "packages/web/src/reports/revenue-experiments-report.ts",
  "packages/web/src/reports/proof-results-report.ts",
  "packages/web/src/reports/safe-release-report.ts",
  "packages/web/src/reports/privacy-retention-report.ts",
  "packages/web/src/reports/project-execution-report.ts",
  "packages/web/src/reports/final-launch-hardening-report.ts",
  "packages/web/src/reports/implementation-sequencer-report.ts"
];
const docFiles = [
  "docs/MANUAL_PROJECT_BUILD_LOG.md",
  "docs/MASTER_COMPANY_ARCHITECTURE.md",
  "docs/Q1_10_OUT_OF_10_LAUNCH_PLAN.md",
  "docs/TRUST_SHIELD_SECURITY.md",
  "docs/PUBLIC_LANGUAGE_AND_TYPOGRAPHY_SYSTEM.md",
  "docs/PREMIUM_INTERFACE_SYSTEM.md",
  "docs/PAYMENT_OPTIONS.md",
  "docs/EXTERNAL_CONNECTIONS.md",
  "docs/CUSTOMER_COMMAND_CENTER.md",
  "docs/BOOKING_VENUES_EVENTS.md",
  "docs/EMERGENCY_CONTINUITY_CENTER.md",
  "docs/RISK_RESILIENCE_ENGINE.md",
  "docs/FORMULA_REGISTRY.md",
  "docs/CREATIVE_DESIGN_FORMULA_TOOLS.md",
  "docs/OPERATIONS_RESEARCH_ENGINE.md",
  "docs/PROPERTY_FINDER_LOCATION_PLANNER.md",
  "docs/OPEN_MODEL_CODING_ROUTER.md",
  "docs/AI_JAILBREAK_DEFENSE_AGENT_HARDENING.md",
  "docs/VOICE_AI_AUDIO_TRANSCRIPTION_SAFETY_LAYER.md",
  "docs/VISUAL_GENERATION_IMAGE_TEXT_RENDERING_SAFETY_LAYER.md",
  "docs/CODEBASE_KNOWLEDGE_GRAPH_REPO_INTELLIGENCE.md",
  "docs/AGENT_EVOLUTION_REVIEW_PROMPT_GOVERNANCE.md",
  "docs/LAUNCH_READINESS_COST_CONSENT_TEMPLATES.md",
  "docs/RELIABILITY_INTEGRATIONS_CUSTOMER_SUCCESS.md",
  "docs/SONARA_OPERATING_TWIN_BUSINESS_MEMORY_GRAPH.md",
  "docs/GUIDED_QUESTION_INTELLIGENCE_PROMPT_LIBRARY.md",
  "docs/MULTI_MODEL_EVALUATION_PROMPT_SAFETY_BENCHMARK.md",
  "docs/DEBUGGING_INTELLIGENCE_FORMULA_DIAGNOSTICS.md",
  "docs/ADVANCED_DEBUGGER_RUNTIME_INVESTIGATION_TEST_LAB.md",
  "docs/PREDICTIVE_CAUSAL_DEBUGGER_RELIABILITY_BRAIN.md",
  "docs/REVENUE_EXPERIMENT_LAB_OFFER_TESTING.md",
  "docs/PROOF_RESULTS_CASE_STUDY_LEDGER.md",
  "docs/SAFE_RELEASE_LAB_SANDBOX_ROLLBACK.md",
  "docs/PRIVACY_TIMELINE_DATA_RETENTION_OWNER_CONTROL.md",
  "docs/PROJECT_EXECUTION_SPINE_MVP_LOCK.md",
  "docs/FINAL_LAUNCH_HARDENING_SCOPE_FREEZE.md",
  "docs/IMPLEMENTATION_SEQUENCER_REPO_BOOTSTRAP_HANDOFF.md"
];
const requiredDirectories = [
  "packages/web/src/lib/security",
  "packages/web/src/lib/payment-options",
  "packages/web/src/lib/external-connections",
  "packages/web/src/lib/customer-command-center",
  "packages/web/src/lib/appointments",
  "packages/web/src/lib/venues-events",
  "packages/web/src/lib/queue",
  "packages/web/src/lib/emergency-continuity",
  "packages/web/src/lib/risk-resilience",
  "packages/web/src/lib/formulas",
  "packages/web/src/lib/design-interaction",
  "packages/web/src/lib/visual-generation",
  "packages/web/src/lib/voice-ai",
  "packages/web/src/lib/property-finder",
  "packages/web/src/lib/operations-planner",
  "packages/web/src/lib/query",
  "packages/web/src/lib/ai-models",
  "packages/web/src/lib/ai-safety",
  "packages/web/src/lib/repo-intelligence",
  "packages/web/src/lib/agent-evolution",
  "packages/web/src/lib/launch-readiness",
  "packages/web/src/lib/cost-control",
  "packages/web/src/lib/consent",
  "packages/web/src/lib/templates",
  "packages/web/src/lib/customer-import",
  "packages/web/src/lib/support",
  "packages/web/src/lib/quality-review",
  "packages/web/src/lib/referrals",
  "packages/web/src/lib/data-resilience",
  "packages/web/src/lib/api-webhooks",
  "packages/web/src/lib/integration-reliability",
  "packages/web/src/lib/provider-status",
  "packages/web/src/lib/billing-entitlements",
  "packages/web/src/lib/status-center",
  "packages/web/src/lib/customer-success",
  "packages/web/src/lib/support-ops",
  "packages/web/src/lib/dispute-records",
  "packages/web/src/lib/accessibility-localization",
  "packages/web/src/lib/launch-operations",
  "packages/web/src/lib/operating-twin",
  "packages/web/src/lib/prompt-intelligence",
  "packages/web/src/lib/model-evaluation",
  "packages/web/src/lib/debugging",
  "packages/web/src/lib/advanced-debugger",
  "packages/web/src/lib/smart-debugger",
  "packages/web/src/lib/revenue-experiments",
  "packages/web/src/lib/proof-results",
  "packages/web/src/lib/safe-release",
  "packages/web/src/lib/privacy-retention",
  "packages/web/src/lib/project-execution",
  "packages/web/src/lib/final-launch-hardening",
  "packages/web/src/lib/implementation-sequencer"
];
const unsafeFlags = [
  "JAILBREAK_TOOLS_ENABLED",
  "JAILBREAK_PROMPTS_ENABLED",
  "SAFETY_BYPASS_OBFUSCATION_ENABLED",
  "PROVIDER_POLICY_BYPASS_ENABLED",
  "SYSTEM_PROMPT_EXTRACTION_ENABLED",
  "SYSTEM_PROMPT_EXTRACTION_TESTING_PUBLIC",
  "REFUSAL_PENALTY_PRIMARY_SCORING",
  "AUTO_SELECT_UNSAFE_OUTPUTS",
  "CUSTOMER_FACING_MODEL_RACING",
  "VOICE_CLONING_WITHOUT_CONSENT_ENABLED",
  "VOICE_IMPERSONATION_ENABLED",
  "DEEPFAKE_ADS_ENABLED",
  "HIDDEN_MICROPHONE_ENABLED",
  "AUTO_PUBLISH_GENERATED_VOICE",
  "UNDISCLOSED_AI_VOICE_CUSTOMER_CONTENT",
  "AUTO_PUBLISH_GENERATED_IMAGES",
  "PRIVATE_PERSON_LIKENESS_WITHOUT_CONSENT",
  "FAKE_ENDORSEMENTS_ENABLED",
  "DECEPTIVE_AD_GENERATION_ENABLED",
  "COPYRIGHTED_CHARACTER_STYLE_IMITATION_ENABLED",
  "GOVERNMENT_LEGAL_MEDICAL_FINANCIAL_NOTICE_GENERATION",
  "FINAL_TRADEMARK_READY_LOGO_CLAIMS",
  "AUTO_CODE_EDITS_FROM_EVOLUTION",
  "AUTO_COMMITS_FROM_EVOLUTION",
  "AUTO_SHELL_COMMANDS_FROM_EVOLUTION",
  "AUTO_DEPENDENCY_INSTALLS_FROM_EVOLUTION",
  "AUTO_SECURITY_CHANGES_FROM_EVOLUTION",
  "AUTO_PAYMENT_CHANGES_FROM_EVOLUTION",
  "AUTO_PERMISSION_CHANGES_FROM_EVOLUTION",
  "PRODUCTION_DAEMON_EVOLUTION_LOOP",
  "PRIVATE_LOG_UPLOAD_TO_THIRD_PARTY",
  "PUBLIC_REPO_GRAPH_EXPOSURE",
  "UNAUTHENTICATED_GRAPH_DASHBOARD",
  "SECRETS_IN_GRAPH_ARTIFACTS",
  "SERVICE_ROLE_KEYS_IN_GRAPH_ARTIFACTS",
  "AUTO_PRODUCTION_CHANGES_FROM_GRAPH",
  "THIRD_PARTY_PRIVATE_GRAPH_UPLOAD",
  "AUTO_CUSTOMER_CONTACT_FROM_OPERATING_TWIN",
  "AUTO_PAYMENT_CHANGES_FROM_OPERATING_TWIN",
  "AUTO_SECURITY_CHANGES_FROM_OPERATING_TWIN",
  "AUTO_PERMISSION_CHANGES_FROM_OPERATING_TWIN",
  "SENSITIVE_ATTRIBUTE_TARGETING_ENABLED",
  "HIGH_STAKES_AUTOMATED_DECISIONS",
  "AUTO_FIX_PRODUCTION_BUGS",
  "AUTO_COMMIT_DEBUG_FIXES",
  "PUBLIC_STACK_TRACES",
  "SECRETS_IN_DEBUG_LOGS",
  "CUSTOMER_PRIVATE_DATA_IN_DEBUG_LOGS",
  "UNVALIDATED_FORMULA_OUTPUTS",
  "HIGH_RISK_DEBUG_ACTIONS_WITHOUT_REVIEW",
  "AUTO_FIX_PRODUCTION_FROM_ADVANCED_DEBUGGER",
  "AUTO_COMMIT_ADVANCED_DEBUG_FIXES",
  "AUTO_RUN_UNREVIEWED_DEBUG_PATCHES",
  "PUBLIC_DEBUG_CASE_FILES",
  "SECRETS_IN_DEBUG_CASES",
  "CUSTOMER_PRIVATE_DATA_IN_DEBUG_CASES",
  "PAYMENT_CREDENTIALS_IN_DEBUG_CASES",
  "SERVICE_ROLE_KEYS_IN_DEBUG_CASES",
  "PRODUCTION_REPLAY_WITHOUT_APPROVAL",
  "AUTO_FIX_PRODUCTION_FROM_SMART_DEBUGGER",
  "AUTO_COMMIT_SMART_DEBUG_FIXES",
  "AUTO_RUN_UNREVIEWED_FIX_PLANS",
  "AUTO_CONTACT_CUSTOMERS_FROM_DEBUGGER",
  "AUTO_CHANGE_PAYMENT_STATE_FROM_DEBUGGER",
  "AUTO_CHANGE_SECURITY_STATE_FROM_DEBUGGER",
  "AUTO_CHANGE_PERMISSION_STATE_FROM_DEBUGGER",
  "PUBLIC_CAUSAL_TRACE_GRAPHS",
  "PUBLIC_DEBUG_KNOWLEDGE_MEMORY",
  "SECRETS_IN_CAUSAL_TRACES",
  "CUSTOMER_PRIVATE_DATA_IN_SYNTHETIC_REPLAYS",
  "REAL_PAYMENT_TESTS_WITHOUT_APPROVAL",
  "REAL_CUSTOMER_MESSAGE_TESTS_WITHOUT_APPROVAL",
  "PRODUCTION_FIX_WITHOUT_LAUNCH_GATE",
  "AUTO_CHANGE_LIVE_PRICING",
  "DECEPTIVE_PRICING_TESTS",
  "FAKE_SCARCITY_EXPERIMENTS",
  "GUARANTEED_REVENUE_CLAIMS",
  "CUSTOMER_FACING_EXPERIMENT_WITHOUT_REVIEW",
  "FAKE_TESTIMONIALS_ENABLED",
  "INFLATED_RESULTS_CLAIMS",
  "UNVERIFIED_PROOF_CLAIMS",
  "CUSTOMER_NAME_WITHOUT_PERMISSION",
  "GUARANTEED_SUCCESS_PROOF_CLAIMS",
  "AUTO_RELEASE_HIGH_RISK_FEATURES",
  "PRODUCTION_MIGRATION_WITHOUT_BACKUP",
  "REAL_PAYMENT_TEST_WITHOUT_APPROVAL",
  "PUBLIC_BETA_WITHOUT_GATING",
  "SILENT_DATA_DELETION",
  "AUDIT_LOG_DELETION_WITHOUT_POLICY",
  "CUSTOMER_DATA_EXPORT_WITHOUT_PERMISSION",
  "PRIVATE_RECORD_EXPOSURE",
  "RETENTION_RULE_BYPASS",
  "UNCLEAR_CONSENT_RECORDS",
  "AUTO_ADD_PUBLIC_FEATURES",
  "AUTO_REMOVE_LAUNCH_GATES",
  "AUTO_EXPOSE_BETA_MODULES",
  "AUTO_SHIP_RESEARCH_ADAPTERS",
  "IGNORE_MVP_LOCK",
  "BYPASS_RELEASE_SCOPE_GUARD",
  "BYPASS_SCOPE_FREEZE",
  "BYPASS_FINAL_QA_GATE",
  "BYPASS_GO_NO_GO_REVIEW",
  "PUBLIC_LAUNCH_WITH_FAILED_BUILD",
  "PUBLIC_LAUNCH_WITH_UNSAFE_FLAGS",
  "PUBLIC_LAUNCH_WITHOUT_PAYMENT_REVIEW",
  "PUBLIC_LAUNCH_WITHOUT_PRIVACY_REVIEW",
  "PUBLIC_LAUNCH_WITHOUT_SECURITY_REVIEW",
  "PUBLIC_LAUNCH_WITH_INTERNAL_ENGINE_NAMES",
  "AUTO_RUN_DESTRUCTIVE_COMMANDS",
  "AUTO_INSTALL_UNKNOWN_DEPENDENCIES",
  "AUTO_DELETE_FILES_FROM_BOOTSTRAP",
  "AUTO_MODIFY_DATABASE_SCHEMA_WITHOUT_REVIEW",
  "AUTO_RUN_PRODUCTION_MIGRATIONS",
  "AUTO_PUSH_TO_MAIN",
  "AUTO_DEPLOY_WITHOUT_APPROVAL",
  "AUTO_MARK_PLACEHOLDERS_PRODUCTION_READY"
];

const issues = [];

for (const directory of requiredDirectories) {
  if (!fs.existsSync(path.join(root, directory))) issues.push(`Missing directory: ${directory}`);
}

for (const file of [...requiredFiles, ...reportFiles, ...docFiles]) {
  if (!fs.existsSync(path.join(root, file))) issues.push(`Missing file: ${file}`);
}

const featureFlagSource = read("packages/web/src/lib/shared/feature-flags.ts");
for (const flag of unsafeFlags) {
  const pattern = new RegExp(`${flag}: false`);
  if (!pattern.test(featureFlagSource)) issues.push(`Unsafe flag not locked false: ${flag}`);
}

const buildOrderSource = read(
  "packages/web/src/lib/implementation-sequencer/build-order-planner.ts"
);
for (const step of [
  "Shared feature flags and registries",
  "Trust Shield and Launch Security Gate",
  "Public product shell: Business Builder, Creator Studio, Growth Studio",
  "Business Profile / Proof Passport",
  "Payment Options and Get Paid Page",
  "Booking/Appointments",
  "Quotes",
  "Customer Records",
  "Reviews",
  "Files & Records",
  "Template Library",
  "Launch Checklist",
  "Consent Center and Usage Meter",
  "Connected Links",
  "Customer Import",
  "Help Center",
  "Operating Twin basic Next Best Step",
  "Debugging Tools basic report",
  "Safe Release Lab basic checklist",
  "Proof Builder basic milestone tracking",
  "Privacy Timeline basic records view",
  "Project Execution Spine / MVP Lock",
  "Final Launch Hardening",
  "Implementation Sequencer"
]) {
  if (!buildOrderSource.includes(step)) issues.push(`Missing Q1 build step: ${step}`);
}

const publicLanguageSource = read("packages/web/src/lib/shared/public-language-map.ts");
for (const term of ["ImplementationSequencer", "RepoBootstrapEngine", "DeveloperHandoffEngine"]) {
  if (!publicLanguageSource.includes(term)) issues.push(`Missing blocked internal term: ${term}`);
}

const finalHardeningDoc = read("docs/FINAL_LAUNCH_HARDENING_SCOPE_FREEZE.md");
if (!finalHardeningDoc.includes("Final Launch Hardening")) {
  issues.push("Sprint 100 final launch hardening doc is incomplete.");
}

const implementationDoc = read("docs/IMPLEMENTATION_SEQUENCER_REPO_BOOTSTRAP_HANDOFF.md");
if (!implementationDoc.includes("Implementation Sequencer")) {
  issues.push("Sprint 101 implementation sequencer doc is incomplete.");
}

if (issues.length > 0) {
  throw new Error(`Infrastructure validation failed:\n${issues.join("\n")}`);
}

console.log("Infrastructure validation passed.");

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
}
