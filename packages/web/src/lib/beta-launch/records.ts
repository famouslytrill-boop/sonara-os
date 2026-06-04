export type BetaLaunchProductId = "business-builder" | "creator-studio" | "growth-studio";

export type BetaFeedbackType = "general" | "confusing" | "missing" | "bug";
export type BetaIssueSeverity = "low" | "medium" | "high";
export type BetaRecordStatus = "local_stub_saved";

export type BetaDemoAccount = Readonly<{
  id: string;
  label: string;
  productId: BetaLaunchProductId;
  fakeEmail: string;
  purpose: string;
  clearlyFake: true;
  dataNotice: string;
}>;

export type ProductWalkthroughStep = Readonly<{
  title: string;
  description: string;
  route: string;
}>;

export type ProductWalkthrough = Readonly<{
  productId: BetaLaunchProductId;
  title: string;
  route: string;
  steps: readonly ProductWalkthroughStep[];
}>;

export type HelpDocSection = Readonly<{
  title: string;
  body: string;
}>;

export type HelpDoc = Readonly<{
  productId: BetaLaunchProductId;
  title: string;
  route: string;
  summary: string;
  sections: readonly HelpDocSection[];
}>;

export type OnboardingEmailTemplate = Readonly<{
  id: string;
  title: string;
  productId: BetaLaunchProductId | "all";
  subject: string;
  body: string;
  sendEnabled: false;
  status: "template_only";
}>;

export type AnalyticsEventPlaceholder = Readonly<{
  id: string;
  eventName: string;
  route: string;
  purpose: string;
  enabled: false;
  collectsPii: false;
  status: "placeholder_only";
}>;

export type BetaInviteRequest = Readonly<{
  id: string;
  name: string;
  email: string;
  productId: BetaLaunchProductId;
  launchGoal: string;
  status: BetaRecordStatus;
  createdAt: string;
}>;

export type FeedbackRecord = Readonly<{
  id: string;
  productId: BetaLaunchProductId;
  feedbackType: BetaFeedbackType;
  message: string;
  contact: string;
  status: BetaRecordStatus;
  createdAt: string;
}>;

export type IssueReportRecord = Readonly<{
  id: string;
  route: string;
  severity: BetaIssueSeverity;
  summary: string;
  contact: string;
  status: BetaRecordStatus;
  createdAt: string;
}>;

export type BetaLaunchState = Readonly<{
  invites: readonly BetaInviteRequest[];
  feedback: readonly FeedbackRecord[];
  issues: readonly IssueReportRecord[];
}>;

export type BetaLaunchStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type BetaInviteInput = Readonly<{
  name: string;
  email: string;
  productId: BetaLaunchProductId;
  launchGoal: string;
}>;

export type FeedbackInput = Readonly<{
  productId: BetaLaunchProductId;
  feedbackType: BetaFeedbackType;
  message: string;
  contact: string;
}>;

export type IssueReportInput = Readonly<{
  route: string;
  severity: BetaIssueSeverity;
  summary: string;
  contact: string;
}>;

const storageKey = "sonara-beta-launch-package";

export const betaLaunchProductLabels: Readonly<Record<BetaLaunchProductId, string>> = Object.freeze(
  {
    "business-builder": "Business Builder",
    "creator-studio": "Creator Studio",
    "growth-studio": "Growth Studio"
  }
);

export const betaFeedbackTypeLabels: Readonly<Record<BetaFeedbackType, string>> = Object.freeze({
  general: "General feedback",
  confusing: "Something is confusing",
  missing: "Something is missing",
  bug: "Possible issue"
});

export const betaIssueSeverityLabels: Readonly<Record<BetaIssueSeverity, string>> = Object.freeze({
  low: "Low",
  medium: "Medium",
  high: "High"
});

