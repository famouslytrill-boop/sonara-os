import {
  evaluateAutomationAction,
  type ApprovalLevel,
  type AutomationRiskLabel
} from "@signal-os/autopilot";

export type BusinessBuilderStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type BusinessBuilderRecordStatus = "draft" | "setup";
export type CustomerStatus = "lead" | "active" | "needs_follow_up" | "inactive" | "archived";
export type CustomerSource =
  | "manual"
  | "booking"
  | "intake"
  | "payment"
  | "review"
  | "referral"
  | "other";
export type CustomerConsentStatus = "unknown" | "opted_in" | "opted_out";
export type CustomerCommunicationPreference = "email" | "phone" | "sms" | "none";
export type FollowUpDraftType =
  | "draft_follow_up"
  | "booking_reminder"
  | "review_request_draft"
  | "win_back_draft";
export type FollowUpDraftStatus =
  | "draft_queued"
  | "owner_review_required"
  | "permission_required"
  | "blocked_opt_out";
export type MoneyPathEventType =
  | "payment_option_planned"
  | "invoice_link_prepared"
  | "deposit_request_planned"
  | "manual_payment_note";

export type ProofPassportDraft = Readonly<{
  id: string;
  organization_id: string;
  business_name: string;
  short_description: string;
  services: string;
  proof_points: string;
  contact_action: string;
  contact_url: string;
  status: BusinessBuilderRecordStatus;
  created_at: string;
}>;

export type OfferDraft = Readonly<{
  id: string;
  organization_id: string;
  offer_name: string;
  customer_problem: string;
  deliverables: string;
  price_note: string;
  next_step: string;
  status: BusinessBuilderRecordStatus;
  created_at: string;
}>;

export type CustomerRecordDraft = Readonly<{
  id: string;
  organization_id: string;
  customer_name: string;
  email: string;
  phone: string;
  source: CustomerSource;
  customer_status: CustomerStatus;
  tags: readonly string[];
  notes: string;
  last_contacted_at: string;
  next_follow_up_at: string;
  consent_status: CustomerConsentStatus;
  communication_preference: CustomerCommunicationPreference;
  permission_note: string;
  status: BusinessBuilderRecordStatus;
  created_at: string;
}>;

export type CustomerFollowUpDraft = Readonly<{
  id: string;
  organization_id: string;
  customer_id: string;
  customer_name: string;
  follow_up_type: FollowUpDraftType;
  subject: string;
  message_body: string;
  status: FollowUpDraftStatus;
  approval_level: ApprovalLevel;
  risk: AutomationRiskLabel;
  safety_note: string;
  created_at: string;
}>;

export type MoneyPathEvent = Readonly<{
  id: string;
  organization_id: string;
  event_type: MoneyPathEventType;
  label: string;
  amount_note: string;
  payment_link_reference: string;
  notes: string;
  status: BusinessBuilderRecordStatus;
  created_at: string;
}>;

export type SmartIntakeDraft = Readonly<{
  id: string;
  organization_id: string;
  form_name: string;
  service_type: string;
  required_fields: string;
  owner_notes: string;
  status: BusinessBuilderRecordStatus;
  created_at: string;
}>;

export type BusinessBuilderState = Readonly<{
  proofPassports: readonly ProofPassportDraft[];
  offers: readonly OfferDraft[];
  customerRecords: readonly CustomerRecordDraft[];
  customerFollowUps: readonly CustomerFollowUpDraft[];
  moneyPathEvents: readonly MoneyPathEvent[];
  smartIntakeDrafts: readonly SmartIntakeDraft[];
}>;

export type ProofPassportInput = Readonly<{
  businessName: string;
  shortDescription: string;
  services: string;
  proofPoints: string;
  contactAction: string;
  contactUrl: string;
}>;

export type OfferInput = Readonly<{
  offerName: string;
  customerProblem: string;
  deliverables: string;
  priceNote: string;
  nextStep: string;
}>;

export type CustomerRecordInput = Readonly<{
  customerName: string;
  email: string;
  phone?: string;
  source: CustomerSource;
  customerStatus: CustomerStatus;
  tags?: string;
  notes: string;
  lastContactedAt?: string;
  nextFollowUpAt?: string;
  consentStatus: CustomerConsentStatus;
  communicationPreference: CustomerCommunicationPreference;
  permissionNote?: string;
}>;

