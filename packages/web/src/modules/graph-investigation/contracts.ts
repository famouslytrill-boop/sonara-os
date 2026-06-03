export type AllowedGraphType =
  | "customer_journey"
  | "lead_to_payment"
  | "booking_flow"
  | "file_relationship"
  | "audit_trail"
  | "incident_continuity"
  | "campaign_performance"
  | "creator_project";
export type BlockedGraphType =
  | "people_tracking"
  | "police_scanners"
  | "private_osint_targeting"
  | "conflict_monitoring"
  | "aircraft_private_jet_tracking"
  | "doxxing"
  | "credential_discovery"
  | "surveillance_feeds";
