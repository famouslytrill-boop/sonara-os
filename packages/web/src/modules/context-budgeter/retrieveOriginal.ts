import { getOriginal } from "./preserveOriginals.ts";
export function retrieveOriginal(id: string): string | undefined {
  return getOriginal(id);
}
