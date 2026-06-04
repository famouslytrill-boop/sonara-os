# Production Environment Final

Required public env:

- `NEXT_PUBLIC_SITE_URL=https://sonaraindustries.com`
- `NEXT_PUBLIC_APP_URL=https://sonaraindustries.com/app`
- `NEXT_PUBLIC_COMPANY_NAME=SONARA Industries`
- `NEXT_PUBLIC_PLATFORM_NAME=SONARA Industries`
- `NEXT_PUBLIC_SUPPORT_EMAIL=`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=`
- `NEXT_PUBLIC_SUPABASE_URL=`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=`

Required server-only env when features are enabled:

- `STRIPE_SECRET_KEY=`
- `STRIPE_WEBHOOK_SECRET=`
- `SUPABASE_SERVICE_ROLE_KEY=`
- `DATABASE_URL=`

Cloud/deployment env:

- `GITHUB_REPOSITORY=`
- `VERCEL_PROJECT_ID=`
- `VERCEL_ORG_ID=`
- `DOCKER_IMAGE_NAME=`
- `RANCHER_CLUSTER_ID=`
- `RANCHER_PROJECT_ID=`

Never print or commit raw secret values. Show only configured/not configured in admin diagnostics.
