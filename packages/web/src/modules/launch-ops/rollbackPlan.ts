export function hasRollbackNotes(notes?: string): boolean {
  return Boolean(notes && notes.trim().length > 10);
}
