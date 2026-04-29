import { NextRequest, NextResponse } from "next/server";
import { runAutonomousSoundUpdate } from "../../../../lib/sonara/sound/autonomousSoundUpdater";

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.SONARA_CRON_SECRET;
  const providedSecret = request.headers.get("x-sonara-cron-secret") ?? request.nextUrl.searchParams.get("secret");

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runAutonomousSoundUpdate();
  return NextResponse.json({ status: "sound_discovery_sync_complete", result });
}
