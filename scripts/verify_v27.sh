#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

fail(){ echo "FAIL: $1" >&2; exit 1; }
pass(){ echo "PASS: $1"; }

[ -f backend/app/main.py ] || fail "backend/app/main.py missing"
[ -f backend/app/services/sonara_intelligence_core.py ] || fail "SONARA Intelligence Core missing"
[ -f backend/app/services/adaptive_intelligence_loop.py ] || fail "Adaptive Intelligence Loop missing"
[ -f backend/app/services/recovery_mode.py ] || fail "Recovery Mode missing"
[ -f frontend/components/AskSonaraButton.tsx ] || fail "Ask SONARA button missing"
[ -f frontend/components/CreatorGenomeCard.tsx ] || fail "Creator Genome card missing"
[ -f frontend/components/FirstWinStrip.tsx ] || fail "First Win strip missing"
[ -f frontend/package.json ] || fail "frontend package.json missing"
pass "required files present"

node <<'NODE'
const fs = require('fs');
function assertContains(file, text, label){
  const body = fs.readFileSync(file, 'utf8');
  if (!body.includes(text)) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}
JSON.parse(fs.readFileSync('frontend/package.json','utf8'));
console.log('PASS: package.json valid JSON');
assertContains('frontend/components/MagicHome.tsx', 'SONARA', 'SONARA brand present');
assertContains('frontend/components/MagicHome.tsx', 'Create in SONARA', 'master motto present');
assertContains('frontend/components/AskSonaraButton.tsx', 'Ask SONARA', 'Ask SONARA label present');
assertContains('frontend/components/HeroNav.tsx', '["Create", "Grow", "Market", "Studio", "Scale"]', '5-tab nav locked');
assertContains('backend/app/services/prompt_compiler.py', 'MAX_PROMPT_CHARS = 1000', '1000 character prompt cap present');
NODE

if [ -d frontend/node_modules ]; then
  (cd frontend && npm run build)
else
  echo "WARN: frontend/node_modules missing; skipped Next build. Run: cd frontend && npm install && npm run build"
fi

if [ -d backend/.venv ]; then
  source backend/.venv/bin/activate
  (cd backend && python -m pytest -q)
else
  echo "WARN: backend/.venv missing; skipped pytest. Run: cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && pytest"
fi

pass "V27 launch structure verified"
