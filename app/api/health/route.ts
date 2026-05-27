import { NextResponse } from "next/server";

import { isStripeConfigured, isSupabaseConfigured } from "../../../lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "SONARA Industries",
    platform: "SONARA One",
    version: process.env.npm_package_version ?? "0.1.0",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    checks: {
      supabase_public_config: isSupabaseConfigured() ? "configured" : "not_configured",
      stripe_server_config: isStripeConfigured() ? "configured" : "not_configured",
    },
  });
}
