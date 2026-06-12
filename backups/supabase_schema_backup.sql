


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgmq";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."entity_member_role" AS ENUM (
    'owner',
    'admin',
    'operator',
    'viewer'
);


ALTER TYPE "public"."entity_member_role" OWNER TO "postgres";


CREATE TYPE "public"."entity_type" AS ENUM (
    'parent_company',
    'creator_music_technology',
    'business_operations',
    'community_public_information'
);


ALTER TYPE "public"."entity_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_row_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  row_data jsonb;
  target_org_id uuid;
  target_company_key text;
  target_id uuid;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;

  target_id := nullif(row_data->>'id', '')::uuid;
  target_org_id := nullif(row_data->>'org_id', '')::uuid;

  if target_org_id is null and tg_table_name = 'organizations' then
    target_org_id := target_id;
  end if;

  target_company_key := coalesce(nullif(row_data->>'company_key', ''), 'parent_admin');

  insert into public.audit_logs(org_id, company_key, user_id, action, target_table, target_id, metadata)
  values (target_org_id, target_company_key, auth.uid(), tg_op, tg_table_name, target_id, jsonb_build_object('source', 'trigger'));

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."audit_row_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_entity"("target_entity_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  select public.has_entity_role(target_entity_id, array['owner','admin']::public.entity_member_role[]);
$$;


ALTER FUNCTION "public"."can_manage_entity"("target_entity_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_manage_entity"("target_entity_id" "uuid") IS 'Owner/admin helper for entity-scoped settings and operational configuration.';



CREATE OR REPLACE FUNCTION "public"."current_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select auth.uid();
$$;


ALTER FUNCTION "public"."current_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_company_access"("target_org_id" "uuid", "target_company_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.organization_app_access
    where org_id = target_org_id and company_key = target_company_key and enabled = true
  ) and public.is_org_member(target_org_id);
$$;


ALTER FUNCTION "public"."has_company_access"("target_org_id" "uuid", "target_company_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_entity_role"("target_entity_id" "uuid", "allowed_roles" "public"."entity_member_role"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  select exists (
    select 1
    from public.entity_memberships memberships
    where memberships.entity_id = target_entity_id
      and memberships.user_id = auth.uid()
      and memberships.role = any(allowed_roles)
  );
$$;


ALTER FUNCTION "public"."has_entity_role"("target_entity_id" "uuid", "allowed_roles" "public"."entity_member_role"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_entity_role"("target_entity_id" "uuid", "allowed_roles" "public"."entity_member_role"[]) IS 'Checks entity role for RLS. Uses auth.uid() and a locked search_path.';



CREATE OR REPLACE FUNCTION "public"."has_org_role"("target_org_id" "uuid", "target_role" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.organization_members
    where org_id = target_org_id and user_id = auth.uid() and role = target_role
  );
$$;


ALTER FUNCTION "public"."has_org_role"("target_org_id" "uuid", "target_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_scope"("target_org_id" "uuid", "target_scope" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.app_scopes scopes
    join public.organization_members members on members.org_id = scopes.org_id
    where scopes.org_id = target_org_id
      and scopes.scope = target_scope
      and members.user_id = auth.uid()
      and members.role in ('owner','admin','manager','editor','billing_admin','security_admin')
  );
$$;


ALTER FUNCTION "public"."has_scope"("target_org_id" "uuid", "target_scope" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;


ALTER FUNCTION "public"."is_current_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_entity_member"("target_entity_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  select exists (
    select 1
    from public.entity_memberships memberships
    where memberships.entity_id = target_entity_id
      and memberships.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_entity_member"("target_entity_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_entity_member"("target_entity_id" "uuid") IS 'Checks entity membership for RLS. Uses auth.uid() and a locked search_path.';



CREATE OR REPLACE FUNCTION "public"."is_org_member"("target_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.organization_members
    where org_id = target_org_id and user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_org_member"("target_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agent_action_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid",
    "actor_user_id" "uuid",
    "agent_key" "text" NOT NULL,
    "tool_key" "text" NOT NULL,
    "action" "text" NOT NULL,
    "risk_level" "text" DEFAULT 'medium'::"text" NOT NULL,
    "approval_state" "text" DEFAULT 'pending'::"text" NOT NULL,
    "result" "text" DEFAULT 'planned'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."agent_action_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alert_delivery_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'alertos'::"text",
    "public_alert_id" "uuid",
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alert_delivery_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alert_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'alertos'::"text",
    "source_type" "text" NOT NULL,
    "source_url" "text",
    "source_trust_score" numeric DEFAULT 50,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alert_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alert_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'alertos'::"text",
    "user_id" "uuid",
    "channel" "text" NOT NULL,
    "target" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alert_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alertos_trust_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'alertos'::"text",
    "source_id" "uuid",
    "score" numeric DEFAULT 50,
    "reasons" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alertos_trust_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anti_repetition_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'soundos'::"text",
    "project_id" "uuid",
    "warnings" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'ready'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."anti_repetition_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_scopes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "app_scopes_scope_check" CHECK (("scope" = ANY (ARRAY['soundos.read'::"text", 'soundos.write'::"text", 'tableos.read'::"text", 'tableos.write'::"text", 'alertos.read'::"text", 'alertos.write'::"text", 'billing.manage'::"text", 'security.manage'::"text", 'admin.all'::"text"])))
);


ALTER TABLE "public"."app_scopes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" NOT NULL,
    "item_type" "text" NOT NULL,
    "item_id" "uuid",
    "risk_level" "text" DEFAULT 'medium'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "requested_by" "uuid",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."approval_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."artist_dna_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'soundos'::"text",
    "artist_id" "uuid",
    "profile" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."artist_dna_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."artists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'soundos'::"text",
    "name" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."artists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audio_analysis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'soundos'::"text",
    "asset_id" "uuid",
    "result" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'queued'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audio_analysis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "actor_user_id" "uuid",
    "event_key" "text" NOT NULL,
    "risk_level" "text" DEFAULT 'medium'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "company_key" "text" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "target_table" "text",
    "target_id" "uuid",
    "allowed" boolean DEFAULT true,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."backup_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "company_key" "text" DEFAULT 'parent_admin'::"text",
    "backup_type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text",
    "storage_path" "text",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "finished_at" timestamp with time zone
);


ALTER TABLE "public"."backup_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."billing_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_events" (
    "id" "text" NOT NULL,
    "org_id" "uuid",
    "company_key" "text",
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "processed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."billing_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "plan_key" "text" NOT NULL,
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."billing_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_key" "text" NOT NULL,
    "module_name" "text" NOT NULL,
    "division" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'planned'::"text",
    "priority" integer DEFAULT 99,
    "free_tier_enabled" boolean DEFAULT true,
    "paid_tier_required" boolean DEFAULT false,
    "icon" "text",
    "route" "text",
    "hidden_from_main_nav" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_sub_app_database_schemas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "sub_app_id" "uuid" NOT NULL,
    "schema_key" "text" NOT NULL,
    "fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_sub_app_database_schemas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_sub_app_deployments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "sub_app_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'not_deployed'::"text" NOT NULL,
    "deployment_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_sub_app_deployments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_sub_app_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "sub_app_id" "uuid" NOT NULL,
    "module_key" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_sub_app_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_sub_app_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "sub_app_id" "uuid" NOT NULL,
    "page_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_sub_app_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_sub_apps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_sub_apps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "business_type" "text",
    "status" "text" DEFAULT 'setup_required'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_workspaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "employee_id" "uuid",
    "title" "text" NOT NULL,
    "expires_at" "date",
    "asset_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."certifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communication_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "contact_record_id" "uuid",
    "channel" "text" NOT NULL,
    "consent_status" "text" DEFAULT 'not_opted_in'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."communication_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."connector_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" NOT NULL,
    "connector_source_id" "uuid",
    "status" "text" DEFAULT 'queued'::"text",
    "external_source" "text",
    "result" "jsonb" DEFAULT '{}'::"jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."connector_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."connector_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" NOT NULL,
    "connector_type" "text" NOT NULL,
    "source_url" "text",
    "external_source" "text",
    "source_trust_score" numeric DEFAULT 50,
    "last_successful_import_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."connector_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_import_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "source" "text" NOT NULL,
    "status" "text" DEFAULT 'review_required'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_import_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "consent_status" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creator_activity_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "event_name" "text" NOT NULL,
    "route" "text",
    "product_area" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."creator_activity_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."creator_activity_events" IS 'First-party creator product activity events. Do not store secrets, payment card data, or sensitive private lyrics in metadata.';



CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "stripe_customer_id" "text" NOT NULL,
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."db_health_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "check_name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "score" numeric,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."db_health_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."db_health_snapshots" IS 'Stores database health check results created by local, CI, or trusted operations scripts.';



CREATE TABLE IF NOT EXISTS "public"."digital_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_name" "text" NOT NULL,
    "product_slug" "text",
    "product_type" "text" NOT NULL,
    "module_key" "text",
    "description" "text",
    "price_cents" integer DEFAULT 0 NOT NULL,
    "file_url" "text",
    "preview_content" "text",
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 99,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."digital_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "location_id" "uuid",
    "full_name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "entity_type" "public"."entity_type" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'setup_required'::"text" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entities" OWNER TO "postgres";


COMMENT ON TABLE "public"."entities" IS 'Four separated operating entities. Data is private by default and scoped by entity membership.';



CREATE TABLE IF NOT EXISTS "public"."entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" NOT NULL,
    "plan_key" "text" NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'inactive'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_action_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "proactive_action_id" "uuid" NOT NULL,
    "requested_by" "uuid",
    "approved_by" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "decision_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone
);


ALTER TABLE "public"."entity_action_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_action_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "proactive_action_id" "uuid",
    "run_type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "summary" "text",
    "logs_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_action_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_agent_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "memory_type" "text" NOT NULL,
    "memory_key" "text" NOT NULL,
    "memory_value" "text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_agent_memory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_agent_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "run_status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "run_goal" "text" NOT NULL,
    "plan_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "result_summary" "text",
    "logs_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "created_by" "uuid",
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_agent_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_agent_tool_registry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tool_name" "text" NOT NULL,
    "tool_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "requires_approval" boolean DEFAULT true NOT NULL,
    "config_json" "jsonb" DEFAULT '{"status": "setup_required"}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_agent_tool_registry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "agent_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'setup_required'::"text" NOT NULL,
    "permissions_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "config_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_agents" OWNER TO "postgres";


COMMENT ON TABLE "public"."entity_agents" IS 'Agent-ready registry. Unsupported external runtimes must remain setup_required.';



CREATE TABLE IF NOT EXISTS "public"."entity_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "action_summary" "text" NOT NULL,
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_automation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "automation_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "result_summary" "text",
    "logs_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_automation_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_automations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "schedule_cron" "text",
    "trigger_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'setup_required'::"text" NOT NULL,
    "action_template_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "requires_approval" boolean DEFAULT true NOT NULL,
    "last_run_at" timestamp with time zone,
    "next_run_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_automations" OWNER TO "postgres";


COMMENT ON TABLE "public"."entity_automations" IS 'Automation-ready schedules and triggers. Human approval is required for destructive or high-risk work.';



CREATE TABLE IF NOT EXISTS "public"."entity_browser_bookmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "url" "text" NOT NULL,
    "category" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_browser_bookmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_browser_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "start_url" "text",
    "current_url" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_browser_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."entity_browser_sessions" IS 'Internal browser-workspace state. Do not store credentials or scraped private data.';



CREATE TABLE IF NOT EXISTS "public"."entity_connector_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "connector_id" "uuid",
    "event_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_connector_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_connectors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "connector_type" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "status" "text" DEFAULT 'setup_required'::"text" NOT NULL,
    "config_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_connectors" OWNER TO "postgres";


COMMENT ON TABLE "public"."entity_connectors" IS 'Connector-ready records. Secrets must live only in environment or secret storage, never config_json.';



CREATE TABLE IF NOT EXISTS "public"."entity_health_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "total_score" numeric NOT NULL,
    "status" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_health_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_heartbeats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "heartbeat_type" "text" NOT NULL,
    "status" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "health_score" numeric,
    "message" "text" NOT NULL,
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_heartbeats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "severity" "text" DEFAULT 'warning'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."entity_member_role" DEFAULT 'viewer'::"public"."entity_member_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_proactive_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "proposed_by" "uuid",
    "assigned_to" "uuid",
    "due_at" timestamp with time zone,
    "requires_approval" boolean DEFAULT true NOT NULL,
    "approval_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_proactive_actions" OWNER TO "postgres";


COMMENT ON TABLE "public"."entity_proactive_actions" IS 'Approval-gated recommended actions. Destructive actions require owner/admin approval.';



CREATE TABLE IF NOT EXISTS "public"."entity_research_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_url" "text",
    "title" "text" NOT NULL,
    "note_body" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_research_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "settings_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "link_type" "text" NOT NULL,
    "url" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."external_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "key" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "owner_review_required" boolean DEFAULT true NOT NULL,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "feedback_type" "text" NOT NULL,
    "page_path" "text",
    "rating" integer,
    "message" "text" NOT NULL,
    "email" "text",
    "user_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "feedback_reports_feedback_type_check" CHECK (("feedback_type" = ANY (ARRAY['bug_report'::"text", 'feature_request'::"text", 'confusion_friction'::"text", 'pricing_feedback'::"text", 'mobile_issue'::"text", 'accessibility_issue'::"text", 'general_feedback'::"text"]))),
    CONSTRAINT "feedback_reports_rating_check" CHECK ((("rating" IS NULL) OR (("rating" >= 1) AND ("rating" <= 5))))
);


ALTER TABLE "public"."feedback_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedback_reports" IS 'Beta feedback reports for bugs, features, friction, pricing, mobile, accessibility, and general feedback.';



CREATE TABLE IF NOT EXISTS "public"."generated_outputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "module_key" "text",
    "output_type" "text" NOT NULL,
    "title" "text",
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."generated_outputs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repositories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "full_name" "text",
    "owner" "text",
    "repo_url" "text",
    "official_url" "text",
    "description" "text",
    "category" "text",
    "license" "text",
    "license_risk" "text" DEFAULT 'review_required'::"text",
    "commercial_use_status" "text" DEFAULT 'review_required'::"text",
    "integration_status" "text" DEFAULT 'reference_only'::"text",
    "production_status" "text" DEFAULT 'not_integrated'::"text",
    "recommended_action" "text",
    "product_fit" "text"[],
    "business_value" "text",
    "marketability_value" "text",
    "profitability_value" "text",
    "utility_value" "text",
    "implementation_difficulty" "text",
    "maintenance_status" "text" DEFAULT 'unknown'::"text",
    "security_status" "text" DEFAULT 'unknown'::"text",
    "privacy_status" "text" DEFAULT 'unknown'::"text",
    "cost_status" "text" DEFAULT 'unknown'::"text",
    "feature_flag" "text",
    "score" integer DEFAULT 0,
    "stars_count" integer,
    "forks_count" integer,
    "open_issues_count" integer,
    "last_pushed_at" timestamp with time zone,
    "latest_release" "text",
    "latest_release_at" timestamp with time zone,
    "owner_review_required" boolean DEFAULT true,
    "legal_review_required" boolean DEFAULT true,
    "security_review_required" boolean DEFAULT true,
    "privacy_review_required" boolean DEFAULT true,
    "blocked" boolean DEFAULT false,
    "blocked_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repositories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "risk_level" "text" DEFAULT 'medium'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_blocklist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repo_url" "text",
    "signal" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_blocklist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_business_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "business_value_score" integer DEFAULT 0 NOT NULL,
    "marketability_score" integer DEFAULT 0 NOT NULL,
    "profitability_score" integer DEFAULT 0 NOT NULL,
    "usability_score" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_business_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_codex_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "prompt" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_codex_prompts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "feature_flag" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_license_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "license_risk" "text" DEFAULT 'review_required'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_license_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_maintenance_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "maintenance_status" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_maintenance_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_privacy_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "privacy_status" "text" DEFAULT 'review_required'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_privacy_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_product_fit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "product_name" "text" NOT NULL,
    "fit_score" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_product_fit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "recommendation" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "reviewer_user_id" "uuid",
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_score_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "score" integer DEFAULT 0 NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_score_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_security_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "security_status" "text" DEFAULT 'review_required'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_security_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_sync_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" DEFAULT 'manual_mode'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_sync_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_update_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "event_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_update_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_repository_watchlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid",
    "watched_by_user_id" "uuid",
    "watch_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."github_repository_watchlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "name" "text" NOT NULL,
    "holiday_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."imported_feed_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'alertos'::"text",
    "alert_source_id" "uuid",
    "title" "text" NOT NULL,
    "body" "text",
    "external_source" "text",
    "source_url" "text",
    "status" "text" DEFAULT 'needs_review'::"text",
    "raw" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."imported_feed_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "title" "text" NOT NULL,
    "inspected_at" "date",
    "result" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inspections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_titles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "title" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_titles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."labor_cost_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "projected_sales" numeric,
    "labor_cost" numeric,
    "labor_percent" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."labor_cost_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."license_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid",
    "subject_name" "text" NOT NULL,
    "subject_url" "text",
    "license" "text",
    "risk_status" "text" DEFAULT 'review_required'::"text" NOT NULL,
    "reviewer_user_id" "uuid",
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."license_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_capture_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "media_type" "text" NOT NULL,
    "status" "text" DEFAULT 'review_required'::"text" NOT NULL,
    "storage_path" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."media_capture_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" NOT NULL,
    "asset_id" "uuid",
    "queue_name" "text" NOT NULL,
    "job_type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text",
    "idempotency_key" "text",
    "attempts" integer DEFAULT 0,
    "error" "text",
    "result" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."media_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "name" "text" NOT NULL,
    "price" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."module_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "module_key" "text",
    "rating" integer,
    "feedback_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "module_feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."module_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."module_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "module_key" "text",
    "input_payload" "jsonb" DEFAULT '{}'::"jsonb",
    "output_id" "uuid",
    "model_used" "text",
    "token_estimate" integer DEFAULT 0,
    "success" boolean DEFAULT true,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."module_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "company_key" "text" NOT NULL,
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "body" "text",
    "status" "text" DEFAULT 'queued'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."observability_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid",
    "actor_user_id" "uuid",
    "correlation_id" "text" NOT NULL,
    "event_name" "text" NOT NULL,
    "risk_level" "text" DEFAULT 'low'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."observability_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."open_source_tools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "category" "text" NOT NULL,
    "license" "text",
    "license_risk" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "commercial_use_status" "text" DEFAULT 'needs_review'::"text" NOT NULL,
    "integration_status" "text" DEFAULT 'not_reviewed'::"text" NOT NULL,
    "recommended_action" "text",
    "official_url" "text",
    "repo_url" "text",
    "safety_boundaries" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."open_source_tools" OWNER TO "postgres";


COMMENT ON TABLE "public"."open_source_tools" IS 'Governed external project intake candidates. A row does not mean code is copied, installed, or approved.';



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "stripe_price_id" "text",
    "brand" "text",
    "billing_type" "text",
    "amount" integer,
    "currency" "text" DEFAULT 'usd'::"text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_app_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" NOT NULL,
    "enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organization_app_access_company_key_check" CHECK (("company_key" = ANY (ARRAY['soundos'::"text", 'tableos'::"text", 'alertos'::"text", 'parent_admin'::"text"])))
);


ALTER TABLE "public"."organization_app_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'alertos'::"text",
    "title" "text" NOT NULL,
    "body" "text",
    "status" "text" DEFAULT 'pending_approval'::"text",
    "created_by" "uuid",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organization_broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organization_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'editor'::"text", 'viewer'::"text", 'billing_admin'::"text", 'security_admin'::"text"])))
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL
);


