export type MoneyProductArea = "business_builder" | "creator_studio" | "growth_studio";

export type PaymentProvider = "stripe" | "paypal" | "square" | "manual";
export type BookingLinkType = "external_booking_url" | "call_to_book" | "request_appointment";
export type ReviewRecordType =
  | "review_request_link"
  | "review_source_record"
  | "testimonial_record";
export type VerificationStatus = "unverified" | "reviewed";
export type LinkTrustWarning =
  | "unverified_link"
  | "suspicious_payment_url"
  | "missing_provider_label";

export type MoneyAdjacentStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type PaymentOptionRecord = Readonly<{
  id: string;
  organization_id: string;
  product_area: MoneyProductArea;
  provider: PaymentProvider;
  provider_label: string;
  external_url: string;
  verification_status: VerificationStatus;
  warnings: readonly LinkTrustWarning[];
  created_at: string;
}>;

export type BookingLinkRecord = Readonly<{
  id: string;
  organization_id: string;
  product_area: MoneyProductArea;
  booking_type: BookingLinkType;
  label: string;
  external_url: string;
  call_to_book: string;
  verification_status: VerificationStatus;
  warnings: readonly LinkTrustWarning[];
  created_at: string;
}>;

export type ReviewTrustRecord = Readonly<{
  id: string;
  organization_id: string;
  product_area: MoneyProductArea;
  record_type: ReviewRecordType;
  label: string;
  source_name: string;
  external_url: string;
  testimonial: string;
  moderation_status: "draft" | "review_needed" | "approved";
  verification_status: VerificationStatus;
  warnings: readonly LinkTrustWarning[];
  created_at: string;
}>;

export type MoneyAdjacentState = Readonly<{
  paymentOptions: readonly PaymentOptionRecord[];
  bookingLinks: readonly BookingLinkRecord[];
  reviewRecords: readonly ReviewTrustRecord[];
}>;

export type PaymentOptionInput = Readonly<{
  productArea: MoneyProductArea;
  provider: PaymentProvider;
  providerLabel: string;
  externalUrl: string;
}>;

export type BookingLinkInput = Readonly<{
  productArea: MoneyProductArea;
  bookingType: BookingLinkType;
  label: string;
  externalUrl: string;
  callToBook: string;
}>;

export type ReviewTrustInput = Readonly<{
  productArea: MoneyProductArea;
  recordType: ReviewRecordType;
  label: string;
  sourceName: string;
  externalUrl: string;
  testimonial: string;
}>;

const storageKey = "sonara-money-adjacent-records";
const localOrganizationId = "local_setup_organization";

export const paymentProviderLabels: Record<PaymentProvider, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  square: "Square",
  manual: "Manual URL"
};

export const bookingTypeLabels: Record<BookingLinkType, string> = {
  external_booking_url: "External booking URL",
  call_to_book: "Call-to-book",
  request_appointment: "Request appointment"
};

export const reviewRecordLabels: Record<ReviewRecordType, string> = {
  review_request_link: "Review request link",
  review_source_record: "Review source record",
  testimonial_record: "Testimonial record"
};

export const trustWarningLabels: Record<LinkTrustWarning, string> = {
  unverified_link: "Unverified link",
  suspicious_payment_url: "Suspicious payment URL",
  missing_provider_label: "Missing provider label"
};

export const initialMoneyAdjacentState: MoneyAdjacentState = Object.freeze({
  paymentOptions: Object.freeze([]),
  bookingLinks: Object.freeze([]),
  reviewRecords: Object.freeze([])
});

