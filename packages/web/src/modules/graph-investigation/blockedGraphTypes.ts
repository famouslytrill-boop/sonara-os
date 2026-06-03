export const blockedGraphTypes = [
  "people_tracking",
  "police_scanners",
  "private_osint_targeting",
  "conflict_monitoring",
  "aircraft_private_jet_tracking",
  "doxxing",
  "credential_discovery",
  "surveillance_feeds"
] as const;
export function isBlockedGraphType(type: string): boolean {
  return (blockedGraphTypes as readonly string[]).includes(type);
}
