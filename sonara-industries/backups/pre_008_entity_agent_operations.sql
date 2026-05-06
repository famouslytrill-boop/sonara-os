


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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

SET default_tablespace = '';

SET default_table_access_method = "heap";


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


CREATE TABLE IF NOT EXISTS "public"."sonara_billing_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sonara_billing_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sonara_launch_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sonara_launch_settings" OWNER TO "postgres";


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
    "source_name" "text"
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


ALTER TABLE ONLY "public"."business_modules"
    ADD CONSTRAINT "business_modules_module_key_key" UNIQUE ("module_key");



ALTER TABLE ONLY "public"."business_modules"
    ADD CONSTRAINT "business_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_products"
    ADD CONSTRAINT "digital_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_products"
    ADD CONSTRAINT "digital_products_product_slug_key" UNIQUE ("product_slug");



ALTER TABLE ONLY "public"."generated_outputs"
    ADD CONSTRAINT "generated_outputs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."module_feedback"
    ADD CONSTRAINT "module_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."module_runs"
    ADD CONSTRAINT "module_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_templates"
    ADD CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."release_plans"
    ADD CONSTRAINT "release_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_billing_customers"
    ADD CONSTRAINT "sonara_billing_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_billing_customers"
    ADD CONSTRAINT "sonara_billing_customers_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."sonara_launch_settings"
    ADD CONSTRAINT "sonara_launch_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sonara_launch_settings"
    ADD CONSTRAINT "sonara_launch_settings_setting_key_key" UNIQUE ("setting_key");



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



ALTER TABLE ONLY "public"."song_fingerprints"
    ADD CONSTRAINT "song_fingerprints_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."user_projects"
    ADD CONSTRAINT "user_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_usage_limits"
    ADD CONSTRAINT "user_usage_limits_pkey" PRIMARY KEY ("id");



CREATE INDEX "sonara_projects_owner_updated_idx" ON "public"."sonara_projects" USING "btree" ("owner_id", "updated_at" DESC);



CREATE INDEX "sonara_sound_assets_export_status_idx" ON "public"."sonara_sound_assets" USING "btree" ("export_status");



CREATE INDEX "sonara_sound_assets_redistribution_category_idx" ON "public"."sonara_sound_assets" USING "btree" ("redistribution_category");



CREATE INDEX "sonara_sound_assets_source_id_idx" ON "public"."sonara_sound_assets" USING "btree" ("source_id");



ALTER TABLE ONLY "public"."digital_products"
    ADD CONSTRAINT "digital_products_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."business_modules"("module_key");



ALTER TABLE ONLY "public"."generated_outputs"
    ADD CONSTRAINT "generated_outputs_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."business_modules"("module_key");



ALTER TABLE ONLY "public"."generated_outputs"
    ADD CONSTRAINT "generated_outputs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."user_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."module_feedback"
    ADD CONSTRAINT "module_feedback_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."business_modules"("module_key");



ALTER TABLE ONLY "public"."module_runs"
    ADD CONSTRAINT "module_runs_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."business_modules"("module_key");



ALTER TABLE ONLY "public"."module_runs"
    ADD CONSTRAINT "module_runs_output_id_fkey" FOREIGN KEY ("output_id") REFERENCES "public"."generated_outputs"("id");



ALTER TABLE ONLY "public"."prompt_templates"
    ADD CONSTRAINT "prompt_templates_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."business_modules"("module_key");



ALTER TABLE ONLY "public"."release_plans"
    ADD CONSTRAINT "release_plans_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."release_plans"
    ADD CONSTRAINT "release_plans_song_fingerprint_id_fkey" FOREIGN KEY ("song_fingerprint_id") REFERENCES "public"."song_fingerprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sonara_billing_customers"
    ADD CONSTRAINT "sonara_billing_customers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sonara_projects"
    ADD CONSTRAINT "sonara_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sonara_revenue_events"
    ADD CONSTRAINT "sonara_revenue_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."digital_products"("id");



ALTER TABLE ONLY "public"."sonara_sound_assets"
    ADD CONSTRAINT "sonara_sound_assets_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."sonara_sound_sources"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sonara_subscriptions"
    ADD CONSTRAINT "sonara_subscriptions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_fingerprints"
    ADD CONSTRAINT "song_fingerprints_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_projects"
    ADD CONSTRAINT "user_projects_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."business_modules"("module_key");



CREATE POLICY "No public access to stripe events" ON "public"."stripe_events" FOR SELECT TO "authenticated" USING (false);



CREATE POLICY "Users can manage their own SONARA projects" ON "public"."sonara_projects" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage their own release plans" ON "public"."release_plans" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage their own song fingerprints" ON "public"."song_fingerprints" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can view their own billing customer" ON "public"."sonara_billing_customers" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can view their own stripe customer row" ON "public"."stripe_customers" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own subscription" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own subscriptions" ON "public"."sonara_subscriptions" FOR SELECT USING (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."business_modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."digital_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_outputs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."module_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."module_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prompt_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."release_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_billing_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_launch_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_revenue_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_sound_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_sound_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_sound_sync_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sonara_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."song_fingerprints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_usage_limits" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


















GRANT ALL ON TABLE "public"."business_modules" TO "anon";
GRANT ALL ON TABLE "public"."business_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."business_modules" TO "service_role";



GRANT ALL ON TABLE "public"."digital_products" TO "anon";
GRANT ALL ON TABLE "public"."digital_products" TO "authenticated";
GRANT ALL ON TABLE "public"."digital_products" TO "service_role";



GRANT ALL ON TABLE "public"."generated_outputs" TO "anon";
GRANT ALL ON TABLE "public"."generated_outputs" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_outputs" TO "service_role";



GRANT ALL ON TABLE "public"."module_feedback" TO "anon";
GRANT ALL ON TABLE "public"."module_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."module_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."module_runs" TO "anon";
GRANT ALL ON TABLE "public"."module_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."module_runs" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_templates" TO "anon";
GRANT ALL ON TABLE "public"."prompt_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_templates" TO "service_role";



GRANT ALL ON TABLE "public"."release_plans" TO "anon";
GRANT ALL ON TABLE "public"."release_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."release_plans" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_billing_customers" TO "anon";
GRANT ALL ON TABLE "public"."sonara_billing_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_billing_customers" TO "service_role";



GRANT ALL ON TABLE "public"."sonara_launch_settings" TO "anon";
GRANT ALL ON TABLE "public"."sonara_launch_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."sonara_launch_settings" TO "service_role";



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



GRANT ALL ON TABLE "public"."song_fingerprints" TO "anon";
GRANT ALL ON TABLE "public"."song_fingerprints" TO "authenticated";
GRANT ALL ON TABLE "public"."song_fingerprints" TO "service_role";



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



GRANT ALL ON TABLE "public"."user_projects" TO "anon";
GRANT ALL ON TABLE "public"."user_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."user_projects" TO "service_role";



GRANT ALL ON TABLE "public"."user_usage_limits" TO "anon";
GRANT ALL ON TABLE "public"."user_usage_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_usage_limits" TO "service_role";









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



































