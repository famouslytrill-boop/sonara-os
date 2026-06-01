# Vercel Final Setup

Vercel is the preferred MVP hosting path if the static web build is used. Rancher/Kubernetes is not required for MVP unless the owner approves that ops path.

Checklist:

- Connect the GitHub repository to the Vercel project.
- Set the production branch.
- Add `sonaraindustries.com` as the production domain.
- Verify SSL is active in Vercel before public launch.
- Add production and preview environment variables.
- Confirm build command and output directory.
- Confirm generated `_headers`, `robots.txt`, `sitemap.xml`, and `api/health` artifacts are deployed.
- Document redirects/rewrites if `app.sonaraindustries.com` is later enabled.

Do not store Vercel tokens in the repo.