export function createMoneyAdjacentStore(
  storage: MoneyAdjacentStorageLike | null = getBrowserStorage()
) {
  let state = readStoredState(storage);

  function getState() {
    return state;
  }

  function addPaymentOption(input: PaymentOptionInput) {
    const record = createPaymentOptionRecord(input);
    state = Object.freeze({
      ...state,
      paymentOptions: Object.freeze([...state.paymentOptions, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addBookingLink(input: BookingLinkInput) {
    const record = createBookingLinkRecord(input);
    state = Object.freeze({
      ...state,
      bookingLinks: Object.freeze([...state.bookingLinks, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addReviewRecord(input: ReviewTrustInput) {
    const record = createReviewTrustRecord(input);
    state = Object.freeze({
      ...state,
      reviewRecords: Object.freeze([...state.reviewRecords, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function clear() {
    state = initialMoneyAdjacentState;
    storage?.removeItem(storageKey);
  }

  return Object.freeze({
    getState,
    addPaymentOption,
    addBookingLink,
    addReviewRecord,
    clear
  });
}

export function createPaymentOptionRecord(
  input: PaymentOptionInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("payment")
): PaymentOptionRecord {
  const warnings = createPaymentWarnings(input.provider, input.providerLabel, input.externalUrl);
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    product_area: input.productArea,
    provider: input.provider,
    provider_label: input.providerLabel.trim(),
    external_url: normalizeHttpUrl(input.externalUrl),
    verification_status: "unverified",
    warnings: Object.freeze(warnings),
    created_at: createdAt
  });
}

export function createBookingLinkRecord(
  input: BookingLinkInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("booking")
): BookingLinkRecord {
  const warnings =
    input.bookingType === "external_booking_url"
      ? createLinkWarnings(input.label, input.externalUrl)
      : createLabelWarnings(input.label);
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    product_area: input.productArea,
    booking_type: input.bookingType,
    label: input.label.trim(),
    external_url: normalizeHttpUrl(input.externalUrl),
    call_to_book: input.callToBook.trim(),
    verification_status: "unverified",
    warnings: Object.freeze(warnings),
    created_at: createdAt
  });
}

export function createReviewTrustRecord(
  input: ReviewTrustInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("review")
): ReviewTrustRecord {
  const warnings = createReviewWarnings(input);
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    product_area: input.productArea,
    record_type: input.recordType,
    label: input.label.trim(),
    source_name: input.sourceName.trim(),
    external_url: normalizeHttpUrl(input.externalUrl),
    testimonial: input.testimonial.trim(),
    moderation_status: "review_needed",
    verification_status: "unverified",
    warnings: Object.freeze(warnings),
    created_at: createdAt
  });
}

export function createReviewWarnings(input: ReviewTrustInput): readonly LinkTrustWarning[] {
  if (input.recordType === "testimonial_record" && !input.externalUrl.trim()) {
    return createLabelWarnings(input.label || input.sourceName);
  }
  return createLinkWarnings(input.label || input.sourceName, input.externalUrl);
}

export function createPaymentWarnings(
  provider: PaymentProvider,
  providerLabel: string,
  externalUrl: string
): readonly LinkTrustWarning[] {
  const warnings = new Set<LinkTrustWarning>(createLinkWarnings(providerLabel, externalUrl));
  if (provider !== "manual" && !matchesProviderHost(provider, externalUrl)) {
    warnings.add("suspicious_payment_url");
  }
  return Object.freeze([...warnings]);
}

export function createLinkWarnings(
  label: string,
  externalUrl: string
): readonly LinkTrustWarning[] {
  const warnings: LinkTrustWarning[] = [];
  if (!label.trim()) {
    warnings.push("missing_provider_label");
  }
  if (!isSafeHttpUrl(externalUrl)) {
    warnings.push("suspicious_payment_url");
  } else {
    warnings.push("unverified_link");
  }
  return Object.freeze(warnings);
}

export function createLabelWarnings(label: string): readonly LinkTrustWarning[] {
  return Object.freeze(label.trim() ? [] : ["missing_provider_label"]);
}

export function isSafeHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeHttpUrl(value: string): string {
  return isSafeHttpUrl(value) ? new URL(value.trim()).toString() : value.trim();
}

export function hasPaymentCredentialFields(record: PaymentOptionRecord): boolean {
  const keys = Object.keys(record);
  return keys.some((key) =>
    ["card", "cvv", "bank_account", "secret", "token"].some((blocked) =>
      key.toLowerCase().includes(blocked)
    )
  );
}

function matchesProviderHost(provider: PaymentProvider, externalUrl: string): boolean {
  if (provider === "manual" || !isSafeHttpUrl(externalUrl)) {
    return provider === "manual";
  }
  const hostname = new URL(externalUrl.trim()).hostname.toLowerCase();
  const allowedHosts: Record<Exclude<PaymentProvider, "manual">, readonly string[]> = {
    stripe: ["stripe.com"],
    paypal: ["paypal.com", "paypal.me"],
    square: ["squareup.com", "square.link", "square.site"]
  };
  return allowedHosts[provider].some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function readStoredState(storage: MoneyAdjacentStorageLike | null): MoneyAdjacentState {
  const raw = storage?.getItem(storageKey);
  if (!raw) {
    return initialMoneyAdjacentState;
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    storage?.removeItem(storageKey);
    return initialMoneyAdjacentState;
  }
}

function normalizeState(value: unknown): MoneyAdjacentState {
  if (!value || typeof value !== "object") {
    return initialMoneyAdjacentState;
  }
  const candidate = value as Partial<MoneyAdjacentState>;
  return Object.freeze({
    paymentOptions: Object.freeze(
      Array.isArray(candidate.paymentOptions) ? candidate.paymentOptions : []
    ),
    bookingLinks: Object.freeze(
      Array.isArray(candidate.bookingLinks) ? candidate.bookingLinks : []
    ),
    reviewRecords: Object.freeze(
      Array.isArray(candidate.reviewRecords) ? candidate.reviewRecords : []
    )
  });
}

function writeStoredState(storage: MoneyAdjacentStorageLike | null, state: MoneyAdjacentState) {
  storage?.setItem(storageKey, JSON.stringify(state));
}

function getBrowserStorage(): MoneyAdjacentStorageLike | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  if (
    typeof localStorage.getItem !== "function" ||
    typeof localStorage.setItem !== "function" ||
    typeof localStorage.removeItem !== "function"
  ) {
    return null;
  }
  return localStorage;
}

function createRecordId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}
