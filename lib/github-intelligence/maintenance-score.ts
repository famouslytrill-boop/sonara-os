export function maintenanceScore({ archived, monthsSincePush }: { archived?: boolean; monthsSincePush?: number }) {
  if (archived) return 0;
  if ((monthsSincePush ?? 0) > 24) return 20;
  if ((monthsSincePush ?? 0) > 12) return 50;
  return 80;
}
