export function buildContactDedupeKey(email?: string, phone?: string) {
  return `${email ?? ""}|${phone ?? ""}`.toLowerCase();
}
