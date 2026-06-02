export const tenantRlsPolicy = Object.freeze({
  membershipTable: "public.organization_members",
  organizationTable: "public.organizations",
  publicIntakeTables: Object.freeze(["support_requests", "feedback_reports"]),
  privateTenantTables: Object.freeze([
    "customer_records",
    "proof_profiles",
    "payment_options",
    "booking_links",
    "smart_intake_forms",
    "offers",
    "reviews",
    "money_path_events",
    "files_records",
    "external_connections",
    "feature_flags",
    "approval_events"
  ]),
  rules: Object.freeze([
    "Anonymous users may only insert safe public intake records.",
    "Anonymous users cannot read tenant records.",
    "Private tenant reads require active organization membership.",
    "Admin writes require owner/admin membership or server-side service-role execution.",
    "No private table may use broad USING (true) policies."
  ])
});
