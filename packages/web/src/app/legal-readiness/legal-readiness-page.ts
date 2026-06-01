import { clearElement, createElement, createMetric } from "../../dom.ts";
import {
  createLegalReadinessStore,
  getLegalRiskLabel,
  legalProductAreaLabels,
  legalReadinessChecklist,
  legalReadinessSafetyRules,
  legalRiskLabels,
  type AttorneyReviewPacketDraft,
  type CampaignClaimReviewDraft,
  type LegalProductArea,
  type RightsLicensingTrackerDraft
} from "../../lib/legal-readiness/index.ts";

type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const aiGovernanceCards = Object.freeze([
  Object.freeze({
    title: "Generated Content Review",
    description:
      "Review generated text, campaign claims, policy language, and rights-sensitive outputs before use.",
    risk: "High"
  }),
  Object.freeze({
    title: "Provider Boundary Review",
    description:
      "Keep sensitive legal, customer, and rights records out of external provider prompts unless approved.",
    risk: "Critical"
  }),
  Object.freeze({
    title: "Legal Notice Review",
    description:
      "Legal notices stay manual. This MVP does not send notices or customer communications.",
    risk: "Critical"
  })
]);

export function renderBusinessLegalReadinessPage() {
  const store = createLegalReadinessStore();
  const page = createLegalShell({
    kicker: "Business Builder",
    title: "Legal Readiness",
    description:
      "Prepare contract, policy, and attorney review packets for human review before using legal-sensitive material."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const packetName = createTextField("Packet name", "Example: service agreement review", true);
  const productArea = createSelectField("Product area", legalProductAreaLabels);
  const summary = createTextareaField("Context summary", "What should be reviewed?");
  const openQuestions = createTextareaField(
    "Open questions",
    "List questions for attorney or qualified human review."
  );
  const documentList = createTextareaField(
    "Document list",
    "List draft contracts, policy pages, campaign copy, or rights notes."
  );
  const form = createRecordForm("Create attorney packet draft", [
    packetName,
    productArea,
    summary,
    openQuestions,
    documentList
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addAttorneyPacket({
      packetName: packetName.control.value,
      productArea: productArea.control.value as LegalProductArea,
      summary: summary.control.value,
      openQuestions: openQuestions.control.value,
      documentList: documentList.control.value
    });
    status.textContent = "Attorney review packet draft saved locally.";
    form.reset();
    renderAttorneyPacketList(list, store.getState().attorneyPackets);
  });

  page.append(renderLegalSafetyNote(), renderChecklistSection(), form, status, list);
  renderAttorneyPacketList(list, store.getState().attorneyPackets);
  return page;
}

export function renderRightsLicensingPage() {
  const store = createLegalReadinessStore();
  const page = createLegalShell({
    kicker: "Creator Studio",
    title: "Rights & Licensing Tracker",
    description:
      "Track source, usage, and rights-holder notes before creative assets are used in public work."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const assetTitle = createTextField("Asset title", "Example: campaign photo set", true);
  const sourceNote = createTextareaField("Source note", "Where did the asset come from?");
  const usageScope = createTextareaField("Usage scope", "Where do you intend to use it?");
  const rightsHolder = createTextareaField(
    "Rights holder note",
    "Known owner, license, permission, or review gaps."
  );
  const form = createRecordForm("Create rights tracker draft", [
    assetTitle,
    sourceNote,
    usageScope,
    rightsHolder
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addRightsTracker({
      assetTitle: assetTitle.control.value,
      sourceNote: sourceNote.control.value,
      usageScope: usageScope.control.value,
      rightsHolderNote: rightsHolder.control.value
    });
    status.textContent = "Rights and licensing draft saved for review.";
    form.reset();
    renderRightsTrackerList(list, store.getState().rightsTrackers);
  });

  page.append(renderLegalSafetyNote(), form, status, list);
  renderRightsTrackerList(list, store.getState().rightsTrackers);
  return page;
}

export function renderCampaignClaimReviewPage() {
  const store = createLegalReadinessStore();
  const page = createLegalShell({
    kicker: "Growth Studio",
    title: "Campaign Claim Review",
    description:
      "Prepare campaign claims, evidence notes, and channel context for owner and legal-sensitive review."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const campaignName = createTextField("Campaign name", "Example: spring offer campaign", true);
  const claimText = createTextareaField("Claim text", "Draft the customer-facing claim.");
  const evidenceNote = createTextareaField("Evidence note", "What proof supports the claim?");
  const channel = createTextField("Channel", "Example: website, email, flyer, social", true);
  const form = createRecordForm("Create claim review draft", [
    campaignName,
    claimText,
    evidenceNote,
    channel
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addCampaignClaimReview({
      campaignName: campaignName.control.value,
      claimText: claimText.control.value,
      evidenceNote: evidenceNote.control.value,
      channel: channel.control.value
    });
    status.textContent = "Campaign claim draft saved for human review.";
    form.reset();
    renderCampaignClaimList(list, store.getState().campaignClaimReviews);
  });

  page.append(renderLegalSafetyNote(), form, status, list);
  renderCampaignClaimList(list, store.getState().campaignClaimReviews);
  return page;
}

export function renderLegalRiskReviewPage() {
  const page = createLegalShell({
    kicker: "Security Center",
    title: "Legal Risk Review",
    description:
      "Review legal-sensitive launch gates for contracts, policies, licensing, campaign claims, and AI governance."
  });
  page.append(
    renderLegalSafetyNote(),
    renderChecklistSection(),
    renderRiskLabelsSection(),
    renderAiGovernancePlaceholder(),
    renderSafetyRulesSection()
  );
  return page;
}

function createLegalShell({
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

function renderLegalSafetyNote() {
  return createElement("p", {
    className: "warning-copy",
    textContent:
      "Preparation only. This is not legal advice, does not guarantee compliance, and does not send legal notices."
  });
}

function renderChecklistSection() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of legalReadinessChecklist) {
    const card = createElement("article", { className: "planning-card shell-card record-card" });
    card.append(
      createElement("h3", { textContent: item.title }),
      createElement("p", { className: "recommendation", textContent: item.description }),
      createMetric("Risk", getLegalRiskLabel(item.riskLevel)),
      createMetric("Human review", item.humanReviewRequired ? "Required" : "Not required")
    );
    if (item.humanReviewRequired) {
      card.append(renderRiskBadge(item.riskLevel));
    }
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Legal Checklist" }), grid);
  return section;
}

function renderRiskLabelsSection() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const [risk, label] of Object.entries(legalRiskLabels)) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: label as string }),
      createMetric("Human review", risk === "high" || risk === "critical" ? "Required" : "No"),
      createMetric("Launch gate", risk === "critical" ? "Blocked until reviewed" : "Review")
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Risk Labels" }), grid);
  return section;
}

function renderAiGovernancePlaceholder() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of aiGovernanceCards) {
    const card = createElement("article", { className: "planning-card shell-card record-card" });
    card.append(
      createElement("h3", { textContent: item.title }),
      createElement("p", { className: "recommendation", textContent: item.description }),
      createMetric("Risk", item.risk),
      createMetric("Human review", "Required")
    );
    card.append(renderRiskBadge(item.risk.toLowerCase() === "critical" ? "critical" : "high"));
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "AI Governance Review" }), grid);
  return section;
}

