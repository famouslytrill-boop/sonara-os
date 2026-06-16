# Customer Usage Readiness

SONARA Industries is code-ready for customer-facing shell review. The remaining work is provider configuration and owner approval.

## Customer-facing areas

- Parent SONARA Industries homepage.
- Business Builder overview, dashboard, and launch readiness.
- Creator Studio overview, dashboard, and launch readiness.
- Growth Studio overview, dashboard, and launch readiness.
- Contact and support intake.
- Pricing and server-side checkout shell.
- Help, docs, security, login readiness, and legal pages.

## Setup-required behavior

When providers are missing:

- Contact returns a reference ID with `setup_required` fallback messaging.
- Checkout returns `setup_required`.
- Login shows Google OAuth setup-required messaging.
- Admin remains protected.
- Readiness APIs expose only status flags, never secret values.

## Remaining manual 10 percent

- Configure production environment variables in Vercel.
- Apply Supabase migrations to the production project.
- Create Stripe products/prices and configure webhook signing.
- Verify Resend domain and sender.
- Configure Google OAuth and Supabase Auth provider settings.
- Complete legal review.
- Run owner production smoke tests.
