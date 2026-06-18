import { brandIdentity, getProductTheme } from "@signal-os/ui";
import {
  createAutopilotWorkflowEngine,
  safeAutomationPolicyRules,
  type ActionQueueState,
  type ApprovalLevel,
  type AutomationAuditEvent,
  type AutomationRiskLabel,
  type WorkflowRecord
} from "@signal-os/autopilot";
import { clearElement, createElement, createMetric } from "../../dom.ts";
import {
  createBusinessJourneyOverview,
  createBusinessBuilderStore,
  createBusinessSetupChecklist,
  createLaunchReadinessPlaceholder,
  communicationPreferenceLabels,
  customerConsentStatusLabels,
  customerSourceLabels,
  customerStatusLabels,
  followUpDraftTypeLabels,
  moneyPathEventLabels,
  type BusinessBuilderState,
  type CustomerFollowUpDraft,
  type CustomerRecordDraft,
  type FollowUpDraftType,
  type BusinessJourneyTimelineEvent,
  type BusinessJourneyWarning,
  type BusinessJourneyStep,
  type MoneyPathEventType,
  type OfferDraft,
  type ProofPassportDraft,
  type SmartIntakeDraft
} from "../../lib/business-builder/index.ts";
import { createMoneyAdjacentStore } from "../../lib/money-adjacent/index.ts";
import { renderDataOwnershipSection } from "../../ui/data-ownership-sections.ts";

type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const businessBuilderTheme = getProductTheme("business-builder");
const businessBuilderName = brandIdentity.products.businessBuilder;

const dashboardCards = Object.freeze([
  Object.freeze({
    title: "Business Proof Passport",
    description: "Draft the public proof basics customers need before they contact you.",
    status: "Beta",
    href: "/business-builder/proof-passport"
  }),
  Object.freeze({
    title: "Money Path",
    description: "Track the next safe payment setup action without storing payment credentials.",
    status: "Beta",
    href: "/business-builder/money-path"
  }),
  Object.freeze({
    title: "Smart Intake",
    description: "Prepare the first questions customers should answer before owner review.",
    status: "Beta",
    href: "/business-builder/smart-intake"
  }),
  Object.freeze({
    title: "Offer Builder",
    description: "Package one clear offer with next-step language.",
    status: "Beta",
    href: "/business-builder/offers"
  }),
  Object.freeze({
    title: "Customer Records",
    description: "Create private customer records with consent and follow-up details.",
    status: "Beta",
    href: "/business-builder/customers"
  }),
  Object.freeze({
    title: "Follow-up Queue",
    description:
      "Draft follow-ups, reminders, review requests, and win-back messages for owner review.",
    status: "Requires Review",
    href: "/business-builder/customers/follow-up"
  }),
  Object.freeze({
    title: "Booking Links",
    description: "Prepare owner-reviewed booking links and call-to-book records.",
    status: "Beta",
    href: "/business-builder/bookings"
  }),
  Object.freeze({
    title: "Payment Options",
    description: "Create external provider link records with trust warnings.",
    status: "Requires Review",
    href: "/business-builder/payment-options"
  }),
  Object.freeze({
    title: "Reviews",
    description: "Prepare review links and testimonials with moderation.",
    status: "Requires Review",
    href: "/business-builder/reviews"
  }),
  Object.freeze({
    title: "Business Autopilot Board",
    description: "See setup priorities without autonomous customer contact or payment changes.",
    status: "Beta",
    href: "/business-builder/autopilot-board"
  })
]);

