export type StorageBucketAccess = "public_read" | "private";

export type StorageBucketRecord = Readonly<{
  id: string;
  purpose: string;
  access: StorageBucketAccess;
  publishApprovalRequired: boolean;
  maxFileSizeMb: number;
}>;

export const storageBucketRegistry: readonly StorageBucketRecord[] = Object.freeze([
  bucket("sonara-public-assets", "Approved public website and product assets", "public_read", 25),
  bucket("sonara-private-files", "Private tenant files and records", "private", 100),
  bucket("business-builder-documents", "Business Builder documents and uploads", "private", 100),
  bucket("creator-studio-media", "Creator Studio media under rights review", "private", 500),
  bucket(
    "growth-studio-imports",
    "Growth Studio imports and campaign source files",
    "private",
    100
  ),
  bucket(
    "research-lab-sources",
    "Research Lab source references and review artifacts",
    "private",
    100
  ),
  bucket("support-attachments", "Support request attachments", "private", 25),
  bucket("generated-media", "Generated media requiring rights and publish review", "private", 500),
  bucket("exports", "User-requested exports with expiration policy", "private", 250),
  bucket("vector-knowledge", "Derived knowledge chunks and embeddings metadata", "private", 100)
]);

function bucket(
  id: string,
  purpose: string,
  access: StorageBucketAccess,
  maxFileSizeMb: number
): StorageBucketRecord {
  return Object.freeze({
    id,
    purpose,
    access,
    publishApprovalRequired: access === "public_read",
    maxFileSizeMb
  });
}
