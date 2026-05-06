#!/usr/bin/env bash
set -euo pipefail

npm run build
npm run lint
npm run typecheck
npm run scan:secrets
npm run verify:security
npm run verify:db
npm run verify:heartbeat
npm run verify:entity-security

if npm run | grep -q "verify:all"; then
  npm run verify:all
fi
