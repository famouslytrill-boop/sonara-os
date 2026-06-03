# Production Smoke Tests

Run these manually after deploying.

1. Open the production URL.
2. Visit `/`.
3. Visit `/business-builder`.
4. Visit `/creator-studio`.
5. Visit `/growth-studio`.
6. Visit `/signup`.
7. Sign up with a test email.
8. Confirm the user appears in Supabase Auth Users.
9. Confirm a `profiles` row exists.
10. Confirm an `organizations` row exists.
11. Confirm an `organization_memberships` row exists with `role = owner`.
12. Log out through `/logout`.
13. Log back in through `/login`.
14. Visit `/os`.
15. Visit `/app/dashboard`.
16. Visit `/app/customers`, `/app/bookings`, `/app/payments`, `/app/files`, `/app/reviews`, `/app/campaigns`, and `/app/research`.
17. Create a test customer when the write UI is enabled.
18. Confirm RLS prevents another test user from seeing that customer.
19. Start Stripe test checkout from a paid tier.
20. Confirm webhook received in Stripe.
21. Confirm `webhook_events` contains the Stripe event ID.
22. Confirm duplicate webhook delivery does not duplicate fulfillment.
23. Test customer portal if a subscription exists.
24. Submit a support/contact form.
25. Test Resend email only after sender domain verification.
26. Test mobile layout.
27. Scan public pages for unwanted legacy public copy.
28. Check browser console for errors.
29. Check Vercel runtime logs.

No-go if auth, RLS, checkout, webhook, or support intake fails.