ALTER TABLE "public"."organization_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "legal_name" "text",
    "company_key" "text" NOT NULL,
    "industry" "text",
    "city" "text",
    "state" "text",
    "country" "text" DEFAULT 'US'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text",
    "owner_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "organizations_company_key_check" CHECK (("company_key" = ANY (ARRAY['soundos'::"text", 'tableos'::"text", 'alertos'::"text", 'parent_admin'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permission_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "permission_key" "text" NOT NULL,
    "action" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."permission_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permission_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "permission_key" "text" NOT NULL,
    "status" "text" DEFAULT 'not_requested'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."permission_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "title" "text" NOT NULL,
    "expires_at" "date",
    "asset_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."permits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phone_number_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "contact_record_id" "uuid",
    "phone" "text" NOT NULL,
    "consent_status" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."phone_number_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "output" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_jobs" IS 'Tracks optional Python/local/CI operations jobs such as exports, analytics, database audits, health checks, and readiness scans.';



CREATE TABLE IF NOT EXISTS "public"."prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_price_id" "text" NOT NULL,
    "stripe_product_id" "text",
    "lookup_key" "text" NOT NULL,
    "brand" "text" NOT NULL,
    "tier" "text",
    "billing_type" "text" NOT NULL,
    "amount" integer NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text", 'owner'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'soundos'::"text",
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promotions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "employee_id" "uuid",
    "new_title" "text",
    "effective_at" "date",
    "approval_status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."promotions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_key" "text",
    "template_name" "text" NOT NULL,
    "template_type" "text" NOT NULL,
    "system_prompt" "text" NOT NULL,
    "user_prompt_schema" "jsonb" DEFAULT '{}'::"jsonb",
    "output_format" "text" DEFAULT 'markdown'::"text",
    "is_active" boolean DEFAULT true,
    "is_premium" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."prompt_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_registry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "category" "text" NOT NULL,
    "risk_status" "text" DEFAULT 'review_required'::"text" NOT NULL,
    "integration_status" "text" DEFAULT 'not_configured'::"text" NOT NULL,
    "required_env" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "server_only_env" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "public_env" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "human_review_required" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."provider_registry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'alertos'::"text",
    "title" "text" NOT NULL,
    "body" "text",
    "severity" numeric DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "approved_by" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."public_alerts" OWNER TO "postgres";


COMMENT ON TABLE "public"."public_alerts" IS 'AlertOS public alerts require human approval before broadcast or mass delivery.';



CREATE TABLE IF NOT EXISTS "public"."public_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'alertos'::"text",
    "title" "text" NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "status" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."public_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qr_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "label" "text" NOT NULL,
    "target_url" "text" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(12), 'hex'::"text"),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."qr_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."raises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "employee_id" "uuid",
    "amount" numeric,
    "effective_at" "date",
    "approval_status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."raises" OWNER TO "postgres";


COMMENT ON TABLE "public"."raises" IS 'TableOS raise records are workflow records only; employment decisions require human approval.';



CREATE TABLE IF NOT EXISTS "public"."recipe_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "recipe_id" "uuid",
    "name" "text" NOT NULL,
    "quantity" numeric,
    "unit" "text",
    "unit_cost" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recipe_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "menu_item_id" "uuid",
    "name" "text" NOT NULL,
    "servings" numeric DEFAULT 1,
    "instructions" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."release_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "song_fingerprint_id" "uuid",
    "readiness_score" numeric NOT NULL,
    "launch_state" "text" NOT NULL,
    "blockers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "next_checks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "positioning" "text" NOT NULL,
    "hook" "text" NOT NULL,
    "rollout" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "export_assets" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "release_plans_launch_state_check" CHECK (("launch_state" = ANY (ARRAY['idea'::"text", 'demo'::"text", 'ready'::"text", 'hold'::"text"])))
);


ALTER TABLE "public"."release_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."releases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'soundos'::"text",
    "project_id" "uuid",
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'planned'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."releases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repairs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."repairs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."research_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "source_type" "text" NOT NULL,
    "source_url" "text",
    "permission_status" "text" DEFAULT 'needs_review'::"text" NOT NULL,
    "crawl_status" "text" DEFAULT 'disabled'::"text" NOT NULL,
    "crawl_depth" integer DEFAULT 1 NOT NULL,
    "rate_limit_note" "text",
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."research_sources" OWNER TO "postgres";


COMMENT ON TABLE "public"."research_sources" IS 'User-authorized or public research source intake records. Live crawling remains disabled until reviewed.';



CREATE TABLE IF NOT EXISTS "public"."restaurant_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "restaurant_id" "uuid",
    "name" "text" NOT NULL,
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."restaurant_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "name" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "location_id" "uuid",
    "starts_on" "date",
    "status" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "company_key" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text",
    "event_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid",
    "subject_name" "text" NOT NULL,
    "risk_status" "text" DEFAULT 'review_required'::"text" NOT NULL,
    "reviewer_user_id" "uuid",
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."security_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "repair_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "schedule_id" "uuid",
    "employee_id" "uuid",
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "role" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sonara_billing_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sonara_billing_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sonara_generation_history" (
    "id" "text" NOT NULL,
    "user_id" "uuid",
    "parent_id" "text",
    "project_id" "text",
    "engine_name" "text" NOT NULL,
    "engine_version" "text" NOT NULL,
    "input_hash" "text" NOT NULL,
    "input_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "settings_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "output_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "label" "text",
    "is_selected" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sonara_generation_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sonara_launch_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sonara_launch_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sonara_memory_records" (
    "id" "text" NOT NULL,
    "user_id" "uuid",
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "embedding" "public"."vector"(1536),
    CONSTRAINT "sonara_memory_records_kind_check" CHECK (("kind" = ANY (ARRAY['project'::"text", 'prompt'::"text", 'export'::"text", 'sound_asset'::"text", 'release_plan'::"text", 'authentic_writer_note'::"text", 'brand_doc'::"text", 'support_feedback'::"text", 'store_product'::"text", 'research_note'::"text"])))
);


ALTER TABLE "public"."sonara_memory_records" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sonara_memory_records"."embedding" IS 'Placeholder 1536-dimension vector. Final dimension must match the chosen embedding model.';



CREATE TABLE IF NOT EXISTS "public"."sonara_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "creator_name" "text",
    "notes" "text" NOT NULL,
    "fingerprint_id" "text" NOT NULL,
    "readiness_score" numeric NOT NULL,
    "launch_state" "text" NOT NULL,
    "analysis" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "project_type" "text" DEFAULT 'song'::"text" NOT NULL,
    "genre" "text",
    "subgenre" "text",
    CONSTRAINT "sonara_projects_launch_state_check" CHECK (("launch_state" = ANY (ARRAY['idea'::"text", 'demo'::"text", 'ready'::"text", 'hold'::"text"])))
);


ALTER TABLE "public"."sonara_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sonara_revenue_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "product_id" "uuid",
    "module_key" "text",
    "amount_cents" integer DEFAULT 0,
    "payment_provider" "text",
    "payment_status" "text" DEFAULT 'pending'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sonara_revenue_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sonara_sound_assets" (
    "id" "text" NOT NULL,
    "source_id" "text",
    "title" "text" NOT NULL,
    "license" "text" NOT NULL,
    "redistribution_category" "text" NOT NULL,
    "commercial_use_allowed" boolean DEFAULT false NOT NULL,
    "redistribution_allowed" boolean DEFAULT false NOT NULL,
    "attribution_required" boolean DEFAULT false NOT NULL,
    "source_url" "text" NOT NULL,
    "creator" "text" NOT NULL,
    "export_status" "text" NOT NULL,
    "proof_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_name" "text",
    "name" "text",
    "asset_type" "text",
    "genre_family" "text",
    "bpm" numeric,
    "musical_key" "text",
    "file_format" "text",
    "license_url" "text",
    "attribution_text" "text",
    "storage_path" "text",
    "preview_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "last_checked_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sonara_sound_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sonara_sound_sources" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "homepage" "text" NOT NULL,
    "default_category" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sonara_sound_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sonara_sound_sync_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" NOT NULL,
    "source_count" integer DEFAULT 0 NOT NULL,
    "asset_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sonara_sound_sync_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sonara_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "stripe_subscription_id" "text" NOT NULL,
    "tier" "text" NOT NULL,
    "status" "text" NOT NULL,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sonara_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sonara_user_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "tier" "text" DEFAULT 'free'::"text" NOT NULL,
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "last_event_type" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sonara_user_subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."sonara_user_subscriptions" IS 'Stores Stripe subscription state for SONARA One. Updates should be performed from server-only code using Supabase service role after Stripe webhook verification. Apply this manually in the Supabase SQL Editor if the Supabase CLI is not connected.';



COMMENT ON COLUMN "public"."sonara_user_subscriptions"."stripe_subscription_id" IS 'Stable Stripe subscription key used for idempotent webhook upserts.';



CREATE TABLE IF NOT EXISTS "public"."song_fingerprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "fingerprint_id" "text" NOT NULL,
    "song_title" "text" NOT NULL,
    "creator_name" "text",
    "identity" "text" NOT NULL,
    "mood" "text" NOT NULL,
    "audience_signal" "text" NOT NULL,
    "sonic_palette" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."song_fingerprints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."songs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'soundos'::"text",
    "artist_id" "uuid",
    "title" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."songs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."soundos_readiness_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'soundos'::"text",
    "project_id" "uuid",
    "score" numeric NOT NULL,
    "checks" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."soundos_readiness_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "thread_id" "uuid",
    "body" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."staff_chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_chat_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "title" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."staff_chat_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "employee_id" "uuid",
    "profile_image_asset_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."staff_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "stripe_customer_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stripe_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_events" (
    "id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb"
);


