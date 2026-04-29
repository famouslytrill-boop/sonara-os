# Android Capacitor Plan

SONARA OS should ship as a PWA first. Add Capacitor only after the web launch is stable.

## Recommended Sequence

1. Finish Supabase production setup and confirm login/save/delete flows.
2. Finish Stripe test-mode checkout and webhook validation.
3. Complete mobile QA at 360px and 390px widths.
4. Add Capacitor as a wrapper around the deployed web app.
5. Configure Android package name, icons, splash screen, and deep links.
6. Test file downloads, offline mode, login redirects, and payment redirects on a real Android device.

## Guardrails

- Do not embed service keys in the Android bundle.
- Keep payments server-side through Vercel functions.
- Keep AI provider defaults server-controlled.
- Do not claim native-only capabilities until implemented.

## Candidate Package

```text
com.sonaraindustries.os
```
