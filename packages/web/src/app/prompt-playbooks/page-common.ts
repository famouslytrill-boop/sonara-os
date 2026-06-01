import {
  buildRoleBasedPrompt,
  createAdminPromptPlaybook,
  createBusinessPromptPlaybook,
  createCreatorPromptPlaybook,
  createGrowthPromptPlaybook,
  getBlockedPromptRuleKeys,
  getPromptTemplates,
  promptCategories,
  type BuiltPrompt,
  type PromptProductArea,
  type PromptTemplate
} from "@signal-os/prompt-playbook-center";
import { createElement, createMetric } from "../../dom.ts";
import { renderAdminShell, renderMetricCard } from "../../ui/admin-components.ts";
import {
  renderAppShell,
  renderDashboardHeader,
  renderRiskBadge,
  renderStatusBadge
} from "../../ui/shared-components.ts";

export function renderPromptLibraryPage() {
  return renderPromptPlaybookSurface({
    title: "AI Playbook Center",
    kicker: "Business Prompt Library",
    description:
      "Original guided prompt templates for business, creator, growth, support, security, reliability, billing, and admin workflows.",
    templates: getPromptTemplates()
  });
}

export function renderBusinessAiPlaybooksPage() {
  return renderPromptPlaybookSurface({
    title: "Business Builder AI Playbooks",
    kicker: "Business Prompt Library",
    description:
      "Draft business blueprints, launch plans, value offers, website copy, and customer-safe replies with owner-review boundaries.",
    templates: createBusinessPromptPlaybook()
  });
}

export function renderCreatorAiPlaybooksPage() {
  return renderPromptPlaybookSurface({
    title: "Creator Studio AI Playbooks",
    kicker: "Creator Prompt Library",
    description:
      "Draft release plans, captions, content calendars, and rights-aware creator workflows without making fake rights claims.",
    templates: createCreatorPromptPlaybook()
  });
}

export function renderGrowthAiPlaybooksPage() {
  return renderPromptPlaybookSurface({
    title: "Growth Studio AI Playbooks",
    kicker: "Growth Prompt Library",
    description:
      "Draft campaigns, review requests, referral ideas, and growth copy with consent and owner-review controls.",
    templates: createGrowthPromptPlaybook()
  });
}

export function renderAdminPromptLibraryPage() {
  const templates = createAdminPromptPlaybook();
  return renderAdminShell({
    activeRoute: "/admin/prompt-library",
    title: "Admin Prompt Library",
    description:
      "Admin-ready prompt templates for owner review, reports, support, billing, security summaries, and reliability incidents.",
    warning:
      "Prompt outputs are drafts. High-risk, public, customer-facing, legal, pricing, refund, or policy prompts require owner approval.",
    children: [
      renderPromptSummary(templates),
      renderPromptControls(),
      renderPromptGrid(templates),
      renderGeneratedPromptPreview(templates[0])
    ]
  });
}

export function renderPromptSafetyPage() {
  const ruleList = createElement("ul", { className: "security-list" });
  for (const ruleKey of getBlockedPromptRuleKeys()) {
    ruleList.append(
      createElement("li", {
        textContent: `${ruleKey.replaceAll("_", " ")}: blocked before prompt output can run.`
      })
    );
  }
  return renderAdminShell({
    activeRoute: "/security-center",
    title: "Prompt Safety",
    description:
      "Safety review for prompt templates, high-risk prompt outputs, and blocked prompt behavior.",
    warning:
      "No prompt output may bypass owner approval when it is public-facing, customer-facing, legal, pricing, refund, campaign, review, testimonial, voice, visual, or video related.",
    children: [
      renderMetricCard({
        title: "Auto-send prompt outputs",
        value: "Disabled",
        description: "Generated output is draft-only and cannot be sent automatically.",
        status: "ready"
      }),
      renderMetricCard({
        title: "High-risk prompts",
        value: "Owner review",
        description:
          "High-risk public or customer-facing outputs route to Owner Confirmation Lock.",
        status: "review"
      }),
      createElement("h2", { textContent: "Blocked prompt requests" }),
      ruleList
    ]
  });
}

function renderPromptPlaybookSurface({
  title,
  kicker,
  description,
  templates
}: {
  title: string;
  kicker: string;
  description: string;
  templates: readonly PromptTemplate[];
}) {
  const page = renderAppShell("prompt-playbook-center");
  page.append(
    renderDashboardHeader({
      kicker,
      title,
      description,
      status: "Setup-mode"
    }),
    renderPromptSummary(templates),
    renderPromptControls(),
    renderPromptGrid(templates),
    renderGeneratedPromptPreview(templates[0])
  );
  return page;
}

function renderPromptSummary(templates: readonly PromptTemplate[]) {
  const grid = createElement("div", { className: "planning-grid" });
  grid.append(
    renderMetricCard({
      title: "Templates",
      value: String(templates.length),
      description: "Original guided workflow templates registered for this surface.",
      status: "ready"
    }),
    renderMetricCard({
      title: "Categories",
      value: String(promptCategories.length),
      description: "Category registry covers launch, growth, support, security, and admin tasks.",
      status: "ready"
    }),
    renderMetricCard({
      title: "Approval gate",
      value: "Enabled",
      description: "High-risk public outputs route to owner review before use.",
      status: "review"
    })
  );
  return grid;
}