function renderSafetyRulesSection() {
  const section = createElement("section", { className: "record-section" });
  const list = createElement("ul", { className: "security-list" });
  for (const rule of legalReadinessSafetyRules) {
    list.append(createElement("li", { textContent: rule }));
  }
  section.append(createElement("h2", { textContent: "Safety Rules" }), list);
  return section;
}

function renderAttorneyPacketList(
  container: HTMLElement,
  records: readonly AttorneyReviewPacketDraft[]
) {
  renderRecordList(container, records, "No attorney review packet drafts yet.", (record) => ({
    title: record.packet_name || "Untitled review packet",
    description: record.summary || "No context summary added.",
    metrics: [
      ["Product area", legalProductAreaLabels[record.product_area]],
      ["Open questions", record.open_questions || "Not added"],
      ["Documents", record.document_list || "Not added"],
      ["Status", record.status],
      ["Risk", getLegalRiskLabel(record.risk_level)],
      ["Human review", record.human_review_required ? "Required" : "Not required"]
    ],
    riskLevel: record.risk_level
  }));
}

function renderRightsTrackerList(
  container: HTMLElement,
  records: readonly RightsLicensingTrackerDraft[]
) {
  renderRecordList(container, records, "No rights or licensing tracker drafts yet.", (record) => ({
    title: record.asset_title || "Untitled asset",
    description: record.source_note || "No source note added.",
    metrics: [
      ["Usage scope", record.usage_scope || "Not added"],
      ["Rights holder", record.rights_holder_note || "Review needed"],
      ["Status", record.status],
      ["Risk", getLegalRiskLabel(record.risk_level)],
      ["Human review", record.human_review_required ? "Required" : "Not required"]
    ],
    riskLevel: record.risk_level
  }));
}

function renderCampaignClaimList(
  container: HTMLElement,
  records: readonly CampaignClaimReviewDraft[]
) {
  renderRecordList(container, records, "No campaign claim review drafts yet.", (record) => ({
    title: record.campaign_name || "Untitled campaign",
    description: record.claim_text || "No claim text added.",
    metrics: [
      ["Evidence", record.evidence_note || "Not added"],
      ["Channel", record.channel || "Not added"],
      ["Status", record.status],
      ["Risk", getLegalRiskLabel(record.risk_level)],
      ["Human review", record.human_review_required ? "Required" : "Not required"]
    ],
    riskLevel: record.risk_level
  }));
}

function renderRecordList<T>(
  container: HTMLElement,
  records: readonly T[],
  emptyMessage: string,
  toCard: (record: T) => {
    title: string;
    description: string;
    metrics: readonly (readonly [string, string])[];
    riskLevel: keyof typeof legalRiskLabels;
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
    if (cardData.riskLevel === "high" || cardData.riskLevel === "critical") {
      card.append(renderRiskBadge(cardData.riskLevel));
    }
    container.append(card);
  }
}

function renderRiskBadge(riskLevel: keyof typeof legalRiskLabels) {
  return createElement("span", {
    className: "trust-warning",
    textContent: riskLevel === "critical" ? "Blocked until human review" : "Human review required"
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
  const id = `legal-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const wrapper = createElement("label", { className: "record-field" });
  wrapper.htmlFor = id;
  control.id = id;
  wrapper.append(createElement("span", { textContent: label }), control);
  return { wrapper, control };
}