export function renderBusinessBuilderDashboard() {
  const store = createBusinessBuilderStore();
  const moneyStore = createMoneyAdjacentStore();
  const state = store.getState();
  const journey = createBusinessJourneyOverview(state, moneyStore.getState());
  const page = createBusinessBuilderShell({
    kicker: businessBuilderName,
    title: businessBuilderName,
    description:
      "Start with proof, one clear offer, one safe money path, intake, booking, reviews, and private customer records."
  });
  const readiness = createLaunchReadinessPlaceholder(state);
  page.append(
    renderReadinessCard(readiness.value, readiness.note),
    renderJourneyProgress(journey.steps, journey.progressLabel),
    renderNextActionCard(journey.nextAction),
    renderJourneyWarnings(journey.warnings),
    renderDashboardCards(),
    renderDataOwnershipSection("business_builder"),
    renderSetupChecklist(state)
  );
  return page;
}

export function renderProofPassportPage() {
  const store = createBusinessBuilderStore();
  const journeyPanel = createJourneyPanel(store);
  const page = createBusinessBuilderShell({
    kicker: businessBuilderName,
    title: "Business Proof Passport",
    description:
      "Draft a customer-facing proof profile. Drafts are local setup records and do not publish automatically."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const name = createTextField("Business name", "Example: Northside Studio", true);
  const summary = createTextareaField("Short description", "What do you help customers do?");
  const services = createTextareaField("Services", "List the main services or packages.");
  const proof = createTextareaField("Proof points", "Add truthful proof points only.");
  const action = createTextField("Contact action", "Example: Request a quote", true);
  const url = createTextField("Contact URL", "https://example.com/contact", false);
  const form = createRecordForm("Save Proof Passport draft", [
    name,
    summary,
    services,
    proof,
    action,
    url
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addProofPassport({
      businessName: name.control.value,
      shortDescription: summary.control.value,
      services: services.control.value,
      proofPoints: proof.control.value,
      contactAction: action.control.value,
      contactUrl: url.control.value
    });
    status.textContent = "Proof Passport draft saved locally.";
    form.reset();
    renderProofList(list, store.getState().proofPassports);
    journeyPanel.refresh();
  });

  page.append(
    renderSafetyNote(
      "No fake verification. Publish controls require a later owner-reviewed backend path."
    ),
    journeyPanel.element,
    form,
    status,
    list
  );
  renderProofList(list, store.getState().proofPassports);
  return page;
}

export function renderMoneyPathPage() {
  const store = createBusinessBuilderStore();
  const moneyStore = createMoneyAdjacentStore();
  const page = createBusinessBuilderShell({
    kicker: "Business Builder",
    title: "Money Path",
    description:
      "Log safe payment setup actions. This does not process payments or create real checkout sessions."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const eventType = createSelectField("Event type", moneyPathEventLabels);
  const label = createTextField("Event label", "Example: deposit link planned", true);
  const amount = createTextField("Amount note", "Example: deposit amount TBD", false);
  const reference = createTextField("Payment link reference", "Example: Stripe draft link", false);
  const notes = createTextareaField("Notes", "Owner-reviewed payment setup notes.");
  const form = createRecordForm("Log Money Path event", [
    eventType,
    label,
    amount,
    reference,
    notes
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addMoneyPathEvent({
      eventType: eventType.control.value as MoneyPathEventType,
      label: label.control.value,
      amountNote: amount.control.value,
      paymentLinkReference: reference.control.value,
      notes: notes.control.value
    });
    status.textContent = "Money Path event logged locally.";
    form.reset();
    renderMoneyPathTimeline(
      list,
      createBusinessJourneyOverview(store.getState(), moneyStore.getState()).timeline
    );
  });

  page.append(
    renderSafetyNote(
      "Use provider-hosted payment links. Do not enter card numbers, CVV, bank credentials, provider secrets, or tokens."
    ),
    renderNextActionCard(
      createBusinessJourneyOverview(store.getState(), moneyStore.getState()).nextAction
    ),
    renderJourneyWarnings(
      createBusinessJourneyOverview(store.getState(), moneyStore.getState()).warnings
    ),
    createElement("a", {
      className: "secondary-action security-back-link",
      href: "/business-builder/payment-options",
      textContent: "Open Payment Options"
    }),
    form,
    status,
    list
  );
  renderMoneyPathTimeline(
    list,
    createBusinessJourneyOverview(store.getState(), moneyStore.getState()).timeline
  );
  return page;
}

export function renderSmartIntakePage() {
  const store = createBusinessBuilderStore();
  const page = createBusinessBuilderShell({
    kicker: "Business Builder",
    title: "Smart Intake",
    description:
      "Draft a simple customer intake structure. Submissions are not collected until a safe backend path exists."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const formName = createTextField("Form name", "Example: New project request", true);
  const serviceType = createTextField(
    "Service type",
    "Example: consultation, repair, design",
    true
  );
  const requiredFields = createTextareaField(
    "Required fields",
    "Example: name, contact, service needed, preferred date"
  );
  const notes = createTextareaField("Owner notes", "What should the owner review first?");
  const form = createRecordForm("Save intake draft", [
    formName,
    serviceType,
    requiredFields,
    notes
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addSmartIntakeDraft({
      formName: formName.control.value,
      serviceType: serviceType.control.value,
      requiredFields: requiredFields.control.value,
      ownerNotes: notes.control.value
    });
    status.textContent = "Smart Intake draft saved locally.";
    form.reset();
    renderSmartIntakeList(list, store.getState().smartIntakeDrafts);
  });

  page.append(
    renderSafetyNote(
      "Customer submissions stay private by default. No file upload or AI processing is enabled here."
    ),
    form,
    status,
    list
  );
  renderSmartIntakeList(list, store.getState().smartIntakeDrafts);
  return page;
}

export function renderOffersPage() {
  const store = createBusinessBuilderStore();
  const journeyPanel = createJourneyPanel(store);
  const page = createBusinessBuilderShell({
    kicker: "Business Builder",
    title: "Offer Builder",
    description:
      "Draft one clear customer offer. Keep pricing notes honest and avoid guaranteed outcome claims."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const offerName = createTextField("Offer name", "Example: Starter consultation", true);
  const problem = createTextareaField("Customer problem", "What customer problem does this solve?");
  const deliverables = createTextareaField("Deliverables", "What is included?");
  const priceNote = createTextField("Price note", "Example: quote after review", false);
  const nextStep = createTextField("Next step", "Example: request intake", true);
  const form = createRecordForm("Save offer draft", [
    offerName,
    problem,
    deliverables,
    priceNote,
    nextStep
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addOffer({
      offerName: offerName.control.value,
      customerProblem: problem.control.value,
      deliverables: deliverables.control.value,
      priceNote: priceNote.control.value,
      nextStep: nextStep.control.value
    });
    status.textContent = "Offer draft saved locally.";
    form.reset();
    renderOfferList(list, store.getState().offers);
    journeyPanel.refresh();
  });

  page.append(
    renderSafetyNote(
      "No guaranteed revenue or certified advice claims. Offers remain drafts until reviewed."
    ),
    journeyPanel.element,
    form,
    status,
    list
  );
  renderOfferList(list, store.getState().offers);
  return page;
}

export function renderCustomersPage() {
  const store = createBusinessBuilderStore();
  const journeyPanel = createJourneyPanel(store);
  const page = createBusinessBuilderShell({
    kicker: "Business Builder",
    title: "Customer Records",
    description:
      "Create private customer setup records with consent, preferences, and follow-up timing. Records are not public."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const customerName = createTextField("Customer name", "Example: customer or lead name", true);
  const email = createTextField("Email", "customer@example.com", true);
  const phone = createTextField("Phone optional", "Optional phone number", false);
  const source = createSelectField("Source", customerSourceLabels);
  const customerStatus = createSelectField("Status", customerStatusLabels);
  const tags = createTextField("Tags", "Example: lead, booking, local", false);
  const notes = createTextareaField("Notes", "Owner-only notes.");
  const lastContacted = createDateField("Last contacted", false);
  const nextFollowUp = createDateField("Next follow-up", false);
  const consent = createSelectField("Consent status", customerConsentStatusLabels);
  const preference = createSelectField("Communication preference", communicationPreferenceLabels);
  const permissionNote = createTextareaField(
    "Permission note",
    "Example: customer asked for email updates on May 20."
  );
  const form = createRecordForm("Create customer record", [
    customerName,
    email,
    phone,
    source,
    customerStatus,
    tags,
    notes,
    lastContacted,
    nextFollowUp,
    consent,
    preference,
    permissionNote
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addCustomerRecord({
      customerName: customerName.control.value,
      email: email.control.value,
      phone: phone.control.value,
      source: source.control.value as keyof typeof customerSourceLabels,
      customerStatus: customerStatus.control.value as keyof typeof customerStatusLabels,
      tags: tags.control.value,
      notes: notes.control.value,
      lastContactedAt: lastContacted.control.value,
      nextFollowUpAt: nextFollowUp.control.value,
      consentStatus: consent.control.value as keyof typeof customerConsentStatusLabels,
      communicationPreference: preference.control
        .value as keyof typeof communicationPreferenceLabels,
      permissionNote: permissionNote.control.value
    });
    status.textContent = "Customer record saved locally.";
    form.reset();
    renderCustomerList(list, store.getState().customerRecords);
    journeyPanel.refresh();
  });

  page.append(
    renderSafetyNote(
      "Customer records are owner-controlled and private. Opt-outs and unknown permission status block sending. No automatic messaging is enabled."
    ),
    journeyPanel.element,
    createElement("a", {
      className: "secondary-action security-back-link",
      href: "/business-builder/customers/follow-up",
      textContent: "Open follow-up queue"
    }),
    form,
    status,
    list
  );
  renderCustomerList(list, store.getState().customerRecords);
  return page;
}

export function renderCustomerFollowUpPage() {
  const store = createBusinessBuilderStore();
  const journeyPanel = createJourneyPanel(store);
  const page = createBusinessBuilderShell({
    kicker: "Business Builder",
    title: "Customer Follow-up Queue",
    description:
      "Draft customer follow-ups, booking reminders, review requests, and win-back messages. Nothing sends without owner approval."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const customers = store.getState().customerRecords;
  const customerOptions = Object.fromEntries(
    customers.map((customer) => [
      customer.id,
      `${customer.customer_name || "Unnamed customer"} - ${
        customerConsentStatusLabels[customer.consent_status]
      }`
    ])
  );
  const customer = createSelectField(
    "Customer",
    customers.length > 0 ? customerOptions : { none: "Create a customer record first" }
  );
  const followUpType = createSelectField("Follow-up type", followUpDraftTypeLabels);
  const subject = createTextField("Subject", "Example: checking in on your request", true);
  const message = createTextareaField(
    "Message draft",
    "Draft only. Owner must review and send manually later."
  );
  const form = createRecordForm("Queue follow-up draft", [
    customer,
    followUpType,
    subject,
    message
  ]);
  if (customers.length === 0) {
    form.querySelector("button")?.setAttribute("disabled", "true");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (customers.length === 0) {
      status.textContent = "Create a customer record before queuing follow-up drafts.";
      return;
    }
    const draft = store.addCustomerFollowUp({
      customerId: customer.control.value,
      followUpType: followUpType.control.value as FollowUpDraftType,
      subject: subject.control.value,
      messageBody: message.control.value
    });
    status.textContent =
      draft.status === "blocked_opt_out"
        ? "Follow-up draft recorded as blocked because this customer cannot be messaged."
        : "Follow-up draft queued for owner review. Nothing was sent.";
    form.reset();
    renderFollowUpList(list, store.getState().customerFollowUps);
    journeyPanel.refresh();
  });

  page.append(
    renderSafetyNote(
      "Follow-up drafts are not sends. Owner approval is required, unknown permission must be resolved, and opt-out/no-outreach records are blocked."
    ),
    journeyPanel.element,
    createElement("a", {
      className: "secondary-action security-back-link",
      href: "/growth-studio/win-back",
      textContent: "Open Growth win-back"
    }),
    form,
    status,
    list
  );
  renderFollowUpList(list, store.getState().customerFollowUps);
  return page;
}

export function renderAutopilotBoardPage() {
  const engine = createAutopilotWorkflowEngine();
  const state = engine.seedDefaults();
  const businessStore = createBusinessBuilderStore();
  const moneyStore = createMoneyAdjacentStore();
  const journey = createBusinessJourneyOverview(businessStore.getState(), moneyStore.getState());
  const page = createBusinessBuilderShell({
    kicker: "Business Builder",
    title: "Business Autopilot Board",
    description:
      "Queue routine work, draft safe next steps, and hold risky actions for human confirmation."
  });
  page.append(
    renderNextActionCard(journey.nextAction),
    renderJourneyProgress(journey.steps, journey.progressLabel),
    renderJourneyWarnings(journey.warnings),
    renderAutopilotSummary(state),
    renderWorkflowSection("Automation queue", state.queued, "Auto-safe actions are queued here."),
    renderWorkflowSection(
      "Suggested actions",
      state.completed,
      "Safe internal actions can run as setup tasks or recommendations."
    ),
    renderWorkflowSection(
      "Approval required",
      state.approvalRequired,
      "Customer contact, pricing, publishing, payment, and campaign actions wait for owner review."
    ),
    renderWorkflowSection(
      "Blocked actions",
      state.blocked,
      "Critical actions cannot run through routine automation."
    ),
    renderAutomationRulesPreview(),
    renderAutomationAuditHistory(state.auditEvents),
    renderSafetyNote(
      "Autopilot can draft, queue, and flag routine work. It cannot send customer messages, publish content, change payments, delete records, or bypass safety warnings without the required review."
    )
  );
  return page;
}

function renderJourneyProgress(steps: readonly BusinessJourneyStep[], progressLabel: string) {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const step of steps) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: step.title }),
      createElement("p", { className: "recommendation", textContent: step.description }),
      createMetric("Status", step.isComplete ? "Started" : "Set this up"),
      createElement("p", { className: "warning-copy", textContent: step.safetyNote }),
      createElement("a", {
        className: "secondary-action",
        href: step.route,
        textContent: step.isComplete ? "Review" : "Continue"
      })
    );
    grid.append(card);
  }
  section.append(
    createElement("h2", { textContent: "Journey Progress" }),
    createMetric("Progress", progressLabel),
    grid
  );
  return section;
}

function renderNextActionCard(action: {
  title: string;
  description: string;
  route: string;
  actionLabel: string;
  safetyNote: string;
}) {
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  card.append(
    createElement("h2", { textContent: "Next best action" }),
    createElement("h3", { textContent: action.title }),
    createElement("p", { className: "recommendation", textContent: action.description }),
    createElement("p", { className: "warning-copy", textContent: action.safetyNote }),
    createElement("a", {
      className: "secondary-action",
      href: action.route,
      textContent: action.actionLabel
    })
  );
  return card;
}

function renderJourneyWarnings(warnings: readonly BusinessJourneyWarning[]) {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  if (warnings.length === 0) {
    grid.append(
      renderSmallEmptyCard(
        "No trust warnings",
        "Setup records do not currently contain reviewed trust warnings."
      )
    );
  }
  for (const warning of warnings) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: warning.title }),
      createElement("p", { className: "recommendation", textContent: warning.description }),
      createMetric("Severity", warning.critical ? "Critical" : "Review"),
      createElement("a", {
        className: "secondary-action",
        href: warning.route,
        textContent: "Review"
      })
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Trust and Safety Warnings" }), grid);
  return section;
}

function renderAutopilotSummary(state: ActionQueueState) {
  const summary = createElement("div", { className: "security-summary" });
  summary.append(
    createMetric("Auto-safe", state.completed.length + state.queued.length),
    createMetric("Needs review", state.approvalRequired.length),
    createMetric("Blocked", state.blocked.length),
    createMetric("Audit events", state.auditEvents.length)
  );
  return summary;
}

function renderWorkflowSection(
  title: string,
  records: readonly WorkflowRecord[],
  description: string
) {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const record of records) {
    grid.append(renderWorkflowCard(record));
  }
  if (records.length === 0) {
    grid.append(
      createElement("article", {
        className: "planning-card shell-card empty-record-card",
        textContent: "No records in this section yet."
      })
    );
  }
  section.append(
    createElement("h2", { textContent: title }),
    createElement("p", { className: "recommendation", textContent: description }),
    grid
  );
  return section;
}

function renderWorkflowCard(record: WorkflowRecord) {
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h3", { textContent: record.title }),
    createElement("p", { className: "recommendation", textContent: record.description }),
    createMetric("Workflow", record.workflow_type),
    createMetric("Approval", approvalLevelLabel(record.approval_level)),
    createMetric("Risk", riskLabel(record.risk)),
    createMetric("Confidence", `${Math.round(record.confidence * 100)}%`),
    createMetric("Status", record.status),
    createElement("p", { className: "warning-copy", textContent: record.policy_reason })
  );
  return card;
}

function renderAutomationRulesPreview() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const level of ["auto_safe", "owner_review", "blocked"] satisfies ApprovalLevel[]) {
    const rules = safeAutomationPolicyRules.filter((rule) => rule.approvalLevel === level);
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: approvalLevelLabel(level) }),
      createMetric("Rules", rules.length),
      createElement("p", {
        className: "recommendation",
        textContent: rules.map((rule) => rule.label).join(", ")
      })
    );
    grid.append(card);
  }
  section.append(
    createElement("h2", { textContent: "Automation rules" }),
    grid,
    createElement("a", {
      className: "secondary-action",
      href: "/admin/automation-rules",
      textContent: "Review rules"
    })
  );
  return section;
}

