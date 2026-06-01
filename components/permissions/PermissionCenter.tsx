import { permissionRegistry } from "../../lib/permissions/permission-registry";
import { PermissionCard } from "./PermissionCard";

export function PermissionCenter() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Object.entries(permissionRegistry).map(([key, permission]) => (
        <PermissionCard key={key} title={permission.label} body={`${permission.rule} Risk: ${permission.risk}.`} />
      ))}
    </section>
  );
}
