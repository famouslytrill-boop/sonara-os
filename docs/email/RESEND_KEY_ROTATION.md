# Resend Key Rotation

Any Resend API key shown in a screenshot, chat, browser console, logs, or copied into a public place must be treated as compromised.

## Required Rotation Steps

1. Revoke the exposed Resend API key in the Resend dashboard.
2. Create a new production key with the minimum permissions Resend supports for sending transactional email.
3. Add the new key to Vercel as `RESEND_API_KEY`.
4. Mark the key sensitive/server-only in Vercel.
5. Confirm no `RESEND_API_KEY` value exists in repo files, screenshots, docs, or client code.
6. Redeploy the app.
7. Run:

```powershell
pnpm run verify:email-env
pnpm run test:email -- --send
```

8. Confirm the test email arrives in the real support inbox.

## Safety Rules

- Never use `NEXT_PUBLIC_RESEND_API_KEY`.
- Never print the key in logs.
- Never paste the key into Codex, GitHub comments, docs, or browser tools.
- Keep `.env.local` untracked.
- If another exposure happens, rotate again before launch.