function renderAutomationAuditHistory(events: readonly AutomationAuditEvent[]) {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const event of events.slice(0, 6)) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: event.event_type }),
      createElement("p", { className: "recommendation", textContent: event.summary }),
      createMetric("Approval", approvalLevelLabel(event.approval_level)),
      createMetric("Risk", riskLabel(event.risk))
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Audit history" }), grid);
  return section;
}

function createJourneyPanel(store: ReturnType<typeof createBusinessBuilderStore>) {
  const element = createElement("div", { className: "record-section" });
  const refresh = () => {
    const moneyStore = createMoneyAdjacentStore();
    const journey = createBusinessJourneyOverview(store.getState(), moneyStore.getState());
    clearElement(element);
    element.append(
      renderJourneyProgress(journey.steps, journey.progressLabel),
      renderNextActionCard(journey.nextAction),
      renderJourneyWarnings(journey.warnings)
    );
  };
  refresh();
  return Object.freeze({ element, refresh });
}

function approvalLevelLabel(level: ApprovalLevel) {
  const labels: Record<ApprovalLevel, string> = {
    auto_safe: "Auto-safe",
    owner_review: "Owner review",
    admin_review: "Admin review",
    blocked: "Blocked"
  };
  return labels[level];
}

function riskLabel(risk: AutomationRiskLabel) {
  return `${risk.charAt(0).toUpperCase()}${risk.slice(1)}`;
}