ALTER TABLE "public"."stripe_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_key" "text" NOT NULL,
    "plan_name" "text" NOT NULL,
    "price_cents" integer NOT NULL,
    "daily_generation_limit" integer NOT NULL,
    "monthly_generation_limit" integer NOT NULL,
    "features" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "tier" "text",
    "status" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "organization_name" "text",
    "category" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "urgency" "text" DEFAULT 'normal'::"text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "source_path" "text",
    "user_id" "uuid",
    "organization_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "support_requests_category_check" CHECK (("category" = ANY (ARRAY['general_question'::"text", 'sales_pricing'::"text", 'billing_refund'::"text", 'technical_support'::"text", 'security_report'::"text", 'legal_privacy'::"text", 'partnership'::"text"]))),
    CONSTRAINT "support_requests_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'triaged'::"text", 'in_review'::"text", 'waiting'::"text", 'closed'::"text"]))),
    CONSTRAINT "support_requests_urgency_check" CHECK (("urgency" = ANY (ARRAY['low'::"text", 'normal'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."support_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."support_requests" IS 'Public support and contact requests. Inserts are allowed; reads and management stay authenticated/server-side.';



CREATE TABLE IF NOT EXISTS "public"."system_audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "source" "text" NOT NULL,
    "actor_id" "uuid",
    "actor_email" "text",
    "entity_type" "text",
    "entity_id" "text",
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_audit_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_audit_events" IS 'System-level audit events for checkout, webhooks, database operations, exports, login, billing, and admin workflows.';



COMMENT ON COLUMN "public"."system_audit_events"."metadata" IS 'Operational metadata. Never store raw secrets, payment card data, or unredacted credentials.';



CREATE TABLE IF NOT EXISTS "public"."tool_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "open_source_tool_id" "uuid",
    "review_type" "text" NOT NULL,
    "status" "text" DEFAULT 'needs_review'::"text" NOT NULL,
    "reviewer_role" "text",
    "decision" "text",
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tool_reviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."tool_reviews" IS 'License, security, safety, commercial-use, maintenance, and product-fit review notes for external tools.';



CREATE TABLE IF NOT EXISTS "public"."transcription_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'soundos'::"text",
    "asset_id" "uuid",
    "status" "text" DEFAULT 'queued'::"text",
    "transcript" "text",
    "segments" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."transcription_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "employee_id" "uuid",
    "from_location_id" "uuid",
    "to_location_id" "uuid",
    "effective_at" "date",
    "approval_status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transit_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'alertos'::"text",
    "title" "text" NOT NULL,
    "route_id" "text",
    "status" "text" DEFAULT 'needs_review'::"text",
    "raw" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."transit_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."uploaded_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" NOT NULL,
    "bucket" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "asset_type" "text" NOT NULL,
    "original_filename" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "status" "text" DEFAULT 'created'::"text",
    "external_source" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."uploaded_assets" OWNER TO "postgres";


COMMENT ON TABLE "public"."uploaded_assets" IS 'Storage/media backups are separate from database backups.';



CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid",
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "unit_system" "text" DEFAULT 'imperial'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_preferences_unit_system_check" CHECK (("unit_system" = ANY (ARRAY['imperial'::"text", 'metric'::"text"])))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_name" "text" NOT NULL,
    "project_type" "text" NOT NULL,
    "module_key" "text",
    "description" "text",
    "saved_state" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_usage_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_name" "text" DEFAULT 'free'::"text",
    "daily_generation_limit" integer DEFAULT 3,
    "monthly_generation_limit" integer DEFAULT 50,
    "generations_used_today" integer DEFAULT 0,
    "generations_used_month" integer DEFAULT 0,
    "last_reset_date" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_usage_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendor_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "vendor_id" "uuid",
    "label" "text" NOT NULL,
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendor_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'tableos'::"text",
    "name" "text" NOT NULL,
    "contact" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voice_command_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "command_key" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "transcript_redacted" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."voice_command_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weather_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_key" "text" DEFAULT 'alertos'::"text",
    "title" "text" NOT NULL,
    "zone" "text",
    "status" "text" DEFAULT 'needs_review'::"text",
    "raw" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."weather_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid",
    "actor_user_id" "uuid",
    "workflow_key" "text" NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "approval_state" "text" DEFAULT 'not_required'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."workflow_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workspace_memberships_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."workspace_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agent_action_logs"
    ADD CONSTRAINT "agent_action_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alert_delivery_attempts"
    ADD CONSTRAINT "alert_delivery_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alert_sources"
    ADD CONSTRAINT "alert_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alert_subscriptions"
    ADD CONSTRAINT "alert_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alertos_trust_scores"
    ADD CONSTRAINT "alertos_trust_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."anti_repetition_checks"
    ADD CONSTRAINT "anti_repetition_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_scopes"
    ADD CONSTRAINT "app_scopes_org_id_company_key_scope_key" UNIQUE ("org_id", "company_key", "scope");



ALTER TABLE ONLY "public"."app_scopes"
    ADD CONSTRAINT "app_scopes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_queue"
    ADD CONSTRAINT "approval_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."artist_dna_profiles"
    ADD CONSTRAINT "artist_dna_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."artists"
    ADD CONSTRAINT "artists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audio_analysis"
    ADD CONSTRAINT "audio_analysis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."backup_runs"
    ADD CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_customers"
    ADD CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_customers"
    ADD CONSTRAINT "billing_customers_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."billing_events"
    ADD CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."business_modules"
    ADD CONSTRAINT "business_modules_module_key_key" UNIQUE ("module_key");



ALTER TABLE ONLY "public"."business_modules"
    ADD CONSTRAINT "business_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_sub_app_database_schemas"
    ADD CONSTRAINT "business_sub_app_database_schemas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_sub_app_deployments"
    ADD CONSTRAINT "business_sub_app_deployments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_sub_app_modules"
    ADD CONSTRAINT "business_sub_app_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_sub_app_pages"
    ADD CONSTRAINT "business_sub_app_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_sub_apps"
    ADD CONSTRAINT "business_sub_apps_organization_id_slug_key" UNIQUE ("organization_id", "slug");



ALTER TABLE ONLY "public"."business_sub_apps"
    ADD CONSTRAINT "business_sub_apps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_workspaces"
    ADD CONSTRAINT "business_workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certifications"
    ADD CONSTRAINT "certifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communication_preferences"
    ADD CONSTRAINT "communication_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connector_runs"
    ADD CONSTRAINT "connector_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connector_sources"
    ADD CONSTRAINT "connector_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_import_batches"
    ADD CONSTRAINT "contact_import_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_records"
    ADD CONSTRAINT "contact_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creator_activity_events"
    ADD CONSTRAINT "creator_activity_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."db_health_snapshots"
    ADD CONSTRAINT "db_health_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_products"
    ADD CONSTRAINT "digital_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_products"
    ADD CONSTRAINT "digital_products_product_slug_key" UNIQUE ("product_slug");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entities"
    ADD CONSTRAINT "entities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entities"
    ADD CONSTRAINT "entities_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."entitlements"
    ADD CONSTRAINT "entitlements_org_id_company_key_key" UNIQUE ("org_id", "company_key");



ALTER TABLE ONLY "public"."entitlements"
    ADD CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_action_approvals"
    ADD CONSTRAINT "entity_action_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_action_runs"
    ADD CONSTRAINT "entity_action_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_agent_memory"
    ADD CONSTRAINT "entity_agent_memory_entity_id_agent_id_memory_type_memory_k_key" UNIQUE ("entity_id", "agent_id", "memory_type", "memory_key");



ALTER TABLE ONLY "public"."entity_agent_memory"
    ADD CONSTRAINT "entity_agent_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_agent_runs"
    ADD CONSTRAINT "entity_agent_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_agent_tool_registry"
    ADD CONSTRAINT "entity_agent_tool_registry_entity_id_tool_name_key" UNIQUE ("entity_id", "tool_name");



ALTER TABLE ONLY "public"."entity_agent_tool_registry"
    ADD CONSTRAINT "entity_agent_tool_registry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_agents"
    ADD CONSTRAINT "entity_agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_audit_logs"
    ADD CONSTRAINT "entity_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_automation_runs"
    ADD CONSTRAINT "entity_automation_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_automations"
    ADD CONSTRAINT "entity_automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_browser_bookmarks"
    ADD CONSTRAINT "entity_browser_bookmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_browser_sessions"
    ADD CONSTRAINT "entity_browser_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_connector_events"
    ADD CONSTRAINT "entity_connector_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_connectors"
    ADD CONSTRAINT "entity_connectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_health_snapshots"
    ADD CONSTRAINT "entity_health_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_heartbeats"
    ADD CONSTRAINT "entity_heartbeats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_incidents"
    ADD CONSTRAINT "entity_incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_memberships"
    ADD CONSTRAINT "entity_memberships_entity_id_user_id_key" UNIQUE ("entity_id", "user_id");



ALTER TABLE ONLY "public"."entity_memberships"
    ADD CONSTRAINT "entity_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_proactive_actions"
    ADD CONSTRAINT "entity_proactive_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_research_notes"
    ADD CONSTRAINT "entity_research_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_settings"
    ADD CONSTRAINT "entity_settings_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "public"."entity_settings"
    ADD CONSTRAINT "entity_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_links"
    ADD CONSTRAINT "external_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_reports"
    ADD CONSTRAINT "feedback_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generated_outputs"
    ADD CONSTRAINT "generated_outputs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repositories"
    ADD CONSTRAINT "github_repositories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repositories"
    ADD CONSTRAINT "github_repositories_repo_url_key" UNIQUE ("repo_url");



ALTER TABLE ONLY "public"."github_repository_audit_logs"
    ADD CONSTRAINT "github_repository_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_blocklist"
    ADD CONSTRAINT "github_repository_blocklist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_business_reviews"
    ADD CONSTRAINT "github_repository_business_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_categories"
    ADD CONSTRAINT "github_repository_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_codex_prompts"
    ADD CONSTRAINT "github_repository_codex_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_feature_flags"
    ADD CONSTRAINT "github_repository_feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_license_reviews"
    ADD CONSTRAINT "github_repository_license_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_maintenance_reviews"
    ADD CONSTRAINT "github_repository_maintenance_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_privacy_reviews"
    ADD CONSTRAINT "github_repository_privacy_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_product_fit"
    ADD CONSTRAINT "github_repository_product_fit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_recommendations"
    ADD CONSTRAINT "github_repository_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_reviews"
    ADD CONSTRAINT "github_repository_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_score_history"
    ADD CONSTRAINT "github_repository_score_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_security_reviews"
    ADD CONSTRAINT "github_repository_security_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_sync_jobs"
    ADD CONSTRAINT "github_repository_sync_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_update_events"
    ADD CONSTRAINT "github_repository_update_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_repository_watchlist"
    ADD CONSTRAINT "github_repository_watchlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."imported_feed_items"
    ADD CONSTRAINT "imported_feed_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_titles"
    ADD CONSTRAINT "job_titles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."labor_cost_snapshots"
    ADD CONSTRAINT "labor_cost_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."license_reviews"
    ADD CONSTRAINT "license_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_capture_records"
    ADD CONSTRAINT "media_capture_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_jobs"
    ADD CONSTRAINT "media_jobs_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."media_jobs"
    ADD CONSTRAINT "media_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."module_feedback"
    ADD CONSTRAINT "module_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."module_runs"
    ADD CONSTRAINT "module_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observability_events"
    ADD CONSTRAINT "observability_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."open_source_tools"
    ADD CONSTRAINT "open_source_tools_organization_id_slug_key" UNIQUE ("organization_id", "slug");



ALTER TABLE ONLY "public"."open_source_tools"
    ADD CONSTRAINT "open_source_tools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_stripe_checkout_session_id_key" UNIQUE ("stripe_checkout_session_id");



ALTER TABLE ONLY "public"."organization_app_access"
    ADD CONSTRAINT "organization_app_access_org_id_company_key_key" UNIQUE ("org_id", "company_key");



ALTER TABLE ONLY "public"."organization_app_access"
    ADD CONSTRAINT "organization_app_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_broadcasts"
    ADD CONSTRAINT "organization_broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_org_id_user_id_key" UNIQUE ("org_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permission_audit_logs"
    ADD CONSTRAINT "permission_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permission_grants"
    ADD CONSTRAINT "permission_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permits"
    ADD CONSTRAINT "permits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."phone_number_records"
    ADD CONSTRAINT "phone_number_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_jobs"
    ADD CONSTRAINT "platform_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prices"
    ADD CONSTRAINT "prices_lookup_key_key" UNIQUE ("lookup_key");



ALTER TABLE ONLY "public"."prices"
    ADD CONSTRAINT "prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prices"
    ADD CONSTRAINT "prices_stripe_price_id_key" UNIQUE ("stripe_price_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_templates"
    ADD CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_registry"
    ADD CONSTRAINT "provider_registry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_registry"
    ADD CONSTRAINT "provider_registry_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."public_alerts"
    ADD CONSTRAINT "public_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_events"
    ADD CONSTRAINT "public_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_links"
    ADD CONSTRAINT "qr_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_links"
    ADD CONSTRAINT "qr_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."raises"
    ADD CONSTRAINT "raises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."release_plans"
    ADD CONSTRAINT "release_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."releases"
    ADD CONSTRAINT "releases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repairs"
    ADD CONSTRAINT "repairs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."research_sources"
    ADD CONSTRAINT "research_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_locations"
    ADD CONSTRAINT "restaurant_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_reviews"
    ADD CONSTRAINT "security_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_records"
    ADD CONSTRAINT "service_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_billing_customers"
    ADD CONSTRAINT "sonara_billing_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_billing_customers"
    ADD CONSTRAINT "sonara_billing_customers_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."sonara_generation_history"
    ADD CONSTRAINT "sonara_generation_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_launch_settings"
    ADD CONSTRAINT "sonara_launch_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_launch_settings"
    ADD CONSTRAINT "sonara_launch_settings_setting_key_key" UNIQUE ("setting_key");



ALTER TABLE ONLY "public"."sonara_memory_records"
    ADD CONSTRAINT "sonara_memory_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_projects"
    ADD CONSTRAINT "sonara_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_revenue_events"
    ADD CONSTRAINT "sonara_revenue_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_sound_assets"
    ADD CONSTRAINT "sonara_sound_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_sound_sources"
    ADD CONSTRAINT "sonara_sound_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_sound_sync_runs"
    ADD CONSTRAINT "sonara_sound_sync_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_subscriptions"
    ADD CONSTRAINT "sonara_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_subscriptions"
    ADD CONSTRAINT "sonara_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."sonara_user_subscriptions"
    ADD CONSTRAINT "sonara_user_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_user_subscriptions"
    ADD CONSTRAINT "sonara_user_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."song_fingerprints"
    ADD CONSTRAINT "song_fingerprints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."soundos_readiness_scores"
    ADD CONSTRAINT "soundos_readiness_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_chat_messages"
    ADD CONSTRAINT "staff_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_chat_threads"
    ADD CONSTRAINT "staff_chat_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_plan_key_key" UNIQUE ("plan_key");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_audit_events"
    ADD CONSTRAINT "system_audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tool_reviews"
    ADD CONSTRAINT "tool_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transcription_jobs"
    ADD CONSTRAINT "transcription_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transfers"
    ADD CONSTRAINT "transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transit_updates"
    ADD CONSTRAINT "transit_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."uploaded_assets"
    ADD CONSTRAINT "uploaded_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_projects"
    ADD CONSTRAINT "user_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_usage_limits"
    ADD CONSTRAINT "user_usage_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_links"
    ADD CONSTRAINT "vendor_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_command_logs"
    ADD CONSTRAINT "voice_command_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weather_alerts"
    ADD CONSTRAINT "weather_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_runs"
    ADD CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_unique_user" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_slug_key" UNIQUE ("slug");



CREATE INDEX "agent_action_logs_org_created_idx" ON "public"."agent_action_logs" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "audit_events_org_idx" ON "public"."audit_events" USING "btree" ("organization_id");



CREATE INDEX "audit_logs_org_company_created_idx" ON "public"."audit_logs" USING "btree" ("org_id", "company_key", "created_at" DESC);



CREATE INDEX "business_sub_app_database_schemas_org_idx" ON "public"."business_sub_app_database_schemas" USING "btree" ("organization_id");



CREATE INDEX "business_sub_app_deployments_org_idx" ON "public"."business_sub_app_deployments" USING "btree" ("organization_id");



CREATE INDEX "business_sub_app_modules_org_idx" ON "public"."business_sub_app_modules" USING "btree" ("organization_id");



CREATE INDEX "business_sub_app_pages_org_idx" ON "public"."business_sub_app_pages" USING "btree" ("organization_id");



CREATE INDEX "business_sub_apps_org_idx" ON "public"."business_sub_apps" USING "btree" ("organization_id");



CREATE INDEX "business_workspaces_org_idx" ON "public"."business_workspaces" USING "btree" ("organization_id");



CREATE INDEX "communication_preferences_org_idx" ON "public"."communication_preferences" USING "btree" ("organization_id");



CREATE INDEX "connector_runs_org_company_status_idx" ON "public"."connector_runs" USING "btree" ("org_id", "company_key", "status", "created_at" DESC);



CREATE INDEX "contact_import_batches_org_idx" ON "public"."contact_import_batches" USING "btree" ("organization_id");



CREATE INDEX "contact_records_org_idx" ON "public"."contact_records" USING "btree" ("organization_id");



CREATE INDEX "creator_activity_events_created_at_idx" ON "public"."creator_activity_events" USING "btree" ("created_at" DESC);



CREATE INDEX "creator_activity_events_event_name_idx" ON "public"."creator_activity_events" USING "btree" ("event_name");



CREATE INDEX "creator_activity_events_product_area_idx" ON "public"."creator_activity_events" USING "btree" ("product_area");



CREATE INDEX "creator_activity_events_route_idx" ON "public"."creator_activity_events" USING "btree" ("route");



CREATE INDEX "creator_activity_events_user_id_idx" ON "public"."creator_activity_events" USING "btree" ("user_id");



CREATE INDEX "db_health_snapshots_check_name_idx" ON "public"."db_health_snapshots" USING "btree" ("check_name");



CREATE INDEX "db_health_snapshots_created_at_idx" ON "public"."db_health_snapshots" USING "btree" ("created_at" DESC);



CREATE INDEX "db_health_snapshots_status_idx" ON "public"."db_health_snapshots" USING "btree" ("status");



CREATE INDEX "entities_entity_type_idx" ON "public"."entities" USING "btree" ("entity_type");



CREATE INDEX "entities_slug_idx" ON "public"."entities" USING "btree" ("slug");



CREATE INDEX "entity_action_runs_entity_idx" ON "public"."entity_action_runs" USING "btree" ("entity_id", "started_at" DESC);



CREATE INDEX "entity_agent_runs_entity_idx" ON "public"."entity_agent_runs" USING "btree" ("entity_id", "started_at" DESC);



CREATE INDEX "entity_agents_entity_idx" ON "public"."entity_agents" USING "btree" ("entity_id", "status");



CREATE INDEX "entity_audit_logs_created_at_idx" ON "public"."entity_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "entity_audit_logs_entity_id_idx" ON "public"."entity_audit_logs" USING "btree" ("entity_id");



CREATE INDEX "entity_automations_entity_idx" ON "public"."entity_automations" USING "btree" ("entity_id", "status");



CREATE INDEX "entity_browser_bookmarks_entity_idx" ON "public"."entity_browser_bookmarks" USING "btree" ("entity_id", "created_at" DESC);



CREATE INDEX "entity_browser_sessions_entity_idx" ON "public"."entity_browser_sessions" USING "btree" ("entity_id", "updated_at" DESC);



CREATE INDEX "entity_connector_events_entity_idx" ON "public"."entity_connector_events" USING "btree" ("entity_id", "created_at" DESC);



CREATE INDEX "entity_connectors_entity_idx" ON "public"."entity_connectors" USING "btree" ("entity_id", "status");



CREATE INDEX "entity_heartbeats_entity_idx" ON "public"."entity_heartbeats" USING "btree" ("entity_id", "checked_at" DESC);



CREATE INDEX "entity_incidents_entity_idx" ON "public"."entity_incidents" USING "btree" ("entity_id", "opened_at" DESC);



CREATE INDEX "entity_memberships_entity_id_idx" ON "public"."entity_memberships" USING "btree" ("entity_id");



CREATE INDEX "entity_memberships_user_id_idx" ON "public"."entity_memberships" USING "btree" ("user_id");



CREATE INDEX "entity_proactive_actions_entity_idx" ON "public"."entity_proactive_actions" USING "btree" ("entity_id", "priority", "status");



CREATE INDEX "entity_research_notes_entity_idx" ON "public"."entity_research_notes" USING "btree" ("entity_id", "created_at" DESC);



CREATE INDEX "feature_flags_key_idx" ON "public"."feature_flags" USING "btree" ("key");



CREATE INDEX "feedback_reports_created_at_idx" ON "public"."feedback_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "feedback_reports_type_idx" ON "public"."feedback_reports" USING "btree" ("feedback_type");



CREATE INDEX "github_repositories_blocked_idx" ON "public"."github_repositories" USING "btree" ("blocked");



CREATE INDEX "github_repositories_repo_url_idx" ON "public"."github_repositories" USING "btree" ("repo_url");



CREATE INDEX "github_repositories_score_idx" ON "public"."github_repositories" USING "btree" ("score");



CREATE INDEX "github_repository_audit_logs_repo_idx" ON "public"."github_repository_audit_logs" USING "btree" ("repository_id");



CREATE INDEX "github_repository_reviews_repo_idx" ON "public"."github_repository_reviews" USING "btree" ("repository_id");



CREATE INDEX "github_repository_sync_jobs_status_idx" ON "public"."github_repository_sync_jobs" USING "btree" ("status");



CREATE INDEX "imported_feed_items_external_source_idx" ON "public"."imported_feed_items" USING "btree" ("external_source", "status", "created_at" DESC);



CREATE INDEX "license_reviews_org_idx" ON "public"."license_reviews" USING "btree" ("organization_id");



CREATE INDEX "media_capture_records_org_idx" ON "public"."media_capture_records" USING "btree" ("organization_id");



CREATE INDEX "media_jobs_org_company_status_idx" ON "public"."media_jobs" USING "btree" ("org_id", "company_key", "status");



CREATE INDEX "observability_events_org_created_idx" ON "public"."observability_events" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "org_members_org_user_idx" ON "public"."organization_members" USING "btree" ("org_id", "user_id");



CREATE INDEX "organization_memberships_organization_id_idx" ON "public"."organization_memberships" USING "btree" ("organization_id");



CREATE INDEX "organization_memberships_status_idx" ON "public"."organization_memberships" USING "btree" ("status");



CREATE INDEX "organization_memberships_user_id_idx" ON "public"."organization_memberships" USING "btree" ("user_id");



CREATE INDEX "organizations_company_created_idx" ON "public"."organizations" USING "btree" ("company_key", "created_at" DESC);



CREATE UNIQUE INDEX "organizations_slug_unique_idx" ON "public"."organizations" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "permission_audit_logs_org_idx" ON "public"."permission_audit_logs" USING "btree" ("organization_id");



CREATE INDEX "permission_grants_org_idx" ON "public"."permission_grants" USING "btree" ("organization_id");



CREATE INDEX "phone_number_records_org_idx" ON "public"."phone_number_records" USING "btree" ("organization_id");



CREATE INDEX "platform_jobs_created_at_idx" ON "public"."platform_jobs" USING "btree" ("created_at" DESC);



CREATE INDEX "platform_jobs_job_type_idx" ON "public"."platform_jobs" USING "btree" ("job_type");



CREATE INDEX "platform_jobs_priority_idx" ON "public"."platform_jobs" USING "btree" ("priority");



CREATE INDEX "platform_jobs_status_idx" ON "public"."platform_jobs" USING "btree" ("status");



CREATE INDEX "provider_registry_slug_idx" ON "public"."provider_registry" USING "btree" ("slug");



CREATE INDEX "security_reviews_org_idx" ON "public"."security_reviews" USING "btree" ("organization_id");



CREATE INDEX "sonara_generation_history_created_at_idx" ON "public"."sonara_generation_history" USING "btree" ("created_at");



CREATE INDEX "sonara_generation_history_engine_name_idx" ON "public"."sonara_generation_history" USING "btree" ("engine_name");



CREATE INDEX "sonara_generation_history_input_hash_idx" ON "public"."sonara_generation_history" USING "btree" ("input_hash");



CREATE INDEX "sonara_generation_history_project_id_idx" ON "public"."sonara_generation_history" USING "btree" ("project_id");



CREATE INDEX "sonara_generation_history_user_id_idx" ON "public"."sonara_generation_history" USING "btree" ("user_id");



CREATE INDEX "sonara_memory_records_kind_idx" ON "public"."sonara_memory_records" USING "btree" ("kind");



CREATE INDEX "sonara_memory_records_user_kind_idx" ON "public"."sonara_memory_records" USING "btree" ("user_id", "kind", "updated_at" DESC);



CREATE INDEX "sonara_projects_owner_updated_idx" ON "public"."sonara_projects" USING "btree" ("owner_id", "updated_at" DESC);



CREATE INDEX "sonara_projects_user_updated_idx" ON "public"."sonara_projects" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "sonara_sound_assets_asset_type_idx" ON "public"."sonara_sound_assets" USING "btree" ("asset_type");



CREATE INDEX "sonara_sound_assets_bpm_idx" ON "public"."sonara_sound_assets" USING "btree" ("bpm");



CREATE INDEX "sonara_sound_assets_export_status_idx" ON "public"."sonara_sound_assets" USING "btree" ("export_status");



CREATE INDEX "sonara_sound_assets_genre_family_idx" ON "public"."sonara_sound_assets" USING "btree" ("genre_family");



CREATE INDEX "sonara_sound_assets_license_idx" ON "public"."sonara_sound_assets" USING "btree" ("license");



CREATE INDEX "sonara_sound_assets_musical_key_idx" ON "public"."sonara_sound_assets" USING "btree" ("musical_key");



CREATE INDEX "sonara_sound_assets_redistribution_category_idx" ON "public"."sonara_sound_assets" USING "btree" ("redistribution_category");



CREATE INDEX "sonara_sound_assets_source_id_idx" ON "public"."sonara_sound_assets" USING "btree" ("source_id");



CREATE INDEX "sonara_user_subscriptions_customer_idx" ON "public"."sonara_user_subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "sonara_user_subscriptions_status_idx" ON "public"."sonara_user_subscriptions" USING "btree" ("status");



CREATE INDEX "sonara_user_subscriptions_stripe_customer_id_idx" ON "public"."sonara_user_subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "sonara_user_subscriptions_stripe_subscription_id_idx" ON "public"."sonara_user_subscriptions" USING "btree" ("stripe_subscription_id");



CREATE UNIQUE INDEX "sonara_user_subscriptions_stripe_subscription_id_unique_idx" ON "public"."sonara_user_subscriptions" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);



CREATE INDEX "sonara_user_subscriptions_subscription_idx" ON "public"."sonara_user_subscriptions" USING "btree" ("stripe_subscription_id");



CREATE INDEX "sonara_user_subscriptions_tier_idx" ON "public"."sonara_user_subscriptions" USING "btree" ("tier");



CREATE INDEX "sonara_user_subscriptions_user_id_idx" ON "public"."sonara_user_subscriptions" USING "btree" ("user_id");



CREATE INDEX "sonara_user_subscriptions_user_idx" ON "public"."sonara_user_subscriptions" USING "btree" ("user_id");



CREATE INDEX "support_requests_category_idx" ON "public"."support_requests" USING "btree" ("category");



CREATE INDEX "support_requests_created_at_idx" ON "public"."support_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "support_requests_status_idx" ON "public"."support_requests" USING "btree" ("status");



CREATE INDEX "system_audit_events_actor_id_idx" ON "public"."system_audit_events" USING "btree" ("actor_id");



CREATE INDEX "system_audit_events_created_at_idx" ON "public"."system_audit_events" USING "btree" ("created_at" DESC);



CREATE INDEX "system_audit_events_event_type_idx" ON "public"."system_audit_events" USING "btree" ("event_type");



CREATE INDEX "system_audit_events_severity_idx" ON "public"."system_audit_events" USING "btree" ("severity");



CREATE INDEX "system_audit_events_source_idx" ON "public"."system_audit_events" USING "btree" ("source");



CREATE INDEX "uploaded_assets_org_company_created_idx" ON "public"."uploaded_assets" USING "btree" ("org_id", "company_key", "created_at" DESC);



CREATE INDEX "voice_command_logs_org_idx" ON "public"."voice_command_logs" USING "btree" ("organization_id");



CREATE INDEX "workflow_runs_org_status_idx" ON "public"."workflow_runs" USING "btree" ("organization_id", "status");



CREATE OR REPLACE TRIGGER "audit_row_change_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."billing_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."connector_sources" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."media_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."organization_app_access" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."organization_broadcasts" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."promotions" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."public_alerts" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."raises" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."transfers" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."uploaded_assets" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "set_entities_updated_at" BEFORE UPDATE ON "public"."entities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_entity_agent_memory_updated_at" BEFORE UPDATE ON "public"."entity_agent_memory" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_entity_agent_tool_registry_updated_at" BEFORE UPDATE ON "public"."entity_agent_tool_registry" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_entity_agents_updated_at" BEFORE UPDATE ON "public"."entity_agents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_entity_automations_updated_at" BEFORE UPDATE ON "public"."entity_automations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_entity_browser_bookmarks_updated_at" BEFORE UPDATE ON "public"."entity_browser_bookmarks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_entity_browser_sessions_updated_at" BEFORE UPDATE ON "public"."entity_browser_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_entity_connectors_updated_at" BEFORE UPDATE ON "public"."entity_connectors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_entity_memberships_updated_at" BEFORE UPDATE ON "public"."entity_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_entity_proactive_actions_updated_at" BEFORE UPDATE ON "public"."entity_proactive_actions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_entity_research_notes_updated_at" BEFORE UPDATE ON "public"."entity_research_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_entity_settings_updated_at" BEFORE UPDATE ON "public"."entity_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_jobs_updated_at" BEFORE UPDATE ON "public"."platform_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."alert_delivery_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."alert_sources" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."alert_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."alertos_trust_scores" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."approval_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."artist_dna_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."artists" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."audio_analysis" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."billing_customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."billing_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."certifications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."connector_runs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."connector_sources" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."external_links" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."holidays" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."imported_feed_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."inspections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."job_titles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."media_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."organization_broadcasts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."permits" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."promotions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."public_alerts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."public_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."qr_links" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."raises" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."recipe_ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."recipes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."releases" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."repairs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."restaurant_locations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."service_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."shifts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."songs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."staff_chat_threads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."staff_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."transcription_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."transfers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."transit_updates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."uploaded_assets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."vendor_links" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."vendors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_trigger" BEFORE UPDATE ON "public"."weather_alerts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_user_preferences_updated_at" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_workspace_memberships_updated_at" BEFORE UPDATE ON "public"."workspace_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_workspaces_updated_at" BEFORE UPDATE ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."agent_action_logs"
    ADD CONSTRAINT "agent_action_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agent_action_logs"
    ADD CONSTRAINT "agent_action_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_delivery_attempts"
    ADD CONSTRAINT "alert_delivery_attempts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_delivery_attempts"
    ADD CONSTRAINT "alert_delivery_attempts_public_alert_id_fkey" FOREIGN KEY ("public_alert_id") REFERENCES "public"."public_alerts"("id");



ALTER TABLE ONLY "public"."alert_sources"
    ADD CONSTRAINT "alert_sources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."alert_sources"
    ADD CONSTRAINT "alert_sources_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_subscriptions"
    ADD CONSTRAINT "alert_subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_subscriptions"
    ADD CONSTRAINT "alert_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."alertos_trust_scores"
    ADD CONSTRAINT "alertos_trust_scores_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alertos_trust_scores"
    ADD CONSTRAINT "alertos_trust_scores_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."alert_sources"("id");



ALTER TABLE ONLY "public"."anti_repetition_checks"
    ADD CONSTRAINT "anti_repetition_checks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anti_repetition_checks"
    ADD CONSTRAINT "anti_repetition_checks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."app_scopes"
    ADD CONSTRAINT "app_scopes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_queue"
    ADD CONSTRAINT "approval_queue_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."approval_queue"
    ADD CONSTRAINT "approval_queue_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_queue"
    ADD CONSTRAINT "approval_queue_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."artist_dna_profiles"
    ADD CONSTRAINT "artist_dna_profiles_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."artist_dna_profiles"
    ADD CONSTRAINT "artist_dna_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."artist_dna_profiles"
    ADD CONSTRAINT "artist_dna_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."artists"
    ADD CONSTRAINT "artists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."artists"
    ADD CONSTRAINT "artists_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audio_analysis"
    ADD CONSTRAINT "audio_analysis_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."uploaded_assets"("id");



ALTER TABLE ONLY "public"."audio_analysis"
    ADD CONSTRAINT "audio_analysis_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."backup_runs"
    ADD CONSTRAINT "backup_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_customers"
    ADD CONSTRAINT "billing_customers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_events"
    ADD CONSTRAINT "billing_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sub_app_database_schemas"
    ADD CONSTRAINT "business_sub_app_database_schemas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sub_app_database_schemas"
    ADD CONSTRAINT "business_sub_app_database_schemas_sub_app_id_fkey" FOREIGN KEY ("sub_app_id") REFERENCES "public"."business_sub_apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sub_app_deployments"
    ADD CONSTRAINT "business_sub_app_deployments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sub_app_deployments"
    ADD CONSTRAINT "business_sub_app_deployments_sub_app_id_fkey" FOREIGN KEY ("sub_app_id") REFERENCES "public"."business_sub_apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sub_app_modules"
    ADD CONSTRAINT "business_sub_app_modules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sub_app_modules"
    ADD CONSTRAINT "business_sub_app_modules_sub_app_id_fkey" FOREIGN KEY ("sub_app_id") REFERENCES "public"."business_sub_apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sub_app_pages"
    ADD CONSTRAINT "business_sub_app_pages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sub_app_pages"
    ADD CONSTRAINT "business_sub_app_pages_sub_app_id_fkey" FOREIGN KEY ("sub_app_id") REFERENCES "public"."business_sub_apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sub_apps"
    ADD CONSTRAINT "business_sub_apps_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_sub_apps"
    ADD CONSTRAINT "business_sub_apps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sub_apps"
    ADD CONSTRAINT "business_sub_apps_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."business_workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_workspaces"
    ADD CONSTRAINT "business_workspaces_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_workspaces"
    ADD CONSTRAINT "business_workspaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certifications"
    ADD CONSTRAINT "certifications_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."uploaded_assets"("id");



ALTER TABLE ONLY "public"."certifications"
    ADD CONSTRAINT "certifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."certifications"
    ADD CONSTRAINT "certifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."communication_preferences"
    ADD CONSTRAINT "communication_preferences_contact_record_id_fkey" FOREIGN KEY ("contact_record_id") REFERENCES "public"."contact_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."communication_preferences"
    ADD CONSTRAINT "communication_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connector_runs"
    ADD CONSTRAINT "connector_runs_connector_source_id_fkey" FOREIGN KEY ("connector_source_id") REFERENCES "public"."connector_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connector_runs"
    ADD CONSTRAINT "connector_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connector_sources"
    ADD CONSTRAINT "connector_sources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."connector_sources"
    ADD CONSTRAINT "connector_sources_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_import_batches"
    ADD CONSTRAINT "contact_import_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contact_import_batches"
    ADD CONSTRAINT "contact_import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_records"
    ADD CONSTRAINT "contact_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contact_records"
    ADD CONSTRAINT "contact_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."digital_products"
    ADD CONSTRAINT "digital_products_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."business_modules"("module_key");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."restaurant_locations"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entitlements"
    ADD CONSTRAINT "entitlements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_action_approvals"
    ADD CONSTRAINT "entity_action_approvals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_action_approvals"
    ADD CONSTRAINT "entity_action_approvals_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_action_approvals"
    ADD CONSTRAINT "entity_action_approvals_proactive_action_id_fkey" FOREIGN KEY ("proactive_action_id") REFERENCES "public"."entity_proactive_actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_action_approvals"
    ADD CONSTRAINT "entity_action_approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_action_runs"
    ADD CONSTRAINT "entity_action_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_action_runs"
    ADD CONSTRAINT "entity_action_runs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_action_runs"
    ADD CONSTRAINT "entity_action_runs_proactive_action_id_fkey" FOREIGN KEY ("proactive_action_id") REFERENCES "public"."entity_proactive_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_agent_memory"
    ADD CONSTRAINT "entity_agent_memory_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."entity_agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_agent_memory"
    ADD CONSTRAINT "entity_agent_memory_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_agent_runs"
    ADD CONSTRAINT "entity_agent_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."entity_agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_agent_runs"
    ADD CONSTRAINT "entity_agent_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_agent_runs"
    ADD CONSTRAINT "entity_agent_runs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_agent_tool_registry"
    ADD CONSTRAINT "entity_agent_tool_registry_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_agents"
    ADD CONSTRAINT "entity_agents_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_audit_logs"
    ADD CONSTRAINT "entity_audit_logs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_audit_logs"
    ADD CONSTRAINT "entity_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_automation_runs"
    ADD CONSTRAINT "entity_automation_runs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."entity_automations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_automation_runs"
    ADD CONSTRAINT "entity_automation_runs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_automations"
    ADD CONSTRAINT "entity_automations_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_browser_bookmarks"
    ADD CONSTRAINT "entity_browser_bookmarks_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_browser_bookmarks"
    ADD CONSTRAINT "entity_browser_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_browser_sessions"
    ADD CONSTRAINT "entity_browser_sessions_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_browser_sessions"
    ADD CONSTRAINT "entity_browser_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_connector_events"
    ADD CONSTRAINT "entity_connector_events_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "public"."entity_connectors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_connector_events"
    ADD CONSTRAINT "entity_connector_events_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_connectors"
    ADD CONSTRAINT "entity_connectors_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_health_snapshots"
    ADD CONSTRAINT "entity_health_snapshots_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_heartbeats"
    ADD CONSTRAINT "entity_heartbeats_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_incidents"
    ADD CONSTRAINT "entity_incidents_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_memberships"
    ADD CONSTRAINT "entity_memberships_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_memberships"
    ADD CONSTRAINT "entity_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_proactive_actions"
    ADD CONSTRAINT "entity_proactive_actions_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_proactive_actions"
    ADD CONSTRAINT "entity_proactive_actions_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_proactive_actions"
    ADD CONSTRAINT "entity_proactive_actions_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_research_notes"
    ADD CONSTRAINT "entity_research_notes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_research_notes"
    ADD CONSTRAINT "entity_research_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_settings"
    ADD CONSTRAINT "entity_settings_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_links"
    ADD CONSTRAINT "external_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."external_links"
    ADD CONSTRAINT "external_links_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_reports"
    ADD CONSTRAINT "feedback_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."generated_outputs"
    ADD CONSTRAINT "generated_outputs_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."business_modules"("module_key");



ALTER TABLE ONLY "public"."generated_outputs"
    ADD CONSTRAINT "generated_outputs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."user_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_audit_logs"
    ADD CONSTRAINT "github_repository_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."github_repository_audit_logs"
    ADD CONSTRAINT "github_repository_audit_logs_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."github_repository_business_reviews"
    ADD CONSTRAINT "github_repository_business_reviews_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_categories"
    ADD CONSTRAINT "github_repository_categories_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_codex_prompts"
    ADD CONSTRAINT "github_repository_codex_prompts_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_feature_flags"
    ADD CONSTRAINT "github_repository_feature_flags_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_license_reviews"
    ADD CONSTRAINT "github_repository_license_reviews_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_maintenance_reviews"
    ADD CONSTRAINT "github_repository_maintenance_reviews_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_privacy_reviews"
    ADD CONSTRAINT "github_repository_privacy_reviews_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_product_fit"
    ADD CONSTRAINT "github_repository_product_fit_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_recommendations"
    ADD CONSTRAINT "github_repository_recommendations_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_reviews"
    ADD CONSTRAINT "github_repository_reviews_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_reviews"
    ADD CONSTRAINT "github_repository_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."github_repository_score_history"
    ADD CONSTRAINT "github_repository_score_history_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_security_reviews"
    ADD CONSTRAINT "github_repository_security_reviews_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_update_events"
    ADD CONSTRAINT "github_repository_update_events_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_watchlist"
    ADD CONSTRAINT "github_repository_watchlist_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_repository_watchlist"
    ADD CONSTRAINT "github_repository_watchlist_watched_by_user_id_fkey" FOREIGN KEY ("watched_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."imported_feed_items"
    ADD CONSTRAINT "imported_feed_items_alert_source_id_fkey" FOREIGN KEY ("alert_source_id") REFERENCES "public"."alert_sources"("id");



ALTER TABLE ONLY "public"."imported_feed_items"
    ADD CONSTRAINT "imported_feed_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_titles"
    ADD CONSTRAINT "job_titles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."labor_cost_snapshots"
    ADD CONSTRAINT "labor_cost_snapshots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."license_reviews"
    ADD CONSTRAINT "license_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."license_reviews"
    ADD CONSTRAINT "license_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."media_capture_records"
    ADD CONSTRAINT "media_capture_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_capture_records"
    ADD CONSTRAINT "media_capture_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."media_jobs"
    ADD CONSTRAINT "media_jobs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."uploaded_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_jobs"
    ADD CONSTRAINT "media_jobs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."module_feedback"
    ADD CONSTRAINT "module_feedback_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."business_modules"("module_key");



ALTER TABLE ONLY "public"."module_runs"
    ADD CONSTRAINT "module_runs_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."business_modules"("module_key");



ALTER TABLE ONLY "public"."module_runs"
    ADD CONSTRAINT "module_runs_output_id_fkey" FOREIGN KEY ("output_id") REFERENCES "public"."generated_outputs"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."observability_events"
    ADD CONSTRAINT "observability_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."observability_events"
    ADD CONSTRAINT "observability_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."open_source_tools"
    ADD CONSTRAINT "open_source_tools_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."open_source_tools"
    ADD CONSTRAINT "open_source_tools_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_app_access"
    ADD CONSTRAINT "organization_app_access_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_broadcasts"
    ADD CONSTRAINT "organization_broadcasts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization_broadcasts"
    ADD CONSTRAINT "organization_broadcasts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization_broadcasts"
    ADD CONSTRAINT "organization_broadcasts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permission_audit_logs"
    ADD CONSTRAINT "permission_audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permission_audit_logs"
    ADD CONSTRAINT "permission_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permission_grants"
    ADD CONSTRAINT "permission_grants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permission_grants"
    ADD CONSTRAINT "permission_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permits"
    ADD CONSTRAINT "permits_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."uploaded_assets"("id");



ALTER TABLE ONLY "public"."permits"
    ADD CONSTRAINT "permits_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."phone_number_records"
    ADD CONSTRAINT "phone_number_records_contact_record_id_fkey" FOREIGN KEY ("contact_record_id") REFERENCES "public"."contact_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."phone_number_records"
    ADD CONSTRAINT "phone_number_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_templates"
    ADD CONSTRAINT "prompt_templates_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."business_modules"("module_key");



ALTER TABLE ONLY "public"."public_alerts"
    ADD CONSTRAINT "public_alerts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."public_alerts"
    ADD CONSTRAINT "public_alerts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."public_alerts"
    ADD CONSTRAINT "public_alerts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."public_events"
    ADD CONSTRAINT "public_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qr_links"
    ADD CONSTRAINT "qr_links_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."raises"
    ADD CONSTRAINT "raises_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."raises"
    ADD CONSTRAINT "raises_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."release_plans"
    ADD CONSTRAINT "release_plans_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."release_plans"
    ADD CONSTRAINT "release_plans_song_fingerprint_id_fkey" FOREIGN KEY ("song_fingerprint_id") REFERENCES "public"."song_fingerprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."releases"
    ADD CONSTRAINT "releases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."releases"
    ADD CONSTRAINT "releases_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."releases"
    ADD CONSTRAINT "releases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."repairs"
    ADD CONSTRAINT "repairs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."research_sources"
    ADD CONSTRAINT "research_sources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."research_sources"
    ADD CONSTRAINT "research_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_locations"
    ADD CONSTRAINT "restaurant_locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_locations"
    ADD CONSTRAINT "restaurant_locations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."restaurant_locations"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_reviews"
    ADD CONSTRAINT "security_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_reviews"
    ADD CONSTRAINT "security_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_records"
    ADD CONSTRAINT "service_records_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_records"
    ADD CONSTRAINT "service_records_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "public"."repairs"("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id");



ALTER TABLE ONLY "public"."sonara_billing_customers"
    ADD CONSTRAINT "sonara_billing_customers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sonara_memory_records"
    ADD CONSTRAINT "sonara_memory_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sonara_projects"
    ADD CONSTRAINT "sonara_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sonara_projects"
    ADD CONSTRAINT "sonara_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sonara_revenue_events"
    ADD CONSTRAINT "sonara_revenue_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."digital_products"("id");



ALTER TABLE ONLY "public"."sonara_sound_assets"
    ADD CONSTRAINT "sonara_sound_assets_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."sonara_sound_sources"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sonara_subscriptions"
    ADD CONSTRAINT "sonara_subscriptions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_fingerprints"
    ADD CONSTRAINT "song_fingerprints_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id");



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."soundos_readiness_scores"
    ADD CONSTRAINT "soundos_readiness_scores_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."soundos_readiness_scores"
    ADD CONSTRAINT "soundos_readiness_scores_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."staff_chat_messages"
    ADD CONSTRAINT "staff_chat_messages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."staff_chat_messages"
    ADD CONSTRAINT "staff_chat_messages_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_chat_messages"
    ADD CONSTRAINT "staff_chat_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."staff_chat_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_chat_threads"
    ADD CONSTRAINT "staff_chat_threads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."staff_chat_threads"
    ADD CONSTRAINT "staff_chat_threads_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_profile_image_asset_id_fkey" FOREIGN KEY ("profile_image_asset_id") REFERENCES "public"."uploaded_assets"("id");



ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tool_reviews"
    ADD CONSTRAINT "tool_reviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tool_reviews"
    ADD CONSTRAINT "tool_reviews_open_source_tool_id_fkey" FOREIGN KEY ("open_source_tool_id") REFERENCES "public"."open_source_tools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tool_reviews"
    ADD CONSTRAINT "tool_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transcription_jobs"
    ADD CONSTRAINT "transcription_jobs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."uploaded_assets"("id");



ALTER TABLE ONLY "public"."transcription_jobs"
    ADD CONSTRAINT "transcription_jobs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transfers"
    ADD CONSTRAINT "transfers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."transfers"
    ADD CONSTRAINT "transfers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transit_updates"
    ADD CONSTRAINT "transit_updates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."uploaded_assets"
    ADD CONSTRAINT "uploaded_assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."uploaded_assets"
    ADD CONSTRAINT "uploaded_assets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_projects"
    ADD CONSTRAINT "user_projects_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."business_modules"("module_key");



ALTER TABLE ONLY "public"."vendor_links"
    ADD CONSTRAINT "vendor_links_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_links"
    ADD CONSTRAINT "vendor_links_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_command_logs"
    ADD CONSTRAINT "voice_command_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_command_logs"
    ADD CONSTRAINT "voice_command_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."weather_alerts"
    ADD CONSTRAINT "weather_alerts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_runs"
    ADD CONSTRAINT "workflow_runs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workflow_runs"
    ADD CONSTRAINT "workflow_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



CREATE POLICY "Anonymous users can insert feedback reports" ON "public"."feedback_reports" FOR INSERT TO "anon" WITH CHECK ((("feedback_type" IS NOT NULL) AND ("message" IS NOT NULL)));



CREATE POLICY "Anonymous users can insert support requests" ON "public"."support_requests" FOR INSERT TO "anon" WITH CHECK ((("name" IS NOT NULL) AND ("email" IS NOT NULL) AND ("category" IS NOT NULL) AND ("subject" IS NOT NULL) AND ("message" IS NOT NULL)));



CREATE POLICY "Authenticated users can insert own feedback reports" ON "public"."feedback_reports" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" IS NULL) OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Authenticated users can insert own support requests" ON "public"."support_requests" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" IS NULL) OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Authenticated users can read SONARA sound assets" ON "public"."sonara_sound_assets" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can read SONARA sound sync runs" ON "public"."sonara_sound_sync_runs" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can read active digital products" ON "public"."digital_products" FOR SELECT TO "authenticated" USING ((COALESCE("is_active", false) = true));



CREATE POLICY "Authenticated users can read business modules" ON "public"."business_modules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read own feedback reports" ON "public"."feedback_reports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can read own support requests" ON "public"."support_requests" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can read subscription plans" ON "public"."subscription_plans" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Company members can read app scopes" ON "public"."app_scopes" FOR SELECT TO "authenticated" USING ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "Company members can read organization app access" ON "public"."organization_app_access" FOR SELECT TO "authenticated" USING ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "Members can append entity audit logs" ON "public"."entity_audit_logs" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_entity_member"("entity_id") AND (("user_id" IS NULL) OR ("user_id" = "auth"."uid"()))));



CREATE POLICY "Members can manage own browser bookmarks" ON "public"."entity_browser_bookmarks" TO "authenticated" USING (("public"."is_entity_member"("entity_id") AND (("user_id" = "auth"."uid"()) OR "public"."can_manage_entity"("entity_id")))) WITH CHECK (("public"."is_entity_member"("entity_id") AND ("user_id" = "auth"."uid"())));



CREATE POLICY "Members can manage own browser sessions" ON "public"."entity_browser_sessions" TO "authenticated" USING (("public"."is_entity_member"("entity_id") AND (("user_id" = "auth"."uid"()) OR "public"."can_manage_entity"("entity_id")))) WITH CHECK (("public"."is_entity_member"("entity_id") AND ("user_id" = "auth"."uid"())));



CREATE POLICY "Members can manage own research notes" ON "public"."entity_research_notes" TO "authenticated" USING (("public"."is_entity_member"("entity_id") AND (("user_id" = "auth"."uid"()) OR "public"."can_manage_entity"("entity_id")))) WITH CHECK (("public"."is_entity_member"("entity_id") AND ("user_id" = "auth"."uid"())));



CREATE POLICY "Members can read action approvals" ON "public"."entity_action_approvals" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read action runs" ON "public"."entity_action_runs" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read agent memory" ON "public"."entity_agent_memory" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read agent runs" ON "public"."entity_agent_runs" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read agent tools" ON "public"."entity_agent_tool_registry" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read agents" ON "public"."entity_agents" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read assigned entities" ON "public"."entities" FOR SELECT TO "authenticated" USING (("is_public" OR "public"."is_entity_member"("id")));



CREATE POLICY "Members can read automation runs" ON "public"."entity_automation_runs" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read automations" ON "public"."entity_automations" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read browser bookmarks" ON "public"."entity_browser_bookmarks" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read browser sessions" ON "public"."entity_browser_sessions" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read connector events" ON "public"."entity_connector_events" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read connectors" ON "public"."entity_connectors" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read entity audit logs" ON "public"."entity_audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read entity memberships" ON "public"."entity_memberships" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read entity settings" ON "public"."entity_settings" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read health snapshots" ON "public"."entity_health_snapshots" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read heartbeats" ON "public"."entity_heartbeats" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read incidents" ON "public"."entity_incidents" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read proactive actions" ON "public"."entity_proactive_actions" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "Members can read research notes" ON "public"."entity_research_notes" FOR SELECT TO "authenticated" USING ("public"."is_entity_member"("entity_id"));



CREATE POLICY "No public access to stripe events" ON "public"."stripe_events" FOR SELECT TO "authenticated" USING (false);



CREATE POLICY "Owners admins and operators can insert action runs" ON "public"."entity_action_runs" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_entity_role"("entity_id", ARRAY['owner'::"public"."entity_member_role", 'admin'::"public"."entity_member_role", 'operator'::"public"."entity_member_role"]) AND (("created_by" IS NULL) OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "Owners admins and operators can insert agent runs" ON "public"."entity_agent_runs" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_entity_role"("entity_id", ARRAY['owner'::"public"."entity_member_role", 'admin'::"public"."entity_member_role", 'operator'::"public"."entity_member_role"]) AND (("created_by" IS NULL) OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "Owners admins and operators can insert automation runs" ON "public"."entity_automation_runs" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_entity_role"("entity_id", ARRAY['owner'::"public"."entity_member_role", 'admin'::"public"."entity_member_role", 'operator'::"public"."entity_member_role"]));



CREATE POLICY "Owners admins and operators can propose actions" ON "public"."entity_proactive_actions" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_entity_role"("entity_id", ARRAY['owner'::"public"."entity_member_role", 'admin'::"public"."entity_member_role", 'operator'::"public"."entity_member_role"]) AND (("proposed_by" IS NULL) OR ("proposed_by" = "auth"."uid"()))));



CREATE POLICY "Owners and admins can insert heartbeats" ON "public"."entity_heartbeats" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_entity"("entity_id"));



CREATE POLICY "Owners and admins can manage action approvals" ON "public"."entity_action_approvals" TO "authenticated" USING ("public"."can_manage_entity"("entity_id")) WITH CHECK ("public"."can_manage_entity"("entity_id"));



CREATE POLICY "Owners and admins can manage agent memory" ON "public"."entity_agent_memory" TO "authenticated" USING ("public"."can_manage_entity"("entity_id")) WITH CHECK ("public"."can_manage_entity"("entity_id"));



CREATE POLICY "Owners and admins can manage agent tools" ON "public"."entity_agent_tool_registry" TO "authenticated" USING ("public"."can_manage_entity"("entity_id")) WITH CHECK ("public"."can_manage_entity"("entity_id"));



CREATE POLICY "Owners and admins can manage agents" ON "public"."entity_agents" TO "authenticated" USING ("public"."can_manage_entity"("entity_id")) WITH CHECK ("public"."can_manage_entity"("entity_id"));



CREATE POLICY "Owners and admins can manage automations" ON "public"."entity_automations" TO "authenticated" USING ("public"."can_manage_entity"("entity_id")) WITH CHECK ("public"."can_manage_entity"("entity_id"));



CREATE POLICY "Owners and admins can manage connectors" ON "public"."entity_connectors" TO "authenticated" USING ("public"."can_manage_entity"("entity_id")) WITH CHECK ("public"."can_manage_entity"("entity_id"));



CREATE POLICY "Owners and admins can manage entity memberships" ON "public"."entity_memberships" TO "authenticated" USING ("public"."can_manage_entity"("entity_id")) WITH CHECK ("public"."can_manage_entity"("entity_id"));



CREATE POLICY "Owners and admins can manage entity settings" ON "public"."entity_settings" TO "authenticated" USING ("public"."can_manage_entity"("entity_id")) WITH CHECK ("public"."can_manage_entity"("entity_id"));



CREATE POLICY "Owners and admins can manage incidents" ON "public"."entity_incidents" TO "authenticated" USING ("public"."can_manage_entity"("entity_id")) WITH CHECK ("public"."can_manage_entity"("entity_id"));



CREATE POLICY "Owners and admins can update entities" ON "public"."entities" FOR UPDATE TO "authenticated" USING ("public"."can_manage_entity"("id")) WITH CHECK ("public"."can_manage_entity"("id"));



CREATE POLICY "Owners and admins can update proactive actions" ON "public"."entity_proactive_actions" FOR UPDATE TO "authenticated" USING ("public"."can_manage_entity"("entity_id")) WITH CHECK ("public"."can_manage_entity"("entity_id"));



CREATE POLICY "Public can read enabled SONARA sound sources" ON "public"."sonara_sound_sources" FOR SELECT USING (("enabled" = true));



CREATE POLICY "Public can view active prices" ON "public"."prices" FOR SELECT TO "anon", "authenticated" USING (("active" = true));



CREATE POLICY "Service role can manage SONARA One subscriptions" ON "public"."sonara_user_subscriptions" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage SONARA memory records" ON "public"."sonara_memory_records" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage feedback reports" ON "public"."feedback_reports" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage support requests" ON "public"."support_requests" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Users can insert own SONARA memory records" ON "public"."sonara_memory_records" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own generation history" ON "public"."sonara_generation_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own SONARA projects" ON "public"."sonara_projects" USING ((("auth"."uid"() = "owner_id") OR ("auth"."uid"() = "user_id"))) WITH CHECK ((("auth"."uid"() = "owner_id") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Users can manage their own release plans" ON "public"."release_plans" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage their own song fingerprints" ON "public"."song_fingerprints" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can read own SONARA memory records" ON "public"."sonara_memory_records" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own audit events" ON "public"."system_audit_events" FOR SELECT TO "authenticated" USING (("actor_id" = "auth"."uid"()));



CREATE POLICY "Users can read own creator activity" ON "public"."creator_activity_events" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own generated outputs" ON "public"."generated_outputs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own module feedback" ON "public"."module_feedback" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own module runs" ON "public"."module_runs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own projects" ON "public"."user_projects" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own revenue events" ON "public"."sonara_revenue_events" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own subscription" ON "public"."sonara_user_subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own usage limits" ON "public"."user_usage_limits" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can select own generation history" ON "public"."sonara_generation_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view own orders" ON "public"."orders" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view own subscriptions" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own SONARA One subscriptions" ON "public"."sonara_user_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own billing customer" ON "public"."sonara_billing_customers" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can view their own stripe customer row" ON "public"."stripe_customers" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own subscription" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own subscriptions" ON "public"."sonara_subscriptions" FOR SELECT USING (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."agent_action_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alert_delivery_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alert_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alert_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alertos_trust_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."anti_repetition_checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_scopes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."approval_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."artist_dna_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."artists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audio_analysis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated can read feature flags" ON "public"."feature_flags" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "authenticated can read github repositories" ON "public"."github_repositories" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "authenticated can read provider registry" ON "public"."provider_registry" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."backup_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_sub_app_database_schemas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_sub_app_deployments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_sub_app_modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_sub_app_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_sub_apps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_workspaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."certifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."communication_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."connector_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."connector_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_import_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creator_activity_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."db_health_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."digital_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entitlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_action_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_action_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_agent_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_agent_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_agent_tool_registry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_agents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_automation_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_automations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_browser_bookmarks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_browser_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_connector_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_connectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_health_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_heartbeats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_incidents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_proactive_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_research_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."external_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_outputs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repositories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_blocklist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_business_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_codex_prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_feature_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_license_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_maintenance_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_privacy_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_product_fit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_recommendations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_score_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_security_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_sync_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_update_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_repository_watchlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."holidays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."imported_feed_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inspections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_titles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."labor_cost_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."license_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_capture_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."module_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."module_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."observability_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."open_source_tools" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org members can read agent_action_logs" ON "public"."agent_action_logs" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "agent_action_logs"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read audit_events" ON "public"."audit_events" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "audit_events"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read business_sub_app_database_schemas" ON "public"."business_sub_app_database_schemas" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "business_sub_app_database_schemas"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read business_sub_app_deployments" ON "public"."business_sub_app_deployments" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "business_sub_app_deployments"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read business_sub_app_modules" ON "public"."business_sub_app_modules" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "business_sub_app_modules"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read business_sub_app_pages" ON "public"."business_sub_app_pages" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "business_sub_app_pages"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read business_sub_apps" ON "public"."business_sub_apps" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "business_sub_apps"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read business_workspaces" ON "public"."business_workspaces" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "business_workspaces"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read communication_preferences" ON "public"."communication_preferences" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "communication_preferences"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read contact_import_batches" ON "public"."contact_import_batches" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "contact_import_batches"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read contact_records" ON "public"."contact_records" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "contact_records"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read license_reviews" ON "public"."license_reviews" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "license_reviews"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read media_capture_records" ON "public"."media_capture_records" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "media_capture_records"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read observability_events" ON "public"."observability_events" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "observability_events"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read open source tools" ON "public"."open_source_tools" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "open_source_tools"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text")))));



CREATE POLICY "org members can read permission_audit_logs" ON "public"."permission_audit_logs" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "permission_audit_logs"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read permission_grants" ON "public"."permission_grants" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "permission_grants"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read phone_number_records" ON "public"."phone_number_records" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "phone_number_records"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read research sources" ON "public"."research_sources" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "research_sources"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text")))));



CREATE POLICY "org members can read security_reviews" ON "public"."security_reviews" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "security_reviews"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read tool reviews" ON "public"."tool_reviews" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "tool_reviews"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text")))));



