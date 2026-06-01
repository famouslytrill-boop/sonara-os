import { clearElement, createElement, createMetric } from "../../dom.ts";
import {
  createIncompleteSetupWarnings,
  createLaunchChecklist,
  createLaunchScorePlaceholder,
  createOnboardingStore,
  createProductSetupChecklist,
  launchReadinessStatusLabels,
  onboardingProductLabels,
  onboardingProductSetupRoutes,
  setupNeedLabels,
  type LaunchChecklistItem,
  type OnboardingProductId,
  type OnboardingState,
  type ProductSetupProgress,
  type SetupNeedStatus,
  type LaunchReadinessStatus
} from "../../lib/onboarding/index.ts";

type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const productSummaries: readonly {
  productId: OnboardingProductId;
  description: string;
}[] = Object.freeze([
  Object.freeze({
    productId: "business-builder",
    description:
      "Set up proof, payment or booking needs, intake, reviews, and customer contact basics."
  }),
  Object.freeze({
    productId: "creator-studio",
    description:
      "Set up creator profile, proof, rights-aware offers, payment or booking needs, and contact basics."
  }),
  Object.freeze({
    productId: "growth-studio",
    description:
      "Set up growth goals, campaign needs, review needs, customer contact needs, and launch review status."
  })
]);

export function renderOnboardingPage() {
  const store = createOnboardingStore();
  const state = store.getState();
  const page = createOnboardingShell({
    kicker: "Guided onboarding",
    title: "Choose a product setup path",
    description:
      "Start with one path, answer the launch setup questions, and review missing payment, booking, proof, review, or contact setup before launch."
  });

  page.append(
    renderLaunchScore(state),
    renderProductPathGrid(state),
    renderWarnings(state),
    createElement("a", {
      className: "secondary-action security-back-link",
      href: "/admin/launch-checklist",
      textContent: "Open launch checklist"
    })
  );
  return page;
}

export function renderBusinessBuilderSetupPage() {
  return renderProductSetupPage("business-builder");
}

export function renderCreatorStudioSetupPage() {
  return renderProductSetupPage("creator-studio");
}

export function renderGrowthStudioSetupPage() {
  return renderProductSetupPage("growth-studio");
}

export function renderAdminLaunchChecklistPage() {
  const state = createOnboardingStore().getState();
  const page = createOnboardingShell({
    kicker: "Admin",
    title: "Launch Checklist",
    description:
      "Review saved onboarding progress before launch. This checklist is a setup guide, not a final launch approval."
  });
  page.append(
    renderLaunchScore(state),
    renderLaunchChecklistGrid(createLaunchChecklist(state)),
    renderWarnings(state)
  );
  return page;
}

function renderProductSetupPage(productId: OnboardingProductId) {
  const store = createOnboardingStore();
  const progress = store.getState().setups[productId];
  const page = createOnboardingShell({
    kicker: onboardingProductLabels[productId],
    title: `${onboardingProductLabels[productId]} Setup`,
    description:
      "Save the first setup pass locally. This does not publish content, create payments, contact customers, or mark the product launch-ready."
  });
  const status = createElement("p", { className: "status-copy" });
  const checklistContainer = createElement("section", { className: "record-section" });
  const warningsContainer = createElement("section", { className: "record-section" });
  const form = createSetupForm(productId, progress, (input) => {
    store.saveSetup(productId, input);
    status.textContent = `${onboardingProductLabels[productId]} setup saved locally.`;
    renderSetupChecklist(checklistContainer, productId, store.getState().setups[productId]);
    renderWarningList(warningsContainer, store.getState(), productId);
  });

  page.append(
    renderSetupSafetyNote(),
    form,
    status,
    checklistContainer,
    warningsContainer,
    createElement("a", {
      className: "secondary-action security-back-link",
      href: "/onboarding",
      textContent: "Back to onboarding"
    })
  );
  renderSetupChecklist(checklistContainer, productId, progress);
  renderWarningList(warningsContainer, store.getState(), productId);
  return page;
}

