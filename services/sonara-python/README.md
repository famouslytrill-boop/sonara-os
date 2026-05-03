# SONARA Python Service

This folder reserves the optional Python service surface for SONARA OS.

The public launch does not require this service. The Next.js app runs in local-rules mode and can build, export, and deploy without Python. Use this service only when a clear backend job exists, such as background processing, internal audits, or future Linux-hosted workers.

## Expected Shape

Recommended future structure:

```text
services/sonara-python/
  README.md
  requirements.txt
  app/
  tests/
```

## Launch Provider Mode

The Python service should respect the same launch-safe defaults:

```env
SONARA_AI_PROVIDER=local_rules
SONARA_PROVIDER_TIMEOUT_MS=6000
```

Do not require OpenAI, Supabase, or Stripe keys for basic local tests.

## Test Command

When the service has Python code and tests:

```bash
cd services/sonara-python
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pytest -q
```

For the existing parent backend test suite, use:

```bash
cd ../../../backend
.venv/Scripts/python.exe -m pytest -q
```

On Linux:

```bash
cd ../../../backend
source .venv/bin/activate
python -m pytest -q
```
