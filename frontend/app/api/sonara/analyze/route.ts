import { NextRequest, NextResponse } from "next/server";
import {
  applyLocalDeterministicSystems,
  buildReleasePrompt,
  ensureCoreExportAssets,
  releaseAnalysisJsonSchema,
  releaseAnalysisSchema,
  ruleBasedReleaseAnalysis,
  songInputSchema,
} from "../../../../lib/sonara-core";
import { getAIProvider } from "../../../../lib/sonara/ai/providerConfig";

const responsesUrl = "https://api.openai.com/v1/responses";

function extractStructuredJson(data: Record<string, any>) {
  if (typeof data.output_text === "string") {
    return JSON.parse(data.output_text);
  }

  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return JSON.parse(content.text);
      }
    }
  }

  throw new Error("No structured output text returned.");
}

function localRulesResponse(input: Parameters<typeof ruleBasedReleaseAnalysis>[0], status = "local_rules_complete") {
  return NextResponse.json({
    analysis: ruleBasedReleaseAnalysis(input),
    model: "local-rules-v1",
    provider: "local_rules",
    status,
  });
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Provider ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function runOpenAiStructured(prompt: string, apiKey: string, model: string) {
  const data = await fetchJsonWithTimeout(
    responsesUrl,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions:
          "You are SONARA Core. Return only strict JSON matching the provided schema. Keep the visible product simple: fingerprint, readiness, plan.",
        input: prompt,
        max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 900),
        reasoning: model.startsWith("gpt-5")
          ? { effort: process.env.OPENAI_REASONING_EFFORT ?? "medium" }
          : undefined,
        store: process.env.OPENAI_STORE_RESPONSES === "true",
        text: {
          format: {
            type: "json_schema",
            name: "sonara_release_analysis",
            strict: true,
            schema: releaseAnalysisJsonSchema,
          },
        },
      }),
    },
    Number(process.env.SONARA_PROVIDER_TIMEOUT_MS ?? 45000),
  );

  return {
    analysis: ensureCoreExportAssets(releaseAnalysisSchema.parse(extractStructuredJson(data))),
    responseId: data.id,
  };
}

async function runOpenAiCompatibleLocal(prompt: string, baseUrl: string, model: string) {
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const data = await fetchJsonWithTimeout(
    `${cleanBaseUrl}/v1/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are SONARA Core. Return only JSON for a music identity and release-readiness analysis. Do not generate music, distribute music, or add extra product surfaces.",
          },
          {
            role: "user",
            content: `${prompt}\n\nReturn JSON matching this schema: ${JSON.stringify(releaseAnalysisJsonSchema)}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    },
    Number(process.env.SONARA_PROVIDER_TIMEOUT_MS ?? 6000),
  );
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("No local model JSON returned.");
  }

  return ensureCoreExportAssets(releaseAnalysisSchema.parse(JSON.parse(content)));
}

export async function POST(request: NextRequest) {
  const parsed = songInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_song_input" }, { status: 400 });
  }

  const input = parsed.data;
  const prompt = buildReleasePrompt(input);
  const provider = getAIProvider();

  if (provider === "local_rules") {
    return localRulesResponse(input);
  }

  if (provider === "openai_byok") {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-5.5";

    if (!apiKey) {
      return localRulesResponse(input, "openai_byok_missing");
    }

    try {
      const { analysis, responseId } = await runOpenAiStructured(prompt, apiKey, model);
      return NextResponse.json({
        analysis: applyLocalDeterministicSystems(input, analysis),
        model,
        provider,
        responseId,
        status: "openai_structured_complete",
      });
    } catch {
      return localRulesResponse(input, "openai_byok_degraded");
    }
  }

  if (provider === "ollama_local") {
    const model = process.env.OLLAMA_MODEL ?? "llama3.1";
    const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

    try {
      const analysis = await runOpenAiCompatibleLocal(prompt, baseUrl, model);
      return NextResponse.json({
        analysis: applyLocalDeterministicSystems(input, analysis),
        model,
        provider,
        status: "ollama_local_complete",
      });
    } catch {
      return localRulesResponse(input, "ollama_local_unavailable");
    }
  }

  const model = process.env.LM_STUDIO_MODEL ?? "local-model";
  const baseUrl = process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234";

  try {
    const analysis = await runOpenAiCompatibleLocal(prompt, baseUrl, model);
    return NextResponse.json({
      analysis: applyLocalDeterministicSystems(input, analysis),
      model,
      provider,
      status: "lmstudio_local_complete",
    });
  } catch {
    return localRulesResponse(input, "lmstudio_local_unavailable");
  }
}
