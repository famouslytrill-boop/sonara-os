const defaults = [
  "parent-company",
  "creator-music-technology",
  "business-operations",
  "community-public-information",
];

console.log("Entity default seed preview");
console.log("===========================");
console.log("This script is idempotent by design but does not connect to production without explicit database setup.");
console.log("Apply supabase/migrations/008_entity_agent_operations.sql first, then seed through a trusted server/service-role workflow.");
console.log("\nDefault entity slugs:");
for (const slug of defaults) {
  console.log(`- ${slug}`);
}
console.log("\nsetup_required: no database URL/service role is read by this script.");