function createBusinessBuilderShell({
  kicker,
  title,
  description
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  const page = createElement("section", {
    className: `work-screen sonara-shell record-page ${businessBuilderTheme.themeClassName}`
  });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: kicker }),
    createElement("h1", { textContent: title }),
    createElement("p", { className: "screen-copy", textContent: description })
  );
  page.append(header);
  return page;
}

function renderDashboardCards() {
  const grid = createElement("div", { className: "planning-grid" });
  for (const card of dashboardCards) {
    const article = createElement("article", { className: "planning-card shell-card" });
    article.append(
      createElement("h2", { textContent: card.title }),
      createElement("p", { className: "recommendation", textContent: card.description }),
      createMetric("Status", card.status),
      createElement("a", { className: "secondary-action", href: card.href, textContent: "Open" })
    );
    grid.append(article);
  }
  return grid;
}

function renderSetupChecklist(state: BusinessBuilderState) {
  const section = createElement("section", { className: "record-section" });
  const list = createElement("div", { className: "planning-grid" });
  for (const item of createBusinessSetupChecklist(state)) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: item.title }),
      createElement("p", { className: "recommendation", textContent: item.description }),
      createMetric("Status", item.isComplete ? "Started" : "Set this up"),
      createElement("a", { className: "secondary-action", href: item.route, textContent: "Open" })
    );
    list.append(card);
  }
  section.append(createElement("h2", { textContent: "Setup Checklist" }), list);
  return section;
}

