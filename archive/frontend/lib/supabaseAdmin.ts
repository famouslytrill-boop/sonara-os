import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SonaraDatabase = {
  public: {
    Tables: {
      sonara_user_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier_id: string;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier_id: string;
          status: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          tier_id?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      sonara_memory_records: {
        Row: {
          id: string;
          user_id: string | null;
          kind: string;
          title: string;
          content: string;
          metadata: Record<string, unknown>;
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          kind: string;
          title: string;
          content: string;
          metadata?: Record<string, unknown>;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string | null;
          kind?: string;
          title?: string;
          content?: string;
          metadata?: Record<string, unknown>;
          embedding?: number[] | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sonara_generation_history: {
        Row: {
          id: string;
          user_id: string | null;
          parent_id: string | null;
          project_id: string | null;
          engine_name: string;
          engine_version: string;
          input_hash: string;
          input_data: Record<string, unknown>;
          settings_snapshot: Record<string, unknown>;
          output_data: Record<string, unknown>;
          label: string | null;
          is_selected: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id?: string | null;
          parent_id?: string | null;
          project_id?: string | null;
          engine_name: string;
          engine_version: string;
          input_hash: string;
          input_data?: Record<string, unknown>;
          settings_snapshot?: Record<string, unknown>;
          output_data?: Record<string, unknown>;
          label?: string | null;
          is_selected?: boolean;
          created_at?: string;
        };
        Update: {
          parent_id?: string | null;
          project_id?: string | null;
          output_data?: Record<string, unknown>;
          label?: string | null;
          is_selected?: boolean;
        };
        Relationships: [];
      };
      sonara_sound_sources: {
        Row: {
          id: string;
          name: string;
          url: string | null;
          source_type: string | null;
          commercial_use_risk: string | null;
          redistribution_risk: string | null;
          requires_api_key: boolean | null;
          launch_status: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          name: string;
          url?: string | null;
          source_type?: string | null;
          commercial_use_risk?: string | null;
          redistribution_risk?: string | null;
          requires_api_key?: boolean | null;
          launch_status?: string | null;
        };
        Update: {
          name?: string;
          url?: string | null;
          source_type?: string | null;
          commercial_use_risk?: string | null;
          redistribution_risk?: string | null;
          requires_api_key?: boolean | null;
          launch_status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      sonara_sound_assets: {
        Row: {
          id: string;
          name: string;
          asset_type: string | null;
          license: string | null;
          redistribution_category: string | null;
          commercial_use_allowed: boolean | null;
          redistribution_allowed: boolean | null;
          attribution_required: boolean | null;
          export_status: string | null;
          metadata: Record<string, unknown> | null;
        };
        Insert: {
          id: string;
          name: string;
          asset_type?: string | null;
          license?: string | null;
          redistribution_category?: string | null;
          commercial_use_allowed?: boolean | null;
          redistribution_allowed?: boolean | null;
          attribution_required?: boolean | null;
          export_status?: string | null;
          metadata?: Record<string, unknown> | null;
        };
        Update: {
          name?: string;
          asset_type?: string | null;
          license?: string | null;
          redistribution_category?: string | null;
          commercial_use_allowed?: boolean | null;
          redistribution_allowed?: boolean | null;
          attribution_required?: boolean | null;
          export_status?: string | null;
          metadata?: Record<string, unknown> | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let adminClient: SupabaseClient<SonaraDatabase> | null = null;

function isValidHttpUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isValidHttpUrl(url) || !serviceRoleKey) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient<SonaraDatabase>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