CREATE POLICY "org members can read voice_command_logs" ON "public"."voice_command_logs" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "voice_command_logs"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



CREATE POLICY "org members can read workflow_runs" ON "public"."workflow_runs" FOR SELECT USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "workflow_runs"."organization_id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text"))))));



ALTER TABLE "public"."organization_app_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_broadcasts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_members_owner_manage" ON "public"."organization_members" USING (("public"."has_org_role"("org_id", 'owner'::"text") OR "public"."has_org_role"("org_id", 'admin'::"text"))) WITH CHECK (("public"."has_org_role"("org_id", 'owner'::"text") OR "public"."has_org_role"("org_id", 'admin'::"text")));



CREATE POLICY "organization_members_visible_to_members" ON "public"."organization_members" FOR SELECT USING ("public"."is_org_member"("org_id"));



ALTER TABLE "public"."organization_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_member_select" ON "public"."organizations" FOR SELECT USING ("public"."is_org_member"("id"));



CREATE POLICY "organizations_owner_update" ON "public"."organizations" FOR UPDATE USING (("public"."has_org_role"("id", 'owner'::"text") OR "public"."has_org_role"("id", 'admin'::"text")));



ALTER TABLE "public"."permission_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permission_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."phone_number_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform admins can manage github repositories" ON "public"."github_repositories" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_audit_logs" ON "public"."github_repository_audit_logs" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_blocklist" ON "public"."github_repository_blocklist" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_business_reviews" ON "public"."github_repository_business_reviews" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_categories" ON "public"."github_repository_categories" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_codex_prompts" ON "public"."github_repository_codex_prompts" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_feature_flags" ON "public"."github_repository_feature_flags" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_license_reviews" ON "public"."github_repository_license_reviews" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_maintenance_review" ON "public"."github_repository_maintenance_reviews" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_privacy_reviews" ON "public"."github_repository_privacy_reviews" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_product_fit" ON "public"."github_repository_product_fit" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_recommendations" ON "public"."github_repository_recommendations" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_reviews" ON "public"."github_repository_reviews" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_score_history" ON "public"."github_repository_score_history" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_security_reviews" ON "public"."github_repository_security_reviews" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_sync_jobs" ON "public"."github_repository_sync_jobs" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_update_events" ON "public"."github_repository_update_events" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "platform admins can manage github_repository_watchlist" ON "public"."github_repository_watchlist" USING (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (((COALESCE(("auth"."jwt"() ->> 'app_role'::"text"), ''::"text") = ANY (ARRAY['platform_owner'::"text", 'platform_admin'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



