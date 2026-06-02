export const supabaseStoragePolicy = Object.freeze({
  privateByDefault: true,
  publicRequiresPublishApproval: true,
  blockedContent: Object.freeze([
    "raw payment data",
    "card verification values",
    "provider secrets",
    "private keys",
    "unreviewed executable uploads"
  ]),
  requiredMetadata: Object.freeze([
    "organization_id",
    "owner_id",
    "bucket",
    "purpose",
    "review_status"
  ])
});
