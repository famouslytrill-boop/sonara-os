# SONARA External Repository Integration Registry

This registry captures external repositories, models, and open-source projects discussed across SONARA Industries chats. Full access authorization allows SONARA to evaluate, document, and build controlled integrations. It does not authorize unsafe cloning into production, license violations, secret exposure, customer-data leakage, or unrestricted agent execution.

## Registry rules

Every external repository must be classified before production use:

- `approved_reference`: can inform architecture, UX, testing, or patterns.
- `review_required`: needs license, security, dependency, or product-fit review.
- `worker_candidate`: useful only in a controlled background worker/container.
- `integration_candidate`: useful through API/adapter with permission and audit controls.
- `do_not_integrate_directly`: useful for reference only; do not import into production code.

No external project should be added to customer-facing production until:

1. License is reviewed.
2. Security surface is reviewed.
3. Dependencies are reviewed.
4. Data-access boundaries are defined.
5. Runtime placement is defined.
6. Admin readiness can show status.
7. A rollback path exists.

## Governed AI integration set

These entries have catalog, database, environment, and admin-readiness integration. `adapter_available` means a disabled-by-default, read-only HTTP readiness probe exists; it does not mean workflow or agent execution is authorized.

| Project | Source | Status | Integration placement |
|---|---|---|---|
| OpenClaw | `github.com/openclaw/openclaw` | `adapter_available` | Private device/operator gateway |
| n8n | `github.com/n8n-io/n8n` | `adapter_available_license_review` | Isolated automation service |
| Ollama | `github.com/ollama/ollama` | `adapter_available` | Local/private model runtime |
| Langflow | `github.com/langflow-ai/langflow` | `adapter_available` | Authenticated private flow service |
| Dify | `github.com/langgenius/dify` | `adapter_available_license_review` | External or self-hosted app service |
| LangChain | `github.com/langchain-ai/langchain` | `worker_reference` | Controlled worker framework only |
| Open WebUI | `github.com/open-webui/open-webui` | `adapter_available_terms_review` | Private operator interface |
| DeepSeek V3 | `github.com/deepseek-ai/DeepSeek-V3` | `gateway_model_option` | Approved gateway or private GPU worker; weights not bundled |
| Gemini CLI | `github.com/google-gemini/gemini-cli` | `developer_only` | Developer workstation/container only |
| RAGFlow | `github.com/infiniflow/ragflow` | `adapter_available_license_review` | Isolated retrieval stack |
| Claude Code | `github.com/anthropics/claude-code` | `developer_only` | Developer workstation/container only |
| CrewAI | `github.com/crewAIInc/crewAI` | `adapter_available` | Reviewed background worker only |

## Agent and orchestration

| Project | Source | SONARA fit | Status | Integration placement |
|---|---|---|---|---|
| CrewAI | `github.com/crewAIInc/crewAI` | Agent orchestration for a future read-only launch-readiness pilot | `readiness_adapter_only` | Worker/container only |
| pydantic/monty | `github.com/pydantic/monty` | AI/code/agent research candidate, likely useful for structured tool/workflow review | `review_required` | Research first |

## Creator Studio, media, and AI production

| Project | Source | SONARA fit | Status | Integration placement |
|---|---|---|---|---|
| NVIDIA Nemotron ASR Streaming 0.6B | `huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b` | Speech-to-text/transcription for Creator Studio, support recordings, audio notes | `worker_candidate` | GPU/CPU worker, never browser direct |
| NVIDIA MotionBricks | `nvlabs.github.io/motionbricks` / research paper | Real-time motion generation research for future 3D previews, avatars, and robotics-style interaction demos | `review_required` | Research/GPU worker only |
| Claude Video / watch | `github.com/bradautomates/claude-video` | Video/reel/frame/transcript analysis pattern for Creator Studio viral hook analysis, ad review, and screen-recording bug review | `worker_candidate` | Worker only with ffmpeg/yt-dlp controls |
| OpenCut | `github.com/OpenCut-app/OpenCut` | Video editor workflow reference for Creator Studio | `review_required` | Reference or controlled adapter |
| OBS Studio | OBS Project | Creator broadcast/recording workflow reference | `approved_reference` | External tool guidance, not bundled |
| FFmpeg | FFmpeg project | Audio/video conversion jobs | `worker_candidate` | Worker/container |
| yt-dlp | yt-dlp project | Video metadata/caption retrieval for approved URLs and owned/public content analysis | `worker_candidate` | Worker/container with policy controls |
| MusicGen / AudioCraft | Meta AudioCraft ecosystem | Music generation research and worker job inspiration | `review_required` | Worker only |
| Demucs | Music source separation | Stem separation for Creator Studio audio jobs | `worker_candidate` | Worker/container only |
| Amphion | Audio/music/speech generation toolkit | Advanced audio generation research | `review_required` | Worker only |
| EnCodec | Neural audio codec | Audio tokenization/compression research | `review_required` | Worker only |
| librosa | Python audio analysis | Audio feature extraction, tempo, key, spectral analysis | `worker_candidate` | Worker/container |
| Essentia | Audio/music analysis | Audio feature extraction and music intelligence | `worker_candidate` | Worker/container |
| music21 | Music theory toolkit | Chord/key/structure analysis | `worker_candidate` | Worker/container |
| LilyPond | Music notation | Sheet/notation export | `worker_candidate` | Worker/container |

