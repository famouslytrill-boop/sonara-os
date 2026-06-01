import { clearElement, createElement, createMetric } from "../../../dom.ts";
import {
  createRecoveryChecklist,
  createReliabilityCenterStore,
  degradedFeatureStates,
  incidentSeverityLabels,
  providerHealthCards,
  publicStatusPageConfig,
  reliabilityProviderLabels,
  webhookReplayQueueStub,
  type ContinuityModeStatus,
  type IncidentRecord,
  type IncidentSeverity,
  type ReliabilityCenterState,
  type ReliabilityProviderId
} from "../../../lib/reliability-center/index.ts";

type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const dashboardCards = Object.freeze([
  Object.freeze({
    title: "Provider Health",
    description: "Manual provider health cards. No live status or uptime claim is shown.",
    status: "Manual review",
    href: "/admin/reliability-center/providers"
  }),
  Object.freeze({
    title: "Incident Records",
    description: "Create internal incident drafts for reviewed reliability follow-up.",
    status: "Draft records",
    href: "/admin/reliability-center/incidents"
  }),
  Object.freeze({
    title: "Continuity Mode",
    description: "Manual continuity state only. Auto-failover is not enabled.",
    status: "Manual only",
    href: "/admin/reliability-center/continuity-mode"
  }),
  Object.freeze({
    title: "Public Status Page",
    description: "Status page exists, but stays private/off by default.",
    status: "Private/off",
    href: "/status"
  })
]);

export function renderReliabilityCenterPage() {
  const store = createReliabilityCenterStore();
  const state = store.getState();
  const page = createReliabilityShell({
    title: "Reliability Center",
    description:
      "Track provider review, incident drafts, continuity mode, and recovery checklists without fake uptime claims."
  });
  page.append(
    renderReliabilitySafetyNote(),
    renderDashboardCards(),
    renderContinuitySummary(state),
    renderDependencyMapPlaceholder(),
    renderRecoveryChecklist()
  );
  return page;
}

export function renderProviderHealthPage() {
  const page = createReliabilityShell({
    title: "Provider Health",
    description:
      "Provider cards are manual review records. No provider is marked operational from live monitoring."
  });
  const grid = createElement("div", { className: "planning-grid" });
  for (const provider of providerHealthCards) {
    const card = createElement("article", { className: "planning-card shell-card record-card" });
    card.append(
      createElement("h2", { textContent: provider.name }),
      createElement("p", { className: "recommendation", textContent: provider.notes }),
      createMetric("Category", provider.category),
      createMetric("Status", provider.healthStatus),
      createMetric("Manual review", provider.manualReviewRequired ? "Required" : "Not required")
    );
    grid.append(card);
  }
  page.append(renderReliabilitySafetyNote(), grid);
  return page;
}

export function renderIncidentRecordsPage() {
  const store = createReliabilityCenterStore();
  const page = createReliabilityShell({
    title: "Incident Records",
    description:
      "Create internal incident drafts for review. Records do not publish status updates automatically."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const title = createTextField("Incident title", "Example: provider checkout review", true);
  const provider = createSelectField("Affected provider", reliabilityProviderLabels);
  const severity = createSelectField("Severity", incidentSeverityLabels);
  const ownerNote = createTextareaField("Owner note", "Observed impact and next review step.");
  const form = createRecordForm("Create incident draft", [title, provider, severity, ownerNote]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addIncident({
      title: title.control.value,
      affectedProvider: provider.control.value as ReliabilityProviderId,
      severity: severity.control.value as IncidentSeverity,
      ownerNote: ownerNote.control.value
    });
    status.textContent = "Incident draft saved locally.";
    form.reset();
    renderIncidentList(list, store.getState().incidents);
  });

  page.append(renderReliabilitySafetyNote(), form, status, list);
  renderIncidentList(list, store.getState().incidents);
  return page;
}

export function renderContinuityModePage() {
  const store = createReliabilityCenterStore();
  const page = createReliabilityShell({
    title: "Continuity Mode",
    description:
      "Set manual continuity state for internal review. Automatic failover is disabled in this MVP."
  });
  const status = createElement("p", { className: "status-copy" });
  const summary = createElement("div", { className: "planning-grid" });
  const mode = createSelectField("Continuity state", {
    off: "Off",
    manual_ready: "Manual ready",
    manual_active: "Manual active"
  } satisfies Record<ContinuityModeStatus, string>);
  const form = createRecordForm("Save continuity state", [mode]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.setContinuityMode(mode.control.value as ContinuityModeStatus);
    status.textContent = "Manual continuity state saved locally.";
    renderContinuityCards(summary, store.getState());
  });

  page.append(
    renderReliabilitySafetyNote(),
    form,
    status,
    summary,
    renderDegradedFeatureStates(),
    renderWebhookReplayStub()
  );
  renderContinuityCards(summary, store.getState());
  return page;
}

