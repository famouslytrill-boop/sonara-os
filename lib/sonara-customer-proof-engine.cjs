// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

// Evidence/proof packet classification. A hash proves byte equality, not truth.
// A customer statement proves attribution only when identity + exact text are
// verified. External provider/bank evidence must be independently obtained.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const TYPES=Object.freeze(new Set([
  "self_attestation","customer_confirmation","signed_document","file_hash",
  "completion_event","provider_event","bank_deposit","human_review"
]));
const INDEPENDENT=new Set(["provider_event","bank_deposit"]);
const ATTRIBUTABLE=new Set(["customer_confirmation","signed_document"]);
function proofPacket({
  organizationId,serverOrganizationId,claimHash,requiredEvidenceTypes=[],evidence=[]
}={}){
  const issues=[];
  if(!UUID.test(organizationId||"")||organizationId!==serverOrganizationId)issues.push("tenant_scope_unverified");
  if(!SHA.test(claimHash||""))issues.push("claim_hash_invalid");
  if(!Array.isArray(requiredEvidenceTypes)||requiredEvidenceTypes.some(x=>!TYPES.has(x)))
    issues.push("required_evidence_type_invalid");
  const verified=[];
  const seen=new Set();
  for(const row of Array.isArray(evidence)?evidence:[]){
    if(!row||!UUID.test(row.id||"")||seen.has(row.id)){issues.push("duplicate_or_invalid_evidence_id");continue;}
    seen.add(row.id);
    if(!TYPES.has(row.type)){issues.push("evidence_type_invalid");continue;}
    if(typeof row.sourceRef!=="string"||!/^[A-Za-z0-9._:-]{3,160}$/.test(row.sourceRef)){
      issues.push("evidence_source_ref_invalid");continue;
    }
    if(row.claimHash!==claimHash){issues.push("evidence_claim_hash_mismatch");continue;}
    if(row.hashVerified!==true){issues.push("evidence_hash_unverified");continue;}
    if(row.type==="file_hash"){
      verified.push({...row,truthAuthority:false,attributionAuthority:false,independent:false});continue;
    }
    if(INDEPENDENT.has(row.type)&&row.independentlyRetrieved!==true){
      issues.push("independent_evidence_not_independently_retrieved");continue;
    }
    if(ATTRIBUTABLE.has(row.type)&&row.actorIdentityVerified!==true){
      issues.push("attribution_identity_unverified");continue;
    }
    verified.push({...row,
      truthAuthority:INDEPENDENT.has(row.type),
      attributionAuthority:ATTRIBUTABLE.has(row.type),
      independent:INDEPENDENT.has(row.type)});
  }
  const requiredUnique=[...new Set(requiredEvidenceTypes)];
  const covered=requiredUnique.filter(type=>verified.some(row=>row.type===type));
  const coverage=requiredUnique.length?Math.floor(covered.length*10000/requiredUnique.length):0;
  const independentCount=verified.filter(x=>x.independent).length;
  const attributable=verified.some(x=>x.attributionAuthority);
  let tier="claimed_only";
  if(independentCount>=1)tier="independently_verified";
  else if(verified.filter(x=>x.type!=="file_hash").length>=2)tier="corroborated";
  else if(attributable)tier="attributable";
  const complete=requiredUnique.length>0&&coverage===10000&&issues.length===0;
  return Object.freeze({
    state:issues.length?"evidence_review_required":complete?"required_evidence_complete":"evidence_incomplete",
    issues:Object.freeze([...new Set(issues)]),
    verificationTier:tier,requiredCoverageBasisPoints:coverage,
    requiredCovered:Object.freeze(covered),requiredMissing:Object.freeze(requiredUnique.filter(x=>!covered.includes(x))),
    verifiedEvidenceCount:verified.length,independentEvidenceCount:independentCount,
    claimTruthCertified:false,marketingClaimAuthorized:false,paymentConfirmed:false,
    cryptographicHashIsTruthProof:false
  });
}
function marketingProofGate({
  packet,customerReviewIncluded=false,customerExactTextApproved=false,
  materialRelationshipDisclosed=false,usesQuantifiedPerformanceClaim=false,
  performanceClaimEvidenceVerified=false
}={}){
  const blockers=[];
  if(!packet||packet.state!=="required_evidence_complete")blockers.push("proof_packet_incomplete");
  if(customerReviewIncluded&&customerExactTextApproved!==true)blockers.push("customer_review_exact_text_not_approved");
  if(customerReviewIncluded&&materialRelationshipDisclosed!==true)blockers.push("review_relationship_disclosure_unverified");
  if(usesQuantifiedPerformanceClaim&&performanceClaimEvidenceVerified!==true)
    blockers.push("quantified_claim_evidence_unverified");
  return Object.freeze({
    state:blockers.length?"marketing_proof_blocked":"marketing_proof_review_ready",
    blockers:Object.freeze(blockers),publicationAuthorized:false,
    representativeResultsClaimed:false
  });
}
module.exports={TYPES,proofPacket,marketingProofGate};
