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
17. Test Google login after Supabase Google provider setup.
18. Test phone login after Supabase Phone/SMS setup.
19. Visit `/app/settings`.
20. Change language and refresh; confirm it persists.
21. Change unit system and refresh; confirm it persists.
22. Create a test customer when the write UI is enabled.
23. Confirm RLS prevents another test user from seeing that customer.
24. Start Stripe test checkout from a paid tier.
25. Confirm webhook received in Stripe.
26. Confirm `webhook_events` contains the Stripe event ID.
27. Confirm duplicate webhook delivery does not duplicate fulfillment.
28. Test customer portal if a subscription exists.
29. Submit a support/contact form.
30. Test Resend email only after sender domain verification.
31. Test mobile layout.
32. Scan public pages for unwanted legacy public copy.
33. Check browser console for errors.
34. Check Vercel runtime logs.

No-go if auth, RLS, preferences, checkout, webhook, or support intake fails.
