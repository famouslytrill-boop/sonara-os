// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Service-role-only, read-only execution gate. Importing this module has no
// side effects. The database owns tenant permissions, claim state and fences.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function createPostgresAutonomicOperatorGate({rpc}={}) {
  if (typeof rpc!=="function") throw TypeError("server_side_rpc_required");
  return Object.freeze({
    async isPaused(context) {
      if (!context || !UUID.test(context.jobId||"") ||
          !UUID.test(context.claimToken||"") ||
          !Number.isSafeInteger(context.fencingToken) ||
          context.fencingToken<1) return true;
      try {
        const result=await rpc("sonara_autonomic_execution_permitted",{
          p_job_id:context.jobId,
          p_claim_token:context.claimToken,
          p_fencing_token:context.fencingToken
        });
        // Ambiguous, missing, malformed, or failed DB reads DENY the effect.
        return !(result && result.error==null && result.data===true);
      } catch {
        return true;
      }
    }
  });
}
module.exports={createPostgresAutonomicOperatorGate};
