> **Retired on 1 October 2026.** The operator console this describes was removed
> at the owner's instruction: 58 registered routes under `/admin` and
> `/api/admin`, the admin login and session, and the `requireAdmin` gate. Every
> path named below now answers 404, and
> `tests/the-operator-console-is-gone-and-so-is-its-bypass.test.js` keeps it that
> way. The business-owner controls that replaced the customer-facing part of this
> are at `/owner/administration`.
>
> Kept as history, in `docs/archive/` so nothing reads it as a current
> instruction. Do not follow the steps below.

# Owner Command Center

Owner surfaces track launch readiness, revenue readiness, security review, system health, provider status, and human-required setup. They do not expose service-role actions client-side.
