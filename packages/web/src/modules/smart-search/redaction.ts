import type { SearchRecord } from "./contracts.ts";
export function redactSearchRecord(record: SearchRecord): SearchRecord {
  const fields = { ...record.fields };
  for (const field of record.privateFields ?? []) {
    if (field in fields) fields[field] = "[redacted]";
  }
  return { ...record, fields };
}
