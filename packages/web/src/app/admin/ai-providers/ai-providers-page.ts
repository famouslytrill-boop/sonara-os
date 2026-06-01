import { createElement, createMetric } from "../../../dom.ts";
import {
  evaluatePromptRedactionGate,
  getAIProviderRegistry,
  providerUsageAuditModel,
  type AIProviderDefinition,
  type AIProviderId
} from "../../../lib/ai-models/index.ts";

export function renderAIProvidersPage() {
  const page = createAIProviderShell({
    title: "AI Provider Registry",
    description:
      "Internal provider configuration review. API keys are not collected or displayed in this UI."
  });
  page.append(
    renderSafetyNote(),
    renderProviderCards(),
    renderUsageAuditLog(),
    createElement("a", {
      className: "secondary-action security-back-link",
      href: "/admin/ai-providers/model-router",
      textContent: "Open model router"
    })
  );
  return page;
}

export function renderModelRouterPage() {
  const page = createAIProviderShell({
    title: "Model Router",
    description:
      "Review provider routing readiness and test the prompt redaction gate without sending prompts to providers."
  });
  const prompt = createTextarea("Prompt review input");
  const provider = createProviderSelect();
  const output = createElement("pre", {
    className: "recommendation",
    textContent: "No prompt reviewed yet."
  });
  const button = createElement("button", {
    className: "primary-action",
    type: "button",
    textContent: "Run redaction gate"
  });
  button.addEventListener("click", () => {
    const result = evaluatePromptRedactionGate({
      prompt: prompt.control.value,
      providerId: provider.control.value as AIProviderId
    });
    output.textContent = JSON.stringify(
      {
        allowed: result.allowed,
        requiresApproval: result.requiresApproval,
        riskLabels: result.riskLabels,
        message: result.message,
        redactedPrompt: result.redactedPrompt
      },
      null,
      2
    );
  });
  const form = createElement("section", { className: "planning-card shell-card record-section" });
  form.append(
    createElement("h2", { textContent: "Prompt Redaction Gate" }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "Secrets, service-role keys, private keys, JWTs, and private repo dumps are blocked before external routing."
    }),
    provider.wrapper,
    prompt.wrapper,
    button,
    output
  );
  page.append(renderSafetyNote(), renderRouterCards(), form);
  return page;
}

function createAIProviderShell({ title, description }: { title: string; description: string }) {
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

function renderProviderCards() {
  const grid = createElement("div", { className: "planning-grid" });
  for (const provider of getAIProviderRegistry()) {
    grid.append(renderProviderCard(provider));
  }
  return grid;
}

function renderProviderCard(provider: AIProviderDefinition) {
  const card = createElement("article", { className: "planning-card shell-card record-card" });
  const badges = createElement("div", { className: "trust-warning-list" });
  for (const capability of provider.capabilities) {
    badges.append(
      createElement("span", {
        className: "trust-warning",
        textContent: capability.replace(/_/g, " ")
      })
    );
  }
  card.append(
    createElement("h2", { textContent: provider.publicName }),
    createElement("p", { className: "recommendation", textContent: provider.notes }),
    createMetric("Default", provider.defaultEnabled ? "Enabled" : "Disabled"),
    createMetric("Approval", provider.approvalStatus),
    createMetric("Privacy risk", provider.privacyRisk),
    createMetric("Sensitive external routing", provider.sensitiveDataRoutingEnabled ? "On" : "Off"),
    createMetric("Configurable", provider.configurable ? "Yes" : "No"),
    badges
  );
  return card;
}

function renderRouterCards() {
  const grid = createElement("div", { className: "planning-grid" });
  for (const provider of getAIProviderRegistry()) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: provider.publicName }),
      createMetric("Routing", provider.defaultEnabled ? "Local placeholder" : "Requires setup"),
      createMetric("Approval", provider.approvalStatus),
      createElement("p", {
        className: "recommendation",
        textContent: provider.external
          ? "External sensitive-data routing is disabled by default."
          : "Local placeholder only. No external provider call is made."
      })
    );
    grid.append(card);
  }
  return grid;
}

function renderUsageAuditLog() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const record of providerUsageAuditModel) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: record.providerId }),
      createMetric("Action", record.action),
      createMetric("Approval", record.approvalStatus),
      createMetric("Sensitive data blocked", record.sensitiveDataBlocked ? "Yes" : "No"),
      createMetric("Prompt stored", "No")
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Provider Usage Audit Log" }), grid);
  return section;
}

function renderSafetyNote() {
  return createElement("p", {
    className: "warning-copy",
    textContent:
      "No API keys are stored client-side. External sensitive-data routing is disabled by default. Full private repo dumps require approval."
  });
}

function createProviderSelect() {
  const wrapper = createElement("label", { className: "record-field" });
  const select = createElement("select");
  for (const provider of getAIProviderRegistry()) {
    const option = createElement("option", {
      value: provider.id,
      textContent: provider.publicName
    });
    select.append(option);
  }
  wrapper.append(createElement("span", { textContent: "Provider" }), select);
  return { wrapper, control: select };
}

function createTextarea(label: string) {
  const wrapper = createElement("label", { className: "record-field" });
  const textarea = createElement("textarea");
  textarea.rows = 8;
  textarea.placeholder = "Paste prompt text for local redaction review.";
  wrapper.append(createElement("span", { textContent: label }), textarea);
  return { wrapper, control: textarea };
}
