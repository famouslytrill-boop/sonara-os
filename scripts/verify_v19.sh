#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source backend/.venv/bin/activate || true
cd backend
python -m pytest
cd ../frontend
npm run build
echo "V19 verification passed. Try not to immediately add 90 features."