ALTER TABLE "public"."platform_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_self" ON "public"."profiles" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promotions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prompt_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_registry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."qr_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."raises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."release_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."releases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."repairs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."research_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service role can manage agent_action_logs" ON "public"."agent_action_logs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage audit_events" ON "public"."audit_events" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage business_sub_app_database_schemas" ON "public"."business_sub_app_database_schemas" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage business_sub_app_deployments" ON "public"."business_sub_app_deployments" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage business_sub_app_modules" ON "public"."business_sub_app_modules" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage business_sub_app_pages" ON "public"."business_sub_app_pages" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage business_sub_apps" ON "public"."business_sub_apps" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage business_workspaces" ON "public"."business_workspaces" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage communication_preferences" ON "public"."communication_preferences" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage contact_import_batches" ON "public"."contact_import_batches" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage contact_records" ON "public"."contact_records" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage feature flags" ON "public"."feature_flags" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage license_reviews" ON "public"."license_reviews" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage media_capture_records" ON "public"."media_capture_records" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage observability_events" ON "public"."observability_events" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage organization memberships" ON "public"."organization_memberships" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage organizations" ON "public"."organizations" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage permission_audit_logs" ON "public"."permission_audit_logs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage permission_grants" ON "public"."permission_grants" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage phone_number_records" ON "public"."phone_number_records" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage provider registry" ON "public"."provider_registry" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage security_reviews" ON "public"."security_reviews" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage voice_command_logs" ON "public"."voice_command_logs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role can manage workflow_runs" ON "public"."workflow_runs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."service_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_billing_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_generation_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_launch_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_memory_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_revenue_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_sound_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_sound_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_sound_sync_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_user_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."song_fingerprints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."songs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."soundos_readiness_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_chat_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_audit_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_modify" ON "public"."alert_delivery_attempts" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."alert_sources" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."alert_subscriptions" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."alertos_trust_scores" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."anti_repetition_checks" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."approval_queue" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."artist_dna_profiles" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."artists" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."audio_analysis" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."backup_runs" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."billing_subscriptions" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."certifications" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."connector_runs" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."connector_sources" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."employees" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."entitlements" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."external_links" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."holidays" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."imported_feed_items" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."inspections" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."job_titles" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."labor_cost_snapshots" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."media_jobs" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."menu_items" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."notifications" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."organization_broadcasts" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."permits" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."projects" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."promotions" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."public_alerts" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."public_events" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."qr_links" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."raises" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."recipe_ingredients" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."recipes" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."releases" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."repairs" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."restaurant_locations" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."restaurants" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."schedules" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."security_events" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."service_records" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."shifts" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."songs" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."soundos_readiness_scores" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."staff_chat_messages" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."staff_chat_threads" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."staff_profiles" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."transcription_jobs" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."transfers" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."transit_updates" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."uploaded_assets" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."vendor_links" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."vendors" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_modify" ON "public"."weather_alerts" USING ("public"."has_company_access"("org_id", "company_key")) WITH CHECK ("public"."has_company_access"("org_id", "company_key"));



