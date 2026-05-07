#!/usr/bin/env node

const products = [
  { company: "trackfoundry", name: "TrackFoundry Starter", lookupKey: "trackfoundry_starter_monthly", env: "STRIPE_TRACKFOUNDRY_STARTER_PRICE_ID" },
  { company: "trackfoundry", name: "TrackFoundry Studio", lookupKey: "trackfoundry_studio_monthly", env: "STRIPE_TRACKFOUNDRY_STUDIO_PRICE_ID" },
  { company: "trackfoundry", name: "TrackFoundry Label", lookupKey: "trackfoundry_label_monthly", env: "STRIPE_TRACKFOUNDRY_LABEL_PRICE_ID" },
  { company: "lineready", name: "LineReady Single Store", lookupKey: "lineready_single_store_monthly", env: "STRIPE_LINEREADY_SINGLE_STORE_PRICE_ID" },
  { company: "lineready", name: "LineReady Operator", lookupKey: "lineready_operator_monthly", env: "STRIPE_LINEREADY_OPERATOR_PRICE_ID" },
  { company: "lineready", name: "LineReady Group", lookupKey: "lineready_group_monthly", env: "STRIPE_LINEREADY_GROUP_PRICE_ID" },
  { company: "noticegrid", name: "NoticeGrid Community", lookupKey: "noticegrid_community_monthly", env: "STRIPE_NOTICEGRID_COMMUNITY_PRICE_ID" },
  { company: "noticegrid", name: "NoticeGrid Organization", lookupKey: "noticegrid_organization_monthly", env: "STRIPE_NOTICEGRID_ORGANIZATION_PRICE_ID" },
  { company: "noticegrid", name: "NoticeGrid Municipal", lookupKey: "noticegrid_municipal_monthly", env: "STRIPE_NOTICEGRID_MUNICIPAL_PRICE_ID" },
];

if (!process.env.STRIPE_SECRET_KEY) {
  console.log("Stripe seed dry run. Add STRIPE_SECRET_KEY locally only when intentionally seeding Stripe.");
  for (const product of products) {
    console.log(`${product.name}: lookup_key=${product.lookupKey} env=${product.env}`);
  }
  process.exit(0);
}

console.log("Live Stripe seeding is intentionally not automatic in this scaffold.");
console.log("Use the lookup keys above in Stripe Dashboard or extend this script after internal review.");
