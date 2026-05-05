# SONARA OS™ Agent Rules

## Music As A Whole Rule

SONARA OS™ must be positioned as a creator operating system for music as a whole.

It supports:

- traditional creators
- AI-assisted creators
- hybrid creators
- artists
- songwriters
- producers
- bands
- labels
- managers
- engineers
- content creators
- music entrepreneurs

Do not present SONARA as only an AI music generator. Do not overuse AI language in public copy. Use "music creator operating system," "creator infrastructure," "release-readiness," "sound systems," "writing tools," "arrangement tools," and "rights-aware exports."

## Product Structure

- Public website explains, sells, builds trust, and drives conversion.
- SONARA OS™ is the creator operating system workspace.
- Public nav: Home, Store, Pricing, Tutorial, Login.
- App nav: Home, Create, Library, Export, Settings.
- Keep store/pricing separate from the OS workspace.

## Brand Governance

- Use SONARA Industries™, SONARA Records™, SONARA OS™, SONARA Core™, SONARA Vault™, SONARA Engine™, SONARA Exchange™, and SONARA Labs™.
- Do not use registered marks unless officially registered.
- Public copy should avoid overusing "AI"; prefer music technology, creator infrastructure, sound systems, release tools, artist ecosystems, creator workflows, digital assets, and music brands.
- Exports must use `prepareBrandedExport()` and include the legal footer once.
- Brand editing is limited to owner/admin roles.

## Private Artist Separation

- Do not seed or publish private artist ecosystem names.
- Use neutral demo names: Demo Artist, Creator Project, Sample Project, SONARA Demo Release, Untitled Artist, Example Song, Project Alpha, Vault Demo Kit.

## Cloud-First Rule

Normal users should access SONARA OS™ from the browser/PWA without downloads. Founder/developer setup may still use Vercel, Supabase, Stripe, GitHub, and local development tools.

## Provider Rules

- OpenAI is optional.
- Default provider is `local_rules`.
- The app must build and run without `OPENAI_API_KEY`.
- Core numeric, runtime, prompt mode, genre, arrangement, lyric, entitlement, and rights logic must remain deterministic local rules.

## Free/Open-Source-First Policy

- Use Next.js, TypeScript, Tailwind, Supabase, Vercel, Stripe web checkout, JSZip, local rules, and Supabase pgvector first.
- Keep Qdrant, Chroma, Milvus, Weaviate, Faiss, ClickHouse, Neo4j, Ollama, LM Studio, Essentia.js, FFmpeg, librosa, Flowise, Continue.dev, and Capacitor as optional/future unless directly used.
- Do not install heavy packages without a launch need.

## SONARA Core™ And Engines

- SONARA Core™ must read as an all-genre idea-to-arrangement base system.
- Runtime Target Threshold Engine must remain deterministic and appear in generated output and exports.
- Prompt Length Engine must choose the shortest prompt that still controls the result.
- External Generator Slider Guidance must use platform-flexible language and never imply guaranteed results.
- Authentic Writer Engine™ asks for concrete details and does not fabricate biography.
- Lyric Structure Engine™ structures user-written lyrics without copying copyrighted lyrics or imitating living artists.
- Explicit Language Control defaults to `radio_safe` and exports explicitness metadata.
- Generation History/Restore must preserve previous generations instead of overwriting them.

## Sound Rights And Sound Discovery

- Redistribution categories: redistributable, music_use_only, attribution_required, non_commercial_only, research_education_only, user_owned, commercial_license_required, unknown_blocked.
- `music_use_only`, `unknown_blocked`, research-only, non-commercial, and unproven commercial-license assets are blocked from raw sample-pack export.
- Attribution-required assets need an attribution sheet.
- Sound discovery is metadata-first; no automatic downloads for resale.
- Human approval is required before downloading, storing, publishing, or selling sound files.
- No public kit marketplace at launch.
- SONARA Vault™ may organize, classify, verify, package, and export personal rights-cleared Vault kits.
- SONARA Exchange™ is delayed until seller onboarding, rights verification, payout compliance, moderation, marketplace terms, and support policy are ready.

## Store, Pricing, And Payments

- Do not fake payments or fake active subscriptions.
- Stripe web checkout is for website/PWA subscriptions.
- Paid checkout must stay disabled or gracefully error until real Stripe env vars are configured.
- Google Play Billing and Apple IAP are later native-app work.
- Store Product Readiness must block products missing price, files, license terms, refund/support notes, export bundle, rights classification, Stripe price ID, or safe rights status.

## Security Rules

- Never commit secrets.
- Never put Stripe/Supabase/OpenAI keys in source code.
- Never put env vars in `vercel.json`.
- Use Vercel environment variables for production secrets.
- Service role keys are server-only.
- Stripe webhooks must verify signatures.
- Sensitive API routes should have rate limiting.
- RLS must be enabled for user/private tables.
- Do not log full secrets.
- Do not claim guaranteed profit, streams, IPO, or impossible security.
- Do not store biometric data.
- Use passkeys/WebAuthn only if biometric-ready login is implemented later.

## Autonomy And Safety

- Use supervised autonomy by default.
- Safe checks may run automatically; risky actions create recommendations.
- Payment, legal/trademark, env var, deletion, public store publication, and sound download actions require human approval.
- Do not use literal autonomy-overclaim language or unverified outcome promises.
- Use adaptive, feedback-driven, context-aware, creator-guided, supervised autonomy, and IPO-readiness roadmap language.
- Do not build uncontrolled self-modifying code.

## Launch Systems

- Support and Trust systems must be honest placeholders unless email/ticketing is configured.
- Activation, Conversion, Retention, Founder Command Center, Analytics/KPIs, Wide Moat, and IPO-grade discipline are planning/operating systems, not fake operating results.
- OBS work is an OBS-ready broadcast kit export unless direct OBS integration is implemented.
- R&D docs must separate launch-ready systems from later integrations.
- Final audit language must distinguish 10/10 architecture readiness from a verified 10/10 operating business.
