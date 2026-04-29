import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "../../../../lib/sonara/ai/providerConfig";
import {
  buildExternalGeneratorSettings,
  buildPromptLength,
  buildRuntimeTarget,
  buildSONARALongPrompt,
  songInputSchema,
} from "../../../../lib/sonara-core";

export async function POST(request: NextRequest) {
  const parsed = songInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_song_input" }, { status: 400 });
  }

  const requestedProvider = getAIProvider();
  const settings = buildExternalGeneratorSettings(parsed.data);
  const runtimeTarget = buildRuntimeTarget(parsed.data);
  const promptLength = buildPromptLength(parsed.data);
  const longPrompt = buildSONARALongPrompt(parsed.data, settings, runtimeTarget, promptLength);

  return NextResponse.json({
    provider: "local_rules",
    requestedProvider,
    status: requestedProvider === "local_rules" ? "local_rules_complete" : "local_rules_fallback",
    ...settings,
    runtimeTarget,
    promptLength,
    longPrompt,
  });
}
