# Secrets Management

Keep secrets out of client code, public assets, docs, and generated build output.

## Public Values

`NEXT_PUBLIC_*` values are browser-exposed. Use them only for values safe to show to any visitor, such as public app URLs, public company name, support email, Supabase URL, and Supabase anon key.

Never use `NEXT_PUBLIC_*` for:

- service-role keys
- webhook secrets
- Stripe secret keys
- database URLs
- provider API keys
- private tokens
- passwords

## Server-Only Values

Server-only secrets belong in the hosting provider secret manager or local untracked env files. `.env.example` may contain only blank or placeholder values.

Server-only examples:

- Supabase service-role key
- Stripe secret key
- Stripe webhook secret
- provider API keys
- database connection strings

## Repo Rules

- Do not commit real `.env` files.
- Do not paste secrets into docs, tests, screenshots, logs, or generated artifacts.
- Do not expose a service-role key to browser code.
- Do not use automated audit-fix commands without review.
- Run `pnpm run security:scan-artifacts` before launch or release review.

## Validation

The security env validation helper blocks dangerous browser-exposed secret names and warns when public Supabase config is incomplete.
