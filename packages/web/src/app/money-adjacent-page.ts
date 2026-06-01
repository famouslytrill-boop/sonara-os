import { clearElement, createElement, createMetric } from "../dom.ts";
import {
  createBusinessBuilderStore,
  createBusinessJourneyOverview,
  type BusinessJourneyWarning
} from "../lib/business-builder/index.ts";
import {
  bookingTypeLabels,
  createMoneyAdjacentStore,
  paymentProviderLabels,
  reviewRecordLabels,
  trustWarningLabels,
  type BookingLinkRecord,
  type BookingLinkType,
  type MoneyProductArea,
  type PaymentOptionRecord,
  type PaymentProvider,
  type ReviewRecordType,
  type ReviewTrustRecord
} from "../lib/money-adjacent/index.ts";

type MoneyAdjacentPageConfig = Readonly<{
  kicker: string;
  title: string;
  description: string;
  productArea: MoneyProductArea;
  sections: readonly ("payments" | "bookings" | "reviews")[];
}>;

type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function renderMoneyAdjacentPage(config: MoneyAdjacentPageConfig) {
  const store = createMoneyAdjacentStore();
  const page = createElement("section", { className: "work-screen sonara-shell record-page" });
  const businessJourneyPanel = createElement("div", { className: "record-section" });
  const updateBusinessJourneyPanel = () => {
    if (config.productArea !== "business_builder") {
      return;
    }
    clearElement(businessJourneyPanel);
    businessJourneyPanel.append(renderBusinessJourneyPanel(store));
  };
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: config.kicker }),
    createElement("h1", { textContent: config.title }),
    createElement("p", { className: "screen-copy", textContent: config.description }),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "MVP setup stores local records only. Payment providers handle sensitive payment data; SONARA One does not collect card numbers, CVV, bank credentials, provider secrets, or tokens."
    })
  );
  page.append(header);
  if (config.productArea === "business_builder") {
    updateBusinessJourneyPanel();
    page.append(businessJourneyPanel);
  }

  if (config.sections.includes("payments")) {
    page.append(renderPaymentOptionsSection(store, config.productArea, updateBusinessJourneyPanel));
  }
  if (config.sections.includes("bookings")) {
    page.append(renderBookingLinksSection(store, config.productArea, updateBusinessJourneyPanel));
  }
  if (config.sections.includes("reviews")) {
    page.append(renderReviewRecordsSection(store, config.productArea, updateBusinessJourneyPanel));
  }
  return page;
}

function renderPaymentOptionsSection(
  store: ReturnType<typeof createMoneyAdjacentStore>,
  productArea: MoneyProductArea,
  onChange?: () => void
) {
  const section = createElement("section", { className: "record-section" });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const provider = createSelectField("Provider", paymentProviderLabels);
  const label = createTextField("Provider label", "Example: checkout link for deposits", true);
  const url = createTextField("External payment URL", "https://provider.example/pay", true);
  const form = createRecordForm("Create payment option record", [provider, label, url]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addPaymentOption({
      productArea,
      provider: provider.control.value as PaymentProvider,
      providerLabel: label.control.value,
      externalUrl: url.control.value
    });
    status.textContent = "Payment option saved as a local setup record.";
    form.reset();
    renderPaymentOptionList(list, store.getState().paymentOptions, productArea);
    onChange?.();
  });

  section.append(
    createElement("h2", { textContent: "Payment Options" }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "Create external payment link records first. Use provider-hosted checkout or reviewed manual URLs."
    }),
    form,
    status,
    list
  );
  renderPaymentOptionList(list, store.getState().paymentOptions, productArea);
  return section;
}

function renderBookingLinksSection(
  store: ReturnType<typeof createMoneyAdjacentStore>,
  productArea: MoneyProductArea,
  onChange?: () => void
) {
  const section = createElement("section", { className: "record-section" });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const bookingType = createSelectField("Booking type", bookingTypeLabels);
  const label = createTextField("Booking label", "Example: consultation request", true);
  const url = createTextField("External booking URL", "https://booking.example/calendar", false);
  const phone = createTextField("Call-to-book phone", "Example: 555-0100", false);
  const form = createRecordForm("Create booking record", [bookingType, label, url, phone]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addBookingLink({
      productArea,
      bookingType: bookingType.control.value as BookingLinkType,
      label: label.control.value,
      externalUrl: url.control.value,
      callToBook: phone.control.value
    });
    status.textContent = "Booking option saved as a local setup record.";
    form.reset();
    renderBookingLinkList(list, store.getState().bookingLinks, productArea);
    onChange?.();
  });

  section.append(
    createElement("h2", { textContent: "Booking & Appointments" }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "Create booking links or request records. Appointment confirmation remains owner-reviewed."
    }),
    form,
    status,
    list
  );
  renderBookingLinkList(list, store.getState().bookingLinks, productArea);
  return section;
}