function renderPromptControls() {
  const controls = createElement("section", { className: "planning-card shell-card" });
  const roleSelect = createElement("select");
  roleSelect.setAttribute("aria-label", "Role selector");
  for (const role of [
    "business_owner",
    "content_creator",
    "growth_operator",
    "admin",
    "support",
    "owner"
  ]) {
    roleSelect.append(
      createElement("option", { value: role, textContent: role.replaceAll("_", " ") })
    );
  }
  const search = createElement("input", { type: "search" });
  search.setAttribute("aria-label", "Search prompt templates");
  search.setAttribute("placeholder", "Search categories or workflow goals");
  const category = createElement("select");
  category.setAttribute("aria-label", "Prompt category filter");
  for (const promptCategory of promptCategories) {
    category.append(
      createElement("option", {
        value: promptCategory,
        textContent: promptCategory.replaceAll("_", " ")
      })
    );
  }
  controls.append(
    createElement("h2", { textContent: "Find a prompt" }),
    createMetric("Search/filter", "Setup-mode controls"),
    search,
    roleSelect,
    category
  );
  return controls;
}

function renderPromptGrid(templates: readonly PromptTemplate[]) {
  const grid = createElement("div", { className: "planning-grid" });
  for (const template of templates) {
    grid.append(renderPromptCard(template));
  }
  return grid;
}

function renderPromptCard(template: PromptTemplate) {
  const card = createElement("article", { className: "planning-card shell-card product-card" });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(
    createElement("h2", { textContent: template.name }),
    renderRiskBadge(template.risk_level, template.risk_level)
  );
  card.append(
    titleRow,
    renderStatusBadge(
      template.approval_required ? "Approval required" : "Draft template",
      template.approval_required ? "review" : "ready"
    ),
    createElement("p", { className: "recommendation", textContent: template.prompt_goal }),
    createMetric("Category", template.category.replaceAll("_", " ")),
    createMetric("Product area", formatProductArea(template.product_area)),
    createMetric("Target user", template.target_user.replaceAll("_", " ")),
    createMetric("Prompt quality", `${buildPreview(template).quality.score}/100`),
    createElement("button", { type: "button", textContent: "Copy prompt" }),
    createDisabledButton("Save template")
  );
  return card;
}

function renderGeneratedPromptPreview(template: PromptTemplate | undefined) {
  const card = createElement("section", {
    className: "planning-card planning-card--wide shell-card"
  });
  if (!template) {
    card.append(
      createElement("h2", { textContent: "Generated prompt preview" }),
      createElement("p", {
        className: "recommendation",
        textContent: "No template is available for this surface yet."
      })
    );
    return card;
  }
  const builtPrompt = buildPreview(template);
  card.append(
    createElement("h2", { textContent: "Generated prompt preview" }),
    renderStatusBadge(builtPrompt.safety.status.replaceAll("_", " "), statusTone(builtPrompt)),
    createElement("p", {
      className: "warning-copy",
      textContent: builtPrompt.safety.reasons.join(" ")
    }),
    renderTemplateFields(template),
    createElement("pre", {
      className: "prompt-preview",
      textContent: builtPrompt.prompt_preview
    })
  );
  return card;
}

function renderTemplateFields(template: PromptTemplate) {
  const wrapper = createElement("div", { className: "setup-checklist" });
  for (const field of template.input_fields) {
    const label = createElement("label", { className: "setup-checklist__item" });
    label.append(
      createElement("span", { textContent: field.label }),
      createElement(field.type === "textarea" ? "textarea" : "input", {
        type: field.type === "textarea" ? undefined : "text"
      })
    );
    const control = label.children[1] as HTMLElement;
    control.setAttribute("placeholder", field.placeholder);
    if (field.required) {
      control.setAttribute("required", "true");
    }
    wrapper.append(label);
  }
  return wrapper;
}

function buildPreview(template: PromptTemplate): BuiltPrompt {
  const inputs = Object.fromEntries(
    template.input_fields.map((field) => [field.id, `Example ${field.label.toLowerCase()} context`])
  );
  return buildRoleBasedPrompt({
    template_id: template.id,
    role: template.target_user,
    inputs,
    public_facing: template.approval_required,
    customer_facing: template.approval_required
  });
}

function createDisabledButton(label: string) {
  const button = createElement("button", { type: "button", textContent: `${label} (setup-mode)` });
  button.setAttribute("disabled", "true");
  return button;
}

function statusTone(builtPrompt: BuiltPrompt) {
  return builtPrompt.safety.status === "blocked"
    ? "blocked"
    : builtPrompt.safety.status === "owner_review_required"
      ? "review"
      : "ready";
}

function formatProductArea(productArea: PromptProductArea) {
  return productArea.replaceAll("-", " ");
}
