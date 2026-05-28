# Model Comparison Lab

Model Comparison Lab is a setup-gated scaffold for evaluating model behavior before enabling provider workflows in SONARA.

## Current Status

- No live provider calls are made.
- No provider keys are stored in client code.
- No jailbreak, harmful red-team, credential-handling, or private-scraping presets are exposed.
- Reports are decision-support notes only.

## Future Requirements

Before live use:

- Configure provider keys server-side only.
- Add cost controls and owner approval for expensive runs.
- Add prompt redaction and sensitive-data review.
- Store reports only after Supabase Auth, RLS, and organization scoping are verified.
- Keep outputs out of legal, tax, financial, medical, security, and high-stakes decision territory.
