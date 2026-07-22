"use strict";

const FACEBOOK_REFERENCE_URLS = Object.freeze([
  "https://www.facebook.com/share/r/1KQxNqHHtk/",
  "https://www.facebook.com/share/r/18kbRrGnSF/",
  "https://www.facebook.com/share/r/1Ew8qgjUUD/",
  "https://www.facebook.com/share/r/1D7gsWoezN/",
  "https://www.facebook.com/share/r/1Euj21Yaxr/",
  "https://www.facebook.com/share/r/1DEMLpuhCs/",
  "https://www.facebook.com/share/r/1HK1qH15UX/",
  "https://www.facebook.com/share/r/18xkkdkPNU/",
  "https://www.facebook.com/share/r/1EtExfWGPN/",
  "https://www.facebook.com/share/r/1Gs9aQeZq9/",
  "https://www.facebook.com/share/r/17mMTqcYoU/",
  "https://www.facebook.com/share/r/1EqZRWp51h/",
  "https://www.facebook.com/share/r/1E5YwdPppB/",
  "https://www.facebook.com/share/r/1QD5UwYLxA/",
  "https://www.facebook.com/share/r/1DFgNvc4gG/",
  "https://www.facebook.com/share/r/195brCwjHS/",
  "https://www.facebook.com/reel/1033494375776634",
  "https://www.facebook.com/share/v/14hzwD6CB2L/",
  "https://www.facebook.com/share/r/1Ch3SDPZg3/",
  "https://www.facebook.com/share/r/1cGzn1P6BP/",
  "https://www.facebook.com/share/r/1E9GP6KV1T/",
  "https://www.facebook.com/share/r/1E1DwZDnfu/",
  "https://www.facebook.com/share/r/18k6PECJRF/",
  "https://www.facebook.com/share/r/14hrZWWnzip/",
  "https://www.facebook.com/share/r/18tsiNz2fq/",
  "https://www.facebook.com/reel/1660071461709500",
  "https://www.facebook.com/share/r/1Jb4MMAGHV/"
]);

const CANDIDATE_PRODUCTS = Object.freeze([
  "business_builder",
  "creator_studio",
  "growth_studio"
]);

const FACEBOOK_REFERENCE_CATALOG = Object.freeze(
  FACEBOOK_REFERENCE_URLS.map((sourceUrl, index) => {
    const parsed = classifyFacebookUrl(sourceUrl);
    return Object.freeze({
      id: `facebook-reference-${String(index + 1).padStart(2, "0")}`,
      platform: "facebook",
      sourceType: parsed.sourceType,
      externalId: parsed.externalId,
      sourceUrl,
      verificationStatus: "requires_authenticated_source_review",
      accessStatus: "public_fetch_blocked",
      rightsStatus: "unknown",
      candidateProducts: CANDIDATE_PRODUCTS,
      requestedAt: "2026-07-22"
    });
  })
);

const REFERENCE_PRODUCT_FRAMEWORK = Object.freeze({
  business_builder: Object.freeze({
    label: "Business Builder",
    reviewDimensions: Object.freeze([
      "offer design", "pricing", "sales process", "customer experience",
      "operations", "automation", "proof"
    ]),
    allowedOutputs: Object.freeze([
      "verified pattern", "testable workflow hypothesis",
      "operating checklist", "feature requirement"
    ])
  }),
  creator_studio: Object.freeze({
    label: "Creator Studio",
    reviewDimensions: Object.freeze([
      "hook", "story structure", "format", "editing",
      "audio", "visual language", "rights", "release workflow"
    ]),
    allowedOutputs: Object.freeze([
      "original format brief", "production checklist",
      "rights review", "content experiment"
    ])
  }),
  growth_studio: Object.freeze({
    label: "Growth Studio",
    reviewDimensions: Object.freeze([
      "audience", "channel", "message", "call to action",
      "proof", "cadence", "conversion hypothesis", "compliance"
    ]),
    allowedOutputs: Object.freeze([
      "campaign hypothesis", "consent-safe follow-up plan",
      "measurement plan", "approved content brief"
    ])
  })
});

function classifyFacebookUrl(sourceUrl) {
  const reelMatch = sourceUrl.match(/\/reel\/(\d+)/);
  if (reelMatch) return { sourceType: "reel", externalId: reelMatch[1] };

  const sharedVideoMatch = sourceUrl.match(/\/share\/v\/([^/]+)/);
  if (sharedVideoMatch) return { sourceType: "shared_video", externalId: sharedVideoMatch[1] };

  const sharedReelMatch = sourceUrl.match(/\/share\/r\/([^/]+)/);
  if (sharedReelMatch) return { sourceType: "shared_reel", externalId: sharedReelMatch[1] };

  return { sourceType: "unknown", externalId: "" };
}

module.exports = {
  FACEBOOK_REFERENCE_CATALOG,
  FACEBOOK_REFERENCE_URLS,
  REFERENCE_PRODUCT_FRAMEWORK
};
