# SONARA Market Integration Benchmark Map

This document converts competitor/app research into build patterns for SONARA Industries. Use the patterns, not proprietary assets, exact wording, logos, or private code.

## Product references to study

### Apple Music / Spotify-style creator experience
- Use for Creator Studio music discovery, mood-based project organization, release planning, playlist-style collections, audio visualizers, and premium mobile hero screens.
- SONARA pattern: `Creator Studio -> Music System -> Discover, Blueprint, Prompt Pack, Release, Export`.
- Build modules:
  - creator_artist_systems
  - creator_song_blueprints
  - creator_prompt_packs
  - creator_release_packages
  - creator_export_packages
  - audio_analysis_reports
  - music_ai_jobs
- UI ideas:
  - large emotional hero panels
  - album/project cards
  - playback-inspired progress bar for job status
  - audio-reactive visualizer, only as progressive enhancement

### Square Point of Sale
- Use for Business Builder checkout, POS records, order capture, payments, invoices, inventory, customer records, and small-business dashboard patterns.
- SONARA pattern: `Business Builder -> Sell, Track, Pay, Report`.
- Build modules:
  - pos_sales_summaries
  - pos_menu_mix_items
  - customer_records
  - menu_items
  - inventory_items
  - bill_payment_records
  - stripe_checkout_sessions
  - billing_webhook_events
- UI ideas:
  - simple owner dashboard
  - touch-friendly payment and order cards
  - setup-required payment status
  - inventory and sales tiles

### Booksy Biz
- Use for appointment scheduling, service catalogs, staff calendars, reminders, and service-business management.
- SONARA pattern: `Business Builder -> Appointments, Services, Staff, Customers`.
- Build modules:
  - business_service_catalog
  - business_appointments
  - business_employee_profiles
  - employee_schedules
  - customer_records
  - employee_posts
- UI ideas:
  - mobile calendar first
  - service cards with duration and price
  - staff availability views
  - appointment status chips

### WhatsApp Business
- Use for customer messaging, business profile, catalog, quick replies, labels, and customer follow-up workflows.
- SONARA pattern: `Business Builder / Growth Studio -> Customer Messages, Catalog, Follow-up`.
- Build modules:
  - customer_conversations
  - customer_messages
  - business_catalog_items
  - growth_leads
  - growth_follow_ups
  - integration_providers
  - organization_integrations
- UI ideas:
  - message inbox
  - quick reply buttons
  - customer labels
  - catalog/share buttons

### QuickBooks / Wave
- Use for accounting records, invoices, receipt capture, expenses, reports, profit/loss dashboards, mileage/vehicle tracking, and accounting export.
- SONARA pattern: `Business Builder -> Money, Bills, Receipts, Reports`.
- Build modules:
  - vendor_invoices
  - vendor_invoice_lines
  - bill_payment_records
  - accounting_exports
  - daily_profit_snapshots
  - vehicle_records
  - route_tracking_sessions
- UI ideas:
  - cash-flow cards
  - invoice status list
  - receipt upload box
  - profit/loss chart
  - export-to-accounting setup state

### Skype for Business / Teams-style communication
- Use for staff communication, internal posts, meetings, owner/staff announcements, and support conversations.
- SONARA pattern: `Business Builder -> Staff Portal -> Posts, Messages, Schedule`.
- Build modules:
  - employee_posts
  - employee_schedules
  - customer_support_threads
  - organization_activity_events
- UI ideas:
  - staff feed
  - manager announcements
  - schedule cards
  - conversation thread layout

### Amazon Business
- Use for procurement, supplier catalog, purchase orders, reorder lists, vendor comparisons, and business supplies management.
- SONARA pattern: `Business Builder -> Supplies, Vendors, Purchasing`.
- Build modules:
  - vendor_accounts
  - purchase_orders
  - purchase_order_lines
  - inventory_items
  - location_transfers
  - business_assets
- UI ideas:
  - reorder list
  - vendor cards
  - purchase order builder
  - supply category tiles

### Business Planner AI apps
- Use for guided planning, SWOT-style strategy, business health checks, launch checklists, and growth prompts.
- SONARA pattern: `Business Builder / Growth Studio -> Planning, Launch, Strategy`.
- Build modules:
  - business_plans
  - business_plan_sections
  - growth_campaigns
  - growth_experiments
  - module_outputs
- UI ideas:
  - guided wizard
  - checklist with saveable outputs
  - plain-language business recommendations
  - export to PDF later

## Open-source and AI technology references to study

