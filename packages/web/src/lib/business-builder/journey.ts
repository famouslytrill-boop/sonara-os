import type {
  BookingLinkRecord,
  LinkTrustWarning,
  MoneyAdjacentState,
  PaymentOptionRecord,
  ReviewTrustRecord
} from "../money-adjacent/index.ts";
import {
  bookingTypeLabels,
  paymentProviderLabels,
  reviewRecordLabels,
  trustWarningLabels
} from "../money-adjacent/index.ts";
import type {
  BusinessBuilderState,
  CustomerFollowUpDraft,
  CustomerRecordDraft,
  MoneyPathEvent,
  OfferDraft,
  ProofPassportDraft
} from "./records.ts";
import { followUpDraftTypeLabels, moneyPathEventLabels } from "./records.ts";

export type BusinessJourneyStepId =
  | "proof_passport"
  | "payment_option"
  | "booking_link"
  | "offer"
  | "customer"
  | "review_request"
  | "money_path"
  | "growth_follow_up";

export type BusinessJourneyStep = Readonly<{
  id: BusinessJourneyStepId;
  title: string;
  description: string;
  route: string;
  isComplete: boolean;
  safetyNote: string;
}>;

export type BusinessJourneyTimelineSource =
  | "setup"
  | "proof_passport"
  | "payment_option"
  | "booking_link"
  | "offer"
  | "customer"
  | "review_request"
  | "money_path"
  | "growth_follow_up";

export type BusinessJourneyTimelineEvent = Readonly<{
  id: string;
  organization_id: string;
  title: string;
  description: string;
  source: BusinessJourneyTimelineSource;
  route: string;
  status: string;
  created_at: string;
  safetyNote: string;
}>;

export type BusinessJourneyWarning = Readonly<{
  id: string;
  title: string;
  description: string;
  route: string;
  critical: boolean;
}>;

export type BusinessNextAction = Readonly<{
  title: string;
  description: string;
  route: string;
  actionLabel: string;
  safetyNote: string;
}>;

export type BusinessJourneyOverview = Readonly<{
  organization_id: string;
  steps: readonly BusinessJourneyStep[];
  completedSteps: number;
  totalSteps: number;
  progressLabel: string;
  nextAction: BusinessNextAction;
  timeline: readonly BusinessJourneyTimelineEvent[];
  warnings: readonly BusinessJourneyWarning[];
}>;

const setupOrganizationId = "local_setup_organization";

export function createBusinessJourneyOverview(
  businessState: BusinessBuilderState,
  moneyState: MoneyAdjacentState
): BusinessJourneyOverview {
  const organizationId = resolveOrganizationId(businessState, moneyState);
  const steps = createBusinessJourneySteps(businessState, moneyState);
  const completedSteps = steps.filter((step) => step.isComplete).length;
  return Object.freeze({
    organization_id: organizationId,
    steps,
    completedSteps,
    totalSteps: steps.length,
    progressLabel: `${completedSteps}/${steps.length} flow steps`,
    nextAction: createNextBusinessAction(steps),
    timeline: createMoneyPathTimeline(businessState, moneyState, organizationId),
    warnings: createBusinessJourneyWarnings(businessState, moneyState)
  });
}

