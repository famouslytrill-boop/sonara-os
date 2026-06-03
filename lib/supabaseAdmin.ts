import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SonaraDatabase = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          metadata?: Record<string, unknown>;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
          metadata?: Record<string, unknown>;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
          metadata?: Record<string, unknown>;
        };
        Update: {
          name?: string;
          slug?: string | null;
          owner_id?: string | null;
          updated_at?: string;
          metadata?: Record<string, unknown>;
        };
        Relationships: [];
      };
      organization_memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: string;
          status: string;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: string;
          status?: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          role?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          organization_id: string | null;
          language: string;
          unit_system: string;
          timezone: string | null;
          created_at: string;
          updated_at: string;
          metadata: Record<string, unknown>;
        };
        Insert: {
          user_id: string;
          organization_id?: string | null;
          language?: string;
          unit_system?: string;
          timezone?: string | null;
          created_at?: string;
          updated_at?: string;
          metadata?: Record<string, unknown>;
        };
        Update: {
          organization_id?: string | null;
          language?: string;
          unit_system?: string;
          timezone?: string | null;
          updated_at?: string;
          metadata?: Record<string, unknown>;
        };
        Relationships: [];
      };
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
      webhook_events: {
        Row: {
          id: string;
          organization_id: string | null;
          provider: string;
          event_id: string;
          event_type: string;
          processed_at: string | null;
          created_at: string;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          provider: string;
          event_id: string;
          event_type: string;
          processed_at?: string | null;
          created_at?: string;
          metadata?: Record<string, unknown>;
        };
        Update: {
          organization_id?: string | null;
          provider?: string;
          event_id?: string;
          event_type?: string;
          processed_at?: string | null;
          metadata?: Record<string, unknown>;
        };
        Relationships: [];
      };
      support_requests: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          name: string;
          email: string;
          organization_name: string | null;
          category: string;
          subject: string;
          message: string;
          urgency: string;
          status: string;
          source_path: string | null;
          user_id: string | null;
          organization_id: string | null;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name: string;
          email: string;
          organization_name?: string | null;
          category: string;
          subject: string;
          message: string;
          urgency?: string;
          status?: string;
          source_path?: string | null;
          user_id?: string | null;
          organization_id?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: {
          updated_at?: string;
          status?: string;
          metadata?: Record<string, unknown>;
        };
        Relationships: [];
      };
      feedback_reports: {
        Row: {
          id: string;
          created_at: string;
          feedback_type: string;
          page_path: string | null;
          rating: number | null;
          message: string;
          email: string | null;
          user_id: string | null;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          created_at?: string;
          feedback_type: string;
          page_path?: string | null;
          rating?: number | null;
          message: string;
          email?: string | null;
          user_id?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: {
          metadata?: Record<string, unknown>;
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
