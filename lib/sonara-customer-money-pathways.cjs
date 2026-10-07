// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Canonical launch-time money map. It explains and classifies funds; it does
// not create charges, bank transfers, refunds, payouts, escrow or custody.
const PATHS=Object.freeze({
  sonara_software_subscription:Object.freeze({
    product:"SONARA",payer:"sonara_customer",merchant:"sonara_industries",
    processor:"sonara_platform_processor",destination:"sonara_company_bank",
    sonaraMoneyRole:"seller_of_software",customerBookRole:"software_expense",
    sonaraBookRole:"software_subscription_revenue"
  }),
  business_customer_sale:Object.freeze({
    product:"Business Builder",payer:"business_customer",merchant:"customer_business",
    processor:"merchant_owned_provider",destination:"merchant_owned_bank",
    sonaraMoneyRole:"software_records_only",customerBookRole:"business_sale",
    sonaraBookRole:"none"
  }),
  contractor_invoice:Object.freeze({
    product:"Business Builder",payer:"contractor_customer",merchant:"customer_contractor",
    processor:"contractor_owned_provider",destination:"contractor_owned_bank",
    sonaraMoneyRole:"invoice_record_only",customerBookRole:"service_receipt",
    sonaraBookRole:"none"
  }),
  rental_rent:Object.freeze({
    product:"Business Builder",payer:"tenant",merchant:"customer_landlord",
    processor:"landlord_selected_external_method",destination:"landlord_controlled_account",
    sonaraMoneyRole:"rental_record_only",customerBookRole:"landlord_rent_receipt",
    sonaraBookRole:"none"
  }),
  rental_security_deposit:Object.freeze({
    product:"Business Builder",payer:"tenant",merchant:"customer_landlord",
    processor:"landlord_selected_external_method",destination:"lawful_landlord_controlled_deposit_location",
    sonaraMoneyRole:"deposit_calculation_and_record_only",customerBookRole:"refundable_deposit_liability",
    sonaraBookRole:"none"
  }),
  creator_sale:Object.freeze({
    product:"Creator Studio",payer:"creator_buyer",merchant:"customer_creator",
    processor:"creator_owned_provider",destination:"creator_owned_bank",
    sonaraMoneyRole:"catalog_rights_and_record_only",customerBookRole:"creator_sale",
    sonaraBookRole:"none"
  }),
  advertising_spend:Object.freeze({
    product:"Growth Studio",payer:"customer_business",merchant:"external_ad_platform",
    processor:"customer_owned_ad_account_payment_method",destination:"external_ad_platform",
    sonaraMoneyRole:"budget_and_analytics_only",customerBookRole:"advertising_expense",
    sonaraBookRole:"none"
  }),
  supplier_purchase:Object.freeze({
    product:"Business Builder",payer:"customer_business",merchant:"external_supplier",
    processor:"customer_or_supplier_external_method",destination:"external_supplier",
    sonaraMoneyRole:"purchase_order_record_only",customerBookRole:"business_expense_or_inventory",
    sonaraBookRole:"none"
  })
});
const PROHIBITED=Object.freeze(new Set([
  "sonara_customer_wallet","sonara_escrow","sonara_split_payout",
  "sonara_rent_collection","sonara_security_deposit_custody",
  "sonara_cash_advance","sonara_customer_to_customer_transfer"
]));
function pathway(flow,{customerProviderOwnershipVerified=false}={}){
  if(PROHIBITED.has(flow))return Object.freeze({
    flow,state:"prohibited_launch_model",reason:"sonara_does_not_hold_or_route_customer_money",
    paymentExecuted:false,custody:false,sonaraRevenue:false
  });
  const path=PATHS[flow];
  if(!path)return Object.freeze({flow:"unknown",state:"blocked_unknown_flow",paymentExecuted:false,custody:false,sonaraRevenue:false});
  const isOwn=flow==="sonara_software_subscription";
  const blockers=[];
  if(!isOwn&&customerProviderOwnershipVerified!==true)
    blockers.push("customer_external_payment_destination_unverified");
  return Object.freeze({
    flow,state:blockers.length?"record_only_destination_unverified":"pathway_documented",
    blockers:Object.freeze(blockers),...path,
    paymentExecuted:false,custody:false,
    sonaraRevenue:isOwn,
    customerFundsEnterSonara:isOwn,
    automaticFulfillmentFromSelfReport:false
  });
}
function customerLedgerEntryClass(flow){
  const path=PATHS[flow];
  if(!path)return Object.freeze({ok:false,code:"unknown_flow"});
  if(flow==="sonara_software_subscription")return Object.freeze({
    ok:true,owner:"sonara_customer",entryClass:"software_expense",
    mirroredIntoSonaraBooksOnlyThroughOwnVerifiedBilling:true
  });
  return Object.freeze({
    ok:true,owner:"customer_business",entryClass:path.customerBookRole,
    mirroredIntoSonaraBooks:false,sonaraRevenue:false,
    externalPaymentVerificationRequiredForPaidStatus:true
  });
}
function assertLaunchInvariant(){
  const violations=[];
  for(const [flow,path] of Object.entries(PATHS)){
    const own=flow==="sonara_software_subscription";
    if(own){
      if(path.merchant!=="sonara_industries"||path.destination!=="sonara_company_bank")
        violations.push(flow+":own_billing_not_to_sonara");
    }else{
      if(path.merchant==="sonara_industries"||path.destination==="sonara_company_bank"||
         path.processor==="sonara_platform_processor")violations.push(flow+":customer_funds_touch_sonara");
    }
  }
  return Object.freeze({ok:violations.length===0,violations:Object.freeze(violations),checked:Object.keys(PATHS).length});
}
module.exports={PATHS,PROHIBITED,pathway,customerLedgerEntryClass,assertLaunchInvariant};
