const products = [
  { product: "SONARA Starter", price: "$9-$15/month", env: "STRIPE_PRICE_STARTER", lookupKey: "sonara_starter_monthly" },
  { product: "SONARA Core", price: "$29/month", env: "STRIPE_PRICE_CORE", lookupKey: "sonara_core_monthly" },
  { product: "SONARA Growth", price: "$49-$59/month", env: "STRIPE_PRICE_GROWTH", lookupKey: "sonara_growth_monthly" },
  { product: "SONARA Pro", price: "$79-$99/month", env: "STRIPE_PRICE_PRO", lookupKey: "sonara_pro_monthly" },
  { product: "SONARA Agency", price: "$149-$199/month", env: "STRIPE_PRICE_AGENCY", lookupKey: "sonara_agency_monthly" },
  { product: "Profile Setup", price: "$99", env: "STRIPE_PRICE_SETUP_99", lookupKey: "sonara_setup_99" },
  { product: "Business Launch Setup", price: "$299", env: "STRIPE_PRICE_SETUP_299", lookupKey: "sonara_setup_299" },
  { product: "Premium Setup", price: "$499+", env: "STRIPE_PRICE_SETUP_499", lookupKey: "sonara_setup_499" },
];

console.log("Create these Stripe products/prices manually or through an approved server-side setup script:");
for (const item of products) {
  console.log(`- ${item.product}: ${item.price} -> ${item.env} (${item.lookupKey})`);
}
