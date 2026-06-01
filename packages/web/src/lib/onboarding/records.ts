export type OnboardingStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type OnboardingProductId = "business-builder" | "creator-studio" | "growth-studio";
export type SetupNeedStatus = "not_answered" | "needed" | "already_ready" | "not_needed";
export type LaunchReadinessStatus =
  | "not_started"
  | "setting_up"
  | "needs_review"
  | "ready_for_review";
export type LaunchChecklistStatus = "complete" | "needs_setup" | "not_started";

export type ProductSetupInput = Readonly<{
  profileName: string;
  category: string;
  goal: string;
  paymentBookingNeed: SetupNeedStatus;
  proofReviewNeed: SetupNeedStatus;
  customerContactNeed: SetupNeedStatus;
  launchReadinessStatus: LaunchReadinessStatus;
}>;

export type ProductSetupProgress = Readonly<
  ProductSetupInput & {
    productId: OnboardingProductId;
    updatedAt: string;
  }
>;

export type OnboardingState = Readonly<{
  setups: Readonly<Partial<Record<OnboardingProductId, ProductSetupProgress>>>;
}>;

export type SetupChecklistItem = Readonly<{
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  warning?: string;
}>;

export type LaunchChecklistItem = Readonly<{
  id: string;
  productId: OnboardingProductId;
  title: string;
  description: string;
  status: LaunchChecklistStatus;
  required: boolean;
  warning?: string;
  route: string;
}>;

export type LaunchScorePlaceholder = Readonly<{
  label: "Launch readiness";
  value: string;
  note: string;
}>;

export type IncompleteSetupWarning = Readonly<{
  id: string;
  productId: OnboardingProductId;
  title: string;
  detail: string;
  route: string;
}>;

export const onboardingProductLabels: Record<OnboardingProductId, string> = {
  "business-builder": "Business Builder",
  "creator-studio": "Creator Studio",
  "growth-studio": "Growth Studio"
};

export const onboardingProductSetupRoutes: Record<OnboardingProductId, string> = {
  "business-builder": "/business-builder/setup",
  "creator-studio": "/creator-studio/setup",
  "growth-studio": "/growth-studio/setup"
};

export const setupNeedLabels: Record<SetupNeedStatus, string> = {
  not_answered: "Select status",
  needed: "Need setup",
  already_ready: "Already ready",
  not_needed: "Not needed now"
};

export const launchReadinessStatusLabels: Record<LaunchReadinessStatus, string> = {
  not_started: "Not started",
  setting_up: "Setting up",
  needs_review: "Needs review",
  ready_for_review: "Ready for review"
};

export const initialOnboardingState: OnboardingState = Object.freeze({
  setups: Object.freeze({})
});

const storageKey = "sonara-guided-onboarding";
const onboardingProductIds: readonly OnboardingProductId[] = Object.freeze([
  "business-builder",
  "creator-studio",
  "growth-studio"
]);

export function createOnboardingStore(storage: OnboardingStorageLike | null = getBrowserStorage()) {
  let state = readStoredState(storage);

  function getState() {
    return state;
  }

  function saveSetup(productId: OnboardingProductId, input: ProductSetupInput) {
    const progress = createProductSetupProgress(productId, input);
    state = Object.freeze({
      setups: Object.freeze({
        ...state.setups,
        [productId]: progress
      })
    });
    writeStoredState(storage, state);
    return progress;
  }

  function clear() {
    state = initialOnboardingState;
    storage?.removeItem(storageKey);
  }

  return Object.freeze({ getState, saveSetup, clear });
}

export function createProductSetupProgress(
  productId: OnboardingProductId,
  input: ProductSetupInput,
  updatedAt = new Date().toISOString()
): ProductSetupProgress {
  return Object.freeze({
    productId,
    profileName: input.profileName.trim(),
    category: input.category.trim(),
    goal: input.goal.trim(),
    paymentBookingNeed: input.paymentBookingNeed,
    proofReviewNeed: input.proofReviewNeed,
    customerContactNeed: input.customerContactNeed,
    launchReadinessStatus: input.launchReadinessStatus,
    updatedAt
  });
}

