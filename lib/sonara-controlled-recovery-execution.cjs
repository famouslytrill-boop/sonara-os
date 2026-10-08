// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const {runOneDueRecovery}=require("./sonara-due-recovery-worker.cjs");
const {createPostgresAutonomicOperatorGate}=require("./sonara-postgres-operator-gate.cjs");

// Recommended server-side entry point. The caller cannot replace isPaused with
// an always-allow callback: the database gate is constructed here and is the
// final authorization probe immediately before any external provider effect.
// No scheduler, route or background runner is activated by this module.
async function runOperatorGatedRecovery({
  enabled=false,operatorRpc,worker,authorize,perform,verify,
  clock=()=>Date.now(),nowMs=Date.now()
}={}) {
  if (enabled!==true) return {status:"disabled",reason:"worker_not_activated"};
  let gate;
  try { gate=createPostgresAutonomicOperatorGate({rpc:operatorRpc}); }
  catch { return {status:"escalated",reason:"operator_gate_not_configured"}; }
  return runOneDueRecovery({
    enabled:true,worker,authorize,perform,verify,clock,nowMs,
    isPaused:gate.isPaused
  });
}
module.exports={runOperatorGatedRecovery};
