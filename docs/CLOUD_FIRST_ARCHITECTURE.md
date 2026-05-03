# Cloud-First Architecture

SONARA OS™ runs from the cloud. Normal users can use the browser or PWA and should not need to download software for the core workflow.

Core launch stack:

- Vercel for website and app hosting
- Supabase for Postgres, Auth, Storage, and migrations
- Stripe Checkout for web subscriptions
- GitHub for source control
- Browser/PWA for user access

Normal users do not need local Node.js, npm, Git, command line tools, a local database, a local GPU, an OpenAI key, a Stripe account, a Supabase account, or a Vercel account.

Founder and developer setup may still use Vercel, Supabase, Stripe, GitHub, local Node.js, npm, and CLI tools.

Cloud-first does not mean unlimited free storage, bandwidth, compute, or payment processing forever. Free tiers have limits and production usage must be monitored.
