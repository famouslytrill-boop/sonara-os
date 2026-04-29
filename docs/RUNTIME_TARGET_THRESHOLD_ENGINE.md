# Runtime Target Threshold Engine

Runtime targets are deterministic local-rules calculations. They do not require OpenAI or any paid model provider.

## Source Files

- `lib/sonara/runtime/runtimeTypes.ts`
- `lib/sonara/runtime/runtimeThresholdEngine.ts`
- `components/sonara/RuntimeThresholdCard.tsx`

## Output

The engine returns:

- minimum runtime
- ideal runtime
- maximum runtime
- warning threshold
- hard limit
- label
- notes
- arrangement guidance
- platform guidance
- commercial guidance

## Launch Requirement

Runtime target must appear in:

- Create output after running SONARA Core
- Export preview
- ZIP export package
- Long prompt output

## Risk Guardrail

Runtime guidance is planning support only. It does not guarantee streaming performance, playlist approval, platform acceptance, or market outcome.