CREATE POLICY "tenant_members_select" ON "public"."alert_delivery_attempts" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."alert_sources" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."alert_subscriptions" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."alertos_trust_scores" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."anti_repetition_checks" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."approval_queue" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."artist_dna_profiles" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."artists" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."audio_analysis" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."backup_runs" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."billing_customers" FOR SELECT USING ("public"."is_org_member"("org_id"));



CREATE POLICY "tenant_members_select" ON "public"."billing_subscriptions" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."certifications" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."connector_runs" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."connector_sources" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."employees" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."entitlements" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."external_links" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."holidays" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."imported_feed_items" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."inspections" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."job_titles" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."labor_cost_snapshots" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."media_jobs" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."menu_items" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."notifications" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."organization_broadcasts" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."permits" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."projects" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."promotions" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."public_alerts" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."public_events" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."qr_links" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."raises" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."recipe_ingredients" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."recipes" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."releases" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."repairs" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."restaurant_locations" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."restaurants" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."schedules" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."security_events" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."service_records" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."shifts" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."songs" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."soundos_readiness_scores" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."staff_chat_messages" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."staff_chat_threads" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."staff_profiles" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."transcription_jobs" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."transfers" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."transit_updates" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."uploaded_assets" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."vendor_links" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."vendors" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



CREATE POLICY "tenant_members_select" ON "public"."weather_alerts" FOR SELECT USING (("public"."is_org_member"("org_id") AND "public"."has_company_access"("org_id", "company_key")));