export function createBusinessJourneySteps(
  businessState: BusinessBuilderState,
  moneyState: MoneyAdjacentState
): readonly BusinessJourneyStep[] {
  const businessPayments = moneyState.paymentOptions.filter(
    (record) => record.product_area === "business_builder"
  );
  const businessBookings = moneyState.bookingLinks.filter(
    (record) => record.product_area === "business_builder"
  );
  const businessReviews = moneyState.reviewRecords.filter(
    (record) =>
      record.product_area === "business_builder" && record.record_type === "review_request_link"
  );
  return Object.freeze([
    createStep({
      id: "proof_passport",
      title: "Create Business Proof Passport",
      description: "Draft the public profile basics before sending customers to any link.",
      route: "/business-builder/proof-passport",
      isComplete: businessState.proofPassports.length > 0,
      safetyNote: "Draft only. No fake verification or automatic publishing."
    }),
    createStep({
      id: "payment_option",
      title: "Add payment option",
      description: "Add provider-hosted payment links or reviewed manual payment URLs.",
      route: "/business-builder/payment-options",
      isComplete: businessPayments.length > 0,
      safetyNote: "No payment custody, raw card numbers, CVV, bank credentials, secrets, or tokens."
    }),
    createStep({
      id: "booking_link",
      title: "Add booking link",
      description: "Add a booking URL, call-to-book option, or owner-reviewed request path.",
      route: "/business-builder/bookings",
      isComplete: businessBookings.length > 0,
      safetyNote: "Bookings require owner review. No guaranteed availability."
    }),
    createStep({
      id: "offer",
      title: "Create offer",
      description: "Draft one clear offer with deliverables, price notes, and next step.",
      route: "/business-builder/offers",
      isComplete: businessState.offers.length > 0,
      safetyNote: "No guaranteed revenue, legal, tax, financial, or certified outcome claims."
    }),
    createStep({
      id: "customer",
      title: "Add customer",
      description: "Create a private customer record with source, status, notes, and permissions.",
      route: "/business-builder/customers",
      isComplete: businessState.customerRecords.length > 0,
      safetyNote: "Customer records stay private and owner-controlled."
    }),
    createStep({
      id: "review_request",
      title: "Queue review request",
      description: "Create a review request record or follow-up draft for owner review.",
      route: "/business-builder/reviews",
      isComplete:
        businessReviews.length > 0 ||
        businessState.customerFollowUps.some(
          (draft) => draft.follow_up_type === "review_request_draft"
        ),
      safetyNote: "No fake reviews, fake ratings, scraping, or automatic publishing."
    }),
    createStep({
      id: "money_path",
      title: "See Money Path event",
      description:
        "Review the timeline created from payment, offer, booking, customer, and review setup.",
      route: "/business-builder/money-path",
      isComplete:
        businessState.moneyPathEvents.length > 0 ||
        businessPayments.length > 0 ||
        businessState.offers.length > 0,
      safetyNote: "Timeline is setup-only until real billing data is connected safely."
    }),
    createStep({
      id: "growth_follow_up",
      title: "See next growth action",
      description: "Use Autopilot Board to pick the next owner-reviewed growth action.",
      route: "/business-builder/autopilot-board",
      isComplete: businessState.customerFollowUps.length > 0,
      safetyNote: "Recommendations are drafts. Nothing sends or publishes automatically."
    })
  ]);
}

export function createNextBusinessAction(
  steps: readonly BusinessJourneyStep[]
): BusinessNextAction {
  const nextIncomplete = steps.find((step) => !step.isComplete);
  if (!nextIncomplete) {
    return Object.freeze({
      title: "Review the next growth action",
      description:
        "The setup flow has records for proof, payment, booking, offer, customer, review, and Money Path. Review the Autopilot Board for the next owner-approved action.",
      route: "/business-builder/autopilot-board",
      actionLabel: "Open Autopilot Board",
      safetyNote: "Growth actions still require owner review before customer contact or publishing."
    });
  }
  return Object.freeze({
    title: nextIncomplete.title,
    description: nextIncomplete.description,
    route: nextIncomplete.route,
    actionLabel: "Continue setup",
    safetyNote: nextIncomplete.safetyNote
  });
}

export function createMoneyPathTimeline(
  businessState: BusinessBuilderState,
  moneyState: MoneyAdjacentState,
  organizationId = resolveOrganizationId(businessState, moneyState)
): readonly BusinessJourneyTimelineEvent[] {
  const events: BusinessJourneyTimelineEvent[] = [
    ...businessState.proofPassports.map(mapProofPassportEvent),
    ...moneyState.paymentOptions
      .filter((record) => record.product_area === "business_builder")
      .map(mapPaymentOptionEvent),
    ...moneyState.bookingLinks
      .filter((record) => record.product_area === "business_builder")
      .map(mapBookingLinkEvent),
    ...businessState.offers.map(mapOfferEvent),
    ...businessState.customerRecords.map(mapCustomerEvent),
    ...moneyState.reviewRecords
      .filter((record) => record.product_area === "business_builder")
      .map(mapReviewEvent),
    ...businessState.customerFollowUps.map(mapFollowUpEvent),
    ...businessState.moneyPathEvents.map(mapMoneyPathEvent)
  ];

  if (events.length === 0) {
    return Object.freeze([
      Object.freeze({
        id: "setup-money-path-empty",
        organization_id: organizationId,
        title: "No live Money Path events yet",
        description:
          "Start with the Proof Passport, then add payment, booking, offer, customer, and review setup records.",
        source: "setup",
        route: "/business-builder/proof-passport",
        status: "setup",
        created_at: "",
        safetyNote:
          "Setup placeholder only. No payments, invoices, or revenue totals are simulated."
      })
    ]);
  }

  return Object.freeze(events.sort(sortTimelineEvents));
}

