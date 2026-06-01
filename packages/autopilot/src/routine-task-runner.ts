import { createActionQueue } from "./action-queue.ts";
import type { WorkflowRecordInput } from "./types.ts";

export function createRoutineTaskRunner(queue = createActionQueue()) {
  function run(input: WorkflowRecordInput) {
    const result = queue.queueAction(input);
    if (result.canRun) {
      queue.completeAction(result.record.id);
    }
    return Object.freeze({
      ...result,
      state: queue.getState()
    });
  }

  return Object.freeze({ run, queue });
}
