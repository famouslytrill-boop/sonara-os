const requiredKeys = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_CREATOR",
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_AGENCY_SCALE",
  "STRIPE_PRICE_SETUP_99",
  "STRIPE_PRICE_SETUP_299",
  "STRIPE_PRICE_SETUP_499",
  "STRIPE_PRICE_SETUP_999"
];

const priceKeys = requiredKeys.filter((key) => key.startsWith("STRIPE_PRICE_"));
const priceGroups = [
  ["STRIPE_PRICE_STARTER", "STRIPE_PRICE_SONARA_ONE_STARTER_MONTHLY"],
  ["STRIPE_PRICE_CORE", "STRIPE_PRICE_SONARA_ONE_CORE_MONTHLY"],
  ["STRIPE_PRICE_CREATOR", "STRIPE_PRICE_CREATOR_STUDIO_MONTHLY"],
  ...priceKeys
    .filter(
      (key) => !["STRIPE_PRICE_STARTER", "STRIPE_PRICE_CORE", "STRIPE_PRICE_CREATOR"].includes(key)
    )
    .map((key) => [key])
];
const issues = [];

for (const key of requiredKeys.filter((value) => !value.startsWith("STRIPE_PRICE_"))) {
  const value = process.env[key]?.trim();
  if (!value) {
    issues.push(`${key} is missing.`);
  }
}

for (const group of priceGroups) {
  const configuredValues = group
    .map((key) => [key, process.env[key]?.trim()])
    .filter(([, value]) => Boolean(value));
  if (configuredValues.length === 0) {
    issues.push(`${group[0]} is missing.`);
    continue;
  }
  for (const [key, value] of configuredValues) {
    if (!isValidStripePriceEnvValue(value)) {
      issues.push(
        `${key} is invalid. Use a Stripe price_ ID, not a dollar amount, prod_ ID, key, webhook secret, or /mo display value.`
      );
    }
  }
  if (!configuredValues.some(([, value]) => isValidStripePriceEnvValue(value))) {
    issues.push(
      `${group[0]} has no valid price_ value across accepted aliases: ${group.join(", ")}.`
    );
  }
}

if (issues.length > 0) {
  console.error("Stripe price env check failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Stripe price env check passed. Required values are present and price IDs look valid.");

function isValidStripePriceEnvValue(value) {
  if (value.includes("/mo")) {
    return false;
  }
  if (["$", "prod_", "sk_", "pk_", "whsec_"].some((prefix) => value.startsWith(prefix))) {
    return false;
  }
  return value.startsWith("price_");
}
