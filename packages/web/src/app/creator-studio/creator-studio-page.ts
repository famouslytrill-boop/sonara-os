import { brandIdentity, getProductTheme } from "@signal-os/ui";
import { clearElement, createElement, createMetric } from "../../dom.ts";
import {
  createCreatorSetupChecklist,
  createCreatorStudioStore,
  creatorAssetTypeLabels,
  creatorReleaseChecklist,
  rightsReviewLabels,
  type CreatorAssetRecord,
  type CreatorAssetType,
  type CreatorProofCardDraft,
  type CreatorServiceOfferDraft,
  type CreatorStudioState,
  type ProjectRoomRecord,
  type RightsReviewLabel
} from "../../lib/creator-studio/index.ts";

type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const creatorStudioTheme = getProductTheme("creator-studio");
const creatorStudioName = brandIdentity.products.creatorStudio;

const dashboardCards = Object.freeze([
  Object.freeze({
    title: "Creator Proof Card",
    description: "Draft public creator identity, focus, proof points, and contact action.",
    status: "Beta",
    href: "/creator-studio/proof-card"
  }),
  Object.freeze({
    title: "Asset Vault",
    description: "Create asset records with source and usage notes before release planning.",
    status: "Requires Review",
    href: "/creator-studio/asset-vault"
  }),
  Object.freeze({
    title: "Project Rooms",
    description: "Prepare client/project workspaces without private file sharing yet.",
    status: "Beta",
    href: "/creator-studio/project-rooms"
  }),
  Object.freeze({
    title: "Release Checklist",
    description: "Review release readiness items before publishing or sending work.",
    status: "Beta",
    href: "/creator-studio/release-checklist"
  }),
  Object.freeze({
    title: "Creator Service Offer",
    description: "Draft deliverables, turnaround notes, and rights-safe terms.",
    status: "Beta",
    href: "/creator-studio/service-offers"
  }),
  Object.freeze({
    title: "Payment & Booking Links",
    description: "Use provider-hosted payment links and owner-reviewed booking setup.",
    status: "Requires Review",
    href: "/creator-studio/payment-booking"
  }),
  Object.freeze({
    title: "Campaign Assets",
    description: "Placeholder for reviewed campaign creative records.",
    status: "Coming Soon",
    badge: "Admin Only"
  }),
  Object.freeze({
    title: "Video Review",
    description: "Beta source, consent, and release-readiness review shell.",
    status: "Admin Only",
    badge: "Beta",
    href: "/creator-studio/video-review"
  }),
  Object.freeze({
    title: "Voice Studio",
    description: "Beta voice review shell. Cloning and impersonation are disabled.",
    status: "Admin Only",
    badge: "Beta",
    href: "/creator-studio/voice-studio"
  }),
  Object.freeze({
    title: "Visual Studio",
    description: "Beta visual review shell. Public generation is disabled.",
    status: "Admin Only",
    badge: "Beta",
    href: "/creator-studio/visual-studio"
  })
]);

export function renderCreatorStudioDashboard() {
  const store = createCreatorStudioStore();
  const state = store.getState();
  const page = createCreatorShell({
    kicker: creatorStudioName,
    title: creatorStudioName,
    description:
      "Prepare proof, assets, projects, service offers, payment and booking links, and release checks without fake rights claims."
  });
  page.append(renderDashboardCards(), renderSetupChecklist(state), renderRightsNote());
  return page;
}

