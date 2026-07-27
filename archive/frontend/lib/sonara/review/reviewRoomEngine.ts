import type { ReviewRoomResult } from "./reviewRoomTypes";

export function buildReviewRoom(): ReviewRoomResult {
  return {
    reviewFocus: ["hook clarity", "runtime discipline", "rights notes", "metadata readiness", "export completeness"],
    collaboratorQuestions: ["What is the strongest listener moment?", "What rights evidence is still missing?", "What should change before release export?"],
    approvalChecklist: ["No private demo names", "No unverified copyright claims", "No fake outcome guarantees", "Legal footer included"],
    blockedClaims: ["playlist guarantee", "streaming guarantee", "bot growth", "automatic distribution"],
  };
}
