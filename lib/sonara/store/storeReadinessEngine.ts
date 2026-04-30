import type { StoreProductReadinessInput, StoreProductReadinessResult } from "./storeReadinessTypes";

export function evaluateStoreProductReadiness(input: StoreProductReadinessInput): StoreProductReadinessResult {
  const missing = [
    input.title ? "" : "product title",
    input.description ? "" : "product description",
    typeof input.price === "number" ? "" : "price",
    input.licenseTerms ? "" : "license terms",
    input.previewImage ? "" : "preview image or placeholder",
    input.includedFiles?.length ? "" : "included files list",
    input.refundSupportNote ? "" : "refund/support note",
    input.rightsClassification ? "" : "rights classification",
    input.exportBundleExists ? "" : "export bundle",
    input.hasBlockedSoundAssets ? "remove blocked sound assets" : "",
    input.requiresAttribution && !input.attributionSheetExists ? "attribution sheet" : "",
  ].filter(Boolean);

  if (input.hasBlockedSoundAssets) {
    return { status: "blocked", missing, canPublish: false };
  }

  if (!input.rightsClassification) {
    return { status: "needs_license_review", missing, canPublish: false };
  }

  if ((input.price ?? 0) > 0 && !input.stripePriceId) {
    return { status: "needs_payment_setup", missing: [...missing, "Stripe price ID"], canPublish: false };
  }

  if (missing.length) {
    return { status: "blocked", missing, canPublish: false };
  }

  return { status: "ready", missing: [], canPublish: true };
}
