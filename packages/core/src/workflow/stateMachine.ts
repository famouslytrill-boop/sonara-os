import { WorkflowStates } from "../lib/types.ts";

export const WorkflowEvents = Object.freeze({
  START_SESSION: "START_SESSION",
  COMPLETE_ANALYSIS: "COMPLETE_ANALYSIS",
  COMPLETE_COMPOSE: "COMPLETE_COMPOSE",
  RECORD_DECISION: "RECORD_DECISION",
  PREPARE_EXPORT: "PREPARE_EXPORT",
  ARCHIVE: "ARCHIVE",
  RESET: "RESET"
});

export const WorkflowTransitions = Object.freeze({
  idle: Object.freeze({
    START_SESSION: "session-started"
  }),
  "session-started": Object.freeze({
    COMPLETE_ANALYSIS: "analysis-ready",
    RESET: "idle"
  }),
  "analysis-ready": Object.freeze({
    COMPLETE_COMPOSE: "compose-ready",
    RESET: "idle"
  }),
  "compose-ready": Object.freeze({
    RECORD_DECISION: "decision-ready",
    RESET: "idle"
  }),
  "decision-ready": Object.freeze({
    PREPARE_EXPORT: "export-ready",
    COMPLETE_COMPOSE: "compose-ready",
    RESET: "idle"
  }),
  "export-ready": Object.freeze({
    ARCHIVE: "archived",
    RESET: "idle"
  }),
  archived: Object.freeze({
    RESET: "idle"
  })
});

export function createWorkflowStateMachine(initialState = "idle") {
  assertWorkflowState(initialState);
  let state = initialState;
  const history = [];

  function getState() {
    return state;
  }

  function can(eventName) {
    return Boolean(WorkflowTransitions[state]?.[eventName]);
  }

  function send(eventName, metadata = {}) {
    const nextState = WorkflowTransitions[state]?.[eventName];
    if (!nextState) {
      throw new Error(`Invalid workflow transition: ${state} -> ${eventName}`);
    }
    const entry = Object.freeze({
      from: state,
      eventName,
      to: nextState,
      metadata: Object.freeze({ ...metadata }),
      at: new Date().toISOString()
    });
    history.push(entry);
    state = nextState;
    return entry;
  }

  return Object.freeze({
    getState,
    can,
    send,
    getHistory() {
      return Object.freeze(history.slice());
    }
  });
}

export function assertWorkflowState(state) {
  if (!WorkflowStates.includes(state)) {
    throw new Error(`Unknown workflow state: ${state}`);
  }
}
