# Phone Auth Setup

SONARA login includes a phone OTP flow using Supabase Auth. The UI accepts E.164 phone numbers and verifies SMS OTP codes, but production delivery requires Supabase Phone provider and SMS provider configuration.

## Supabase Setup

1. Open Supabase Dashboard.
2. Go to Authentication -> Providers.
3. Enable Phone provider.
4. Configure the SMS provider supported by the Supabase project.
5. Confirm SMS costs, rate limits, country availability, and abuse controls.
6. Confirm production Site URL and redirect URLs.

## User Format

Phone numbers must use E.164 format, for example:

```text
+15551234567
```

The UI pattern accepts a leading `+` followed by country code and subscriber number.

## Smoke Test

1. Open `/login`.
2. Select Phone OTP.
3. Enter a test phone number in E.164 format.
4. Send the code.
5. Enter the received OTP.
6. Confirm redirect to `/auth/callback` and then `/os`.
7. Confirm Supabase Auth Users shows the phone user.
8. Confirm workspace bootstrap rows are created.

Do not claim phone login is live until an actual SMS OTP is delivered and verified in production.