export type CustomerFollowUpInput = Readonly<{
  customerId: string;
  followUpType: FollowUpDraftType;
  subject: string;
  messageBody: string;
}>;

export type MoneyPathInput = Readonly<{
  eventType: MoneyPathEventType;
  label: string;
  amountNote: string;
  paymentLinkReference: string;
  notes: string;
}>;

export type SmartIntakeInput = Readonly<{
  formName: string;
  serviceType: string;
  requiredFields: string;
  ownerNotes: string;
}>;

export type BusinessSetupChecklistItem = Readonly<{
  id: string;
  title: string;
  description: string;
  route: string;
  isComplete: boolean;
}>;

const storageKey = "sonara-business-builder-records";
export const businessBuilderSetupOrganizationId = "local_setup_organization";

export const moneyPathEventLabels: Record<MoneyPathEventType, string> = {
  payment_option_planned: "Payment option planned",
  invoice_link_prepared: "Invoice link prepared",
  deposit_request_planned: "Deposit request planned",
  manual_payment_note: "Manual payment note"
};

export const customerSourceLabels: Record<CustomerSource, string> = {
  manual: "Manual",
  booking: "Booking",
  intake: "Intake",
  payment: "Payment",
  review: "Review",
  referral: "Referral",
  other: "Other"
};

export const customerStatusLabels: Record<CustomerStatus, string> = {
  lead: "Lead",
  active: "Active",
  needs_follow_up: "Needs follow-up",
  inactive: "Inactive",
  archived: "Archived"
};

export const customerConsentStatusLabels: Record<CustomerConsentStatus, string> = {
  unknown: "Permission unknown",
  opted_in: "Opted in",
  opted_out: "Opted out"
};

export const communicationPreferenceLabels: Record<CustomerCommunicationPreference, string> = {
  email: "Email",
  phone: "Phone",
  sms: "SMS",
  none: "No outreach"
};

export const followUpDraftTypeLabels: Record<FollowUpDraftType, string> = {
  draft_follow_up: "Draft follow-up",
  booking_reminder: "Booking reminder",
  review_request_draft: "Review request draft",
  win_back_draft: "Win-back draft"
};

export const initialBusinessBuilderState: BusinessBuilderState = Object.freeze({
  proofPassports: Object.freeze([]),
  offers: Object.freeze([]),
  customerRecords: Object.freeze([]),
  customerFollowUps: Object.freeze([]),
  moneyPathEvents: Object.freeze([]),
  smartIntakeDrafts: Object.freeze([])
});

