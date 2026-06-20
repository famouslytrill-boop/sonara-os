# SONARA Industries Master Blueprint

This document captures the practical build contract from SONARA planning chats.

## Parent company

SONARA Industries is the parent company and control layer for three product companies:

1. Business Builder: small-business launch and operations infrastructure.
2. Creator Studio: creator, music, catalog, release, and monetization infrastructure.
3. Growth Studio: campaign, lead follow-up, consent-safe growth, analytics, and automation readiness.

## Product rules

- Every visible feature must produce a real result or show Setup Required.
- No fake dashboards, dead buttons, fake payment success, fake automation, fake award badges, or placeholder claims.
- Private server credentials must stay server-side.
- Public clients only receive intentionally public configuration values.
- Core stack should prefer free, open-source, local, or self-hostable tools.
- Paid providers are optional adapters and must be disabled until configured.
- Migrations must be idempotent.

## Business Builder scope

Business Builder needs offers, intake, customer records, orders, checkout, billing, appointments, employees, staff login, scheduling, time clock, wage projection, payroll export prep, locations, assets, inventory, vendors, menu/POS records, recipes, food cost, restaurant margin operations, waste logs, daily profit snapshots, vehicle/trailer records, route tracking, and support records.

## Creator Studio scope

Creator Studio needs asset catalog, creator offers, release checklist, monetization readiness, media records, Artist Identity Engine, Song Development Studio, Originality Guard, Authenticity Layer, Visual World Builder, Release Command Center, Fan Growth System, Creator Commerce Hub, Label Operations Suite, prompt packs, song blueprints, quality checks, release packages, export packages, music projects, tracks, stems, DAW export profiles, audio analysis, and transcription support after license review.

## Growth Studio scope

Growth Studio needs campaign workspaces, leads, follow-up workflows, consent checklists, experiments, analytics, automations, campaign ROI, lead scoring, follow-up priority, email reply rate, booking conversion, and audit-ready outbound review.

## Admin control plane

The admin control plane must expose deployment, readiness, users, roles, organizations, memberships, subscriptions, payment updates, support queue, product catalog, formulas, ecosystem manifest, routes, tables, storage, realtime channels, worker jobs, integrations, and audit logs without exposing private configuration values.

## Formula system

The formula layer must support revenue, margin, food cost, recipes, inventory, vendors, delivery cost, payroll, shifts, labor percentage, growth campaigns, lead scoring, creator/music readiness, prompt specificity, originality guard, device/UI capability, setup readiness, module health, and operating-twin scoring.

Formula text is metadata. Runtime formulas must use allowlisted functions, not unsafe expression execution.

## Infrastructure

Primary services: Vercel, Supabase Auth, Supabase Postgres, Supabase Storage, Supabase Realtime, Supabase Edge Functions, Stripe, Resend, GitHub, optional GitLab mirror, Docker, and Rancher.

Required storage buckets: avatars, business-assets, creator-assets, music-stems, release-packages, support-attachments, and exports.

Realtime channels: organization activity, organization support, business orders, business staff, creator jobs, and growth campaigns.

Worker jobs: payment webhook sync, email dispatch, storage cleanup, formula backfill, creator audio analysis, daily readiness snapshots, and admin alerts.

## UI and UX direction

SONARA should be premium, fast, reliable, mobile-first, readable, and clear. Product pages need separate company tabs, subpages, apps, subapps, and login paths where useful. Dashboards must be backed by live reads. Optional sound, haptics, voice, alerts, reduced-motion safety, and progressive 3D motion come after the core systems work.

Design inspiration can come from modern SaaS and business apps such as Stripe, Spotify, Apple Music, Square, Booksy, WhatsApp Business, QuickBooks, Wave, Amazon Business, GOV.UK, macOS, Windows 11, Figma, and Framer. Use inspiration, not copying.

## Research queue

Research queue entries include NVIDIA Nemotron ASR Streaming, OpenCut, Clone Wars, pydantic/monty, iptv-org/iptv, OBS Studio, and Unreal Engine. These start as review-required references or adapters until licensing, data privacy, product fit, cost, and safety are reviewed.

## Launch order

1. Fix migrations.
2. Verify tables.
3. Verify founder profile, organization, memberships, and roles.
4. Verify auth.
5. Verify admin login.
6. Verify Stripe checkout and webhook writes.
7. Verify Resend domain and sender.
8. Create storage buckets and policies.
9. Enable realtime with safe access rules.
10. Wire CRUD APIs per module.
11. Wire admin visualizers.
12. Add premium UI, app-store presentation, motion, 3D, sound, and haptic layers.
