export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      // C2E-10: extended with the real, non-secret profile columns User
      // Intelligence needs. Never includes mfa_secret/two_factor_secret —
      // only the safe generated `mfa_enabled` boolean (C2E-6/C2E-8).
      profiles: {
        Row: {
          id: string; name: string | null; email: string | null; phone: string | null;
          role: string | null; status: string | null; verified: boolean | null;
          city: string | null; province: string | null; company: string | null;
          company_verified: boolean | null; created_at: string | null;
          last_seen: string | null; last_active_at: string | null; mfa_enabled: boolean | null;
        };
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
      // C2E-10: extended with the owner/user-linkage and review-metadata
      // columns User Intelligence needs. Deliberately excludes id_doc /
      // selfie / id_doc_path / selfie_path / reg_doc_path — raw document
      // paths are never selected by any C2E-10 query.
      // Batch 3: extended with the operational fields the Businesses
      // workspace needs. Still excludes id_doc/selfie/*_path columns.
      businesses: {
        Row: {
          id: string; name: string | null; status: string | null; owner_user_id: string | null;
          province: string | null; city: string | null; category: string | null; biz_type: string | null;
          phone: string | null; email: string | null; plan_id: string | null; verification_level: number | null;
          verification_pending: boolean | null; created_at: string | null;
        };
        Insert: { id?: string; status?: string | null };
        Update: { status?: string | null };
        Relationships: [];
      };
      // Batch 3: Platform + Operations tables. All already admin/support-
      // gated RLS (is_admin()/is_support_team()), verified live before use.
      app_error_events: {
        Row: {
          id: string; source: string | null; error_type: string | null; message: string | null; stack: string | null;
          screen: string | null; app_version: string | null; platform: string | null; environment: string | null;
          severity: string | null; occurrence_count: number | null; affected_users_count: number | null;
          first_seen_at: string | null; last_seen_at: string | null; status: string | null; admin_notes: string | null;
          resolved_at: string | null; sentry_event_id: string | null; created_at: string | null;
        };
        Insert: { id?: string; status?: string | null };
        Update: { status?: string | null; admin_notes?: string | null; resolved_at?: string | null; resolved_by?: string | null };
        Relationships: [];
      };
      app_settings: { Row: { id: number; settings: Json; updated_at: string | null }; Insert: { id?: number; settings?: Json }; Update: { settings?: Json }; Relationships: [] };
      notifications: {
        Row: { id: string; user_id: string | null; title: string | null; body: string | null; read: boolean | null; created_at: number | null; type: string | null; category: string | null; push_sent: boolean | null; push_status: string | null; meta: Json | null };
        Insert: { id?: string; user_id: string; title: string; body?: string | null; type?: string | null; category?: string | null; meta?: Json | null };
        Update: { read?: boolean | null };
        Relationships: [];
      };
      contact_requests: {
        Row: { id: string; requester_id: string | null; candidate_id: string | null; requester_name: string | null; candidate_name: string | null; company: string | null; role: string | null; note: string | null; status: string | null; created_at: string | null; decided_at: string | null; decided_by: string | null };
        Insert: { id?: string; status?: string | null };
        Update: { status?: string | null; decided_at?: string | null; decided_by?: string | null };
        Relationships: [];
      };
      support_tickets: {
        Row: { id: string; subject: string | null; requester_id: string | null; status: string | null; priority: string | null; category: string | null; assigned_to: string | null; source: string | null; first_response_at: string | null; resolved_at: string | null; created_at: string | null; updated_at: string | null };
        Insert: { id?: string; status?: string | null };
        Update: { status?: string | null; priority?: string | null; assigned_to?: string | null; resolved_at?: string | null };
        Relationships: [];
      };
      support_ticket_messages: {
        Row: { id: string; ticket_id: string | null; author_id: string | null; author_kind: string | null; body: string | null; internal: boolean | null; created_at: string | null };
        Insert: { id?: string; ticket_id: string; author_id: string; author_kind: string; body: string; internal?: boolean };
        Update: Record<string, never>;
        Relationships: [];
      };
      // Batch 1: extended with review-workflow columns. Still excludes
      // id_doc/selfie/id_doc_path/selfie_path/reg_doc_path — raw document
      // paths are never selected anywhere in this codebase.
      verifications: { Row: { id: string; user_id: string | null; status: string | null; admin_note: string | null; submitted_at: string | null; reviewed_at: string | null; reviewed_by: string | null; id_doc_path: string | null; selfie_path: string | null }; Insert: { id?: string; status?: string | null }; Update: { status?: string | null; admin_note?: string | null; reviewed_at?: string | null; reviewed_by?: string | null }; Relationships: [] };
      business_verifications: { Row: { id: string; business_id: string | null; status: string | null; admin_note: string | null; submitted_at: string | null; reviewed_at: string | null; level_requested: number | null; id_doc_path: string | null; reg_doc_path: string | null }; Insert: { id?: string; status?: string | null }; Update: { status?: string | null; admin_note?: string | null; reviewed_at?: string | null }; Relationships: [] };
      // Batch 1: extended with the real Marketplace/Listings columns.
      // Deliberately excludes nothing sensitive -- listings are a public
      // marketplace entity, no PII beyond seller_name/seller_phone which
      // the seller themselves chose to publish on the listing.
      listings: {
        Row: {
          id: string; title: string | null; description: string | null; price: number | null; currency: string | null;
          category: string | null; status: string | null; province: string | null; city: string | null; suburb: string | null;
          photos: string[] | null; seller_id: string | null; seller_name: string | null; seller_phone: string | null;
          condition: string | null; business_id: string | null; views: number | null;
          created_at: string | null; updated_at: string | null; expires_at: string | null;
        };
        Insert: { id?: string; status?: string | null; province?: string | null };
        Update: { status?: string | null; province?: string | null };
        Relationships: [];
      };
      reports: { Row: { id: string; status: string | null; target_type: string | null; target_id: string | null; reason: string | null; severity: string | null; created_at: number | null; reporter_id: string | null; reported_by: string | null; assigned_to: string | null }; Insert: { id?: string; status?: string | null }; Update: { status?: string | null; assigned_to?: string | null }; Relationships: [] };
      moderation_appeals: { Row: { id: string; status: string | null; requester_id: string | null; entity: string | null; entity_id: string | null; reason: string | null; created_at: string | null; decided_by: string | null; decided_at: string | null }; Insert: { id?: string; status?: string | null }; Update: { status?: string | null; decided_at?: string | null; decided_by?: string | null }; Relationships: [] };
      applications: {
        Row: {
          id: string; job_id: string | null; job_title: string | null; company: string | null;
          applicant_id: string | null; applicant_name: string | null; applicant_phone: string | null; applicant_email: string | null;
          message: string | null; status: string | null; employer_id: string | null; applied_at: string | null;
        };
        Insert: { id?: string; status?: string | null };
        Update: { status?: string | null };
        Relationships: [];
      };
      // Batch 2 (Commerce + Rentals + Reviews): all tables below reuse
      // already-verified admin/owner-scoped RLS (is_admin() throughout,
      // per the C2E-14/15/20 sibling-table precedent) — no new policies
      // except paid_ads' admin SELECT and the finance RPC fix, both
      // documented in the Batch 2 migration. play_purchases and
      // rental_featured_slot_packs deliberately exclude purchase_token
      // (sensitive) from every Row type below.
      rental_companies: {
        Row: {
          id: string; business_id: string | null; trading_name: string | null; status: string | null;
          admin_note: string | null; approved_at: string | null; approved_by: string | null;
          fleet_count: number | null; avg_rating: number | null; review_count: number | null;
          total_views: number | null; created_at: string | null; deleted_at: string | null;
        };
        Insert: { id?: string; status?: string | null };
        Update: { status?: string | null; admin_note?: string | null; approved_at?: string | null; approved_by?: string | null };
        Relationships: [];
      };
      rental_vehicle_listings: {
        Row: {
          id: string; company_id: string | null; model: string | null; year: number | null; registration: string | null;
          daily_rate: number | null; status: string | null; admin_status: string | null; admin_note: string | null;
          is_available: boolean | null; view_count: number | null; inquiry_count: number | null; save_count: number | null;
          created_at: string | null;
        };
        Insert: { id?: string; status?: string | null; admin_status?: string | null };
        Update: { status?: string | null; admin_status?: string | null; admin_note?: string | null };
        Relationships: [];
      };
      rental_vehicle_states: {
        Row: { listing_id: string; current_state: string | null; changed_by: string | null; change_reason: string | null; previous_state: string | null; state_entered_at: string | null; auto_return_at: string | null };
        Insert: { listing_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      rental_reviews: {
        Row: { id: string; company_id: string | null; reviewer_id: string | null; reviewer_name: string | null; rating: number | null; title: string | null; body: string | null; status: string | null; admin_note: string | null; created_at: string | null };
        Insert: { id?: string; status?: string | null };
        Update: { status?: string | null; admin_note?: string | null };
        Relationships: [];
      };
      rental_reports: {
        Row: { id: string; listing_id: string | null; reporter_id: string | null; reason: string | null; detail: string | null; status: string | null; resolved_by: string | null; resolved_at: string | null; admin_note: string | null; severity: string | null; created_at: string | null };
        Insert: { id?: string; status?: string | null };
        Update: { status?: string | null; resolved_by?: string | null; resolved_at?: string | null; admin_note?: string | null };
        Relationships: [];
      };
      rental_audit_logs: {
        Row: { id: string; actor_id: string | null; actor_role: string | null; action: string | null; target_table: string | null; target_id: string | null; created_at: string | null };
        Insert: { id?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      rental_featured_listings: {
        Row: { id: string; listing_id: string | null; company_id: string | null; starts_at: string | null; ends_at: string | null; priority: number | null; approved_by: string | null; is_active: boolean | null; created_at: string | null };
        Insert: { id?: string };
        Update: { is_active?: boolean | null; approved_by?: string | null };
        Relationships: [];
      };
      rental_brands: { Row: { id: string; slug: string | null; label: string | null; is_active: boolean | null; sort_order: number | null }; Insert: { id?: string }; Update: { is_active?: boolean | null }; Relationships: [] };
      rental_categories: { Row: { id: string; slug: string | null; label: string | null; sort_order: number | null; is_active: boolean | null }; Insert: { id?: string }; Update: { is_active?: boolean | null }; Relationships: [] };
      rental_locations: { Row: { id: string; city: string | null; province: string | null; country: string | null; is_active: boolean | null; sort_order: number | null; slug: string | null }; Insert: { id?: string }; Update: { is_active?: boolean | null }; Relationships: [] };
      shop_orders: {
        Row: {
          id: string; business_id: string | null; customer_id: string | null; status: string | null;
          fulfillment_method: string | null; delivery_address: string | null; customer_name: string | null;
          customer_phone: string | null; customer_note: string | null; item_count: number | null;
          total: number | null; currency: string | null; created_at: string | null; updated_at: string | null;
        };
        Insert: { id?: string; status?: string | null };
        Update: { status?: string | null };
        Relationships: [];
      };
      shop_order_items: { Row: { id: string; order_id: string | null; title_snapshot: string | null; image_snapshot: string | null; unit_price_snapshot: number | null; currency_snapshot: string | null; quantity: number | null; subtotal_snapshot: number | null }; Insert: { id?: string }; Update: Record<string, never>; Relationships: [] };
      shop_order_status_history: { Row: { id: string; order_id: string | null; status: string | null; note: string | null; changed_by: string | null; created_at: string | null }; Insert: { id?: string }; Update: Record<string, never>; Relationships: [] };
      paid_ads: {
        Row: {
          id: string; ad_type: string | null; business_name: string | null; headline: string | null; tagline: string | null;
          target_cat: string | null; target_section: string | null; starts_at: string | null; ends_at: string | null;
          active: boolean | null; status: string | null; price_paid: number | null; payment_method: string | null;
          impressions: number | null; clicks: number | null; created_at: string | null; listing_id: string | null;
          advertiser_id: string | null; activated_at: string | null; completed_at: string | null;
        };
        Insert: { id?: string; active?: boolean | null };
        Update: { active?: boolean | null };
        Relationships: [];
      };
      play_purchases: { Row: { id: string; user_id: string | null; listing_id: string | null; product_id: string | null; status: string | null; verification_error: string | null; purchase_time: string | null; expiry_time: string | null; created_at: string | null; verified_at: string | null; platform: string | null }; Insert: { id?: string }; Update: Record<string, never>; Relationships: [] };
      reviews: { Row: { id: string; seller_id: string | null; reviewer_id: string | null; reviewer_name: string | null; rating: number | null; body: string | null; created_at: string | null }; Insert: { id?: string }; Update: Record<string, never>; Relationships: [] };
      business_reviews: { Row: { id: string; business_id: string | null; reviewer_id: string | null; reviewer_name: string | null; rating: number | null; comment: string | null; created_at: string | null }; Insert: { id?: string }; Update: Record<string, never>; Relationships: [] };
      business_subscriptions: { Row: { id: string; business_id: string | null; status: string | null; plan_id: string | null; billing_cycle: string | null; current_period_end: string | null; auto_renew: boolean | null }; Insert: { id?: string; status?: string | null }; Update: { status?: string | null }; Relationships: [] };
      // Batch 3: business_payments row shape for the Businesses workspace's
      // aggregate-only summary (C2E-15: is_admin(), super_admin included).
      business_payments: { Row: { id: string; business_id: string | null; amount: number | null; status: string | null; type: string | null; created_at: string | null }; Insert: { id?: string }; Update: Record<string, never>; Relationships: [] };
      // C2E-14: admin-read-only business_staff (is_admin()).
      business_staff: { Row: { id: string; business_id: string | null; user_id: string | null; role: string | null; status: string | null }; Insert: { id?: string }; Update: Record<string, never>; Relationships: [] };
      // Batch 4: Shared + Advanced -- Audit, Content, Taxonomy, AMOS. All
      // already admin-gated RLS (has_admin_privilege('admin') / admin write
      // + public read on published/active rows), verified live before use.
      role_audit_log: {
        Row: { id: number; actor_id: string | null; target_id: string | null; old_role: string | null; new_role: string | null; changed_at: string | null };
        Insert: { id?: number }; Update: Record<string, never>; Relationships: [];
      };
      categories: {
        Row: { id: string; legacy_key: string | null; slug: string | null; name: string | null; description: string | null; icon: string | null; color: string | null; sort_order: number | null; is_active: boolean | null; country_code: string | null; updated_by: string | null; updated_at: string | null };
        Insert: { id?: string };
        Update: { is_active?: boolean | null; name?: string | null; description?: string | null; icon?: string | null; color?: string | null; sort_order?: number | null; updated_by?: string | null; updated_at?: string | null };
        Relationships: [];
      };
      content_pages: {
        Row: { id: string; slug: string | null; content_type: string | null; locale: string | null; title: string | null; short_description: string | null; body: Json; status: string | null; version: number | null; effective_date: string | null; parent_id: string | null; metadata: Json; updated_by: string | null };
        Insert: { id?: string };
        Update: { title?: string | null; short_description?: string | null; body?: Json; status?: string | null; version?: number | null; effective_date?: string | null; updated_by?: string | null };
        Relationships: [];
      };
      content_page_versions: {
        Row: { id: string; content_page_id: string | null; version: number | null; title: string | null; short_description: string | null; body: Json; status: string | null; effective_date: string | null; metadata: Json; updated_by: string | null };
        Insert: { id?: string; content_page_id: string; version: number; title?: string | null; short_description?: string | null; body: Json; status?: string | null; effective_date?: string | null; updated_by?: string | null };
        Update: Record<string, never>;
        Relationships: [];
      };
      blog_videos: {
        Row: { id: string; title: string | null; description: string | null; provider: string | null; embed_id: string | null; video_url: string | null; is_published: boolean | null; sort_order: number | null; created_by: string | null };
        Insert: { id?: string; title: string; description?: string | null; provider?: string | null; embed_id?: string | null; video_url: string; is_published?: boolean | null; sort_order?: number | null; created_by?: string | null };
        Update: { title?: string | null; description?: string | null; provider?: string | null; embed_id?: string | null; is_published?: boolean | null; sort_order?: number | null };
        Relationships: [];
      };
      amos_content_drafts: {
        Row: { id: string; content_item_id: string | null; channel: string | null; draft_type: string | null; body: string | null; status: string | null; reviewed_by: string | null; reviewed_at: string | null; created_at: string | null; relevance_score: number | null; brand_alignment_score: number | null; engagement_prediction_score: number | null; seo_value_score: number | null };
        Insert: { id?: string };
        Update: { status?: string | null; reviewed_by?: string | null; reviewed_at?: string | null };
        Relationships: [];
      };
      amos_schedule: { Row: { id: string; draft_id: string | null; scheduled_for: string | null; status: string | null; attempts: number | null; last_error: string | null; platform: string | null; created_at: string | null }; Insert: { id?: string }; Update: Record<string, never>; Relationships: [] };
      amos_market_intelligence: { Row: { id: string; country_code: string | null; signal_type: string | null; topic: string | null; score: number | null; rationale: string | null; collected_at: string | null; expires_at: string | null }; Insert: { id?: string }; Update: Record<string, never>; Relationships: [] };
      amos_seo_recommendations: { Row: { id: string; country_code: string | null; page_type: string | null; page_ref: string | null; recommendation_type: string | null; current_value: string | null; suggested_value: string | null; status: string | null; impact_estimate: string | null; created_at: string | null }; Insert: { id?: string }; Update: { status?: string | null }; Relationships: [] };
      amos_integrations: { Row: { id: string; provider: string | null; status: string | null; last_success_at: string | null; last_error: string | null; consecutive_failures: number | null; auto_disabled: boolean | null }; Insert: { id?: string }; Update: Record<string, never>; Relationships: [] };
      amos_settings: {
        Row: { country_code: string; approval_required: boolean | null; daily_batch_enabled: boolean | null; ai_provider: string | null; video_provider: string | null; budget_monthly_cents: number | null; brand_voice: string | null; ai_spend_cents_this_month: number | null; ai_budget_cents_limit: number | null; updated_by: string | null; updated_at: string | null };
        Insert: { country_code: string };
        Update: { approval_required?: boolean | null; daily_batch_enabled?: boolean | null; budget_monthly_cents?: number | null; ai_budget_cents_limit?: number | null; updated_by?: string | null; updated_at?: string | null };
        Relationships: [];
      };
      admin_audit_logs: {
        Row: { id: string; action: string; entity: string; entity_id: string | null; actor_role: string | null; actor_email: string | null; reason: string | null; created_at: string };
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
      // Batch 2: existing, already-audited mutation RPCs — reused as-is.
      update_shop_order_status: { Args: { p_order_id: string; p_new_status: string; p_note?: string | null }; Returns: Json };
      admin_set_paid_ad_active: { Args: { p_ad_id: string; p_active: boolean }; Returns: { id: string; active: boolean; status: string }[] };
      admin_pause_scheduled_paid_ad: { Args: { p_ad_id: string }; Returns: { id: string; active: boolean; status: string }[] };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

// Stage C2D-FIX removed the security_events / security_event_legal_holds
// table declarations entirely (no browser grant exists on either table
// any more) and added the two read RPCs above. Still hand-written, not
// `supabase gen types` output.
