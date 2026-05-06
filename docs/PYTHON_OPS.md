# Python Ops

The `python/` package is for local and CI operations only.

It is not part of the Vercel Next.js runtime.

## Install

```bash
cd python
python -m venv .venv
pip install -e .
```

## Commands

```bash
python -m sonara_ops.main health
python -m sonara_ops.main schema-report
python -m sonara_ops.main stripe-audit
python -m sonara_ops.main jobs-list
```

## Verify

```bash
python -m compileall python
```

## Secrets

Use `python/.env` locally. Never commit it. Never expose `SUPABASE_DB_URL`.
