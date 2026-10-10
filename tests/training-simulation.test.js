// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert=require("node:assert/strict");
const { PACKS,simulateTrainingScenario }=require("../lib/sonara-training-simulation.cjs");
const run=(changes={})=>simulateTrainingScenario({mode:"fictional_training",scenario:"restaurant_shift",
  startingPoints:100,startingStock:5,turns:[
    {action:"fulfill",units:3},{action:"replenish",units:4},{action:"pass",units:0}
  ],...changes});
describe("deterministic non-wagering resource exercises",()=>{
  it("accounts for every training turn and conserved resources",()=>{
    const x=run();
    assert.equal(x.ok,true);assert.equal(x.remainingPoints,82);
    assert.equal(x.remainingStock,6);assert.equal(x.completedUnits,3);
    assert.equal(x.trainingScore,21);assert.equal(x.history.length,3);
    assert.equal(x.history[0].remainingPoints,94);
  });
  it("produces identical results for identical input",()=>assert.deepEqual(run(),run()));
  it("labels every result as fictional, nonredeemable and nonexecuting",()=>{
    const x=run();
    for(const key of ["monetaryValue","redeemable","hasWagers","prizesOffered",
      "randomnessUsed","mayExecuteBusinessAction"])assert.equal(x[key],false);
    assert.equal(x.fictionalOnly,true);
  });
  it("supports bounded training packs for distinct industries",()=>{
    for(const scenario of Object.keys(PACKS)){
      const x=run({scenario});
      assert.equal(x.ok,true,scenario);
      assert.equal(x.mayExecuteBusinessAction,false);
    }
  });
  it("refuses anything other than explicitly fictional training",()=>{
    assert.equal(run({mode:"real_cash"}).code,"training_mode_required");
    assert.equal(run({mode:"casino"}).code,"training_mode_required");
    assert.equal(run({mode:undefined}).code,"training_mode_required");
  });
  it("never allows overdraw or fictitious negative units",()=>{
    assert.equal(run({startingPoints:0}).code,"insufficient_fictional_points");
    assert.equal(run({turns:[{action:"fulfill",units:100}]}).code,"invalid_training_move");
    assert.equal(run({turns:[{action:"fulfill",units:6}]}).code,"insufficient_fictional_stock");
  });
  it("rejects malformed or unknown actions rather than silently ignoring",()=>{
    assert.equal(run({turns:[{action:"hire_employee",units:1}]}).code,"invalid_training_move");
    assert.equal(run({turns:[{action:"fulfill",units:-1}]}).code,"invalid_training_move");
    assert.equal(run({turns:[{action:"pass",units:1}]}).code,"invalid_training_move");
    assert.equal(run({scenario:"casino_slots"}).code,"unsupported_training_scenario");
  });
  it("prevents unbounded simulations",()=>{
    assert.equal(run({turns:Array.from({length:49},()=>({action:"pass",units:0}))}).code,"invalid_training_inputs");
    assert.equal(run({startingStock:1001}).code,"invalid_training_inputs");
  });
  it("returns all-or-nothing validation without partial progress on failure",()=>{
    const x=run({turns:[{action:"fulfill",units:3},{action:"fulfill",units:6}]});
    assert.equal(x.ok,false);assert.equal(x.code,"insufficient_fictional_stock");
    assert.equal(Object.hasOwn(x,"history"),false);
  });
});
