import type { LicenseClassification } from "./soundSourceTypes";

export function classifySoundLicense(license: string, options: { userAttestedOwnership?: boolean; hasCommercialProof?: boolean } = {}): LicenseClassification {
  const normalized = license.trim().toLowerCase();

  if (options.userAttestedOwnership || normalized === "user_owned") {
    return {
      redistributionCategory: "user_owned",
      commercialUseAllowed: true,
      redistributionAllowed: true,
      attributionRequired: false,
      exportStatus: "approved",
      warnings: ["User-owned assets require ownership/license attestation before paid product packaging."],
    };
  }

  if (/(cc0|public domain|public_domain)/i.test(normalized)) {
    return {
      redistributionCategory: "redistributable",
      commercialUseAllowed: true,
      redistributionAllowed: true,
      attributionRequired: false,
      exportStatus: "approved",
      warnings: ["Verify source page and preserve license URL before export."],
    };
  }

  if (/(cc by-nc|noncommercial|non-commercial)/i.test(normalized)) {
    return {
      redistributionCategory: "non_commercial_only",
      commercialUseAllowed: false,
      redistributionAllowed: false,
      attributionRequired: true,
      exportStatus: "non_commercial_only",
      warnings: ["NonCommercial assets are blocked from paid/commercial packs without separate permission."],
    };
  }

  if (/(cc by-nd|no derivatives|noderivatives)/i.test(normalized)) {
    return {
      redistributionCategory: "unknown_blocked",
      commercialUseAllowed: false,
      redistributionAllowed: false,
      attributionRequired: true,
      exportStatus: "blocked",
      warnings: ["NoDerivatives assets are blocked for remix, sample-pack, and derivative export use."],
    };
  }

  if (/(cc by-sa|sharealike|share-alike)/i.test(normalized)) {
    return {
      redistributionCategory: "attribution_required",
      commercialUseAllowed: true,
      redistributionAllowed: true,
      attributionRequired: true,
      exportStatus: "requires_attribution",
      warnings: ["Share-alike terms may affect downstream packaging; include attribution and legal review notes."],
    };
  }

  if (/(cc by|creative commons attribution)/i.test(normalized)) {
    return {
      redistributionCategory: "attribution_required",
      commercialUseAllowed: true,
      redistributionAllowed: true,
      attributionRequired: true,
      exportStatus: "requires_attribution",
      warnings: ["Attribution sheet is required before export."],
    };
  }

  if (/(music use only|royalty-free music-use-only|finished song only)/i.test(normalized)) {
    return {
      redistributionCategory: "music_use_only",
      commercialUseAllowed: true,
      redistributionAllowed: false,
      attributionRequired: false,
      exportStatus: "music_use_only_no_repack",
      warnings: ["Allowed for finished music use only; blocked from raw sample-pack export."],
    };
  }

  if (/(research|education|educational)/i.test(normalized)) {
    return {
      redistributionCategory: "research_education_only",
      commercialUseAllowed: false,
      redistributionAllowed: false,
      attributionRequired: true,
      exportStatus: "research_only",
      warnings: ["Research/education-only assets are blocked from commercial export."],
    };
  }

  if (/(commercial license|paid license|license required)/i.test(normalized)) {
    return {
      redistributionCategory: "commercial_license_required",
      commercialUseAllowed: Boolean(options.hasCommercialProof),
      redistributionAllowed: Boolean(options.hasCommercialProof),
      attributionRequired: false,
      exportStatus: options.hasCommercialProof ? "approved" : "commercial_license_required",
      warnings: options.hasCommercialProof ? ["Keep proof of license with the export bundle."] : ["Commercial license proof is required before export."],
    };
  }

  return {
    redistributionCategory: "unknown_blocked",
    commercialUseAllowed: false,
    redistributionAllowed: false,
    attributionRequired: false,
    exportStatus: "blocked",
    warnings: ["Unknown license is blocked until manual rights review is complete."],
  };
}