function renderReadinessCard(value: string, note: string) {
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  card.append(
    createElement("h2", { textContent: "Launch readiness score" }),
    createMetric("Status", value),
    createElement("p", { className: "recommendation", textContent: note })
  );
  return card;
}

function renderSafetyNote(text: string) {
  return createElement("p", { className: "warning-copy", textContent: text });
}

function renderProofList(container: HTMLElement, records: readonly ProofPassportDraft[]) {
  renderRecordList(
    container,
    records,
    "No Proof Passport drafts yet. Use the form above to draft the business profile first.",
    (record) => ({
      title: record.business_name || "Untitled Proof Passport",
      description: record.short_description || "No description added.",
      metrics: [
        ["Services", record.services || "Not added"],
        ["Proof points", record.proof_points || "Not added"],
        ["Status", record.status]
      ]
    })
  );
}

function renderOfferList(container: HTMLElement, records: readonly OfferDraft[]) {
  renderRecordList(
    container,
    records,
    "No offer drafts yet. Create one clear offer after proof, payment, and booking setup.",
    (record) => ({
      title: record.offer_name || "Untitled offer",
      description: record.customer_problem || "No customer problem added.",
      metrics: [
        ["Deliverables", record.deliverables || "Not added"],
        ["Price note", record.price_note || "Not added"],
        ["Next step", record.next_step || "Not added"]
      ]
    })
  );
}

