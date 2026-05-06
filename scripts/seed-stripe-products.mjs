const productPlan = [
  { product: "SONARA OS Creator", price: "$9.99/month", env: "STRIPE_CREATOR_MONTHLY_PRICE_ID", lookupKey: "sonara_os_creator_monthly" },
  { product: "SONARA OS Pro", price: "$19.99/month", env: "STRIPE_PRO_MONTHLY_PRICE_ID", lookupKey: "sonara_os_pro_monthly" },
  { product: "SONARA OS Label", price: "$49.99/month", env: "STRIPE_LABEL_MONTHLY_PRICE_ID", lookupKey: "sonara_os_label_monthly" },
];

console.log("SONARA OS Stripe product seed plan");
console.log("This script is dry-run only by default and never prints secrets.");

for (const item of productPlan) {
  console.log(`- ${item.product}: ${item.price} -> ${item.env} (${item.lookupKey})`);
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.log("STRIPE_SECRET_KEY is not configured. No live Stripe calls were made.");
  process.exit(0);
}

console.log("STRIPE_SECRET_KEY is present, but this safety-first script does not mutate live Stripe by default.");
console.log("Create products/prices in Stripe Dashboard or extend this script behind an explicit reviewed --live mode.");
