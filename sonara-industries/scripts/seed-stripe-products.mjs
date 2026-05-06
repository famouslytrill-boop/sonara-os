#!/usr/bin/env node

const products = [
  { company: "soundos", name: "SoundOS Starter", lookupKey: "soundos_starter_monthly", env: "STRIPE_PRICE_SOUNDOS_STARTER" },
  { company: "soundos", name: "SoundOS Pro", lookupKey: "soundos_pro_monthly", env: "STRIPE_PRICE_SOUNDOS_PRO" },
  { company: "soundos", name: "SoundOS Studio", lookupKey: "soundos_studio_monthly", env: "STRIPE_PRICE_SOUNDOS_STUDIO" },
  { company: "tableos", name: "TableOS Starter", lookupKey: "tableos_starter_monthly", env: "STRIPE_PRICE_TABLEOS_STARTER" },
  { company: "tableos", name: "TableOS Pro", lookupKey: "tableos_pro_monthly", env: "STRIPE_PRICE_TABLEOS_PRO" },
  { company: "tableos", name: "TableOS Multi-Location", lookupKey: "tableos_multi_location_monthly", env: "STRIPE_PRICE_TABLEOS_MULTI_LOCATION" },
  { company: "alertos", name: "AlertOS Starter", lookupKey: "alertos_starter_monthly", env: "STRIPE_PRICE_ALERTOS_STARTER" },
  { company: "alertos", name: "AlertOS Org", lookupKey: "alertos_org_monthly", env: "STRIPE_PRICE_ALERTOS_ORG" },
  { company: "alertos", name: "AlertOS City", lookupKey: "alertos_city_monthly", env: "STRIPE_PRICE_ALERTOS_CITY" },
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
