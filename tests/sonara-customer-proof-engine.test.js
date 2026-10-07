// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const {proofPacket,marketingProofGate}=require("../lib/sonara-customer-proof-engine.cjs");
const ORG="11111111-1111-4111-8111-111111111111";
const H="a".repeat(64);
const row=(id,type,o={})=>({id,type,sourceRef:"source_"+id.slice(0,8),claimHash:H,
  hashVerified:true,independentlyRetrieved:false,actorIdentityVerified:false,...o});
describe("customer proof/evidence packets",()=>{
  it("treats a file hash as integrity evidence, not truth proof",()=>{
    const p=proofPacket({organizationId:ORG,serverOrganizationId:ORG,claimHash:H,
      requiredEvidenceTypes:["file_hash"],evidence:[row("22222222-2222-4222-8222-222222222222","file_hash")]});
    assert.equal(p.cryptographicHashIsTruthProof,false);
    assert.equal(p.claimTruthCertified,false);
  });
  it("requires independent retrieval for provider/bank evidence",()=>{
    const p=proofPacket({organizationId:ORG,serverOrganizationId:ORG,claimHash:H,
      requiredEvidenceTypes:["provider_event"],evidence:[row("22222222-2222-4222-8222-222222222222","provider_event")]});
    assert.ok(p.issues.includes("independent_evidence_not_independently_retrieved"));
  });
  it("recognizes independently verified external evidence as its own tier",()=>{
    const p=proofPacket({organizationId:ORG,serverOrganizationId:ORG,claimHash:H,
      requiredEvidenceTypes:["provider_event"],evidence:[row("22222222-2222-4222-8222-222222222222","provider_event",{independentlyRetrieved:true})]});
    assert.equal(p.verificationTier,"independently_verified");
    assert.equal(p.requiredCoverageBasisPoints,10000);
  });
  it("requires verified identity for customer attribution",()=>{
    const p=proofPacket({organizationId:ORG,serverOrganizationId:ORG,claimHash:H,
      requiredEvidenceTypes:["customer_confirmation"],evidence:[row("22222222-2222-4222-8222-222222222222","customer_confirmation")]});
    assert.ok(p.issues.includes("attribution_identity_unverified"));
  });
  it("marks verified customer confirmation attributable, not independently verified",()=>{
    const p=proofPacket({organizationId:ORG,serverOrganizationId:ORG,claimHash:H,
      requiredEvidenceTypes:["customer_confirmation"],evidence:[row("22222222-2222-4222-8222-222222222222","customer_confirmation",{actorIdentityVerified:true})]});
    assert.equal(p.verificationTier,"attributable");
    assert.equal(p.independentEvidenceCount,0);
  });
  it("computes objective required-evidence coverage instead of a truth score",()=>{
    const p=proofPacket({organizationId:ORG,serverOrganizationId:ORG,claimHash:H,
      requiredEvidenceTypes:["customer_confirmation","provider_event"],evidence:[
        row("22222222-2222-4222-8222-222222222222","customer_confirmation",{actorIdentityVerified:true})
      ]});
    assert.equal(p.requiredCoverageBasisPoints,5000);
    assert.deepEqual(p.requiredMissing,["provider_event"]);
  });
  it("rejects evidence attached to a different claim snapshot",()=>{
    const p=proofPacket({organizationId:ORG,serverOrganizationId:ORG,claimHash:H,
      requiredEvidenceTypes:["file_hash"],evidence:[row("22222222-2222-4222-8222-222222222222","file_hash",{claimHash:"b".repeat(64)})]});
    assert.ok(p.issues.includes("evidence_claim_hash_mismatch"));
  });
  it("requires complete packet before marketing proof can be reviewed",()=>{
    const p=proofPacket({organizationId:ORG,serverOrganizationId:ORG,claimHash:H,
      requiredEvidenceTypes:["provider_event"],evidence:[]});
    assert.ok(marketingProofGate({packet:p}).blockers.includes("proof_packet_incomplete"));
  });
  it("requires exact customer approval before using a customer review as marketing proof",()=>{
    const p=proofPacket({organizationId:ORG,serverOrganizationId:ORG,claimHash:H,
      requiredEvidenceTypes:["customer_confirmation"],evidence:[
        row("22222222-2222-4222-8222-222222222222","customer_confirmation",{actorIdentityVerified:true})
      ]});
    const g=marketingProofGate({packet:p,customerReviewIncluded:true,
      customerExactTextApproved:false,materialRelationshipDisclosed:true});
    assert.ok(g.blockers.includes("customer_review_exact_text_not_approved"));
  });
  it("never turns proof review into automatic public publication",()=>{
    const p=proofPacket({organizationId:ORG,serverOrganizationId:ORG,claimHash:H,
      requiredEvidenceTypes:["provider_event"],evidence:[
        row("22222222-2222-4222-8222-222222222222","provider_event",{independentlyRetrieved:true})
      ]});
    const g=marketingProofGate({packet:p});
    assert.equal(g.state,"marketing_proof_review_ready");
    assert.equal(g.publicationAuthorized,false);
  });
});
