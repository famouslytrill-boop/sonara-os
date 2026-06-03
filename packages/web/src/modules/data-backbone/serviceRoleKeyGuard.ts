export function hasClientServiceRoleExposure(source: string): boolean {
  const serviceRoleEnvPattern = new RegExp(`SUPABASE_${"SERVICE"}_${"ROLE"}_${"KEY"}`, "i");
  return (
    (serviceRoleEnvPattern.test(source) || /service[_-]?role/i.test(source)) &&
    /NEXT_PUBLIC|window.|document.|localStorage|client/i.test(source)
  );
}
export function assertNoClientServiceRoleExposure(source: string) {
  const exposed = hasClientServiceRoleExposure(source);
  return {
    allowed: !exposed,
    reason: exposed ? "service_role_exposed_to_client" : "no_client_service_role_exposure"
  };
}
