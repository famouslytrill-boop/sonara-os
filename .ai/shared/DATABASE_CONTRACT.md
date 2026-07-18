# Database Contract

## Source of truth

- Supabase/Postgres is the production database contract.
- Canonical migrations: `supabase/migrations/`.
- Current migration count: 6.
- Latest migration in this checkout: `20260618222245_activate_real_saas_system.sql`.
- Migrations are append-only unless an explicit corrective ADR says otherwise.

## Discovered tables

Identity/access: `profiles`, `user_profiles`, `organizations`, `organization_members`, `user_roles`, `workspaces`, `app_settings`, `notification_preferences`, `admin_audit_logs`, `audit_logs`.

Billing: `products`, `prices`, `subscriptions`, `billing_subscriptions`, `billing_entitlements`, `billing_webhook_events`, `checkout_sessions`, `payments`, `orders`, `payment_options`.

Support/shared work: `support_requests`, `support_email_delivery_attempts`, `outbound_emails`, `email_events`, `activities`, `approval_events`, `files_records`, `generated_documents`, `intake_submissions`, `checklist_submissions`, `tool_runs`.

Business Builder: `business_profiles`, `business_plans`, `business_products`, `business_services`, `business_offers`, `business_customers`, `business_orders`, `business_invoices`, `business_tasks`, `business_documents`, `business_employees`, `business_employee_invites`, `business_launch_checklists`, `business_operations_checklists`, `business_marketing_plans`.

Creator Studio: `creator_projects`, `creator_assets`, `creator_releases`, `creator_briefs`, `creator_exports`, `creator_campaigns`, `creator_content_calendar`, `creator_production_notes`, `creator_tasks`.

Growth Studio: `campaigns`, `campaign_contacts`, `campaign_messages`, `campaign_events`, `campaign_exports`, `leads`, `lead_notes`, `follow_ups`, `content_plans`, `consent_records`, `opt_outs`, `outreach_approvals`, `outreach_audit_logs`, `growth_tactics`, `growth_experiments`, `growth_experiment_events`, `growth_checklists`, `growth_checklist_items`, `growth_analytics_events`.

Agents/vector: `agent_tasks`, `agent_sessions`, `agent_tools`, `agent_memory_entries`, `agent_feedback`, `agent_audit_logs`, `agent_search_logs`, `vector_documents`, `ai_jobs`, `ai_outputs`, `prompt_templates`.

Other platform: `apps`, `app_modules`, `module_access_rules`, `feature_flags`, `external_connections`, `customer_records`, `proof_profiles`, `booking_links`, `smart_intake_forms`, `offers`, `reviews`, `money_path_events`, `system_health_events`.

## Required invariants

- Tenant records require organization/workspace ownership where applicable.
- RLS and server-side authorization both apply; browser hiding is not authorization.
- Anonymous access is limited to explicitly reviewed public intake operations.
- Audit, webhook, and delivery records are append-only/idempotent where practical.
- Secrets, raw payment data, CVV, private keys, and provider credentials are never stored in metadata.
- Schema naming inconsistencies (`organization_members` versus desired `organization_memberships`) require compatibility analysis before change; do not duplicate blindly.

## Change protocol

Update this contract, add a forward-safe migration, update validation/tests, record the ADR if architecture changes, and log the handoff.

