# Domain DNS Live Setup

Canonical domain: `sonaraindustries.com`.

## Public Routes

- `https://sonaraindustries.com/`
- `https://sonaraindustries.com/pricing`
- `https://sonaraindustries.com/business-builder`
- `https://sonaraindustries.com/creator-studio`
- `https://sonaraindustries.com/growth-studio`
- `https://sonaraindustries.com/security`
- `https://sonaraindustries.com/about`
- `https://sonaraindustries.com/contact`
- `https://sonaraindustries.com/terms`
- `https://sonaraindustries.com/privacy`
- `https://sonaraindustries.com/refund-policy`

## App Routes

- `https://sonaraindustries.com/app`
- `https://sonaraindustries.com/app/business-builder`
- `https://sonaraindustries.com/app/creator-studio`
- `https://sonaraindustries.com/app/growth-studio`
- `https://sonaraindustries.com/app/admin/command-center`
- `https://sonaraindustries.com/app/security-center`
- `https://sonaraindustries.com/app/billing`
- `https://sonaraindustries.com/app/onboarding`

## Checklist

- Configure root domain at the hosting provider.
- Decide whether `www` redirects to root or root redirects to `www`.
- Verify DNS propagation.
- Verify canonical metadata points to `NEXT_PUBLIC_SITE_URL`.
- Do not claim the domain is connected until the deployed production URL resolves with SSL.
