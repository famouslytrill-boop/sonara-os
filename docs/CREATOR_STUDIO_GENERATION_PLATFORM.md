# Creator Studio Generation Platform

## Product boundary

Creator Studio now has an original, provider-neutral control plane for video, audio, music, voice, and structural reference-analysis jobs.

This is not a copy of any proprietary provider backend. SONARA studies publicly documented product workflows and API contracts, then implements its own tenant, billing, consent, storage, policy, and audit system around approved adapters.

## Customer workflow

1. Sign in to a paid Creator Studio workspace.
2. Open `/creator-studio/generation`.
3. Select a capability and provider, or use automatic routing.
4. Enter an original prompt and provider parameters.
5. Attest that all prompts, references, voices, likenesses, and source assets are owned or authorized.
6. Supply an active consent record for voice conversion or cloning workflows.
7. SONARA records the job before dispatch.
8. Configured synchronous providers return private assets immediately; asynchronous providers return a tracked operation.
9. Refresh asynchronous jobs until complete.
10. Outputs are copied into private Supabase Storage and linked to the tenant-scoped job ledger.

## Implemented routes

### Product pages

- `GET /creator-studio/generation`
- `GET /creator-studio/generation/voice`
- `GET /creator-studio/generation/music`
- `GET /creator-studio/generation/audio`
- `GET /creator-studio/generation/video`
- `GET /creator-studio/generation/reference-analysis`

### APIs

- `GET /api/creator/generation/providers`
- `GET /api/creator/generation/readiness`
- `GET /api/creator/generation/jobs`
- `POST /api/creator/generation/jobs`
- `GET /api/creator/generation/jobs/:jobId`
- `POST /api/creator/generation/jobs/:jobId/refresh`
- `POST /api/creator/generation/jobs/:jobId/cancel`
- `GET /api/creator/generation/voice-consents`
- `POST /api/creator/generation/voice-consents`
- `POST /api/creator/reference-analyses`

## Provider contracts

### ElevenLabs

Production adapter support:

- text to speech
- sound effects
- text to music
- music composition plans

The adapter uses server-side `xi-api-key` authentication. Binary outputs are never returned as permanent public provider URLs; SONARA copies them into private `creator-assets` or `music-stems` storage and records SHA-256 provenance.

Speech-to-speech and video-to-music remain capability-catalog entries but require the approved private-source-asset multipart pipeline before activation.

Environment variables:

```text
ELEVENLABS_ENABLED=true
ELEVENLABS_API_KEY=<protected secret>
ELEVENLABS_BASE_URL=https://api.elevenlabs.io
```

### Google Veo / Gemini video

Production adapter support:

- long-running video operation submission
- operation-name persistence
- bounded refresh/polling
- private output download and storage after completion

Default model:

```text
veo-3.1-generate-preview
```

Environment variables:

```text
GOOGLE_VEO_ENABLED=true
GEMINI_API_KEY=<protected secret>
GOOGLE_VEO_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GOOGLE_VEO_MODEL=veo-3.1-generate-preview
```

Image/video conditioning is passed only through reviewed provider parameters or private asset adapters. Large file bytes must not be embedded in JSON.

### Suno Platform

Suno advertises an account-based REST platform for original songs, covers, mashups, and voice features. The detailed endpoint contract is account-gated, so SONARA does not invent paths or response schemas.

The adapter activates only when the operator copies the exact current account documentation into protected environment configuration:

```text
SUNO_ENABLED=true
SUNO_API_KEY=<protected secret>
SUNO_API_BASE_URL=<documented account API origin>
SUNO_GENERATE_PATH=<documented generation path>
SUNO_STATUS_PATH_TEMPLATE=<documented status path containing {id}>
```

Until those values are configured and acceptance-tested, Suno jobs remain `setup_required`.

### Higgsfield

Higgsfield currently documents an MCP connector at:

```text
https://mcp.higgsfield.ai
```

The Express/Vercel runtime does not invent a REST API. Higgsfield jobs are recorded as `manual_required` until an approved server-side MCP client and account authorization flow are deployed. Credentials remain with Higgsfield or an approved secret vault.

### SONARA Open Media Worker

Open-source generation runs outside the public web process on an isolated GPU worker.

Canonical contract:

```text
POST /v1/jobs
GET  /v1/jobs/{id}
```

Environment variables:

```text
CREATOR_MEDIA_WORKER_ENABLED=true
CREATOR_MEDIA_WORKER_URL=https://<private-worker-origin>
CREATOR_MEDIA_WORKER_TOKEN=<protected scoped token>
```

The worker receives tenant/job metadata and returns a provider job ID. It may orchestrate approved ComfyUI workflows and reviewed model families. It must not accept arbitrary shell commands, Python, filesystem paths, model download URLs, or unreviewed custom nodes from customer requests.

## Open-source research registry

| System | Intended role | Activation state |
|---|---|---|
| ComfyUI | Node-based media workflow engine | Worker candidate |
| Stable Audio 3 | Music/audio model family | Worker candidate after weight/license review |
| AudioCraft / MusicGen / AudioGen | Research and architecture reference | Research-only for commercial SONARA use because published weights are noncommercial |
| OpenVoice | Cross-lingual TTS and authorized voice cloning | Worker candidate with consent controls |
| GPT-SoVITS | Few-shot TTS and voice conversion | Worker candidate with consent controls |
| LTX-2 | Video and synchronized audio/video generation | Worker candidate after model license review |
| Wan 2.2 | Text/image/speech-conditioned video | Worker candidate after model review |
| HunyuanVideo | Video/avatar/customized video research | Research-only until license review |
| CogVideoX | Text/image/video-conditioned generation | Worker candidate per selected model license |

No repository, model weights, custom nodes, datasets, or checkpoints are downloaded by the web application automatically.

## Database contract

Migration:

```text
supabase/migrations/20260723080000_creator_generation_control_plane.sql
```

Tables:

- `creator_generation_jobs`
- `creator_generation_assets`
- `creator_voice_consents`
- `creator_reference_analyses`
- `creator_generation_events`

All tables use organization and user scope, row-level security, service-role administration, and no provider credential columns.

## Storage contract

Generated outputs use existing private buckets:

- `creator-assets`
- `music-stems`
- `release-packages`
- `exports`

Object paths follow:

```text
<organization_id>/<user_id>/<job_id>/<generated_filename>
```

## Safety and rights rules

- Rights attestation is required for every generation job.
- Speech-to-speech and voice-cloning paths require an active voice-consent record.
- Prompts requesting direct identity, voice, artist, or protected-work imitation become `review_required` and are not dispatched.
- Structural reference analysis requires ownership or license attestation.
- Reference analysis records structure, timing, harmony, shot language, or visual composition—not instructions to impersonate a person or duplicate a protected work.
- Provider keys remain in protected server environments only.
- Provider responses are sanitized before persistence.
- Outputs remain private by default.
- Job cancellation preserves the audit ledger.

## Honest launch state

The platform is operational when the migration is applied and at least one provider is enabled with valid credentials. Disabled providers remain visible as governed capability options but do not create fake output.

The repository test suite uses mocked provider contracts and private storage calls. A provider is not declared customer-ready until a real account acceptance test verifies generation, polling where applicable, private output persistence, quota behavior, error handling, billing implications, and rights/provenance metadata.