ALTER TABLE "public"."tool_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transcription_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transit_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."uploaded_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_preferences_insert_own" ON "public"."user_preferences" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user_preferences_select_own" ON "public"."user_preferences" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_preferences_update_own" ON "public"."user_preferences" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_usage_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users can read organizations through active membership" ON "public"."organizations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "memberships"
  WHERE (("memberships"."organization_id" = "organizations"."id") AND ("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."status" = 'active'::"text")))));



CREATE POLICY "users can read own organization memberships" ON "public"."organization_memberships" FOR SELECT USING ((("user_id" = "auth"."uid"()) AND ("status" = 'active'::"text")));



ALTER TABLE "public"."vendor_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_command_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weather_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflow_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_memberships_select_own" ON "public"."workspace_memberships" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."workspace_memberships" "wm"
  WHERE (("wm"."workspace_id" = "workspace_memberships"."workspace_id") AND ("wm"."user_id" = "auth"."uid"()) AND ("wm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspaces_select_for_members" ON "public"."workspaces" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_memberships" "wm"
  WHERE (("wm"."workspace_id" = "workspaces"."id") AND ("wm"."user_id" = "auth"."uid"())))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";








GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."audit_row_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_row_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_row_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_entity"("target_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_entity"("target_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_entity"("target_entity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_company_access"("target_org_id" "uuid", "target_company_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_company_access"("target_org_id" "uuid", "target_company_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_company_access"("target_org_id" "uuid", "target_company_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_entity_role"("target_entity_id" "uuid", "allowed_roles" "public"."entity_member_role"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_entity_role"("target_entity_id" "uuid", "allowed_roles" "public"."entity_member_role"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_entity_role"("target_entity_id" "uuid", "allowed_roles" "public"."entity_member_role"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_org_role"("target_org_id" "uuid", "target_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_org_role"("target_org_id" "uuid", "target_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_org_role"("target_org_id" "uuid", "target_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_scope"("target_org_id" "uuid", "target_scope" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_scope"("target_org_id" "uuid", "target_scope" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_scope"("target_org_id" "uuid", "target_scope" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_entity_member"("target_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_entity_member"("target_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_entity_member"("target_entity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_member"("target_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_member"("target_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_member"("target_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";















GRANT ALL ON TABLE "public"."agent_action_logs" TO "anon";
GRANT ALL ON TABLE "public"."agent_action_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_action_logs" TO "service_role";



GRANT ALL ON TABLE "public"."alert_delivery_attempts" TO "anon";
GRANT ALL ON TABLE "public"."alert_delivery_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."alert_delivery_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."alert_sources" TO "anon";
GRANT ALL ON TABLE "public"."alert_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."alert_sources" TO "service_role";



GRANT ALL ON TABLE "public"."alert_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."alert_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."alert_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."alertos_trust_scores" TO "anon";
GRANT ALL ON TABLE "public"."alertos_trust_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."alertos_trust_scores" TO "service_role";



GRANT ALL ON TABLE "public"."anti_repetition_checks" TO "anon";
GRANT ALL ON TABLE "public"."anti_repetition_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."anti_repetition_checks" TO "service_role";



GRANT ALL ON TABLE "public"."app_scopes" TO "anon";
GRANT ALL ON TABLE "public"."app_scopes" TO "authenticated";
GRANT ALL ON TABLE "public"."app_scopes" TO "service_role";



GRANT ALL ON TABLE "public"."approval_queue" TO "anon";
GRANT ALL ON TABLE "public"."approval_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_queue" TO "service_role";



GRANT ALL ON TABLE "public"."artist_dna_profiles" TO "anon";
GRANT ALL ON TABLE "public"."artist_dna_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."artist_dna_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."artists" TO "anon";
GRANT ALL ON TABLE "public"."artists" TO "authenticated";
GRANT ALL ON TABLE "public"."artists" TO "service_role";



GRANT ALL ON TABLE "public"."audio_analysis" TO "anon";
GRANT ALL ON TABLE "public"."audio_analysis" TO "authenticated";
GRANT ALL ON TABLE "public"."audio_analysis" TO "service_role";



GRANT ALL ON TABLE "public"."audit_events" TO "anon";
GRANT ALL ON TABLE "public"."audit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_events" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."backup_runs" TO "anon";
GRANT ALL ON TABLE "public"."backup_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."backup_runs" TO "service_role";



GRANT ALL ON TABLE "public"."billing_customers" TO "anon";
GRANT ALL ON TABLE "public"."billing_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_customers" TO "service_role";



GRANT ALL ON TABLE "public"."billing_events" TO "anon";
GRANT ALL ON TABLE "public"."billing_events" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_events" TO "service_role";



GRANT ALL ON TABLE "public"."billing_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."billing_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."business_modules" TO "anon";
GRANT ALL ON TABLE "public"."business_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."business_modules" TO "service_role";



GRANT ALL ON TABLE "public"."business_sub_app_database_schemas" TO "anon";
GRANT ALL ON TABLE "public"."business_sub_app_database_schemas" TO "authenticated";
GRANT ALL ON TABLE "public"."business_sub_app_database_schemas" TO "service_role";



GRANT ALL ON TABLE "public"."business_sub_app_deployments" TO "anon";
GRANT ALL ON TABLE "public"."business_sub_app_deployments" TO "authenticated";
GRANT ALL ON TABLE "public"."business_sub_app_deployments" TO "service_role";



GRANT ALL ON TABLE "public"."business_sub_app_modules" TO "anon";
GRANT ALL ON TABLE "public"."business_sub_app_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."business_sub_app_modules" TO "service_role";



GRANT ALL ON TABLE "public"."business_sub_app_pages" TO "anon";
GRANT ALL ON TABLE "public"."business_sub_app_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."business_sub_app_pages" TO "service_role";



GRANT ALL ON TABLE "public"."business_sub_apps" TO "anon";
GRANT ALL ON TABLE "public"."business_sub_apps" TO "authenticated";
GRANT ALL ON TABLE "public"."business_sub_apps" TO "service_role";



GRANT ALL ON TABLE "public"."business_workspaces" TO "anon";
GRANT ALL ON TABLE "public"."business_workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."business_workspaces" TO "service_role";



GRANT ALL ON TABLE "public"."certifications" TO "anon";
GRANT ALL ON TABLE "public"."certifications" TO "authenticated";
GRANT ALL ON TABLE "public"."certifications" TO "service_role";



GRANT ALL ON TABLE "public"."communication_preferences" TO "anon";
GRANT ALL ON TABLE "public"."communication_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."communication_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."connector_runs" TO "anon";
GRANT ALL ON TABLE "public"."connector_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."connector_runs" TO "service_role";



GRANT ALL ON TABLE "public"."connector_sources" TO "anon";
GRANT ALL ON TABLE "public"."connector_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."connector_sources" TO "service_role";



GRANT ALL ON TABLE "public"."contact_import_batches" TO "anon";
GRANT ALL ON TABLE "public"."contact_import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_import_batches" TO "service_role";



GRANT ALL ON TABLE "public"."contact_records" TO "anon";
GRANT ALL ON TABLE "public"."contact_records" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_records" TO "service_role";



GRANT ALL ON TABLE "public"."creator_activity_events" TO "anon";
GRANT ALL ON TABLE "public"."creator_activity_events" TO "authenticated";
GRANT ALL ON TABLE "public"."creator_activity_events" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."db_health_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."db_health_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."db_health_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."digital_products" TO "anon";
GRANT ALL ON TABLE "public"."digital_products" TO "authenticated";
GRANT ALL ON TABLE "public"."digital_products" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."entities" TO "anon";
GRANT ALL ON TABLE "public"."entities" TO "authenticated";
GRANT ALL ON TABLE "public"."entities" TO "service_role";



GRANT ALL ON TABLE "public"."entitlements" TO "anon";
GRANT ALL ON TABLE "public"."entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."entitlements" TO "service_role";



GRANT ALL ON TABLE "public"."entity_action_approvals" TO "anon";
GRANT ALL ON TABLE "public"."entity_action_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_action_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."entity_action_runs" TO "anon";
GRANT ALL ON TABLE "public"."entity_action_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_action_runs" TO "service_role";



GRANT ALL ON TABLE "public"."entity_agent_memory" TO "anon";
GRANT ALL ON TABLE "public"."entity_agent_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_agent_memory" TO "service_role";



GRANT ALL ON TABLE "public"."entity_agent_runs" TO "anon";
GRANT ALL ON TABLE "public"."entity_agent_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_agent_runs" TO "service_role";



GRANT ALL ON TABLE "public"."entity_agent_tool_registry" TO "anon";
GRANT ALL ON TABLE "public"."entity_agent_tool_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_agent_tool_registry" TO "service_role";



GRANT ALL ON TABLE "public"."entity_agents" TO "anon";
GRANT ALL ON TABLE "public"."entity_agents" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_agents" TO "service_role";



GRANT ALL ON TABLE "public"."entity_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."entity_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."entity_automation_runs" TO "anon";
GRANT ALL ON TABLE "public"."entity_automation_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_automation_runs" TO "service_role";



GRANT ALL ON TABLE "public"."entity_automations" TO "anon";
GRANT ALL ON TABLE "public"."entity_automations" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_automations" TO "service_role";



GRANT ALL ON TABLE "public"."entity_browser_bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."entity_browser_bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_browser_bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."entity_browser_sessions" TO "anon";
GRANT ALL ON TABLE "public"."entity_browser_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_browser_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."entity_connector_events" TO "anon";
GRANT ALL ON TABLE "public"."entity_connector_events" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_connector_events" TO "service_role";



GRANT ALL ON TABLE "public"."entity_connectors" TO "anon";
GRANT ALL ON TABLE "public"."entity_connectors" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_connectors" TO "service_role";



GRANT ALL ON TABLE "public"."entity_health_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."entity_health_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_health_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."entity_heartbeats" TO "anon";
GRANT ALL ON TABLE "public"."entity_heartbeats" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_heartbeats" TO "service_role";



GRANT ALL ON TABLE "public"."entity_incidents" TO "anon";
GRANT ALL ON TABLE "public"."entity_incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_incidents" TO "service_role";



GRANT ALL ON TABLE "public"."entity_memberships" TO "anon";
GRANT ALL ON TABLE "public"."entity_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."entity_proactive_actions" TO "anon";
GRANT ALL ON TABLE "public"."entity_proactive_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_proactive_actions" TO "service_role";



GRANT ALL ON TABLE "public"."entity_research_notes" TO "anon";
GRANT ALL ON TABLE "public"."entity_research_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_research_notes" TO "service_role";



GRANT ALL ON TABLE "public"."entity_settings" TO "anon";
GRANT ALL ON TABLE "public"."entity_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_settings" TO "service_role";



GRANT ALL ON TABLE "public"."external_links" TO "anon";
GRANT ALL ON TABLE "public"."external_links" TO "authenticated";
GRANT ALL ON TABLE "public"."external_links" TO "service_role";



GRANT ALL ON TABLE "public"."feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flags" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_reports" TO "anon";
GRANT ALL ON TABLE "public"."feedback_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_reports" TO "service_role";



GRANT ALL ON TABLE "public"."generated_outputs" TO "anon";
GRANT ALL ON TABLE "public"."generated_outputs" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_outputs" TO "service_role";



GRANT ALL ON TABLE "public"."github_repositories" TO "anon";
GRANT ALL ON TABLE "public"."github_repositories" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repositories" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_blocklist" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_blocklist" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_blocklist" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_business_reviews" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_business_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_business_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_categories" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_categories" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_codex_prompts" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_codex_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_codex_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_feature_flags" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_license_reviews" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_license_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_license_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_maintenance_reviews" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_maintenance_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_maintenance_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_privacy_reviews" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_privacy_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_privacy_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_product_fit" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_product_fit" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_product_fit" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_reviews" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_score_history" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_score_history" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_score_history" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_security_reviews" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_security_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_security_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_sync_jobs" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_sync_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_sync_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_update_events" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_update_events" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_update_events" TO "service_role";



GRANT ALL ON TABLE "public"."github_repository_watchlist" TO "anon";
GRANT ALL ON TABLE "public"."github_repository_watchlist" TO "authenticated";
GRANT ALL ON TABLE "public"."github_repository_watchlist" TO "service_role";



GRANT ALL ON TABLE "public"."holidays" TO "anon";
GRANT ALL ON TABLE "public"."holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."holidays" TO "service_role";



GRANT ALL ON TABLE "public"."imported_feed_items" TO "anon";
GRANT ALL ON TABLE "public"."imported_feed_items" TO "authenticated";
GRANT ALL ON TABLE "public"."imported_feed_items" TO "service_role";



GRANT ALL ON TABLE "public"."inspections" TO "anon";
GRANT ALL ON TABLE "public"."inspections" TO "authenticated";
GRANT ALL ON TABLE "public"."inspections" TO "service_role";



GRANT ALL ON TABLE "public"."job_titles" TO "anon";
GRANT ALL ON TABLE "public"."job_titles" TO "authenticated";
GRANT ALL ON TABLE "public"."job_titles" TO "service_role";



GRANT ALL ON TABLE "public"."labor_cost_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."labor_cost_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."labor_cost_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."license_reviews" TO "anon";
GRANT ALL ON TABLE "public"."license_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."license_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."media_capture_records" TO "anon";
GRANT ALL ON TABLE "public"."media_capture_records" TO "authenticated";
GRANT ALL ON TABLE "public"."media_capture_records" TO "service_role";



GRANT ALL ON TABLE "public"."media_jobs" TO "anon";
GRANT ALL ON TABLE "public"."media_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."media_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."module_feedback" TO "anon";
GRANT ALL ON TABLE "public"."module_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."module_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."module_runs" TO "anon";
GRANT ALL ON TABLE "public"."module_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."module_runs" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."observability_events" TO "anon";
GRANT ALL ON TABLE "public"."observability_events" TO "authenticated";
GRANT ALL ON TABLE "public"."observability_events" TO "service_role";



GRANT ALL ON TABLE "public"."open_source_tools" TO "anon";
GRANT ALL ON TABLE "public"."open_source_tools" TO "authenticated";
GRANT ALL ON TABLE "public"."open_source_tools" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."organization_app_access" TO "anon";
GRANT ALL ON TABLE "public"."organization_app_access" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_app_access" TO "service_role";



GRANT ALL ON TABLE "public"."organization_broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."organization_broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."organization_memberships" TO "anon";
GRANT ALL ON TABLE "public"."organization_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."permission_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."permission_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."permission_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."permission_grants" TO "anon";
GRANT ALL ON TABLE "public"."permission_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."permission_grants" TO "service_role";



GRANT ALL ON TABLE "public"."permits" TO "anon";
GRANT ALL ON TABLE "public"."permits" TO "authenticated";
GRANT ALL ON TABLE "public"."permits" TO "service_role";



GRANT ALL ON TABLE "public"."phone_number_records" TO "anon";
GRANT ALL ON TABLE "public"."phone_number_records" TO "authenticated";
GRANT ALL ON TABLE "public"."phone_number_records" TO "service_role";



GRANT ALL ON TABLE "public"."platform_jobs" TO "anon";
GRANT ALL ON TABLE "public"."platform_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."prices" TO "anon";
GRANT ALL ON TABLE "public"."prices" TO "authenticated";
GRANT ALL ON TABLE "public"."prices" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."promotions" TO "anon";
GRANT ALL ON TABLE "public"."promotions" TO "authenticated";
GRANT ALL ON TABLE "public"."promotions" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_templates" TO "anon";
GRANT ALL ON TABLE "public"."prompt_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_templates" TO "service_role";



GRANT ALL ON TABLE "public"."provider_registry" TO "anon";
GRANT ALL ON TABLE "public"."provider_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_registry" TO "service_role";



GRANT ALL ON TABLE "public"."public_alerts" TO "anon";
GRANT ALL ON TABLE "public"."public_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."public_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."public_events" TO "anon";
GRANT ALL ON TABLE "public"."public_events" TO "authenticated";
GRANT ALL ON TABLE "public"."public_events" TO "service_role";



GRANT ALL ON TABLE "public"."qr_links" TO "anon";
GRANT ALL ON TABLE "public"."qr_links" TO "authenticated";
GRANT ALL ON TABLE "public"."qr_links" TO "service_role";



GRANT ALL ON TABLE "public"."raises" TO "anon";
GRANT ALL ON TABLE "public"."raises" TO "authenticated";
GRANT ALL ON TABLE "public"."raises" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."recipes" TO "anon";
GRANT ALL ON TABLE "public"."recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes" TO "service_role";



GRANT ALL ON TABLE "public"."release_plans" TO "anon";
GRANT ALL ON TABLE "public"."release_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."release_plans" TO "service_role";



GRANT ALL ON TABLE "public"."releases" TO "anon";
GRANT ALL ON TABLE "public"."releases" TO "authenticated";
GRANT ALL ON TABLE "public"."releases" TO "service_role";



GRANT ALL ON TABLE "public"."repairs" TO "anon";
GRANT ALL ON TABLE "public"."repairs" TO "authenticated";
GRANT ALL ON TABLE "public"."repairs" TO "service_role";



GRANT ALL ON TABLE "public"."research_sources" TO "anon";
GRANT ALL ON TABLE "public"."research_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."research_sources" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_locations" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_locations" TO "service_role";



GRANT ALL ON TABLE "public"."restaurants" TO "anon";
GRANT ALL ON TABLE "public"."restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."security_events" TO "anon";
GRANT ALL ON TABLE "public"."security_events" TO "authenticated";
GRANT ALL ON TABLE "public"."security_events" TO "service_role";



GRANT ALL ON TABLE "public"."security_reviews" TO "anon";
GRANT ALL ON TABLE "public"."security_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."security_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."service_records" TO "anon";
GRANT ALL ON TABLE "public"."service_records" TO "authenticated";
GRANT ALL ON TABLE "public"."service_records" TO "service_role";



GRANT ALL ON TABLE "public"."shifts" TO "anon";
GRANT ALL ON TABLE "public"."shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."shifts" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_billing_customers" TO "anon";
GRANT ALL ON TABLE "public"."sonara_billing_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_billing_customers" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_generation_history" TO "anon";
GRANT ALL ON TABLE "public"."sonara_generation_history" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_generation_history" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_launch_settings" TO "anon";
GRANT ALL ON TABLE "public"."sonara_launch_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_launch_settings" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_memory_records" TO "anon";
GRANT ALL ON TABLE "public"."sonara_memory_records" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_memory_records" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_projects" TO "anon";
GRANT ALL ON TABLE "public"."sonara_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_projects" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_revenue_events" TO "anon";
GRANT ALL ON TABLE "public"."sonara_revenue_events" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_revenue_events" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_sound_assets" TO "anon";
GRANT ALL ON TABLE "public"."sonara_sound_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_sound_assets" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_sound_sources" TO "anon";
GRANT ALL ON TABLE "public"."sonara_sound_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_sound_sources" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_sound_sync_runs" TO "anon";
GRANT ALL ON TABLE "public"."sonara_sound_sync_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_sound_sync_runs" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."sonara_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."sonara_user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_user_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."song_fingerprints" TO "anon";
GRANT ALL ON TABLE "public"."song_fingerprints" TO "authenticated";
GRANT ALL ON TABLE "public"."song_fingerprints" TO "service_role";



GRANT ALL ON TABLE "public"."songs" TO "anon";
GRANT ALL ON TABLE "public"."songs" TO "authenticated";
GRANT ALL ON TABLE "public"."songs" TO "service_role";



GRANT ALL ON TABLE "public"."soundos_readiness_scores" TO "anon";
GRANT ALL ON TABLE "public"."soundos_readiness_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."soundos_readiness_scores" TO "service_role";



GRANT ALL ON TABLE "public"."staff_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."staff_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."staff_chat_threads" TO "anon";
GRANT ALL ON TABLE "public"."staff_chat_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_chat_threads" TO "service_role";



GRANT ALL ON TABLE "public"."staff_profiles" TO "anon";
GRANT ALL ON TABLE "public"."staff_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_customers" TO "anon";
GRANT ALL ON TABLE "public"."stripe_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_customers" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_events" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."support_requests" TO "anon";
GRANT ALL ON TABLE "public"."support_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."support_requests" TO "service_role";



GRANT ALL ON TABLE "public"."system_audit_events" TO "anon";
GRANT ALL ON TABLE "public"."system_audit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."system_audit_events" TO "service_role";



GRANT ALL ON TABLE "public"."tool_reviews" TO "anon";
GRANT ALL ON TABLE "public"."tool_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."tool_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."transcription_jobs" TO "anon";
GRANT ALL ON TABLE "public"."transcription_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."transcription_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."transfers" TO "anon";
GRANT ALL ON TABLE "public"."transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."transfers" TO "service_role";



GRANT ALL ON TABLE "public"."transit_updates" TO "anon";
GRANT ALL ON TABLE "public"."transit_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."transit_updates" TO "service_role";



GRANT ALL ON TABLE "public"."uploaded_assets" TO "anon";
GRANT ALL ON TABLE "public"."uploaded_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."uploaded_assets" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_projects" TO "anon";
GRANT ALL ON TABLE "public"."user_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."user_projects" TO "service_role";



GRANT ALL ON TABLE "public"."user_usage_limits" TO "anon";
GRANT ALL ON TABLE "public"."user_usage_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_usage_limits" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_links" TO "anon";
GRANT ALL ON TABLE "public"."vendor_links" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_links" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



GRANT ALL ON TABLE "public"."voice_command_logs" TO "anon";
GRANT ALL ON TABLE "public"."voice_command_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_command_logs" TO "service_role";



GRANT ALL ON TABLE "public"."weather_alerts" TO "anon";
GRANT ALL ON TABLE "public"."weather_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."weather_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_runs" TO "anon";
GRANT ALL ON TABLE "public"."workflow_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_runs" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_memberships" TO "anon";
GRANT ALL ON TABLE "public"."workspace_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