export function createProductSetupChecklist(
  productId: OnboardingProductId,
  progress?: ProductSetupProgress
): readonly SetupChecklistItem[] {
  return Object.freeze([
    createSetupChecklistItem(
      `${productId}-profile-name`,
      "Profile name",
      "Name the business, creator profile, or growth workspace.",
      Boolean(progress?.profileName)
    ),
    createSetupChecklistItem(
      `${productId}-category`,
      "Category",
      "Choose the type of work this product path supports.",
      Boolean(progress?.category)
    ),
    createSetupChecklistItem(
      `${productId}-goal`,
      "Goal",
      "Write the first setup goal in plain language.",
      Boolean(progress?.goal)
    ),
    createSetupChecklistItem(
      `${productId}-payment-booking`,
      "Payment or booking need",
      "Decide whether payment links, booking links, or appointment setup is needed.",
      isNeedAnswered(progress?.paymentBookingNeed),
      needsSetupWarning(
        progress?.paymentBookingNeed,
        "Payment or booking setup still needs review."
      )
    ),
    createSetupChecklistItem(
      `${productId}-proof-review`,
      "Proof or review need",
      "Decide whether proof, testimonials, reviews, or trust setup is needed.",
      isNeedAnswered(progress?.proofReviewNeed),
      needsSetupWarning(progress?.proofReviewNeed, "Proof or review setup still needs review.")
    ),
    createSetupChecklistItem(
      `${productId}-customer-contact`,
      "Customer or contact need",
      "Decide whether contact records, intake, or customer follow-up setup is needed.",
      isNeedAnswered(progress?.customerContactNeed),
      needsSetupWarning(
        progress?.customerContactNeed,
        "Customer or contact setup still needs review."
      )
    ),
    createSetupChecklistItem(
      `${productId}-launch-readiness`,
      "Launch readiness",
      "Mark whether this path is still setting up or ready for review.",
      progress?.launchReadinessStatus === "ready_for_review" ||
        progress?.launchReadinessStatus === "needs_review"
    )
  ]);
}

export function createLaunchChecklist(state: OnboardingState): readonly LaunchChecklistItem[] {
  return Object.freeze(
    onboardingProductIds.flatMap((productId) => {
      const progress = state.setups[productId];
      const route = onboardingProductSetupRoutes[productId];
      return [
        createLaunchChecklistItem(
          `${productId}-setup-profile`,
          productId,
          "Profile basics",
          "Profile name, category, and goal are saved.",
          Boolean(progress?.profileName && progress.category && progress.goal),
          true,
          route
        ),
        createLaunchChecklistItem(
          `${productId}-payment-booking`,
          productId,
          "Payment and booking setup",
          "Payment or booking need is answered and no required setup is left unreviewed.",
          isNeedReady(progress?.paymentBookingNeed),
          true,
          route,
          createNeedWarning(progress?.paymentBookingNeed, "Payment or booking setup is incomplete.")
        ),
        createLaunchChecklistItem(
          `${productId}-proof-review`,
          productId,
          "Proof and review setup",
          "Proof, review, or testimonial need is answered and reviewed.",
          isNeedReady(progress?.proofReviewNeed),
          true,
          route,
          createNeedWarning(progress?.proofReviewNeed, "Proof or review setup is incomplete.")
        ),
        createLaunchChecklistItem(
          `${productId}-customer-contact`,
          productId,
          "Customer and contact setup",
          "Customer/contact need is answered and reviewed.",
          isNeedReady(progress?.customerContactNeed),
          true,
          route,
          createNeedWarning(
            progress?.customerContactNeed,
            "Customer or contact setup is incomplete."
          )
        ),
        createLaunchChecklistItem(
          `${productId}-launch-readiness`,
          productId,
          "Launch readiness review",
          "Product path is marked ready for review.",
          progress?.launchReadinessStatus === "ready_for_review",
          true,
          route,
          progress && progress.launchReadinessStatus !== "ready_for_review"
            ? "Launch readiness is not marked ready for review."
            : undefined
        )
      ];
    })
  );
}

export function createLaunchScorePlaceholder(state: OnboardingState): LaunchScorePlaceholder {
  const checklist = createLaunchChecklist(state);
  const complete = checklist.filter((item) => item.status === "complete").length;
  return Object.freeze({
    label: "Launch readiness",
    value: complete === 0 ? "Not scored yet" : `${complete}/${checklist.length} checklist items`,
    note: "Placeholder only. Final scoring requires owner review, security checks, real persistence, and launch approval."
  });
}

