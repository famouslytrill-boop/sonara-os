import { createElement, createMetric } from "../../dom.ts";
import { renderEmailConfigurationNotice } from "../../components/support/EmailConfigurationNotice.tsx";
import {
  analyticsEventPlaceholders,
  areDemoAccountsClearlyFake,
  betaDemoAccounts,
  betaFeedbackTypeLabels,
  betaIssueSeverityLabels,
  betaLaunchProductLabels,
  createBetaLaunchStore,
  getHelpDoc,
  getProductWalkthrough,
  helpDocs,
  onboardingEmailTemplates,
  productWalkthroughs,
  type BetaFeedbackType,
  type BetaIssueSeverity,
  type BetaLaunchProductId
} from "../../lib/beta-launch/index.ts";

type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function renderBetaInvitePage() {
  const store = createBetaLaunchStore();
  const page = createBetaShell({
    kicker: "Beta",
    title: "Join the SONARA Industries beta",
    description:
      "Use the beta to review setup flows, starter docs, demo walkthroughs, and feedback paths before launch. Demo data is fake and forms save locally in this shell."
  });
  const status = createElement("p", { className: "status-copy" });

  page.append(
    renderBetaNotice(),
    createBetaInviteForm((input) => {
      store.saveInvite(input);
      status.textContent = "Beta invite request saved locally for this browser only.";
    }),
    status,
    renderDemoAccounts(),
    renderWalkthroughCards(),
    renderEmailTemplates(),
    renderAnalyticsPlaceholders()
  );
  return page;
}

export function renderHelpPage() {
  const page = createBetaShell({
    kicker: "Help Center",
    title: "Starter docs for beta testers",
    description:
      "Open the product guide that matches your setup path. These docs explain current MVP behavior and what is still placeholder-only."
  });
  page.append(renderHelpOverview(), renderWalkthroughCards(), renderBetaNotice());
  return page;
}

export function renderBusinessBuilderHelpPage() {
  return renderProductHelpPage("business-builder");
}

export function renderCreatorStudioHelpPage() {
  return renderProductHelpPage("creator-studio");
}

export function renderGrowthStudioHelpPage() {
  return renderProductHelpPage("growth-studio");
}

export function renderFeedbackPage() {
  const store = createBetaLaunchStore();
  const page = createBetaShell({
    kicker: "Feedback",
    title: "Send beta feedback",
    description:
      "Use this local feedback stub for confusing steps, missing basics, or rough edges. Do not include private customer data, payment data, or secrets."
  });
  const status = createElement("p", { className: "status-copy" });
  page.append(
    renderBetaNotice(),
    createFeedbackForm((input) => {
      store.saveFeedback(input);
      status.textContent = "Feedback saved locally for this browser only.";
    }),
    status,
    renderAnalyticsPlaceholders()
  );
  return page;
}

export function renderSupportPage() {
  const store = createBetaLaunchStore();
  const page = createBetaShell({
    kicker: "Support",
    title: "Report a beta issue",
    description:
      "Capture route issues, launch blockers, or setup questions. This MVP stores issue reports locally until a reviewed support backend exists."
  });
  const status = createElement("p", { className: "status-copy" });
  page.append(
    renderSupportOptions(),
    renderEmailConfigurationNotice(),
    createIssueReportForm((input) => {
      store.saveIssue(input);
      status.textContent = "Issue report saved locally for this browser only.";
    }),
    status,
    renderBetaNotice()
  );
  return page;
}

function renderProductHelpPage(productId: BetaLaunchProductId) {
  const doc = getHelpDoc(productId);
  const walkthrough = getProductWalkthrough(productId);
  const page = createBetaShell({
    kicker: betaLaunchProductLabels[productId],
    title: doc.title,
    description: doc.summary
  });
  const sectionGrid = createElement("div", { className: "planning-grid" });
  for (const section of doc.sections) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: section.title }),
      createElement("p", { className: "recommendation", textContent: section.body })
    );
    sectionGrid.append(card);
  }

  page.append(
    sectionGrid,
    renderWalkthroughSteps(walkthrough),
    createElement("a", {
      className: "secondary-action security-back-link",
      href: "/help",
      textContent: "Back to Help"
    })
  );
  return page;
}

function createBetaInviteForm(
  onSave: (input: {
    name: string;
    email: string;
    productId: BetaLaunchProductId;
    launchGoal: string;
  }) => void
) {
  const name = createTextField("Name", "Your name or team name", true);
  const email = createEmailField("Email", "you@example.com", true);
  const productId = createSelectField("Product path", betaLaunchProductLabels);
  const launchGoal = createTextareaField(
    "Launch goal",
    "What do you want to test or launch first?"
  );
  const form = createElement("form", { className: "record-form" });
  form.append(
    name.wrapper,
    email.wrapper,
    productId.wrapper,
    launchGoal.wrapper,
    createElement("button", {
      className: "primary-action",
      type: "submit",
      textContent: "Save beta request locally"
    })
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSave({
      name: name.control.value,
      email: email.control.value,
      productId: productId.control.value as BetaLaunchProductId,
      launchGoal: launchGoal.control.value
    });
    form.reset();
  });
  return form;
}

function createFeedbackForm(
  onSave: (input: {
    productId: BetaLaunchProductId;
    feedbackType: BetaFeedbackType;
    message: string;
    contact: string;
  }) => void
) {
  const productId = createSelectField("Product", betaLaunchProductLabels);
  const feedbackType = createSelectField("Feedback type", betaFeedbackTypeLabels);
  const message = createTextareaField("Feedback", "What should be clearer or fixed?");
  const contact = createTextField("Optional contact", "Email or handle", false);
  const form = createElement("form", { className: "record-form" });
  form.append(
    productId.wrapper,
    feedbackType.wrapper,
    message.wrapper,
    contact.wrapper,
    createElement("button", {
      className: "primary-action",
      type: "submit",
      textContent: "Save feedback locally"
    })
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSave({
      productId: productId.control.value as BetaLaunchProductId,
      feedbackType: feedbackType.control.value as BetaFeedbackType,
      message: message.control.value,
      contact: contact.control.value
    });
    form.reset();
  });
  return form;
}