function renderCustomerList(container: HTMLElement, records: readonly CustomerRecordDraft[]) {
  renderRecordList(
    container,
    records,
    "No customer records yet. Add a private customer record before queuing follow-up drafts.",
    (record) => ({
      title: record.customer_name || "Unnamed customer",
      description: record.notes || "No notes added.",
      metrics: [
        ["Email", record.email || "Not added"],
        ["Phone", record.phone || "Not added"],
        ["Source", customerSourceLabels[record.source]],
        ["Status", customerStatusLabels[record.customer_status]],
        ["Tags", record.tags.length > 0 ? record.tags.join(", ") : "Not added"],
        ["Consent", customerConsentStatusLabels[record.consent_status]],
        ["Preference", communicationPreferenceLabels[record.communication_preference]],
        ["Next follow-up", record.next_follow_up_at || "Not scheduled"]
      ]
    })
  );
}

function renderFollowUpList(container: HTMLElement, records: readonly CustomerFollowUpDraft[]) {
  renderRecordList(
    container,
    records,
    "No follow-up drafts queued yet. Create a customer with permission details, then queue a review or growth follow-up draft.",
    (record) => ({
      title: record.subject || followUpDraftTypeLabels[record.follow_up_type],
      description: record.message_body || "No message draft added.",
      metrics: [
        ["Customer", record.customer_name || "Unnamed customer"],
        ["Type", followUpDraftTypeLabels[record.follow_up_type]],
        ["Approval", approvalLevelLabel(record.approval_level)],
        ["Risk", riskLabel(record.risk)],
        ["Status", record.status],
        ["Safety", record.safety_note]
      ]
    })
  );
}

