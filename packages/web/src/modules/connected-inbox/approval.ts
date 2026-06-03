import type { AIDraft } from "./contracts.ts";
export function canSendAIDraft(draft: AIDraft) {
  return draft.approved === true;
}
