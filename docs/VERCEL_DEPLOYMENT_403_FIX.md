# Vercel Deployment 403 Fix

If Vercel preview or production shows a 403 response, treat it as a deployment or access configuration issue, not a Next.js build failure.

1. Test the custom domain:
   - `https://sonaraindustries.com`
   - `https://sonaraindustries.com/pricing`
2. Check Vercel â†’ Project â†’ Settings â†’ Deployment Protection.
3. Disable Vercel Authentication or password protection for Production if the public site should be available.
4. Check Project â†’ Settings â†’ Domains.
5. Confirm both domains are attached to this Vercel project:
   - `sonaraindustries.com`
   - `www.sonaraindustries.com`
6. Check middleware/auth logic if pages are still blocked after Deployment Protection is off.
7. Redeploy after environment variable changes, preferably without build cache after payment env changes.

SONARA OSâ„¢ public routes should stay public. Auth-protected creator workspace routes can be gated later after Supabase Auth is fully configured.
