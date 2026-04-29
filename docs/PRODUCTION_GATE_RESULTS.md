# Production Gate Results

Run date: 2026-04-27

## 1. Local Rules Structured-Output Test

Status: ready for launch without a paid API key.

Result:
- SONARA `/api/sonara/analyze` returns valid structured release analysis in default Local Rules mode.
- The required launch assets remain available: Song Fingerprint, Sound Discovery, Streaming Pack, Broadcast Kit, Breath Control, and Export Bundle.
- OpenAI Structured Outputs are optional BYOK mode and are not required for public launch.

Optional follow-up:
- Set `SONARA_AI_PROVIDER=openai` and `OPENAI_API_KEY` only when a creator or operator wants live OpenAI BYOK generation.
- Prior OpenAI diagnostics were blocked by account quota; that affects only optional BYOK mode.

## 2. Supabase Schema

Status: blocked by missing Supabase connection.

Result:
- Schema exists at `infra/supabase/sonara_launch_schema.sql`.
- No Supabase URL, database URL, access token, Supabase CLI, or `psql` client was configured locally.

Action needed:
- Provide a Supabase database connection string or project access.
- Apply `infra/supabase/sonara_launch_schema.sql`.

## 3. Production Env Vars

Status: ready to configure on the chosen host.

Required for baseline launch:
- None. SONARA defaults to Local Rules when `SONARA_AI_PROVIDER` is unset.

Recommended explicit baseline host variable:
- `SONARA_AI_PROVIDER=local`

Optional provider and service variables:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_FAST_MODEL`
- `OPENAI_REASONING_EFFORT`
- `OPENAI_MAX_OUTPUT_TOKENS`
- `OPENAI_STORE_RESPONSES`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `LM_STUDIO_BASE_URL`
- `LM_STUDIO_MODEL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 4. Production Deploy And Smoke Test

Status: blocked by missing production host target and credentials.

Result:
- Local build passed in the previous gate run.
- Local routes returned `200`.
- Local export API returned a valid ZIP.
- Production smoke-test script exists at `scripts/smoke_production.ps1`.

Action needed:
- Deploy to the selected host.
- Run `scripts/smoke_production.ps1 -BaseUrl https://your-production-url`.
