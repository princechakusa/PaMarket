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
      // C2D — read-only from the browser. No Insert/Update shape exists
      // because no browser role holds INSERT/UPDATE/DELETE on this table;
      // the only write path is record_security_event() (service_role only,
      // never called from admin/), enforced by RLS + grants, not by this
      // type alone.
      security_events: {
        Row: {
          id: string;
          event_type: string;
          severity: string;
          source: string;
          occurred_at: string;
          received_at: string;
          actor_user_id: string | null;
          actor_role: string | null;
          actor_authenticated: boolean;
          session_id: string | null;
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
          event_key: string | null;
          metadata: Json;
          retention_until: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      security_event_legal_holds: {
        Row: {
          id: string;
          event_id: string | null;
          correlation_id: string | null;
          reason: string;
          status: string;
          placed_by: string;
          placed_at: string;
          released_by: string | null;
          released_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
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
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

// Stage C2D adds the security_events / security_event_legal_holds tables
// (read-only) and the two legal-hold RPCs used by the Security Events page.
// Still hand-written, not `supabase gen types` output — regenerate fully
// before a later stage reads more of the schema from admin/.
