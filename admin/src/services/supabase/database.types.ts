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
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

// Stage C2D-FIX removed the security_events / security_event_legal_holds
// table declarations entirely (no browser grant exists on either table
// any more) and added the two read RPCs above. Still hand-written, not
// `supabase gen types` output.