### NVIDIA Nemotron 3.5 ASR Streaming 0.6B
- Source: `https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b`
- Use for Creator Studio and Business Builder speech-to-text, live meeting notes, voice memo transcription, music-session notes, multilingual captions, customer-call summaries, and employee/owner voice capture.
- SONARA pattern: `Creator Studio -> Audio Job -> Transcribe -> Summarize -> Save to project`.
- Worker placement: GPU/ASR worker only. Do not run this inside the Express web server.
- Build modules:
  - audio_transcription_jobs
  - audio_transcription_segments
  - creator_audio_notes
  - business_voice_notes
  - customer_call_summaries
  - worker_job_artifacts
- UI ideas:
  - microphone capture card
  - upload audio file action
  - transcript progress timeline
  - language tag badge
  - confidence/setup-required status

### OpenCut
- Source: `https://github.com/OpenCut-app/OpenCut`
- Use for Creator Studio video editing workflow inspiration, timeline interface, clips, exports, batch rendering, plugin architecture, and creator asset management.
- SONARA pattern: `Creator Studio -> Video Project -> Timeline -> Export Package`.
- Do not copy OpenCut code into SONARA without license review and architecture isolation.
- Build modules:
  - creator_video_projects
  - creator_video_clips
  - creator_video_timelines
  - creator_video_export_jobs
  - creator_asset_library
  - worker_job_artifacts
- UI ideas:
  - timeline strip
  - clip cards
  - export status panel
  - asset library drawer
  - headless/batch render status for workers later

### Clone-Wars
- Source: `https://github.com/GorvGoyl/Clone-Wars`
- Use as a learning and pattern-discovery index for how popular apps are structured. Do not use it as a copy machine, because that is how you create legal and product garbage at the same time.
- SONARA pattern: `Admin -> Pattern Lab -> Study interface flow -> Convert into original component pattern`.
- Build modules:
  - sonara_pattern_lab_sources
  - sonara_pattern_lab_reviews
  - sonara_ui_component_patterns
  - sonara_feature_gap_reports
- UI ideas:
  - pattern checklist
  - competitor-flow notes
  - component inspiration board
  - legal-safe design review status

### Pydantic Monty
- Source: `https://github.com/pydantic/monty`
- Use as a reference for secure agent-execution architecture: controlled code execution, resource limits, host-function allowlists, stdout/stderr capture, snapshot/resume, and safer AI-generated code workflows.
- SONARA pattern: `Admin / Growth Studio / Creator Studio -> Agent Task -> Safe Code Step -> Result -> Save Artifact`.
- Monty is experimental. Treat it as a research benchmark first, not a production dependency until reviewed.
- Build modules:
  - agent_execution_profiles
  - agent_execution_runs
  - agent_allowed_functions
  - agent_execution_artifacts
  - agent_execution_limits
  - agent_execution_audit_logs
- UI ideas:
  - safe execution badge
  - allowed actions list
  - memory/time limit controls
  - stdout/stderr result card
  - snapshot/resume timeline
  - blocked access warning for filesystem, network, and env variables

## Infrastructure registry additions

Add these rows to the future `021_sonara_runtime_control_plane.sql` seed data:

- `business_pos_system`: Square-inspired POS flow.
- `business_booking_system`: Booksy-inspired appointment/service flow.
- `business_customer_messaging`: WhatsApp Business-inspired customer communication flow.
- `business_accounting_system`: QuickBooks/Wave-inspired accounting and reporting flow.
- `business_procurement_system`: Amazon Business-inspired purchase order and supplier flow.
- `staff_communications_system`: Skype/Teams-inspired staff communications flow.
- `creator_music_discovery_system`: Apple Music/Spotify-inspired creator discovery flow.
- `business_strategy_planner`: AI business-planning workflow.
- `creator_asr_transcription_system`: NVIDIA Nemotron-inspired ASR transcription workflow.
- `creator_video_editor_system`: OpenCut-inspired creator video timeline and export workflow.
- `sonara_pattern_lab`: Clone-Wars-inspired safe pattern research workflow.
- `safe_agent_execution_system`: Pydantic Monty-inspired secure agent code execution and audit workflow.

Each system must have:

1. Database table coverage.
2. Owner/admin/staff/customer permissions.
3. Readiness endpoint.
4. Real create/list/update API.
5. Admin control-plane row.
6. Test coverage.
7. Setup-required status when integrations are missing.
8. License and terms review when external repositories, models, or APIs are involved.

## Public-language rule

Use common words in the UI:

- Payment update, not webhook.
- File area, not storage bucket.
- Live updates, not realtime channel.
- Background task, not worker job.
- Access protection, not RLS policy.
- Tool, not module.
- System map, not registry.

## Design rule

Borrow patterns only. Do not copy protected logos, screenshots, exact text, layouts, private code, proprietary assets, or provider branding.
