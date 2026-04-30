# Open Source Technology Stack

SONARA OS™ should stay lightweight enough to deploy, audit, and contribute to.

## Current Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- Stripe
- Vercel
- JSZip
- OBS Studio broadcast workflow

## Future / Optional

- FFmpeg for deeper media metadata extraction
- Essentia.js for browser audio analysis
- librosa as a future Python microservice
- Web Audio API for local audio feature inspection
- Ollama / LM Studio for local model modes
- Capacitor for native Android/iOS wrappers

## Rules

- Do not install heavy packages until they are used by production code.
- Prefer documentation and TODOs for future integrations.
- Keep OpenAI optional and keep deterministic product logic in local rules.
- Keep secrets out of source and Vercel config files.
