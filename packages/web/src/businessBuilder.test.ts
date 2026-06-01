import { describe, expect, it } from "vitest";
import {
  createBusinessJourneyOverview,
  createBusinessBuilderStore,
  createBusinessSetupChecklist,
  evaluateCustomerCommunicationSafety,
  createLaunchReadinessPlaceholder
} from "./lib/business-builder/index.ts";
import { createMoneyAdjacentStore } from "./lib/money-adjacent/index.ts";

describe("Business Builder MVP records", () => {
  it("creates core draft records in local setup storage", () => {
    const store = createBusinessBuilderStore(createMemoryStorage());

    store.addProofPassport({
      businessName: "Northside Studio",
      shortDescription: "A practical service business profile.",
      services: "Consulting, setup, support",
      proofPoints: "Licensed where required, customer-approved examples only",
      contactAction: "Request a quote",
      contactUrl: "https://example.com/contact"
    });
    store.addOffer({
      offerName: "Starter consultation",
      customerProblem: "Customers need a clear next step.",
      deliverables: "Call, notes, next action",
      priceNote: "Quote after review",
      nextStep: "Submit intake"
    });
    store.addCustomerRecord({
      customerName: "Local lead",
      email: "lead@example.com",
      phone: "",
      source: "manual",
      customerStatus: "needs_follow_up",
      tags: "lead, consultation",
      notes: "Owner-only setup note",
      lastContactedAt: "2026-05-20",
      nextFollowUpAt: "2026-05-21",
      consentStatus: "opted_in",
      communicationPreference: "email",
      permissionNote: "Customer asked for email follow-up."
    });
    store.addMoneyPathEvent({
      eventType: "payment_option_planned",
      label: "Deposit link planned",
      amountNote: "Deposit amount TBD",
      paymentLinkReference: "Payment Options setup",
      notes: "Use provider-hosted link"
    });
    store.addSmartIntakeDraft({
      formName: "New request intake",
      serviceType: "consultation",
      requiredFields: "name, contact, notes",
      ownerNotes: "Owner reviews before reply"
    });

    const state = store.getState();
    expect(state.proofPassports).toHaveLength(1);
    expect(state.offers).toHaveLength(1);
    expect(state.customerRecords).toHaveLength(1);
    expect(state.customerRecords[0].tags).toEqual(["lead", "consultation"]);
    expect(state.moneyPathEvents).toHaveLength(1);
    expect(state.smartIntakeDrafts).toHaveLength(1);
  });

  it("queues follow-up drafts with owner approval and blocks opted-out sends", () => {
    const store = createBusinessBuilderStore(createMemoryStorage());
    const optedIn = store.addCustomerRecord({
      customerName: "Ready customer",
      email: "ready@example.com",
      source: "booking",
      customerStatus: "needs_follow_up",
      notes: "Needs a booking reminder.",
      consentStatus: "opted_in",
      communicationPreference: "email"
    });
    const optedOut = store.addCustomerRecord({
      customerName: "Opted out customer",
      email: "no@example.com",
      source: "manual",
      customerStatus: "inactive",
      notes: "No outreach.",
      consentStatus: "opted_out",
      communicationPreference: "none"
    });

    const reminder = store.addCustomerFollowUp({
      customerId: optedIn.id,
      followUpType: "booking_reminder",
      subject: "Booking reminder",
      messageBody: "Draft reminder for owner review."
    });
    const blocked = store.addCustomerFollowUp({
      customerId: optedOut.id,
      followUpType: "win_back_draft",
      subject: "Win-back draft",
      messageBody: "Should not send."
    });

    expect(reminder.approval_level).toBe("owner_review");
    expect(reminder.status).toBe("owner_review_required");
    expect(blocked.approval_level).toBe("blocked");
    expect(blocked.status).toBe("blocked_opt_out");
    expect(evaluateCustomerCommunicationSafety(optedOut).blocked).toBe(true);
    expect(store.getState().customerFollowUps).toHaveLength(2);
  });

  it("drives setup checklist and readiness placeholder from draft state", () => {
    const store = createBusinessBuilderStore(createMemoryStorage());
    expect(createLaunchReadinessPlaceholder(store.getState()).value).toBe("Not scored yet");

    store.addProofPassport({
      businessName: "Proof only",
      shortDescription: "",
      services: "",
      proofPoints: "",
      contactAction: "Contact",
      contactUrl: ""
    });

    const checklist = createBusinessSetupChecklist(store.getState());
    expect(checklist.find((item) => item.id === "proof-passport")?.isComplete).toBe(true);
    expect(createLaunchReadinessPlaceholder(store.getState()).value).toBe("1/6 setup items");
  });

  it("connects the full Business Builder journey with organization-scoped setup records", () => {
    const businessStore = createBusinessBuilderStore(createMemoryStorage());
    const moneyStore = createMoneyAdjacentStore(createMemoryStorage());

    const proof = businessStore.addProofPassport({
      businessName: "Northside Studio",
      shortDescription: "Local service setup profile.",
      services: "Consulting and support",
      proofPoints: "Customer-approved proof only",
      contactAction: "Book a consultation",
      contactUrl: "https://example.com/contact"
    });
    const payment = moneyStore.addPaymentOption({
      productArea: "business_builder",
      provider: "stripe",
      providerLabel: "Deposit checkout",
      externalUrl: "https://buy.stripe.com/test"
    });
    const booking = moneyStore.addBookingLink({
      productArea: "business_builder",
      bookingType: "external_booking_url",
      label: "Consultation booking",
      externalUrl: "https://calendar.example/book",
      callToBook: ""
    });
    const offer = businessStore.addOffer({
      offerName: "Starter setup",
      customerProblem: "Customer needs a clear launch step.",
      deliverables: "Planning call and setup checklist",
      priceNote: "Provider-hosted deposit link",
      nextStep: "Book a consultation"
    });
    const customer = businessStore.addCustomerRecord({
      customerName: "Ready lead",
      email: "ready@example.com",
      source: "booking",
      customerStatus: "needs_follow_up",
      notes: "Interested in starter setup.",
      consentStatus: "opted_in",
      communicationPreference: "email"
    });
    const review = moneyStore.addReviewRecord({
      productArea: "business_builder",
      recordType: "review_request_link",
      label: "Review request",
      sourceName: "Business profile",
      externalUrl: "https://reviews.example/request",
      testimonial: ""
    });
    const followUp = businessStore.addCustomerFollowUp({
      customerId: customer.id,
      followUpType: "review_request_draft",
      subject: "Review request draft",
      messageBody: "Draft only for owner review."
    });
    const moneyEvent = businessStore.addMoneyPathEvent({
      eventType: "payment_option_planned",
      label: "Deposit payment path planned",
      amountNote: "Deposit amount reviewed by owner",
      paymentLinkReference: payment.id,
      notes: "Provider-hosted payment link only."
    });

    const overview = createBusinessJourneyOverview(businessStore.getState(), moneyStore.getState());
    const organizationIds = new Set([
      proof.organization_id,
      payment.organization_id,
      booking.organization_id,
      offer.organization_id,
      customer.organization_id,
      review.organization_id,
      followUp.organization_id,
      moneyEvent.organization_id
    ]);

    expect(organizationIds.size).toBe(1);
    expect(overview.completedSteps).toBe(overview.totalSteps);
    expect(overview.nextAction.route).toBe("/business-builder/autopilot-board");
    expect(overview.timeline.map((event) => event.source)).toEqual(
      expect.arrayContaining([
        "proof_passport",
        "payment_option",
        "booking_link",
        "offer",
        "customer",
        "review_request",
        "growth_follow_up",
        "money_path"
      ])
    );
    expect(overview.warnings.map((warning) => warning.title)).toContain(
      "Payment custody is not enabled"
    );
    expect(Object.keys(payment)).not.toContain("card_number");
    expect(Object.keys(payment)).not.toContain("cvv");
  });
});

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    }
  };
}