function createIssueReportForm(
  onSave: (input: {
    route: string;
    severity: BetaIssueSeverity;
    summary: string;
    contact: string;
  }) => void
) {
  const route = createTextField("Route or page", "Example: /business-builder/setup", true);
  const severity = createSelectField("Severity", betaIssueSeverityLabels);
  const summary = createTextareaField("Issue summary", "What happened and what did you expect?");
  const contact = createTextField("Optional contact", "Email or handle", false);
  const form = createElement("form", { className: "record-form" });
  form.append(
    route.wrapper,
    severity.wrapper,
    summary.wrapper,
    contact.wrapper,
    createElement("button", {
      className: "primary-action",
      type: "submit",
      textContent: "Save issue locally"
    })
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSave({
      route: route.control.value,
      severity: severity.control.value as BetaIssueSeverity,
      summary: summary.control.value,
      contact: contact.control.value
    });
    form.reset();
  });
  return form;
}

function renderDemoAccounts() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const account of betaDemoAccounts) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: account.label }),
      createMetric("Product", betaLaunchProductLabels[account.productId]),
      createMetric("Fake email", account.fakeEmail),
      createElement("p", { className: "recommendation", textContent: account.purpose }),
      createElement("p", { className: "warning-copy", textContent: account.dataNotice })
    );
    grid.append(card);
  }
  section.append(
    createElement("h2", { textContent: "Demo account seed data" }),
    createElement("p", {
      className: "status-copy",
      textContent: areDemoAccountsClearlyFake()
        ? "All demo accounts are clearly marked fake."
        : "Demo account markings need review before launch."
    }),
    grid
  );
  return section;
}

function renderWalkthroughCards() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const walkthrough of productWalkthroughs) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: walkthrough.title }),
      createMetric("Steps", walkthrough.steps.length),
      createElement("p", {
        className: "recommendation",
        textContent: "Open the starter walkthrough for this beta path."
      }),
      createElement("a", {
        className: "secondary-action",
        href: walkthrough.route,
        textContent: "Open walkthrough"
      })
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Product walkthroughs" }), grid);
  return section;
}

function renderWalkthroughSteps(walkthrough: ReturnType<typeof getProductWalkthrough>) {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const step of walkthrough.steps) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: step.title }),
      createElement("p", { className: "recommendation", textContent: step.description }),
      createElement("a", {
        className: "secondary-action",
        href: step.route,
        textContent: "Open page"
      })
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Walkthrough steps" }), grid);
  return section;
}

function renderHelpOverview() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const doc of helpDocs) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: doc.title }),
      createElement("p", { className: "recommendation", textContent: doc.summary }),
      createElement("a", {
        className: "secondary-action",
        href: doc.route,
        textContent: "Read guide"
      })
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Starter guides" }), grid);
  return section;
}

function renderEmailTemplates() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const template of onboardingEmailTemplates) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: template.title }),
      createMetric("Status", "Template only"),
      createMetric(
        "Product",
        template.productId === "all" ? "All products" : betaLaunchProductLabels[template.productId]
      ),
      createElement("p", { className: "shell-kicker", textContent: template.subject }),
      createElement("p", { className: "recommendation", textContent: template.body })
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Onboarding email templates" }), grid);
  return section;
}

function renderAnalyticsPlaceholders() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const event of analyticsEventPlaceholders) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: event.eventName }),
      createMetric("Route", event.route),
      createMetric("Enabled", event.enabled ? "Yes" : "No"),
      createMetric("Collects PII", event.collectsPii ? "Yes" : "No"),
      createElement("p", { className: "recommendation", textContent: event.purpose })
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Analytics event placeholders" }), grid);
  return section;
}

function renderSupportOptions() {
  const section = createElement("section", { className: "record-section" });
  section.append(
    createElement("h2", { textContent: "Support paths" }),
    renderInfoGrid([
      ["Beta questions", "Use the issue form below for setup blockers or confusing steps."],
      ["Security concerns", "Do not paste secrets. Use a short summary and route only."],
      ["Private data", "Do not include customer records, payment data, provider keys, or tokens."]
    ])
  );
  return section;
}

function renderInfoGrid(items: readonly (readonly [string, string])[]) {
  const grid = createElement("div", { className: "planning-grid" });
  for (const [title, body] of items) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: title }),
      createElement("p", { className: "recommendation", textContent: body })
    );
    grid.append(card);
  }
  return grid;
}

function renderBetaNotice() {
  return createElement("p", {
    className: "warning-copy",
    textContent:
      "Beta package behavior is local and placeholder-only. No email is sent, no analytics event is emitted, no account is provisioned, and no feedback is sent to a backend."
  });
}

function createBetaShell({
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

function createTextField(label: string, placeholder: string, required: boolean) {
  const input = createElement("input", { type: "text" });
  input.placeholder = placeholder;
  input.required = required;
  return createField(label, input);
}

function createEmailField(label: string, placeholder: string, required: boolean) {
  const input = createElement("input", { type: "email" });
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
  const id = `beta-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const wrapper = createElement("label", { className: "record-field" });
  wrapper.htmlFor = id;
  control.id = id;
  wrapper.append(createElement("span", { textContent: label }), control);
  return { wrapper, control };
}
