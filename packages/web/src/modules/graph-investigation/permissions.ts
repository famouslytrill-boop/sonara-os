export function canUseGraphType(type: string, admin: boolean) {
  return (
    admin && !["people_tracking", "police_scanners", "aircraft_private_jet_tracking"].includes(type)
  );
}
