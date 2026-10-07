// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert=require("node:assert/strict");
const {approvalPlan,evaluateApprovalBoard}=require("../lib/sonara-customer-approval-board.cjs");
const ORG="11111111-1111-4111-8111-111111111111";
const REQ="22222222-2222-4222-8222-222222222222";
const U1="33333333-3333-4333-8333-333333333333";
const U2="44444444-4444-4444-8444-444444444444";
const D1="55555555-5555-4555-8555-555555555555";
const D2="66666666-6666-4666-8666-666666666666";
const HASH="a".repeat(64);
const base=(o={})=>({
 organizationId:ORG,serverOrganizationId:ORG,riskClass:"financial_change",
 requestId:REQ,proposalSnapshotHash:HASH,
 requestedAt:"2026-10-07T06:00:00Z",expiresAt:"2026-10-07T07:00:00Z",
 proposedByUserId:U1,eligibleHumanApproverCount:2,soloOwnerMode:false,
 decisions:[
  {id:D1,organizationId:ORG,requestId:REQ,userId:U1,role:"owner",status:"approved",snapshotHash:HASH,decidedAt:"2026-10-07T06:05:00Z"},
  {id:D2,organizationId:ORG,requestId:REQ,userId:U2,role:"admin",status:"approved",snapshotHash:HASH,decidedAt:"2026-10-07T06:06:00Z"}
 ],
 stepUpVerified:true,independentChannelVerified:true,...o
});
describe("customer-owned approval board",()=>{
 it("uses dual control for high-risk actions when two approvers exist",()=>{
   const p=approvalPlan({riskClass:"financial_change",eligibleHumanApproverCount:2});
   assert.equal(p.mode,"dual_control"); assert.equal(p.requiredDistinctApprovals,2);
 });
 it("does not let proposer satisfy dual-control quorum",()=>{
   const out=evaluateApprovalBoard(base());
   assert.ok(out.blockers.includes("proposer_cannot_satisfy_dual_control_quorum"));
   assert.equal(out.executionAuthorized,false);
 });
 it("passes dual control when two approvers are independent of the proposer",()=>{
   const U3="77777777-7777-4777-8777-777777777777";
   const out=evaluateApprovalBoard(base({proposedByUserId:U3}));
   assert.equal(out.state,"approval_evidence_ready");
   assert.equal(out.validApprovalCount,2);
 });
 it("rejects cross-tenant or cross-request approval replay",()=>{
   const U3="77777777-7777-4777-8777-777777777777";
   let rows=base().decisions.map((x,i)=>i?{...x,organizationId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}:x);
   let out=evaluateApprovalBoard(base({proposedByUserId:U3,decisions:rows}));
   assert.ok(out.blockers.includes("decision_tenant_mismatch"));
   rows=base().decisions.map((x,i)=>i?{...x,requestId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}:x);
   out=evaluateApprovalBoard(base({proposedByUserId:U3,decisions:rows}));
   assert.ok(out.blockers.includes("decision_request_mismatch"));
 });
 it("requires exact immutable proposal snapshot match",()=>{
   const rows=base().decisions.map((x,i)=>i?{...x,snapshotHash:"b".repeat(64)}:x);
   const out=evaluateApprovalBoard(base({proposedByUserId:"77777777-7777-4777-8777-777777777777",decisions:rows}));
   assert.ok(out.blockers.includes("decision_for_different_snapshot"));
 });
 it("requires step-up and independent-channel evidence for financial change",()=>{
   let out=evaluateApprovalBoard(base({proposedByUserId:"77777777-7777-4777-8777-777777777777",stepUpVerified:false}));
   assert.ok(out.blockers.includes("step_up_authentication_missing"));
   out=evaluateApprovalBoard(base({proposedByUserId:"77777777-7777-4777-8777-777777777777",independentChannelVerified:false}));
   assert.ok(out.blockers.includes("independent_channel_confirmation_missing"));
 });
 it("blocks expired or pre-request decisions",()=>{
   const rows=base().decisions.map((x,i)=>i?{...x,decidedAt:"2026-10-07T08:00:00Z"}:x);
   const out=evaluateApprovalBoard(base({proposedByUserId:"77777777-7777-4777-8777-777777777777",decisions:rows}));
   assert.ok(out.blockers.includes("decision_timestamp_outside_window"));
 });
 it("permits explicit solo-owner mode with delayed reconfirmation instead of fake second person",()=>{
   const p=approvalPlan({riskClass:"legal_commitment",eligibleHumanApproverCount:1,soloOwnerMode:true});
   assert.equal(p.mode,"solo_owner_step_up");
   assert.equal(p.residualRisk,"no_independent_second_human");
 });
 it("requires solo owner to reconfirm after a delay",()=>{
   const one=[{id:D1,organizationId:ORG,requestId:REQ,userId:U1,role:"owner",status:"approved",snapshotHash:HASH,decidedAt:"2026-10-07T06:01:00Z"}];
   let out=evaluateApprovalBoard(base({eligibleHumanApproverCount:1,soloOwnerMode:true,decisions:one,
     independentChannelVerified:true,soloSecondConfirmationAt:"2026-10-07T06:02:00Z"}));
   assert.ok(out.blockers.includes("delayed_owner_reconfirmation_missing"));
   out=evaluateApprovalBoard(base({eligibleHumanApproverCount:1,soloOwnerMode:true,decisions:one,
     independentChannelVerified:true,soloSecondConfirmationAt:"2026-10-07T06:06:00Z"}));
   assert.equal(out.state,"approval_evidence_ready");
 });
 it("does not invent a second-human option when solo mode was never chosen",()=>{
   assert.equal(approvalPlan({riskClass:"security_change",eligibleHumanApproverCount:1,soloOwnerMode:false}).ok,false);
 });
 it("routine private actions can use one human and no step-up",()=>{
   const p=approvalPlan({riskClass:"routine_private",eligibleHumanApproverCount:1});
   assert.equal(p.mode,"single_human"); assert.equal(p.stepUpRequired,false);
 });
 it("a decline blocks even if quorum otherwise exists",()=>{
   const rows=[...base().decisions,{id:"88888888-8888-4888-8888-888888888888",
     organizationId:ORG,requestId:REQ,userId:"99999999-9999-4999-8999-999999999999",role:"owner",status:"declined",
     snapshotHash:HASH,decidedAt:"2026-10-07T06:07:00Z"}];
   const out=evaluateApprovalBoard(base({proposedByUserId:"77777777-7777-4777-8777-777777777777",decisions:rows}));
   assert.ok(out.blockers.includes("board_declined"));
 });
 it("never converts board evidence into execution authority",()=>{
   const out=evaluateApprovalBoard(base({proposedByUserId:"77777777-7777-4777-8777-777777777777"}));
   assert.equal(out.executionAuthorized,false);
 });
});
