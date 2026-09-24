# SONARA local open-source service stack

Review by: 2026-12-24

This is the supported local setup path for the self-hosted software SONARA
already has adapters for. It is deliberately smaller than the repository
research registry: a reviewed repository is not automatically software that
should be installed, redistributed, or made part of the paid product.

## What the default command starts

```bash
pnpm run open-source:up
```

The default profile pulls and starts, on loopback only:

| Service | Local address | Why it is in the default profile |
| --- | --- | --- |
| Ollama | `127.0.0.1:11434` | MIT runtime; model licences remain separate |
| Langflow | `127.0.0.1:7860` | MIT; authentication is forced on |
| Crawl4AI | `127.0.0.1:11235` | Apache-2.0 crawler behind SONARA's target checks |

The helper creates `.env.open-source.local` on first run and generates unique
local Langflow/Open WebUI secrets without printing them.

Nothing is bound to `0.0.0.0`. Starting the stack therefore does not publish
a model API, crawler or flow engine to the LAN or Internet.

## First run

```bash
pnpm run open-source:init
pnpm run open-source:up
pnpm run open-source:status
```

To also write the matching local addresses into SONARA's ignored `.env`:

```bash
node scripts/setup-open-source-local.mjs up --write-app-env
```

Crawl4AI becomes callable immediately. Ollama and Langflow deliberately stay
off at the callable-adapter layer until you name the reviewed model and flow
that SONARA is allowed to use:

```bash
node scripts/setup-open-source-local.mjs up \
  --write-app-env \
  --model <reviewed-ollama-model> \
  --langflow-flow <approved-flow-id>
```

The model is not chosen or downloaded automatically. Ollama's MIT runtime
licence does not grant rights to every model it can download.

Langflow's callable adapter sends the generated API key as `x-api-key`; the
Compose service uses environment-backed API-key validation. The key is written
only to ignored local environment files and is non-enumerable on SONARA
readiness objects.

## Reviewed Open WebUI profile

Open WebUI is not in the default profile because SONARA's review register
records upstream branding/deployment conditions. After reviewing those
conditions for the intended use:

```bash
pnpm run open-source:up:reviewed
```

The profile binds Open WebUI to `127.0.0.1:3001`, disables public signup and
community sharing, enables API keys, and connects it to the private Ollama
container. SONARA's callable Open WebUI adapter remains disabled until an owner
creates a scoped API key and selects a reviewed model.

## Deliberately not auto-installed

- **n8n** — separately managed; SONARA's register records Sustainable Use
  Licence restrictions, so this setup does not start another copy or embed it.
- **Dify** — additional licence conditions make a shared SONARA multi-tenant
  Dify deployment a blocked architecture.
- **RAGFlow** — retrieval is supported, while ingestion/retention/tenant
  isolation remain explicit data-governance decisions.
- **whisper.cpp** — model weights and optional ffmpeg conversion are separate
  worker/runtime choices.
- **Voice clone / OpenVoice** — consent and provenance are enforced separately;
  the real GPU/OpenVoice path is not activated by a generic installer.

## Updating and stopping

```bash
pnpm run open-source:pull
pnpm run open-source:up
pnpm run open-source:down
```

Named Docker volumes are retained on `down`; deleting model, workflow or
account state is intentionally not part of the convenience command.

## Production boundary

A local service does not become reachable from Vercel merely because it is
running. `localhost` in a Vercel function means the function's own container,
not this workstation. Production use needs a separately protected reachable
host/tunnel as described in `docs/architecture/EXTERNAL-SERVICES.md`.

Do not copy `.env.open-source.local` to Vercel and do not expose these Compose
ports publicly.
