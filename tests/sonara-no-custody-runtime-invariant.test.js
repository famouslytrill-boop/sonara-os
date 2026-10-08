// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {withoutComments}=require("../lib/sonara-comment-stripping.cjs");

const ROOT=path.resolve(__dirname,"..");
function recursiveCjs(relative){
  const absolute=path.join(ROOT,relative);
  return fs.readdirSync(absolute,{withFileTypes:true}).flatMap((entry)=>{
    const child=path.join(relative,entry.name);
    if(entry.isDirectory())return recursiveCjs(child);
    return entry.isFile()&&child.endsWith(".cjs")?[child.replace(/\\/g,"/")]:[];
  });
}

const PLATFORM_ROUTING_PRIMITIVES=Object.freeze([
  {name:"Stripe application fee",pattern:/\bapplication_fee_amount\b/i},
  {name:"Stripe destination transfer_data",pattern:/\btransfer_data\b/i},
  {name:"Stripe on_behalf_of",pattern:/\bon_behalf_of\b/i},
  {name:"Stripe source_transaction transfer",pattern:/\bsource_transaction\b/i},
  {name:"Stripe Transfers API",pattern:/api\.stripe\.com\/v1\/transfers\b/i},
  {name:"Stripe Payouts API",pattern:/api\.stripe\.com\/v1\/payouts\b/i}
]);

describe("runtime keeps SONARA out of customer-fund custody and split routing",()=>{
  it("contains no executable platform-routing primitive in lib or routes",()=>{
    const violations=[];
    let checked=0;
    for(const file of [...recursiveCjs("lib"),...recursiveCjs("routes")]){
      const stripped=withoutComments(fs.readFileSync(path.join(ROOT,file),"utf8"));
      for(const primitive of PLATFORM_ROUTING_PRIMITIVES){
        if(primitive.pattern.test(stripped))violations.push(file+" -> "+primitive.name);
      }
      checked++;
    }
    assert.ok(checked>50,"runtime scan is unexpectedly small");
    assert.deepEqual(violations,[]);
  });

  it("keeps merchant checkout on the seller account and SONARA subscription billing on the platform account",()=>{
    const merchant=withoutComments(fs.readFileSync(path.join(ROOT,"lib/sonara-connected-checkout.cjs"),"utf8"));
    const connected=withoutComments(fs.readFileSync(path.join(ROOT,"lib/sonara-connected-payments.cjs"),"utf8"));
    const billing=withoutComments(fs.readFileSync(path.join(ROOT,"lib/sonara-billing.cjs"),"utf8"));
    assert.match(connected,/headers\["Stripe-Account"\]\s*=\s*accountId/);
    assert.match(merchant,/payments\.stripeHeaders\(deps,\s*accountId\)/);
    assert.doesNotMatch(billing,/["']Stripe-Account["']/);
    assert.match(billing,/api\.stripe\.com\/v1\/checkout\/sessions/);
  });

  it("keeps fee-only mode the sample/default launch posture",()=>{
    const sample=fs.readFileSync(path.join(ROOT,".env.example"),"utf8");
    assert.match(sample,/^SONARA_CUSTOMER_FUNDS_MODE=external_only$/m);
    assert.match(sample,/^STRIPE_CONNECT_ENABLED=false$/m);
  });
});
