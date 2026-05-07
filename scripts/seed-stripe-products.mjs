const productPlan = [
  { product: "TrackFoundry Starter", price: "$19/month", env: "STRIPE_TRACKFOUNDRY_STARTER_PRICE_ID", lookupKey: "trackfoundry_starter_monthly" },
  { product: "TrackFoundry Studio", price: "$49/month", env: "STRIPE_TRACKFOUNDRY_STUDIO_PRICE_ID", lookupKey: "trackfoundry_studio_monthly" },
  { product: "TrackFoundry Label", price: "$149/month", env: "STRIPE_TRACKFOUNDRY_LABEL_PRICE_ID", lookupKey: "trackfoundry_label_monthly" },
  { product: "LineReady Single Store", price: "$39/month", env: "STRIPE_LINEREADY_SINGLE_STORE_PRICE_ID", lookupKey: "lineready_single_store_monthly" },
  { product: "LineReady Operator", price: "$89/month", env: "STRIPE_LINEREADY_OPERATOR_PRICE_ID", lookupKey: "lineready_operator_monthly" },
  { product: "LineReady Group", price: "$199/month", env: "STRIPE_LINEREADY_GROUP_PRICE_ID", lookupKey: "lineready_group_monthly" },
  { product: "NoticeGrid Organization", price: "$29/month", env: "STRIPE_NOTICEGRID_ORGANIZATION_PRICE_ID", lookupKey: "noticegrid_organization_monthly" },
  { product: "NoticeGrid Municipal", price: "$149/month", env: "STRIPE_NOTICEGRID_MUNICIPAL_PRICE_ID", lookupKey: "noticegrid_municipal_monthly" },
];

console.log("SONARA Industries house-of-brands Stripe product seed plan");
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
