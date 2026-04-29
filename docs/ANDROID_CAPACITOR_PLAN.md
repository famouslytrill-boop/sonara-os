# Android Capacitor Plan

SONARA OS™ remains PWA-first.

Capacitor should be added later only after the web/PWA experience is stable, mobile QA is complete, and public policies are final.

Future Android plan:

- Wrap the stable PWA with Capacitor.
- Produce an Android App Bundle `.aab`.
- Target SDK 35+.
- Use the existing PWA icons and splash assets as the baseline.
- Keep OpenAI BYOK optional and never require a paid provider key for install or launch.
- Keep Local Rules as the default provider for web, PWA, and native wrapper builds.
- Test before Play Store submission.
- Do not add native-only product complexity unless it supports Build a Song, Build a Release, Build an Artist System, or Run a Studio Workflow.