export const betaDemoAccounts: readonly BetaDemoAccount[] = Object.freeze([
  Object.freeze({
    id: "demo-business-owner",
    label: "Demo Business Owner",
    productId: "business-builder",
    fakeEmail: "demo-business@example.test",
    purpose: "Shows proof, payment, booking, intake, review, and customer setup placeholders.",
    clearlyFake: true,
    dataNotice: "Clearly fake seed data for walkthroughs only. Do not use as a real customer."
  }),
  Object.freeze({
    id: "demo-creator",
    label: "Demo Creator",
    productId: "creator-studio",
    fakeEmail: "demo-creator@example.test",
    purpose: "Shows creator proof, asset vault, service offer, and release checklist placeholders.",
    clearlyFake: true,
    dataNotice: "Clearly fake seed data for walkthroughs only. Do not use as real rights data."
  }),
  Object.freeze({
    id: "demo-growth-lead",
    label: "Demo Growth Lead",
    productId: "growth-studio",
    fakeEmail: "demo-growth@example.test",
    purpose: "Shows campaign, review request, referral, and win-back planning placeholders.",
    clearlyFake: true,
    dataNotice: "Clearly fake seed data for walkthroughs only. Do not use as real performance data."
  })
]);

export const productWalkthroughs: readonly ProductWalkthrough[] = Object.freeze([
  Object.freeze({
    productId: "business-builder",
    title: "Business Builder Walkthrough",
    route: "/help/business-builder",
    steps: Object.freeze([
      createWalkthroughStep(
        "Start setup",
        "Answer launch setup questions.",
        "/business-builder/setup"
      ),
      createWalkthroughStep(
        "Build proof",
        "Draft a public proof passport without claiming fake verification.",
        "/business-builder/proof-passport"
      ),
      createWalkthroughStep(
        "Prepare money paths",
        "Use provider-hosted payment and booking links only.",
        "/business-builder/payment-options"
      ),
      createWalkthroughStep(
        "Review launch gaps",
        "Use the dashboard and checklist before publishing.",
        "/dashboard"
      )
    ])
  }),
  Object.freeze({
    productId: "creator-studio",
    title: "Creator Studio Walkthrough",
    route: "/help/creator-studio",
    steps: Object.freeze([
      createWalkthroughStep(
        "Start setup",
        "Define creator category and goal.",
        "/creator-studio/setup"
      ),
      createWalkthroughStep(
        "Create proof",
        "Draft a creator proof card with rights-aware notes.",
        "/creator-studio/proof-card"
      ),
      createWalkthroughStep(
        "Organize assets",
        "Use asset vault placeholders for source and rights notes.",
        "/creator-studio/asset-vault"
      ),
      createWalkthroughStep(
        "Prepare release",
        "Check release readiness without fake licensing claims.",
        "/creator-studio/release-checklist"
      )
    ])
  }),
  Object.freeze({
    productId: "growth-studio",
    title: "Growth Studio Walkthrough",
    route: "/help/growth-studio",
    steps: Object.freeze([
      createWalkthroughStep(
        "Start setup",
        "Define campaign and review goals.",
        "/growth-studio/setup"
      ),
      createWalkthroughStep(
        "Draft campaign",
        "Create practical campaign notes without guaranteed results.",
        "/growth-studio/campaigns"
      ),
      createWalkthroughStep(
        "Plan reviews",
        "Prepare review requests without manipulation or fake ratings.",
        "/growth-studio/review-requests"
      ),
      createWalkthroughStep(
        "Review referrals",
        "Draft referral ideas before customer contact.",
        "/growth-studio/referrals"
      )
    ])
  })
]);

