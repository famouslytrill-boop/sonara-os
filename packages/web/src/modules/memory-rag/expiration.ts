import type { MemoryRecord } from "./contracts.ts";
export function isMemoryExpired(record: MemoryRecord, now = new Date()): boolean {
  return Boolean(record.expiresAt && new Date(record.expiresAt).getTime() <= now.getTime());
}
