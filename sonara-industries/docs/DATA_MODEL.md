# Data Model

The data model is organization-first and app-scoped. Most business tables include organization_id and app so data cannot accidentally cross product boundaries.

Important tables include users, organizations, memberships, app_permissions, subscriptions, assets, transcripts, ingestion_jobs, public_feed_items, music_projects, music_exports, restaurant_recipes, restaurant_prep_items, audit_logs, app_access_events, and system_health_events.

Use indexes for app scope, organization scope, and recent activity. Enable RLS in production.