function renderMoneyPathTimeline(
  container: HTMLElement,
  records: readonly BusinessJourneyTimelineEvent[]
) {
  renderRecordList(
    container,
    records,
    "No Money Path timeline events yet. Add proof, payment, booking, offer, customer, or review records to populate the timeline.",
    (record) => ({
      title: record.title,
      description: record.description,
      metrics: [
        ["Source", record.source.replaceAll("_", " ")],
        ["Status", record.status],
        ["Organization", record.organization_id],
        ["Safety", record.safetyNote],
        ["Route", record.route]
      ]
    })
  );
}

function renderSmallEmptyCard(title: string, description: string) {
  const card = createElement("article", {
    className: "planning-card shell-card empty-record-card"
  });
  card.append(
    createElement("h3", { textContent: title }),
    createElement("p", { className: "recommendation", textContent: description }),
    createMetric("Status", "No live data yet")
  );
  return card;
}

function renderSmartIntakeList(container: HTMLElement, records: readonly SmartIntakeDraft[]) {
  renderRecordList(
    container,
    records,
    "No Smart Intake drafts yet. Draft the owner-reviewed intake questions before collecting submissions.",
    (record) => ({
      title: record.form_name || "Untitled intake",
      description: record.owner_notes || "No owner notes added.",
      metrics: [
        ["Service type", record.service_type || "Not added"],
        ["Required fields", record.required_fields || "Not added"],
        ["Status", record.status]
      ]
    })
  );
}

