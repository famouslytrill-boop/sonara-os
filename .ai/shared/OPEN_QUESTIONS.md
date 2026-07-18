# Open Questions

1. Who owns the 155 modified, 1 deleted, and 18 untracked pre-existing paths in this checkout, and which logical commits are intended?
2. Is this checkout now the canonical implementation, or must it remain synchronized with `C:\Users\AXPAY\famouslytrill-project` named in the master directive?
3. Which current branch/commit is deployed to `sonaraindustries.com`?
4. Are the current Supabase migrations applied remotely, and is `organization_members` intentionally canonical instead of `organization_memberships`?
5. Which auth providers are actually enabled in production?
6. Which Stripe price IDs, webhook endpoint, and entitlement tables are verified in live/test mode?
7. Is the Resend sender domain verified, and are support delivery retries operating?
8. Are Cloudflare DNS/email routing, GitLab mirror, Docker/Rancher workers, or Expo native builds active or documentation-only?
9. Should `/admin/*` and `/app/admin/*` remain parallel route families, or should one become a compatibility redirect after parity review?
10. Which generated files under `.playwright-cli/` and `output/` should be retained as evidence versus ignored?

