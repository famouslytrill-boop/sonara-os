#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
//
// Opt-in, read-only diagnosis of one already recorded subscription.
// NO invoice/payment actions, NO database writes, NO mutation API endpoints.
// Examples (provide credentials via secure environment, never CLI arguments):
//   node scripts/inspect-stripe-subscription.mjs --organization=<uuid> --subscription=sub_...
//   node scripts/inspect-stripe-subscription.mjs --organization=<uuid> --subscription=sub_... --allow-live-readonly
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { createStripeReconciliationInspector } = require("../lib/sonara-stripe-reconciliation.cjs");
const { STRIPE_PLANS } = require("../lib/sonara-stripe-plans.cjs");

export async function main({ argv = process.argv.slice(2), env = process.env, transport = fetch, print = console.log } = {}) {
  const recognized = ["--organization=", "--subscription=", "--allow-live-readonly"];
  if (argv.some((item) => !recognized.some((prefix) =>
    prefix.endsWith("=") ? item.startsWith(prefix) : item === prefix))) {
    print("Usage: node scripts/inspect-stripe-subscription.mjs --organization=<uuid> --subscription=sub_... [--allow-live-readonly]");
    return 2;
  }
  const organizationId = argv.find((item) => item.startsWith("--organization="))?.slice("--organization=".length);
  const subscriptionId = argv.find((item) => item.startsWith("--subscription="))?.slice("--subscription=".length);
  if (!organizationId || !subscriptionId ||
      argv.filter((item) => item.startsWith("--organization=")).length !== 1 ||
      argv.filter((item) => item.startsWith("--subscription=")).length !== 1) {
    print("Usage: node scripts/inspect-stripe-subscription.mjs --organization=<uuid> --subscription=sub_... [--allow-live-readonly]");
    return 2;
  }
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").trim();
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const inspector = createStripeReconciliationInspector({
    fetch: transport,
    plans: STRIPE_PLANS,
    getEnv: (name) => env[name] || "",
    getSupabaseServerConfig: () => ({ ok: Boolean(url && key), url }),
    supabaseHeaders: () => ({ apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" })
  });
  const result = await inspector.inspect({
    organizationId,
    subscriptionId,
    allowLiveReadonly: argv.includes("--allow-live-readonly")
  });
  // Safe report: no service keys, Stripe API response bodies, customer IDs,
  // emails, person details, or provider payment artifacts are emitted.
  print(JSON.stringify(result));
  return result.ok && result.code === "consistent" ? 0 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; }).catch(() => {
    // Do not print untrusted stack traces from HTTP libraries or credentials.
    console.error("Read-only Stripe inspection failed; check connectivity and scoped credentials.");
    process.exitCode = 2;
  });
}
