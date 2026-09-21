# GitHub Radar Product Integration Map

Generated from `data/open-source-tools.ts` by `scripts/generate-product-integration-map.mjs`. Do not edit by hand -- the release runs it with `--check` and fails if this file and the register disagree.

269 reviewed repositories. A repository appears under every product it was assessed for, so the totals below add to more than 269.

`Read only` and `Research only` mean the patterns are studied and no code is taken. `Adapt after review` means code may be adapted into SONARA's own implementation once someone has looked at it. `Blocked` and `Licence unresolved` mean neither, and the register says why for each one.

## Business Builder

Create, launch, run and manage a business.

60 repositories.

| Repository | Licence | How far it may go | What it contributes |
| --- | --- | --- | --- |
| [@vanillaes/csv](https://github.com/vanillaes/csv) | MIT | Read only | cross-check lib/sonara-tabular-import.cjs against an independent RFC 4180 implementation, rather than adopting anything |
| [ads-proposals](https://github.com/AmanLegendDev/ads-proposals) | No licence file. Default copyright applies, which means all righ | Blocked | none permitted until a licence exists |
| [Agentic AI Starters](https://github.com/cporter202/agentic-ai-starters) | MIT | Read only | design reference when shaping a new agent; there is no code here to depend on |
| [Awesome LLM Apps](https://github.com/Shubhamsaboo/awesome-llm-apps) | Apache-2.0 | Adapt after review | agent and retrieval application structure |
| [AWS Generative AI Use Cases](https://github.com/aws-samples/generative-ai-use-cases) | MIT-0 | Adapt after review | business use-case framing for generative features |
| [BoxyHQ SaaS Starter Kit](https://github.com/boxyhq/saas-starter-kit) | Apache-2.0 | Adapt after review | team invitation and role modelling |
| [Business Machine Learning (firmai)](https://github.com/firmai/business-machine-learning) | AGPL-3.0 | Read only | which business questions are answerable from operational data |
| [Cal (calcom/cal.diy, formerly cal.com)](https://github.com/calcom/cal.diy) | MIT at the repository root, from GitHub's detected licence field | Licence unresolved | reference for availability rules, timezone handling, booking types and reschedule/cancel flows |
| [Carbon (open ERP, MES and QMS for manufacturing)](https://github.com/crbnos/carbon) | Not classifiable by GitHub. Detected licence on 18 August 2026 i | Licence unresolved | reference for how work orders, routings, quality records and configure-to-order pricing hang together on this product's own stack |
| [Chatwoot customer support reference](https://github.com/chatwoot/chatwoot) | MIT; content outside enterprise/ is MIT Expat, while enterprise/ | Read only | support inbox patterns |
| [Cloudflare OS](https://github.com/cloudflare/cloudflare-os) | Apache-2.0 | Adapt after review | capability gating for agent actions |
| [Crawl4AI](https://github.com/unclecode/crawl4ai) | Apache-2.0. The README asks for badge attribution, which is a re | adapter_built | Research Lab source collection |
| [CrewAI](https://github.com/crewAIInc/crewAI) | MIT | Adapt after review | future read-only launch readiness |
| [ERPNext](https://github.com/frappe/erpnext) | GPL-3.0 | Research only | study accounting, inventory, CRM, manufacturing and service workflow domain models |
| [erxes](https://github.com/erxes/erxes) | AGPL-3.0 | Read only | module boundaries across marketing, sales, support and operations |
| [Excalidraw](https://github.com/excalidraw/excalidraw) | MIT, from GitHub's detected licence field on 18 August 2026 (lic | Adapt after review | a drawing and diagram canvas a creator could sketch in, and a business could lay out a floor plan or seating chart in |
| [Flint](https://github.com/chintanpatel24/flint) | MIT | Read only | Business Memory and local knowledge-graph UX research |
| [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template) | MIT | Read only | compare password recovery and JWT session handling against SONARA's |
| [Hi.Events (event management and ticket selling)](https://github.com/HiEventsDev/Hi.Events) | Not classifiable by GitHub. Detected licence on 18 August 2026 i | Licence unresolved | reference for how ticket types, capacity, check-in and door management fit together for a business running an event |
| [HyperFormula](https://github.com/handsontable/hyperformula) | GPL-3.0, or a paid proprietary licence from the vendor. The only | Read only | dependency-graph recalculation |
| [Implem.Pleasanter](https://github.com/Implem/Implem.Pleasanter) | AGPL-3.0 | Read only | user-defined tables and forms |
| [Langflow](https://github.com/langflow-ai/langflow) | MIT | adapter_built | visual flow prototyping |
| [LightRAG](https://github.com/HKUDS/LightRAG) | MIT | Read only | how a document set becomes searchable without a vector database |
| [LiveKit Agents](https://github.com/livekit/agents) | Apache-2.0, read from the GitHub API's detected license.spdx_id  | Research only | realtime voice and video AI agents over WebRTC |
| [LocalSend local file-sharing reference](https://github.com/localsend/localsend) | Review repository license before any implementation. | Read only | secure local transfer inspiration |
| [Lunar (headless e-commerce for Laravel)](https://github.com/lunarphp/lunar) | MIT, from GitHub's detected licence field on 18 August 2026 (lic | Read only | reference for the parts of selling this product has no model for: variants, price tiers, carts, tax rules, shipping and discounts |
| [Medusa](https://github.com/medusajs/medusa) | MIT core; enterprise materials require separate commercial terms | Research only | study modular commerce primitives, carts, orders, promotions and inventory APIs |
| [Miro AI / agent resources](https://miro.com/) | Terms and API permissions require review. | Read only | collaboration pattern review |
| [n8n](https://github.com/n8n-io/n8n) | Sustainable Use License v1.0 -- source-available, NOT an open-so | Licence unresolved | approved automation inventory |
| [n8n Self-hosted AI Starter Kit](https://github.com/n8n-io/self-hosted-ai-starter-kit) | Apache-2.0 for the starter kit itself; the n8n runtime it provis | Read only | how a local model, vector store and workflow runner are wired together |
| [NocoDB](https://github.com/nocodb/nocodb) | Sustainable Use License 1.0 on current master/develop; source-av | Licence unresolved | study spreadsheet-like database UX, APIs and collaborative data views |
| [NVlabs Eagle / Embodied](https://github.com/NVlabs/EAGLE) | Apache-2.0 for the code; the model weights are under the NVIDIA  | Research only | long-context media research |
| [Odoo Community](https://github.com/odoo/odoo) | LGPL-3.0; Odoo Community 19.0 root LICENSE, with bundled compone | Research only | study modular business application boundaries, workflow composition and administration UX |
| [Ollama](https://github.com/ollama/ollama) | MIT; model licenses are reviewed separately. | adapter_built | local inference |
| [Open SaaS (wasp-lang)](https://github.com/wasp-lang/open-saas) | MIT, read from the GitHub API's detected license.spdx_id on 18 A | Read only | a free full-stack SaaS starter with auth, payments, jobs and an AGENTS.md |
| [Open WebUI](https://github.com/open-webui/open-webui) | Open WebUI License, BSD-3-Clause based with branding conditions. | adapter_built | private model evaluation |
| [OpenClaw](https://github.com/openclaw/openclaw) | MIT | Adapt after review | private operator gateway |
| [OpenToonz](https://github.com/opentoonz/opentoonz) | BSD-style project license must be verified before recommendation | Read only | external animation workflow reference |
| [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) | GPL-3.0 | Read only | Business Builder document-lifecycle and inbox workflow reference |
| [Plane](https://github.com/makeplane/plane) | AGPL-3.0 | Read only | Business Builder work-item and launch-checklist workflow research |
| [prompts.chat](https://github.com/f/prompts.chat) | MIT for source code and site-authored content; CC0-1.0 for promp | Adapt after review | prompt catalog architecture |
| [QloApps](https://github.com/Qloapps/QloApps) | OSL-3.0 | Read only | room inventory and rate plans |
| [QR Code generator (Project Nayuki)](https://github.com/nayuki/QR-Code-generator) | MIT | Adapt after review | put /book/:slug on a poster, a van or a receipt so somebody can book without typing an address |
| [RAGFlow](https://github.com/infiniflow/ragflow) | Apache-2.0 noted upstream; bundled service and dependency licens | adapter_built | dataset inventory |
| [Resend Node SDK](https://github.com/resend/resend-node) | MIT | Adapt after review | typed server-side transactional email delivery |
| [RestaurantProject (BryanTheLai)](https://github.com/BryanTheLai/RestaurantProject) | Apache-2.0 | Read only | a smaller second reading of restaurant ordering flow |
| [Roboflow / object detection references](https://github.com/roboflow) | External provider terms and model licenses require review. | Research only | media tagging research |
| [Rust programming references](https://github.com/rust-lang/rust) | Reference material licenses vary and require source-level review | Read only | language/tooling fit research |
| [Saleor](https://github.com/saleor/saleor) | BSD-3-Clause | Research only | study headless commerce APIs, checkout, channels, promotions and extensibility |
| [Stripe Node SDK](https://github.com/stripe/stripe-node) | MIT | Adapt after review | typed server-side Stripe API calls and webhook helpers |
| [TastyIgniter](https://github.com/tastyigniter/TastyIgniter) | MIT | Adapt after review | menu and modifier modelling |
| [The Algorithms repositories](https://github.com/TheAlgorithms) | Repository licenses require review before copying examples. | Read only | Developer Formula Studio docs |
| [ToolJet](https://github.com/ToolJet/ToolJet) | AGPL-3.0, read from the GitHub API's detected license.spdx_id on | Blocked | building an application without writing it |
| [Transformers.js](https://github.com/huggingface/transformers.js) | Apache-2.0, from GitHub's detected licence field on 18 August 20 | Adapt after review | small task models running in the customer's own browser: summarising a note they wrote, classifying an enquiry, embedding a record for search |
| [UI/UX Pro Max Skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT | Read only | compare SONARA's palette and type choices against a catalogued set |
| [ury (ERPNext restaurant management)](https://github.com/ury-erp/ury) | AGPL-3.0. Read on 18 August 2026 from GitHub's own detected lice | Research only | none approved for incorporation; possible owner-operated deployment |
| [Vibe Coding with Base44](https://github.com/cporter202/vibe-coding-with-base44) | MIT | Read only | reading only, and mainly as a worked example of how a vendor guide should disclose its own incentive |
| [Vosk](https://github.com/alphacep/vosk-api) | Apache-2.0, from GitHub's detected licence field on 18 August 20 | Adapt after review | small-footprint transcription where the audio must not leave the machine, including on modest hardware |
| [wacrm (self-hostable WhatsApp CRM template)](https://github.com/ArnasDon/wacrm) | MIT. Read on 18 August 2026 from GitHub's own detected licence f | Adapt after review | reference for shared inbox, pipeline and broadcast structure on the stack this product already runs |
| [X/Twitter Recommendation Algorithm](https://github.com/twitter/the-algorithm) | Public repository license requires review before production use. | Read only | learn ranking architecture patterns |

## Creator Studio

Organize, protect, publish, monetize and grow creative work.

60 repositories.

| Repository | Licence | How far it may go | What it contributes |
| --- | --- | --- | --- |
| [Agentic AI Starters](https://github.com/cporter202/agentic-ai-starters) | MIT | Read only | design reference when shaping a new agent; there is no code here to depend on |
| [AI Content Studio (naqashafzal)](https://github.com/naqashafzal/AI-Content-Studio) | MIT | Adapt after review | content drafting and revision flow |
| [AnyCreature](https://github.com/ariescar/anycreature) | MIT | Read only | Creator Studio 3D asset workflow and quality-review research |
| [Awesome LLM Apps](https://github.com/Shubhamsaboo/awesome-llm-apps) | Apache-2.0 | Adapt after review | agent and retrieval application structure |
| [AWS Generative AI Use Cases](https://github.com/aws-samples/generative-ai-use-cases) | MIT-0 | Adapt after review | business use-case framing for generative features |
| [Bolt Slides](https://github.com/stackblitz/bolt-slides) | MIT | Read only | Creator Studio interactive-deck and presentation workflow research |
| [brightbean-studio (self-hosted social scheduling)](https://github.com/brightbeanxyz/brightbean-studio) | AGPL-3.0. Read on 18 August 2026 from GitHub's own detected lice | Research only | none approved for incorporation; possible owner-operated deployment |
| [BYOC (Bring Your Own Cloud)](https://github.com/Ajayvarmaramineni/byoc) | Apache-2.0 | Read only | reference for the R2 adapter this repository already has, and a named option if customer-owned storage is ever wanted |
| [CrewAI](https://github.com/crewAIInc/crewAI) | MIT | Adapt after review | future read-only launch readiness |
| [Diffusion Studio Editor](https://github.com/diffusionstudio/editor) | MPL-2.0 | Licence unresolved | not adopted -- a possible reference for how an agent-driven video editor is structured |
| [Dify](https://github.com/langgenius/dify) | Dify Open Source License, Apache-2.0 based with additional condi | adapter_built | application metadata |
| [Donkey Cut](https://github.com/DonkeyCut/Donkey) | Apache-2.0 | Read only | Creator Studio timeline, local-processing, and render-worker architecture research |
| [Doop](https://github.com/kgoedecke/doop) | AGPL-3.0 | Read only | Creator Studio collaborative-canvas and visible-agent-state research |
| [DSPy](https://github.com/stanfordnlp/dspy) | MIT | Read only | declaring what a model task should produce instead of hand-writing a prompt |
| [DwarfStar (ds4-metal)](https://github.com/ivanfioravanti/ds4-metal) | MIT. LICENSE read 11 September 2026: 'MIT License, Copyright (c) | Read only | nothing shipped -- a serverless function has no GPU, so this could only ever be a service the owner runs and the application calls |
| [Excalidraw](https://github.com/excalidraw/excalidraw) | MIT, from GitHub's detected licence field on 18 August 2026 (lic | Adapt after review | a drawing and diagram canvas a creator could sketch in, and a business could lay out a floor plan or seating chart in |
| [fal-3d-anything](https://github.com/blendi-remade/fal-3d-anything) | None declared; the README says MIT but the repository has no lic | Blocked | Creator Studio image-to-3D workflow research only |
| [Fenix AI Studio](https://github.com/FenixStudioAU/FenixAIStudio) | AGPL-3.0, read from the repository sidebar and restated in its R | Read only | what a local-first creative workstation puts on one screen |
| [FreeCut (browser video editor)](https://github.com/walterlow/freecut) | MIT, from GitHub's detected licence field on 18 August 2026 (lic | Adapt after review | reference for what a multi-track timeline, keyframes and export look like when the whole editor runs client-side |
| [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template) | MIT | Read only | compare password recovery and JWT session handling against SONARA's |
| [Ghost](https://github.com/TryGhost/Ghost) | MIT, from GitHub's detected licence field on 18 August 2026 (lic | Adapt after review | the reference for how paid memberships, tiers, gated posts and newsletters fit together for somebody selling their own writing |
| [Godot Engine](https://github.com/godotengine/godot) | MIT | Read only | scene graph and transform maths |
| [Image Pipes (mrajaeim)](https://github.com/mrajaeim/image-pipes) | MIT | Read only | nothing shipped -- a self-hosted desktop tool with no surface in this product that needs it |
| [LiveKit Agents](https://github.com/livekit/agents) | Apache-2.0, read from the GitHub API's detected license.spdx_id  | Research only | realtime voice and video AI agents over WebRTC |
| [LocalSend local file-sharing reference](https://github.com/localsend/localsend) | Review repository license before any implementation. | Read only | secure local transfer inspiration |
| [Marketing Skills (Corey Haines)](https://github.com/coreyhaines31/marketingskills) | MIT | adapter_built | marketing frameworks an agent follows when working on SONARA copy and competitor comparisons |
| [Miro AI / agent resources](https://miro.com/) | Terms and API permissions require review. | Read only | collaboration pattern review |
| [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | MIT, read from the GitHub API's detected license.spdx_id on 19 A | Research only | one-click short video from a topic or keyword: script, narration, footage, subtitles, render |
| [NodeGraphQt](https://github.com/jchanvfx/NodeGraphQt) | MIT | Read only | node-graph interaction research for creator and internal workflow tools |
| [NVlabs Eagle / Embodied](https://github.com/NVlabs/EAGLE) | Apache-2.0 for the code; the model weights are under the NVIDIA  | Research only | long-context media research |
| [NVlabs LongLive / LongLive 2.0](https://github.com/NVlabs/LongLive) | Apache-2.0 (repository); one vendored subdirectory is MIT | Research only | understand long-video workflows |
| [Ollama](https://github.com/ollama/ollama) | MIT; model licenses are reviewed separately. | adapter_built | local inference |
| [OmniRoute](https://github.com/diegosouzapw/OmniRoute) | MIT | Read only | a named option for the Provider Gateway AGENTS.md already requires, if one is ever hosted rather than written |
| [OpenCut](https://github.com/OpenCut-app/OpenCut) | MIT, read from the GitHub API's detected license.spdx_id on 19 A | Research only | trimming and assembling video |
| [OpenMontage](https://github.com/calesthio/OpenMontage) | AGPL-3.0 | Read only | how a montage is assembled from clips and timing |
| [OpenToonz](https://github.com/opentoonz/opentoonz) | BSD-style project license must be verified before recommendation | Read only | external animation workflow reference |
| [OpenVid](https://github.com/cristianolivera1/openvid) | PolyForm Noncommercial 1.0.0 | Blocked | Creator Studio workflow research for product-demo framing and motion |
| [OpenVoice](https://github.com/myshell-ai/OpenVoice) | MIT | Adapt after review | tools/voice-clone/ -- a tool the owner runs on their own machine, behind a consent gate |
| [pgvector-node](https://github.com/pgvector/pgvector-node) | MIT | Adapt after review | Node vector bindings while PostgreSQL remains canonical |
| [prompts.chat](https://github.com/f/prompts.chat) | MIT for source code and site-authored content; CC0-1.0 for promp | Adapt after review | prompt catalog architecture |
| [Qdrant JavaScript SDK](https://github.com/qdrant/qdrant-js) | Apache-2.0 | Adapt after review | isolated vector projection adapters with tenant filters and provenance |
| [Remotion / MapLibre-style video and map animation references](https://github.com/remotion-dev/remotion) | Remotion: source-available under the Remotion License — free for | Read only | map animation drafts |
| [Roboflow / object detection references](https://github.com/roboflow) | External provider terms and model licenses require review. | Research only | media tagging research |
| [seek-tune (Shazam-style audio fingerprinting)](https://github.com/cgzirim/seek-tune) | MIT, from GitHub's detected licence field on 18 August 2026 (lic | Adapt after review | recognising that two recordings are the same recording, which is the matching half of the anti-clone rule AGENTS.md states |
| [sherpa-onnx (k2-fsa)](https://github.com/k2-fsa/sherpa-onnx) | Apache-2.0, read from the GitHub API licence field on 18 August  | Adapt after review | transcription, synthesis and speaker separation with no network call |
| [Social Media Skills (Charlie Hills)](https://github.com/charlie947/social-media-skills) | MIT | adapter_built | social content frameworks for Growth Studio and Creator Studio |
| [Sonora (nolight132)](https://github.com/nolight132/sonora) | GPL-3.0-or-later | Read only | none -- and the reason to keep the record is the name rather than the code |
| [Spleeter](https://github.com/deezer/spleeter) | MIT, from GitHub's detected licence field on 18 August 2026 (lic | Adapt after review | splitting a recording into vocals, drums, bass and other, so a creator can reuse or remix their own material |
| [Transformers.js](https://github.com/huggingface/transformers.js) | Apache-2.0, from GitHub's detected licence field on 18 August 20 | Adapt after review | small task models running in the customer's own browser: summarising a note they wrote, classifying an enquiry, embedding a record for search |
| [UI/UX Pro Max Skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT | Read only | compare SONARA's palette and type choices against a catalogued set |
| [Voice cloning cluster: GPT-SoVITS, VoxCPM, CosyVoice, dia](https://github.com/RVC-Boss/GPT-SoVITS) | MIT on the repository code. Read on 18 August 2026 from GitHub's | Security review first | none approved as a general feature |
| [Voicebox](https://github.com/jamiepine/voicebox) | MIT | Licence unresolved | reference for local voice generation -- not adopted, and the models it runs are the reason |
| [VoiceStudio](https://github.com/debpalash/voicestudio) | AGPL-3.0 | Blocked | voice-consent and local-processing policy research only |
| [Vosk](https://github.com/alphacep/vosk-api) | Apache-2.0, from GitHub's detected licence field on 18 August 20 | Adapt after review | small-footprint transcription where the audio must not leave the machine, including on modest hardware |
| [WebAV (browser video editing SDK on WebCodecs)](https://github.com/WebAV-Tech/WebAV) | MIT, from GitHub's detected licence field on 18 August 2026 (lic | Adapt after review | trimming, compositing and exporting video in the customer's own browser, with no server touching the file |
| [WebLLM](https://github.com/mlc-ai/web-llm) | Apache-2.0, from GitHub's detected licence field on 18 August 20 | Security review first | a full language model running on the customer's own GPU, for drafting and rewriting text they already own |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | MIT, from GitHub's detected licence field on 18 August 2026 (lic | adapter_built | captions and transcripts for Creator Studio uploads, produced on hardware the owner runs rather than a metered API |
| [WhisperX](https://github.com/m-bain/whisperX) | BSD-2-Clause, from GitHub's detected licence field on 18 August  | Adapt after review | word-level timestamps for caption files, and speaker separation for interviews and podcasts |
| [X/Twitter Recommendation Algorithm](https://github.com/twitter/the-algorithm) | Public repository license requires review before production use. | Read only | learn ranking architecture patterns |
| [YT Short Clipper](https://github.com/jipraks/yt-short-clipper) | MIT | Read only | Creator Studio short-form video workflow research |

## Growth Studio

Attract customers, leads, fans, referrals, reviews and revenue.

43 repositories.

| Repository | Licence | How far it may go | What it contributes |
| --- | --- | --- | --- |
| [Activepieces](https://github.com/activepieces/activepieces) | MIT core with separately licensed enterprise directories | Research only | study connector catalogs, visual workflow construction and agent/MCP packaging |
| [Agentic AI Starters](https://github.com/cporter202/agentic-ai-starters) | MIT | Read only | design reference when shaping a new agent; there is no code here to depend on |
| [AI Content Studio (naqashafzal)](https://github.com/naqashafzal/AI-Content-Studio) | MIT | Adapt after review | content drafting and revision flow |
| [Awesome LLM Apps](https://github.com/Shubhamsaboo/awesome-llm-apps) | Apache-2.0 | Adapt after review | agent and retrieval application structure |
| [AWS Generative AI Use Cases](https://github.com/aws-samples/generative-ai-use-cases) | MIT-0 | Adapt after review | business use-case framing for generative features |
| [Best APIs for Lead Gen (cporter202)](https://github.com/cporter202/best-apis-for-lead-gen) | None declared (all rights reserved) | Blocked | none -- there is no grant to use it, and most of what it lists is blocked on consent grounds anyway |
| [brightbean-studio (self-hosted social scheduling)](https://github.com/brightbeanxyz/brightbean-studio) | AGPL-3.0. Read on 18 August 2026 from GitHub's own detected lice | Research only | none approved for incorporation; possible owner-operated deployment |
| [Business Machine Learning (firmai)](https://github.com/firmai/business-machine-learning) | AGPL-3.0 | Read only | which business questions are answerable from operational data |
| [Crawl4AI](https://github.com/unclecode/crawl4ai) | Apache-2.0. The README asks for badge attribution, which is a re | adapter_built | Research Lab source collection |
| [CrewAI](https://github.com/crewAIInc/crewAI) | MIT | Adapt after review | future read-only launch readiness |
| [Dify](https://github.com/langgenius/dify) | Dify Open Source License, Apache-2.0 based with additional condi | adapter_built | application metadata |
| [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) | CC0-1.0 (CC0 1.0 Universal public domain dedication) | Adapt after review | raise a risk flag on a captured lead whose email is a throwaway address, using the riskFlags mechanism lib/sonara-lead-scoring.cjs already has |
| [DSPy](https://github.com/stanfordnlp/dspy) | MIT | Read only | declaring what a model task should produce instead of hand-writing a prompt |
| [erxes](https://github.com/erxes/erxes) | AGPL-3.0 | Read only | module boundaries across marketing, sales, support and operations |
| [Figranium](https://github.com/figranium/figranium) | GPL-3.0, read from the GitHub API's detected license.spdx_id on  | Read only | visual block-based browser workflows executed through an API |
| [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template) | MIT | Read only | compare password recovery and JWT session handling against SONARA's |
| [GEO SEO Claude](https://github.com/zubair-trabzada/geo-seo-claude) | MIT | Read only | Growth Studio audit-checklist and structured-data research |
| [Ghost](https://github.com/TryGhost/Ghost) | MIT, from GitHub's detected licence field on 18 August 2026 (lic | Adapt after review | the reference for how paid memberships, tiers, gated posts and newsletters fit together for somebody selling their own writing |
| [Hi.Events (event management and ticket selling)](https://github.com/HiEventsDev/Hi.Events) | Not classifiable by GitHub. Detected licence on 18 August 2026 i | Licence unresolved | reference for how ticket types, capacity, check-in and door management fit together for a business running an event |
| [Marketing Skills (Corey Haines)](https://github.com/coreyhaines31/marketingskills) | MIT | adapter_built | marketing frameworks an agent follows when working on SONARA copy and competitor comparisons |
| [Mautic](https://github.com/mautic/mautic) | GPL-3.0-or-later | Research only | study campaign segmentation, journeys, scoring and email orchestration |
| [Miro AI / agent resources](https://miro.com/) | Terms and API permissions require review. | Read only | collaboration pattern review |
| [n8n](https://github.com/n8n-io/n8n) | Sustainable Use License v1.0 -- source-available, NOT an open-so | Licence unresolved | approved automation inventory |
| [n8n Self-hosted AI Starter Kit](https://github.com/n8n-io/self-hosted-ai-starter-kit) | Apache-2.0 for the starter kit itself; the n8n runtime it provis | Read only | how a local model, vector store and workflow runner are wired together |
| [NotFair](https://github.com/nowork-studio/NotFair) | MIT | Read only | the measurement idea, adapted -- not the autonomy, and not the code |
| [NVlabs Eagle / Embodied](https://github.com/NVlabs/EAGLE) | Apache-2.0 for the code; the model weights are under the NVIDIA  | Research only | long-context media research |
| [OpenNews MCP](https://github.com/6551Team/opennews-mcp) | MIT | Read only | how an MCP server exposes a read-only external feed |
| [pgvector-node](https://github.com/pgvector/pgvector-node) | MIT | Adapt after review | Node vector bindings while PostgreSQL remains canonical |
| [PostHog](https://github.com/PostHog/posthog) | NOASSERTION: GitHub cannot classify it because the repository ca | Licence unresolved | product analytics, experiments, error tracking, surveys |
| [prompts.chat](https://github.com/f/prompts.chat) | MIT for source code and site-authored content; CC0-1.0 for promp | Adapt after review | prompt catalog architecture |
| [Qdrant JavaScript SDK](https://github.com/qdrant/qdrant-js) | Apache-2.0 | Adapt after review | isolated vector projection adapters with tenant filters and provenance |
| [QR Code generator (Project Nayuki)](https://github.com/nayuki/QR-Code-generator) | MIT | Adapt after review | put /book/:slug on a poster, a van or a receipt so somebody can book without typing an address |
| [Remotion / MapLibre-style video and map animation references](https://github.com/remotion-dev/remotion) | Remotion: source-available under the Remotion License — free for | Read only | map animation drafts |
| [Resend Node SDK](https://github.com/resend/resend-node) | MIT | Adapt after review | typed server-side transactional email delivery |
| [Scrapling](https://github.com/D4Vinci/Scrapling) | BSD-3-Clause, read from the GitHub API's detected license.spdx_i | Research only | fetching and parsing pages |
| [Social Media Skills (Charlie Hills)](https://github.com/charlie947/social-media-skills) | MIT | adapter_built | social content frameworks for Growth Studio and Creator Studio |
| [SocialMedia-App (CharlyKeleb)](https://github.com/CharlyKeleb/SocialMedia-App) | MIT | Read only | feed, follow and reaction modelling |
| [Transformers.js](https://github.com/huggingface/transformers.js) | Apache-2.0, from GitHub's detected licence field on 18 August 20 | Adapt after review | small task models running in the customer's own browser: summarising a note they wrote, classifying an enquiry, embedding a record for search |
| [twenty (open Salesforce alternative)](https://github.com/twentyhq/twenty) | AGPL-3.0; most of the repository is AGPLv3, Enterprise-marked fi | Licence unresolved | none approved; licence unknown |
| [UI/UX Pro Max Skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT | Read only | compare SONARA's palette and type choices against a catalogued set |
| [wacrm (self-hostable WhatsApp CRM template)](https://github.com/ArnasDon/wacrm) | MIT. Read on 18 August 2026 from GitHub's own detected licence f | Adapt after review | reference for shared inbox, pipeline and broadcast structure on the stack this product already runs |
| [WebLLM](https://github.com/mlc-ai/web-llm) | Apache-2.0, from GitHub's detected licence field on 18 August 20 | Security review first | a full language model running on the customer's own GPU, for drafting and rewriting text they already own |
| [X/Twitter Recommendation Algorithm](https://github.com/twitter/the-algorithm) | Public repository license requires review before production use. | Read only | learn ranking architecture patterns |

## Shared Platform

SONARA One, the Admin Command Center, and the Research Lab behind all three.

173 repositories.

| Repository | Licence | How far it may go | What it contributes |
| --- | --- | --- | --- |
| [500 AI Agents Projects (ashishpatel26)](https://github.com/ashishpatel26/500-ai-agents-projects) | MIT | Read only | survey of agent use cases by industry when deciding what to build next |
| [Academic Research Skills](https://github.com/Imbad0202/academic-research-skills) | Creative Commons Attribution-NonCommercial 4.0 International (CC | Blocked | nothing shipped -- the licence forbids the only use this product would have for it |
| [Activepieces](https://github.com/activepieces/activepieces) | MIT core with separately licensed enterprise directories | Research only | study connector catalogs, visual workflow construction and agent/MCP packaging |
| [Agency Agents / The Agency (msitarzewski)](https://github.com/msitarzewski/agency-agents) | MIT | Read only | reference for how role-specialised agent definitions are written |
| [Agent Room](https://github.com/steviebuilds/agent-room) | MIT | Read only | internal Codex and Claude coordination |
| [Agentic AI Starters](https://github.com/cporter202/agentic-ai-starters) | MIT | Read only | design reference when shaping a new agent; there is no code here to depend on |
| [AI Agents for Beginners (Microsoft)](https://github.com/microsoft/ai-agents-for-beginners) | MIT | Read only | training material for agent patterns -- RAG, planning, tool use, memory |
| [AI-SDLC Framework](https://github.com/ai-sdlc-framework/ai-sdlc) | Apache License 2.0 for the code in the repository; the enterpris | Read only | read its JSON Schema resources as a design reference for SONARA's own agent authority model -- nothing shipped, nothing installed |
| [Ajv](https://github.com/ajv-validator/ajv) | MIT | Adapt after review | JSON Schema validation at API, event and configuration boundaries |
| [Anthropic Agent Skills (anthropics/skills)](https://github.com/anthropics/skills) | None declared (all rights reserved) | Blocked | reading it is all that is available -- there is no grant to copy any of it into what this product ships |
| [Anthropic Cybersecurity Skills (community)](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | Apache-2.0 | Research only | reference when shaping a security review checklist; nothing executable adopted |
| [AnyCreature](https://github.com/ariescar/anycreature) | MIT | Read only | Creator Studio 3D asset workflow and quality-review research |
| [Appsmith](https://github.com/appsmithorg/appsmith) | Apache-2.0 | Research only | study low-code admin surfaces, connectors and internal-tool UX |
| [Archify](https://github.com/tt-a1i/archify) | MIT | Read only | architecture-diagram workflow research |
| [Archon](https://github.com/coleam00/Archon) | MIT, read from the GitHub API's detected license.spdx_id on 18 A | Read only | making AI coding deterministic and repeatable |
| [Artifact Server (Plannotator)](https://github.com/plannotator/artifact-server) | AGPL-3.0 | Blocked | none -- AGPL-3.0, and this is a hosted product |
| [authentik](https://github.com/goauthentik/authentik) | MIT core, with CC BY-SA 4.0 docs and a separate enterprise licen | Research only | identity research, with the licence split understood before any use |
| [Automate for Growth (cporter202)](https://github.com/cporter202/automate-for-growth) | No licence declared (all rights reserved) | Blocked | none -- unlicensed, so there is nothing anybody here can grant |
| [Awesome (sindresorhus)](https://github.com/sindresorhus/awesome) | CC0-1.0 | Read only | finding further open-source candidates by domain |
| [Awesome AI Tools (cporter202)](https://github.com/cporter202/awesome-ai-tools) | None declared (all rights reserved) | Blocked | none -- there is no grant to use it, and the content is partly monetised |
| [Awesome DeepSeek Agent](https://github.com/deepseek-ai/awesome-deepseek-agent) | None declared. Checked three ways on 17 August 2026 rather than  | Blocked | reading how third-party tools are pointed at a DeepSeek endpoint |
| [Awesome Free LLM APIs (mnfst)](https://github.com/mnfst/awesome-free-llm-apis) | CC0-1.0 | Read only | knowing which model providers exist and what their free tiers actually allow |
| [Awesome LLM Apps](https://github.com/Shubhamsaboo/awesome-llm-apps) | Apache-2.0 | Adapt after review | agent and retrieval application structure |
| [Awesome SOC (cyb3rxp)](https://github.com/cyb3rxp/awesome-soc) | CC0-1.0 | Read only | reference when writing SONARA's own detection and incident-response practice -- not a dependency |
| [awesome-freellm-apis (open-free-llm-api)](https://github.com/open-free-llm-api/awesome-freellm-apis) | MIT | Read only | a second, independently maintained reading of which free tiers exist and what they allow |
| [Ballast](https://github.com/tight-line/ballast) | MIT. LICENSE read 11 September 2026: 'MIT License, Copyright (c) | Read only | nothing -- recorded because it was submitted, and because this project runs no Kubernetes at all |
| [Best APIs for Lead Gen (cporter202)](https://github.com/cporter202/best-apis-for-lead-gen) | None declared (all rights reserved) | Blocked | none -- there is no grant to use it, and most of what it lists is blocked on consent grounds anyway |
| [Better Auth](https://github.com/better-auth/better-auth) | MIT | Research only | none here -- recorded so the reason is written down rather than rediscovered |
| [Bolt Slides](https://github.com/stackblitz/bolt-slides) | MIT | Read only | Creator Studio interactive-deck and presentation workflow research |
| [book-to-skill](https://github.com/virgiliojr94/book-to-skill) | MIT | Adapt after review | a developer-side tool for turning our own documentation into an agent skill |
| [BoxyHQ SaaS Starter Kit](https://github.com/boxyhq/saas-starter-kit) | Apache-2.0 | Adapt after review | team invitation and role modelling |
| [BrowserCode (browser-use)](https://github.com/browser-use/browsercode) | MIT (upstream opencode copyright, retained by the fork) | Security review first | a developer-side tool at most, and not before somebody reviews what it is allowed to drive |
| [BullMQ](https://github.com/taskforcesh/bullmq) | MIT | Adapt after review | durable background queue execution when database-backed work queues are insufficient |
| [BYOC (Bring Your Own Cloud)](https://github.com/Ajayvarmaramineni/byoc) | Apache-2.0 | Read only | reference for the R2 adapter this repository already has, and a named option if customer-owned storage is ever wanted |
| [camofox-browser](https://github.com/redf0x1/camofox-browser) | MIT | Blocked | none -- recorded so the refusal is written down rather than re-argued |
| [Casdoor](https://github.com/casdoor/casdoor) | Apache-2.0 | Research only | replacing Supabase Auth with a single binary that includes its own admin UI |
| [Chakra UI](https://github.com/chakra-ui/chakra-ui) | MIT, read from the GitHub API's detected license.spdx_id on 18 A | Read only | accessible React component system |
| [Chatwoot customer support reference](https://github.com/chatwoot/chatwoot) | MIT; content outside enterprise/ is MIT Expat, while enterprise/ | Read only | support inbox patterns |
| [Claude Code](https://github.com/anthropics/claude-code) | Anthropic product terms; not treated as a redistributable open-s | Read only | repository assistance |
| [Claude SEO](https://github.com/AgriciDaniel/claude-seo) | MIT | Adapt after review | auditing SONARA's own marketing pages while building them; nothing shipped to customers |
| [ClawFlows](https://github.com/nikilster/clawflows) | Unclear, and the ambiguity is the finding. The README carries a  | Licence unresolved | nothing shipped -- read as prior art for how agent workflows get described, if at all |
| [Clone Wars](https://github.com/GorvGoyl/Clone-Wars) | CC0-1.0 | Read only | finding open-source implementations of well-known products by category |
| [CloudEvents JavaScript SDK](https://github.com/cloudevents/sdk-javascript) | Apache-2.0 | Adapt after review | standard event envelopes across internal jobs, webhooks and provider adapters |
| [Cloudflare Agents](https://github.com/cloudflare/agents) | MIT, read from the GitHub API's detected license.spdx_id on 18 A | Read only | stateful AI agents on Durable Objects and Workers |
| [Cloudflare OS](https://github.com/cloudflare/cloudflare-os) | Apache-2.0 | Adapt after review | capability gating for agent actions |
| [Codegraff](https://github.com/justrach/codegraff) | Modified AGPL-3.0 with licensor-only reserved commercial and clo | Read only | internal evaluation of agent persistence and validation risks |
| [codex-chatgpt-web](https://github.com/miuuyy/codex-chatgpt-web) | MIT | Blocked | none -- the licence is not what decides this one |
| [Context Mode](https://github.com/mksglu/context-mode) | Elastic License 2.0 (ELv2) | Blocked | nothing shipped -- a developer-side tool at most, and blocked from the product by its licence |
| [Crawl4AI](https://github.com/unclecode/crawl4ai) | Apache-2.0. The README asks for badge attribution, which is a re | adapter_built | Research Lab source collection |
| [CrewAI](https://github.com/crewAIInc/crewAI) | MIT | Adapt after review | future read-only launch readiness |
| [DeepSeek V3](https://github.com/deepseek-ai/DeepSeek-V3) | Repository code is MIT; model weights use the upstream DeepSeek  | Licence unresolved | optional private model serving |
| [developer-roadmap (roadmap.sh)](https://github.com/kamranahmedse/developer-roadmap) | Custom: personal use only, no republication (all other rights re | Blocked | personal reading only -- the licence permits that and forbids essentially everything else |
| [Dify](https://github.com/langgenius/dify) | Dify Open Source License, Apache-2.0 based with additional condi | adapter_built | application metadata |
| [Directus](https://github.com/directus/directus) | MSCL-1.0-GPL (Monospace Sustainable Core License 1.0) | Research only | none -- recorded as a licence correction |
| [Doop](https://github.com/kgoedecke/doop) | AGPL-3.0 | Read only | Creator Studio collaborative-canvas and visible-agent-state research |
| [DSPy](https://github.com/stanfordnlp/dspy) | MIT | Read only | declaring what a model task should produce instead of hand-writing a prompt |
| [DwarfStar (ds4-metal)](https://github.com/ivanfioravanti/ds4-metal) | MIT. LICENSE read 11 September 2026: 'MIT License, Copyright (c) | Read only | nothing shipped -- a serverless function has no GPU, so this could only ever be a service the owner runs and the application calls |
| [Ecommerce Intelligence APIs](https://github.com/cporter202/ecommerce-intelligence-apis) | MIT | Blocked | none -- the catalogue is an affiliate placement, not a provider evaluation |
| [ERPNext](https://github.com/frappe/erpnext) | GPL-3.0 | Research only | study accounting, inventory, CRM, manufacturing and service workflow domain models |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | MIT | Adapt after review | bounded request-rate controls on abuse-prone public endpoints |
| [Face Anything](https://github.com/kocasariumut/faceanything) | CC-BY-NC-4.0 | Blocked | safety-boundary research only |
| [fal-3d-anything](https://github.com/blendi-remade/fal-3d-anything) | None declared; the README says MIT but the repository has no lic | Blocked | Creator Studio image-to-3D workflow research only |
| [Fenix AI Studio](https://github.com/FenixStudioAU/FenixAIStudio) | AGPL-3.0, read from the repository sidebar and restated in its R | Read only | what a local-first creative workstation puts on one screen |
| [Figranium](https://github.com/figranium/figranium) | GPL-3.0, read from the GitHub API's detected license.spdx_id on  | Read only | visual block-based browser workflows executed through an API |
| [Flint](https://github.com/chintanpatel24/flint) | MIT | Read only | Business Memory and local knowledge-graph UX research |
| [Flox](https://github.com/flox/flox) | GPL-2.0, read from the GitHub API's detected license.spdx_id on  | Read only | reproducible development environments built on Nix |
| [Forgejo](https://codeberg.org/forgejo/forgejo) | GPL-3.0-or-later; current Forgejo v9+ releases | Research only | study community-governed self-hosted forge, Actions, federation and privacy-oriented operations |
| [free-for.dev](https://github.com/ripienaar/free-for-dev) | None declared. The GitHub API returns no `license` object at all | Blocked | finding services with free tiers |
| [FreeToken](https://github.com/FlashML-org/FreeToken) | Apache-2.0; model weights and accelerator dependencies require s | Research only | Local Edge Mode hardware and inference-cost research |
| [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template) | MIT | Read only | compare password recovery and JWT session handling against SONARA's |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Apache-2.0 | Read only | repository assistance |
| [GenAI Agents (NirDiamant)](https://github.com/NirDiamant/GenAI_Agents) | NOASSERTION: GitHub detects a licence file it cannot classify. U | Licence unresolved | 50+ worked implementations of generative-AI agent techniques |
| [GEO SEO Claude](https://github.com/zubair-trabzada/geo-seo-claude) | MIT | Read only | Growth Studio audit-checklist and structured-data research |
| [GitDiagram](https://github.com/ahmedkhaleel2004/gitdiagram) | MIT | Read only | studying public repository structure |
| [Gitea](https://github.com/go-gitea/gitea) | MIT | Research only | study lightweight self-hosted Git, code review, package registry and CI/CD |
| [Gitingest](https://github.com/cyclotruc/gitingest) | MIT | Read only | creating a bounded text view of a public repository for internal analysis |
| [GitLab Community Edition mirror](https://github.com/gitlabhq/gitlabhq) | MIT core in the mirror, with documentation and enterprise/JH dir | Research only | study integrated CI/CD, runners, package registries, merge workflows and self-managed operations |
| [GitMCP](https://github.com/idosal/git-mcp) | Apache-2.0 | Read only | read-only context for public repositories |
| [Gortex](https://github.com/zzet/gortex) | Apache-2.0 | Read only | local code-search and impact-analysis research |
| [Gridex](https://github.com/gridex/gridex) | Apache-2.0 | Research only | a developer's own machine, if somebody wants a desktop Postgres client; nothing in the product |
| [Helmet](https://github.com/helmetjs/helmet) | MIT | Adapt after review | security headers for the existing Express application |
| [Hugging Face Transformers](https://github.com/huggingface/transformers) | Apache-2.0; every model and dataset licence remains separate | Read only | model-provider abstraction research |
| [Image Pipes (mrajaeim)](https://github.com/mrajaeim/image-pipes) | MIT | Read only | nothing shipped -- a self-hosted desktop tool with no surface in this product that needs it |
| [IONOS \](https://www.ionos.com) | All rights reserved. The document carries \ | Blocked | reading what a hosting competitor tells small businesses about AI |
| [Job Data APIs and Scrapers](https://github.com/cporter202/job-data-apis-and-scrapers) | MIT | Blocked | none -- the third copy of the same affiliate catalogue, in a third vertical |
| [Keycloak](https://github.com/keycloak/keycloak) | Apache-2.0 | Research only | replacing Supabase Auth behind the four endpoints this application calls |
| [kimi-k3-in-c](https://github.com/FareedKhan-dev/kimi-k3-in-c) | Apache-2.0 | Read only | evidence that large-model inference needs no GPU |
| [LangChain](https://github.com/langchain-ai/langchain) | MIT; integration packages and providers require separate review. | Read only | worker architecture reference |
| [Langflow](https://github.com/langflow-ai/langflow) | MIT | adapter_built | visual flow prototyping |
| [LightRAG](https://github.com/HKUDS/LightRAG) | MIT | Read only | how a document set becomes searchable without a vector database |
| [Logto](https://github.com/logto-io/logto) | MPL-2.0, read from the GitHub API's detected license.spdx_id on  | Read only | sign-in, SSO and RBAC for a SaaS product |
| [Lovable for Beginners](https://github.com/cporter202/lovable-for-beginners) | None declared (all rights reserved) | Blocked | none -- a fifteen-module course with no licence grant |
| [Mautic](https://github.com/mautic/mautic) | GPL-3.0-or-later | Research only | study campaign segmentation, journeys, scoring and email orchestration |
| [Medusa](https://github.com/medusajs/medusa) | MIT core; enterprise materials require separate commercial terms | Research only | study modular commerce primitives, carts, orders, promotions and inventory APIs |
| [Metabigor](https://github.com/j3ssie/metabigor) | MIT | Blocked | authorized defensive asset-inventory policy reference only |
| [Miro AI / agent resources](https://miro.com/) | Terms and API permissions require review. | Read only | collaboration pattern review |
| [MIT Technology Review Insights \](https://www.technologyreview.com) | All rights reserved. The back matter reads \ | Blocked | reading what an enterprise-data vendor tells CIOs about generative AI |
| [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | Apache-2.0 / MIT transition; root LICENSE says new contributions | Adapt after review | typed MCP client/server adapters behind explicit tool allowlists |
| [Next.js](https://github.com/vercel/next.js) | MIT | Research only | nothing to adopt -- this application is Express and CommonJS by choice, and the choice has a reason |
| [NocoDB](https://github.com/nocodb/nocodb) | Sustainable Use License 1.0 on current master/develop; source-av | Licence unresolved | study spreadsheet-like database UX, APIs and collaborative data views |
| [node-cron](https://github.com/node-cron/node-cron) | ISC | Adapt after review | small deterministic schedules that do not require a full durable workflow engine |
| [NodeGraphQt](https://github.com/jchanvfx/NodeGraphQt) | MIT | Read only | node-graph interaction research for creator and internal workflow tools |
| [NVlabs Eagle / Embodied](https://github.com/NVlabs/EAGLE) | Apache-2.0 for the code; the model weights are under the NVIDIA  | Research only | long-context media research |
| [NVlabs LongLive / LongLive 2.0](https://github.com/NVlabs/LongLive) | Apache-2.0 (repository); one vendored subdirectory is MIT | Research only | understand long-video workflows |
| [OBLITERATUS](https://github.com/elder-plinius/OBLITERATUS) | AGPL-3.0 upstream with a stated commercial-license option; legal | Blocked | defensive refusal-integrity test design |
| [Odoo Community](https://github.com/odoo/odoo) | LGPL-3.0; Odoo Community 19.0 root LICENSE, with bundled compone | Research only | study modular business application boundaries, workflow composition and administration UX |
| [Ollama](https://github.com/ollama/ollama) | MIT; model licenses are reviewed separately. | adapter_built | local inference |
| [OmniRoute](https://github.com/diegosouzapw/OmniRoute) | MIT | Read only | a named option for the Provider Gateway AGENTS.md already requires, if one is ever hosted rather than written |
| [Open Policy Agent](https://github.com/open-policy-agent/opa) | Apache-2.0 | Adapt after review | isolated policy evaluation where policy-as-code adds measurable value |
| [Open SaaS (wasp-lang)](https://github.com/wasp-lang/open-saas) | MIT, read from the GitHub API's detected license.spdx_id on 18 A | Read only | a free full-stack SaaS starter with auth, payments, jobs and an AGENTS.md |
| [Open WebUI](https://github.com/open-webui/open-webui) | Open WebUI License, BSD-3-Clause based with branding conditions. | adapter_built | private model evaluation |
| [OpenAI Agents SDK (Python)](https://github.com/openai/openai-agents-python) | MIT, read from the GitHub API's detected license.spdx_id on 18 A | Read only | multi-agent workflows, handoffs, guardrails, tracing |
| [OpenClaw](https://github.com/openclaw/openclaw) | MIT | Adapt after review | private operator gateway |
| [openclaw-api-list](https://github.com/cporter202/openclaw-api-list) | None declared. No LICENSE file and no licence statement in the R | Blocked | none -- recorded so the measurement is on file and nobody curates from it by mistake |
| [opencode (anomalyco)](https://github.com/anomalyco/opencode) | MIT | Read only | a developer-side coding agent, read for how it is built rather than adopted into the product |
| [OpenCompany](https://github.com/zeenie-ai/opencompany) | MIT | Read only | Agent Control Plane threat modeling and orchestration UX research |
| [OpenContext](https://github.com/0xranx/OpenContext) | Three different declarations in one repository, which is the fin | Licence unresolved | possible development-time tool for whoever works on this codebase -- nothing customer-facing, and nothing until one licence is stated |
| [OpenFeature JavaScript SDK](https://github.com/open-feature/js-sdk) | Apache-2.0 | Adapt after review | provider-neutral feature evaluation without coupling product logic to one flag vendor |
| [OpenFGA](https://github.com/openfga/openfga) | Apache-2.0 | Adapt after review | relationship-based authorization experiments for complex sharing graphs |
| [OpenHuman](https://github.com/tinyhumansai/openhuman) | GPL-3.0 | Read only | local-memory privacy and agent-orchestration research |
| [OpenNews MCP](https://github.com/6551Team/opennews-mcp) | MIT | Read only | how an MCP server exposes a read-only external feed |
| [OpenTelemetry JavaScript](https://github.com/open-telemetry/opentelemetry-js) | Apache-2.0 | Adapt after review | traces, metrics and context propagation for route, workflow and provider reliability |
| [OpenVid](https://github.com/cristianolivera1/openvid) | PolyForm Noncommercial 1.0.0 | Blocked | Creator Studio workflow research for product-demo framing and motion |
| [OpenViking](https://github.com/volcengine/openviking) | AGPL-3.0 | Read only | agent-memory and knowledge-namespace architecture research |
| [Ory Kratos](https://github.com/ory/kratos) | Apache-2.0 | Research only | replacing Supabase Auth in a server-rendered application with no front-end framework |
| [OSIRIS](https://github.com/simplifaisoul/osiris) | MIT | Blocked | none -- recorded so the refusal is written down rather than re-argued |
| [OWASP Noir](https://github.com/owasp-noir/noir) | MIT | Adapt after review | a developer-side check of what endpoints this repository actually exposes, run locally |
| [pgvector-node](https://github.com/pgvector/pgvector-node) | MIT | Adapt after review | Node vector bindings while PostgreSQL remains canonical |
| [Pino](https://github.com/pinojs/pino) | MIT | Adapt after review | structured JSON application logs with low overhead |
| [Playwright](https://github.com/microsoft/playwright) | Apache-2.0 | Adapt after review | deterministic end-to-end testing for owned SONARA surfaces |
| [PostgREST](https://github.com/PostgREST/postgrest) | PostgreSQL | Read only | understanding what this application actually depends on |
| [PostHog](https://github.com/PostHog/posthog) | NOASSERTION: GitHub cannot classify it because the repository ca | Licence unresolved | product analytics, experiments, error tracking, surveys |
| [prompts.chat](https://github.com/f/prompts.chat) | MIT for source code and site-authored content; CC0-1.0 for promp | Adapt after review | prompt catalog architecture |
| [Public APIs](https://github.com/public-apis/public-apis) | MIT, read from the GitHub API's detected license.spdx_id on 19 A | Read only | finding a free API for a capability |
| [Public Suffix List](https://github.com/publicsuffix/list) | MPL-2.0 | Research only | none today -- reviewed so the reason it is not needed is written down rather than re-argued |
| [Qdrant JavaScript SDK](https://github.com/qdrant/qdrant-js) | Apache-2.0 | Adapt after review | isolated vector projection adapters with tenant filters and provenance |
| [RAGFlow](https://github.com/infiniflow/ragflow) | Apache-2.0 noted upstream; bundled service and dependency licens | adapter_built | dataset inventory |
| [React](https://github.com/facebook/react) | MIT | Research only | nothing to adopt -- the work screens are server-rendered HTML and progressive enhancement, deliberately |
| [Real Estate Data APIs](https://github.com/cporter202/real-estate-data-apis) | MIT | Blocked | none -- same affiliate catalogue in a different vertical |
| [Remotion / MapLibre-style video and map animation references](https://github.com/remotion-dev/remotion) | Remotion: source-available under the Remotion License — free for | Read only | map animation drafts |
| [Resend Node SDK](https://github.com/resend/resend-node) | MIT | Adapt after review | typed server-side transactional email delivery |
| [reverse-skill](https://github.com/zhaoxuya520/reverse-skill) | MIT | Blocked | defensive security research policy only |
| [Roboflow / object detection references](https://github.com/roboflow) | External provider terms and model licenses require review. | Research only | media tagging research |
| [Rust programming references](https://github.com/rust-lang/rust) | Reference material licenses vary and require source-level review | Read only | language/tooling fit research |
| [Saleor](https://github.com/saleor/saleor) | BSD-3-Clause | Research only | study headless commerce APIs, checkout, channels, promotions and extensibility |
| [SAM Sovereign Agent Mesh](https://github.com/google/sam) | Apache-2.0 | Security review first | future agent-network threat modeling and protocol research |
| [Scrapling](https://github.com/D4Vinci/Scrapling) | BSD-3-Clause, read from the GitHub API's detected license.spdx_i | Research only | fetching and parsing pages |
| [Sentry](https://github.com/getsentry/sentry) | Source-available / mixed licensing; exact components and deploym | Licence unresolved | study issue grouping, release health, stack-trace workflows and operational triage |
| [sherpa-onnx (k2-fsa)](https://github.com/k2-fsa/sherpa-onnx) | Apache-2.0, read from the GitHub API licence field on 18 August  | Adapt after review | transcription, synthesis and speaker separation with no network call |
| [Skills for Real Engineers (Matt Pocock)](https://github.com/mattpocock/skills) | MIT | Read only | engineering-practice skills for the agents that work in this repository |
| [software-income-playbooks](https://github.com/cporter202/software-income-playbooks) | None declared. No LICENSE file and no licence statement, checked | Blocked | none -- recorded because it was submitted twice and the measurement should not have to be redone |
| [Sonora (nolight132)](https://github.com/nolight132/sonora) | GPL-3.0-or-later | Read only | none -- and the reason to keep the record is the name rather than the code |
| [Stock Market Signal Automation (cporter202)](https://github.com/cporter202/stock-market-signal-automation) | MIT | Read only | nothing shipped -- the licence permits use and this product has no trading surface to use it on |
| [Stratum](https://github.com/stratumauth/app) | GPL-3.0-or-later | Blocked | reference only for how a TOTP authenticator is structured; the standards it implements are the reusable part, not this code |
| [Stripe Node SDK](https://github.com/stripe/stripe-node) | MIT | Adapt after review | typed server-side Stripe API calls and webhook helpers |
| [Supabase JavaScript Client](https://github.com/supabase/supabase-js) | MIT | Adapt after review | official client access to supported Supabase APIs where it reduces hand-written protocol risk |
| [Temporal TypeScript SDK](https://github.com/temporalio/sdk-typescript) | MIT | Adapt after review | checkpointed long-running workflows with retries, timers and deterministic replay |
| [The Algorithms repositories](https://github.com/TheAlgorithms) | Repository licenses require review before copying examples. | Read only | Developer Formula Studio docs |
| [TidyFactor Styler](https://github.com/TidyFactor/Styler) | Apache-2.0 | Read only | reading how a design skill is structured; it writes into a codebase, which is the reason not to run it here |
| [UniFace](https://github.com/yakhyo/uniface) | MIT | Blocked | safety-boundary and refusal documentation only |
| [Unsloth](https://github.com/unslothai/unsloth) | Apache-2.0, read from the GitHub API's detected license.spdx_id  | Read only | fine-tuning a language model |
| [Valkey](https://github.com/valkey-io/valkey) | BSD-3-Clause | Research only | a cache or rate-limit store, if one is ever needed, without a licence conversation |
| [Vercel Labs Skills (find-skills)](https://github.com/vercel-labs/skills) | MIT. Read on 18 August 2026 from GitHub's own detected licence f | Licence unresolved | searching the published Claude Code skill ecosystem for an existing skill |
| [Vibe Coding with Base44](https://github.com/cporter202/vibe-coding-with-base44) | MIT | Read only | reading only, and mainly as a worked example of how a vendor guide should disclose its own incentive |
| [Vibe Trading](https://github.com/HKUDS/Vibe-Trading) | MIT | Blocked | none -- recorded alongside AutoHedge because the refusal is the same refusal |
| [Voice cloning cluster: GPT-SoVITS, VoxCPM, CosyVoice, dia](https://github.com/RVC-Boss/GPT-SoVITS) | MIT on the repository code. Read on 18 August 2026 from GitHub's | Security review first | none approved as a general feature |
| [Vulture](https://github.com/vulture-osint-automation-tool/vulture) | None declared. No LICENSE file, checked 11 September 2026. All r | Blocked | none -- there is no version of this product that has a use for it, and that is the finding rather than a caution |
| [watermarks-remover (remove-ai-marks)](https://github.com/guillaumemeyer/watermarks-remover) | MIT | Blocked | reviewed on request; no use in this product |
| [wshobson/agents](https://github.com/wshobson/agents) | MIT, read from the GitHub API's detected license.spdx_id on 18 A | Read only | a marketplace of subagents, skills and plugins for coding harnesses |
| [x-cmd](https://github.com/x-cmd/x-cmd) | Apache-2.0 | Read only | internal command-discovery research only |
| [X/Twitter Recommendation Algorithm](https://github.com/twitter/the-algorithm) | Public repository license requires review before production use. | Read only | learn ranking architecture patterns |
| [Zitadel](https://github.com/zitadel/zitadel) | AGPL-3.0 | Research only | identity research only, pending a legal reading of the network-use obligation |
| [Zod](https://github.com/colinhacks/zod) | MIT | Adapt after review | runtime validation for typed adapters and internal TypeScript tooling |

## Placed against no product

Not an oversight list. Each of these is either blocked, unresolved, or build-time tooling that never reaches a customer -- and each one is here rather than absent so the reason stays visible.

| Repository | Licence | How far it may go | Why it fits no product |
| --- | --- | --- | --- |
| [AAABench long-horizon agent harness](https://github.com/ukanwat/aaabench) | MIT | Research only | measuring whether an agent holds a task over many hours |
| [aiwaves-cn/agents](https://github.com/aiwaves-cn/agents) | Apache-2.0, read from the GitHub API's detected license.spdx_id  | Research only | data-centric self-evolving autonomous language agents |
| [async-labs/saas](https://github.com/async-labs/saas) | MIT, read from the GitHub API's detected license.spdx_id on 18 A | Research only | React, Next, Express, MongoDB SaaS boilerplate |
| [AutoHedge automated trading agents](https://github.com/The-Swarm-Corporation/AutoHedge) | MIT | Research only | none approved for this product |
| [Camoufox stealth browser](https://github.com/jo-inc/camofox-browser) | MIT | Blocked | do not vendor, depend on, or ship anything built on it |
| [Claude ads toolkit](https://github.com/AgriciDaniel/claude-ads) | MIT | Research only | campaign copy structure |
| [Claude Code Apple platform skills](https://github.com/rshankras/claude-code-apple-skills) | MIT | Research only | skill file structure for a Claude Code skill set |
| [Claude Skills Collection (alirezarezvani)](https://github.com/alirezarezvani/claude-skills) | MIT | Adapt after review | skills used while building SONARA |
| [Cloudflare agentic inbox](https://github.com/cloudflare/agentic-inbox) | Apache-2.0 | Research only | patterns for triaging inbound mail with an agent |
| [Commercial AI tool shortlist (Ideogram, Midjourney, Runway, and 30 others)](https://example.invalid/blocked) | Proprietary per-seat subscriptions. These are hosted services, n | Blocked | do not make any of these a dependency of a shipped feature |
| [Figranium MCP server](https://github.com/figranium/figranium-mcp) | GPL-3.0, read from the GitHub API's detected license.spdx_id on  | Read only | exposing Figranium tools to Claude and other MCP clients |
| [Figranium Templates](https://github.com/figranium/figranium-templates) | AGPL-3.0, read from the GitHub API's detected license.spdx_id on | Blocked | blocked rather than reference_only, and the difference is deliberate: AGPL-3.0 catches exactly the arrangement that keeps the plain GPL at arm's length |
| [Fincept Terminal](https://github.com/Fincept-Corporation/FinceptTerminal) | AGPL-3.0 | Blocked | do not incorporate any part of it into this hosted product |
| [Foodya Restaurant](https://github.com/Shahzaib-Awann/Foodya-Restaurant) | No licence declared. Settled on 18 August 2026: GitHub's reposit | Blocked | do not adopt: there is no licence to adopt under, and this is now established rather than pending |
| [game-reversing](https://github.com/kovidomi/game-reversing) | The Unlicense, read from the GitHub API's detected license.spdx_ | Research only | beginner materials on reverse engineering video games |
| [Harness (RevFactory)](https://github.com/revfactory/harness) | Apache-2.0, verified from the repository's own licence badge. Th | Adapt after review | decomposing a domain into specialised agents |
| [HeyGen HyperFrames](https://github.com/heygen-com/hyperframes) | Apache-2.0 | Research only | avatar video generation, if the owner connects an account |
| [LibreChat self-hosted chat interface](https://github.com/danny-avila/LibreChat) | MIT | Research only | a worked example of multi-provider routing and per-user auth in a chat product |
| [MADDPG reference implementation (philtabor)](https://github.com/philtabor/Multi-Agent-Deep-Deterministic-Policy-Gradients) | None declared. The GitHub API returns no `license` object for th | Blocked | copy nothing from it |
| [MateClaw multi-agent orchestrator](https://github.com/mateaix/mateclaw) | Apache-2.0 | Research only | orchestration patterns for agents with memory and tools |
| [MERN Social Media (ed-roh)](https://github.com/ed-roh/mern-social-media) | None declared. With no licence, default copyright applies and no | Blocked | do not copy or adapt any of it |
| [Microsoft 365 Agents SDK](https://github.com/microsoft/Agents) | MIT, read from the GitHub API's detected license.spdx_id on 18 A | Research only | agents for Teams, M365, Copilot Studio and Webchat |
| [n8n-nodes-figranium](https://github.com/figranium/n8n-nodes-figranium) | MIT, read from the GitHub API's detected license.spdx_id on 18 A | Read only | calling a locally running Figranium from n8n |
| [NautilusTrader](https://github.com/nautechsystems/nautilus_trader) | LGPL-3.0, read from the GitHub API's detected license.spdx_id on | Research only | backtesting and live trading infrastructure |
| [Nuxt SaaS template](https://github.com/nuxt-ui-templates/saas) | MIT, read from the GitHub API's detected license.spdx_id on 18 A | Read only | a Nuxt UI and Nuxt Content SaaS marketing template |
| [Open Generative AI directory](https://github.com/Anil-matcha/Open-Generative-AI) | MIT | Research only | survey of what exists |
| [Open-LLM-VTuber avatar companion](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) | MIT | Research only | how an avatar is driven by speech and model output |
| [OpenEdit](https://github.com/veedstudio/open-edit) | Apache-2.0 | Research only | producing marketing and launch video on the owner's own machine |
| [OSINT4ALL investigation directory](https://example.invalid/blocked) | A curated bookmark page, not software. The hundreds of services  | Blocked | do not integrate any category of it |
| [PraisonAI multi-agent framework](https://github.com/MervinPraison/PraisonAI) | MIT | Research only | agent team structure |
| [SadServers](https://github.com/SadServers/sadservers) | None declared. The GitHub API returns no `license` object for th | Blocked | take nothing: the scenarios, their Terraform and their wording all belong to their author |
| [Self-Driving Car in Video Games](https://github.com/ikergarcia1996/Self-Driving-Car-in-Video-Games) | GPL-3.0, read from the GitHub API's detected license.spdx_id on  | Research only | a neural network that learns to drive in video games |
| [Skylos](https://github.com/duriantaco/skylos) | Apache-2.0 | Read only | finding code nothing reaches |
| [Social Media App (adrianhajdin)](https://github.com/adrianhajdin/social_media_app) | None declared. With no licence, default copyright applies and no | Blocked | do not copy or adapt any of it |
| [Streambert / movie streaming piracy-style references](https://example.invalid/blocked) | Piracy/copyright infringement risk. | Blocked | do not integrate |
| [StreamCap (multi-platform live stream recorder)](https://github.com/ihmily/StreamCap) | Apache-2.0, from GitHub's detected licence field on 18 August 20 | Blocked | do not adopt: the block is on conduct, not licence, so a permissive licence does not resolve it |
| [Suno API (unofficial)](https://github.com/SunoAI-API/Suno-API) | MIT for the wrapper code; the upstream service it calls is gover | Blocked | do not integrate |
| [Superpowers](https://github.com/obra/superpowers) | MIT | Adapt after review | engineering workflow discipline used while building SONARA |
| [The Code — Developer Resources (newsletter landing page)](https://learn-code-tiles.lovable.app/) | All rights reserved. The page carries \ | Blocked | take nothing from it: the whole document is fourteen titles and fourteen one-line descriptions, and all of it is somebody's copyrighted wording |
| [Unity ML-Agents Toolkit](https://github.com/Unity-Technologies/ml-agents) | NOASSERTION: GitHub detects a licence file it cannot classify. U | Licence unresolved | read Unity's actual licence text before anything else, and do not assume Apache-2.0 from the presence of an Apache header somewhere in the tree |
| [XenDroid Xbox 360 emulator](https://example.invalid/blocked) | No licence declared | Blocked | do not vendor, adapt, or depend on any part of it |
