# Google Play Launch Checklist

SONARA OS is currently a responsive PWA. Use this checklist before wrapping it for Google Play.

Web Stripe subscriptions are for the website and PWA. Native Android digital subscriptions may require Google Play Billing, and native iOS digital subscriptions may require Apple IAP. Do not route around app store billing rules inside native apps.

## Store Readiness

- [ ] Final app name: `SONARA OS`.
- [ ] Final short description approved.
- [ ] Full description uses SONARA Industries trademark language.
- [ ] Screenshots captured at phone and tablet sizes.
- [ ] Privacy policy URL points to `https://sonaraindustries.com/privacy`.
- [ ] Terms URL points to `https://sonaraindustries.com/terms`.
- [ ] Support email is a real monitored inbox.
- [ ] 512x512 icon prepared.
- [ ] 1024x500 feature graphic prepared.
- [ ] Phone screenshots prepared.
- [ ] Tablet screenshots prepared if tablet support is listed.
- [ ] Data Safety form completed.
- [ ] Closed testing plan prepared if required.
- [ ] No claims promise income, placements, hit records, approvals, legal outcomes, or distribution outcomes.

## Technical Readiness

- [ ] Android wrapper points at `https://sonaraindustries.com`.
- [ ] App opens `/dashboard` after launch.
- [ ] Offline fallback works.
- [ ] File export flow works on Android.
- [ ] Login redirect URLs include the production domain and Android callback if Capacitor is used.
- [ ] Supabase and Stripe production keys are configured in Vercel, not inside the mobile bundle.
- [ ] Android target API 35 or newer.
- [ ] Native billing review completed before selling digital subscriptions inside a native app.

## Review Notes

- SONARA OS is a planning and workflow app.
- AI provider mode defaults to deterministic local rules.
- OpenAI BYOK and paid providers are optional.
