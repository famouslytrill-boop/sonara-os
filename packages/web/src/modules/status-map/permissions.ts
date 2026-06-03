export function canPublishStatusLayer(layer: string) {
  return !["private_person_tracking", "police_scanners", "aircraft_private_jet_tracking"].includes(
    layer
  );
}