## Business Builder and operations systems

| Project | Source | SONARA fit | Status | Integration placement |
|---|---|---|---|---|
| ERP AI prompt playbooks | User-provided operations workflow reference | Business Builder prompt packs for financial close, procurement, vendor management, inventory, production operations, ERP data cleanup, reporting, AP/AR, and forecasting | `approved_reference` | Pattern/content system only |
| Odoo | `github.com/odoo/odoo` | ERP/CRM/inventory/accounting workflow reference | `approved_reference` | Reference, do not copy directly |
| CockroachDB | `github.com/cockroachdb/cockroach` | Distributed SQL architecture reference | `approved_reference` | Reference only; Supabase/Postgres remains current core |
| Chef | `github.com/chef/chef` | Infrastructure automation reference | `review_required` | Ops reference |
| Rancher | Rancher ecosystem | Container orchestration for future workers | `integration_candidate` | Worker infrastructure later |
| Docker | Docker ecosystem | Worker packaging for AI/audio/video jobs | `integration_candidate` | Worker/container |
| Domoticz | `github.com/domoticz/domoticz` | IoT/device/sensor automation reference for future device/location modules | `review_required` | Reference first |

## Growth Studio, scraping, search, and automation references

| Project | Source | SONARA fit | Status | Integration placement |
|---|---|---|---|---|
| Viral hook video analysis | User-provided Claude Video pattern | Analyze competitor reels, ad creatives, content structure, first-frame hooks, captions, and timestamped calls to action | `worker_candidate` | Creator/Growth worker with content policy limits |
| OmniParse | discussed in chats | Document parsing/OCR workflow reference | `review_required` | Worker only |
| ECC | discussed in chats | Research/security/encoding candidate from prior chats | `review_required` | Research first |
| gemini-business2api | discussed in chats | Business automation/API bridge reference | `review_required` | Review first |
| headroom | discussed in chats | Automation/research candidate | `review_required` | Review first |
| flowsint | discussed in chats | Intelligence/OSINT-style workflow reference | `review_required` | Strict compliance review required |
| turbovec | discussed in chats | Vector/search acceleration candidate | `review_required` | Worker or service layer |
| Microsoft RayFin | `github.com/microsoft/rayfin` | Financial/data/AI research reference from chats | `review_required` | Research first |

## App, UI, and clone/reference repositories

| Project | Source | SONARA fit | Status | Integration placement |
|---|---|---|---|---|
| Mobile AI app builder onboarding pattern | User-provided Emergent ad/reference screenshot | Mobile-first signup/onboarding pattern: big promise, social auth, email/phone path, legal consent, social proof, single CTA | `approved_reference` | Pattern only; do not copy branding |
| 3D interactive hero pattern | User-provided 3D site ad/reference screenshot | Bright, high-impact 3D object hero for SONARA public pages and Creator Studio previews | `review_required` | Progressive visual layer only |
| Free developer stack directory | `free-for.dev` / user-provided reference screenshot | Searchable free-tier software directory pattern for a SONARA Free Launch Stack page covering hosting, databases, email, storage, analytics, design, code repos, APIs, AI, security, and operations tools | `approved_reference` | Pattern/content system only |
| Bright gradient developer promo pattern | User-provided free-for.dev reel/reference screenshot | High-saturation gradient visual language for social ads, launch videos, and friendly premium landing sections | `approved_reference` | Pattern only; do not copy branding |
| Clone Wars | `github.com/GorvGoyl/Clone-Wars` | UI/product pattern reference only | `do_not_integrate_directly` | Reference only |
| Stripe-style UI patterns | Stripe public site/docs inspiration | Pricing, docs, trust hierarchy, checkout clarity | `approved_reference` | Pattern only |
| Spotify-style dashboard patterns | Spotify public UI inspiration | Dark dashboard, cards, media-library feel | `approved_reference` | Pattern only |
| GOV.UK-style service pages | GOV.UK public service design inspiration | Plain-language flows, accessibility, trust | `approved_reference` | Pattern only |
| Figma/Framer style workflow | Design/prototyping reference | Component discipline, motion language | `approved_reference` | Pattern only |
| macOS/Windows-style OS navigation | Public OS UX reference | System-level navigation and control panels | `approved_reference` | Pattern only |