export function createBusinessBuilderStore(
  storage: BusinessBuilderStorageLike | null = getBrowserStorage()
) {
  let state = readStoredState(storage);

  function getState() {
    return state;
  }

  function addProofPassport(input: ProofPassportInput) {
    const record = createProofPassportDraft(input);
    state = Object.freeze({
      ...state,
      proofPassports: Object.freeze([...state.proofPassports, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addOffer(input: OfferInput) {
    const record = createOfferDraft(input);
    state = Object.freeze({
      ...state,
      offers: Object.freeze([...state.offers, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addCustomerRecord(input: CustomerRecordInput) {
    const record = createCustomerRecordDraft(input);
    state = Object.freeze({
      ...state,
      customerRecords: Object.freeze([...state.customerRecords, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addCustomerFollowUp(input: CustomerFollowUpInput) {
    const customer = state.customerRecords.find((record) => record.id === input.customerId);
    if (!customer) {
      throw new Error("Cannot queue follow-up for unknown customer.");
    }
    const record = createCustomerFollowUpDraft(customer, input);
    state = Object.freeze({
      ...state,
      customerFollowUps: Object.freeze([...state.customerFollowUps, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addMoneyPathEvent(input: MoneyPathInput) {
    const record = createMoneyPathEvent(input);
    state = Object.freeze({
      ...state,
      moneyPathEvents: Object.freeze([...state.moneyPathEvents, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addSmartIntakeDraft(input: SmartIntakeInput) {
    const record = createSmartIntakeDraft(input);
    state = Object.freeze({
      ...state,
      smartIntakeDrafts: Object.freeze([...state.smartIntakeDrafts, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function clear() {
    state = initialBusinessBuilderState;
    storage?.removeItem(storageKey);
  }

  return Object.freeze({
    getState,
    addProofPassport,
    addOffer,
    addCustomerRecord,
    addCustomerFollowUp,
    addMoneyPathEvent,
    addSmartIntakeDraft,
    clear
  });
}

export function createProofPassportDraft(
  input: ProofPassportInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("proof")
): ProofPassportDraft {
  return Object.freeze({
    id,
    organization_id: businessBuilderSetupOrganizationId,
    business_name: input.businessName.trim(),
    short_description: input.shortDescription.trim(),
    services: input.services.trim(),
    proof_points: input.proofPoints.trim(),
    contact_action: input.contactAction.trim(),
    contact_url: input.contactUrl.trim(),
    status: "draft",
    created_at: createdAt
  });
}

export function createOfferDraft(
  input: OfferInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("offer")
): OfferDraft {
  return Object.freeze({
    id,
    organization_id: businessBuilderSetupOrganizationId,
    offer_name: input.offerName.trim(),
    customer_problem: input.customerProblem.trim(),
    deliverables: input.deliverables.trim(),
    price_note: input.priceNote.trim(),
    next_step: input.nextStep.trim(),
    status: "draft",
    created_at: createdAt
  });
}

export function createCustomerRecordDraft(
  input: CustomerRecordInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("customer")
): CustomerRecordDraft {
  return Object.freeze({
    id,
    organization_id: businessBuilderSetupOrganizationId,
    customer_name: input.customerName.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() ?? "",
    source: input.source,
    customer_status: input.customerStatus,
    tags: Object.freeze(parseTags(input.tags ?? "")),
    notes: input.notes.trim(),
    last_contacted_at: input.lastContactedAt?.trim() ?? "",
    next_follow_up_at: input.nextFollowUpAt?.trim() ?? "",
    consent_status: input.consentStatus,
    communication_preference: input.communicationPreference,
    permission_note: input.permissionNote?.trim() ?? "",
    status: "draft",
    created_at: createdAt
  });
}

export function createCustomerFollowUpDraft(
  customer: CustomerRecordDraft,
  input: CustomerFollowUpInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("follow-up")
): CustomerFollowUpDraft {
  const policy = evaluateAutomationAction(
    input.followUpType === "review_request_draft" ? "send_review_request" : "send_customer_message"
  );
  const safety = evaluateCustomerCommunicationSafety(customer);
  return Object.freeze({
    id,
    organization_id: customer.organization_id,
    customer_id: customer.id,
    customer_name: customer.customer_name,
    follow_up_type: input.followUpType,
    subject: input.subject.trim(),
    message_body: input.messageBody.trim(),
    status: safety.status,
    approval_level: safety.blocked ? "blocked" : policy.approvalLevel,
    risk: safety.blocked ? "critical" : policy.risk,
    safety_note: safety.note,
    created_at: createdAt
  });
}

export function evaluateCustomerCommunicationSafety(customer: CustomerRecordDraft): Readonly<{
  blocked: boolean;
  status: FollowUpDraftStatus;
  note: string;
}> {
  if (customer.consent_status === "opted_out" || customer.communication_preference === "none") {
    return Object.freeze({
      blocked: true,
      status: "blocked_opt_out",
      note: "Blocked: customer has opted out or has no outreach preference."
    });
  }
  if (customer.consent_status === "unknown") {
    return Object.freeze({
      blocked: false,
      status: "permission_required",
      note: "Permission required before any message can be sent."
    });
  }
  return Object.freeze({
    blocked: false,
    status: "owner_review_required",
    note: "Owner approval required before sending. Nothing is sent automatically."
  });
}

export function createMoneyPathEvent(
  input: MoneyPathInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("money")
): MoneyPathEvent {
  return Object.freeze({
    id,
    organization_id: businessBuilderSetupOrganizationId,
    event_type: input.eventType,
    label: input.label.trim(),
    amount_note: input.amountNote.trim(),
    payment_link_reference: input.paymentLinkReference.trim(),
    notes: input.notes.trim(),
    status: "setup",
    created_at: createdAt
  });
}

export function createSmartIntakeDraft(
  input: SmartIntakeInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("intake")
): SmartIntakeDraft {
  return Object.freeze({
    id,
    organization_id: businessBuilderSetupOrganizationId,
    form_name: input.formName.trim(),
    service_type: input.serviceType.trim(),
    required_fields: input.requiredFields.trim(),
    owner_notes: input.ownerNotes.trim(),
    status: "draft",
    created_at: createdAt
  });
}

export function createBusinessSetupChecklist(
  state: BusinessBuilderState
): readonly BusinessSetupChecklistItem[] {
  return Object.freeze([
    createChecklistItem(
      "proof-passport",
      "Draft Proof Passport",
      "Create the public proof basics before sharing a business profile.",
      "/business-builder/proof-passport",
      state.proofPassports.length > 0
    ),
    createChecklistItem(
      "offer-builder",
      "Draft first offer",
      "Clarify what customers can buy or request next.",
      "/business-builder/offers",
      state.offers.length > 0
    ),
    createChecklistItem(
      "money-path",
      "Log Money Path event",
      "Record the next payment setup action without handling sensitive payment data.",
      "/business-builder/money-path",
      state.moneyPathEvents.length > 0
    ),
    createChecklistItem(
      "customer-records",
      "Create customer record",
      "Start a private customer record with consent and follow-up details.",
      "/business-builder/customers",
      state.customerRecords.length > 0
    ),
    createChecklistItem(
      "customer-follow-up",
      "Queue follow-up draft",
      "Draft owner-reviewed follow-up without sending automatically.",
      "/business-builder/customers/follow-up",
      state.customerFollowUps.length > 0
    ),
    createChecklistItem(
      "smart-intake",
      "Draft Smart Intake",
      "Prepare the first owner-reviewed intake form.",
      "/business-builder/smart-intake",
      state.smartIntakeDrafts.length > 0
    )
  ]);
}

export function createLaunchReadinessPlaceholder(state: BusinessBuilderState) {
  const checklist = createBusinessSetupChecklist(state);
  const complete = checklist.filter((item) => item.isComplete).length;
  return Object.freeze({
    label: "Launch readiness",
    value: complete === 0 ? "Not scored yet" : `${complete}/${checklist.length} setup items`,
    note: "Placeholder only. Final readiness requires backend persistence, owner review, and security checks."
  });
}

function createChecklistItem(
  id: string,
  title: string,
  description: string,
  route: string,
  isComplete: boolean
): BusinessSetupChecklistItem {
  return Object.freeze({ id, title, description, route, isComplete });
}

function readStoredState(storage: BusinessBuilderStorageLike | null): BusinessBuilderState {
  const raw = storage?.getItem(storageKey);
  if (!raw) {
    return initialBusinessBuilderState;
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    storage?.removeItem(storageKey);
    return initialBusinessBuilderState;
  }
}

function normalizeState(value: unknown): BusinessBuilderState {
  if (!value || typeof value !== "object") {
    return initialBusinessBuilderState;
  }
  const candidate = value as Partial<BusinessBuilderState>;
  return Object.freeze({
    proofPassports: Object.freeze(
      Array.isArray(candidate.proofPassports) ? candidate.proofPassports : []
    ),
    offers: Object.freeze(Array.isArray(candidate.offers) ? candidate.offers : []),
    customerRecords: Object.freeze(
      Array.isArray(candidate.customerRecords) ? candidate.customerRecords : []
    ),
    customerFollowUps: Object.freeze(
      Array.isArray(candidate.customerFollowUps) ? candidate.customerFollowUps : []
    ),
    moneyPathEvents: Object.freeze(
      Array.isArray(candidate.moneyPathEvents) ? candidate.moneyPathEvents : []
    ),
    smartIntakeDrafts: Object.freeze(
      Array.isArray(candidate.smartIntakeDrafts) ? candidate.smartIntakeDrafts : []
    )
  });
}

function writeStoredState(storage: BusinessBuilderStorageLike | null, state: BusinessBuilderState) {
  storage?.setItem(storageKey, JSON.stringify(state));
}

function getBrowserStorage(): BusinessBuilderStorageLike | null {
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

function parseTags(value: string): readonly string[] {
  return Object.freeze(
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  );
}

function createRecordId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}
