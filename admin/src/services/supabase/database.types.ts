export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; name: string | null; role: string | null };
        Insert: { id: string; name?: string | null; role?: string | null };
        Update: { name?: string | null; role?: string | null };
        Relationships: [];
      };
      // C2D-FIX: the browser no longer has any grant on security_events or
      // security_event_legal_holds — both tables are read exclusively
      // through list_security_events()/get_security_event() (Functions,
      // below). Row shapes are still declared under Functions.*.Returns,
      // not here, since there is no browser .from() path left to type.

      // C2E-9: Dashboard count-only reads. Each table already has
      // admin/moderator-tier RLS (verified live during the C2E-9 audit) —
      // these are read-only Row shapes for `.select('*', { count: 'exact',
      // head: true })` style queries, not full table mirrors.
      businesses: { Row: { id: string; status: string | null }; Insert: { id?: string; status?: string | null }; Update: { status?: string | null }; Relationships: [] };
      verifications: { Row: { id: string; status: string | null }; Insert: { id?: string; status?: string | null }; Update: { status?: string | null }; Relationships: [] };
      business_verifications: { Row: { id: string; status: string | null }; Insert: { id?: string; status?: string | null }; Update: { status?: string | null }; Relationships: [] };
      listings: { Row: { id: string; status: string | null; province: string | null }; Insert: { id?: string; status?: string | null; province?: string | null }; Update: { status?: string | null; province?: string | null }; Relationships: [] };
      reports: { Row: { id: string; status: string | null }; Insert: { id?: string; status?: string | null }; Update: { status?: string | null }; Relationships: [] };
      moderation_appeals: { Row: { id: string; status: string | null }; Insert: { id?: string; status?: string | null }; Update: { status?: string | null }; Relationships: [] };
      applications: { Row: { id: string; status: string | null }; Insert: { id?: string; status?: string | null }; Update: { status?: string | null }; Relationships: [] };
      rental_vehicle_listings: { Row: { id: string; status: string | null; admin_status: string | null }; Insert: { id?: string; status?: string | null; admin_status?: string | null }; Update: { status?: string | null; admin_status?: string | null }; Relationships: [] };
      business_subscriptions: { Row: { id: string; status: string | null }; Insert: { id?: string; status?: string | null }; Update: { status?: string | null }; Relationships: [] };
      app_error_events: { Row: { id: string; status: string | null; severity: string | null }; Insert: { id?: string; status?: string | null; severity?: string | null }; Update: { status?: string | null; severity?: string | null }; Relationships: [] };
      admin_audit_logs: {
        Row: { id: string; action: string; entity: string; entity_id: string | null; actor_role: string | null; reason: string | null; created_at: string };
        Insert: { id?: string; action: string; entity: string; entity_id?: string | null; actor_role?: string | null; reason?: string | null; created_at?: string };
        Update: { action?: string; entity?: string; entity_id?: string | null; actor_role?: string | null; reason?: string | null; created_at?: string };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      place_legal_hold: {
        Args: { p_event_id: string | null; p_correlation_id: string | null; p_reason: string };
        Returns: { id: string }[];
      };
      release_legal_hold: {
        Args: { p_hold_id: string };
        Returns: { id: string }[];
      };
      // C2D-FIX — the only read path into security_events. ip_address /
      // ip_source are redacted (null / 'restricted') server-side unless
      // the caller is_super_admin(); this type does not and cannot
      // express that per-row, per-caller behavior — see
      // admin/docs/c2d-ip-redaction-fix-results.md.
      list_security_events: {
        Args: {
          p_page?: number;
          p_page_size?: number;
          p_from?: string | null;
          p_to?: string | null;
          p_severity?: string | null;
          p_event_type?: string | null;
          p_source?: string | null;
          p_outcome?: string | null;
          p_actor_user_id?: string | null;
          p_correlation_id?: string | null;
        };
        Returns: {
          id: string;
          event_type: string;
          severity: string;
          source: string;
          occurred_at: string;
          actor_user_id: string | null;
          actor_role: string | null;
          actor_authenticated: boolean;
          assurance_level: string;
          target_type: string | null;
          target_id: string | null;
          action: string;
          outcome: string;
          reason_code: string | null;
          correlation_id: string | null;
          request_path: string | null;
          request_method: string | null;
          ip_address: string | null;
          ip_source: string;
          user_agent: string | null;
          retention_until: string;
          total_count: number;
        }[];
      };
      get_security_event: {
        Args: { p_event_id: string };
        Returns: {
          id: string;
          event_type: string;
          severity: string;
          source: string;
          occurred_at: string;
          received_at: string;
          actor_user_id: string | null;
          actor_role: string | null;
          actor_authenticated: boolean;
          assurance_level: string;
          target_type: string | null;
          target_id: string | null;
          action: string;
          outcome: string;
          reason_code: string | null;
          correlation_id: string | null;
          request_path: string | null;
          request_method: string | null;
          ip_address: string | null;
          ip_source: string;
          user_agent: string | null;
          metadata: Json;
          retention_until: string;
          created_at: string;
          hold_status: string;
          hold_id: string | null;
        }[];
      };
      // C2E-9: the six existing C2E-5-gated analytics RPCs (already
      // has_admin_privilege('admin')-enforced server-side; unused by any
      // frontend before this stage). Reused as-is, not modified.
      admin_daily_growth: { Args: { days?: number }; Returns: { d: string; users: number; listings: number }[] };
      admin_cohorts: { Args: { weeks?: number }; Returns: { cohort: string; signups: number; verified: number }[] };
      admin_category_breakdown: { Args: Record<string, never>; Returns: { category: string; n: number }[] };
      admin_province_breakdown: { Args: Record<string, never>; Returns: { province: string; n: number }[] };
      admin_revenue_summary: { Args: { days?: number }; Returns: { subs_paid: number; subs_failed: number; subs_pending: number; other_paid: number; ads_revenue: number; txn_count: number } };
      admin_top_payers: { Args: { days?: number; lim?: number }; Returns: { business_id: string; total: number; payments: number }[] };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

// Stage C2D-FIX removed the security_events / security_event_legal_holds
// table declarations entirely (no browser grant exists on either table
// any more) and added the two read RPCs above. Still hand-written, not
// `supabase gen types` output.