export function createBusinessJourneyWarnings(
  businessState: BusinessBuilderState,
  moneyState: MoneyAdjacentState
): readonly BusinessJourneyWarning[] {
  const warnings: BusinessJourneyWarning[] = [
    createWarning({
      id: "payment-custody",
      title: "Payment custody is not enabled",
      description:
        "Payment options must use provider-hosted links or reviewed manual URLs. SONARA One does not store raw payment credentials.",
      route: "/business-builder/payment-options",
      critical: true
    })
  ];

  for (const payment of moneyState.paymentOptions.filter(
    (record) => record.product_area === "business_builder"
  )) {
    warnings.push(
      ...mapTrustWarnings(payment.id, payment.warnings, "/business-builder/payment-options")
    );
  }
  for (const booking of moneyState.bookingLinks.filter(
    (record) => record.product_area === "business_builder"
  )) {
    warnings.push(...mapTrustWarnings(booking.id, booking.warnings, "/business-builder/bookings"));
  }
  for (const review of moneyState.reviewRecords.filter(
    (record) => record.product_area === "business_builder"
  )) {
    warnings.push(...mapTrustWarnings(review.id, review.warnings, "/business-builder/reviews"));
  }
  for (const customer of businessState.customerRecords) {
    if (customer.consent_status === "unknown") {
      warnings.push(
        createWarning({
          id: `customer-permission-${customer.id}`,
          title: "Customer permission needs review",
          description: `${customer.customer_name || "A customer"} has unknown communication permission.`,
          route: "/business-builder/customers",
          critical: false
        })
      );
    }
    if (customer.consent_status === "opted_out" || customer.communication_preference === "none") {
      warnings.push(
        createWarning({
          id: `customer-opt-out-${customer.id}`,
          title: "Customer outreach blocked",
          description: `${customer.customer_name || "A customer"} cannot receive follow-up messages.`,
          route: "/business-builder/customers/follow-up",
          critical: true
        })
      );
    }
  }
  return Object.freeze(warnings);
}

function createStep(input: BusinessJourneyStep): BusinessJourneyStep {
  return Object.freeze(input);
}

function mapProofPassportEvent(record: ProofPassportDraft): BusinessJourneyTimelineEvent {
  return Object.freeze({
    id: `timeline-${record.id}`,
    organization_id: record.organization_id,
    title: record.business_name || "Proof Passport drafted",
    description: record.short_description || "Business Proof Passport draft created.",
    source: "proof_passport",
    route: "/business-builder/proof-passport",
    status: record.status,
    created_at: record.created_at,
    safetyNote: "Draft only. No verification or publishing is implied."
  });
}

function mapPaymentOptionEvent(record: PaymentOptionRecord): BusinessJourneyTimelineEvent {
  return Object.freeze({
    id: `timeline-${record.id}`,
    organization_id: record.organization_id,
    title: record.provider_label || paymentProviderLabels[record.provider],
    description: `${paymentProviderLabels[record.provider]} payment option added for review.`,
    source: "payment_option",
    route: "/business-builder/payment-options",
    status: record.verification_status,
    created_at: record.created_at,
    safetyNote: "Provider-hosted link only. No raw payment data or custody."
  });
}

function mapBookingLinkEvent(record: BookingLinkRecord): BusinessJourneyTimelineEvent {
  return Object.freeze({
    id: `timeline-${record.id}`,
    organization_id: record.organization_id,
    title: record.label || bookingTypeLabels[record.booking_type],
    description: `${bookingTypeLabels[record.booking_type]} setup record added.`,
    source: "booking_link",
    route: "/business-builder/bookings",
    status: record.verification_status,
    created_at: record.created_at,
    safetyNote: "Owner review is required before appointment confirmation."
  });
}

