# Production Domain Checklist

- Confirm canonical domain ownership.
- Configure DNS records in the domain provider.
- Verify SSL/TLS is active.
- Confirm redirects do not break `/`, `/pricing`, `/contact`, `/support`, `/help`, `/feedback`, `/business-builder`, `/creator-studio`, or `/growth-studio`.
- Confirm app routes show setup-gated UI unless auth and organization membership are configured.
- Hard refresh after deploy to verify favicon and manifest updates.
- Do not claim production readiness until Vercel deploy, CI, route smoke, dependency scan, Supabase preview, and human review pass.