export const helpDocs: readonly HelpDoc[] = Object.freeze([
  Object.freeze({
    productId: "business-builder",
    title: "Business Builder Starter Guide",
    route: "/help/business-builder",
    summary: "Use this guide to set up proof, payments, booking, intake, reviews, and customers.",
    sections: Object.freeze([
      createHelpSection(
        "Start small",
        "Complete setup first, then draft one proof profile and one payment or booking path."
      ),
      createHelpSection(
        "Keep payments safe",
        "Use provider-hosted links. Do not enter card numbers, CVV, or bank credentials."
      ),
      createHelpSection(
        "Review before launch",
        "Owner review is required before public claims, reviews, or customer contact."
      )
    ])
  }),
  Object.freeze({
    productId: "creator-studio",
    title: "Creator Studio Starter Guide",
    route: "/help/creator-studio",
    summary: "Use this guide to prepare proof, assets, releases, services, and client links.",
    sections: Object.freeze([
      createHelpSection(
        "Track rights",
        "Use source notes and licensing notes before release or client delivery."
      ),
      createHelpSection(
        "Draft offers",
        "Service offers are drafts until reviewed and approved by the owner."
      ),
      createHelpSection(
        "Keep beta tools gated",
        "Voice, visual, and video tools remain draft-only until approved."
      )
    ])
  }),
  Object.freeze({
    productId: "growth-studio",
    title: "Growth Studio Starter Guide",
    route: "/help/growth-studio",
    summary: "Use this guide to prepare campaigns, reviews, referrals, and customer follow-up.",
    sections: Object.freeze([
      createHelpSection(
        "No fake proof",
        "Do not create fake reviews, fake scarcity, or guaranteed result claims."
      ),
      createHelpSection(
        "Use owner review",
        "Review campaign claims and customer contact before sending."
      ),
      createHelpSection(
        "Measure later",
        "Analytics placeholders are not live metrics in the beta shell."
      )
    ])
  })
]);

export const onboardingEmailTemplates: readonly OnboardingEmailTemplate[] = Object.freeze([
  Object.freeze({
    id: "beta-welcome",
    title: "Beta welcome",
    productId: "all",
    subject: "Welcome to the SONARA Industries beta",
    body: "Thanks for joining the beta. Start with setup, review safety notes, and send feedback before launch.",
    sendEnabled: false,
    status: "template_only"
  }),
  Object.freeze({
    id: "business-builder-setup",
    title: "Business Builder setup reminder",
    productId: "business-builder",
    subject: "Finish your Business Builder setup",
    body: "Complete proof, payment or booking, intake, reviews, and customer records before publishing.",
    sendEnabled: false,
    status: "template_only"
  }),
  Object.freeze({
    id: "feedback-request",
    title: "Feedback request",
    productId: "all",
    subject: "What should we fix before launch?",
    body: "Reply with confusing steps, missing basics, or beta issues. Do not send private customer data.",
    sendEnabled: false,
    status: "template_only"
  })
]);

export const analyticsEventPlaceholders: readonly AnalyticsEventPlaceholder[] = Object.freeze([
  createAnalyticsPlaceholder(
    "beta_invite_viewed",
    "/beta",
    "Measure beta page visits after consent review."
  ),
  createAnalyticsPlaceholder(
    "walkthrough_opened",
    "/help",
    "Measure help walkthrough use after analytics approval."
  ),
  createAnalyticsPlaceholder(
    "feedback_saved",
    "/feedback",
    "Measure local feedback submissions after backend wiring."
  ),
  createAnalyticsPlaceholder(
    "issue_report_saved",
    "/support",
    "Measure support issue submissions after backend wiring."
  )
]);

export const initialBetaLaunchState: BetaLaunchState = Object.freeze({
  invites: Object.freeze([]),
  feedback: Object.freeze([]),
  issues: Object.freeze([])
});

export function createBetaLaunchStore(storage: BetaLaunchStorageLike | null = getBrowserStorage()) {
  let state = readStoredState(storage);

  function getState() {
    return state;
  }

  function saveInvite(input: BetaInviteInput) {
    const record = createBetaInviteRequest(input);
    state = Object.freeze({ ...state, invites: Object.freeze([...state.invites, record]) });
    writeStoredState(storage, state);
    return record;
  }

  function saveFeedback(input: FeedbackInput) {
    const record = createFeedbackRecord(input);
    state = Object.freeze({ ...state, feedback: Object.freeze([...state.feedback, record]) });
    writeStoredState(storage, state);
    return record;
  }

  function saveIssue(input: IssueReportInput) {
    const record = createIssueReportRecord(input);
    state = Object.freeze({ ...state, issues: Object.freeze([...state.issues, record]) });
    writeStoredState(storage, state);
    return record;
  }

  function clear() {
    state = initialBetaLaunchState;
    storage?.removeItem(storageKey);
  }

  return Object.freeze({ getState, saveInvite, saveFeedback, saveIssue, clear });
}