## Media/catalog and content references

| Project | Source | SONARA fit | Status | Integration placement |
|---|---|---|---|---|
| iptv-org/iptv | `github.com/iptv-org/iptv` | Media directory/data organization reference | `review_required` | Do not bundle streams; legal/compliance review required |
| beets | `github.com/beetbox/beets` | Music metadata/library management reference | `approved_reference` | Worker/reference candidate |

## AI/world/model repositories

| Project | Source | SONARA fit | Status | Integration placement |
|---|---|---|---|---|
| NVIDIA Cosmos | `github.com/NVIDIA/cosmos` | Video/world model research candidate for future Creator Studio visual tools | `review_required` | Research/GPU worker only |

## Free Launch Stack product pattern

SONARA should include a customer-facing Free Launch Stack concept inspired by the free-tier directory pattern:

- free hosting and deployment options
- free database and storage options
- free email/contact tools
- free analytics and monitoring options
- free design and media tools
- free code repository and CI/CD options
- free AI/API tool options
- free security and compliance checklists
- free business operations templates

This should become a guided resource page for low-budget founders, creators, and small operators. It must recommend tools as patterns and workflows, not silently affiliate-link or overpromise functionality. Every recommendation should show what is free, what has limits, what becomes paid, and what SONARA can automate.

## Integration architecture

External technologies must flow through this architecture:

1. Registry entry exists.
2. Admin readiness can show status.
3. License/security review completed.
4. Environment variables added only in Vercel/Rancher/worker secrets, never client code.
5. Worker or adapter created.
6. Job writes to Supabase.
7. Human review queue handles risky outputs.
8. Audit events are written.
9. Feature flag controls availability.
10. Rollback path exists.

## Recommended first integration order

Do not integrate everything at once. That is not ambition; that is a distributed systems tantrum.

1. Fix public redesign class names so tests pass without banned placeholder words.
2. Complete the hard homepage interface DOM patch.
3. Verify asset cache-busting loads the new visual system.
4. CrewAI Admin Launch Readiness Crew.
5. Storage bucket readiness visualizer.
6. Stripe webhook proof visualizer.
7. Resend sender/domain visualizer.
8. Free Launch Stack guided resource page.
9. Creator Studio audio-job queue.
10. Claude Video style reel/hook analyzer proof of concept.
11. Nemotron ASR transcription worker proof of concept.
12. Demucs/librosa audio analysis worker proof of concept.
13. MotionBricks-style 3D/motion research demo.
14. OpenCut/OBS workflow documentation for Creator Studio.
15. Business Builder ERP prompt packs and inventory/vendor/recipe assistants.
16. Growth Studio campaign/lead follow-up assistant.

## Security rules

- No external repo gets service-role keys.
- No external worker gets unscoped customer data.
- No agent gets arbitrary shell access from user input.
- No tool can charge money or send messages without human approval.
- No copyrighted or licensed assets are copied from third parties.
- No clone repository UI is copied directly into SONARA.
- No public IPTV/media stream is bundled without legal review.
- No repo is customer-facing until it passes tests, audit logging, and admin visibility.

## Launch relationship

These repositories expand SONARA after the launch foundation. They do not replace the launch gates.

Current launch gates remain:

- premium UI tests passing
- owner/staff/customer permission enforcement
- real CRUD APIs per active module
- Stripe live webhook verification
- Resend verified sender
- Supabase Storage buckets and policies
- Realtime access rules
- admin control-plane expansion
- customer signup/login/dashboard path

## Final rule

SONARA can learn from many repositories. SONARA should not become a landfill of other people's code.

Everything added must serve the product, be licensed, be secure, be auditable, and produce tangible customer value.
