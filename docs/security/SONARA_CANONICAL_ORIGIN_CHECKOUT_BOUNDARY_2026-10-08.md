# SONARA canonical origin and checkout return-address boundary

**Status:** Draft PR #555; not merged, released, deployed or provider-certified. Applies to SONARA Industries, SONARA One, Business Builder, Creator Studio and Growth Studio.

## Security requirement

Externally sent URLs must be built from a configured, validated site origin, not `Host`, `X-Forwarded-Host` or `X-Forwarded-Proto` supplied on a request. This applies to Google OAuth callbacks, Stripe Checkout and billing-portal returns, employee invitations, shared results, marketplace links and other public links.

References:
- OWASP WSTG Host Header Injection: https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/07-Injection/17-Host_Header_Injection/
- Stripe hosted Checkout return URL contract: https://docs.stripe.com/api/checkout/sessions/object

## Implemented boundary

1. `lib/sonara-site-origin.cjs` selects `NEXT_PUBLIC_SITE_URL` (or the supplied verified application public URL) and accepts only an HTTPS origin with no embedded username/password, path, query or fragment. It returns the normalized origin.
2. Missing/invalid canonical origin fails closed in `NODE_ENV=production` and when Vercel platform variables `VERCEL_ENV` or `VERCEL` are present. No request-header fallback is allowed there.
3. Non-hosted development may use a syntactically valid request origin. Stripe Checkout specifically permits plaintext HTTP only on loopback hostnames (`localhost`, `127.0.0.1`, `[::1]`), never arbitrary HTTP external hosts.
4. The shared `getPublicAppUrl()` factory calls the canonical origin helper. The Vercel runtime requires explicit production configuration. Setting an invalid value is a configuration error, not permission to guess from request headers.
5. `getCheckoutRedirectUrls()` validates both absolute Checkout return URLs. Optional `STRIPE_SUCCESS_URL` and `STRIPE_CANCEL_URL` must remain on the canonical site's exact origin and use the same protocol; credentials, fragments, relative URLs and off-origin targets are rejected. If unset, defaults are `/account` and `/pricing`.
6. `createStripeCheckoutSession()` validates these URLs **before** any Stripe Price lookup or Checkout session request. It returns `site_origin_not_configured` or `checkout_redirect_untrusted` and emits a refusal event without external Stripe I/O.
7. The billing-portal endpoint checks the public origin before creating a Stripe portal session. The employee-invitation writer checks it before persisting a bearer invitation or requesting an email.

**A Stripe redirect does not prove payment or entitlement.** Signed webhooks, provider reconciliation, tenant-scoped records, refund handling and paid access authorization remain separate release gates.

## Validation

Regression suite: `tests/production-origin-must-not-follow-request-headers.test.js`.

The suite covers:
- forged Host and forwarded headers;
- empty, HTTP, malformed and credential-bearing canonical URLs;
- same-origin success/cancel overrides, off-origin refusal, fragments and URL downgrade;
- no Stripe lookup/session call when canonical or override URLs are untrusted;
- no bearer-invite persistence or email request when origin is absent;
- Vercel production/preview guard, including a misconfigured NODE_ENV;
- only loopback HTTP used for local Checkout testing;
- server routing to the shared origin helper.

Recommended focused test:
```sh
pnpm exec mocha tests/production-origin-must-not-follow-request-headers.test.js
```

Recommended full repository validation:
```sh
pnpm run typecheck
pnpm run verify:launch
```

Passing syntax/static contract inspection is **not** evidence that Mocha, browser, migration replay, provider sandbox or production acceptance succeeded. Run the complete exact-head GitHub workflow matrix and preserve all job links/SHAs.

## Operator release checklist

1. Confirm canonical `NEXT_PUBLIC_SITE_URL` and any aliases (`APP_URL`, `PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`) agree on the intended HTTPS origin in the approved environment; inspect names/scopes without exposing credential values. Treat redirect overrides as sensitive configuration.
2. Exercise bad Host and X-Forwarded-Host values in isolated testing. Google login, Stripe Checkout, employee invite URLs and share links must continue to use the configured canonical site.
3. Test missing, malformed and off-origin configuration. Expect a truthful refusal with no Stripe/session/invite write. Then restore valid sandbox configuration and verify that accepted journeys still work.
4. Independently verify exact-head Node CI, database/migration isolation, native browser and accessibility, payments, webhook/entitlement and rollback evidence.
5. Require protected main and an independently reviewed production environment. Preserve the user's current owner-controlled offline/deployment policy. No automatic site restoration or live-money testing.
6. Only after approval, deploy deliberately and verify current live commit, healthy public routes, signed webhooks, subscription activation/cancellation, invite acceptance, and observability.

## Risks and compatibility

- Rejecting previously accepted off-origin Stripe return overrides is an intentional safety change. If a genuine business requirement needs a second domain, it requires a separately reviewed allowlist and attack-path tests rather than a general-purpose HTTP URL validator.
- Local Checkout on loopback HTTP is allowed for developer testing; public non-TLS payment redirects are rejected.
- This change does not imply that service-provider credentials, branch protection, production database identity, Stripe Connect marketplace payments or live customer success were verified.


## Additional billing-summary reliability gate

The same production billing surface exposed a second payment-support defect:
`getBillingPanelSummary` was treating JSON parsing failure as an empty array
and only checking the five most recently updated subscription rows. A malformed
HTTP-200 response could say "No active paid plan found" or throw; a valid older
active subscription could be hidden behind five more recently updated canceled
rows.

- Preserve the first bounded, tenant-scoped five-row query for history.
- Require a parsed JSON array containing structurally valid subscription rows.
  A singular error object, null row, missing plan/status field or broken JSON
  must display "We could not check your plan just now", never "no plan."
- If no active/trialing row is present in the bounded history, make one
  additional organization-scoped, status-filtered query before claiming none.
- Fail closed on transport errors or malformed data from the second query.
- A successfully read empty history **and** empty active query is the only
  supported basis here for reporting no active subscription.
- This is a **customer-visible reporting integrity fix**, not an entitlement
  grant and not evidence of Stripe reconciliation.

Regression suite:
`tests/a-billing-page-says-what-happens-next.test.js`.
The new cases cover malformed JSON, HTTP-200 error objects, partial records,
older active rows, read failure, and tenant scoping.

Official PostgREST plural JSON representation contract:
https://postgrest.org/en/latest/references/api/resource_representation.html