function renderReviewRecordsSection(
  store: ReturnType<typeof createMoneyAdjacentStore>,
  productArea: MoneyProductArea,
  onChange?: () => void
) {
  const section = createElement("section", { className: "record-section" });
  const status = createElement("p", { className: "status-copy" });
  const list = createElement("div", { className: "planning-grid" });
  const recordType = createSelectField("Review record type", reviewRecordLabels);
  const label = createTextField("Display label", "Example: Google review request", true);
  const source = createTextField("Review source", "Example: Google Business Profile", false);
  const url = createTextField("External review URL", "https://reviews.example/profile", false);
  const testimonial = createTextareaField(
    "Testimonial draft",
    "Add customer-approved testimonial text only."
  );
  const form = createRecordForm("Create review record", [
    recordType,
    label,
    source,
    url,
    testimonial
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addReviewRecord({
      productArea,
      recordType: recordType.control.value as ReviewRecordType,
      label: label.control.value,
      sourceName: source.control.value,
      externalUrl: url.control.value,
      testimonial: testimonial.control.value
    });
    status.textContent = "Review or testimonial record saved for moderation.";
    form.reset();
    renderReviewRecordList(list, store.getState().reviewRecords, productArea);
    onChange?.();
  });

  section.append(
    createElement("h2", { textContent: "Reviews & Testimonials" }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "Store review request links, source records, or testimonial drafts. Nothing publishes automatically."
    }),
    form,
    status,
    list
  );
  renderReviewRecordList(list, store.getState().reviewRecords, productArea);
  return section;
}

function renderBusinessJourneyPanel(store: ReturnType<typeof createMoneyAdjacentStore>) {
  const businessStore = createBusinessBuilderStore();
  const overview = createBusinessJourneyOverview(businessStore.getState(), store.getState());
  const section = createElement("section", { className: "record-section" });
  section.append(
    createElement("h2", { textContent: "Business Builder Flow" }),
    createMetric("Progress", overview.progressLabel),
    renderBusinessNextAction(overview.nextAction),
    renderBusinessWarnings(overview.warnings)
  );
  return section;
}

function renderBusinessNextAction(action: {
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
    createElement("h3", { textContent: "Next best action" }),
    createElement("p", { className: "recommendation", textContent: action.title }),
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

function renderBusinessWarnings(warnings: readonly BusinessJourneyWarning[]) {
  const grid = createElement("div", { className: "planning-grid" });
  for (const warning of warnings.slice(0, 4)) {
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
  return grid;
}

function renderPaymentOptionList(
  container: HTMLElement,
  records: readonly PaymentOptionRecord[],
  productArea: MoneyProductArea
) {
  clearElement(container);
  const scoped = records.filter((record) => record.product_area === productArea);
  if (scoped.length === 0) {
    container.append(
      renderEmptyState(
        "No payment option records yet. Add a provider-hosted payment link or reviewed manual URL."
      )
    );
    return;
  }
  for (const record of scoped) {
    container.append(
      renderRecordCard({
        title: record.provider_label || paymentProviderLabels[record.provider],
        description: record.external_url || "No URL saved.",
        metrics: [
          ["Provider", paymentProviderLabels[record.provider]],
          ["Status", record.verification_status],
          ["Created", record.created_at]
        ],
        warnings: record.warnings
      })
    );
  }
}

function renderBookingLinkList(
  container: HTMLElement,
  records: readonly BookingLinkRecord[],
  productArea: MoneyProductArea
) {
  clearElement(container);
  const scoped = records.filter((record) => record.product_area === productArea);
  if (scoped.length === 0) {
    container.append(
      renderEmptyState(
        "No booking records yet. Add an external booking URL, call-to-book option, or appointment request path."
      )
    );
    return;
  }
  for (const record of scoped) {
    container.append(
      renderRecordCard({
        title: record.label || bookingTypeLabels[record.booking_type],
        description: record.external_url || record.call_to_book || "Request appointment setup.",
        metrics: [
          ["Type", bookingTypeLabels[record.booking_type]],
          ["Status", record.verification_status],
          ["Created", record.created_at]
        ],
        warnings: record.warnings
      })
    );
  }
}

function renderReviewRecordList(
  container: HTMLElement,
  records: readonly ReviewTrustRecord[],
  productArea: MoneyProductArea
) {
  clearElement(container);
  const scoped = records.filter((record) => record.product_area === productArea);
  if (scoped.length === 0) {
    container.append(
      renderEmptyState(
        "No review or testimonial records yet. Add a review request link or customer-approved testimonial draft."
      )
    );
    return;
  }
  for (const record of scoped) {
    container.append(
      renderRecordCard({
        title: record.label || reviewRecordLabels[record.record_type],
        description: record.testimonial || record.external_url || "Review setup record.",
        metrics: [
          ["Type", reviewRecordLabels[record.record_type]],
          ["Moderation", record.moderation_status],
          ["Created", record.created_at]
        ],
        warnings: record.warnings
      })
    );
  }
}

function renderRecordCard({
  title,
  description,
  metrics,
  warnings
}: {
  title: string;
  description: string;
  metrics: readonly (readonly [string, string])[];
  warnings: readonly string[];
}) {
  const card = createElement("article", { className: "planning-card shell-card record-card" });
  card.append(
    createElement("h3", { textContent: title }),
    createElement("p", { className: "recommendation", textContent: description })
  );
  for (const [label, value] of metrics) {
    card.append(createMetric(label, value));
  }
  if (warnings.length > 0) {
    const warningList = createElement("div", { className: "trust-warning-list" });
    for (const warning of warnings) {
      warningList.append(
        createElement("span", {
          className: "trust-warning",
          textContent: trustWarningLabels[warning as keyof typeof trustWarningLabels] ?? warning
        })
      );
    }
    card.append(warningList);
  }
  return card;
}

function renderEmptyState(message: string) {
  const card = createElement("article", {
    className: "planning-card shell-card empty-record-card"
  });
  card.append(
    createElement("h3", { textContent: "Empty state" }),
    createElement("p", { className: "recommendation", textContent: message }),
    createMetric("Status", "Set this up")
  );
  return card;
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
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const wrapper = createElement("label", { className: "record-field" });
  const labelText = createElement("span", { textContent: label });
  control.id = id;
  wrapper.htmlFor = id;
  wrapper.append(labelText, control);
  return { wrapper, control };
}
