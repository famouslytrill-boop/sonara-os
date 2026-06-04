# Local Environment Variables

Create `.env.local` from `.env.example` when running local auth or provider checks. Do not commit `.env.local`.

Public browser-safe values:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
$env:NEXT_PUBLIC_SITE_URL="http://localhost:5173"
```

Server-only values:

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="server-only"
$env:SUPABASE_ACCESS_TOKEN="server-only"
$env:SUPABASE_PROJECT_ID="server-only"
$env:SUPABASE_DB_PASSWORD="server-only"
```

Support/email values:

```powershell
$env:SUPPORT_EMAIL="support@example.com"
$env:CONTACT_EMAIL="contact@example.com"
$env:RESEND_API_KEY="server-only"
$env:RESEND_FROM_EMAIL="support@example.com"
```

Rules:

- `NEXT_PUBLIC_SUPABASE_URL` must match Supabase Project Settings -> API -> Project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public-safe but should still not be logged casually.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- Missing provider values should show readiness gates, not crashes.
- Do not use npm to regenerate a lockfile.
