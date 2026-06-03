const originals = new Map<string, string>();
export function preserveOriginal(id: string, value: string): string {
  originals.set(id, value);
  return id;
}
export function getOriginal(id: string): string | undefined {
  return originals.get(id);
}
