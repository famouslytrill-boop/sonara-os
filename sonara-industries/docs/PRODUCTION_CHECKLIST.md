# SONARA Industries™ Production Checklist

This MVP scaffold is production-oriented, but it is not live-production complete until real credentials, dashboard setup, migrations, and smoke tests are complete.

Required before launch:
- Configure Supabase Auth, Postgres, Storage, and RLS.
- Apply `supabase/migrations/010_sonara_industries_v3_rls.sql`.
- Configure Stripe products, prices, Checkout, Customer Portal, and webhook.
- Add Vercel/hosting env vars without committing secrets.
- Run database backup and restore test.
- Confirm Sentry and log drains.
- Confirm PWA install on iOS/Android/desktop.
- Review legal pages with counsel.
- Complete one real customer workflow for SoundOS, TableOS, and AlertOS.

Blocked until verified:
- Public AlertOS broadcast delivery.
- Role changes by automation.
- Billing changes by automation.
- Destructive actions without approval.