function createSetupForm(
  productId: OnboardingProductId,
  progress: ProductSetupProgress | undefined,
  onSave: (input: {
    profileName: string;
    category: string;
    goal: string;
    paymentBookingNeed: SetupNeedStatus;
    proofReviewNeed: SetupNeedStatus;
    customerContactNeed: SetupNeedStatus;
    launchReadinessStatus: LaunchReadinessStatus;
  }) => void
) {
  const profileName = createTextField("Profile name", "Example: Northside Studio", true);
  const category = createTextField("Category", productCategoryPlaceholder(productId), true);
  const goal = createTextareaField("Goal", "What should this setup path help you launch?");
  const paymentBookingNeed = createSelectField("Payment or booking need", setupNeedLabels);
  const proofReviewNeed = createSelectField("Proof or review need", setupNeedLabels);
  const customerContactNeed = createSelectField("Customer or contact need", setupNeedLabels);
  const launchReadinessStatus = createSelectField(
    "Launch readiness status",
    launchReadinessStatusLabels
  );

  profileName.control.value = progress?.profileName ?? "";
  category.control.value = progress?.category ?? "";
  goal.control.value = progress?.goal ?? "";
  paymentBookingNeed.control.value = progress?.paymentBookingNeed ?? "not_answered";
  proofReviewNeed.control.value = progress?.proofReviewNeed ?? "not_answered";
  customerContactNeed.control.value = progress?.customerContactNeed ?? "not_answered";
  launchReadinessStatus.control.value = progress?.launchReadinessStatus ?? "not_started";

  const form = createElement("form", { className: "record-form" });
  form.append(
    profileName.wrapper,
    category.wrapper,
    goal.wrapper,
    paymentBookingNeed.wrapper,
    proofReviewNeed.wrapper,
    customerContactNeed.wrapper,
    launchReadinessStatus.wrapper,
    createElement("button", {
      className: "primary-action",
      type: "submit",
      textContent: "Save setup checklist"
    })
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSave({
      profileName: profileName.control.value,
      category: category.control.value,
      goal: goal.control.value,
      paymentBookingNeed: paymentBookingNeed.control.value as SetupNeedStatus,
      proofReviewNeed: proofReviewNeed.control.value as SetupNeedStatus,
      customerContactNeed: customerContactNeed.control.value as SetupNeedStatus,
      launchReadinessStatus: launchReadinessStatus.control.value as LaunchReadinessStatus
    });
  });
  return form;
}

function renderProductPathGrid(state: OnboardingState) {
  const grid = createElement("div", { className: "planning-grid" });
  for (const product of productSummaries) {
    const progress = state.setups[product.productId];
    const checklist = createProductSetupChecklist(product.productId, progress);
    const complete = checklist.filter((item) => item.isComplete).length;
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: onboardingProductLabels[product.productId] }),
      createElement("p", { className: "recommendation", textContent: product.description }),
      createMetric("Setup", progress ? `${complete}/${checklist.length} items` : "Not started"),
      createMetric(
        "Launch status",
        progress ? launchReadinessStatusLabels[progress.launchReadinessStatus] : "Not started"
      ),
      createElement("a", {
        className: "secondary-action",
        href: onboardingProductSetupRoutes[product.productId],
        textContent: progress ? "Continue setup" : "Start setup"
      })
    );
    grid.append(card);
  }
  return grid;
}

function renderSetupChecklist(
  container: HTMLElement,
  productId: OnboardingProductId,
  progress?: ProductSetupProgress
) {
  clearElement(container);
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of createProductSetupChecklist(productId, progress)) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: item.title }),
      createElement("p", { className: "recommendation", textContent: item.description }),
      createMetric("Status", item.isComplete ? "Saved" : "Set this up")
    );
    if (item.warning) {
      card.append(createElement("p", { className: "warning-copy", textContent: item.warning }));
    }
    grid.append(card);
  }
  container.append(createElement("h2", { textContent: "Setup Progress" }), grid);
}

