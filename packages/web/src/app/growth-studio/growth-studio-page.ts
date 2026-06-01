import { brandIdentity, getProductTheme } from "@signal-os/ui";
import { clearElement, createElement, createMetric } from "../../dom.ts";
import {
  campaignChannelLabels,
  createGrowthSetupChecklist,
  createGrowthStudioStore,
  reviewRequestChecklist,
  type CampaignChannel,
  type GrowthCampaignRecord,
  type GrowthOfferDraft,
  type GrowthStudioState,
  type ReferralCampaignDraft,
  type WinBackCustomerTag
} from "../../lib/growth-studio/index.ts";

type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const growthStudioTheme = getProductTheme("growth-studio");
const growthStudioName = brandIdentity.products.growthStudio;

const dashboardCards = Object.freeze([
  Object.freeze({
    title: "Offer Builder",
    description: "Draft practical offers without revenue guarantees or pressure tactics.",
    status: "Beta",
    href: "/growth-studio/offers"
  }),
  Object.freeze({
    title: "Campaign Checklist",
    description: "Create campaign records with owner-reviewed launch notes.",
    status: "Beta",
    href: "/growth-studio/campaigns"
  }),
  Object.freeze({
    title: "Customer Win-Back",
    description: "Tag customer follow-up opportunities without automated messaging.",
    status: "Requires Review",
    href: "/growth-studio/win-back"
  }),
  Object.freeze({
    title: "Review Request Flow",
    description: "Review permission, request copy, external links, and moderation steps.",
    status: "Requires Review",
    href: "/growth-studio/review-requests"
  }),
  Object.freeze({
    title: "Referral Builder",
    description: "Draft referral campaigns with disclosure and owner review.",
    status: "Requires Review",
    href: "/growth-studio/referrals"
  }),
  Object.freeze({
    title: "Local Growth Radar",
    description: "Placeholder for owner-reviewed local opportunity planning.",
    status: "Coming Soon",
    href: "/growth-studio/local-growth"
  }),
  Object.freeze({
    title: "Campaign Visuals",
    description: "Beta visual planning shell with public generation disabled.",
    status: "Admin Only",
    badge: "Beta",
    href: "/growth-studio/campaign-visuals"
  }),
  Object.freeze({
    title: "Growth Heatmap",
    description: "Placeholder for future growth planning views. No live analytics yet.",
    status: "Coming Soon",
    href: "/growth-studio/local-growth"
  })
]);

export function renderGrowthStudioDashboard() {
  const store = createGrowthStudioStore();
  const state = store.getState();
  const page = createGrowthShell({
    kicker: growthStudioName,
    title: growthStudioName,
    description:
      "Plan offers, campaigns, win-back lists, reviews, and referrals without fake metrics or automated customer contact."
  });
  page.append(renderDashboardCards(), renderSetupChecklist(state), renderGrowthSafetyNote());
  return page;
}

