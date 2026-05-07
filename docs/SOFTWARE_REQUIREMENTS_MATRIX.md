# SONARA OSâ„¢ Software Requirements Matrix

SONARA OSâ„¢ should stay lightweight, launchable, and honest. This matrix separates what is required now from cloud setup, optional future tools, and software that should not be installed for launch.

Normal users should not need to download developer software. They use SONARA OSâ„¢ from the browser or PWA. Required-now tools are for founder/developer setup, local testing, deployment, and maintenance.

## A. Required Now

These tools are needed to run, build, deploy, or test the current Next.js app.

| Tool | Purpose | Install status | Required for launch | Risk | Manual setup needed | Docs link or command |
| --- | --- | --- | --- | --- | --- | --- |
| Node.js LTS | Runs the Next.js app, npm scripts, and local launch tooling. | Check with `npm run check:software`. | Yes | Low if installed from official source. | Install from official Node.js site if missing. | [nodejs.org](https://nodejs.org/) |
| npm | Installs project dependencies from `package-lock.json` and runs scripts. | Bundled with Node.js. | Yes | Low when using `npm ci` from the lockfile. | None after Node.js install. | `npm --version` |
| Next.js project dependencies | Current app dependencies: Next.js, React, React DOM, Tailwind, TypeScript, ESLint. | Installed through `npm ci` or `npm install`. | Yes | Medium if arbitrary packages are added. | Use the lockfile; do not add packages without a reason. | `npm ci` |
| Vercel CLI | Links and deploys the project, manages Vercel environments if needed. | Optional local CLI; cloud dashboard can also be used. | Yes for CLI deploy flow, no for dashboard deploy flow. | Medium because it can alter deployments/envs. | Login and link project manually. | `npm install -g vercel` |
| Stripe CLI | Tests Stripe webhooks locally and forwards events. | Optional local CLI. | Yes for local webhook testing, no for static build. | Medium because wrong account/mode can cause confusion. | Login to Stripe CLI; use test mode first. | [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli) |
| Supabase CLI | Runs local migrations and database checks when Supabase is used. | Optional local CLI. | Yes if applying migrations locally. | Medium because migrations alter schemas. | Login/link project and review migrations before apply. | [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli) |
| Git | Connects local folder to `famouslytrill-boop/sonara-os`. | Not currently initialized in this folder. | Yes for source control/push flow. | Medium if initialized in the wrong directory. | Initialize only inside `C:\SignalOS\signal-os` if needed. | `git --version` |
| VS Code or equivalent editor | Safe code review, search, and manual launch edits. | User choice. | No, but recommended. | Low. | Install preferred editor. | [code.visualstudio.com](https://code.visualstudio.com/) |

## B. Required Cloud Services

These services are configured in dashboards or CLIs. They are not downloaded into the repo.

| Service | Purpose | Install status | Required for launch | Risk | Manual setup needed | Docs link or command |
| --- | --- | --- | --- | --- | --- | --- |
| Vercel | Hosting, deployments, domains, environment variables. | Cloud service. | Yes | High if secrets are configured incorrectly. | Add env vars in Vercel dashboard and redeploy. | [vercel.com/docs](https://vercel.com/docs) |
| Supabase | Postgres, Auth, Storage, pgvector, migrations. | Cloud service. | Yes for persistent projects/auth/storage. | High if RLS is missing or service key leaks. | Run migrations, enable RLS, keep service role server-only. | [supabase.com/docs](https://supabase.com/docs) |
| Stripe | Web subscriptions, checkout, payment webhooks. | Cloud service. | Yes for paid plans. | High if live keys leak or webhook is unverified. | Rotate exposed key, create products/prices, add Vercel env vars, test webhooks. | [stripe.com/docs](https://stripe.com/docs) |
| GitHub | Source control, Codex integration, PR review, deployment source. | Cloud service. | Yes for repo target. | Medium if secrets are committed. | Connect repo and push only from project root. | [docs.github.com](https://docs.github.com/) |

## C. Optional Future Open-Source Tools

Do not install these automatically unless a specific launch task requires them.

| Tool | Purpose | Install status | Required for launch | Risk | Manual setup needed | Docs link or command |
| --- | --- | --- | --- | --- | --- | --- |
| FFmpeg | Audio metadata, duration, transcoding, waveform prep. | Optional future. | No | Medium; native binary and licensing considerations. | Install from trusted package manager/source only. | [ffmpeg.org](https://ffmpeg.org/) |
| Python 3.11+ | Future analysis microservices and scripts. | Optional future. | No | Low if official installer is used. | Create isolated virtual environments. | [python.org](https://www.python.org/) |
| librosa | Deeper audio analysis in a Python microservice. | Optional future. | No | Medium; heavy scientific dependencies. | Install in isolated Python service only. | `python -m pip install librosa` |
| Essentia.js | Audio feature extraction in browser/server workflows. | Optional future. | No | Medium; bundle size and runtime cost. | Prototype before adding to main app. | [essentia.upf.edu](https://essentia.upf.edu/) |
| Ollama | Local LLM experiments. | Optional future. | No | Medium; model storage and local compute. | Keep optional; do not make core logic depend on it. | [ollama.com](https://ollama.com/) |
| LM Studio | Local model experiments. | Optional future. | No | Medium; local model/storage complexity. | Keep optional and user-controlled. | [lmstudio.ai](https://lmstudio.ai/) |
| Qdrant | Vector search at larger scale. | Optional future. | No | Medium; extra database service. | Add only after Supabase pgvector limits are reached. | [qdrant.tech](https://qdrant.tech/) |
| Chroma | Local vector prototyping. | Optional future. | No | Medium; another storage path to maintain. | Use only for local experiments. | [trychroma.com](https://www.trychroma.com/) |
| Milvus | Large-scale vector search. | Optional future. | No | High; infrastructure overhead. | Defer until scale demands it. | [milvus.io](https://milvus.io/) |
| Weaviate | Hybrid semantic and graph experiments. | Optional future. | No | High; extra service complexity. | Defer until product need is proven. | [weaviate.io](https://weaviate.io/) |
| ClickHouse | Analytics at scale. | Optional future. | No | High; operational overhead. | Use only after analytics volume requires it. | [clickhouse.com](https://clickhouse.com/) |
| Neo4j | Graph relationships and catalog connections. | Optional future. | No | High; separate database model. | Prototype before production. | [neo4j.com](https://neo4j.com/) |
| NocoDB | Internal database admin UI. | Optional future. | No | Medium; admin exposure risk. | Private/admin-only if ever used. | [nocodb.com](https://nocodb.com/) |
| Capacitor | Future Android/iOS wrapper. | Optional future. | No | Medium; app store compliance and native billing. | Add after PWA is stable. | [capacitorjs.com](https://capacitorjs.com/) |
| OBS Studio | Manual broadcast workflow and release listening sessions. | Optional future. | No | Low if manual; medium if automated. | Keep as OBS-ready export until integration is built. | [obsproject.com](https://obsproject.com/) |
| Continue.dev | Developer productivity only. | Optional future. | No | Medium; code access and configuration. | Use locally with clear repo permissions. | [continue.dev](https://continue.dev/) |

## D. Do Not Install For Launch

These add risk or complexity before revenue and should stay out of the launch path.

| Tool or system | Purpose | Install status | Required for launch | Risk | Manual setup needed | Docs link or command |
| --- | --- | --- | --- | --- | --- | --- |
| Heavy GPU stacks | Model training or accelerated media workloads. | Do not install. | No | High cost and setup complexity. | Revisit only with a funded workload. | N/A |
| CUDA-specific dependencies | GPU-specific acceleration. | Do not install. | No | High compatibility risk. | Avoid for web launch. | N/A |
| Unsecured Flowise server | Visual LLM workflows. | Do not install. | No | High if exposed publicly. | Private/security review only. | N/A |
| Public marketplace systems | User-to-user commerce. | Do not install/build for launch. | No | High legal, payout, moderation, and support risk. | Delay until compliance is ready. | See `docs/NO_PUBLIC_KIT_MARKETPLACE_LAUNCH_POLICY.md` |
| Automatic sample downloading for resale | Bulk sound ingestion/resale. | Do not install/build for launch. | No | Critical rights risk. | Metadata-only discovery until rights review exists. | N/A |
| Direct OBS WebSocket control | Live OBS automation. | Do not install for launch. | No | Medium; live production control risk. | Keep OBS-ready export documents only. | N/A |
| Real-time collaboration server | Live co-writing/team sessions. | Do not install for launch. | No | High without auth/storage/permissions. | Add only after auth and persistence mature. | N/A |
| Multiple vector databases at once | Semantic search infrastructure. | Do not install for launch. | No | High operational complexity. | Use Supabase pgvector first when ready. | N/A |

## Safe Principle

Install only what the current app needs to build and run. Document optional tools, add them only when a real launch task requires them, and never claim revenue or profit is guaranteed.
