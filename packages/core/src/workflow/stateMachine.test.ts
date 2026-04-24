import { describe, expect, it } from "vitest";
import { WorkflowEvents, createWorkflowStateMachine } from "./stateMachine.ts";

describe("workflow state machine", () => {
  it("advances through the sprint workflow path", () => {
    const machine = createWorkflowStateMachine();

    machine.send(WorkflowEvents.START_SESSION);
    machine.send(WorkflowEvents.COMPLETE_ANALYSIS);
    machine.send(WorkflowEvents.COMPLETE_COMPOSE);
    machine.send(WorkflowEvents.RECORD_DECISION);
    machine.send(WorkflowEvents.PREPARE_EXPORT);

    expect(machine.getState()).toBe("export-ready");
    expect(machine.getHistory()).toHaveLength(5);
  });

  it("rejects invalid transitions", () => {
    const machine = createWorkflowStateMachine();

    expect(() => machine.send(WorkflowEvents.PREPARE_EXPORT)).toThrow(
      "Invalid workflow transition"
    );
  });
});