export function renderGrowthOffersPage() {
  const store = createGrowthStudioStore();
  const page = createGrowthShell({
    kicker: growthStudioName,
    title: "Offer Builder",
    description:
      "Draft one growth offer with clear value, proof needed, and reviewable pricing notes."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const offerName = createTextField("Offer name", "Example: first-visit package", true);
  const targetCustomer = createTextField("Target customer", "Example: lapsed customer", true);
  const valueNote = createTextareaField("Value note", "What is useful about this offer?");
  const priceNote = createTextField("Price note", "Example: quote after owner review", false);
  const proofNeeded = createTextareaField("Proof needed", "What proof should support this offer?");
  const form = createRecordForm("Save offer draft", [
    offerName,
    targetCustomer,
    valueNote,
    priceNote,
    proofNeeded
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addOffer({
      offerName: offerName.control.value,
      targetCustomer: targetCustomer.control.value,
      valueNote: valueNote.control.value,
      priceNote: priceNote.control.value,
      proofNeeded: proofNeeded.control.value
    });
    status.textContent = "Growth offer draft saved locally.";
    form.reset();
    renderOfferDrafts(list, store.getState().offers);
  });

  page.append(renderGrowthSafetyNote(), form, status, list);
  renderOfferDrafts(list, store.getState().offers);
  return page;
}

export function renderGrowthCampaignsPage() {
  const store = createGrowthStudioStore();
  const page = createGrowthShell({
    kicker: "Growth Studio",
    title: "Campaign Checklist",
    description:
      "Draft campaign records and checklist notes. This does not send messages or publish campaigns."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const campaignName = createTextField("Campaign name", "Example: spring reactivation", true);
  const audience = createTextField("Audience", "Example: recent customers, local leads", true);
  const channel = createSelectField("Channel", campaignChannelLabels);
  const offerNote = createTextareaField("Offer note", "What offer or message is being tested?");
  const checklistNote = createTextareaField("Checklist note", "What needs review before launch?");
  const form = createRecordForm("Save campaign draft", [
    campaignName,
    audience,
    channel,
    offerNote,
    checklistNote
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addCampaign({
      campaignName: campaignName.control.value,
      audience: audience.control.value,
      channel: channel.control.value as CampaignChannel,
      offerNote: offerNote.control.value,
      checklistNote: checklistNote.control.value
    });
    status.textContent = "Campaign draft saved locally.";
    form.reset();
    renderCampaignRecords(list, store.getState().campaigns);
  });

  page.append(
    renderGrowthSafetyNote(),
    createElement("a", {
      className: "secondary-action security-back-link",
      href: "/business-builder/customers/follow-up",
      textContent: "Open customer follow-up queue"
    }),
    form,
    status,
    list
  );
  renderCampaignRecords(list, store.getState().campaigns);
  return page;
}

export function renderWinBackPage() {
  const store = createGrowthStudioStore();
  const page = createGrowthShell({
    kicker: "Growth Studio",
    title: "Customer Win-Back",
    description:
      "Create owner-reviewed customer tags from records or known follow-up needs. No automatic messaging is enabled."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const customerLabel = createTextField(
    "Customer label",
    "Example: customer segment or record",
    true
  );
  const reason = createTextareaField("Reason", "Why should this customer or segment be reviewed?");
  const nextStep = createTextField("Next step", "Example: owner reviews before outreach", true);
  const consentNote = createTextareaField(
    "Consent note",
    "Confirm contact permission before any outreach."
  );
  const form = createRecordForm("Create win-back tag", [
    customerLabel,
    reason,
    nextStep,
    consentNote
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addWinBackTag({
      customerLabel: customerLabel.control.value,
      reason: reason.control.value,
      nextStep: nextStep.control.value,
      consentNote: consentNote.control.value
    });
    status.textContent = "Win-back tag saved locally.";
    form.reset();
    renderWinBackTags(list, store.getState().winBackTags);
  });

  page.append(renderGrowthSafetyNote(), form, status, list);
  renderWinBackTags(list, store.getState().winBackTags);
  return page;
}

export function renderReferralBuilderPage() {
  const store = createGrowthStudioStore();
  const page = createGrowthShell({
    kicker: "Growth Studio",
    title: "Referral Builder",
    description:
      "Draft referral campaigns with clear disclosure. This does not send invites automatically."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const campaignName = createTextField("Campaign name", "Example: neighbor referral", true);
  const rewardNote = createTextareaField("Reward note", "Describe any incentive clearly.");
  const inviteMessage = createTextareaField(
    "Invite message",
    "Draft plain-language referral copy."
  );
  const disclosureNote = createTextareaField(
    "Disclosure note",
    "How will referral incentives or limits be disclosed?"
  );
  const form = createRecordForm("Save referral draft", [
    campaignName,
    rewardNote,
    inviteMessage,
    disclosureNote
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addReferralCampaign({
      campaignName: campaignName.control.value,
      rewardNote: rewardNote.control.value,
      inviteMessage: inviteMessage.control.value,
      disclosureNote: disclosureNote.control.value
    });
    status.textContent = "Referral campaign draft saved locally.";
    form.reset();
    renderReferralDrafts(list, store.getState().referralCampaigns);
  });

  page.append(renderGrowthSafetyNote(), form, status, list);
  renderReferralDrafts(list, store.getState().referralCampaigns);
  return page;
}

export function renderReviewRequestsPage() {
  const page = createGrowthShell({
    kicker: "Growth Studio",
    title: "Review Request Flow",
    description:
      "Use this checklist before asking for reviews or showing testimonials. Nothing publishes automatically."
  });
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of reviewRequestChecklist) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: item.title }),
      createElement("p", { className: "recommendation", textContent: item.description }),
      createMetric("Required", item.required ? "Yes" : "Optional")
    );
    grid.append(card);
  }
  page.append(
    renderGrowthSafetyNote(),
    createElement("a", {
      className: "secondary-action security-back-link",
      href: "/growth-studio/reviews",
      textContent: "Open review records"
    }),
    grid
  );
  return page;
}

export function renderLocalGrowthPage() {
  const page = createGrowthShell({
    kicker: "Growth Studio",
    title: "Local Growth",
    description:
      "Placeholder planning surface for Local Growth Radar and Growth Heatmap. No live local data or analytics are enabled."
  });
  const grid = createElement("div", { className: "planning-grid" });
  for (const card of [
    {
      title: "Local Growth Radar",
      description: "Coming next: owner-reviewed local opportunity notes.",
      status: "Coming Soon"
    },
    {
      title: "Growth Heatmap",
      description: "Coming next: planning map for reviewed growth priorities.",
      status: "No live data yet"
    }
  ]) {
    const article = createElement("article", { className: "planning-card shell-card" });
    article.append(
      createElement("h2", { textContent: card.title }),
      createElement("p", { className: "recommendation", textContent: card.description }),
      createMetric("Status", card.status)
    );
    grid.append(article);
  }
  page.append(renderGrowthSafetyNote(), grid);
  return page;
}

function createGrowthShell({
  kicker,
  title,
  description
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  const page = createElement("section", {
    className: `work-screen sonara-shell record-page ${growthStudioTheme.themeClassName}`
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

function renderSetupChecklist(state: GrowthStudioState) {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of createGrowthSetupChecklist(state)) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: item.title }),
      createMetric("Status", item.isComplete ? "Started" : "Set this up"),
      createElement("a", { className: "secondary-action", href: item.route, textContent: "Open" })
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Setup Checklist" }), grid);
  return section;
}

function renderGrowthSafetyNote() {
  return createElement("p", {
    className: "warning-copy",
    textContent:
      "Growth Studio drafts are owner-reviewed setup records. No guaranteed results, hidden tracking, fake reviews, or automatic customer outreach are enabled."
  });
}

function renderCampaignRecords(container: HTMLElement, records: readonly GrowthCampaignRecord[]) {
  renderRecordList(container, records, "No campaign drafts yet.", (record) => ({
    title: record.campaign_name || "Untitled campaign",
    description: record.offer_note || "No offer note added.",
    metrics: [
      ["Audience", record.audience || "Not added"],
      ["Channel", campaignChannelLabels[record.channel]],
      ["Checklist", record.checklist_note || "Owner review required"]
    ]
  }));
}

function renderOfferDrafts(container: HTMLElement, records: readonly GrowthOfferDraft[]) {
  renderRecordList(container, records, "No offer drafts yet.", (record) => ({
    title: record.offer_name || "Untitled offer",
    description: record.value_note || "No value note added.",
    metrics: [
      ["Customer", record.target_customer || "Not added"],
      ["Price note", record.price_note || "Not added"],
      ["Proof needed", record.proof_needed || "Owner review required"]
    ]
  }));
}

function renderWinBackTags(container: HTMLElement, records: readonly WinBackCustomerTag[]) {
  renderRecordList(container, records, "No win-back tags yet.", (record) => ({
    title: record.customer_label || "Untitled customer tag",
    description: record.reason || "No reason added.",
    metrics: [
      ["Next step", record.next_step || "Owner review required"],
      ["Consent", record.consent_note || "Not added"],
      ["Automation", "Not enabled"]
    ]
  }));
}

function renderReferralDrafts(container: HTMLElement, records: readonly ReferralCampaignDraft[]) {
  renderRecordList(container, records, "No referral campaign drafts yet.", (record) => ({
    title: record.campaign_name || "Untitled referral campaign",
    description: record.invite_message || "No invite message added.",
    metrics: [
      ["Reward note", record.reward_note || "Not added"],
      ["Disclosure", record.disclosure_note || "Owner review required"],
      ["Status", record.status]
    ]
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
  const id = `growth-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const wrapper = createElement("label", { className: "record-field" });
  wrapper.htmlFor = id;
  control.id = id;
  wrapper.append(createElement("span", { textContent: label }), control);
  return { wrapper, control };
}