export function renderPrivateStatusPage() {
  const page = createElement("section", { className: "work-screen sonara-shell record-page" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: "Status" }),
    createElement("h1", { textContent: "Status Page" }),
    createElement("p", { className: "screen-copy", textContent: publicStatusPageConfig.message })
  );
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h2", { textContent: "Public status" }),
    createMetric("Enabled", publicStatusPageConfig.enabled ? "Yes" : "No"),
    createMetric("Visibility", publicStatusPageConfig.visibility),
    createMetric("Live provider status", "Not connected"),
    createElement("p", {
      className: "recommendation",
      textContent:
        "This page does not publish incidents, provider health, uptime, or operational claims."
    })
  );
  page.append(header, card);
  return page;
}

function createReliabilityShell({ title, description }: { title: string; description: string }) {
  const page = createElement("section", { className: "work-screen sonara-shell record-page" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: "Shared Admin" }),
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

function renderContinuitySummary(state: ReliabilityCenterState) {
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  card.append(
    createElement("h2", { textContent: "Continuity Summary" }),
    createMetric("Mode", state.continuityMode.status),
    createMetric("Manual only", state.continuityMode.manualOnly ? "Yes" : "No"),
    createMetric("Auto-failover", state.continuityMode.autoFailoverEnabled ? "On" : "Off"),
    createMetric("Public status", state.continuityMode.publicStatusEnabled ? "On" : "Off")
  );
  return card;
}

function renderDependencyMapPlaceholder() {
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  card.append(
    createElement("h2", { textContent: "Dependency Map" }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "Placeholder map: Vercel, Supabase, Stripe, AI providers, Cloudflare, GitHub, email, and SMS dependencies require manual review."
    }),
    createMetric("Live map", "Not connected"),
    createMetric("Auto-failover", "Disabled")
  );
  return card;
}

function renderRecoveryChecklist() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of createRecoveryChecklist()) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: item.title }),
      createElement("p", { className: "recommendation", textContent: item.description }),
      createMetric("Required", item.required ? "Yes" : "Optional")
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Recovery Checklist" }), grid);
  return section;
}

function renderDegradedFeatureStates() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const feature of degradedFeatureStates) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: feature.featureName }),
      createElement("p", { className: "recommendation", textContent: feature.notes }),
      createMetric("State", feature.state)
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Degraded Feature States" }), grid);
  return section;
}

function renderWebhookReplayStub() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of webhookReplayQueueStub) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: reliabilityProviderLabels[item.provider] }),
      createElement("p", { className: "recommendation", textContent: item.notes }),
      createMetric("Queue", item.status)
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Webhook Replay Queue" }), grid);
  return section;
}

function renderContinuityCards(container: HTMLElement, state: ReliabilityCenterState) {
  clearElement(container);
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h2", { textContent: "Manual Continuity State" }),
    createMetric("Mode", state.continuityMode.status),
    createMetric("Manual only", state.continuityMode.manualOnly ? "Yes" : "No"),
    createMetric("Auto-failover", state.continuityMode.autoFailoverEnabled ? "On" : "Off"),
    createMetric("Last reviewed", state.continuityMode.lastReviewedAt)
  );
  container.append(card);
}

function renderIncidentList(container: HTMLElement, incidents: readonly IncidentRecord[]) {
  clearElement(container);
  if (incidents.length === 0) {
    const card = createElement("article", {
      className: "planning-card shell-card empty-record-card"
    });
    card.append(
      createElement("h3", { textContent: "Empty state" }),
      createElement("p", {
        className: "recommendation",
        textContent: "No incident drafts yet."
      }),
      createMetric("Status", "Set this up")
    );
    container.append(card);
    return;
  }
  for (const incident of incidents) {
    const card = createElement("article", { className: "planning-card shell-card record-card" });
    card.append(
      createElement("h3", { textContent: incident.title || "Untitled incident" }),
      createElement("p", {
        className: "recommendation",
        textContent: incident.owner_note || "No owner note added."
      }),
      createMetric("Provider", reliabilityProviderLabels[incident.affected_provider]),
      createMetric("Severity", incidentSeverityLabels[incident.severity]),
      createMetric("Status", incident.status)
    );
    container.append(card);
  }
}

function renderReliabilitySafetyNote() {
  return createElement("p", {
    className: "warning-copy",
    textContent:
      "Reliability Center uses manual setup records. No 100% uptime claims, fake provider health, public incident publishing, or automatic failover are enabled."
  });
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
  const id = `reliability-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const wrapper = createElement("label", { className: "record-field" });
  wrapper.htmlFor = id;
  control.id = id;
  wrapper.append(createElement("span", { textContent: label }), control);
  return { wrapper, control };
}