export function renderCreatorProofCardPage() {
  const store = createCreatorStudioStore();
  const page = createCreatorShell({
    kicker: creatorStudioName,
    title: "Creator Proof Card",
    description:
      "Draft a creator proof card. This does not publish automatically or claim verification."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const displayName = createTextField("Display name", "Example: artist or studio name", true);
  const bio = createTextareaField("Short bio", "What do you create or offer?");
  const focus = createTextField("Focus area", "Example: production, design, editing", true);
  const proof = createTextareaField("Proof points", "Use truthful, reviewable proof only.");
  const action = createTextField("Contact action", "Example: Book a session", true);
  const rights = createTextareaField(
    "Rights note",
    "Add rights/provenance limitations or review notes."
  );
  const form = createRecordForm("Save Proof Card draft", [
    displayName,
    bio,
    focus,
    proof,
    action,
    rights
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addProofCard({
      displayName: displayName.control.value,
      shortBio: bio.control.value,
      focusArea: focus.control.value,
      proofPoints: proof.control.value,
      contactAction: action.control.value,
      rightsNote: rights.control.value
    });
    status.textContent = "Creator Proof Card draft saved locally.";
    form.reset();
    renderProofCards(list, store.getState().proofCards);
  });

  page.append(renderRightsNote(), form, status, list);
  renderProofCards(list, store.getState().proofCards);
  return page;
}

export function renderAssetVaultPage() {
  const store = createCreatorStudioStore();
  const page = createCreatorShell({
    kicker: "Creator Studio",
    title: "Asset Vault",
    description:
      "Create asset records with source and usage notes. Records do not certify ownership or license status."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const title = createTextField(
    "Asset title",
    "Example: cover draft, audio stem, campaign image",
    true
  );
  const assetType = createSelectField("Asset type", creatorAssetTypeLabels);
  const source = createTextareaField("Source note", "Where did the asset come from?");
  const usage = createTextareaField("Usage note", "What usage is believed to be allowed?");
  const form = createRecordForm("Create asset record", [title, assetType, source, usage]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addAssetRecord({
      title: title.control.value,
      assetType: assetType.control.value as CreatorAssetType,
      sourceNote: source.control.value,
      usageNote: usage.control.value
    });
    status.textContent = "Asset record saved with rights review labels.";
    form.reset();
    renderAssetRecords(list, store.getState().assetRecords);
  });

  page.append(renderRightsNote(), form, status, list);
  renderAssetRecords(list, store.getState().assetRecords);
  return page;
}

export function renderProjectRoomsPage() {
  const store = createCreatorStudioStore();
  const page = createCreatorShell({
    kicker: "Creator Studio",
    title: "Project Rooms",
    description:
      "Create lightweight project room records for scope and next steps. No private file sharing is enabled."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const project = createTextField("Project name", "Example: launch graphics package", true);
  const client = createTextField("Client label", "Example: client, collaborator, internal", false);
  const scope = createTextareaField("Scope note", "What is included in this project?");
  const nextStep = createTextField(
    "Next step",
    "Example: send intake, collect deposit, review assets",
    true
  );
  const form = createRecordForm("Create project room", [project, client, scope, nextStep]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addProjectRoom({
      projectName: project.control.value,
      clientLabel: client.control.value,
      scopeNote: scope.control.value,
      nextStep: nextStep.control.value
    });
    status.textContent = "Project room record saved locally.";
    form.reset();
    renderProjectRooms(list, store.getState().projectRooms);
  });

  page.append(renderRightsNote(), form, status, list);
  renderProjectRooms(list, store.getState().projectRooms);
  return page;
}

export function renderReleaseChecklistPage() {
  const page = createCreatorShell({
    kicker: "Creator Studio",
    title: "Release Checklist",
    description:
      "Review creator release readiness. This checklist is informational until real publishing and storage workflows exist."
  });
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of creatorReleaseChecklist) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: item.title }),
      createElement("p", { className: "recommendation", textContent: item.description }),
      createMetric("Required", item.required ? "Yes" : "Optional")
    );
    grid.append(card);
  }
  page.append(renderRightsNote(), grid);
  return page;
}

export function renderServiceOffersPage() {
  const store = createCreatorStudioStore();
  const page = createCreatorShell({
    kicker: "Creator Studio",
    title: "Creator Service Offer",
    description:
      "Draft creator service offers with deliverables, turnaround notes, and rights-safe terms."
  });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const offer = createTextField("Offer name", "Example: single cover package", true);
  const deliverables = createTextareaField("Deliverables", "What is included?");
  const turnaround = createTextField(
    "Turnaround note",
    "Example: timeline after intake review",
    false
  );
  const price = createTextField("Price note", "Example: quote after review", false);
  const rights = createTextareaField(
    "Rights note",
    "Clarify usage review or ownership limitations."
  );
  const form = createRecordForm("Save service offer draft", [
    offer,
    deliverables,
    turnaround,
    price,
    rights
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addServiceOffer({
      offerName: offer.control.value,
      deliverables: deliverables.control.value,
      turnaroundNote: turnaround.control.value,
      priceNote: price.control.value,
      rightsNote: rights.control.value
    });
    status.textContent = "Creator service offer draft saved locally.";
    form.reset();
    renderServiceOffers(list, store.getState().serviceOffers);
  });

  page.append(renderRightsNote(), form, status, list);
  renderServiceOffers(list, store.getState().serviceOffers);
  return page;
}