function mapOfferEvent(record: OfferDraft): BusinessJourneyTimelineEvent {
  return Object.freeze({
    id: `timeline-${record.id}`,
    organization_id: record.organization_id,
    title: record.offer_name || "Offer drafted",
    description: record.next_step || record.customer_problem || "Offer draft created.",
    source: "offer",
    route: "/business-builder/offers",
    status: record.status,
    created_at: record.created_at,
    safetyNote: "Offer remains a draft until reviewed."
  });
}

function mapCustomerEvent(record: CustomerRecordDraft): BusinessJourneyTimelineEvent {
  return Object.freeze({
    id: `timeline-${record.id}`,
    organization_id: record.organization_id,
    title: record.customer_name || "Customer added",
    description: `Private customer record added with ${record.consent_status.replace("_", " ")} permission status.`,
    source: "customer",
    route: "/business-builder/customers",
    status: record.customer_status,
    created_at: record.created_at,
    safetyNote: "Customer details are private and must not be exposed publicly."
  });
}

function mapReviewEvent(record: ReviewTrustRecord): BusinessJourneyTimelineEvent {
  return Object.freeze({
    id: `timeline-${record.id}`,
    organization_id: record.organization_id,
    title: record.label || reviewRecordLabels[record.record_type],
    description: `${reviewRecordLabels[record.record_type]} created for moderation.`,
    source: "review_request",
    route: "/business-builder/reviews",
    status: record.moderation_status,
    created_at: record.created_at,
    safetyNote: "No fake reviews, scraping, or automatic publishing."
  });
}

function mapFollowUpEvent(record: CustomerFollowUpDraft): BusinessJourneyTimelineEvent {
  return Object.freeze({
    id: `timeline-${record.id}`,
    organization_id: record.organization_id,
    title: record.subject || followUpDraftTypeLabels[record.follow_up_type],
    description: `${followUpDraftTypeLabels[record.follow_up_type]} queued for ${record.customer_name || "customer"}.`,
    source: "growth_follow_up",
    route: "/business-builder/autopilot-board",
    status: record.status,
    created_at: record.created_at,
    safetyNote: record.safety_note
  });
}

function mapMoneyPathEvent(record: MoneyPathEvent): BusinessJourneyTimelineEvent {
  return Object.freeze({
    id: `timeline-${record.id}`,
    organization_id: record.organization_id,
    title: record.label || moneyPathEventLabels[record.event_type],
    description: record.notes || record.amount_note || "Money Path setup event logged.",
    source: "money_path",
    route: "/business-builder/money-path",
    status: record.status,
    created_at: record.created_at,
    safetyNote: "Setup event only. No payment processing is implied."
  });
}

function mapTrustWarnings(
  recordId: string,
  warnings: readonly LinkTrustWarning[],
  route: string
): BusinessJourneyWarning[] {
  return warnings.map((warning) =>
    createWarning({
      id: `${recordId}-${warning}`,
      title: trustWarningLabels[warning],
      description: `${trustWarningLabels[warning]} needs owner review before public use.`,
      route,
      critical: warning === "suspicious_payment_url"
    })
  );
}

function createWarning(input: BusinessJourneyWarning): BusinessJourneyWarning {
  return Object.freeze(input);
}

function sortTimelineEvents(
  left: BusinessJourneyTimelineEvent,
  right: BusinessJourneyTimelineEvent
) {
  if (!left.created_at) {
    return -1;
  }
  if (!right.created_at) {
    return 1;
  }
  return left.created_at.localeCompare(right.created_at);
}

function resolveOrganizationId(
  businessState: BusinessBuilderState,
  moneyState: MoneyAdjacentState
): string {
  return (
    businessState.proofPassports[0]?.organization_id ??
    businessState.offers[0]?.organization_id ??
    businessState.customerRecords[0]?.organization_id ??
    businessState.customerFollowUps[0]?.organization_id ??
    businessState.moneyPathEvents[0]?.organization_id ??
    businessState.smartIntakeDrafts[0]?.organization_id ??
    moneyState.paymentOptions[0]?.organization_id ??
    moneyState.bookingLinks[0]?.organization_id ??
    moneyState.reviewRecords[0]?.organization_id ??
    setupOrganizationId
  );
}
