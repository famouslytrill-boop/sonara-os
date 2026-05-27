#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/frontend"
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm run build

cd "$ROOT_DIR"
python -m py_compile backend/main.py
python -m py_compile backend/app/main.py

echo "SONARA house-of-brands verification passed."
