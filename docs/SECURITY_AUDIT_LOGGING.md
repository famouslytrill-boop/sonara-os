# Security Audit Logging

Audit logging should record safe event summaries without secrets.

Log examples:

- checkout route setup error
- checkout session created
- webhook signature rejected
- webhook received without Supabase admin configured
- subscription upsert failed

Do not log full secret keys, webhook secrets, access tokens, raw payment data, or sensitive user files.