export function createIncompleteSetupWarnings(
  state: OnboardingState
): readonly IncompleteSetupWarning[] {
  return Object.freeze(
    createLaunchChecklist(state)
      .filter((item) => item.warning)
      .map((item) =>
        Object.freeze({
          id: `${item.id}-warning`,
          productId: item.productId,
          title: `${onboardingProductLabels[item.productId]}: ${item.title}`,
          detail: item.warning ?? "Setup is incomplete.",
          route: item.route
        })
      )
  );
}

function createSetupChecklistItem(
  id: string,
  title: string,
  description: string,
  isComplete: boolean,
  warning?: string
): SetupChecklistItem {
  return Object.freeze({ id, title, description, isComplete, warning });
}

function createLaunchChecklistItem(
  id: string,
  productId: OnboardingProductId,
  title: string,
  description: string,
  isComplete: boolean,
  required: boolean,
  route: string,
  warning?: string
): LaunchChecklistItem {
  return Object.freeze({
    id,
    productId,
    title,
    description,
    status: isComplete ? "complete" : warning ? "needs_setup" : "not_started",
    required,
    route,
    warning
  });
}

function isNeedAnswered(status?: SetupNeedStatus): boolean {
  return Boolean(status && status !== "not_answered");
}

function isNeedReady(status?: SetupNeedStatus): boolean {
  return status === "already_ready" || status === "not_needed";
}

function needsSetupWarning(status: SetupNeedStatus | undefined, warning: string) {
  return status === "needed" || !isNeedAnswered(status) ? warning : undefined;
}

function createNeedWarning(status: SetupNeedStatus | undefined, warning: string) {
  if (status === "needed") {
    return warning;
  }
  if (!isNeedAnswered(status)) {
    return "Need status has not been answered.";
  }
  return undefined;
}

function readStoredState(storage: OnboardingStorageLike | null): OnboardingState {
  const raw = storage?.getItem(storageKey);
  if (!raw) {
    return initialOnboardingState;
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    storage?.removeItem(storageKey);
    return initialOnboardingState;
  }
}

function normalizeState(value: unknown): OnboardingState {
  if (!value || typeof value !== "object") {
    return initialOnboardingState;
  }
  const candidate = value as Partial<OnboardingState>;
  const normalizedSetups: Partial<Record<OnboardingProductId, ProductSetupProgress>> = {};
  for (const productId of onboardingProductIds) {
    const setup = candidate.setups?.[productId];
    if (setup) {
      normalizedSetups[productId] = normalizeSetupProgress(productId, setup);
    }
  }
  return Object.freeze({ setups: Object.freeze(normalizedSetups) });
}

function normalizeSetupProgress(
  productId: OnboardingProductId,
  value: Partial<ProductSetupProgress>
): ProductSetupProgress {
  return createProductSetupProgress(
    productId,
    {
      profileName: typeof value.profileName === "string" ? value.profileName : "",
      category: typeof value.category === "string" ? value.category : "",
      goal: typeof value.goal === "string" ? value.goal : "",
      paymentBookingNeed: normalizeNeedStatus(value.paymentBookingNeed),
      proofReviewNeed: normalizeNeedStatus(value.proofReviewNeed),
      customerContactNeed: normalizeNeedStatus(value.customerContactNeed),
      launchReadinessStatus: normalizeLaunchReadinessStatus(value.launchReadinessStatus)
    },
    typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString()
  );
}

function normalizeNeedStatus(value: unknown): SetupNeedStatus {
  return value === "needed" || value === "already_ready" || value === "not_needed"
    ? value
    : "not_answered";
}

function normalizeLaunchReadinessStatus(value: unknown): LaunchReadinessStatus {
  return value === "setting_up" || value === "needs_review" || value === "ready_for_review"
    ? value
    : "not_started";
}

function writeStoredState(storage: OnboardingStorageLike | null, state: OnboardingState) {
  storage?.setItem(storageKey, JSON.stringify(state));
}

function getBrowserStorage(): OnboardingStorageLike | null {
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
