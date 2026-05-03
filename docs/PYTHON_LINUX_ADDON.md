# Python Linux Addon

SONARA can run as a Next.js app without the Python service. The Python layer is an optional addon for teams that want Linux-hosted service work, smoke tests, or future background processing.

## Recommended Runtime

- Python 3.11 or newer
- Linux container, VM, or WSL
- Isolated virtual environment

## Setup

From the optional service folder:

```bash
cd services/sonara-python
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pytest -q
```

If using the parent backend service instead:

```bash
cd ../backend
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pytest -q
```

## Environment

The Python addon should mirror the launch-safe provider posture:

```env
SONARA_AI_PROVIDER=local_rules
SONARA_PROVIDER_TIMEOUT_MS=6000
```

Do not require OpenAI, Supabase, or Stripe keys for basic test success.

## Deployment Guidance

- Keep the Next.js app as the public Vercel surface.
- Host Python separately only when it has a clear job.
- Do not expose internal scoring, private system prompts, or admin-only operations as public endpoints.
- Keep the Python addon stateless unless a real persistence layer is configured.

