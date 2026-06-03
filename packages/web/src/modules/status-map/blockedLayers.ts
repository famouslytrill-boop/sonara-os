export const blockedStatusLayers = [
  "private_person_tracking",
  "police_scanners",
  "aircraft_private_jet_tracking",
  "tactical_osint",
  "conflict_monitoring",
  "surveillance_feeds",
  "doxxing",
  "credential_discovery"
] as const;
export function isBlockedStatusLayer(layer: string): boolean {
  return (blockedStatusLayers as readonly string[]).includes(layer);
}
