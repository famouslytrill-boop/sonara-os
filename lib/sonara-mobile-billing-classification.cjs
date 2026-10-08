// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Product-and-storefront billing PRE-FLIGHT. This is a pure advisory policy:
// NO charge, redirect, entitlement, payment link, or provider call is created.
// Runtime checkout must separately verify its own signed session, server-owned
// SKU/territory, merchant account, accepted payment method and provider proof.
//
// References as reviewed on 2026-10-08:
// https://developer.apple.com/app-store/review/guidelines/ (3.1.1, 3.1.3)
// https://support.google.com/googleplay/android-developer/answer/9858738
// https://support.google.com/googleplay/android-developer/answer/16497028
// https://support.google.com/googleplay/android-developer/answer/16470497
// Rules and alternative billing programs change: do not treat this as legal
// signoff, regional entitlement, or permission to enable a mobile paywall.

const PLATFORMS = Object.freeze(["web", "ios_app_store", "google_play"]);
const PRODUCT_KINDS = Object.freeze([
  "free_surface", "physical_good", "physical_service",
  "digital_creator_content", "digital_subscription", "digital_feature",
  "in_app_social_boost", "advertising_management", "mixed_cart", "unknown"
]);
const METHODS = Object.freeze([
  "none", "merchant_direct", "web_provider",
  "apple_iap", "apple_us_external_link",
  "google_play_billing", "google_us_alternative", "google_us_external_link"
]);
const DIGITAL = new Set([
  "digital_creator_content", "digital_subscription", "digital_feature",
  "in_app_social_boost"
]);
const PHYSICAL = new Set(["physical_good", "physical_service"]);

// Explicit evidence gates prevent the UI or a seller-supplied field from being
// treated as authoritative. Each boolean must be supplied by independently
// verified SERVER-SIDE configuration and provider/store records.
function classifyMobileBilling({
  platform,
  productKind,
  storefrontCountry,
  method = "none",
  evidence = {}
} = {}) {
  const deny = (code) => Object.freeze({
    ok: false, code, channel: "blocked", checkoutAuthorized: false,
    entitlementGranted: false, sideEffectExecuted: false
  });
  const candidate = (code, channel) => Object.freeze({
    ok: true, code, channel, checkoutAuthorized: false,
    entitlementGranted: false, sideEffectExecuted: false
  });

  if (!PLATFORMS.includes(platform)) return deny("platform_unknown");
  if (!PRODUCT_KINDS.includes(productKind) || productKind === "unknown") {
    return deny("product_classification_required");
  }
  if (productKind === "mixed_cart") return deny("split_mixed_cart_and_review");
  if (!METHODS.includes(method)) return deny("payment_method_unknown");
  if (productKind === "free_surface") {
    return method === "none"
      ? candidate("free_no_payment", "none")
      : deny("free_surface_must_not_charge");
  }

  if (evidence.serverCatalogVerified !== true ||
      evidence.productClassificationApproved !== true) {
    return deny("server_sku_and_classification_unverified");
  }
  // A region argument is not evidence of device location or App Store account
  // storefront. Reject synthetic values before checking approved programs.
  if (platform !== "web" && (
      evidence.storefrontVerified !== true ||
      typeof storefrontCountry !== "string" ||
      !/^[A-Z]{2}$/.test(storefrontCountry))) {
    return deny("storefront_not_verified");
  }

  // Store-sold physical products and real-world services never become platform
  // in-app purchases merely because a checkout is displayed in an app.
  if (PHYSICAL.has(productKind)) {
    if (method !== "merchant_direct") return deny("physical_requires_merchant_checkout");
    if (evidence.merchantIdentityVerified !== true ||
        evidence.outsideAppFulfillmentVerified !== true) {
      return deny("physical_merchant_or_fulfillment_unverified");
    }
    return candidate("external_physical_purchase_candidate", "merchant_direct");
  }

  // A true advertising campaign manager needs legal/product review before
  // using any advertising-management exception. Social post boosts consumed
  // inside the app are explicitly modeled above as digital.
  if (productKind === "advertising_management") {
    return deny("advertising_management_exception_requires_review");
  }

  if (!DIGITAL.has(productKind)) return deny("product_kind_unsupported");

  if (platform === "web") {
    return method === "web_provider" && evidence.webPaymentProviderVerified === true
      ? candidate("web_digital_purchase_candidate", "web_provider")
      : deny("web_digital_payment_provider_unverified");
  }

  if (platform === "ios_app_store") {
    if (method === "apple_iap") {
      return evidence.appleProductVerified === true &&
        evidence.appleTransactionVerifierReady === true
        ? candidate("apple_iap_candidate", "apple_iap")
        : deny("apple_iap_not_verified");
    }
    // Per 2026-10-08 review Apple 3.1.1(a): a link to another method may
    // appear in the US storefront without the external-link entitlement.
    // This authorizes ONLY a separately reviewed link candidate, never
    // direct in-app Stripe checkout or a digital entitlement.
    if (method === "apple_us_external_link") {
      if (storefrontCountry !== "US") return deny("apple_external_link_region_unapproved");
      if (evidence.appleUsExternalLinkReviewed !== true ||
          evidence.destinationOwnedAndApproved !== true) {
        return deny("apple_us_external_link_not_reviewed");
      }
      return candidate("apple_us_external_link_candidate", "external_link_only");
    }
    return deny("ios_digital_billing_method_unapproved");
  }

  if (method === "google_play_billing") {
    return evidence.playProductVerified === true &&
      evidence.playPurchaseVerifierReady === true
      ? candidate("google_play_billing_candidate", "google_play_billing")
      : deny("play_billing_not_verified");
  }
  if (method === "google_us_alternative") {
    if (storefrontCountry !== "US") return deny("google_us_alternative_region_unapproved");
    if (evidence.googleProgramEnrolled !== true ||
        evidence.googleAlternativeBillingApiReady !== true ||
        evidence.googleTransactionReportingReady !== true ||
        evidence.googleDownloadReportingReady !== true ||
        evidence.googleServiceFeesAccepted !== true ||
        evidence.googleCustomerSupportAndRefundsReady !== true) {
      return deny("google_us_alternative_program_not_ready");
    }
    return candidate("google_us_alternative_candidate", "approved_alternative_only");
  }
  // Google US External Content Links is NOT the in-app alternative billing
  // program above. It has separate Play Console enrollment, dedicated external
  // links APIs / information screen, approved destination and reporting.
  // This candidate is only for a digital-purchase link, never an APK download.
  // Download-link distribution requires a separate app-registration contract.
  if (method === "google_us_external_link") {
    if (storefrontCountry !== "US") return deny("google_external_link_region_unapproved");
    if (evidence.googleExternalLinksProgramEnrolled !== true ||
        evidence.googleExternalLinksApiReady !== true ||
        evidence.googleExternalDestinationApproved !== true ||
        evidence.googleExternalPrelinkDisclosureReady !== true ||
        evidence.googleExternalTransactionReportingReady !== true ||
        evidence.googleExternalFeesAccepted !== true ||
        evidence.googleExternalCustomerSupportAndRefundsReady !== true) {
      return deny("google_external_links_program_not_ready");
    }
    return candidate("google_us_external_link_candidate", "external_link_only");
  }
  return deny("android_digital_billing_method_unapproved");
}

module.exports = { PLATFORMS, PRODUCT_KINDS, METHODS, classifyMobileBilling };