function createCreatorShell({
  kicker,
  title,
  description
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  const page = createElement("section", {
    className: `work-screen sonara-shell record-page ${creatorStudioTheme.themeClassName}`
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
      createMetric("Status", card.status)
    );
    if ("badge" in card && card.badge) {
      article.append(createElement("span", { className: "status-badge", textContent: card.badge }));
    }
    if ("href" in card && card.href) {
      article.append(
        createElement("a", { className: "secondary-action", href: card.href, textContent: "Open" })
      );
    }
    grid.append(article);
  }
  return grid;
}

function renderSetupChecklist(state: CreatorStudioState) {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of createCreatorSetupChecklist(state)) {
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

function renderRightsNote() {
  return createElement("p", {
    className: "warning-copy",
    textContent:
      "Rights and licensing labels are review warnings only. SONARA One does not certify ownership, clearance, or release eligibility in this MVP."
  });
}

function renderProofCards(container: HTMLElement, records: readonly CreatorProofCardDraft[]) {
  renderRecordList(container, records, "No Creator Proof Card drafts yet.", (record) => ({
    title: record.display_name || "Untitled proof card",
    description: record.short_bio || "No bio added.",
    metrics: [
      ["Focus", record.focus_area || "Not added"],
      ["Proof points", record.proof_points || "Not added"],
      ["Rights note", record.rights_note || "Review required"]
    ],
    labels: []
  }));
}

function renderAssetRecords(container: HTMLElement, records: readonly CreatorAssetRecord[]) {
  renderRecordList(container, records, "No asset records yet.", (record) => ({
    title: record.title || "Untitled asset",
    description: record.source_note || "No source note added.",
    metrics: [
      ["Asset type", creatorAssetTypeLabels[record.asset_type]],
      ["Usage note", record.usage_note || "Not added"],
      ["Status", record.status]
    ],
    labels: record.rights_labels
  }));
}

function renderProjectRooms(container: HTMLElement, records: readonly ProjectRoomRecord[]) {
  renderRecordList(container, records, "No project room records yet.", (record) => ({
    title: record.project_name || "Untitled project",
    description: record.scope_note || "No scope note added.",
    metrics: [
      ["Client", record.client_label || "Not added"],
      ["Next step", record.next_step || "Not added"],
      ["Status", record.status]
    ],
    labels: []
  }));
}

function renderServiceOffers(container: HTMLElement, records: readonly CreatorServiceOfferDraft[]) {
  renderRecordList(container, records, "No service offer drafts yet.", (record) => ({
    title: record.offer_name || "Untitled offer",
    description: record.deliverables || "No deliverables added.",
    metrics: [
      ["Turnaround", record.turnaround_note || "Not added"],
      ["Price note", record.price_note || "Not added"],
      ["Rights note", record.rights_note || "Review required"]
    ],
    labels: ["license_review_required"]
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
    labels: readonly RightsReviewLabel[];
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
    if (cardData.labels.length > 0) {
      card.append(renderRightsLabels(cardData.labels));
    }
    container.append(card);
  }
}

function renderRightsLabels(labels: readonly RightsReviewLabel[]) {
  const wrapper = createElement("div", { className: "trust-warning-list" });
  for (const label of labels) {
    wrapper.append(
      createElement("span", {
        className: "trust-warning",
        textContent: rightsReviewLabels[label]
      })
    );
  }
  return wrapper;
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
  const id = `creator-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const wrapper = createElement("label", { className: "record-field" });
  wrapper.htmlFor = id;
  control.id = id;
  wrapper.append(createElement("span", { textContent: label }), control);
  return { wrapper, control };
}
