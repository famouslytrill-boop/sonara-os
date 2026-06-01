# Manual Go-Live Steps

1. Run final local commands from `docs/FINAL_COMMANDS.md`.
2. Verify no secrets in repo and generated artifacts.
3. Configure production env vars in hosting provider.
4. Deploy preview.
5. Verify preview routes and admin protection.
6. Connect `sonaraindustries.com`.
7. Verify DNS and SSL.
8. Verify canonical metadata, sitemap, robots, manifest, and favicon.
9. Verify Supabase auth redirects and RLS.
10. Run Stripe test-mode checkout, customer portal, and webhook checks.
11. Run source leak scan on build output.
12. Review Owner Confirmation Lock and admin-only routes.
13. Owner approves production deploy.
14. Monitor logs and support after launch.

Do not skip owner approval for production deploy.
