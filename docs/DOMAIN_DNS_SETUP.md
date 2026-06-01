# Domain DNS Setup

Do not claim the domain is connected until DNS verification passes in the hosting provider.

Checklist:

- Confirm registrar control for `sonaraindustries.com`.
- Add the host-required apex/root records.
- Add `www` records only if the launch plan uses `www`.
- Decide redirect behavior: root to root, `www` to root, and optional `app` alias to `/app`.
- Do not create separate unrelated domains for Business Builder, Creator Studio, or Growth Studio.
- Re-run the Deployment Sync dashboard after DNS changes.

Expected env values:

- `NEXT_PUBLIC_SITE_URL=https://sonaraindustries.com`
- `NEXT_PUBLIC_APP_URL=https://sonaraindustries.com/app`
- `NEXT_PUBLIC_MARKETING_URL=https://sonaraindustries.com`
