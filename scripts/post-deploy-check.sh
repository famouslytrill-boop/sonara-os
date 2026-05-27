#!/usr/bin/env bash
set -euo pipefail

pnpm run build
pnpm run lint
pnpm run typecheck
pnpm run scan:secrets
pnpm run verify:security
pnpm run verify:db
pnpm run verify:heartbeat
pnpm run verify:entity-security

if pnpm run | grep -q "verify:all"; then
  pnpm run verify:all
fi
