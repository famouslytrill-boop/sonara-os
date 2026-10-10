// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const { classifyMobileBilling: classify } =
  require("../lib/sonara-mobile-billing-classification.cjs");

const common = {
  serverCatalogVerified: true,
  productClassificationApproved: true,
  storefrontVerified: true
};
const physical = { ...common,
  merchantIdentityVerified: true, outsideAppFulfillmentVerified: true };
const apple = { ...common,
  appleProductVerified: true, appleTransactionVerifierReady: true };
const google = { ...common,
  playProductVerified: true, playPurchaseVerifierReady: true };
const googleUS = { ...common,
  googleProgramEnrolled: true,
  googleAlternativeBillingApiReady: true,
  googleTransactionReportingReady: true,
  googleDownloadReportingReady: true,
  googleServiceFeesAccepted: true,
  googleCustomerSupportAndRefundsReady: true
};

function evaluate(productKind, platform, method, evidence = common, storefrontCountry = "US") {
  return classify({ productKind, platform, method, evidence, storefrontCountry });
}

describe("mobile platform purchase classification is safe by default", () => {
  it("requires a known platform and exact canonical product kind", () => {
    assert.equal(classify({ platform: "ios", productKind: "digital_feature" }).code, "platform_unknown");
    assert.equal(classify({ platform: "web", productKind: "unknown" }).code, "product_classification_required");
    assert.equal(classify({ platform: "web", productKind: "rental_deposit" }).code, "product_classification_required");
    assert.equal(classify({ platform: "web", productKind: "digital_feature", method: "stripe_direct" }).code, "payment_method_unknown");
  });

  it("never bills free social / marketplace listing / storefront creation", () => {
    for (const platform of ["web", "ios_app_store", "google_play"]) {
      assert.equal(evaluate("free_surface", platform, "none", {}).code, "free_no_payment");
      assert.equal(evaluate("free_surface", platform, "merchant_direct", {}).code, "free_surface_must_not_charge");
    }
  });

  it("refuses mixed carts instead of classifying by the least restricted item", () => {
    assert.equal(evaluate("mixed_cart", "ios_app_store", "merchant_direct", physical).code,
      "split_mixed_cart_and_review");
  });

  it("cannot classify chargeable items from a client-selected SKU or geography", () => {
    assert.equal(evaluate("digital_feature", "google_play", "google_play_billing", {
      ...google, productClassificationApproved: false
    }).code, "server_sku_and_classification_unverified");
    assert.equal(evaluate("digital_feature", "google_play", "google_play_billing", {
      ...google, storefrontVerified: false
    }).code, "storefront_not_verified");
    assert.equal(evaluate("digital_feature", "google_play", "google_play_billing", google, "USA").code,
      "storefront_not_verified");
  });

  it("allows verified merchant purchase candidates for physical goods and real-world services", () => {
    for (const kind of ["physical_good", "physical_service"]) {
      for (const platform of ["ios_app_store", "google_play", "web"]) {
        assert.equal(evaluate(kind, platform, "merchant_direct", physical).channel, "merchant_direct");
        assert.equal(evaluate(kind, platform, "apple_iap", physical).ok, false);
      }
    }
    assert.equal(evaluate("physical_good", "ios_app_store", "merchant_direct", {
      ...physical, merchantIdentityVerified: false
    }).code, "physical_merchant_or_fulfillment_unverified");
    assert.equal(evaluate("physical_service", "google_play", "merchant_direct", {
      ...physical, outsideAppFulfillmentVerified: false
    }).ok, false);
  });

  it("requires product and purchase verification for all iOS StoreKit digital kinds", () => {
    for (const kind of ["digital_creator_content", "digital_feature",
                        "digital_subscription", "in_app_social_boost"]) {
      const result = evaluate(kind, "ios_app_store", "apple_iap", apple);
      assert.equal(result.channel, "apple_iap");
      assert.equal(result.checkoutAuthorized, false);
      assert.equal(result.entitlementGranted, false);
      assert.equal(evaluate(kind, "ios_app_store", "merchant_direct", apple).ok, false);
      assert.equal(evaluate(kind, "ios_app_store", "apple_iap", {
        ...apple, appleTransactionVerifierReady: false
      }).ok, false);
    }
  });

  it("does not turn a US Apple external link into an in-app checkout", () => {
    const proof = { ...common, appleUsExternalLinkReviewed: true,
      destinationOwnedAndApproved: true };
    const result = evaluate("digital_creator_content", "ios_app_store",
      "apple_us_external_link", proof, "US");
    assert.equal(result.code, "apple_us_external_link_candidate");
    assert.equal(result.channel, "external_link_only");
    assert.equal(result.checkoutAuthorized, false);
    assert.equal(result.entitlementGranted, false);
    assert.equal(evaluate("digital_feature", "ios_app_store",
      "apple_us_external_link", proof, "FR").code, "apple_external_link_region_unapproved");
    assert.equal(evaluate("digital_feature", "ios_app_store",
      "apple_us_external_link", {
        ...proof, destinationOwnedAndApproved: false
      }, "US").code, "apple_us_external_link_not_reviewed");
  });

  it("requires Google Play Billing provider proof for digital products", () => {
    for (const kind of ["digital_creator_content", "digital_subscription",
                        "digital_feature", "in_app_social_boost"]) {
      assert.equal(evaluate(kind, "google_play", "google_play_billing", google).channel, "google_play_billing");
      assert.equal(evaluate(kind, "google_play", "merchant_direct", google).ok, false);
      assert.equal(evaluate(kind, "google_play", "google_play_billing",
        {...google, playPurchaseVerifierReady: false}).ok, false);
    }
  });

  it("gates US alternative billing on enrollment, APIs, reporting and service fees", () => {
    const result = evaluate("digital_subscription", "google_play",
      "google_us_alternative", googleUS, "US");
    assert.equal(result.channel, "approved_alternative_only");
    assert.equal(result.checkoutAuthorized, false);
    for (const field of [
      "googleProgramEnrolled", "googleAlternativeBillingApiReady",
      "googleTransactionReportingReady", "googleDownloadReportingReady",
      "googleServiceFeesAccepted", "googleCustomerSupportAndRefundsReady"
    ]) {
      assert.equal(evaluate("digital_subscription", "google_play",
        "google_us_alternative", {...googleUS, [field]: false}, "US").code,
        "google_us_alternative_program_not_ready", field);
    }
    assert.equal(evaluate("digital_subscription", "google_play",
      "google_us_alternative", googleUS, "GB").code, "google_us_alternative_region_unapproved");
  });

  it("treats missing, inherited and accessor evidence as unverified without throwing", () => {
    const input = (evidence) => classify({
      platform: "google_play", productKind: "digital_subscription",
      storefrontCountry: "US", method: "google_us_external_link", evidence
    });
    assert.equal(input(null).code, "server_sku_and_classification_unverified");
    assert.equal(input([]).code, "server_sku_and_classification_unverified");
    const inherited = Object.create({ ...common,
      googleExternalLinksProgramEnrolled: true });
    assert.equal(input(inherited).code, "server_sku_and_classification_unverified");
    const getter = {};
    Object.defineProperty(getter, "serverCatalogVerified", {
      get() { throw new Error("must not invoke a getter for a permission"); }
    });
    assert.equal(input(getter).code, "server_sku_and_classification_unverified");
    const inheritedEnrollment = Object.create({
      googleExternalLinksProgramEnrolled: true
    });
    Object.assign(inheritedEnrollment, common, {
      googleExternalLinksApiReady: true,
      googleExternalDestinationApproved: true,
      googleExternalPrelinkDisclosureReady: true,
      googleExternalTransactionReportingReady: true,
      googleExternalFeesAccepted: true,
      googleExternalCustomerSupportAndRefundsReady: true
    });
    assert.equal(input(inheritedEnrollment).code, "google_external_links_program_not_ready");
  });

  it("keeps Google US external content links separate from alternative in-app billing", () => {
    const linkProof = { ...common,
      googleExternalLinksProgramEnrolled: true,
      googleExternalLinksApiReady: true,
      googleExternalDestinationApproved: true,
      googleExternalPrelinkDisclosureReady: true,
      googleExternalTransactionReportingReady: true,
      googleExternalFeesAccepted: true,
      googleExternalCustomerSupportAndRefundsReady: true
    };
    const candidate = evaluate("digital_creator_content", "google_play",
      "google_us_external_link", linkProof, "US");
    assert.equal(candidate.code, "google_us_external_link_candidate");
    assert.equal(candidate.channel, "external_link_only");
    assert.equal(candidate.checkoutAuthorized, false);
    assert.equal(candidate.entitlementGranted, false);
    assert.equal(candidate.sideEffectExecuted, false);
    const fields = [
      "googleExternalLinksProgramEnrolled",
      "googleExternalLinksApiReady",
      "googleExternalDestinationApproved",
      "googleExternalPrelinkDisclosureReady",
      "googleExternalTransactionReportingReady",
      "googleExternalFeesAccepted",
      "googleExternalCustomerSupportAndRefundsReady"
    ];
    for (const field of fields) {
      assert.equal(evaluate("digital_creator_content", "google_play",
        "google_us_external_link", { ...linkProof, [field]: false }, "US").code,
        "google_external_links_program_not_ready", field);
    }
    assert.equal(evaluate("digital_creator_content", "google_play",
      "google_us_external_link", linkProof, "GB").code, "google_external_link_region_unapproved");
    // Enrolling in one program cannot authorize the other.
    assert.equal(evaluate("digital_feature", "google_play",
      "google_us_external_link", googleUS, "US").ok, false);
    assert.equal(evaluate("digital_feature", "google_play",
      "google_us_alternative", linkProof, "US").ok, false);
    assert.equal(evaluate("digital_feature", "ios_app_store",
      "google_us_external_link", linkProof, "US").ok, false);
  });

  it("does not misclassify in-app boosts as advertising-manager exceptions", () => {
    assert.equal(evaluate("in_app_social_boost", "ios_app_store", "merchant_direct", physical).ok, false);
    assert.equal(evaluate("advertising_management", "ios_app_store", "merchant_direct", physical).code,
      "advertising_management_exception_requires_review");
  });

  it("allows verified web-provider digital candidates, never a charge or grant", () => {
    const ok = evaluate("digital_creator_content", "web", "web_provider", {
      ...common, webPaymentProviderVerified: true
    });
    assert.equal(ok.channel, "web_provider");
    assert.equal(ok.checkoutAuthorized, false);
    assert.equal(ok.sideEffectExecuted, false);
    assert.equal(evaluate("digital_creator_content", "web", "web_provider", common).ok, false);
  });

  it("never returns an authorized checkout or granted entitlement for ANY input", () => {
    const examples = [
      evaluate("free_surface", "web", "none"),
      evaluate("physical_good", "web", "merchant_direct", physical),
      evaluate("digital_feature", "ios_app_store", "apple_iap", apple),
      evaluate("digital_feature", "google_play", "google_play_billing", google),
      evaluate("digital_subscription", "google_play", "google_us_alternative", googleUS)
    ];
    for (const result of examples) {
      assert.equal(result.checkoutAuthorized, false);
      assert.equal(result.entitlementGranted, false);
      assert.equal(result.sideEffectExecuted, false);
    }
  });
});