function renderLaunchChecklistGrid(items: readonly LaunchChecklistItem[]) {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of items) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: item.title }),
      createElement("p", {
        className: "shell-kicker",
        textContent: onboardingProductLabels[item.productId]
      }),
      createElement("p", { className: "recommendation", textContent: item.description }),
      createMetric("Status", formatChecklistStatus(item.status)),
      createMetric("Required", item.required ? "Yes" : "Optional"),
      createElement("a", {
        className: "secondary-action",
        href: item.route,
        textContent: "Open setup"
      })
    );
    if (item.warning) {
      card.append(createElement("p", { className: "warning-copy", textContent: item.warning }));
    }
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Launch Readiness Checklist" }), grid);
  return section;
}

function renderWarnings(state: OnboardingState) {
  const section = createElement("section", { className: "record-section" });
  renderWarningList(section, state);
  return section;
}

function renderWarningList(
  container: HTMLElement,
  state: OnboardingState,
  productId?: OnboardingProductId
) {
  clearElement(container);
  const warnings = createIncompleteSetupWarnings(state).filter(
    (warning) => !productId || warning.productId === productId
  );
  const grid = createElement("div", { className: "planning-grid" });
  if (warnings.length === 0) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: "No setup warnings" }),
      createElement("p", {
        className: "recommendation",
        textContent: "No incomplete payment, booking, proof, review, or contact warnings yet."
      })
    );
    grid.append(card);
  }
  for (const warning of warnings) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: warning.title }),
      createElement("p", { className: "warning-copy", textContent: warning.detail }),
      createElement("a", {
        className: "secondary-action",
        href: warning.route,
        textContent: "Review setup"
      })
    );
    grid.append(card);
  }
  container.append(createElement("h2", { textContent: "Incomplete Setup Warnings" }), grid);
}

function renderLaunchScore(state: OnboardingState) {
  const score = createLaunchScorePlaceholder(state);
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  card.append(
    createElement("h2", { textContent: "Launch score placeholder" }),
    createMetric(score.label, score.value),
    createElement("p", { className: "recommendation", textContent: score.note })
  );
  return card;
}

function renderSetupSafetyNote() {
  return createElement("p", {
    className: "warning-copy",
    textContent:
      "Setup saves locally in this MVP. It does not publish pages, create payments, send messages, or mark launch approval complete."
  });
}

function createOnboardingShell({
  kicker,
  title,
  description
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  const page = createElement("section", { className: "work-screen sonara-shell record-page" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: kicker }),
    createElement("h1", { textContent: title }),
    createElement("p", { className: "screen-copy", textContent: description })
  );
  page.append(header);
  return page;
}

function productCategoryPlaceholder(productId: OnboardingProductId) {
  if (productId === "business-builder") {
    return "Example: local service business";
  }
  if (productId === "creator-studio") {
    return "Example: designer, producer, educator";
  }
  return "Example: win-back, reviews, referrals";
}

function formatChecklistStatus(status: LaunchChecklistItem["status"]) {
  if (status === "complete") {
    return "Complete";
  }
  if (status === "needs_setup") {
    return "Needs setup";
  }
  return "Not started";
}

function createTextField(label: string, placeholder: string, required: boolean) {
  const input = createElement("input", { type: "text" });
  input.placeholder = placeholder;
  input.required = required;
  return createField(label, input);
}

function createTextareaField(label: string, placeholder: string) {
  const input = createElement("textarea");
  input.placeholder = placeholder;
  input.rows = 4;
  input.required = true;
  return createField(label, input);
}

function createSelectField<T extends string>(label: string, options: Record<T, string>) {
  const select = createElement("select");
  for (const [value, text] of Object.entries(options)) {
    const option = createElement("option", { value, textContent: text as string });
    select.append(option);
  }
  return createField(label, select);
}

function createField<T extends FieldControl>(label: string, control: T) {
  const id = `onboarding-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const wrapper = createElement("label", { className: "record-field" });
  wrapper.htmlFor = id;
  control.id = id;
  wrapper.append(createElement("span", { textContent: label }), control);
  return { wrapper, control };
}
