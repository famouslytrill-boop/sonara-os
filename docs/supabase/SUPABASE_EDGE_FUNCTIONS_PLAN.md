# Supabase Edge Functions Plan

Edge Functions are planned but not active in this repository. Production function deployment requires:

- Server-only secret handling.
- Audit logging for sensitive actions.
- Input validation.
- Rate limiting where user-triggered.
- Clear owner approval before high-risk actions.

No Edge Function in this repo sends email, charges payments, changes permissions, or runs background tasks without provider configuration and review.