function renderRecordList<T>(
  container: HTMLElement,
  records: readonly T[],
  emptyMessage: string,
  toCard: (record: T) => {
    title: string;
    description: string;
    metrics: readonly (readonly [string, string])[];
  }
) {
  clearElement(container);
  if (records.length === 0) {
    const card = createElement("article", {
      className: "planning-card shell-card empty-record-card"
    });
    card.append(
      createElement("h3", { textContent: "Empty state" }),
      createElement("p", { className: "recommendation", textContent: emptyMessage }),
      createMetric("Status", "Set this up")
    );
    container.append(card);
    return;
  }
  for (const record of records) {
    const cardData = toCard(record);
    const card = createElement("article", { className: "planning-card shell-card record-card" });
    card.append(
      createElement("h3", { textContent: cardData.title }),
      createElement("p", { className: "recommendation", textContent: cardData.description })
    );
    for (const [label, value] of cardData.metrics) {
      card.append(createMetric(label, value));
    }
    container.append(card);
  }
}

function createRecordForm(label: string, fields: readonly { wrapper: HTMLElement }[]) {
  const form = createElement("form", { className: "record-form" });
  for (const field of fields) {
    form.append(field.wrapper);
  }
  form.append(
    createElement("button", {
      className: "primary-action",
      type: "submit",
      textContent: label
    })
  );
  return form;
}

function createTextField(label: string, placeholder: string, required: boolean) {
  const input = createElement("input", { type: "text" });
  input.placeholder = placeholder;
  input.required = required;
  return createField(label, input);
}

function createDateField(label: string, required: boolean) {
  const input = createElement("input", { type: "date" });
  input.required = required;
  return createField(label, input);
}

function createTextareaField(label: string, placeholder: string) {
  const input = createElement("textarea");
  input.placeholder = placeholder;
  input.rows = 4;
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
  const id = `business-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const wrapper = createElement("label", { className: "record-field" });
  wrapper.htmlFor = id;
  control.id = id;
  wrapper.append(createElement("span", { textContent: label }), control);
  return { wrapper, control };
}
