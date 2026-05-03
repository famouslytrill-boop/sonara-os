# Prompt Length Engine

Prompt length mode is deterministic local-rules guidance. It does not require OpenAI or any paid provider.

## Source Files

- `lib/sonara/prompts/promptLengthTypes.ts`
- `lib/sonara/prompts/promptLengthEngine.ts`
- `lib/sonara/prompts/longPromptBuilder.ts`
- `components/sonara/PromptLengthCard.tsx`

## Modes

- `short`
- `standard`
- `long`
- `ultra`

## Output

The engine returns:

- recommended mode
- minimum character target
- ideal character target
- maximum character target
- allowed sections
- forbidden behaviors
- notes

## Launch Requirement

Prompt length mode must appear in:

- Create output after running SONARA Core
- Export preview
- ZIP export package
- Long prompt output

## Risk Guardrail

Prompt length guidance controls structure and clarity only. It does not guarantee generation quality, platform acceptance, monetization, or distribution results.