export function createBetaInviteRequest(
  input: BetaInviteInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("beta_invite")
): BetaInviteRequest {
  return Object.freeze({
    id,
    name: sanitizeText(input.name, 80),
    email: sanitizeText(input.email, 120),
    productId: input.productId,
    launchGoal: sanitizeText(input.launchGoal, 240),
    status: "local_stub_saved",
    createdAt
  });
}

export function createFeedbackRecord(
  input: FeedbackInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("feedback")
): FeedbackRecord {
  return Object.freeze({
    id,
    productId: input.productId,
    feedbackType: input.feedbackType,
    message: sanitizeText(input.message, 700),
    contact: sanitizeText(input.contact, 120),
    status: "local_stub_saved",
    createdAt
  });
}

export function createIssueReportRecord(
  input: IssueReportInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("issue")
): IssueReportRecord {
  return Object.freeze({
    id,
    route: sanitizeText(input.route, 120),
    severity: input.severity,
    summary: sanitizeText(input.summary, 700),
    contact: sanitizeText(input.contact, 120),
    status: "local_stub_saved",
    createdAt
  });
}

export function getHelpDoc(productId: BetaLaunchProductId): HelpDoc {
  return helpDocs.find((doc) => doc.productId === productId) ?? helpDocs[0];
}

export function getProductWalkthrough(productId: BetaLaunchProductId): ProductWalkthrough {
  return (
    productWalkthroughs.find((walkthrough) => walkthrough.productId === productId) ??
    productWalkthroughs[0]
  );
}

export function areDemoAccountsClearlyFake(): boolean {
  return betaDemoAccounts.every(
    (account) =>
      account.clearlyFake === true &&
      account.fakeEmail.endsWith(".test") &&
      account.dataNotice.toLowerCase().includes("fake")
  );
}

function createWalkthroughStep(
  title: string,
  description: string,
  route: string
): ProductWalkthroughStep {
  return Object.freeze({ title, description, route });
}

function createHelpSection(title: string, body: string): HelpDocSection {
  return Object.freeze({ title, body });
}

function createAnalyticsPlaceholder(
  eventName: string,
  route: string,
  purpose: string
): AnalyticsEventPlaceholder {
  return Object.freeze({
    id: `analytics-${eventName}`,
    eventName,
    route,
    purpose,
    enabled: false,
    collectsPii: false,
    status: "placeholder_only"
  });
}

function sanitizeText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function readStoredState(storage: BetaLaunchStorageLike | null): BetaLaunchState {
  const raw = storage?.getItem(storageKey);
  if (!raw) {
    return initialBetaLaunchState;
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    storage?.removeItem(storageKey);
    return initialBetaLaunchState;
  }
}

function normalizeState(value: unknown): BetaLaunchState {
  if (!value || typeof value !== "object") {
    return initialBetaLaunchState;
  }
  const candidate = value as Partial<BetaLaunchState>;
  return Object.freeze({
    invites: Object.freeze(Array.isArray(candidate.invites) ? candidate.invites : []),
    feedback: Object.freeze(Array.isArray(candidate.feedback) ? candidate.feedback : []),
    issues: Object.freeze(Array.isArray(candidate.issues) ? candidate.issues : [])
  });
}

function writeStoredState(storage: BetaLaunchStorageLike | null, state: BetaLaunchState) {
  storage?.setItem(storageKey, JSON.stringify(state));
}

function getBrowserStorage(): BetaLaunchStorageLike | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  if (
    typeof localStorage.getItem !== "function" ||
    typeof localStorage.setItem !== "function" ||
    typeof localStorage.removeItem !== "function"
  ) {
    return null;
  }
  return localStorage;
}

function createRecordId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}
