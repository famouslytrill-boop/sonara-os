# SONARA Agent Rules

## Brand Governance

- Use SONARA Industries™, SONARA Records™, SONARA OS™, SONARA Vault™, SONARA Engine™, SONARA Exchange™, and SONARA Labs™.
- Do not use SONARA registered marks unless the mark is officially registered.
- Public copy should avoid overusing "AI"; prefer music technology, creator infrastructure, sound systems, release tools, artist ecosystems, creator workflows, digital assets, music brands.
- Exports must use `prepareBrandedExport()` and include the legal footer once.
- Brand editing is limited to owner/admin roles.

## Private Artist Separation

- Do not seed or publish private artist ecosystem names.
- Use neutral demo names: Demo Artist, Creator Project, Sample Project, SONARA Demo Release, Untitled Artist, Example Song, Project Alpha, Vault Demo Kit.

## Provider Rules

- OpenAI is optional.
- Default provider is `local_rules`.
- The app must build and run without `OPENAI_API_KEY`.
- Core numeric, runtime, prompt mode, entitlement, and rights logic must remain deterministic local rules.

## SONARA Engines

- Runtime Target Threshold Engine outputs deterministic runtime targets and must appear in generated project output and exports.
- Prompt Length Engine chooses the shortest prompt that controls the result and must appear in generated output and exports.
- External Generator Slider Guidance should use platform-flexible language such as "External Generator Settings" and "Suno-style where supported." Do not imply guaranteed results.
- Sound Rights Redistribution Rules must block unsafe raw sample-pack exports, including `unknown_blocked` and `music_use_only`.

## Monetization Safety

- Use Stripe web checkout for website/PWA subscriptions.
- Do not fake payments or fake active subscriptions.
- Paid checkout must stay disabled until real Stripe env vars are configured.
- Google Play Billing and Apple IAP are later native-app work.

## Deployment Safety

- Do not commit secrets.
- Do not put env vars in `vercel.json`.
- `SUPABASE_SERVICE_ROLE_KEY` must be server-only.
- Stripe secret and webhook keys must be server-only.
- Public routes should render without Supabase, Stripe, or OpenAI secrets.

## Product Structure

- The public website sells and explains.
- SONARA OS™ is the operating system workspace.
- Store and pricing are separate from the OS app.
- OBS work is an OBS-ready broadcast kit export unless direct integration is implemented.
- R&D should separate launch-ready systems from later integrations.
