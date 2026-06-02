import { storageBucketRegistry } from "./storage-bucket-registry.ts";

export const uploadSafetyPolicy = Object.freeze({
  executableUploadsAllowed: false,
  rawPaymentDataAllowed: false,
  secretsAllowed: false,
  privateByDefault: true,
  requiredMetadata: Object.freeze([
    "organization_id",
    "owner_id",
    "bucket",
    "purpose",
    "review_status"
  ]),
  buckets: storageBucketRegistry
});
