import { NextResponse } from "next/server";
import { checkRateLimit, getRateLimitKey } from "@/lib/sonara/security/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimit = checkRateLimit({
    key: getRateLimitKey(request, "sonara_cron"),
    limit: 30,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.SONARA_CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized.",
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    task: "sonara-maintenance",
    status: "SONARA maintenance cron completed",
    completedAt: new Date().toISOString(),
    authMode: expectedSecret ? "secret_checked" : "no_secret_configured",
  });
}
