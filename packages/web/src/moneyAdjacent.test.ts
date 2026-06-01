import { describe, expect, it } from "vitest";
import {
  createMoneyAdjacentStore,
  createPaymentOptionRecord,
  createPaymentWarnings,
  hasPaymentCredentialFields,
  isSafeHttpUrl
} from "./lib/money-adjacent/index.ts";

describe("money-adjacent MVP records", () => {
  it("creates and stores payment, booking, and review records locally", () => {
    const store = createMoneyAdjacentStore(createMemoryStorage());

    const payment = store.addPaymentOption({
      productArea: "business_builder",
      provider: "stripe",
      providerLabel: "Deposit link",
      externalUrl: "https://buy.stripe.com/test"
    });
    const booking = store.addBookingLink({
      productArea: "business_builder",
      bookingType: "external_booking_url",
      label: "Consultation",
      externalUrl: "https://calendar.example/book",
      callToBook: ""
    });
    const review = store.addReviewRecord({
      productArea: "growth_studio",
      recordType: "review_request_link",
      label: "Review request",
      sourceName: "Business profile",
      externalUrl: "https://reviews.example/request",
      testimonial: ""
    });

    expect(payment.warnings).toContain("unverified_link");
    expect(booking.warnings).toContain("unverified_link");
    expect(review.moderation_status).toBe("review_needed");
    expect(store.getState().paymentOptions).toHaveLength(1);
    expect(store.getState().bookingLinks).toHaveLength(1);
    expect(store.getState().reviewRecords).toHaveLength(1);
  });

  it("flags suspicious or incomplete payment URLs", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/plain,secret")).toBe(false);
    expect(createPaymentWarnings("paypal", "", "javascript:alert(1)")).toEqual([
      "missing_provider_label",
      "suspicious_payment_url"
    ]);
    expect(createPaymentWarnings("stripe", "Wrong host", "https://example.com/pay")).toContain(
      "suspicious_payment_url"
    );
  });

  it("does not define payment credential fields", () => {
    const record = createPaymentOptionRecord(
      {
        productArea: "creator_studio",
        provider: "square",
        providerLabel: "Checkout link",
        externalUrl: "https://square.link/u/test"
      },
      "2026-05-18T00:00:00.000Z",
      "payment-test"
    );

    expect(hasPaymentCredentialFields(record)).toBe(false);
    expect(Object.keys(record)).not.toContain("card_number");
    expect(Object.keys(record)).not.toContain("cvv");
    expect(Object.keys(record)).not.toContain("bank_account");
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
